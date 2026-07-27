"use client";

/**
 * BeeFace — the İTÜ bee mascot, the university's symbol, as the kiosk avatar.
 *
 * Hand-authored layered SVG (viewBox 420×560, midline x=210, eye line y=228,
 * mouth seam y=294, neck pivot (210,330)) in the kiosk palette: amber body,
 * navy stripes/eyes — the same --k-amber / --k-navy pair the UI already uses.
 *
 * Rendering rules follow AdvisorFace.tsx (docs/UI_DESIGN.md):
 *  - React renders this SVG exactly ONCE; all animation happens in useBeeRig
 *    via direct attribute writes on [data-rig] nodes.
 *  - Zero SVG filters; all softness via gradient-to-transparent fills.
 *  - Pivot-baked transforms only (no CSS transform-origin).
 *  - Right eye/antenna/wing are mirrored via matrix(-1,0,0,1,420,0) wrappers;
 *    the rig negates gaze X for the mirrored eye and writes the same rotation
 *    to both wings/antennae (the mirror flips it into symmetry).
 *
 * Bee-specific channels (see useBeeRig.ts): antennae play the brows' role,
 * wing-flap speed tracks state + speech energy, and the whole bee hovers on a
 * slow bob above a soft ground shadow.
 */

import { memo, useRef } from "react";
import { useBeeRig } from "./useBeeRig";
import type { FaceState } from "./faceState";
import type { AmplitudeSource } from "./amplitude";
import type { FacePosition } from "./useCvSignals";

export interface BeeFaceProps {
  state: FaceState;
  amplitude: AmplitudeSource;
  seekAttentionNonce: number;
  /** go_emotions label — reuses the Live2D delta table (live2dExpressions). */
  emotion?: string;
  /** CV-tracked visitor face — drives gaze + head turn. */
  facePosition?: FacePosition | null;
  className?: string;
}

/** One eye assembly (left coords; the right eye lives in a mirror wrapper). */
function Eye({ side }: { side: "l" | "r" }) {
  const clipId = `b-eye-clip-${side}`;
  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <ellipse cx={164} cy={228} rx={26} ry={31} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {/* sclera + soft upper shadow */}
        <ellipse cx={164} cy={228} rx={26} ry={31} fill="#fbf7f0" />
        <path
          d="M 138 228 C 138 208 150 197 164 197 C 178 197 190 208 190 228 C 184 214 175 207 164 207 C 153 207 144 214 138 228 Z"
          fill="rgba(90,60,20,0.14)"
        />
        {/* pupil group — gaze target */}
        <g data-rig={`gaze-${side}`}>
          <circle cx={164} cy={230} r={11.5} fill="url(#b-pupil)" stroke="#0b1830" strokeWidth={1.5} />
          <circle cx={160} cy={225} r={3.9} fill="rgba(255,255,255,0.95)" />
          <circle cx={168.5} cy={234.5} r={1.6} fill="rgba(255,255,255,0.45)" />
        </g>
        {/* closing lid slab (fur-toned), parked above; blink = translateY 0→68 */}
        <rect data-rig={`lid-${side}`} x={132} y={114} width={64} height={80} fill="url(#b-lid)" />
      </g>
      {/* eye outline */}
      <ellipse cx={164} cy={228} rx={26} ry={31} fill="none" stroke="#10203c" strokeWidth={2.5} />
      {/* lower lid — squints up with smile */}
      <path
        data-rig={`lowerlid-${side}`}
        d="M 144 250 C 152 257 176 257 184 248"
        stroke="rgba(120,70,20,0.45)"
        strokeWidth={2.5}
        fill="none"
        strokeLinecap="round"
      />
    </g>
  );
}

/** One antenna (left coords), pivoting at its base on the head crown. */
function Antenna({ side }: { side: "l" | "r" }) {
  return (
    <g data-rig={`antenna-${side}`}>
      <path
        d="M 162 117 C 152 88 143 64 127 47"
        stroke="#2c1f15"
        strokeWidth={5}
        fill="none"
        strokeLinecap="round"
      />
      <circle cx={126} cy={45} r={9.5} fill="url(#b-bobble)" stroke="#10203c" strokeWidth={1.5} />
      <circle cx={123} cy={42} r={3} fill="rgba(255,235,190,0.7)" />
    </g>
  );
}

/** One wing pair (left coords), pivoting near the shoulder. */
function Wing({ side }: { side: "l" | "r" }) {
  return (
    <g data-rig={`wing-${side}`}>
      {/* fore wing */}
      <g transform="rotate(-24 120 268)">
        <ellipse cx={120} cy={268} rx={34} ry={82} fill="url(#b-wing)" stroke="rgba(255,255,255,0.55)" strokeWidth={2} />
        <ellipse cx={120} cy={268} rx={18} ry={56} fill="rgba(255,255,255,0.12)" />
        <path d="M 120 200 L 120 336" stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} />
      </g>
      {/* hind wing */}
      <g transform="rotate(-40 134 318)" opacity={0.75}>
        <ellipse cx={134} cy={318} rx={21} ry={52} fill="url(#b-wing)" stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} />
      </g>
    </g>
  );
}

const MIRROR = "matrix(-1 0 0 1 420 0)";

function BeeFaceInner({
  state,
  amplitude,
  seekAttentionNonce,
  emotion = "neutral",
  facePosition = null,
  className,
}: BeeFaceProps) {
  const rootRef = useRef<SVGSVGElement | null>(null);
  useBeeRig(rootRef, { state, amplitude, seekAttentionNonce, emotion, facePosition });

  return (
    <svg
      ref={rootRef}
      viewBox="0 0 420 560"
      className={className}
      role="img"
      aria-label="Petek — İTÜ arı maskotu, yapay zekâ tercih danışmanı"
    >
      <defs>
        <radialGradient id="b-fur" cx="0.42" cy="0.36" r="0.85">
          <stop offset="0%" stopColor="#ffe29e" />
          <stop offset="55%" stopColor="#f6b34a" />
          <stop offset="100%" stopColor="#dd8f28" />
        </radialGradient>
        <linearGradient id="b-lid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f8c66e" />
          <stop offset="100%" stopColor="#eda93f" />
        </linearGradient>
        <linearGradient id="b-stripe" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1b3156" />
          <stop offset="100%" stopColor="#0e1c36" />
        </linearGradient>
        <radialGradient id="b-pupil" cx="0.4" cy="0.35" r="0.8">
          <stop offset="0%" stopColor="#2a55a0" />
          <stop offset="60%" stopColor="#16294a" />
          <stop offset="100%" stopColor="#0b1830" />
        </radialGradient>
        <radialGradient id="b-bobble" cx="0.4" cy="0.35" r="0.85">
          <stop offset="0%" stopColor="#3c66b4" />
          <stop offset="100%" stopColor="#10203c" />
        </radialGradient>
        <linearGradient id="b-wing" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="rgba(235,243,255,0.42)" />
          <stop offset="100%" stopColor="rgba(200,220,250,0.16)" />
        </linearGradient>
        <linearGradient id="b-mouth" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a2412" />
          <stop offset="100%" stopColor="#5a3a1c" />
        </linearGradient>
        <radialGradient id="b-blush" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="rgba(232,126,108,0.42)" />
          <stop offset="100%" stopColor="rgba(232,126,108,0)" />
        </radialGradient>
        <radialGradient id="b-shadow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="rgba(6,10,20,0.4)" />
          <stop offset="100%" stopColor="rgba(6,10,20,0)" />
        </radialGradient>
        <linearGradient id="b-fur-shade" x1="0" y1="0.4" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(120,70,10,0)" />
          <stop offset="100%" stopColor="rgba(120,70,10,0.18)" />
        </linearGradient>
      </defs>

      {/* ground shadow — static position; the rig scales/dims it as the bee rises */}
      <ellipse data-rig="shadow" cx={210} cy={549} rx={74} ry={9} fill="url(#b-shadow)" />

      {/* ── the whole bee (hover-bob channel) ── */}
      <g data-rig="bee">
        {/* wings BEHIND body + head (right one mirrored) */}
        <Wing side="l" />
        <g transform={MIRROR}>
          <Wing side="r" />
        </g>

        {/* ── body: amber capsule + navy stripes + stinger ── */}
        <g>
          <path
            d="M 199 528 Q 210 556 221 528 Q 210 537 199 528 Z"
            fill="#0e1c36"
          />
          <defs>
            <clipPath id="b-body-clip">
              <path d="M 210 318 C 150 318 122 358 122 428 C 122 492 156 534 210 534 C 264 534 298 492 298 428 C 298 358 270 318 210 318 Z" />
            </clipPath>
          </defs>
          <path
            d="M 210 318 C 150 318 122 358 122 428 C 122 492 156 534 210 534 C 264 534 298 492 298 428 C 298 358 270 318 210 318 Z"
            fill="url(#b-fur)"
            stroke="rgba(60,35,10,0.3)"
            strokeWidth={2}
          />
          <g clipPath="url(#b-body-clip)">
            <path d="M 118 352 Q 210 368 302 352 L 302 384 Q 210 400 118 384 Z" fill="url(#b-stripe)" />
            <path d="M 118 404 Q 210 420 302 404 L 302 436 Q 210 452 118 436 Z" fill="url(#b-stripe)" />
            <path d="M 118 456 Q 210 472 302 456 L 302 488 Q 210 504 118 488 Z" fill="url(#b-stripe)" />
            {/* lower-body shading for depth */}
            <path d="M 122 318 H 298 V 534 H 122 Z" fill="url(#b-fur-shade)" />
          </g>
        </g>

        {/* bow tie — the "professional assistant" touch, at the neck seam */}
        <g>
          <path d="M 206 342 L 175 327 Q 168 342 175 357 Z" fill="#1d4a94" stroke="#0e1c36" strokeWidth={2} />
          <path d="M 214 342 L 245 327 Q 252 342 245 357 Z" fill="#1d4a94" stroke="#0e1c36" strokeWidth={2} />
          <rect x={202} y={334} width={16} height={16} rx={4} fill="#123064" stroke="#0e1c36" strokeWidth={2} />
          <circle cx={210} cy={342} r={2.6} fill="var(--k-amber, #f2a93b)" />
        </g>

        {/* ── head (pivot 210,330) ── */}
        <g data-rig="head">
          {/* antennae behind the head disc so bases tuck under the crown */}
          <Antenna side="l" />
          <g transform={MIRROR}>
            <Antenna side="r" />
          </g>

          <circle cx={210} cy={218} r={112} fill="url(#b-fur)" stroke="rgba(60,35,10,0.3)" strokeWidth={2} />
          {/* crown fuzz — a few short strokes, reads as soft fur */}
          <path
            d="M 168 118 Q 165 108 158 104 M 190 110 Q 189 99 184 94 M 210 107 Q 210 96 210 90 M 230 110 Q 231 99 236 94 M 252 118 Q 255 108 262 104"
            stroke="rgba(60,35,10,0.4)"
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
          />
          {/* forehead sheen + chin shade */}
          <ellipse cx={196} cy={158} rx={52} ry={18} fill="rgba(255,244,215,0.28)" />
          <path d="M 98 218 A 112 112 0 0 0 322 218 L 322 240 A 112 112 0 0 1 98 240 Z" fill="url(#b-fur-shade)" />

          {/* blush (opacity channel) */}
          <g data-rig="blush" opacity={0.35}>
            <ellipse cx={143} cy={270} rx={19} ry={10} fill="url(#b-blush)" />
            <ellipse cx={277} cy={270} rx={19} ry={10} fill="url(#b-blush)" />
          </g>

          {/* ── mouth group (pivot 210,296) ── */}
          <g data-rig="mouth">
            {/* cavity — authored fully open, rests at scaleY≈0.08 */}
            <g data-rig="mouth-open">
              <path d="M 181 294 Q 210 300 239 294 Q 235 322 210 326 Q 185 322 181 294 Z" fill="url(#b-mouth)" />
              <ellipse cx={210} cy={318} rx={12} ry={5} fill="#e87e6c" />
            </g>
            <path
              data-rig="mouth-seam"
              d="M 178 294 Q 210 300 242 294"
              stroke="#5a3210"
              strokeWidth={4}
              fill="none"
              strokeLinecap="round"
            />
          </g>

          {/* eyes (right side mirrored; rig negates gaze X for -r) */}
          <Eye side="l" />
          <g transform={MIRROR}>
            <Eye side="r" />
          </g>
        </g>
      </g>
    </svg>
  );
}

export const BeeFace = memo(BeeFaceInner);
