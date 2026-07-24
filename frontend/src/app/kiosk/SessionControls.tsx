"use client";

import { memo, useEffect } from "react";
import type { SessionStatus } from "./useRealtimeSession";

interface SessionControlsProps {
  started: boolean;
  status: SessionStatus;
  errorMessage: string | null;
  microphoneLevel: number;
  speechDetected: boolean;
  pushToTalkActive: boolean;
  debugMode: boolean;
  busy: boolean;
  onStop: () => void;
  onRetry: () => void;
  onPushToTalk: (active: boolean) => void;
  onShowSummary: () => void;
}

export const SessionControls = memo(function SessionControls({
  started,
  status,
  errorMessage,
  microphoneLevel,
  speechDetected,
  pushToTalkActive,
  debugMode,
  busy,
  onStop,
  onRetry,
  onPushToTalk,
  onShowSummary,
}: SessionControlsProps) {
  useEffect(() => {
    const release = () => onPushToTalk(false);
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") release();
    };
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [onPushToTalk]);

  if (!started) return <footer className="col-start-1 row-start-4 h-[8dvh]" />;

  const microphoneLabel =
    status === "connecting"
      ? "Bağlanıyor"
      : status === "error"
        ? "Mikrofon durdu"
        : speechDetected
          ? "Ses algılandı"
          : "Dinliyorum";

  return (
    <footer className="z-10 col-start-1 row-start-4 flex flex-col items-center justify-center gap-2 pb-4">
      {status === "error" && (
        <div className="flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-[500]"
          style={{ background: "rgba(243,108,92,0.12)", color: "var(--k-danger)" }}
        >
          <span>Bağlantı sorunu{errorMessage ? `: ${errorMessage}` : ""}</span>
          <button
            onClick={onRetry}
            disabled={busy}
            className="rounded-md px-3 py-1 font-[650] disabled:opacity-50"
            style={{ background: "var(--k-danger)", color: "#fff" }}
          >
            Tekrar dene
          </button>
        </div>
      )}
      <div
        className={`flex w-full max-w-2xl items-center gap-2 rounded-xl border px-3 py-2 transition-colors sm:gap-3 sm:px-4 ${
          speechDetected
            ? "border-emerald-300/50 bg-emerald-400/10"
            : "border-white/10 bg-white/[0.03]"
        }`}
      >
        <span
          aria-live="polite"
          className={`min-w-24 text-right text-xs font-[800] sm:min-w-28 ${
            speechDetected ? "text-emerald-200" : "text-[var(--k-ink-dim)]"
          }`}
        >
          {microphoneLabel}
        </span>
        <div
          role="progressbar"
          aria-label="Mikrofon ses seviyesi"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(microphoneLevel * 100)}
          className="h-3 flex-1 overflow-hidden rounded-full bg-white/10"
        >
          <div
            className="h-full rounded-full transition-[width,background-color] duration-75"
            style={{
              width: `${microphoneLevel * 100}%`,
              background: speechDetected ? "var(--k-ok)" : "var(--k-ring-listening)",
            }}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        <button
          type="button"
          disabled={status !== "active"}
          aria-pressed={pushToTalkActive}
          aria-label="Sistem sesinizi algılamıyorsa basılı tutup konuşun"
          onPointerDown={(event) => {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            onPushToTalk(true);
          }}
          onPointerUp={() => onPushToTalk(false)}
          onPointerCancel={() => onPushToTalk(false)}
          onLostPointerCapture={() => onPushToTalk(false)}
          onKeyDown={(event) => {
            if (!event.repeat && (event.key === " " || event.key === "Enter")) {
              event.preventDefault();
              onPushToTalk(true);
            }
          }}
          onKeyUp={(event) => {
            if (event.key === " " || event.key === "Enter") {
              event.preventDefault();
              onPushToTalk(false);
            }
          }}
          onBlur={() => onPushToTalk(false)}
          className="touch-none rounded-full border px-4 py-2 text-sm font-[700] text-[var(--k-ink)] disabled:opacity-40 sm:px-6 sm:py-3 sm:text-base"
          style={{
            borderColor: pushToTalkActive ? "var(--k-ok)" : "rgba(79,216,200,0.5)",
            background: pushToTalkActive ? "rgba(63,214,163,0.2)" : "rgba(79,216,200,0.08)",
          }}
        >
          {pushToTalkActive ? "Doğrudan dinliyorum" : "V · Duymuyorsa Basılı Tut"}
        </button>
        <button
          type="button"
          onClick={onShowSummary}
          className="rounded-full border px-4 py-2 text-sm font-[600] text-[var(--k-ink-dim)] transition-colors hover:text-[var(--k-ink)] sm:px-6 sm:py-3 sm:text-base"
          style={{ borderColor: "rgba(242,169,59,0.4)" }}
        >
          Özet ve QR
        </button>
        <button
          onClick={onStop}
          className="rounded-full border px-4 py-2 text-sm font-[600] text-[var(--k-ink-dim)] transition-colors hover:text-[var(--k-ink)] sm:px-6 sm:py-3 sm:text-base"
          style={{ borderColor: "rgba(148,163,189,0.35)" }}
        >
          Görüşmeyi Bitir
        </button>
      </div>
      <p className="text-[0.68rem] font-[600] tracking-wide text-[var(--k-ink-dim)]">
        <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[var(--k-ink)]">V</kbd>
        {" basılı tut: doğrudan konuş · "}
        <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[var(--k-ink)]">D</kbd>
        {debugMode ? " debug transkript açık" : " debug transkript"}
      </p>
    </footer>
  );
});
