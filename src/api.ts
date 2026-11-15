export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  let payload: any = {};
  try {
    payload = await response.json();
  } catch {
    /* ignore */
  }
  if (!response.ok) {
    throw new Error(payload.error || `请求失败（HTTP ${response.status}）`);
  }
  return payload as T;
}
