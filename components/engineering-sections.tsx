import type { ReactNode } from "react";

/* ============================================================================
 * Engineering sections: architecture, config, benchmarks, deploy + API, failures.
 *
 * Static, server-renderable, no animation. Every value marked FILL_ME is a
 * placeholder: replace it with what your backend really does, or delete the
 * row. Do not ship numbers you have not measured.
 * ========================================================================== */

const FRAME = "w-[var(--qp-frame,min(92vw,1120px))]";
const REPO = "https://github.com/Amogh-Mudakavi/QueryPilot_backend";

const mono = "font-mono text-[12px] leading-[1.7] text-white/70";

function Section({ id, title, lede, children }: { id: string; title: string; lede: string; children: ReactNode }) {
  return (
    <section id={id} className="border-t border-white/10 bg-[#0A0A0A] text-white">
      <div className={`mx-auto ${FRAME}`}>
        <div className="border-x border-white/10 px-4 py-14 sm:px-8 sm:py-20 min-[1280px]:px-12">
          <h2 className="max-w-[40rem] text-[20px] font-medium leading-[1.2] tracking-[-0.025em]">
            {title}
          </h2>
          <p className="mt-3 max-w-[40rem] text-[15px] leading-[1.6] text-white/55">{lede}</p>
          <div className="mt-10 flex flex-col gap-6">{children}</div>
        </div>
      </div>
    </section>
  );
}

/** A console window: filename on the left, context on the right, content below. */
function Panel({ name, meta, children, className = "" }: { name: string; meta?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 overflow-hidden rounded-sm border border-white/10 bg-[#0B0B0C] ${className}`}>
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-2.5 font-mono text-[12px] text-white/45">
        <span className="truncate text-white/70">{name}</span>
        {meta ? <span className="shrink-0">{meta}</span> : null}
      </div>
      {children}
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className={`${mono} overflow-x-auto p-4`}>
      <code>{children}</code>
    </pre>
  );
}

/* ---------------------------------------------------------------- data ---- */

const FLOW = `ingest
  upload ──▶ queue ──▶ parse ──▶ chunk ──▶ embed ──▶ index
                        │                            ├─ vectors
                        └─ ocr (scanned pages)       └─ rows + metadata

query
  question ──▶ workspace scope ──▶ hybrid retrieve ──▶ rerank
           ──▶ generate (cited spans only) ──▶ answer + source anchors`;

const CONFIG = `# workspace.config.yaml
chunking:
  strategy: <recursive | semantic>      # FILL_ME
  size_tokens: <n>
  overlap_tokens: <n>
embedding:
  model: <model-id>                     # FILL_ME
retrieval:
  hybrid:
    semantic_weight: <0..1>             # FILL_ME
    lexical_weight: <0..1>
  top_k: <n>
  rerank: <true | false>
llm:
  provider: <hosted | self-hosted>      # FILL_ME`;

/** Fill from your eval script output. null renders as an em dash. */
const BENCH: { input: string; recall: number | null; p50: number | null; p95: number | null; tokens: number | null }[] = [
  { input: "PDF, 100 pages", recall: null, p50: null, p95: null, tokens: null },
  { input: "Spreadsheet, 10,000 rows", recall: null, p50: null, p95: null, tokens: null },
  { input: "Mixed workspace, 50 files", recall: null, p50: null, p95: null, tokens: null },
];

const cell = (v: number | null, unit = "") => (v === null ? "—" : `${v}${unit}`);

const API_SNIPPET = `// FILL_ME: match your real endpoint and auth
const res = await fetch("https://<host>/api/query", {
  method: "POST",
  headers: { Authorization: \`Bearer \${process.env.QP_KEY}\`, "Content-Type": "application/json" },
  body: JSON.stringify({
    workspace: "hr",
    question: "How much salary should be deducted from Rahul Sharma?",
  }),
});

const { answer, sources } = await res.json();
// sources[i] -> { file, page | row, snippet, score }`;

const DEPLOY = `$ git clone ${REPO}
$ cp .env.example .env
$ docker compose up        # FILL_ME: only if this exists`;

const FAILURES: { input: string; behaviour: string }[] = [
  { input: "Scanned PDF, no text layer", behaviour: "FILL_ME: falls back to OCR, page flagged as low confidence" },
  { input: "Corrupted or password-protected file", behaviour: "FILL_ME: file marked failed with reason, rest of the batch continues" },
  { input: "Spreadsheet with merged cells or no header row", behaviour: "FILL_ME: header inferred or file rejected with the row number" },
  { input: "Context window exceeded", behaviour: "FILL_ME: top-k reduced, dropped sources listed in the response" },
  { input: "LLM provider rate-limited", behaviour: "FILL_ME: retry with backoff, then return retrieved sources without a generated answer" },
  { input: "No supporting evidence found", behaviour: "FILL_ME: returns no answer instead of guessing" },
];

/* ----------------------------------------------------------- sections ---- */

export function EngineeringSections() {
  return (
    <>
      <Section
        id="architecture"
        title="How a document becomes an answer"
        lede="Two paths: ingestion runs in background workers, queries run against the workspace you select. Chunking, embedding and search weights are configuration, not magic."
      >
        <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
          <Panel name="data-flow" meta="ingest / query">
            <Code>{FLOW}</Code>
          </Panel>
          <Panel name="workspace.config.yaml" meta="per workspace">
            <Code>{CONFIG}</Code>
          </Panel>
        </div>
      </Section>

      <Section
        id="benchmarks"
        title="Measured, and reproducible"
        lede="Numbers come from the evaluation scripts in the repository. Run them against your own documents before you trust ours."
      >
        <Panel name="eval results" meta="see repo for dataset, commit and hardware">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left font-mono text-[12px] tabular-nums">
              <thead>
                <tr className="border-b border-white/10 text-white/45">
                  <th className="px-4 py-2.5 font-normal">Input</th>
                  <th className="px-4 py-2.5 text-right font-normal">Recall@5</th>
                  <th className="px-4 py-2.5 text-right font-normal">p50 latency</th>
                  <th className="px-4 py-2.5 text-right font-normal">p95 latency</th>
                  <th className="px-4 py-2.5 text-right font-normal">Tokens / query</th>
                </tr>
              </thead>
              <tbody className="text-white/75">
                {BENCH.map((r) => (
                  <tr key={r.input} className="border-b border-white/[0.06] last:border-0">
                    <td className="px-4 py-3">{r.input}</td>
                    <td className="px-4 py-3 text-right">{cell(r.recall)}</td>
                    <td className="px-4 py-3 text-right">{cell(r.p50, " ms")}</td>
                    <td className="px-4 py-3 text-right">{cell(r.p95, " ms")}</td>
                    <td className="px-4 py-3 text-right">{cell(r.tokens)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <a
          href={REPO}
          target="_blank"
          rel="noopener noreferrer"
          className="w-fit font-mono text-[12px] text-white/60 underline decoration-white/20 underline-offset-4 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
        >
          Run the evals yourself
        </a>
      </Section>

      <Section
        id="deploy"
        title="Run it where your data lives"
        lede="Self-host the stack, point it at your own model endpoint, and call it from code. Say plainly which requests leave your network."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel name="terminal" meta="self-hosted">
            <Code>{DEPLOY}</Code>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-t border-white/10 p-4 text-[14px] leading-[1.5]">
              <dt className="text-white/45">Data residency</dt>
              <dd className="text-white/75">FILL_ME: where files, vectors and logs are stored</dd>
              <dt className="text-white/45">Third-party calls</dt>
              <dd className="text-white/75">FILL_ME: which providers receive text, and when</dd>
              <dt className="text-white/45">Local models</dt>
              <dd className="text-white/75">FILL_ME: Ollama / vLLM supported or not</dd>
            </dl>
          </Panel>
          <Panel name="query.ts" meta="REST">
            <Code>{API_SNIPPET}</Code>
          </Panel>
        </div>
      </Section>

      <Section
        id="failure-modes"
        title="What happens when it goes wrong"
        lede="Failures are returned with a reason instead of being hidden. This is the behaviour for the cases we hit most."
      >
        <Panel name="failure-modes" meta={`${FAILURES.length} cases`}>
          <table className="w-full border-collapse text-left text-[14px] leading-[1.5]">
            <thead className="sr-only">
              <tr>
                <th>Input</th>
                <th>Behaviour</th>
              </tr>
            </thead>
            <tbody>
              {FAILURES.map((f) => (
                <tr key={f.input} className="border-b border-white/[0.06] align-top last:border-0">
                  <td className="w-[38%] px-4 py-3 font-mono text-[12px] text-white/80">{f.input}</td>
                  <td className="px-4 py-3 text-white/60">{f.behaviour}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </Section>
    </>
  );
}