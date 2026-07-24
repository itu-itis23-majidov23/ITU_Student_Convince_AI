"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, QrCode, X } from "lucide-react";
import QRCode from "qrcode";
import type {
  ProfessorSearchState,
  TranscriptLine,
} from "./useRealtimeSession";

const PROGRAM_PATTERNS = [
  { label: "Bilgisayar Mühendisliği", patterns: ["bilgisayar mühendis", "itü bilgisayar"] },
  { label: "Yapay Zekâ ve Veri Mühendisliği", patterns: ["yapay zekâ ve veri", "yapay zeka ve veri"] },
  { label: "Elektronik ve Haberleşme Mühendisliği", patterns: ["elektronik ve haberleşme", "elektronik haberleşme"] },
  { label: "Kontrol ve Otomasyon Mühendisliği", patterns: ["kontrol ve otomasyon"] },
  { label: "Endüstri Mühendisliği", patterns: ["endüstri mühendis"] },
  { label: "Makine Mühendisliği", patterns: ["makine mühendis"] },
  { label: "Elektrik Mühendisliği", patterns: ["elektrik mühendis"] },
  { label: "Uçak Mühendisliği", patterns: ["uçak mühendis"] },
  { label: "Uzay Mühendisliği", patterns: ["uzay mühendis"] },
  { label: "Matematik Mühendisliği", patterns: ["matematik mühendis"] },
];

interface SessionSummaryPanelProps {
  open: boolean;
  history: TranscriptLine[];
  userText: string;
  assistantText: string;
  professorSearch: ProfessorSearchState | null;
  showUserTranscript: boolean;
  onClose: () => void;
}

export function SessionSummaryPanel({
  open,
  history,
  userText,
  assistantText,
  professorSearch,
  showUserTranscript,
  onClose,
}: SessionSummaryPanelProps) {
  const [qrFailed, setQrFailed] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [open, onClose]);

  const summary = useMemo(() => {
    const lines = [
      ...history,
      ...(userText.trim() ? [{ role: "user" as const, text: userText.trim() }] : []),
      ...(assistantText.trim()
        ? [{ role: "assistant" as const, text: assistantText.trim() }]
        : []),
    ];
    const allAssistantNotes = lines
      .filter((line) => line.role === "assistant")
      .map((line) => line.text.trim())
      .filter(Boolean);
    const assistantNotes = allAssistantNotes.slice(-3);
    const userNotes = showUserTranscript
      ? lines
          .filter((line) => line.role === "user")
          .slice(-2)
          .map((line) => line.text.trim())
          .filter(Boolean)
      : [];
    const searchable = allAssistantNotes.join(" ").toLocaleLowerCase("tr-TR");
    const programs = PROGRAM_PATTERNS
      .filter((program) => program.patterns.some((pattern) => searchable.includes(pattern)))
      .map((program) => program.label);
    const sources = [
      { label: "İTÜ resmi web sitesi", url: "https://www.itu.edu.tr/" },
      { label: "YÖK Atlas", url: "https://yokatlas.yok.gov.tr/" },
      ...(professorSearch?.sourceUrl
        ? [{
            label: professorSearch.sourceName || "İTÜ Akademi",
            url: professorSearch.sourceUrl,
          }]
        : []),
    ];
    const qrText = [
      "İTÜ Yapay Zekâ Tercih Danışmanı - Görüşme Özeti",
      programs.length > 0 ? `Konuşmada geçen bölümler: ${programs.join(", ")}` : "",
      ...userNotes.map((note) => `Öğrenci notu: ${note}`),
      ...assistantNotes.map((note) => `Danışman notu: ${note}`),
      `Kaynaklar: ${sources.map((source) => source.url).join(" | ")}`,
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, 1400);

    return { assistantNotes, programs, sources, qrText };
  }, [assistantText, history, professorSearch, showUserTranscript, userText]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setQrFailed(false);
    setQrDataUrl("");
    void QRCode.toDataURL(summary.qrText, {
      width: 320,
      margin: 1,
      errorCorrectionLevel: "M",
    }).then((dataUrl) => {
      if (!cancelled) setQrDataUrl(dataUrl);
    }).catch(() => {
      if (!cancelled) setQrFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [open, summary.qrText]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-summary-title"
    >
      <div className="relative grid max-h-[90dvh] w-full max-w-4xl gap-6 overflow-y-auto rounded-3xl border border-white/15 bg-[var(--k-bg-1)] p-6 shadow-2xl md:grid-cols-[1fr_18rem]">
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="Özeti kapat"
          className="absolute right-4 top-4 rounded-full border border-white/10 bg-white/5 p-2 text-[var(--k-ink-dim)] hover:text-[var(--k-ink)]"
        >
          <X size={20} />
        </button>

        <div className="pr-8">
          <p className="text-xs font-[750] uppercase tracking-[0.16em] text-[var(--k-amber-soft)]">
            Görüşme çıktısı
          </p>
          <h2 id="session-summary-title" className="mt-1 text-2xl font-[800] text-[var(--k-ink)]">
            Özet ve kaynaklar
          </h2>

          <section className="mt-5">
            <h3 className="text-sm font-[750] text-[var(--k-ring-listening)]">
              Konuşmada geçen bölümler
            </h3>
            {summary.programs.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-2">
                {summary.programs.map((program) => (
                  <li key={program} className="rounded-full bg-white/[0.07] px-3 py-1.5 text-sm text-[var(--k-ink)]">
                    {program}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-[var(--k-ink-dim)]">
                Henüz konuşmada belirgin bir bölüm önerisi oluşmadı.
              </p>
            )}
          </section>

          <section className="mt-5">
            <h3 className="text-sm font-[750] text-[var(--k-ring-listening)]">
              Son danışman notları
            </h3>
            {summary.assistantNotes.length > 0 ? (
              <ol className="mt-2 space-y-2 text-sm leading-relaxed text-[var(--k-ink-dim)]">
                {summary.assistantNotes.map((note, index) => (
                  <li key={`${index}-${note.slice(0, 24)}`} className="rounded-xl bg-white/5 p-3">
                    {note}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-[var(--k-ink-dim)]">
                Özet oluşturmak için önce kısa bir görüşme yapın.
              </p>
            )}
          </section>

          <section className="mt-5">
            <h3 className="text-sm font-[750] text-[var(--k-ring-listening)]">Resmî kaynaklar</h3>
            <div className="mt-2 flex flex-wrap gap-3">
              {summary.sources.map((source) => (
                <a
                  key={source.url}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-sm text-[var(--k-amber-soft)] underline-offset-4 hover:underline"
                >
                  {source.label}
                  <ExternalLink size={14} aria-hidden />
                </a>
              ))}
            </div>
          </section>

          <p className="mt-6 text-xs leading-relaxed text-[var(--k-ink-dim)]">
            Bu otomatik özet yalnızca görüşme notudur. Tercih yapmadan önce güncel bilgileri resmî kaynaklardan doğrulayın.
          </p>
        </div>

        <aside className="flex flex-col items-center justify-center rounded-2xl bg-white/5 p-5 text-center">
          <QrCode size={26} className="text-[var(--k-amber-soft)]" aria-hidden />
          <h3 className="mt-2 font-[750] text-[var(--k-ink)]">Telefonuna aktar</h3>
          <p className="mt-1 text-xs text-[var(--k-ink-dim)]">
            Bölümleri, notları ve kaynak bağlantılarını almak için QR kodu tara.
          </p>
          {!qrFailed && qrDataUrl ? (
            <img
              className="mt-4 rounded-xl border-4 border-white bg-white"
              src={qrDataUrl}
              width={240}
              height={240}
              alt="Görüşme özetinin QR kodu"
            />
          ) : qrFailed ? (
            <p role="alert" className="mt-4 rounded-xl bg-red-500/10 p-4 text-sm text-[var(--k-danger)]">
              QR kodu oluşturulamadı. Kaynak bağlantılarını doğrudan açabilirsiniz.
            </p>
          ) : (
            <p className="mt-4 text-sm text-[var(--k-ink-dim)]">QR kodu hazırlanıyor…</p>
          )}
        </aside>
      </div>
    </div>
  );
}
