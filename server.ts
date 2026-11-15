import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import type { Guide, Progress, ProgressKind } from "./shared/types.js";
import { syncTrophies } from "./lib/psn.js";
import { deleteSecret, loadSecret, saveSecret } from "./lib/secrets.js";
import {
  clearAssistantKey,
  generateAssistantNext,
  getAssistantKey,
  getAssistantStatus,
  saveAssistantConfig,
  streamAssistantChat,
  testAssistant,
} from "./lib/assistant.js";

const ROOT = process.env.PBZ_ROOT || process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const GUIDE_FILE = path.join(DATA_DIR, "guide.json");
const PROGRESS_FILE = path.join(DATA_DIR, "progress.json");
const NPSSO_FILE = path.join(DATA_DIR, "npsso.enc");
const DPAPI_SCRIPT = path.join(ROOT, "lib", "dpapi.ps1");
const DIST_DIR = path.join(ROOT, "dist");
const MAP_DIR = path.join(ROOT, "public", "map");
const PORT = Number(process.env.PORT || 8765);
const HOST = process.env.HOST || "0.0.0.0";

const PROGRESS_KINDS = new Set<ProgressKind>([
  "items",
  "tales",
  "bosses",
  "trueEnding",
  "hiddens",
  "trophiesManual",
]);

let guide: Guide;
try {
  guide = JSON.parse(fs.readFileSync(GUIDE_FILE, "utf8")) as Guide;
} catch (error) {
  console.error(`无法读取攻略数据 ${GUIDE_FILE}: ${String(error)}`);
  process.exit(1);
}

function defaultProgress(): Progress {
  return {
    version: 1,
    items: {},
    tales: {},
    bosses: {},
    trueEnding: {},
    hiddens: {},
    trophiesManual: {},
    psn: null,
    updatedAt: null,
  };
}

function loadProgress(): Progress {
  try {
    const parsed = JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf8")) as Partial<Progress>;
    return { ...defaultProgress(), ...parsed };
  } catch {
    return defaultProgress();
  }
}

let progress = loadProgress();

function saveProgress(): void {
  progress.updatedAt = new Date().toISOString();
  const tmp = `${PROGRESS_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(progress, null, 1), "utf8");
  fs.renameSync(tmp, PROGRESS_FILE);
}

function saveNpsso(token: string): void {
  saveSecret(DATA_DIR, DPAPI_SCRIPT, NPSSO_FILE, token);
}

function loadNpsso(): string | null {
  return loadSecret(DATA_DIR, DPAPI_SCRIPT, NPSSO_FILE);
}

function clearNpsso(): void {
  deleteSecret(NPSSO_FILE);
}

function lanUrls(): string[] {
  const urls: string[] = [];
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal) {
        urls.push(`http://${entry.address}:${PORT}`);
      }
    }
  }
  return urls;
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function sendJson(res: http.ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > 256 * 1024) {
        reject(new Error("请求体过大"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8").trim();
      if (!text) return resolve({});
      try {
        resolve(JSON.parse(text));
      } catch {
        reject(new Error("JSON 格式错误"));
      }
    });
    req.on("error", reject);
  });
}

function safeResolve(base: string, relative: string): string | null {
  const target = path.resolve(base, relative);
  const rel = path.relative(base, target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return target;
}

function serveFile(res: http.ServerResponse, filePath: string): void {
  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("未找到");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "Content-Length": stats.size,
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

function serveStatic(urlPath: string, res: http.ServerResponse): void {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    res.writeHead(400);
    res.end("请求无效");
    return;
  }

  if (decoded === "/map" || decoded.startsWith("/map/")) {
    const relative = decoded.replace(/^\/map\/?/, "");
    const filePath = safeResolve(MAP_DIR, relative);
    if (!filePath) {
      res.writeHead(403);
      res.end("禁止访问");
      return;
    }
    serveFile(res, filePath);
    return;
  }

  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const filePath = safeResolve(DIST_DIR, relative);
  if (!filePath) {
    res.writeHead(403);
    res.end("禁止访问");
    return;
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    serveFile(res, filePath);
    return;
  }
  // SPA fallback
  serveFile(res, path.join(DIST_DIR, "index.html"));
}

async function handleApi(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL
): Promise<void> {
  const route = url.pathname;

  if (req.method === "GET" && route === "/api/bootstrap") {
    sendJson(res, 200, {
      guide,
      progress,
      server: {
        port: PORT,
        lanUrls: lanUrls(),
        hasNpsso: fs.existsSync(NPSSO_FILE),
      },
    });
    return;
  }

  if (req.method === "POST" && route === "/api/progress") {
    const body = await readBody(req);
    const { kind, id, value } = body as { kind: ProgressKind; id: string; value: boolean };
    if (!PROGRESS_KINDS.has(kind)) throw new Error("未知的进度类型");
    if (typeof id !== "string" || !id || id.length > 200) throw new Error("无效的条目 ID");
    if (!progress[kind]) (progress as any)[kind] = {};
    if (value === true) (progress[kind] as Record<string, boolean>)[id] = true;
    else delete (progress[kind] as Record<string, boolean>)[id];
    saveProgress();
    sendJson(res, 200, { ok: true, updatedAt: progress.updatedAt });
    return;
  }

  if (req.method === "POST" && route === "/api/reset") {
    const body = await readBody(req);
    if (!["清空", "RESET"].includes(body.confirm)) throw new Error("需要确认");
    const psn = progress.psn;
    progress = defaultProgress();
    progress.psn = psn;
    saveProgress();
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && route === "/api/export") {
    const body = JSON.stringify({ guideVersion: guide.meta.release, progress }, null, 1);
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="phantom-blade-progress.json"',
      "Cache-Control": "no-store",
    });
    res.end(body);
    return;
  }

  if (req.method === "POST" && route === "/api/psn/npsso") {
    const body = await readBody(req);
    const token = String(body.npsso || "").trim();
    if (token.length < 20 || token.length > 300 || /\s/.test(token)) {
      throw new Error("授权码格式不对：应当是一长串不含空格的字符。");
    }
    saveNpsso(token);
    sendJson(res, 200, { ok: true, hasNpsso: true });
    return;
  }

  if (req.method === "POST" && route === "/api/psn/sync") {
    const token = loadNpsso();
    if (!token) throw new Error("还没有保存授权码。请先在设置页粘贴。");
    const result = await syncTrophies(token);
    progress.psn = { ...result, syncedAt: new Date().toISOString() } as any;
    saveProgress();
    sendJson(res, 200, { ok: true, psn: progress.psn });
    return;
  }

  if (req.method === "POST" && route === "/api/psn/clear") {
    clearNpsso();
    progress.psn = null;
    saveProgress();
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && route === "/api/assistant/status") {
    sendJson(res, 200, getAssistantStatus());
    return;
  }

  if (req.method === "POST" && route === "/api/assistant/config") {
    const body = await readBody(req);
    const status = saveAssistantConfig({
      apiKey: body.apiKey,
      model: body.model,
    });
    sendJson(res, 200, { ok: true, status });
    return;
  }

  if (req.method === "POST" && route === "/api/assistant/clear") {
    sendJson(res, 200, { ok: true, status: clearAssistantKey() });
    return;
  }

  if (req.method === "POST" && route === "/api/assistant/test") {
    const text = await testAssistant();
    sendJson(res, 200, { ok: true, text });
    return;
  }

  if (req.method === "POST" && route === "/api/assistant/next") {
    const result = await generateAssistantNext({ guide, progress });
    sendJson(res, 200, result);
    return;
  }

  if (req.method === "POST" && route === "/api/assistant/chat") {
    const body = await readBody(req);
    const raw = Array.isArray(body.messages) ? body.messages : [];
    const messages = raw
      .filter(
        (message: any) =>
          message &&
          (message.role === "user" || message.role === "assistant") &&
          typeof message.content === "string"
      )
      .slice(-10)
      .map((message: any) => ({
        role: message.role,
        content: String(message.content).slice(0, 4000),
      }));
    if (!messages.length || messages[messages.length - 1].role !== "user") {
      throw new Error("请先输入问题。");
    }
    const apiKey = getAssistantKey();
    if (!apiKey) {
      throw new Error("AI 助手还没有配置 DeepSeek API Key。请先在设置页保存。");
    }
    const config = getAssistantStatus();
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();
    const controller = new AbortController();
    res.on("close", () => controller.abort());
    try {
      const stream = await streamAssistantChat({
        guide,
        progress,
        messages: messages as any,
        apiKey,
        model: config.model,
        abortSignal: controller.signal,
      });
      for await (const delta of stream) {
        res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      }
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "助手请求失败";
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    }
    res.end();
    return;
  }

  if (req.method === "GET" && route === "/api/health") {
    sendJson(res, 200, { ok: true, uptime: process.uptime() });
    return;
  }

  sendJson(res, 404, { error: "接口不存在" });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (url.pathname.startsWith("/api/")) {
    handleApi(req, res, url).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "服务器错误";
      const clientError =
        /授权码|PSN|奖杯|无效|未知|需要确认|格式|还没|没有|找不到|过大|AI 助手|DeepSeek|API Key|助手/i.test(
          message
        );
      sendJson(res, clientError ? 400 : 500, { error: message });
    });
    return;
  }
  serveStatic(url.pathname, res);
});

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(`端口 ${PORT} 已被占用。请关闭占用该端口的程序，或设置 PORT 环境变量后重试。`);
  } else {
    console.error(error);
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log("");
  console.log("  影境手札 · 影之刃零攻略");
  console.log(`  本机：http://localhost:${PORT}`);
  for (const url of lanUrls()) console.log(`  手机：${url}`);
  if (!fs.existsSync(path.join(DIST_DIR, "index.html"))) {
    console.log("  提示：前端尚未构建，请运行 npm run build。");
  }
  console.log("");
  console.log("  按 Ctrl+C 停止。");

  if (process.platform === "win32" && !process.env.PBZ_NO_OPEN) {
    spawn("cmd", ["/c", "start", "", `http://localhost:${PORT}`], {
      windowsHide: true,
      detached: true,
      stdio: "ignore",
    }).unref();
  }
});
