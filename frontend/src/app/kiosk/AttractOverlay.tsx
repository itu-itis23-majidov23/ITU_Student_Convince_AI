"use client";

import { memo, useEffect, useState } from "react";

const TAGLINES = [
  "Merhaba! Ben Elif — İTÜ tercih danışmanın.",
  "YKS sıralamana en uygun İTÜ bölümünü birlikte bulalım.",
  "Aklındaki soruları sesli sorabilirsin, seni dinliyorum.",
  "Bilgisayar Müh., Yapay Zekâ ve Veri Müh. ve dahası…",
];

/** Idle attract loop: rotating taglines above the CTA. Mounted only when
 *  the kiosk hasn't started a session. */
export const AttractOverlay = memo(function AttractOverlay({
  onStart,
}: {
  onStart: () => void | Promise<void>;
}) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = window.setInterval(
      () => setI((v) => (v + 1) % TAGLINES.length),
      4200
    );
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="z-20 col-start-1 row-start-3 row-end-5 flex max-h-full flex-col items-center justify-center gap-3 overflow-y-auto px-3 pb-3 sm:gap-4 sm:px-8 sm:pb-6">
      <p
        key={i}
        className="k-fade-up max-w-3xl text-center text-[clamp(1.3rem,2.4vw,2rem)] font-[550] text-[var(--k-ink)]"
      >
        {TAGLINES[i]}
      </p>
      <button
        onClick={() => void onStart()}
        className="k-attract-glow rounded-full px-8 py-3 text-xl font-[700] text-[#131313] transition-transform active:scale-95 sm:px-12 sm:py-5 sm:text-2xl"
        style={{
          background:
            "linear-gradient(135deg, var(--k-amber-soft), var(--k-amber))",
        }}
      >
        Konuşmaya Başla
      </button>
      <p className="text-center text-xs font-[450] text-[var(--k-ink-dim)] sm:text-sm">
        Mikrofon ve kamera yalnızca görüşme sırasında kullanılır.
      </p>
    </div>
  );
});
