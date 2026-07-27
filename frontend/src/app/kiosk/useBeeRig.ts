"use client";

/**
 * useBeeRig — the single-rAF animation engine behind BeeFace (İTÜ bee mascot).
 *
 * Same rules as useFaceRig (docs/UI_DESIGN.md §4): ONE rAF loop computes every
 * channel per frame and writes SVG transform/opacity/d attributes directly on
 * [data-rig] nodes; React never re-renders the SVG. Pivot-baked transforms,
 * frame-rate-corrected EMA smoothing (k = 1 − exp(−dt/τ)).
 *
 * Shared behaviors (kept identical so the renderers feel like one character):
 *  - Lip-sync: asymmetric-EMA amplitude (fast attack ~40ms, soft release
 *    ~110ms), gated to `speaking` so barge-in closes the mouth in a few frames.
 *  - Blink keyframes: 70ms down / 40ms hold / 130ms up, never mid-loud-vowel.
 *  - seekAttention: 2.6s lean-in overlay triggered by nonce.
 *  - Emotion: reuses the SAME go_emotions delta table as Live2D
 *    (live2dExpressions.ts) — mouthForm→smile, brow→antennae, cheek→blush,
 *    eyeOpen→lids, gaze offsets.
 *  - facePosition (CV) drives gaze + head turn, like useLive2DRig.
 *
 * Bee-specific channels:
 *  - Antennae play the brows' role: perk up when curious, droop when concerned.
 *  - Wing flap runs on an accumulated phase whose frequency tracks state and
 *    speech energy — the bee audibly "buzzes harder" while talking.
 *  - The whole bee hovers on a slow bob; the ground shadow shrinks/dims as it
 *    rises so the hover reads as altitude, not the page scrolling.
 */

import { useEffect, useRef, type RefObject } from "react";
import type { FaceState } from "./faceState";
import type { AmplitudeSource } from "./amplitude";
import type { FacePosition } from "./useCvSignals";
import { emotionToDeltas } from "./live2dExpressions";

export interface BeeRigProps {
  state: FaceState;
  amplitude: AmplitudeSource;
  seekAttentionNonce: number;
  emotion: string;
  facePosition: FacePosition | null;
}

const SEEK_MS = 2600;

function pivot(
  px: number,
  py: number,
  o: { dx?: number; dy?: number; rot?: number; sx?: number; sy?: number }
): string {
  const { dx = 0, dy = 0, rot = 0, sx = 1, sy = 1 } = o;
  return `translate(${px + dx} ${py + dy}) rotate(${rot}) scale(${sx} ${sy}) translate(${-px} ${-py})`;
}

export function useBeeRig(
  rootRef: RefObject<SVGSVGElement | null>,
  props: BeeRigProps
): void {
  const stateRef = useRef<FaceState>(props.state);
  const ampRef = useRef<AmplitudeSource>(props.amplitude);
  const emotionRef = useRef(props.emotion);
  const facePositionRef = useRef(props.facePosition);
  const seekUntilRef = useRef(0);
  const lastNonceRef = useRef(props.seekAttentionNonce);

  useEffect(() => {
    stateRef.current = props.state;
  }, [props.state]);
  useEffect(() => {
    ampRef.current = props.amplitude;
  }, [props.amplitude]);
  useEffect(() => {
    emotionRef.current = props.emotion;
  }, [props.emotion]);
  useEffect(() => {
    facePositionRef.current = props.facePosition;
  }, [props.facePosition]);
  useEffect(() => {
    if (props.seekAttentionNonce !== lastNonceRef.current) {
      lastNonceRef.current = props.seekAttentionNonce;
      seekUntilRef.current = performance.now() + SEEK_MS;
    }
  }, [props.seekAttentionNonce]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const nodes = new Map<string, Element>();
    root.querySelectorAll("[data-rig]").forEach((el) => {
      const name = el.getAttribute("data-rig");
      if (name) nodes.set(name, el);
    });
    const setT = (name: string, value: string) =>
      nodes.get(name)?.setAttribute("transform", value);
    const setA = (name: string, attr: string, value: string) =>
      nodes.get(name)?.setAttribute(attr, value);

    // ── mutable channel state (no allocations in the loop) ──
    const cur = {
      headRot: 0,
      headY: 0,
      headScale: 1,
      antRaise: 0,
      antDroop: 0,
      gazeX: 0,
      gazeY: 0,
      smile: 0.35,
      open: 0,
      energy: 0,
      blush: 0.35,
      lidOpen: 1,
      bobAmp: 6,
      flapHz: 3.2,
      flapAmp: 9,
    };
    let flapPhase = 0;

    let blinkStart = -1;
    let nextBlink = performance.now() + 1800;
    let lookX = 0;
    let lookY = 0;
    let lookUntil = 0;
    let nextLook = performance.now() + 4000;
    let nodStart = -1;
    let nextNod = performance.now() + 5000;

    let raf = 0;
    let last = performance.now();
    let running = true;

    const clamp = (v: number, lo: number, hi: number) =>
      Math.max(lo, Math.min(hi, v));

    const frame = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      const st = stateRef.current;
      const k = (tau: number) => 1 - Math.exp(-dt / tau);

      // ── lip-sync amplitude (asymmetric EMA, gated to speaking) ──
      const rawAmp = st === "speaking" ? ampRef.current.read() : 0;
      cur.open += (rawAmp - cur.open) * k(rawAmp > cur.open ? 0.04 : 0.11);
      cur.energy += (cur.open - cur.energy) * k(0.6);

      // ── per-state targets ──
      let tHeadRot = 0;
      let tHeadY = 0;
      let tScale = 1;
      let tAntRaise = 0;
      let tAntDroop = 0;
      let tGazeX = 0;
      let tGazeY = 0;
      let tSmile = 0.35;
      let tBlush = 0.35;
      let tLidOpen = 1;
      let tBobAmp = 6;
      let tFlapHz = 3.2;

      switch (st) {
        case "attract":
          tSmile = 0.5;
          tBobAmp = 7;
          tFlapHz = 3.4;
          tHeadRot = 1.2 * Math.sin(0.31 * t) + 0.5 * Math.sin(0.83 * t);
          if (now > nextLook) {
            lookX = Math.random() * 10 - 5;
            lookY = Math.random() * 4 - 2;
            lookUntil = now + 1600;
            nextLook = now + 6000 + Math.random() * 4000;
          }
          if (now < lookUntil) {
            tGazeX = lookX;
            tGazeY = lookY;
          }
          break;
        case "connecting":
          tSmile = 0.2;
          tAntRaise = 0.2;
          tGazeY = 3;
          tFlapHz = 4.5;
          tBobAmp = 5;
          tHeadRot = 0.6 * Math.sin(1.7 * t);
          break;
        case "listening":
          tHeadRot = 2.5;
          tSmile = 0.35;
          tGazeY = 1.5; // camera sits below most kiosk screens
          tFlapHz = 2.8;
          tBobAmp = 4;
          if (now > nextNod && nodStart < 0) {
            nodStart = now;
            nextNod = now + 6000 + Math.random() * 3000;
          }
          break;
        case "speaking":
          tSmile = 0.3;
          tAntRaise = 0.15;
          tGazeX = 0.9 * Math.sin(2.1 * t) + 0.5 * Math.sin(3.7 * t);
          tHeadY = 1.5 * cur.open;
          tHeadRot = 0.7 * Math.sin(2 * Math.PI * 1.9 * t) * cur.energy;
          tFlapHz = 6.5 + 4 * cur.energy;
          tBobAmp = 4 + 3 * cur.energy;
          break;
        case "thinking":
          tSmile = 0.1;
          tAntRaise = 0.3;
          tGazeX = 5;
          tGazeY = -4;
          tHeadRot = 4;
          tFlapHz = 3.2;
          tBobAmp = 5;
          break;
        case "concerned":
          tAntDroop = 0.8;
          tSmile = -0.3;
          tBlush = 0.1;
          tLidOpen = 0.85;
          tHeadY = 4;
          tFlapHz = 2.0;
          tBobAmp = 2.5;
          break;
      }

      // ── emotion deltas (same table as Live2D) ──
      const e = emotionToDeltas(emotionRef.current);
      tSmile += 0.55 * e.mouthForm;
      tAntRaise += Math.max(0, e.brow);
      tAntDroop += Math.max(0, -e.brow);
      tLidOpen = clamp(tLidOpen + 0.6 * e.eyeOpen, 0.55, 1.25);
      tGazeX += 6 * e.gazeX;
      tGazeY += -5 * e.gazeY; // Live2D EyeBallY is +up; SVG gaze Y is +down
      tBlush = clamp(tBlush + 0.6 * e.cheek, 0, 1);

      // ── CV face tracking (all states; falls back to targets above) ──
      const trackedFace = facePositionRef.current;
      if (trackedFace) {
        const deadZone = (value: number, radius: number) =>
          Math.abs(value) <= radius
            ? 0
            : (Math.sign(value) * (Math.abs(value) - radius)) / (1 - radius);
        // getUserMedia frames are unmirrored while the visitor-facing preview
        // is mirrored, so invert X to follow the visitor's physical direction.
        const dx = clamp(deadZone(-(trackedFace.x - 0.5) / 0.5, 0.08), -1, 1);
        const dy = clamp(deadZone((trackedFace.y - 0.5) / 0.5, 0.08), -1, 1);
        tGazeX = dx * 7;
        tGazeY = dy * 5;
        tHeadRot += dx * 6;
      }

      // ── nod gesture (listening) ──
      if (nodStart >= 0) {
        const p = (now - nodStart) / 550;
        if (p >= 1) nodStart = -1;
        else tHeadY += 5 * Math.sin(Math.PI * p);
      }

      // ── seekAttention overlay (layered on any state) ──
      let seekEnv = 0;
      if (now < seekUntilRef.current) {
        const p = 1 - (seekUntilRef.current - now) / SEEK_MS;
        seekEnv = Math.sin(Math.PI * clamp(p, 0, 1));
        tScale = 1 + 0.06 * seekEnv;
        tHeadY -= 8 * seekEnv;
        tAntRaise = Math.max(tAntRaise, seekEnv);
        tSmile = Math.max(tSmile, 0.6 * seekEnv);
        tFlapHz += 4 * seekEnv;
        tBobAmp += 4 * seekEnv;
        if (p < 0.05 && blinkStart < 0) blinkStart = now; // attention blink
      }

      // ── smoothing toward targets ──
      cur.headRot += (tHeadRot - cur.headRot) * k(0.3);
      cur.headY += (tHeadY - cur.headY) * k(0.2);
      cur.headScale += (tScale - cur.headScale) * k(0.2);
      cur.antRaise += (tAntRaise - cur.antRaise) * k(0.15);
      cur.antDroop += (tAntDroop - cur.antDroop) * k(0.25);
      cur.gazeX += (tGazeX - cur.gazeX) * k(0.12);
      cur.gazeY += (tGazeY - cur.gazeY) * k(0.12);
      cur.smile += (tSmile - cur.smile) * k(0.25);
      cur.blush += (tBlush - cur.blush) * k(0.5);
      cur.lidOpen += (tLidOpen - cur.lidOpen) * k(0.25);
      cur.bobAmp += (tBobAmp - cur.bobAmp) * k(0.6);
      cur.flapHz += (tFlapHz - cur.flapHz) * k(0.4);

      // ── wing flap: accumulated phase so frequency changes never snap ──
      flapPhase += 2 * Math.PI * cur.flapHz * dt;
      if (flapPhase > 1e4) flapPhase -= 1e4; // keep the float small
      const tFlapAmp = 9 + 10 * cur.energy + 6 * seekEnv;
      cur.flapAmp += (tFlapAmp - cur.flapAmp) * k(0.3);
      const wingRot = -3 + cur.flapAmp * Math.sin(flapPhase);

      // ── blink keyframes ──
      if (blinkStart < 0 && now >= nextBlink) {
        if (st === "speaking" && cur.open > 0.5) {
          nextBlink = now + 300; // don't blink mid-loud-vowel
        } else {
          blinkStart = now;
          nextBlink =
            now + (st === "attract" ? 3400 : 2800) + Math.random() * 3200;
        }
      }
      let blink = 0;
      if (blinkStart >= 0) {
        const bt = now - blinkStart;
        if (bt < 70) blink = bt / 70;
        else if (bt < 110) blink = 1;
        else if (bt < 240) blink = 1 - (bt - 110) / 130;
        else {
          blink = 0;
          blinkStart = -1;
        }
      }

      // ── derived values ──
      const smilePos = Math.max(0, cur.smile);
      const bobY = cur.bobAmp * Math.sin(2 * Math.PI * 0.33 * t);
      const lidY = 68 * Math.min(1, blink + Math.max(0, 1 - cur.lidOpen) * 0.5);
      const mouthSy = 0.08 + 0.92 * cur.open;
      const mouthSx =
        (1 - 0.14 * cur.open * cur.open) * (1 + 0.05 * smilePos);
      const seamY = 294 + 16 * cur.smile + 4 * cur.open;
      const seamOpacity = 1 - Math.min(1, cur.open * 1.4) * 0.85;
      // Positive rotation stands the (up-outward-resting) antennae toward
      // vertical = alert; negative flops them outward/down = dejected droop.
      const antRot =
        14 * cur.antRaise - 26 * cur.antDroop + 2.5 * Math.sin(0.9 * t);
      const gazeX = clamp(cur.gazeX, -8, 8);
      const gazeY = clamp(cur.gazeY, -7, 7);
      // Hover altitude: bee up (bobY < 0) → shadow smaller and fainter.
      const shadowS = clamp(1 + bobY / 90, 0.8, 1.15);
      const shadowOp = clamp(0.95 + bobY / 40, 0.4, 1);

      // ── attribute writes (~17) ──
      setT("bee", `translate(0 ${bobY})`);
      setT("shadow", pivot(210, 549, { sx: shadowS, sy: shadowS }));
      setA("shadow", "opacity", shadowOp.toFixed(3));
      setT(
        "head",
        pivot(210, 330, {
          dy: cur.headY,
          rot: cur.headRot,
          sx: cur.headScale,
          sy: cur.headScale,
        })
      );
      setT("antenna-l", pivot(162, 117, { rot: antRot }));
      setT("antenna-r", pivot(162, 117, { rot: antRot })); // mirror flips it
      setT("gaze-l", `translate(${gazeX} ${gazeY})`);
      setT("gaze-r", `translate(${-gazeX} ${gazeY})`); // mirrored wrapper
      setT("lid-l", `translate(0 ${lidY})`);
      setT("lid-r", `translate(0 ${lidY})`);
      setT("lowerlid-l", `translate(0 ${-3 * smilePos})`);
      setT("lowerlid-r", `translate(0 ${-3 * smilePos})`);
      setT("mouth", pivot(210, 296, { sx: mouthSx, dy: -3 * smilePos }));
      setT("mouth-open", pivot(210, 295, { sy: mouthSy }));
      setA("mouth-seam", "d", `M 178 294 Q 210 ${seamY.toFixed(1)} 242 294`);
      setA("mouth-seam", "opacity", seamOpacity.toFixed(3));
      setA("blush", "opacity", cur.blush.toFixed(3));
      setT("wing-l", pivot(158, 336, { rot: wingRot }));
      setT("wing-r", pivot(158, 336, { rot: wingRot })); // mirror flips it

      raf = requestAnimationFrame(frame);
    };

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    raf = requestAnimationFrame(frame);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // The rig binds once; live values flow through refs.
  }, [rootRef]);
}
