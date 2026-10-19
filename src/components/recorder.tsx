"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConceptView } from "./concept-view";
import { abandonSession } from "@/app/actions/tester";
import { Note, fmtTime, type NoteTone } from "./ui";

type Task = { title: string; instructions: string };
type Question = { prompt: string; kind: "TEXT" | "RATING" };
type Seg = { t: number; text: string };
type Ev = { t: number; type: "TASK_START" | "TASK_END"; task: number; success?: boolean };

type SpeechRec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

const clock = () => performance.now();

function pickMime() {
  const options = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
  return options.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) ?? "";
}

/** Uploads chunks one at a time, in order, retrying with backoff until they land. */
class ChunkQueue {
  private queue: { blob: Blob; index: number }[] = [];
  private running = false;
  private index = 0;
  private idle: (() => void)[] = [];
  failed = 0;
  constructor(private sessionId: string, private kind: "screen" | "camera", private mime: string, private onState: () => void) {}
  push(blob: Blob) {
    if (!blob.size) return;
    this.queue.push({ blob, index: this.index++ });
    void this.run();
  }
  get pending() {
    return this.queue.length;
  }
  private async run() {
    if (this.running) return;
    this.running = true;
    while (this.queue.length) {
      const item = this.queue[0];
      let attempt = 0;
      for (;;) {
        try {
          const res = await fetch(`/api/sessions/${this.sessionId}/chunk?kind=${this.kind}&index=${item.index}`, {
            method: "POST",
            headers: { "Content-Type": this.mime.split(";")[0] || "application/octet-stream" },
            body: item.blob,
          });
          if (res.ok) break;
          if (res.status === 400 || res.status === 403) throw new Error("fatal");
        } catch (e) {
          if ((e as Error).message === "fatal") break;
        }
        this.failed++;
        this.onState();
        await new Promise((r) => setTimeout(r, Math.min(15000, 1000 * 2 ** attempt++)));
      }
      this.queue.shift();
      this.onState();
    }
    this.running = false;
    this.idle.splice(0).forEach((r) => r());
  }
  drain() {
    if (!this.running && !this.queue.length) return Promise.resolve();
    return new Promise<void>((r) => this.idle.push(r));
  }
}

export function Recorder(props: {
  sessionId: string;
  title: string;
  description: string;
  conceptType: "LINK" | "IMAGES" | "PDF" | "VIDEO";
  conceptUrl: string | null;
  assets: string[];
  tasks: Task[];
  questions: Question[];
  attentionPrompt: string | null;
  minSeconds: number;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"intro" | "recording" | "questions" | "uploading">("intro");
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [note, setNote] = useState("");
  const [answers, setAnswers] = useState<string[]>(props.questions.map(() => ""));
  const [attention, setAttention] = useState("");
  const [liveText, setLiveText] = useState("");
  const [speechOk, setSpeechOk] = useState(true);
  const [hasScreen, setHasScreen] = useState(false);
  const [upload, setUpload] = useState({ pending: 0, unstable: false });
  const [noteCount, setNoteCount] = useState(0);

  const startAt = useRef(0);
  const streams = useRef<MediaStream[]>([]);
  const recorders = useRef<MediaRecorder[]>([]);
  const queues = useRef<ChunkQueue[]>([]);
  const transcript = useRef<Seg[]>([]);
  const events = useRef<Ev[]>([]);
  const notes = useRef<Seg[]>([]);
  const speech = useRef<SpeechRec | null>(null);
  const preview = useRef<HTMLVideoElement>(null);
  const stopped = useRef(false);

  const t = () => Math.round(((clock() - startAt.current) / 1000) * 10) / 10;

  useEffect(() => {
    if (step !== "recording") return;
    const id = setInterval(() => setElapsed(t()), 500);
    return () => clearInterval(id);
  }, [step]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (step === "recording" || step === "uploading") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [step]);

  useEffect(() => () => streams.current.forEach((s) => s.getTracks().forEach((tr) => tr.stop())), []);

  async function begin() {
    setError(null);
    try {
      const cam = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: { echoCancellation: true, noiseSuppression: true } });
      streams.current.push(cam);
      let screen: MediaStream | null = null;
      if (navigator.mediaDevices.getDisplayMedia) {
        try {
          screen = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false });
          streams.current.push(screen);
        } catch {
          setError("Screen sharing was declined. Please share your screen (choose this tab or your whole screen) to continue.");
          cam.getTracks().forEach((tr) => tr.stop());
          streams.current = [];
          return;
        }
      }
      if (preview.current) preview.current.srcObject = cam;

      const mime = pickMime();
      const onState = () =>
        setUpload({
          pending: queues.current.reduce((n, q) => n + q.pending, 0),
          unstable: queues.current.some((q) => q.failed > 0),
        });
      const audio = cam.getAudioTracks();
      // Main recording: the screen (or the camera on mobile, where screen capture is unavailable) plus the voice.
      const main = new MediaStream([...(screen ? screen.getVideoTracks() : cam.getVideoTracks()), ...audio]);
      const mainQ = new ChunkQueue(props.sessionId, "screen", mime, onState);
      const mainRec = new MediaRecorder(main, { mimeType: mime || undefined, videoBitsPerSecond: 1_200_000 });
      mainRec.ondataavailable = (e) => mainQ.push(e.data);
      recorders.current.push(mainRec);
      queues.current.push(mainQ);
      if (screen) {
        const camQ = new ChunkQueue(props.sessionId, "camera", mime, onState);
        const camRec = new MediaRecorder(new MediaStream(cam.getVideoTracks()), { mimeType: mime || undefined, videoBitsPerSecond: 300_000 });
        camRec.ondataavailable = (e) => camQ.push(e.data);
        recorders.current.push(camRec);
        queues.current.push(camQ);
        screen.getVideoTracks()[0].addEventListener("ended", () => {
          if (!stopped.current) setError("Screen sharing stopped. The rest of the session is recorded from your camera only.");
        });
      }
      setHasScreen(Boolean(screen));

      startAt.current = clock();
      recorders.current.forEach((r) => r.start(4000));
      startSpeech();
      events.current.push({ t: 0, type: "TASK_START", task: 0 });
      setStep("recording");
    } catch (e) {
      setError(`We couldn't access your camera and microphone (${(e as Error).message}). Allow access in your browser and try again.`);
    }
  }

  function startSpeech() {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      setSpeechOk(false);
      return;
    }
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    let segStart: number | null = null;
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (segStart === null) segStart = Math.max(0, t() - 2);
        if (r.isFinal) {
          const text = r[0].transcript.trim();
          if (text) transcript.current.push({ t: segStart, text });
          segStart = null;
        } else interim += r[0].transcript;
      }
      setLiveText(interim);
    };
    rec.onend = () => {
      if (!stopped.current) {
        try {
          rec.start();
        } catch {}
      }
    };
    try {
      rec.start();
      speech.current = rec;
    } catch {
      setSpeechOk(false);
    }
  }

  function finishTask(success: boolean) {
    events.current.push({ t: t(), type: "TASK_END", task: current, success });
    if (current < props.tasks.length - 1) {
      events.current.push({ t: t() + 0.1, type: "TASK_START", task: current + 1 });
      setCurrent(current + 1);
    } else setStep("questions");
  }

  function addNote() {
    if (!note.trim()) return;
    notes.current.push({ t: t(), text: note.trim() });
    setNoteCount(notes.current.length);
    setNote("");
  }

  async function submit() {
    setStep("uploading");
    stopped.current = true;
    const duration = Math.round(t());
    speech.current?.stop();
    await Promise.all(
      recorders.current.map(
        (r) =>
          new Promise<void>((res) => {
            if (r.state === "inactive") return res();
            r.addEventListener("stop", () => res(), { once: true });
            r.stop();
          }),
      ),
    );
    streams.current.forEach((s) => s.getTracks().forEach((tr) => tr.stop()));
    await Promise.all(queues.current.map((q) => q.drain()));
    const res = await fetch(`/api/sessions/${props.sessionId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        duration,
        transcript: transcript.current,
        events: events.current,
        notes: notes.current,
        answers: props.questions.map((q, i) => ({ prompt: q.prompt, answer: answers[i] })),
        attention,
      }),
    });
    if (!res.ok) {
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Submission failed — please try again.");
      setStep("questions");
      return;
    }
    router.push("/tester/sessions?submitted=1");
  }

  const pendingChunks = upload.pending;
  const task = props.tasks[current];

  if (step === "intro") {
    return (
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <h1 className="h1">{props.title}</h1>
          <p className="mt-1 text-muted">Read this first — it takes 30 seconds.</p>
        </div>
        <div className="card space-y-3">
          <h2 className="h2">The situation</h2>
          <p className="whitespace-pre-line text-sm">{props.description}</p>
          <h3 className="pt-2 font-semibold">You&apos;ll do {props.tasks.length} {props.tasks.length === 1 ? "task" : "tasks"}</h3>
          <ol className="list-decimal pl-5 text-sm">{props.tasks.map((x, i) => <li key={i}>{x.title}</li>)}</ol>
        </div>
        <ol className="grid gap-5 sm:grid-cols-2">
          {([
            ["peach", "Allow recording", "Your browser asks to share the screen, camera and microphone. Choose this tab or your whole screen."],
            ["sky", "Think out loud", "Say what you see, expect and feel the whole time. Silent sessions get rejected."],
            ["lilac", "Do the tasks", "The task is shown on the right. Press “I did it” or “I couldn't” when you're done — both are fine."],
            ["mint", "Answer & submit", `A few short questions at the end. Sessions shorter than ${fmtTime(props.minSeconds)} can't be accepted.`],
          ] as [NoteTone, string, string][]).map(([tone, title, text], i) => (
            <li key={title}>
              <Note tone={tone} n={`0${i + 1}`} title={title} pin={i === 0} className="h-full">
                <p className="mt-2 text-sm text-ink/70">{text}</p>
              </Note>
            </li>
          ))}
        </ol>
        <p className="hint">
          This concept is confidential under your tester NDA — no screenshots or sharing. Find a quiet place. Live transcription works
          best in Chrome, Edge and Safari.
        </p>
        {error && <p role="alert" className="rounded-[14px] bg-bad/10 p-3 text-sm text-bad">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button className="btn-brand !px-6 !py-3" onClick={begin}>Allow recording & start</button>
          <form action={abandonSession}>
            <input type="hidden" name="sessionId" value={props.sessionId} />
            <button className="btn-ghost !py-3">Leave this test</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0">
        {step === "recording" ? (
          <ConceptView type={props.conceptType} url={props.conceptUrl} assets={props.assets} />
        ) : (
          <div className="card space-y-4">
            <h2 className="h2">Last few questions</h2>
            <p className="hint">Tasks done! Keep talking while you answer — there are no wrong answers. Recording stops when you submit.</p>
            {props.questions.map((q, i) => (
              <div key={i}>
                <label className="label">{q.prompt}</label>
                {q.kind === "RATING" ? (
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" onClick={() => setAnswers(answers.map((a, j) => (j === i ? String(n) : a)))}
                        className={`btn-ghost !px-4 ${answers[i] === String(n) ? "!border-accent !bg-peach" : ""}`}>{n}</button>
                    ))}
                  </div>
                ) : (
                  <textarea className="input" value={answers[i]} onChange={(e) => setAnswers(answers.map((a, j) => (j === i ? e.target.value : a)))} />
                )}
              </div>
            ))}
            {props.attentionPrompt && (
              <div>
                <label className="label" htmlFor="attention">{props.attentionPrompt}</label>
                <input id="attention" className="input" value={attention} onChange={(e) => setAttention(e.target.value)} />
              </div>
            )}
            {error && <p role="alert" className="rounded-[14px] bg-bad/10 p-3 text-sm text-bad">{error}</p>}
            <button className="btn-brand" disabled={step === "uploading"} onClick={submit}>
              {step === "uploading" ? `Uploading… ${pendingChunks ? `(${pendingChunks} part(s) left)` : ""}` : "Submit session & stop recording"}
            </button>
            {elapsed < props.minSeconds && step !== "uploading" && (
              <p className="text-sm text-warn">This session is shorter than the {fmtTime(props.minSeconds)} minimum and may be rejected. Keep talking through your impressions.</p>
            )}
          </div>
        )}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <div className="card !p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 font-medium text-bad"><span className="size-2.5 animate-pulse rounded-full bg-bad" /> Recording</span>
            <span className="tabular-nums">{fmtTime(elapsed)}</span>
          </div>
          <video ref={preview} autoPlay muted playsInline className="mt-2 aspect-[4/3] w-full rounded-[14px] bg-black object-cover" />
          <div className="mt-2 text-xs text-muted">
            {hasScreen ? "Screen + camera + voice" : "Camera + voice"}
            {pendingChunks > 0 && ` · uploading ${pendingChunks} part(s)`}
            {upload.unstable && " · connection unstable, retrying"}
          </div>
          {speechOk ? (
            <p className="mt-2 min-h-5 text-xs italic text-muted">{liveText || "Listening…"}</p>
          ) : (
            <p className="mt-2 text-xs text-warn">Live transcription isn&apos;t available in this browser; your voice is still recorded.</p>
          )}
        </div>

        {step === "recording" && task && (
          <Note tone="peach" n={`0${current + 1}`} panelClassName="space-y-3">
            <div className="text-xs font-medium uppercase tracking-wide text-ink/50">Task {current + 1} of {props.tasks.length}</div>
            <h2 className="h2">{task.title}</h2>
            <p className="whitespace-pre-line text-sm">{task.instructions}</p>
            <p className="hint">Keep talking while you try. When you&apos;re done or stuck, tell us:</p>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-primary" onClick={() => finishTask(true)}>✓ I did it</button>
              <button className="btn-ghost" onClick={() => finishTask(false)}>I couldn&apos;t</button>
            </div>
          </Note>
        )}

        {step === "recording" && (
          <div className="card space-y-2">
            <label className="label" htmlFor="note">Quick note <span className="hint font-normal">(optional)</span></label>
            <textarea id="note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything you want to point out…"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addNote(); } }} />
            <button className="btn-ghost w-full" onClick={addNote}>Add note ({noteCount})</button>
          </div>
        )}
        {error && step === "recording" && <p role="alert" className="rounded-[14px] bg-warn/10 p-3 text-sm text-warn">{error}</p>}
      </aside>
    </div>
  );
}
