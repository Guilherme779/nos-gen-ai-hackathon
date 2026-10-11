import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion";
import introSrc from "@/assets/untrace-intro-8s.mp4";

export const INTRO_FLAG = "untrace-intro-vista";
export const INTRO_SRC = introSrc;
export const REVEAL_START = 6;
export const REVEAL_END = 8;
const FEATHER = 96; // px of soft edge on the hole
const LOAD_TIMEOUT_MS = 6000; // startup never resolves
const STALL_TIMEOUT_MS = 4000; // currentTime stops advancing while playing
const HARD_TIMEOUT_MS = 20000; // absolute cap, whatever happens
const SKIP_FADE_S = 0.2;

/** Reveal progress, driven only by the video's own clock. */
export function introProgress(currentTime: number): number {
  if (!Number.isFinite(currentTime)) return 0;
  return Math.min(1, Math.max(0, (currentTime - REVEAL_START) / (REVEAL_END - REVEAL_START)));
}

/** Distance from the viewport centre to its corners. */
export function cornerRadius(width: number, height: number): number {
  return Math.hypot(width / 2, height / 2);
}

/** Radial mask for the video plane: fully opaque at p=0, a feathered centre hole that clears every corner at p=1. */
export function introMask(p: number, width: number, height: number): string {
  if (p <= 0) return "linear-gradient(#000, #000)";
  const outer = p * (cornerRadius(width, height) + FEATHER);
  const inner = Math.max(0, outer - FEATHER);
  return `radial-gradient(circle at 50% 50%, transparent ${inner.toFixed(1)}px, #000 ${outer.toFixed(1)}px)`;
}

type Phase = "idle" | "playing" | "closing" | "done";
type FinishMode = "end" | "skip" | "error";

function readEligible(enabled: boolean): boolean {
  if (!enabled || typeof window === "undefined") return false;
  try {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  } catch {
    return false;
  }
  try {
    return window.sessionStorage.getItem(INTRO_FLAG) === null;
  } catch {
    return false; // storage unavailable: skip rather than replay or block
  }
}

function markViewed(): boolean {
  try {
    window.sessionStorage.setItem(INTRO_FLAG, "1");
    return true;
  } catch {
    return false;
  }
}

export function IntroVideo({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const siteRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const finishedRef = useRef(false);
  const modeRef = useRef<FinishMode>("end");
  const cleanupRef = useRef<(() => void) | null>(null);

  const progress = useMotionValue(0);
  const viewW = useMotionValue(1280);
  const viewH = useMotionValue(800);
  const mask = useTransform([progress, viewW, viewH], ([p, w, h]) => introMask(p as number, w as number, h as number));
  const planeOpacity = useTransform(progress, (p) => 1 - p);

  // Eligibility runs after hydration so SSR and the first client render match (no overlay in HTML).
  useEffect(() => {
    if (readEligible(enabled)) setPhase("playing");
  }, [enabled]);

  const finish = useCallback((mode: FinishMode) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    modeRef.current = mode;
    const video = videoRef.current;
    if (video) {
      try { video.pause(); } catch { /* ignore */ }
    }
    cleanupRef.current?.();
    cleanupRef.current = null;
    if (mode === "end") progress.set(1);
    setPhase(mode === "skip" ? "closing" : "done");
  }, [progress]);

  // Playback, clock, watchdogs.
  useEffect(() => {
    if (phase !== "playing") return;
    const video = videoRef.current;
    if (!video) return;
    finishedRef.current = false;
    let alive = true;
    let rafId = 0;
    let vfcId = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const start = performance.now();
    let started = false;
    let lastTime = -1;
    let lastAdvance = performance.now();

    const setViewport = () => { viewW.set(window.innerWidth); viewH.set(window.innerHeight); };
    setViewport();

    const sample = () => {
      if (!alive) return;
      const t = video.currentTime;
      if (t !== lastTime) { lastTime = t; lastAdvance = performance.now(); }
      progress.set(introProgress(t));
      if (t >= REVEAL_END - 0.02 || video.ended) finish("end");
    };
    const anyVideo = video as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
      cancelVideoFrameCallback?: (id: number) => void;
    };
    const loop = () => {
      if (!alive) return;
      sample();
      if (!alive) return;
      if (typeof anyVideo.requestVideoFrameCallback === "function") vfcId = anyVideo.requestVideoFrameCallback(loop);
      else rafId = requestAnimationFrame(loop);
    };

    const onError = () => finish("error");
    const onEnded = () => finish("end");
    const onPlaying = () => { started = true; lastAdvance = performance.now(); };
    const onVisibility = () => { if (document.hidden) finish("error"); };
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const onMotion = (e: MediaQueryListEvent) => { if (e.matches) finish("error"); };

    video.addEventListener("error", onError);
    video.addEventListener("ended", onEnded);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("timeupdate", sample);
    video.addEventListener("seeked", sample);
    window.addEventListener("resize", setViewport);
    document.addEventListener("visibilitychange", onVisibility);
    mq?.addEventListener?.("change", onMotion);

    const watchdog = setInterval(() => {
      const now = performance.now();
      if (now - start > HARD_TIMEOUT_MS) return finish("error");
      if (!started && now - start > LOAD_TIMEOUT_MS) return finish("error");
      if (started && !video.paused && now - lastAdvance > STALL_TIMEOUT_MS) return finish("error");
    }, 250);

    cleanupRef.current = () => {
      alive = false;
      cancelAnimationFrame(rafId);
      if (vfcId && anyVideo.cancelVideoFrameCallback) anyVideo.cancelVideoFrameCallback(vfcId);
      clearInterval(watchdog);
      timers.forEach(clearTimeout);
      video.removeEventListener("error", onError);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("timeupdate", sample);
      video.removeEventListener("seeked", sample);
      window.removeEventListener("resize", setViewport);
      document.removeEventListener("visibilitychange", onVisibility);
      mq?.removeEventListener?.("change", onMotion);
    };

    if (!markViewed()) { finish("error"); return; }
    if (video.error) { finish("error"); return; }
    let attempt: Promise<void> | undefined;
    try {
      video.muted = true;
      attempt = video.play();
    } catch {
      finish("error");
      return;
    }
    Promise.resolve(attempt).then(
      () => { if (!alive || finishedRef.current) { try { video.pause(); } catch { /* ignore */ } return; } started = true; loop(); },
      () => finish("error"),
    );

    return () => {
      // Unmount or strict-mode re-run: stop everything without resurrecting.
      cleanupRef.current?.();
      cleanupRef.current = null;
      try { video.pause(); } catch { /* ignore */ }
    };
  }, [phase, finish, progress, viewW, viewH]);

  // Scroll lock, inert site, focus management while active (including skip fade).
  const active = phase === "playing" || phase === "closing";
  useEffect(() => {
    if (!active) return;
    const site = siteRef.current;
    const html = document.documentElement;
    const body = document.body;
    const prev = { html: html.style.overflow, body: body.style.overflow, inert: site?.hasAttribute("inert") ?? false };
    const previousFocus = document.activeElement as HTMLElement | null;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    site?.setAttribute("inert", "");
    skipRef.current?.focus({ preventScroll: true });
    return () => {
      html.style.overflow = prev.html;
      body.style.overflow = prev.body;
      if (!prev.inert) site?.removeAttribute("inert");
      if (previousFocus && previousFocus !== document.body && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
      else (document.activeElement as HTMLElement | null)?.blur?.();
    };
  }, [active]);

  return (
    <>
      <div ref={siteRef} data-intro-site="">{children}</div>
      <AnimatePresence>
        {active && (
          <motion.div
            key="untrace-intro"
            className="intro-overlay"
            data-testid="intro-overlay"
            initial={false}
            animate={phase === "closing" ? { opacity: 0 } : { opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0 } }}
            transition={{ duration: phase === "closing" ? SKIP_FADE_S : 0 }}
            onAnimationComplete={() => { if (phase === "closing") setPhase("done"); }}
            onKeyDown={(e) => { if (e.key === "Tab") { e.preventDefault(); skipRef.current?.focus({ preventScroll: true }); } }}
            style={{ position: "fixed", inset: 0, zIndex: 2147483000 }}
          >
            <style>{`.intro-skip:focus-visible{outline:3px solid var(--brand-blue,#4d5dcb);outline-offset:3px}.intro-skip:hover{background:rgba(0,0,0,.75)}`}</style>
            <motion.div
              data-testid="intro-plane"
              aria-hidden="true"
              style={{ position: "absolute", inset: 0, background: "#000", opacity: planeOpacity, maskImage: mask, WebkitMaskImage: mask }}
            >
              <video
                ref={videoRef}
                src={INTRO_SRC}
                muted
                autoPlay
                playsInline
                preload="auto"
                aria-hidden="true"
                tabIndex={-1}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </motion.div>
            <button
              ref={skipRef}
              type="button"
              className="intro-skip"
              aria-label="Saltar introdução"
              onClick={() => finish("skip")}
              style={{ position: "absolute", top: 16, right: 16, zIndex: 1, padding: "10px 18px", borderRadius: 999, border: "1px solid rgba(255,255,255,.55)", background: "rgba(0,0,0,.55)", color: "#fff", font: "600 14px/1 'Segoe UI', Arial, sans-serif", cursor: "pointer" }}
            >
              Saltar
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default IntroVideo;
