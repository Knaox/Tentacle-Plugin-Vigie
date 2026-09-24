import { useTranslation } from "react-i18next";
import { useEffect, useRef } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastData {
  id: string;
  type: ToastType;
  message: string;
  posterUrl?: string;
}

interface ToastProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

/* Tokens status host — thémés (les *-400 en dur manquaient de contraste en clair). */
const TYPE_COLORS: Record<ToastType, string> = {
  success: "border-tentacle-status-success text-tentacle-status-success-fg",
  error: "border-tentacle-status-error text-tentacle-status-error-fg",
  info: "border-tentacle-status-info text-tentacle-status-info-fg",
  warning: "border-tentacle-status-warning text-tentacle-status-warning-fg",
};

const TYPE_ICONS: Record<ToastType, string> = {
  success: "M9 12.75 11.25 15 15 9.75",
  error: "M6 18 18 6M6 6l12 12",
  info: "M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z",
  warning: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008z",
};

export function Toast({ toast, onDismiss }: ToastProps) {
  const { t } = useTranslation("seer");
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    timerRef.current = setTimeout(() => onDismiss(toast.id), 5000);
    return () => clearTimeout(timerRef.current);
  }, [toast.id, onDismiss]);

  return (
    <div
      className={`relative flex items-center gap-3 overflow-hidden rounded-xl border bg-tentacle-surface-toolbar px-4 py-3 shadow-lg transition-all ${TYPE_COLORS[toast.type]}`}
      style={{
        backdropFilter: "blur(20px)",
        animation: "fadeSlideUp 300ms ease forwards",
      }}
    >
      {toast.posterUrl && (
        <img
          src={toast.posterUrl}
          alt=""
          className="h-10 w-7 flex-shrink-0 rounded object-cover"
        />
      )}
      <svg
        className="h-5 w-5 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d={TYPE_ICONS[toast.type]}
        />
      </svg>
      <span className="flex-1 text-sm text-tentacle-text-secondary">{toast.message}</span>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label={t("seer:close")}
        // 36 px de cible (la marge négative garde le dessin où il était).
        className="-my-1.5 -mr-2 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-tentacle-text-tertiary transition-colors hover:bg-tentacle-fill-soft hover:text-tentacle-text-secondary"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
      <div
        className="absolute bottom-0 left-0 right-0 h-0.5 origin-left"
        style={{
          background: "rgba(139,92,246,0.5)",
          animation: "toastTimer 5s linear forwards",
        }}
      />
    </div>
  );
}
