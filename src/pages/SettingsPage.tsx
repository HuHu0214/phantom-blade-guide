import { useState } from "react";
import type { Guide, Progress } from "../../shared/types";
import { formatDate } from "../helpers";

export function SettingsPage({
  guide,
  progress,
  hasNpsso,
  syncing,
  lanUrls,
  onSaveNpsso,
  onSync,
  onClearPsn,
  onReset,
}: {
  guide: Guide;
  progress: Progress;
  hasNpsso: boolean;
  syncing: boolean;
  lanUrls: string[];
  onSaveNpsso: (token: string) => Promise<void>;
  onSync: () => void;
  onClearPsn: () => void;
  onReset: () => void;
}) {
  const [token, setToken] = useState("");
  const [resetText, setResetText] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState("");
  const psn = progress.psn;

  async function copyAddress(url: string, label: string) {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = url;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setCopied(label);
    window.setTimeout(() => setCopied(""), 2000);
  }

  async function save() {
    if (!token.trim()) return;
    setSaving(true);
    try {
      await onSaveNpsso(token.trim());
      setToken("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page settings-page">
      <header className="page-head">
        <div>
          <span className="kicker">设置</span>
          <h1>账号与数据</h1>
        </div>
      </header>

      <div className="settings-grid">
        <section className="paper-block">
          <h2>PSN 奖杯同步</h2>
          <div className="instructions">
            <p>读取的是 PSN 奖杯进度，不是 PS5 存档。PS5 存档加密，电脑无法直接读取。</p>
            <ol>
              <li>
                在浏览器登录 PlayStation 官网（港服账号）。
                <button
                  className="text-action"
                  onClick={() => copyAddress("https://www.playstation.com", "官网")}
                  type="button"
                >
                  {copied === "官网" ? "已复制" : "复制官网地址"}
                </button>
              </li>
              <li>
                登录后打开授权码页面。
                <button
                  className="text-action"
                  onClick={() =>
                    copyAddress("https://ca.account.sony.com/api/v1/ssocookie", "授权页")
                  }
                  type="button"
                >
                  {copied === "授权页" ? "已复制" : "复制授权页地址"}
                </button>
              </li>
              <li>复制页面里的授权码，粘贴到下面，点击“保存并同步”。</li>
              <li>如果提示找不到游戏，先在 PS5 打开《影之刃零》的奖杯列表同步一次。</li>
            </ol>
          </div>

          <div className="field">
            <input
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="粘贴授权码"
              autoComplete="off"
              spellCheck={false}
            />
            <button className="btn primary" onClick={save} disabled={saving || syncing} type="button">
              {saving ? "保存中…" : "保存并同步"}
            </button>
          </div>

          <div className="status-row">
            <span className={hasNpsso ? "dot on" : "dot"} />
            {hasNpsso ? "授权码已保存，仅本机可用" : "尚未保存授权码"}
          </div>

          <div className="button-row">
            <button className="btn" onClick={onSync} disabled={syncing} type="button">
              {syncing ? "同步中…" : "立即同步"}
            </button>
            <button className="btn danger" onClick={onClearPsn} type="button">
              清除授权
            </button>
          </div>

          {psn ? (
            <dl className="stats-list">
              <div>
                <dt>游戏</dt>
                <dd>影之刃零</dd>
              </div>
              <div>
                <dt>进度</dt>
                <dd>
                  {psn.earnedCount} / {psn.totalCount} 奖杯
                </dd>
              </div>
              <div>
                <dt>同步时间</dt>
                <dd>{formatDate(psn.syncedAt)}</dd>
              </div>
            </dl>
          ) : null}

          <p className="quiet tiny">
            授权码使用系统账户级加密保存在本机；同步时直接连接索尼 PSN，不经过第三方服务器。
          </p>
        </section>

        <section className="paper-block">
          <h2>手机访问</h2>
          <p className="quiet">同一无线网络下打开下面地址。首次可能需要在防火墙中允许程序访问专用网络。</p>
          <div className="lan-list">
            {lanUrls.length ? (
              lanUrls.map((url) => <code key={url}>{url}</code>)
            ) : (
              <span className="quiet">未检测到局域网地址</span>
            )}
          </div>

          <h2 className="section-gap">数据</h2>
          <div className="button-row">
            <button
              className="btn"
              onClick={() => {
                window.location.href = "/api/export";
              }}
              type="button"
            >
              导出进度
            </button>
          </div>
          <div className="field">
            <input
              value={resetText}
              onChange={(event) => setResetText(event.target.value)}
              placeholder="输入「清空」确认"
            />
            <button
              className="btn danger"
              disabled={resetText !== "清空"}
              onClick={() => {
                if (resetText === "清空") {
                  onReset();
                  setResetText("");
                }
              }}
              type="button"
            >
              清空
            </button>
          </div>
          <p className="quiet tiny">只清空手动勾选，不会删除 PSN 同步结果。</p>

          <p className="quiet tiny section-gap">
            攻略版本：{guide.meta.release || "—"}。所有攻略内容与地图素材均在本机，不跳转外链。
          </p>
        </section>
      </div>
    </div>
  );
}
