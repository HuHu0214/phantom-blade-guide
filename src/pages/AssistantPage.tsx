import { useEffect, useRef, useState } from "react";
import type {
  AssistantGuideTarget,
  AssistantMessage,
  AssistantNextResponse,
  AssistantStatus,
} from "../../shared/types";
import { api } from "../api";

const SUGGESTIONS = [
  "根据当前进度，我下一步该做什么？",
  "本章有哪些容易错过的东西？",
  "真结局还差什么？",
  "当前这个首领怎么打？",
];

const CHAT_KEY = "pbz.assistant.chat.v1";
const NEXT_KEY = "pbz.assistant.next.v1";
const DRAFT_KEY = "pbz.assistant.draft.v1";
const MAX_MESSAGES = 40;

const WELCOME: AssistantMessage = {
  role: "assistant",
  content:
    "我是影境手札的参谋。可以问“下一步做什么”“本章有哪些易错过”“真结局还差什么”。回答只基于本地攻略库和你的当前进度。",
};

function loadMessages(): AssistantMessage[] {
  try {
    const raw = localStorage.getItem(CHAT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const messages = parsed
          .filter(
            (message): message is AssistantMessage =>
              message &&
              (message.role === "user" || message.role === "assistant") &&
              typeof message.content === "string"
          )
          .slice(-MAX_MESSAGES);
        while (
          messages.length &&
          messages[messages.length - 1].role === "assistant" &&
          !messages[messages.length - 1].content.trim()
        ) {
          messages.pop();
        }
        if (messages.length) return messages;
      }
    }
  } catch {
    /* storage unavailable */
  }
  return [WELCOME];
}

function loadStoredNext(): AssistantNextResponse | null {
  try {
    const raw = localStorage.getItem(NEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.briefing === "string" &&
      Array.isArray(parsed.actions)
    ) {
      return parsed as AssistantNextResponse;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function loadDraft(): string {
  try {
    return localStorage.getItem(DRAFT_KEY) || "";
  } catch {
    return "";
  }
}

export function AssistantPage({
  status,
  onOpenSettings,
  onOpenGuide,
  notify,
}: {
  status: AssistantStatus | null;
  onOpenSettings: () => void;
  onOpenGuide: (target: AssistantGuideTarget) => void;
  notify: (message: string, tone?: "ok" | "error") => void;
}) {
  const [next, setNext] = useState<AssistantNextResponse | null>(
    loadStoredNext
  );
  const [loadingNext, setLoadingNext] = useState(false);
  const [messages, setMessages] =
    useState<AssistantMessage[]>(loadMessages);
  const [input, setInput] = useState(loadDraft);
  const [streaming, setStreaming] = useState(false);
  const chatRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, streaming]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(
          CHAT_KEY,
          JSON.stringify(messages.slice(-MAX_MESSAGES))
        );
      } catch {
        /* storage unavailable */
      }
    }, 220);
    return () => window.clearTimeout(timer);
  }, [messages]);

  useEffect(() => {
    try {
      if (next) localStorage.setItem(NEXT_KEY, JSON.stringify(next));
      else localStorage.removeItem(NEXT_KEY);
    } catch {
      /* storage unavailable */
    }
  }, [next]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        if (input) localStorage.setItem(DRAFT_KEY, input);
        else localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* storage unavailable */
      }
    }, 220);
    return () => window.clearTimeout(timer);
  }, [input]);

  function clearChat() {
    if (streaming) return;
    if (!window.confirm("清空本机保存的对话、建议和未发送草稿？")) return;
    setMessages([WELCOME]);
    setNext(null);
    setInput("");
    try {
      localStorage.removeItem(CHAT_KEY);
      localStorage.removeItem(NEXT_KEY);
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    notify("对话已清空", "ok");
  }

  async function loadNext() {
    setLoadingNext(true);
    try {
      const response = await api<AssistantNextResponse>("/api/assistant/next", {
        method: "POST",
        body: "{}",
      });
      setNext(response);
    } catch (error) {
      notify(error instanceof Error ? error.message : "生成建议失败", "error");
    } finally {
      setLoadingNext(false);
    }
  }

  async function send(text?: string) {
    const question = (text ?? input).trim();
    if (!question || streaming) return;
    if (!status?.configured) return;
    setInput("");
    setStreaming(true);
    const userMessage: AssistantMessage = { role: "user", content: question };
    const history = [...messages, userMessage];
    setMessages([...history, { role: "assistant", content: "" }]);

    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      if (!response.ok) {
        let payload: any = {};
        try {
          payload = await response.json();
        } catch {
          /* ignore */
        }
        throw new Error(payload.error || `请求失败（HTTP ${response.status}）`);
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error("浏览器不支持流式响应。");
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) {
          const chunk = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const line = chunk
            .split("\n")
            .find((item) => item.startsWith("data: "));
          if (line) {
            const data = JSON.parse(line.slice(6));
            if (data.error) throw new Error(data.error);
            if (data.delta) {
              answer += data.delta;
              setMessages((previous) => {
                const copy = [...previous];
                copy[copy.length - 1] = { role: "assistant", content: answer };
                return copy;
              });
            }
          }
          boundary = buffer.indexOf("\n\n");
        }
      }
      if (!answer) {
        setMessages((previous) => {
          const copy = [...previous];
          copy[copy.length - 1] = {
            role: "assistant",
            content: "这次没有生成内容，请换一种问法再试一次。",
          };
          return copy;
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "助手请求失败";
      setMessages((previous) => {
        const copy = [...previous];
        copy[copy.length - 1] = {
          role: "assistant",
          content: `请求失败：${message}`,
        };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="page assistant-page">
      <header className="page-head">
        <div>
          <span className="kicker">AI 参谋</span>
          <h1>下一步</h1>
          <p className="quiet">
            读取你的 PSN 进度与本地攻略库，给出当前最该做的事。
          </p>
        </div>
      </header>

      <div className="assistant-grid">
        <section className="paper-block assistant-next">
          <div className="block-head">
            <h2>当前建议</h2>
            {next ? (
              <span className="mark">
                {next.source === "llm" ? "AI 参谋" : "本地规则"}
              </span>
            ) : null}
          </div>

          {next ? (
            <>
              <p className="assistant-brief">{next.briefing}</p>
              <div className="assistant-actions">
                {next.actions.map((action, index) => (
                  <article
                    key={`${action.title}-${index}`}
                    className={`assistant-action ${action.level}`}
                  >
                    <span className="assistant-mark">
                      {action.level === "danger"
                        ? "险"
                        : action.level === "warn"
                          ? "急"
                          : action.level === "info"
                            ? "进"
                            : "收"}
                    </span>
                    <div>
                      <strong>{action.title}</strong>
                      <p>{action.reason}</p>
                      <div className="assistant-tags">
                        {action.where ? <span>{action.where}</span> : null}
                        {action.deadline ? <span>截止：{action.deadline}</span> : null}
                      </div>
                      {action.target ? (
                        <button
                          className="guide-jump"
                          onClick={() => onOpenGuide(action.target!)}
                          type="button"
                        >
                          查看对应攻略 <span aria-hidden="true">→</span>
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
              <button
                className="btn small ghost"
                onClick={loadNext}
                disabled={loadingNext}
                type="button"
              >
                {loadingNext ? "正在分析…" : "刷新建议"}
              </button>
              {!status?.configured ? (
                <p className="quiet tiny">
                  当前是本地规则建议；配置 DeepSeek Key 后，会额外生成 AI 总结。
                </p>
              ) : null}
            </>
          ) : (
            <button
              className="btn primary"
              onClick={loadNext}
              disabled={loadingNext}
              type="button"
            >
              {loadingNext ? "正在分析…" : "根据当前进度生成下一步"}
            </button>
          )}
        </section>

        <section className="paper-block assistant-chat">
          <div className="block-head">
            <h2>问参谋</h2>
            <div className="block-tools">
              {messages.length > 1 ? (
                <button
                  className="text-action"
                  onClick={clearChat}
                  disabled={streaming}
                  type="button"
                >
                  清空对话
                </button>
              ) : null}
              {status ? (
                <span className={status.configured ? "mark" : "mark danger"}>
                  {status.configured ? status.model : "未配置"}
                </span>
              ) : null}
            </div>
          </div>

          {!status?.configured ? (
            <div className="assistant-empty">
              <p>聊天需要 DeepSeek API Key。</p>
              <button className="btn" onClick={onOpenSettings} type="button">
                去设置配置
              </button>
              <p className="quiet tiny">
                Key 只保存在本机；聊天时只发送当前进度摘要和相关攻略片段，不发送 NPSSO、账号信息或地图截图。
              </p>
            </div>
          ) : (
            <>
              <p className="quiet tiny chat-storage-note">
                对话与未发送草稿保存在本机浏览器；可点上方“清空对话”。
              </p>
              <div className="chat-log" ref={chatRef}>
                {messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`chat-msg ${message.role}`}
                  >
                    {message.content || (streaming ? "…" : "")}
                  </div>
                ))}
              </div>
              <div className="chat-suggestions">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => send(suggestion)}
                    disabled={streaming}
                    type="button"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
              <form
                className="chat-input-bar"
                onSubmit={(event) => {
                  event.preventDefault();
                  send();
                }}
              >
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      send();
                    }
                  }}
                  placeholder="问当前进度、首领、支线或真结局…"
                  rows={2}
                  disabled={streaming}
                />
                <button className="btn primary" disabled={streaming} type="submit">
                  {streaming ? "回答中…" : "发送"}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
