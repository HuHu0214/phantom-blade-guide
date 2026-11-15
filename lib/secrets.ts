import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function runDpapi(
  mode: "encrypt" | "decrypt",
  dpapiScript: string,
  inputPath: string,
  outputPath: string
): void {
  const result = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      dpapiScript,
      mode,
      inputPath,
      outputPath,
    ],
    { windowsHide: true, encoding: "utf8" }
  );
  if (result.status !== 0) {
    throw new Error(
      result.stderr || (mode === "encrypt" ? "系统加密失败" : "系统解密失败")
    );
  }
}

export function saveSecret(
  dataDir: string,
  dpapiScript: string,
  filePath: string,
  value: string
): void {
  const plain = path.join(
    dataDir,
    `.secret-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.plain`
  );
  try {
    fs.writeFileSync(plain, value, "utf8");
    runDpapi("encrypt", dpapiScript, plain, filePath);
  } finally {
    try {
      fs.unlinkSync(plain);
    } catch {
      /* ignore */
    }
  }
}

export function loadSecret(
  dataDir: string,
  dpapiScript: string,
  filePath: string
): string | null {
  if (!fs.existsSync(filePath)) return null;
  const plain = path.join(
    dataDir,
    `.secret-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.plain`
  );
  try {
    runDpapi("decrypt", dpapiScript, plain, filePath);
    return fs.readFileSync(plain, "utf8").trim();
  } finally {
    try {
      fs.unlinkSync(plain);
    } catch {
      /* ignore */
    }
  }
}

export function deleteSecret(filePath: string): void {
  try {
    fs.unlinkSync(filePath);
  } catch {
    /* ignore */
  }
}
