"use client";

import { useActionState, useState } from "react";
import { createTest } from "@/app/actions/designer";
import { COUNTRIES, DEVICES, money } from "@/lib/rules";

type Task = { title: string; instructions: string };
type Question = { prompt: string; kind: "TEXT" | "RATING" };

export function TestBuilder({
  projects,
  defaultProject,
  unitCents,
  specialistCents,
  credits,
  plan,
}: {
  projects: { id: string; name: string }[];
  defaultProject?: string;
  unitCents: number;
  specialistCents: number;
  credits: number;
  plan: string;
}) {
  const [state, action, pending] = useActionState(createTest, undefined);
  const [conceptType, setConceptType] = useState<"LINK" | "IMAGES" | "PDF" | "VIDEO">("LINK");
  const [tasks, setTasks] = useState<Task[]>([{ title: "", instructions: "" }]);
  const [questions, setQuestions] = useState<Question[]>([
    { prompt: "What was your overall impression of this concept?", kind: "TEXT" },
    { prompt: "How easy was it to use? (1 = very hard, 5 = very easy)", kind: "RATING" },
  ]);
  const [count, setCount] = useState(5);
  const [specialist, setSpecialist] = useState(false);

  const unit = specialist ? specialistCents : unitCents;
  const free = specialist ? 0 : Math.min(credits, count);
  const total = (count - free) * unit;
  const accept = { IMAGES: "image/*", PDF: "application/pdf", VIDEO: "video/*", LINK: "" }[conceptType];

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <section className="card space-y-4">
          <div>
            <div className="flex items-baseline gap-3"><span className="font-hand text-3xl leading-none text-[#e8430c]">01</span><h2 className="h2">What are you testing?</h2></div>
            <p className="hint mt-1">Give testers the design and a little context, as if you were handing them your phone.</p>
          </div>
          <div>
            <label className="label" htmlFor="projectId">Project</label>
            <select className="input" id="projectId" name="projectId" defaultValue={defaultProject ?? projects[0]?.id}>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="title">Test title</label>
            <input className="input" id="title" name="title" placeholder="Checkout flow v2" required />
          </div>
          <div>
            <label className="label" htmlFor="description">Context for testers</label>
            <textarea className="input min-h-24" id="description" name="description" required
              placeholder="Imagine you want to order groceries for the week. This is an early concept, some things won't work." />
          </div>
          <div>
            <span className="label">Concept format</span>
            <div className="flex flex-wrap gap-2">
              {([["LINK", "Figma / prototype link"], ["IMAGES", "Images"], ["PDF", "PDF"], ["VIDEO", "Video"]] as const).map(([k, l]) => (
                <label key={k} className={`btn-ghost ${conceptType === k ? "!border-accent !bg-peach" : ""}`}>
                  <input type="radio" name="conceptType" value={k} className="sr-only" checked={conceptType === k} onChange={() => setConceptType(k)} />
                  {l}
                </label>
              ))}
            </div>
          </div>
          {conceptType === "LINK" ? (
            <div>
              <label className="label" htmlFor="conceptUrl">Prototype URL</label>
              <input className="input" id="conceptUrl" name="conceptUrl" type="url" placeholder="https://www.figma.com/proto/…" />
              <p className="hint mt-1">Make sure the link is viewable by anyone with it.</p>
            </div>
          ) : (
            <div>
              <label className="label" htmlFor="assets">Upload files</label>
              <input className="input" id="assets" name="assets" type="file" accept={accept} multiple={conceptType === "IMAGES"} />
              <p className="hint mt-1">{conceptType === "IMAGES" ? "Up to 20 screens, shown in order." : "One file."}</p>
            </div>
          )}
        </section>

        <section className="card space-y-4">
          <div className="flex items-center justify-between">
            <div>
            <div className="flex items-baseline gap-3"><span className="font-hand text-3xl leading-none text-[#2f55e8]">02</span><h2 className="h2">What should testers do?</h2></div>
            <p className="hint mt-1">Each task is one goal, e.g. “Order a coffee for pickup”. Don&apos;t tell them where to click.</p>
          </div>
            <button type="button" className="btn-ghost" onClick={() => setTasks([...tasks, { title: "", instructions: "" }])}>+ Task</button>
          </div>
          {tasks.map((t, i) => (
            <div key={i} className="rounded-[16px] border border-sky-line bg-sky/60 p-3">
              <div className="mb-2 flex items-center justify-between text-sm font-medium">
                Task {i + 1}
                {tasks.length > 1 && (
                  <button type="button" className="text-bad" onClick={() => setTasks(tasks.filter((_, j) => j !== i))}>Remove</button>
                )}
              </div>
              <input className="input mb-2" placeholder="Short title, e.g. Find a vegan recipe" value={t.title} aria-label={`Task ${i + 1} title`}
                onChange={(e) => setTasks(tasks.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
              <textarea className="input" placeholder="What should the tester try to do? Don't give away the answer." value={t.instructions} aria-label={`Task ${i + 1} instructions`}
                onChange={(e) => setTasks(tasks.map((x, j) => (j === i ? { ...x, instructions: e.target.value } : x)))} />
            </div>
          ))}
          <input type="hidden" name="tasks" value={JSON.stringify(tasks)} />
        </section>

        <section className="card space-y-4">
          <div className="flex items-center justify-between">
            <div>
            <div className="flex items-baseline gap-3"><span className="font-hand text-3xl leading-none text-[#6a3ff0]">03</span><h2 className="h2">Questions after the tasks</h2></div>
            <p className="hint mt-1">Optional. Asked once the tasks are done, e.g. “What would you change?”</p>
          </div>
            <button type="button" className="btn-ghost" onClick={() => setQuestions([...questions, { prompt: "", kind: "TEXT" }])}>+ Question</button>
          </div>
          {questions.map((q, i) => (
            <div key={i} className="flex flex-col gap-2 sm:flex-row">
              <input className="input flex-1" value={q.prompt} placeholder="Question" aria-label={`Question ${i + 1}`}
                onChange={(e) => setQuestions(questions.map((x, j) => (j === i ? { ...x, prompt: e.target.value } : x)))} />
              <select className="input sm:w-36" value={q.kind} aria-label="Answer type"
                onChange={(e) => setQuestions(questions.map((x, j) => (j === i ? { ...x, kind: e.target.value as Question["kind"] } : x)))}>
                <option value="TEXT">Text</option>
                <option value="RATING">Rating 1–5</option>
              </select>
              <button type="button" className="btn-ghost" onClick={() => setQuestions(questions.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <input type="hidden" name="questions" value={JSON.stringify(questions)} />
          <div className="rounded-[14px] bg-surface-2 p-3">
            <div className="text-sm font-medium">Attention check</div>
            <p className="hint mb-2">A simple question with a known answer, used to catch careless sessions.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <input className="input" name="attentionPrompt" defaultValue="To show you're paying attention, type the word “coffee”." aria-label="Attention question" />
              <input className="input" name="attentionAnswer" defaultValue="coffee" aria-label="Expected answer" />
            </div>
          </div>
        </section>

        <section className="card space-y-4">
          <div>
            <div className="flex items-baseline gap-3"><span className="font-hand text-3xl leading-none text-[#16a35a]">04</span><h2 className="h2">Who should test it?</h2></div>
            <p className="hint mt-1">Leave everything empty to let anyone take the test — it fills fastest that way.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="ageMin">Age from</label>
              <input className="input" id="ageMin" name="ageMin" type="number" min={18} max={99} placeholder="18" />
            </div>
            <div>
              <label className="label" htmlFor="ageMax">Age to</label>
              <input className="input" id="ageMax" name="ageMax" type="number" min={18} max={99} placeholder="Any" />
            </div>
          </div>
          <div>
            <span className="label">Devices</span>
            <div className="flex flex-wrap gap-3 text-sm">
              {DEVICES.map((d) => (
                <label key={d} className="flex items-center gap-1.5"><input type="checkbox" name="devices" value={d} /> {d.toLowerCase()}</label>
              ))}
            </div>
            <p className="hint mt-1">Leave empty for any device.</p>
          </div>
          <div>
            <span className="label">Countries</span>
            <div className="grid grid-cols-2 gap-1 text-sm sm:grid-cols-3">
              {COUNTRIES.map((c) => (
                <label key={c} className="flex items-center gap-1.5"><input type="checkbox" name="countries" value={c} /> {c}</label>
              ))}
            </div>
            <p className="hint mt-1">Leave empty for any country.</p>
          </div>
          <div>
            <label className="label" htmlFor="profession">Profession {plan !== "PRO" && <span className="hint">(Pro plan or specialist tests)</span>}</label>
            <input className="input" id="profession" name="profession" placeholder="e.g. Nurse" />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="specialist" className="mt-1" checked={specialist} onChange={(e) => setSpecialist(e.target.checked)} />
            <span>Specialist testers (doctors, developers…) — {money(specialistCents)} per session, higher tester fee.</span>
          </label>
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <div className="card space-y-4">
          <h2 className="h2">Summary</h2>
          <div>
            <label className="label" htmlFor="sessionsWanted">How many testers?</label>
            <p className="hint mb-1">5 people usually find most of the big problems.</p>
            <input className="input" id="sessionsWanted" name="sessionsWanted" type="number" min={1} max={50} value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} />
          </div>
          <div>
            <label className="label" htmlFor="minSeconds">Shortest allowed session (seconds)</label>
            <input className="input" id="minSeconds" name="minSeconds" type="number" min={30} max={1800} defaultValue={90} />
          </div>
          <dl className="space-y-1 border-t border-line pt-3 text-sm">
            <div className="flex justify-between"><dt className="text-muted">{count} × {money(unit)}</dt><dd>{money(count * unit)}</dd></div>
            {free > 0 && <div className="flex justify-between text-ok"><dt>Free credits ({free})</dt><dd>−{money(free * unit)}</dd></div>}
            <div className="flex justify-between font-semibold"><dt>Total</dt><dd>{money(total)}</dd></div>
          </dl>
          {state?.error && <p role="alert" className="rounded-[14px] bg-bad/10 px-3 py-2 text-sm text-bad">{state.error}</p>}
          <button className="btn-brand w-full" disabled={pending}>{pending ? "Saving…" : "Save & continue"}</button>
          <p className="hint">Nothing is charged yet — you&apos;ll see the total and publish on the next page.</p>
        </div>
      </aside>
    </form>
  );
}
