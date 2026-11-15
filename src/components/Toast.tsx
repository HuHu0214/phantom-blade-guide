export interface ToastState {
  message: string;
  tone: "ok" | "error";
}

export function Toast({ toast }: { toast: ToastState | null }) {
  if (!toast) return null;
  return <div className={`toast ${toast.tone}`}>{toast.message}</div>;
}
