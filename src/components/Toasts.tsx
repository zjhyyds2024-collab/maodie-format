import { X, CheckCircle, AlertCircle, Info } from "lucide-react";
import clsx from "clsx";
import { useAppStore } from "../store";

export default function Toasts() {
  const toasts = useAppStore((s) => s.toasts);
  const removeToast = useAppStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={clsx(
            "flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm transition-all",
            "min-w-[280px] max-w-sm",
            toast.type === "success" &&
              "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200",
            toast.type === "error" &&
              "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
            toast.type === "info" &&
              "border-[rgb(var(--border))] bg-[rgb(var(--card))] text-[rgb(var(--fg))]",
          )}
        >
          {toast.type === "success" && <CheckCircle size={18} className="mt-0.5 shrink-0" />}
          {toast.type === "error" && <AlertCircle size={18} className="mt-0.5 shrink-0" />}
          {toast.type === "info" && <Info size={18} className="mt-0.5 shrink-0" />}
          <p className="flex-1 text-sm">{toast.message}</p>
          <button
            onClick={() => removeToast(toast.id)}
            className="shrink-0 opacity-60 hover:opacity-100"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
