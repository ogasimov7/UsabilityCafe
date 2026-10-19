"use client";

import { useEffect, useRef, useState } from "react";
import { fmtTime, Severity } from "./ui";

type Seg = { t: number; text: string };
type Finding = { title: string; detail: string; theme: string; severity: string; t: number; quote?: string };
type Ev = { t: number; type: string; task: number; success?: boolean };

export function SessionPlayer({
  screenSrc,
  cameraSrc,
  watermark,
  transcript,
  findings,
  events,
  notes,
  tasks,
  duration,
}: {
  screenSrc: string | null;
  cameraSrc: string | null;
  watermark: string;
  transcript: Seg[];
  findings: Finding[];
  events: Ev[];
  notes: Seg[];
  tasks: string[];
  duration: number;
}) {
  const screen = useRef<HTMLVideoElement>(null);
  const camera = useRef<HTMLVideoElement>(null);
  const [now, setNow] = useState(0);
  const [clipEnd, setClipEnd] = useState<number | null>(null);
  const [tab, setTab] = useState<"findings" | "transcript" | "notes">("findings");

  useEffect(() => {
    const v = screen.current;
    if (!v) return;
    const sync = () => {
      setNow(v.currentTime);
      const c = camera.current;
      if (c && Math.abs(c.currentTime - v.currentTime) > 0.4) c.currentTime = v.currentTime;
      if (clipEnd !== null && v.currentTime >= clipEnd) {
        v.pause();
        setClipEnd(null);
      }
    };
    const play = () => camera.current?.play().catch(() => {});
    const pause = () => camera.current?.pause();
    v.addEventListener("timeupdate", sync);
    v.addEventListener("play", play);
    v.addEventListener("pause", pause);
    return () => {
      v.removeEventListener("timeupdate", sync);
      v.removeEventListener("play", play);
      v.removeEventListener("pause", pause);
    };
  }, [clipEnd]);

  function seek(t: number, clip = false) {
    const v = screen.current;
    if (!v) return;
    v.currentTime = Math.max(0, clip ? t - 3 : t);
    setClipEnd(clip ? t + 8 : null);
    v.play().catch(() => {});
  }

  const total = Math.max(duration, 1);
  const activeSeg = [...transcript].reverse().find((s) => s.t <= now);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div>
        <div className="relative overflow-hidden rounded-[22px] bg-black shadow-[0_24px_48px_-16px_rgba(24,24,27,0.35)]" onContextMenu={(e) => e.preventDefault()}>
          {screenSrc ? (
            <video ref={screen} src={screenSrc} controls controlsList="nodownload noremoteplayback" disablePictureInPicture className="aspect-video w-full" />
          ) : (
            <div className="grid aspect-video place-items-center text-sm text-white/70">No screen recording</div>
          )}
          {cameraSrc && (
            <video ref={camera} src={cameraSrc} muted playsInline className="pointer-events-none absolute right-3 top-3 w-1/4 rounded-[14px] border-2 border-white/40 object-cover" />
          )}
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="rotate-[-20deg] select-none text-2xl font-semibold text-white/15">{watermark}</span>
          </div>
        </div>
        <div className="relative mt-3 h-8 rounded-[10px] bg-white shadow-sm" aria-label="Session timeline">
          {events.filter((e) => e.type === "TASK_START").map((e) => {
            const end = events.find((x) => x.type === "TASK_END" && x.task === e.task);
            const left = (e.t / total) * 100;
            const width = (((end?.t ?? e.t) - e.t) / total) * 100;
            return (
              <button key={e.task} title={tasks[e.task]} onClick={() => seek(e.t)}
                className={`absolute top-1 h-6 rounded ${end?.success === false ? "bg-bad/40" : "bg-ok/30"}`}
                style={{ left: `${left}%`, width: `${Math.max(width, 1)}%` }}>
                <span className="sr-only">Task {e.task + 1}</span>
              </button>
            );
          })}
          {findings.map((f, i) => (
            <button key={i} title={f.title} onClick={() => seek(f.t, true)}
              className={`absolute top-0 h-8 w-1 rounded ${f.severity === "critical" ? "bg-bad" : f.severity === "major" ? "bg-warn" : f.severity === "positive" ? "bg-ok" : "bg-info"}`}
              style={{ left: `${(f.t / total) * 100}%` }}>
              <span className="sr-only">{f.title}</span>
            </button>
          ))}
          <div className="pointer-events-none absolute top-0 h-8 w-0.5 bg-ink" style={{ left: `${(now / total) * 100}%` }} />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span>Timeline:</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-ok/30" /> task completed</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-bad/40" /> task failed</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-1 rounded-sm bg-bad" /> problem found — click to jump</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-1 rounded-sm bg-ok" /> positive moment</span>
        </div>
        {activeSeg && <p className="mt-3 rounded-[14px] border border-white bg-surface p-3 text-sm italic shadow-sm">“{activeSeg.text}”</p>}
      </div>

      <div className="card flex max-h-[640px] flex-col !p-0">
        <div className="flex border-b border-line text-sm">
          {(["findings", "transcript", "notes"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`flex-1 px-3 py-3 capitalize ${tab === t ? "border-b-2 border-accent font-medium" : "text-muted"}`}>
              {t} ({t === "findings" ? findings.length : t === "transcript" ? transcript.length : notes.length})
            </button>
          ))}
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto p-3 text-sm">
          {tab === "findings" &&
            (findings.length ? findings.map((f, i) => (
              <button key={i} onClick={() => seek(f.t, true)} className="block w-full rounded-[14px] bg-surface-2 p-3 text-left hover:ring-2 hover:ring-accent/30">
                <div className="flex items-center justify-between gap-2">
                  <Severity value={f.severity} />
                  <span className="text-xs text-muted">▶ clip {fmtTime(f.t)}</span>
                </div>
                <div className="mt-1 font-medium">{f.title}</div>
                <div className="text-muted">{f.detail}</div>
                <div className="mt-1 text-xs text-muted">{f.theme}</div>
              </button>
            )) : <p className="text-muted">No findings.</p>)}
          {tab === "transcript" &&
            (transcript.length ? transcript.map((s, i) => (
              <button key={i} onClick={() => seek(s.t)} className={`flex w-full gap-3 rounded-lg p-2 text-left hover:bg-surface-2 ${activeSeg === s ? "bg-peach" : ""}`}>
                <span className="w-10 shrink-0 text-xs text-muted">{fmtTime(s.t)}</span>
                <span>{s.text}</span>
              </button>
            )) : <p className="text-muted">No speech was transcribed.</p>)}
          {tab === "notes" &&
            (notes.length ? notes.map((s, i) => (
              <button key={i} onClick={() => seek(s.t)} className="flex w-full gap-3 rounded-lg p-2 text-left hover:bg-surface-2">
                <span className="w-10 shrink-0 text-xs text-muted">{fmtTime(s.t)}</span>
                <span>{s.text}</span>
              </button>
            )) : <p className="text-muted">The tester left no notes.</p>)}
        </div>
      </div>
    </div>
  );
}
