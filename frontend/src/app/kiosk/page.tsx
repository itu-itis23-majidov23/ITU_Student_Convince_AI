"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";

import {
  useRealtimeSession,
  type ProfessorSearchState,
  type TranscriptLine,
} from "./useRealtimeSession";
import { useWebcamStream } from "./useWebcamStream";
import { useCvSignals } from "./useCvSignals";
import {
  deriveFaceState,
  useThinkingHint,
  type FaceState,
} from "./faceState";
import {
  createAnalyserAmplitude,
  createFakeAmplitude,
  type FakeAmplitudeKind,
} from "./amplitude";
import { type AvatarMode } from "./FaceStage";

import { KioskShell } from "./KioskShell";
import { KioskHeader } from "./KioskHeader";
import { FaceStage } from "./FaceStage";
import { SubtitlePanel } from "./SubtitlePanel";
import { AttractOverlay } from "./AttractOverlay";
import { SessionControls } from "./SessionControls";
import { WebcamPreview } from "./WebcamPreview";
import { DemoPanel } from "./DemoPanel";
import { ProfessorSearchPanel } from "./ProfessorSearchPanel";
import { SessionSummaryPanel } from "./SessionSummaryPanel";

function newSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `kiosk-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

const DEPARTURE_RELOAD_DELAY_MS = 5000;

interface SummarySnapshot {
  history: TranscriptLine[];
  userText: string;
  assistantText: string;
  professorSearch: ProfessorSearchState | null;
}

/* ── Production kiosk ─────────────────────────────────────────────────────── */

function ProductionKiosk({ avatarMode }: { avatarMode: AvatarMode }) {
  const session = useRealtimeSession();
  const webcam = useWebcamStream();
  const cv = useCvSignals();
  const [started, setStarted] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summarySnapshot, setSummarySnapshot] = useState<SummarySnapshot | null>(null);
  const sessionIdRef = useRef("");
  const startInFlightRef = useRef(false);
  const hasSeenFaceRef = useRef(false);
  const reloadStartedRef = useRef(false);
  const departureTimerRef = useRef<number | null>(null);
  const sessionStateRef = useRef(cv.sessionState);
  const disconnectSession = session.disconnect;
  const stopWebcam = webcam.stop;
  const stopCv = cv.stop;
  const { presenceState, sessionState } = cv;
  const sessionStatus = session.status;
  const setPushToTalkActive = session.setPushToTalkActive;

  const thinking = useThinkingHint(session.userText, session.assistantSpeaking);

  const captureSummary = useCallback((): SummarySnapshot => ({
    history: [...session.history],
    userText: session.userText,
    assistantText: session.assistantText,
    professorSearch: session.professorSearch,
  }), [
    session.assistantText,
    session.history,
    session.professorSearch,
    session.userText,
  ]);

  const showSummary = useCallback(() => {
    setSummarySnapshot(captureSummary());
    setSummaryOpen(true);
  }, [captureSummary]);

  const closeSummary = useCallback(() => setSummaryOpen(false), []);

  const start = useCallback(async () => {
    if (startInFlightRef.current) return;
    startInFlightRef.current = true;
    try {
      const id = newSessionId();
      sessionIdRef.current = id;
      setSummaryOpen(false);
      setSummarySnapshot(null);
      setStarted(true);
      webcam.start(id);
      cv.start(id);
      await session.connect(id);
    } catch {
      return;
    } finally {
      startInFlightRef.current = false;
    }
  }, [session, webcam, cv]);

  const stop = useCallback(() => {
    const snapshot = captureSummary();
    const hasSummary =
      snapshot.history.length > 0 ||
      Boolean(snapshot.userText.trim()) ||
      Boolean(snapshot.assistantText.trim());
    session.disconnect();
    webcam.stop();
    cv.stop();
    setStarted(false);
    setSummarySnapshot(hasSummary ? snapshot : null);
    setSummaryOpen(hasSummary);
  }, [captureSummary, session, webcam, cv]);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      return Boolean(
        element?.isContentEditable ||
        element?.tagName === "INPUT" ||
        element?.tagName === "TEXTAREA" ||
        element?.tagName === "SELECT"
      );
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target) || summaryOpen) return;
      if (event.code === "KeyD" && !event.repeat) {
        event.preventDefault();
        setDebugMode((enabled) => !enabled);
        return;
      }
      if (
        event.code === "KeyV" &&
        !event.repeat &&
        started &&
        sessionStatus === "active"
      ) {
        event.preventDefault();
        setPushToTalkActive(true);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "KeyV") return;
      event.preventDefault();
      setPushToTalkActive(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      setPushToTalkActive(false);
    };
  }, [setPushToTalkActive, sessionStatus, started, summaryOpen]);

  useEffect(() => {
    sessionStateRef.current = sessionState;
  }, [sessionState]);

  useEffect(() => {
    if (!started) {
      hasSeenFaceRef.current = false;
      reloadStartedRef.current = false;
      return;
    }

    if (presenceState === "present") {
      hasSeenFaceRef.current = true;
      return;
    }

    if (
      !hasSeenFaceRef.current ||
      presenceState !== "absent" ||
      reloadStartedRef.current
    ) {
      return;
    }

    departureTimerRef.current = window.setTimeout(() => {
      departureTimerRef.current = null;
      if (
        reloadStartedRef.current ||
        sessionStateRef.current !== "IDLE"
      ) {
        return;
      }

      reloadStartedRef.current = true;
      disconnectSession();
      stopWebcam();
      stopCv();
      window.location.reload();
    }, DEPARTURE_RELOAD_DELAY_MS);

    return () => {
      if (departureTimerRef.current !== null) {
        window.clearTimeout(departureTimerRef.current);
        departureTimerRef.current = null;
      }
    };
  }, [
    started,
    presenceState,
    disconnectSession,
    stopWebcam,
    stopCv,
  ]);

  const amplitude = useMemo(
    () => createAnalyserAmplitude(session.outputAnalyserRef),
    [session.outputAnalyserRef]
  );

  const faceState = deriveFaceState({
    started,
    status: session.status,
    assistantSpeaking: session.assistantSpeaking,
    isFocused: cv.isFocused,
    thinking,
  });

  return (
    <KioskShell>
      <KioskHeader
        status={session.status}
        isFocused={cv.isFocused}
        started={started}
        speechDetected={session.speechDetected}
        debugMode={debugMode}
      />
      <FaceStage
        faceState={faceState}
        amplitude={amplitude}
        seekAttentionNonce={session.seekAttentionNonce}
        avatarMode={avatarMode}
        emotion={session.emotion}
        facePosition={avatarMode === "live2d" ? cv.facePosition : null}
      />
      <SubtitlePanel
        assistantText={session.assistantText}
        userText={session.userText}
        history={session.history}
        showUserTranscript={debugMode}
      />
      <ProfessorSearchPanel search={session.professorSearch} />
      {!started && (
        <AttractOverlay onStart={start} />
      )}
      <SessionControls
        started={started}
        status={session.status}
        errorMessage={session.errorMessage}
        microphoneLevel={session.microphoneLevel}
        speechDetected={session.speechDetected}
        pushToTalkActive={session.pushToTalkActive}
        debugMode={debugMode}
        busy={session.status === "connecting"}
        onStop={stop}
        onRetry={start}
        onPushToTalk={session.setPushToTalkActive}
        onShowSummary={showSummary}
      />
      <WebcamPreview videoRef={webcam.videoRef} active={started} />
      <SessionSummaryPanel
        open={summaryOpen}
        history={summarySnapshot?.history ?? []}
        userText={summarySnapshot?.userText ?? ""}
        assistantText={summarySnapshot?.assistantText ?? ""}
        professorSearch={summarySnapshot?.professorSearch ?? null}
        showUserTranscript={debugMode}
        onClose={closeSummary}
      />
    </KioskShell>
  );
}

/* ── Demo kiosk (/kiosk?demo=1 — no backend) ──────────────────────────────── */

const DEMO_LINES: TranscriptLine[] = [
  { role: "user", text: "Sıralamam 1200 civarı, Bilgisayar tutar mı?" },
  {
    role: "assistant",
    text: "Geçen yılki taban sıralama 1435'ti — senin için gayet ulaşılabilir görünüyor!",
  },
];

const DEMO_STREAM =
  "Harika bir soru! İTÜ Bilgisayar Mühendisliği'nin 2025 taban sıralaması yaklaşık 1435'ti; senin sıralamanla oldukça şanslısın. Peki yazılım mı yapay zekâ mı — hangisi seni daha çok heyecanlandırıyor?";

function DemoKiosk({
  initialState,
  avatarMode: initialAvatarMode,
}: {
  initialState: FaceState;
  avatarMode: AvatarMode;
}) {
  const [faceState, setFaceState] = useState<FaceState>(initialState);
  const [ampKind, setAmpKind] = useState<FakeAmplitudeKind>("speech");
  const [focused, setFocused] = useState(true);
  const [fakeSubtitles, setFakeSubtitles] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [streamedText, setStreamedText] = useState("");
  const [emotion, setEmotion] = useState<string>("neutral");
  const [avatarMode, setAvatarMode] = useState<AvatarMode>(initialAvatarMode);

  const amplitude = useMemo(() => createFakeAmplitude(ampKind), [ampKind]);

  // Fake subtitle stream to test layout stability while "speaking".
  useEffect(() => {
    if (!fakeSubtitles) {
      setStreamedText("");
      return;
    }
    let i = 0;
    const id = window.setInterval(() => {
      i = (i + 3) % (DEMO_STREAM.length + 30);
      setStreamedText(DEMO_STREAM.slice(0, i));
    }, 90);
    return () => window.clearInterval(id);
  }, [fakeSubtitles]);

  const shownState: FaceState =
    !focused && faceState !== "attract" ? "concerned" : faceState;

  return (
    <KioskShell>
      <KioskHeader
        status={faceState === "attract" ? "idle" : "active"}
        isFocused={focused}
        started={faceState !== "attract"}
        speechDetected={ampKind === "speech"}
        debugMode={false}
      />
      <FaceStage
        faceState={shownState}
        amplitude={amplitude}
        seekAttentionNonce={nonce}
        avatarMode={avatarMode}
        emotion={emotion}
      />
      <SubtitlePanel
        assistantText={fakeSubtitles ? streamedText : ""}
        userText=""
        history={fakeSubtitles || faceState === "attract" ? [] : DEMO_LINES}
        showUserTranscript
      />
      {faceState === "attract" && (
        <AttractOverlay onStart={() => setFaceState("listening")} />
      )}
      <SessionControls
        started={faceState !== "attract"}
        status="active"
        errorMessage={null}
        microphoneLevel={0.42}
        speechDetected={ampKind === "speech"}
        pushToTalkActive={false}
        debugMode={false}
        busy={false}
        onStop={() => setFaceState("attract")}
        onRetry={() => {}}
        onPushToTalk={() => {}}
        onShowSummary={() => {}}
      />
      <DemoPanel
        faceState={faceState}
        setFaceState={setFaceState}
        ampKind={ampKind}
        setAmpKind={setAmpKind}
        focused={focused}
        setFocused={setFocused}
        fakeSubtitles={fakeSubtitles}
        setFakeSubtitles={setFakeSubtitles}
        triggerSeek={() => setNonce((n) => n + 1)}
        emotion={emotion}
        setEmotion={setEmotion}
        avatarMode={avatarMode}
        setAvatarMode={setAvatarMode}
      />
    </KioskShell>
  );
}

/* ── Entry (Suspense required for useSearchParams in static builds) ───────── */

const FACE_STATES: FaceState[] = [
  "attract",
  "connecting",
  "listening",
  "speaking",
  "thinking",
  "concerned",
];

function resolveAvatarMode(params: URLSearchParams): AvatarMode {
  // Live2D is the DEFAULT avatar. The SVG "Elif" face is available as an
  // explicit fallback via ?avatar=svg (e.g. for machines without WebGL).
  const fromEnv =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_AVATAR === "svg"
      ? "svg"
      : "live2d";
  const q = params.get("avatar");
  if (q === "svg") return "svg";
  if (q === "live2d") return "live2d";
  return fromEnv as AvatarMode;
}

function KioskRouter() {
  const params = useSearchParams();
  const demo = params.get("demo") === "1";
  const stateParam = params.get("state") as FaceState | null;
  const initialState =
    stateParam && FACE_STATES.includes(stateParam) ? stateParam : "attract";
  const avatarMode = resolveAvatarMode(params);
  return demo ? (
    <DemoKiosk initialState={initialState} avatarMode={avatarMode} />
  ) : (
    <ProductionKiosk avatarMode={avatarMode} />
  );
}

export default function KioskPage() {
  return (
    <Suspense fallback={<KioskShell>{null}</KioskShell>}>
      <KioskRouter />
    </Suspense>
  );
}
