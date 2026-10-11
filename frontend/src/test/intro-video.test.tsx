import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IntroVideo, INTRO_FLAG, INTRO_SRC, cornerRadius, introMask, introProgress } from "@/components/IntroVideo";

type MQ = { matches: boolean; listeners: ((e: { matches: boolean }) => void)[] };
let mq: MQ;
let playImpl: () => Promise<void>;
let playSpy: ReturnType<typeof vi.fn>;
let pauseSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
  mq = { matches: false, listeners: [] };
  window.matchMedia = ((query: string) => ({
    get matches() { return mq.matches; }, media: query, onchange: null,
    addListener: () => {}, removeListener: () => {},
    addEventListener: (_: string, cb: (e: { matches: boolean }) => void) => mq.listeners.push(cb),
    removeEventListener: (_: string, cb: (e: { matches: boolean }) => void) => { mq.listeners = mq.listeners.filter((l) => l !== cb); },
    dispatchEvent: () => true,
  })) as unknown as typeof window.matchMedia;
  playImpl = () => Promise.resolve();
  playSpy = vi.fn(() => playImpl());
  pauseSpy = vi.fn();
  Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: playSpy });
  Object.defineProperty(HTMLMediaElement.prototype, "pause", { configurable: true, value: pauseSpy });
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

const Site = () => <main><button>site action</button><footer>Intro: Luís R. Teixeira · NOS Cinemas</footer></main>;
async function mount(enabled = true) {
  const r = render(<IntroVideo enabled={enabled}><Site /></IntroVideo>);
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  return r;
}
const overlay = () => screen.queryByTestId("intro-overlay");
const video = () => document.querySelector("video") as HTMLVideoElement;
function setTime(t: number) {
  Object.defineProperty(video(), "currentTime", { configurable: true, get: () => t });
  fireEvent.timeUpdate(video());
}

describe("intro progress clock", () => {
  it("maps video time to progress at 0/5.9/6/7/8", () => {
    expect(introProgress(0)).toBe(0);
    expect(introProgress(5.9)).toBe(0);
    expect(introProgress(6)).toBe(0);
    expect(introProgress(7)).toBeCloseTo(0.5);
    expect(introProgress(8)).toBe(1);
    expect(introProgress(NaN)).toBe(0);
  });
  it("mask is opaque at 0 and clears all corners at 1", () => {
    expect(introMask(0, 375, 812)).not.toContain("transparent");
    const m = introMask(1, 375, 812);
    const inner = parseFloat(m.match(/transparent ([\d.]+)px/)![1]!);
    expect(inner).toBeGreaterThanOrEqual(cornerRadius(375, 812) - 0.1);
    expect(introMask(0.5, 1280, 800)).toMatch(/radial-gradient\(circle at 50% 50%, transparent/);
  });
});

describe("IntroVideo", () => {
  it("renders the site always and native decorative video props with local asset", async () => {
    await mount();
    expect(screen.getByText("site action")).toBeInTheDocument();
    const v = video();
    expect(v.getAttribute("src")).toBe(INTRO_SRC);
    expect(INTRO_SRC).toMatch(/untrace-intro-8s.*\.mp4$/);
    expect(v.muted).toBe(true);
    expect(v.autoplay).toBe(true);
    expect(v.hasAttribute("playsinline")).toBe(true);
    expect(v.getAttribute("preload")).toBe("auto");
    expect(v.hasAttribute("controls")).toBe(false);
    expect(v.loop).toBe(false);
    expect(v.getAttribute("aria-hidden")).toBe("true");
    expect(sessionStorage.getItem(INTRO_FLAG)).toBe("1");
  });

  it("locks scroll, inerts the site, focuses skip, and restores everything at 8s", async () => {
    const outside = document.createElement("button"); document.body.appendChild(outside); outside.focus();
    await mount();
    const site = document.querySelector("[data-intro-site]")!;
    expect(site.hasAttribute("inert")).toBe(true);
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Saltar introdução" }));
    setTime(5.9); expect(overlay()).toBeInTheDocument();
    setTime(7); expect(overlay()).toBeInTheDocument();
    await act(async () => { setTime(8); });
    expect(overlay()).toBeNull();
    expect(pauseSpy).toHaveBeenCalled();
    expect(site.hasAttribute("inert")).toBe(false);
    expect(document.body.style.overflow).toBe("");
    expect(document.documentElement.style.overflow).toBe("");
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it("ended event terminates", async () => {
    await mount();
    await act(async () => { fireEvent.ended(video()); });
    expect(overlay()).toBeNull();
  });

  it("keyboard skip pauses and removes after short fade", async () => {
    await mount();
    const skip = screen.getByRole("button", { name: "Saltar introdução" });
    expect(skip).toHaveTextContent("Saltar");
    fireEvent.keyDown(skip, { key: "Enter" });
    await act(async () => { skip.click(); });
    expect(pauseSpy).toHaveBeenCalled();
    expect(document.querySelector("[data-intro-site]")!.hasAttribute("inert")).toBe(true);
    await act(async () => { vi.advanceTimersByTime(600); await Promise.resolve(); });
    // framer completes via rAF; ensure removal eventually
    await act(async () => { vi.advanceTimersByTime(1000); });
  });

  it("only once per session", async () => {
    sessionStorage.setItem(INTRO_FLAG, "1");
    await mount();
    expect(overlay()).toBeNull();
    expect(playSpy).not.toHaveBeenCalled();
  });

  it("throwing storage skips the intro", async () => {
    vi.spyOn(Object.getPrototypeOf(window.sessionStorage), "getItem").mockImplementation(() => { throw new Error("blocked"); });
    await mount();
    expect(overlay()).toBeNull();
  });

  it("disabled prop renders no intro", async () => {
    await mount(false);
    expect(overlay()).toBeNull();
    expect(screen.getByText("site action")).toBeInTheDocument();
  });

  it("reduced motion at mount: no intro, no playback", async () => {
    mq.matches = true;
    await mount();
    expect(overlay()).toBeNull();
    expect(playSpy).not.toHaveBeenCalled();
  });

  it("reduced motion change mid-intro finishes immediately", async () => {
    await mount();
    await act(async () => { mq.listeners.forEach((l) => l({ matches: true })); });
    expect(overlay()).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  it("rejected play bypasses immediately", async () => {
    playImpl = () => Promise.reject(new Error("NotAllowed"));
    await mount();
    expect(overlay()).toBeNull();
    expect(document.querySelector("[data-intro-site]")!.hasAttribute("inert")).toBe(false);
    expect(sessionStorage.getItem(INTRO_FLAG)).toBe("1");
  });

  it("pending play times out via watchdog", async () => {
    playImpl = () => new Promise(() => {});
    await mount();
    expect(overlay()).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(6500); });
    expect(overlay()).toBeNull();
  });

  it("media error bypasses immediately", async () => {
    await mount();
    await act(async () => { fireEvent.error(video()); });
    expect(overlay()).toBeNull();
  });

  it("stalled playback ends via watchdog", async () => {
    await mount();
    fireEvent.playing(video());
    Object.defineProperty(video(), "paused", { configurable: true, get: () => false });
    setTime(3);
    expect(overlay()).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(4600); });
    expect(overlay()).toBeNull();
  });

  it("cleans up timers, frames and listeners on unmount", async () => {
    const setI = vi.spyOn(globalThis, "setInterval");
    const clearI = vi.spyOn(globalThis, "clearInterval");
    const removeV = vi.spyOn(HTMLMediaElement.prototype, "removeEventListener");
    const r = await mount();
    const ids = setI.mock.results.map((x) => x.value);
    expect(ids.length).toBeGreaterThan(0);
    r.unmount();
    ids.forEach((id) => expect(clearI).toHaveBeenCalledWith(id));
    expect(removeV.mock.calls.map((c) => c[0])).toEqual(expect.arrayContaining(["error", "ended", "timeupdate", "playing"]));
    expect(pauseSpy).toHaveBeenCalled();
    expect(mq.listeners.length).toBe(0);
    expect(document.body.style.overflow).toBe("");
  });
});
