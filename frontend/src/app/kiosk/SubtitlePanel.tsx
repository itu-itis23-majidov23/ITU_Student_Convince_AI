"use client";

import type { TranscriptLine } from "./useRealtimeSession";

interface SubtitlePanelProps {
  assistantText: string;
  userText: string;
  history: TranscriptLine[];
  showUserTranscript: boolean;
}

/**
 * Streaming subtitles. Deliberately NOT memoized — this is the one component
 * meant to re-render on every transcript chunk; everything around it is memo'd.
 * The grid row reserves min-height so text growth never shifts the face.
 */
export function SubtitlePanel({
  assistantText,
  userText,
  history,
  showUserTranscript,
}: SubtitlePanelProps) {
  const visibleHistory = showUserTranscript
    ? history
    : history.filter((line) => line.role === "assistant");
  const lastExchange = visibleHistory.slice(-2);
  const visibleUserText = showUserTranscript ? userText : "";
  const showGhost = !assistantText && !visibleUserText && lastExchange.length > 0;

  return (
    <section className="z-10 col-start-1 row-start-3 flex flex-col items-center justify-start gap-2 px-10 pb-2 text-center">
      {assistantText && (
        <p className="k-fade-up max-w-4xl text-[clamp(1.4rem,2.6vw,2.2rem)] font-[550] leading-snug text-[var(--k-ink)]">
          {assistantText}
        </p>
      )}
      {visibleUserText && (
        <div className="max-w-3xl rounded-xl border border-amber-300/20 bg-amber-300/5 px-4 py-2">
          <span className="block text-[0.65rem] font-[800] uppercase tracking-[0.16em] text-[var(--k-amber-soft)]">
            Debug · gelen ses transkripti
          </span>
          <p className="mt-1 text-[clamp(1rem,1.8vw,1.35rem)] font-[450] text-[var(--k-ink-dim)]">
            {visibleUserText}
          </p>
        </div>
      )}
      {showGhost &&
        lastExchange.map((line, i) => (
          <p
            key={i}
            className={
              line.role === "assistant"
                ? "max-w-4xl text-[clamp(1.2rem,2.2vw,1.8rem)] font-[500] leading-snug text-[var(--k-ink)] opacity-45"
                : "max-w-3xl text-[clamp(0.95rem,1.6vw,1.2rem)] font-[450] text-[var(--k-ink-dim)] opacity-45"
            }
          >
            {line.text}
          </p>
        ))}
    </section>
  );
}
