import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { db, parse } from "./db";

export type Seg = { t: number; text: string };
export type Ev = { t: number; type: "TASK_START" | "TASK_END"; task: number; success?: boolean };
export type Note = { t: number; text: string };
export type Answer = { prompt: string; answer: string };
export type TaskDef = { title: string; instructions: string };

export const severityOrder = ["critical", "major", "minor", "positive"] as const;
export type Severity = (typeof severityOrder)[number];

const findingSchema = z.object({
  title: z.string(),
  detail: z.string(),
  theme: z.string(),
  severity: z.enum(severityOrder),
  t: z.number().describe("seconds into the recording where this happens"),
  quote: z.string().optional(),
});

const analysisSchema = z.object({
  summary: z.string(),
  sentiment: z.enum(["positive", "neutral", "negative"]),
  sentimentScore: z.number().min(-1).max(1),
  findings: z.array(findingSchema),
});

export type Finding = z.infer<typeof findingSchema>;
export type TaskResult = { task: number; title: string; success: boolean | null; seconds: number | null };
export type Analysis = z.infer<typeof analysisSchema> & {
  tasks: TaskResult[];
  qualityScore: number;
  qualityIssues: string[];
  engine: "llm" | "heuristic";
};

const THEMES: Record<string, string[]> = {
  Navigation: ["menu", "find", "where", "navigate", "back", "lost", "scroll", "page", "tab", "link"],
  Clarity: ["confus", "understand", "unclear", "what does", "mean", "not sure", "don't know", "expect"],
  "Visual design": ["color", "colour", "font", "small", "tiny", "look", "ugly", "beautiful", "layout", "icon", "contrast"],
  "Trust & pricing": ["trust", "secure", "safe", "price", "cost", "pay", "expensive", "cheap", "fee"],
  Performance: ["slow", "load", "wait", "lag", "fast"],
  Content: ["text", "read", "word", "copy", "label", "title", "description", "button says"],
  Interaction: ["click", "tap", "button", "press", "drag", "swipe", "form", "field", "input"],
};
const NEG = ["confus", "hard", "difficult", "annoy", "frustrat", "don't like", "do not like", "can't", "cannot", "lost", "stuck", "slow", "unclear", "weird", "ugly", "hate", "not sure", "don't know", "where is", "no idea", "broken", "wrong", "too small", "too much", "too late", "don't trust", "doesn't work", "missing"];
const BLOCKERS = ["can't", "cannot", "stuck", "no idea", "give up", "gave up", "impossible", "doesn't work"];
const POS = ["like", "love", "easy", "clear", "nice", "great", "simple", "intuitive", "good", "cool", "perfect", "obvious", "helpful"];
const HEDGE = ["hmm", "maybe", "i guess", "kind of", "sort of", "probably"];

function has(text: string, words: string[]) {
  return words.some((w) => text.includes(w));
}

function themeOf(text: string) {
  let best = "General";
  let score = 0;
  for (const [theme, words] of Object.entries(THEMES)) {
    const s = words.filter((w) => text.includes(w)).length;
    if (s > score) {
      score = s;
      best = theme;
    }
  }
  return best;
}

export function taskResults(tasks: TaskDef[], events: Ev[]): TaskResult[] {
  return tasks.map((task, i) => {
    const start = events.find((e) => e.type === "TASK_START" && e.task === i);
    const end = events.find((e) => e.type === "TASK_END" && e.task === i);
    return {
      task: i,
      title: task.title,
      success: end?.success ?? null,
      seconds: start && end ? Math.max(0, Math.round(end.t - start.t)) : null,
    };
  });
}

function taskAt(t: number, events: Ev[]) {
  let current = -1;
  for (const e of events) if (e.t <= t && e.type === "TASK_START") current = e.task;
  return current;
}

function quality(input: {
  duration: number;
  minSeconds: number;
  transcript: Seg[];
  attentionOk: boolean | null;
  tasks: TaskResult[];
}) {
  const issues: string[] = [];
  let score = 100;
  const words = input.transcript.reduce((n, s) => n + s.text.split(/\s+/).filter(Boolean).length, 0);
  if (input.duration < input.minSeconds) {
    issues.push(`Session shorter than the ${input.minSeconds}s minimum`);
    score -= 40;
  }
  if (words < 20) {
    issues.push("Very little think-aloud speech captured");
    score -= 30;
  } else if (words < 60) {
    issues.push("Limited think-aloud speech");
    score -= 10;
  }
  if (input.attentionOk === false) {
    issues.push("Failed the attention check");
    score -= 35;
  }
  const skipped = input.tasks.filter((t) => t.success === null).length;
  if (skipped) {
    issues.push(`${skipped} task(s) not completed`);
    score -= 10 * skipped;
  }
  const rushed = input.tasks.filter((t) => t.seconds !== null && t.seconds < 5).length;
  if (rushed) {
    issues.push(`${rushed} task(s) rushed in under 5 seconds`);
    score -= 10 * rushed;
  }
  return { qualityScore: Math.max(0, Math.min(100, score)), qualityIssues: issues };
}

function heuristic(tasks: TaskDef[], transcript: Seg[], events: Ev[], notes: Note[], answers: Answer[]) {
  const results = taskResults(tasks, events);
  const findings: Finding[] = [];
  let pos = 0;
  let neg = 0;
  const lines: Seg[] = [...transcript, ...notes.map((n) => ({ t: n.t, text: n.text }))];
  for (const seg of lines) {
    const text = seg.text.toLowerCase();
    const isNeg = has(text, NEG);
    const isPos = !isNeg && has(text, POS);
    const isHedge = has(text, HEDGE);
    if (isNeg) neg++;
    if (isPos) pos++;
    if (!isNeg && !isPos && !isHedge) continue;
    const ti = taskAt(seg.t, events);
    const failed = ti >= 0 && results[ti]?.success === false;
    const blocked = isNeg && has(text, BLOCKERS);
    const severity: Severity = isNeg ? (blocked && failed ? "critical" : "major") : isPos ? "positive" : "minor";
    const theme = themeOf(text);
    const where = ti >= 0 ? ` during “${tasks[ti]?.title}”` : "";
    findings.push({
      title:
        severity === "positive"
          ? `Positive reaction${where}`
          : severity === "minor"
            ? `Hesitation${where}`
            : `${theme} problem${where}`,
      detail: seg.text,
      theme,
      severity,
      t: seg.t,
      quote: seg.text,
    });
  }
  for (const r of results) {
    if (r.success === false) {
      findings.push({
        title: `Could not complete “${r.title}”`,
        detail: `The tester reported failing this task${r.seconds ? ` after ${r.seconds}s` : ""}.`,
        theme: "Task success",
        severity: "critical",
        t: events.find((e) => e.type === "TASK_END" && e.task === r.task)?.t ?? 0,
      });
    }
  }
  for (const a of answers) {
    const text = a.answer.toLowerCase();
    if (has(text, NEG)) neg++;
    else if (has(text, POS)) pos++;
  }
  const total = pos + neg || 1;
  const sentimentScore = Math.round(((pos - neg) / total) * 100) / 100;
  const sentiment = sentimentScore > 0.2 ? "positive" : sentimentScore < -0.2 ? "negative" : "neutral";
  const done = results.filter((r) => r.success).length;
  const crit = findings.filter((f) => f.severity === "critical").length;
  const summary =
    `Completed ${done} of ${results.length} tasks. ` +
    `${findings.filter((f) => f.severity !== "positive").length} issue(s) found` +
    (crit ? `, ${crit} critical` : "") +
    `; overall sentiment was ${sentiment}.`;
  return { summary, sentiment, sentimentScore, findings } as z.infer<typeof analysisSchema>;
}

async function llm(test: { title: string; description: string }, tasks: TaskDef[], transcript: Seg[], events: Ev[], notes: Note[], answers: Answer[]) {
  const { output } = await generateText({
    model: process.env.ANALYSIS_MODEL ?? "anthropic/claude-sonnet-5.5",
    output: Output.object({ schema: analysisSchema }),
    system:
      "You are a senior UX researcher analyzing a think-aloud usability session of an early concept design. " +
      "Report concrete, evidence-based findings. Each finding must point to the second in the recording where it happens. " +
      "Severity: critical = blocks the task, major = causes clear friction, minor = small hesitation, positive = something that worked well. " +
      "Use short theme names such as Navigation, Clarity, Visual design, Trust & pricing, Content, Interaction, Performance.",
    prompt: JSON.stringify({ test, tasks, transcript, taskEvents: events, testerNotes: notes, postTestAnswers: answers }),
  });
  return output;
}

export async function analyzeSession(sessionId: string) {
  const session = await db.session.findUnique({ where: { id: sessionId }, include: { test: true } });
  if (!session) return;
  await db.session.update({ where: { id: sessionId }, data: { status: "ANALYZING" } });
  const tasks = parse<TaskDef[]>(session.test.tasks, []);
  const transcript = parse<Seg[]>(session.transcript, []);
  const events = parse<Ev[]>(session.events, []);
  const notes = parse<Note[]>(session.notes, []);
  const answers = parse<Answer[]>(session.answers, []);

  let core: z.infer<typeof analysisSchema>;
  let engine: Analysis["engine"] = "heuristic";
  if (process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN) {
    try {
      core = await llm(session.test, tasks, transcript, events, notes, answers);
      engine = "llm";
    } catch (err) {
      console.error("LLM analysis failed, falling back to heuristic", err);
      core = heuristic(tasks, transcript, events, notes, answers);
    }
  } else {
    core = heuristic(tasks, transcript, events, notes, answers);
  }

  const tasksR = taskResults(tasks, events);
  const q = quality({
    duration: session.durationSec,
    minSeconds: session.test.minSeconds,
    transcript,
    attentionOk: session.attentionOk,
    tasks: tasksR,
  });
  const analysis: Analysis = { ...core, tasks: tasksR, ...q, engine };
  const flagged = q.qualityScore < 50;
  await db.session.update({
    where: { id: sessionId },
    data: {
      status: "READY",
      analysis: JSON.stringify(analysis),
      qualityScore: q.qualityScore,
      flagged,
      flagReason: flagged ? q.qualityIssues.join("; ") : null,
    },
  });
  await buildReport(session.testId);
}

export type Report = {
  generatedAt: string;
  sessions: number;
  taskStats: { title: string; successRate: number | null; avgSeconds: number | null }[];
  sentiment: { positive: number; neutral: number; negative: number };
  themes: { theme: string; count: number; worst: Severity; findings: (Finding & { sessionId: string; tester: string })[] }[];
  severityCounts: Record<Severity, number>;
  summary: string;
};

export async function buildReport(testId: string) {
  const test = await db.test.findUnique({
    where: { id: testId },
    include: { sessions: { include: { tester: true } } },
  });
  if (!test) return;
  const tasks = parse<TaskDef[]>(test.tasks, []);
  const analyzed = test.sessions.filter(
    (s) => s.analysis && ["READY", "ACCEPTED", "DISPUTED"].includes(s.status),
  );
  const items = analyzed.map((s) => ({ s, a: parse<Analysis | null>(s.analysis, null)! }));
  const taskStats = tasks.map((t, i) => {
    const rs = items.map(({ a }) => a.tasks[i]).filter(Boolean);
    const known = rs.filter((r) => r.success !== null);
    const timed = rs.filter((r) => r.seconds !== null);
    return {
      title: t.title,
      successRate: known.length ? known.filter((r) => r.success).length / known.length : null,
      avgSeconds: timed.length ? Math.round(timed.reduce((n, r) => n + (r.seconds ?? 0), 0) / timed.length) : null,
    };
  });
  const sentiment = { positive: 0, neutral: 0, negative: 0 };
  const severityCounts: Record<Severity, number> = { critical: 0, major: 0, minor: 0, positive: 0 };
  const byTheme = new Map<string, Report["themes"][number]>();
  items.forEach(({ s, a }, idx) => {
    sentiment[a.sentiment]++;
    for (const f of a.findings) {
      severityCounts[f.severity]++;
      const entry = byTheme.get(f.theme) ?? { theme: f.theme, count: 0, worst: "positive" as Severity, findings: [] };
      entry.count++;
      if (severityOrder.indexOf(f.severity) < severityOrder.indexOf(entry.worst)) entry.worst = f.severity;
      entry.findings.push({ ...f, sessionId: s.id, tester: `Tester ${idx + 1}` });
      byTheme.set(f.theme, entry);
    }
  });
  const themes = [...byTheme.values()].sort(
    (a, b) => severityOrder.indexOf(a.worst) - severityOrder.indexOf(b.worst) || b.count - a.count,
  );
  for (const t of themes) t.findings.sort((a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity));
  const hardest = taskStats
    .filter((t) => t.successRate !== null)
    .sort((a, b) => (a.successRate ?? 1) - (b.successRate ?? 1))[0];
  const topProblem = themes.find((t) => t.worst !== "positive");
  const summary = items.length
    ? `${items.length} session(s) analyzed. ` +
      (hardest ? `Hardest task: “${hardest.title}” (${Math.round((hardest.successRate ?? 0) * 100)}% success). ` : "") +
      (topProblem ? `Most serious theme: ${topProblem.theme} (${topProblem.count} finding(s)). ` : "") +
      `${severityCounts.critical} critical, ${severityCounts.major} major, ${severityCounts.minor} minor issues and ${severityCounts.positive} positives.`
    : "No analyzed sessions yet.";
  const report: Report = {
    generatedAt: new Date().toISOString(),
    sessions: items.length,
    taskStats,
    sentiment,
    themes,
    severityCounts,
    summary,
  };
  await db.test.update({ where: { id: testId }, data: { report: JSON.stringify(report) } });
  return report;
}
