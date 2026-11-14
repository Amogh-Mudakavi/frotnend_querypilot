"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

import { authApi } from "@/lib/django-api";
import {
  API, AUTH, CARDS, CHAT, CMP, CODE, CROSS, DEPLOY, DIA, ERD, EXPLORER_CSS, FACTS, GRAPH, H3, INGEST, Home, ChapterBanner, Icon, LLMF, NOTE, OL, P, PageNav, RETR, SCOPE, SHIP, SPLIT, SQLF, STEPS, STORAGE, TBL, UL, VIZ, Blocks, hue, to,
} from "@/components/hero/engineering-explorer";
import type { Block, Group, HubItem, Section } from "@/components/hero/engineering-explorer";
import { PixelDissolveButton } from "@/components/pixel-dissolve-button";
import { ButtonFx, PD_COLORS, PD_GHOST, PD_PILL } from "@/components/hero/engineering-explorer";

/* ============================================================================
 * /engineering. A docs site with its own chrome, separate from the landing page.
 *
 *  - Look: near-black canvas, white text, one indigo accent and a few muted section hues used only as small cues.
 *    Monospace for technical labels. Code wraps instead of scrolling sideways. No glows.
 *  - Navbar: unchanged. Logo + "Docs", quick links, search, GitHub and "Go to QueryPilot".
 *  - Sidebar: fixed full-height column. Every section is always visible; "AI & Retrieval" is the one dropdown and
 *    its list scrolls on its own. The current page is the only highlighted row.
 *  - Pages: breadcrumb, section tag, title, lead, meta row. Right rail (wide screens) holds "On this page".
 *  - Steps and split blocks: numbered text on the left, Shiki code on the right.
 *  - One page per chapter: /engineering?c=<id>. Every number on these pages is a value read from the backend code;
 *    nothing is a measurement. Nothing here is a host, ID, bucket, key, port, secret or file path.
 * ========================================================================== */

const GITHUB_URL = "#";
const APP_HREF = "/workspaces";
const LOGIN_HREF = "/login";
const UPDATED = "Nov 2026";

/** `--nav` is the docs navbar height. `.qpx-*` rules make the diagram kit read well at docs width. */
const DOCS_CSS = `
.qpd{--nav:64px;scroll-padding-top:calc(var(--nav) + 28px);background:#0A0A0A;font-family:var(--font-geist-sans),"Geist","Inter",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.qpd ::selection{background:rgba(255,255,255,.2)}
.qpd .qpe-mono,.qpd .qpe-mono code{font-family:var(--font-geist-mono),"Geist Mono",ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace}
.qpd kbd{font-family:var(--font-geist-mono),"Geist Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.qpx-wrap{container-type:inline-size}
.qpx-wrap figure>.grid,.qpx-wrap [class*="min-[900px]:grid-cols-2"],.qpx-wrap [class*="min-[860px]:grid-cols"]{grid-template-columns:minmax(0,1fr)!important}
@container (min-width:760px){
  .qpx-wrap figure>.grid>aside{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr)}
  .qpx-wrap figure>.grid>aside>div:first-child{border-bottom:0;border-right:1px solid rgba(255,255,255,.1)}
}
@container (min-width:880px){
  .qpx-wrap [class*="min-[900px]:grid-cols-2"]{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  .qpx-wrap [class*="min-[860px]:grid-cols"]{grid-template-columns:minmax(0,.8fr) minmax(0,1.3fr) minmax(0,1fr)!important}
}
@media (max-width:640px){
  .qpd h1{overflow-wrap:anywhere}
  .qpd table{font-size:15px}
}
`;

/* ---------------------------------- sections ---------------------------------- */

/** The sections, in sidebar order. "ai" is the only collapsible one. */
const GROUPS: Group[] = [
  { id: "overview", num: "01", name: "Overview", blurb: "System boundaries, request flow and the decisions that shape the product." },
  { id: "architecture", num: "02", name: "Architecture", blurb: "Relational models, storage choices, data ownership, transactions and indexes." },
  { id: "backend", num: "03", name: "Backend", blurb: "Authentication, the API request path, conversation memory and streaming." },
  { id: "ingestion", num: "04", name: "Ingestion", blurb: "Upload, queue, worker, parsing, chunking and embeddings, with the failure and recovery paths." },
  { id: "ai", num: "05", name: "AI & Retrieval", blurb: "Scope Guard, planning, the bounded graph, hybrid retrieval, evidence, structured SQL and model routing." },
  { id: "ops", num: "06", name: "Deployment & Operations", blurb: "Runtime, networking, Docker, delivery, tracing and testing." },
  { id: "reference", num: "07", name: "Reference", blurb: "Every route, limit, setting and term in one place, plus the security model." },
  { id: "roadmap", num: "08", name: "Roadmap", blurb: "Known limitations, next steps and a practical debugging workflow." },
  { id: "development", num: "09", name: "Frontend", blurb: "Frontend and backend integration, design ownership and the browser-side concerns." },
];

/** Page order inside each section. */
const ORDER = [
  "quick-start", "product-architecture",
  "database-architecture-consistency", "workspaces",
  "authentication-token-lifecycle", "api-request-lifecycle", "answers-and-memory",
  "document-ingestion-pipeline",
  "scope-guard", "planner", "execution-graph", "retrieval", "evidence-and-answers", "structured-data", "structured-sql", "llm-routing",
  "deployment-stories", "proxy-and-origins", "docker-and-delivery",
  "api-reference", "limits-and-defaults", "configuration", "security-model", "glossary",
  "known-gaps", "frontend",
];

interface Chapter { id: string; alias?: string[]; group: string; title: string; lead: string; wide?: boolean; sections: Section[] }

/* --------------------------------- content --------------------------------- */

const CHAPTERS: Chapter[] = [
  {
    id: "quick-start", alias: ["overview"], group: "overview", title: "Quick start", wide: true,
    lead: "What QueryPilot is, why it isn't a plain RAG pipeline, and one question worked end to end: tax slabs in one file, a salary in another. Start here, then open any page.",
    sections: [
      { h: "What it is", blocks: [
        P("QueryPilot answers questions over a workspace's own files. A user uploads PDFs, Word documents, Excel sheets and CSVs, asks in chat, and gets an answer written from the passages or table rows that actually contain the facts."),
        P("What it adds is a step between the question and the answer. QueryPilot works out what has to be established, goes to the right place for each piece (document text, or a table), keeps the pieces apart, and only then writes the answer. If a piece is missing, that is recorded instead of guessed."),
        P("Two ideas carry the design. **Text and tables are stored differently**, because a paragraph needs similarity search and a total needs arithmetic. And **the model is never the access rule**: ownership is checked inside the database query, and generated SQL is validated and then run on an account that can't write."),
        FACTS([
          { k: "Backend", v: "Django + DRF", sub: "one project, ASGI under Uvicorn" },
          { k: "Question graph", v: "LangGraph", sub: "agent, dispatch, finish" },
          { k: "Models", v: "Groq · gpt-oss", sub: "20B and 120B, one per task" },
          { k: "Embeddings", v: "mxbai-embed-large-v1", sub: "1024-d, quantized ONNX on CPU" },
          { k: "Parsing", v: "LiteParse + LlamaParse", sub: "PDFs try LiteParse first" },
          { k: "Stores", v: "MySQL · Redis · S3", sub: "plus Chroma (dev) or S3 Vectors (prod)" },
        ]),
      ] },
      { h: "Why a plain RAG pipeline isn't enough", blocks: [
        P("A typical RAG pipeline cuts every file into chunks, embeds them, takes the few chunks nearest to the question and hands them to a model. That works for a question like 'what does the policy say about X'. It breaks when the answer is spread across files, or needs arithmetic."),
        TBL(["The question needs", "A typical RAG pipeline", "QueryPilot"], [
          ["A total, count or average over a sheet", "Spreadsheet rows are embedded as text and the model adds up whichever rows came back, which is wrong once the sheet is bigger than top-K", "Valid tables become real MySQL tables. SQL does the counting and summing, validated and read-only"],
          ["A rule in one file and a value in another", "One search over everything. The chunks that look most similar win, so one of the two pieces is often missing", "The planner names both pieces. Each is fetched from its own source and kept apart until the answer"],
          ["A follow-up such as 'and for Priya?'", "Searched as written, so it finds nothing useful", "A rolling summary and the last ten messages resolve the reference first"],
          ["Nothing from the files, like a greeting", "Still runs a search and answers from whatever came back", "Scope Guard routes it away before any retrieval"],
          ["Someone else's document", "Usually a filter added on top", "Ownership is inside the query, and the backend's allow-list decides, never the model"],
          ["A piece that isn't in the files", "The model fills the gap fluently", "The gap is recorded as missing, and the answer model is told to say so"],
        ]),
        NOTE("note", "A design comparison, not a benchmark", "This table describes how the two approaches are built. No accuracy or speed numbers are claimed, because none were measured. Open gaps are on [Known gaps](c:known-gaps)."),
      ] },
      { h: "A worked example: tax slabs and salary", blocks: [
        P("A workspace holds two files. `tax_slabs.pdf` is a policy document that lists the tax slabs. `salaries.xlsx` is a sheet with one row per employee. The numbers below are made up for the example and are not real tax law."),
        CMP("How much income tax does Rahul owe this year?", [
          { tag: "Typical RAG", title: "Search, then hope", good: false, verdict: "Wrong or incomplete: the rule and the record were never brought together.", lines: [
            "The question is embedded and the nearest chunks are pulled from both files, mixed together.",
            "A paragraph about slabs comes back. Rahul's row may not, because a spreadsheet row rarely looks like the question.",
            "The model has the rule but not the salary, so it asks for one or guesses a figure.",
          ] },
          { tag: "QueryPilot", title: "Find each piece, then calculate", good: true, verdict: "Right and traceable: the rule is from the PDF, the salary is from the sheet.", lines: [
            "Scope Guard sends it to the documents. The planner splits it into three pieces: the slab rule, Rahul's salary and the calculation.",
            "Hybrid search finds the slab passage in the PDF. A read-only SQL query reads Rahul's salary from the sheet.",
            "Both are kept apart as evidence, each with its source, and checked against what the planner asked for.",
            "The answer is written from that evidence, slab by slab, using the figure from the sheet.",
          ] },
        ]),
        STEPS([
          { title: "Route the question",
            text: ["Scope Guard sees a question that needs uploaded content, so the route is `DOCUMENT`. The document ids it suggests are checked against the backend's own allow-list, so the model never decides what the user can reach."],
            code: [{ label: "Classifier output", file: "illustrative", code: `{
  "route": "DOCUMENT",
  "deliverable": "number",
  "relevant_document_ids": [3, 5],
  "reason": "needs a rule from one file and a value from another"
}` }] },
          { title: "Split it into requirements",
            text: ["The planner doesn't search and doesn't calculate. It lists what has to be established, and which piece depends on which.", "R3 can't be answered until R1 and R2 are, so it depends on both."],
            code: [{ label: "Requirements", plain: true, file: "illustrative", code: `R1  kind=text    type=rule      the tax slabs and their rates
R2  kind=table   type=numeric   Rahul's annual salary
R3  kind=either  type=other     tax payable on R2 under R1
    depends_on: R1, R2` }] },
          { title: "Fetch the rule and the record",
            text: ["R1 is text, so it goes through hybrid search: dense and BM25 run side by side and their ranks are merged. The slab passage comes back from `tax_slabs.pdf`.", "R2 is a table, so the table selector picks the salary table, SQL is generated and validated, and it runs on the read-only connection. The salary comes back as one row."],
            code: [
              { label: "Slab passage", plain: true, file: "tax_slabs.pdf, p.2 (made-up numbers)", code: `Tax is charged slab by slab.
Up to 3,00,000         nil
3,00,001 to 7,00,000   5%
7,00,001 to 10,00,000  10%
10,00,001 to 15,00,000 15%` },
              { label: "Read-only SQL", file: "illustrative, not a fixed output", code: `SELECT CAST(Annual_Salary AS DECIMAL(14,2)) AS annual_salary
FROM selected_salaries
WHERE Name = %s;

-- params, bound separately: ["Rahul"]
-- runs on structured_read, validated first, 100-row cap` },
            ] },
          { title: "Keep the two kinds of evidence apart",
            text: ["The rule came from text and the amount came from a row. Both are normalised into one shape but keep their source, and each is tied to the requirement it answers. A requirement with no evidence is recorded as missing."],
            code: [{ label: "Evidence", plain: true, file: "shape", code: `R1  1 chunk   tax_slabs.pdf, p.2
R2  1 row     salaries.xlsx, Rahul: 12,00,000
R3  needs R1 and R2
missing: none` }] },
          { title: "Write the answer",
            text: ["The answer model gets the question, the requirements and the evidence. It applies the slabs to the salary and shows the working, streamed to the browser as it is written."],
            code: [{ label: "Answer", plain: true, file: "made-up numbers", code: `12,00,000 is taxed slab by slab
  first 3,00,000          nil           0
  next  4,00,000 at 5%               20,000
  next  3,00,000 at 10%              30,000
  last  2,00,000 at 15%              30,000
Tax payable: 80,000` }] },
        ]),
        NOTE("warn", "If a piece is missing", "Suppose `tax_slabs.pdf` was never uploaded. R1 finds no evidence, so it is recorded as missing and the answer model is told to say the rule wasn't found instead of inventing a rate. That is the design intent, not a guarantee; see [Evidence and answers](c:evidence-and-answers)."),
      ] },
      { h: "One message, start to finish", blocks: [
        P("Thirteen stages in four groups. Each stage lists what it checks, in order, next to the shape of what it works with. Two of the checks can be made to fail, to show exactly where a request stops."),
        VIZ("flow"),
        NOTE("note", "Read this as the designed flow", "This page follows the architecture. Exact middleware, database writes and fallback behaviour are covered on each component's page."),
      ] },
      { h: "Run the two processes", blocks: [
        P("The API and the worker are one image with two commands. Redis is the only thing between them, and it carries job ids, nothing else."),
        CODE({ label: "Processes", term: true, file: "Terminal", code: `# API: ASGI server
uvicorn config.asgi:application

# worker: same image, different command
python manage.py ingestion_worker` }),
        P("No hosts, keys or ports appear anywhere in these docs. Configuration comes from the environment; the setting names are on [Configuration](c:configuration)."),
      ] },
      { h: "Where to go next", blocks: [
        CARDS([
          { title: "Follow a question", text: "Scope Guard, Planner, Execution graph, Retrieval, then Evidence and answers.", to: "scope-guard", tag: "AI / LLM" },
          { title: "See where data lives", text: "Database architecture, the relational model, ingestion and structured tables.", to: "database-architecture-consistency", tag: "Architecture" },
          { title: "Call the API", text: "Every route with its method, auth requirement and behaviour, plus the SSE events.", to: "api-reference", tag: "Reference" },
          { title: "Run it for real", text: "Accounts and login, limits, configuration, deployment and known gaps.", to: "limits-and-defaults", tag: "Reference" },
        ]),
      ] },
    ],
  },

  {
    id: "product-architecture", group: "overview", title: "Product architecture",
    lead: "How the product is put together: the layers, the apps inside the backend, the two paths data takes, and the decisions that shape the rest of these docs.",
    sections: [
      { h: "The shape of it", blocks: [
        P("[Quick start](c:quick-start) covers what QueryPilot does and why it differs from a plain RAG pipeline. This page is the map of how it is built."),
        P("There is one Django backend and one frontend on its own origin. Everything else is that backend arranged around five stores and two kinds of work: slow work at upload, and fast work at question time."),
      ] },
      { h: "Architecture at a glance", blocks: [
        VIZ("build"),
        P("Pick a scene: the whole architecture, the upload path or the question path. Three things are worth noticing. Redis carries only a job id, and job status lives in MySQL, so a lost message can be recovered. The ingestion worker is the only writer into the structured database. The question pipeline reaches that database only through a read-only connection."),
      ] },
      { h: "Layers", blocks: [
        TBL(["Layer", "Role", "Read more"], [
          ["Frontend", "Next.js on Vercel. Sign-in, workspaces, uploads and chat, on its own origin", "[Frontend and ownership](c:frontend)"],
          ["Edge", "Nginx terminates HTTPS and forwards to Django. Buffering and timeouts are set for streaming", "[Nginx, HTTPS and origins](c:proxy-and-origins)"],
          ["API", "Django REST. JWT auth, ownership checks, upload and the streaming chat endpoint", "[Accounts and login](c:authentication-token-lifecycle)"],
          ["Question pipeline", "Scope Guard, planner and a bounded graph of three nodes", "[Scope Guard](c:scope-guard), [Planner](c:planner), [Execution graph](c:execution-graph)"],
          ["Ingestion", "A separate worker that parses, chunks, embeds and extracts tables", "[Document ingestion](c:document-ingestion-pipeline)"],
          ["Data", "Five stores, each chosen for one access pattern", "[Database architecture](c:database-architecture-consistency)"],
          ["Delivery", "One Docker image for the API and the worker, on EC2, with RDS and S3", "[Docker and delivery](c:docker-and-delivery)"],
        ]),
      ] },
      { h: "Backend layout", blocks: [
        P("Django apps inside one project, not separate services."),
        TBL(["App", "Responsibility"], [
          ["`accounts`", "Sign-up, login, tokens, Google sign-in"],
          ["`workspace`", "Workspaces and ownership"],
          ["`documents`", "Uploads, file status, ingestion jobs, the worker"],
          ["`chat`", "Conversations, messages, memory, the streaming endpoint"],
          ["`retrieval`", "Dense search, BM25, fusion, reranking"],
          ["`planner`", "Routing, planning, graph execution, table selection, the SQL tool"],
          ["`llm`", "Which model and key handles which task, retries, usage recording"],
          ["`utils`", "Redis, email, auth and timing helpers"],
        ]),
      ] },
      { h: "Two paths through the system", blocks: [
        TBL(["", "Upload path", "Question path"], [
          ["Starts with", "A file upload", "A chat message"],
          ["Runs in", "The API request, then the ingestion worker", "The API request, in one streamed response"],
          ["Why it is shaped this way", "Parsing and embedding are slow, so the request only validates and queues", "The user is waiting, so progress and tokens stream as they are produced"],
          ["Writes to", "Object storage, primary MySQL, vector store, structured MySQL", "Primary MySQL: messages and memory"],
          ["Reads from", "The uploaded file", "Vector store, structured MySQL (read-only), conversation memory"],
          ["When it goes wrong", "Retries up to three times, then cleans up what it half wrote", "Bounded by a tool-call budget, a recovery budget, a 60-second execution deadline and a 90-second request budget"],
        ]),
      ] },
      { h: "Which route a question takes", blocks: [
        TBL(["Question", "Path"], [
          ["What is the refund window after cancelling?", "Scope Guard, planner, document search"],
          ["How many orders were delivered?", "Planner, table selection, generated SQL, read-only run"],
          ["Which delivered orders qualify for a refund?", "Both: policy text for the rule, SQL for the records"],
          ["What happened to the one we discussed?", "Conversation memory resolves the reference, then one of the above"],
          ["Hi / what's the weather today?", "Scope Guard answers or declines, no retrieval"],
        ]),
      ] },
      { h: "Decisions that shape the design", blocks: [
        TBL(["Decision", "Why", "What it costs"], [
          ["Separate worker process", "A long ingestion never blocks a login", "Delivery isn't exactly-once, so jobs are claimed under a row lock and recovered from MySQL"],
          ["Tables go to MySQL, not the vector store", "Counts and sums need arithmetic, not nearest neighbours", "Every column is `TEXT`, so generated SQL has to cast"],
          ["The planner describes, it doesn't write", "SQL generation is its own step that can be validated and repaired", "More steps per question"],
          ["Two locks on SQL", "Validation, then a database account that can't write", "Two things to keep correct"],
          ["Ownership inside the query", "A guessed id returns nothing instead of another user's data", "The owner filter has to be in every query"],
          ["A bounded graph, not an open agent", "A hard question can't loop indefinitely", "A question that needs more ends at the budget"],
          ["One LLM key per task", "A heavy step in one lane doesn't use up another's allowance", "No automatic failover between keys; retries stay on the same key"],
        ]),
      ] },
      { h: "Multi-tenancy in practice", blocks: [
        P("A multi-tenant application serves data belonging to different users or workspaces. The question isn't only whether a request is authenticated, but whether its caller owns the specific object being requested. That is why every read path carries tenant scope: object-level authorisation, least privilege and allow-lists."),
      ] },
      { h: "Trust boundaries", blocks: [
        UL([
          "**Workspace and creator.** Documents, tables and retrieval filters hang off one workspace, and conversations are looked up by the user who created them. Ownership is checked on every request.",
          "**Allow-list.** Document ids returned by Scope Guard are checked against the backend's own list. The model's output is never the access rule.",
          "**SQL.** Generated SQL is untrusted. It is validated, then run on a read-only connection.",
          "**Tokens.** Passwords, OTPs and refresh tokens are stored hashed. Access tokens last 15 minutes.",
        ]),
        VIZ("isolation"),
        NOTE("warn", "What this page doesn't claim", "Nothing here is a measured figure. There are no throughput, latency or accuracy numbers yet, and the deployment is not claimed to be highly available or zero-downtime. Open gaps are on the [Known gaps](c:known-gaps) page; the consolidated view is on [Security model](c:security-model)."),
      ] },
    ],
  },

  {
    id: "database-architecture-consistency", group: "architecture", title: "Database architecture",
    lead: "Five stores, each chosen for one access pattern: lookup by id, by meaning, by exact value, and by arithmetic. No single store covers all four.",
    sections: [
      { h: "Why it isn't one database", blocks: [
        P("Each kind of data is read differently. Accounts, documents and jobs need constraints and transactions. Passages need nearest-neighbour search. Spreadsheet rows need filtering and aggregation. Ingestion needs a queue. The planner needs compact summaries of each document. One engine for all of it would suit at least one of those jobs poorly, so each store handles one job."),
      ] },
      { h: "Storage layout", blocks: [
        DIA(STORAGE, "Database architecture"),
        P("Three processes on the left, the stores they use on the right. Edge labels are connection aliases or intent. The ingestion worker holds the only write path into the structured database, and the planner's SQL tool only uses `structured_read`."),
      ] },
      { h: "What lives where", blocks: [
        TBL(["Store", "Holds", "Not used for"], [
          ["Primary MySQL (`default`)", "Accounts, tokens, workspaces, documents, ingestion jobs, conversations, messages, memory", "Rows from uploaded files"],
          ["Structured MySQL (`structured`, `structured_read`)", "One physical table per validated extracted table", "Application records"],
          ["Vector storage", "Text chunks with embeddings, document profiles", "Users, chats, table rows"],
          ["Redis", "Job queue, cache, rate-limit counters (login, OTP, chat questions)", "Job status (that's MySQL)"],
          ["Object storage", "Original uploaded files", "Anything derived"],
        ]),
      ] },
      { h: "Primary and structured are different databases", blocks: [
        P("Same engine, separate connections. The structured database receives DDL at ingestion time, one `CREATE TABLE` per extracted table, which doesn't belong in a schema managed by Django migrations. Separating it also lets the read connection use credentials that cannot write."),
        P("One document produces several artifacts, each stored differently: the original file in object storage, text as chunks and embeddings in the vector store, valid tables as physical MySQL tables, and a compact summary in the profile index."),
      ] },
      { h: "Vector storage", blocks: [
        P("ChromaDB in development and AWS S3 Vectors in production, selected by the `VECTOR_BACKEND` setting (`chroma` or `s3`). Chroma is only accepted when `DEBUG` is on; production must use `s3`. It holds two things: embedded text chunks (workspace, document, page, heading and chunk type as metadata) and document profiles (title, section headings and previews, table titles, columns and row counts)."),
        P("Table rows are not embedded. A sum can't be recovered from nearest-neighbour hits, so rows stay in MySQL and only a description of each table goes into the profile index."),
      ] },
      { h: "Redis and job state", blocks: [
        P("Redis carries job ids, cache and rate-limit counters. Job status is authoritative in MySQL, and the job id is published to Redis only after the database transaction commits. If a worker dies or a queue message is lost, recovery reads MySQL, finds pending or stale jobs and queues them again."),
        NOTE("note", "Legacy naming", "The structured-data helper is still called `SQLiteManager` and one field is `sqlite_table_name`, from the first version. The backend is MySQL."),
      ] },
      { h: "Relational modelling", blocks: [
        P("Users own workspaces, a workspace contains documents and conversations, and a conversation contains messages. Primary keys, foreign keys and unique and check constraints state those relationships explicitly, along with one-to-many and one-to-one links, join tables, cascade behaviour and nullable foreign keys."),
        P("A unique constraint on `(workspace, file_hash)` is stronger than checking for a duplicate in application code alone: the database enforces the rule even when two requests arrive close together."),
      ] },
      { h: "Transactions and concurrency", blocks: [
        P("A transaction groups changes so they commit together or roll back together. A document and its ingestion job are created together, and the job is published after the commit so a worker can't race ahead of an uncommitted record. Isolation levels, row locks, deadlocks and race conditions are the failure modes that design has to account for."),
        P("A row lock protects the operation that claims a pending job. It doesn't make the whole queue exactly-once; it coordinates competing workers around the authoritative database state."),
      ] },
      { h: "Choose storage by access pattern", blocks: [
        TBL(["Storage type", "Good fit", "Why it is separate here"], [
          ["Relational database", "Identity, relationships, transactions and constraints", "Application records and structured table rows"],
          ["Object storage", "Large original files addressed as objects", "Keeps uploaded PDFs and spreadsheets out of relational rows"],
          ["Vector index", "Nearest-neighbour search over embeddings", "Finds semantically related text chunks"],
          ["Cache", "Short-lived values that can be recomputed", "Avoids repeated work for selected lookups"],
          ["Queue", "Signals that work should be processed", "Hands ingestion job ids to workers"],
        ]),
      ] },
      { h: "Indexes and consistency", blocks: [
        P("B-tree and composite indexes speed up reads at the cost of slower writes, so not every column is indexed; a unique constraint usually creates an index of its own. The vector index and the object store are derived representations: the application database stays authoritative for ownership and job state."),
      ] },
      { h: "Storage scenarios to walk through", blocks: [
        OL(["Draw the User, Workspace and Document relationship with primary and foreign keys.", "Explain why a unique constraint is needed even when the API checks for duplicates.", "Describe what `transaction.atomic()` protects and what it does not protect.", "Compare a cache, queue, vector index and relational database.", "Explain why a vector similarity score cannot replace SQL aggregation."]),
      ] },
    ],
  },

  {
    id: "workspaces", alias: ["relational-model"], group: "architecture", title: "Relational model",
    lead: "The application schema as Django models: accounts, workspaces, documents, ingestion jobs and chat. The workspace is the isolation boundary.",
    sections: [
      { h: "Entity relationships", blocks: [
        DIA(ERD, "Relational model"),
        P("Solid boxes are models the runtime depends on. Dashed boxes exist in the schema but are not the source of truth for anything the pipeline does today (see the end of this page)."),
      ] },
      { h: "Accounts", blocks: [
        P("`User` is the identity. `RefreshToken` is N:1 to it, since rotation produces many rows per user over time. `GoogleIdentity` is 1:1 and `OAuthLoginCode` is N:1. `EmailOTP` and `PendingRegistration` have no foreign key to `User` because the user doesn't exist yet when they are written; they are matched by email."),
      ] },
      { h: "Workspace as the boundary", blocks: [
        P("A user owns many workspaces and each workspace has one owner. Documents, extracted tables and retrieval filters hang off a workspace, and the document routes check the workspace owner inside the query. Conversations belong to a workspace too, and the chat routes look them up by the user who created them. Either way the check is part of the query, so a guessed id returns nothing."),
      ] },
      { h: "Documents and jobs", blocks: [
        P("`Document` carries workspace, an optional `uploaded_by` user, title, original file, source type, SHA-256 file hash, status and timestamps. A unique constraint on (workspace, file hash) rejects the same file uploaded twice into one workspace."),
        TBL(["Model", "Status flow"], [
          ["`Document`", "pending, processing, then ready or failed"],
          ["`IngestionJob`", "pending, processing, then completed or failed (with an attempts counter)"],
        ]),
        P("Status is kept separately on each because the document is the uploaded resource while the job is the operation, and a job can retry while its document is still processing."),
      ] },
      { h: "Chat models", blocks: [
        TBL(["Model", "Role"], [
          ["`Conversation`", "One chat session. Belongs to a workspace and records its creator"],
          ["`Message`", "User, assistant or system message: conversation, role, content, metadata, created time"],
          ["`ConversationSettings`", "1:1 with a conversation. Memory-enabled and citations-enabled flags"],
          ["`ConversationMemory`", "1:1 with a conversation. Rolling summary and a checkpoint for the last summarised message"],
          ["`ConversationDocument`", "Join of conversation and document, unique per pair, at most 3 per conversation. The model exists; there is no public attach or detach endpoint today"],
        ]),
        NOTE("warn", "Models that aren't the source of truth", "`WorkspaceTable` and `DocumentMetadata` are in the schema, but the live table catalogue is read from MySQL `information_schema`, and `DocumentProfileBuilder` writes profiles through the vector layer. The pipeline does not populate either model as authoritative metadata."),
      ] },
    ],
  },

  {
    id: "authentication-token-lifecycle", group: "backend", title: "Accounts and login", wide: true,
    lead: "Custom JWT auth with email-verified sign-up, rotating refresh tokens and Google sign-in. Passwords, OTPs and refresh tokens are stored hashed.",
    sections: [
      { h: "From sign-up to a session", blocks: [
        P("Four steps from an email address to a rotating session. The code panels are simplified sketches of each step, not the exact source."),
        STEPS([
          { title: "Register without creating a user",
            text: ["Registration doesn't create a `User`. It writes a `PendingRegistration` (hashed password) and an `EmailOTP` (hashed code) keyed by email, and mails a six-digit code.", "OTPs expire after 10 minutes by default. Verification attempts are capped at 5, a resend has a 60-second cooldown, and each email may request 3 codes an hour and each IP 10. This doesn't make guessing impossible; it makes it slow and rate-limited. A resend has its own endpoint."],
            code: [{ label: "Register", file: "register.py (simplified sketch)", code: `def register(email, password):
    validate(email, password)
    PendingRegistration.objects.update_or_create(
        email=email, defaults={"password_hash": hash_password(password)})
    code = random_digits(6)
    EmailOTP.objects.create(email=email, code_hash=hash_code(code),
                            expires_at=now() + timedelta(minutes=10))
    send_email(email, code)        # no User row exists yet` }] },
          { title: "Verify the code",
            text: ["The `User` is created when a correct code arrives. The OTP is marked used and the pending row is removed, so a code works once."],
            code: [{ label: "Verify", file: "verify.py (simplified sketch)", code: `def verify(email, code):
    pending = PendingRegistration.objects.get(email=email)
    otp = latest_otp(email)            # unexpired, unused, attempts under the cap
    if not matches(code, otp.code_hash):
        otp.attempts += 1
        otp.save()
        raise Rejected
    with transaction.atomic():
        user = User.objects.create(email=email, password=pending.password_hash)
        otp.used = True
        otp.save()
        pending.delete()` }] },
          { title: "Log in",
            text: ["Login is rate limited per email (10 attempts) and per IP (30) inside a 15-minute window, then checks the password and returns two tokens. The access JWT carries the user id, email and a token type, lasts 15 minutes and is not stored. The refresh JWT carries the user id, a token type and a unique id, lasts 7 days, and only its SHA-256 hash is stored."],
            code: [{ label: "Login", file: "login.py (simplified sketch)", code: `def login(email, password):
    user = check_password(email, password)
    access = encode({"user_id": user.id, "email": user.email,
                     "type": "access"}, minutes=15)                    # HS256
    refresh = encode({"user_id": user.id, "type": "refresh",
                      "jti": new_id()}, days=7)
    RefreshToken.objects.create(user=user, token_hash=sha256(refresh))
    return access, refresh` }] },
          { title: "Refresh and rotate",
            text: ["Refreshing decodes the JWT, looks up the hashed `RefreshToken`, checks user, expiry and revocation, revokes it and issues a new pair. Presenting a revoked token again counts as reuse and revokes the user's remaining valid refresh tokens. This is refresh-token rotation, not API-key rotation."],
            code: [{ label: "Rotation", file: "refresh.py (simplified sketch)", code: `def refresh(raw_token):
    decode(raw_token)                              # signature + expiry
    row = RefreshToken.objects.get(hash=sha256(raw_token))
    if row.revoked:                                # reuse looks like theft
        revoke_all(row.user)
        raise Unauthorized
    row.revoked = True
    row.save()
    return issue_pair(row.user)                    # new hash stored` }] },
        ]),
      ] },
      { h: "Tokens and rotation", blocks: [
        DIA(AUTH, "Registration, login and refresh rotation"),
        TBL(["Token", "Lifetime", "Stored"], [
          ["Access JWT (HS256, user id + email + token type)", "15 minutes", "Not stored"],
          ["Refresh JWT (user id + token type + unique id)", "7 days", "SHA-256 hash in `RefreshToken`"],
        ]),
        P("Both lifetimes are settings (`ACCESS_TOKEN_LIFETIME_MINUTES`, `REFRESH_TOKEN_LIFETIME_DAYS`); the values above are the defaults. Every limit on this page is listed together on [Limits and defaults](c:limits-and-defaults)."),
      ] },
      { h: "Google sign-in and password reset", blocks: [
        P("The backend generates and verifies a one-time `state` (valid for 10 minutes), verifies Google's ID token, and links accounts through Google's stable account id in `GoogleIdentity` (1:1 with `User`), not through email. The browser gets a one-time `OAuthLoginCode`, valid for 2 minutes, that it exchanges for the normal token pair."),
        P("Password reset is two calls, `forgot-password` and `reset-password`. The first returns the same response whether or not the email exists, and a successful reset revokes the user's refresh tokens."),
        NOTE("warn", "What logout doesn't do", "Logout revokes refresh tokens. An access token already issued stays valid until it expires (at most 15 minutes) because there is no blocklist. This keeps the request path stateless."),
      ] },
      { h: "Passwords, tokens and sessions", blocks: [
        P("Passwords are stored hashed, and the right tool for that is a slow, salted password-hashing function, not reversible encryption or plain SHA-256. JWTs are signed claims, not encrypted secrets: a valid signature shows that the trusted signer issued the token, and the backend still checks expiry, token type and the user's status."),
        P("Access JWTs are stateless while refresh tokens are tracked server-side and rotated. That is why logout can revoke a refresh token while an already-issued access token stays valid until it expires, and why Google sign-in is a separate identity flow from the application's own API session."),
      ] },
      { h: "Auth scenarios to walk through", blocks: [
        OL(["Explain how a password differs from a JWT and from a refresh token.", "Describe refresh-token rotation and the effect of revoking a token.", "Explain why CORS is not an authorisation mechanism.", "Trace a request through middleware, authentication, permission, serializer and view.", "Compare SSE with WebSockets and give a suitable use case for each."]),
      ] },
    ],
  },

  {
    id: "answers-and-memory", group: "backend", title: "Memory and streaming",
    lead: "A rolling summary plus the latest ten messages for context, a per-user question limit, and Server-Sent Events for the live answer.",
    sections: [
      { h: "Conversation memory", blocks: [
        DIA(CHAT, "One chat request"),
        P("Original messages are stored in MySQL. For longer chats a rolling summary covers older messages and the latest ten are loaded as written. A checkpoint records the last message already summarised, so nothing is summarised twice. The summary is updated in the background after the answer is sent, and if the summary model fails the chat carries on without it."),
        P("Sending the full history on every request would grow the prompt each turn. The summary keeps context at a fixed size: it is capped at 6,000 characters, and each message fed into it at 3,000."),
        NOTE("note", "Memory is context, not evidence", "Memory resolves references like 'that order'. The facts still have to come from the documents or tables."),
      ] },
      { h: "Streaming", blocks: [
        SPLIT(
          ["Chat uses Server-Sent Events: Django's `StreamingHttpResponse` with a `text/event-stream` response. It is an ordinary HTTP response held open that pushes events one way. It is not WebSockets and not Channels. Each event is `event: <name>` plus a JSON `data:` line.", "Request lifecycle:"],
          [{ label: "Stream", file: "event names as emitted", code: `event: query_received
event: conversation_loaded
event: agent_started
event: planning
event: generating_answer
event: answer_delta
data: {"message": "Refunds are"}

event: complete
data: {"message": "Request completed.",
       "data": {"answer": "...", "error_code": "",
                "conversation_title": "..."}}` }],
          ["The user's message is saved.", "Conversation context is loaded.", "Scope Guard classifies the request.", "The planner and dispatch run if the route needs them.", "Progress events are emitted while that happens.", "Answer generation starts and `answer_delta` events stream the text.", "The completed assistant message is persisted, then `complete` is sent with the answer, an error code (empty on success) and the conversation title."],
        ),
        TBL(["Event", "Meaning"], [
          ["`query_received`", "The message was accepted and saved"],
          ["`conversation_loaded`", "Context for the conversation is ready"],
          ["`agent_started`", "The planner graph has begun"],
          ["`planning`", "Progress while the plan is built and tools run"],
          ["`generating_answer`", "Evidence is collected; the answer is being written"],
          ["`answer_delta`", "A piece of the answer text"],
          ["`complete`", "The final event: the answer, an error code and the conversation title, plus source information"],
          ["`error`", "The request failed. The message is generic (\"We couldn't complete this request.\") and carries no internals"],
        ]),
        NOTE("warn", "citations_enabled", "The flag is read in the current execution path but does not change citation output, so it is not a working inline-citation toggle. Source info in the response metadata comes from the collected evidence."),
      ] },
      { h: "Question limit", blocks: [
        P("Each user may ask 50 questions; the 51st is rejected and starts a 2-hour cooldown. The counter lives in Redis and is checked before any model is called, so a rejected question costs no tokens. A rejected request still returns HTTP 200 with a single `complete` event whose data says `rate_limited` and `retry_after_seconds: 7200`, so the browser handles it like any other stream."),
      ] },
      { h: "Proxy hints", blocks: [
        P("The streaming response sets `Cache-Control: no-cache` and `X-Accel-Buffering: no`, which tells Nginx not to buffer the stream. The sync execution generator is exposed to Django's ASGI handler through an async iterator, so each event is flushed as soon as it is produced instead of waiting for the end."),
      ] },
    ],
  },

  {
    id: "api-request-lifecycle", group: "backend", title: "API request lifecycle",
    lead: "The backend exposes a small set of REST resource groups. Authentication identifies the caller; ownership checks decide which workspace, document or conversation that caller can reach.",
    sections: [
      { h: "Route map", blocks: [
        P("The API is organised by resource rather than by frontend screen. Each Django app owns its URL routes and views, while the project-level URL configuration mounts those route groups under `/api/`. Every route is listed with its method on [API reference](c:api-reference)."),
        TBL(["Route group", "What it exposes"], [
          ["`/api/auth/`", "Registration, resend, OTP verification, login, refresh, logout, current-user lookup, forgot and reset password, and Google OAuth"],
          ["`/api/workspaces/`", "List, create, update, delete and workspace settings"],
          ["`/api/documents/`", "Upload, list, status lookup and delete"],
          ["`/api/chat/`", "Conversation list/create, conversation detail/settings and streamed messages"],
        ]),
        NOTE("note", "One Django project", "These route groups are Django applications inside one backend project. They are not separate network services."),
      ] },
      { h: "What happens to a protected request", blocks: [
        STEPS([
          { title: "Resolve the route", text: ["Django matches the method and URL to a view. The view belongs to the app responsible for that resource."] },
          { title: "Authenticate the caller", text: ["The REST framework is configured to use the custom JWT authentication class and `IsAuthenticated` as its default permission. Authentication endpoints are the deliberate exception because a user must be able to register or log in before having a token."] },
          { title: "Validate request data", text: ["Serializers and view-level checks validate fields, identifiers, file types and other request constraints before the operation runs. Authentication answers who is calling; validation answers whether the submitted data has an acceptable shape."] },
          { title: "Apply ownership scope", text: ["Workspace, document and conversation lookups are constrained by the authenticated user. A client-supplied id is only a locator; it does not grant permission to read or modify that record."] },
          { title: "Perform the operation", text: ["The view reads or writes the relevant MySQL records, stores an uploaded file, queues ingestion, or starts chat execution. Long-running ingestion is handed to the worker instead of being completed inside the upload request."] },
          { title: "Return the response", text: ["Most endpoints return a normal API response. The chat stream endpoint returns an SSE response and keeps the HTTP connection open while events are produced."] },
        ]),
      ] },
      { h: "The access-control boundary", blocks: [
        P("A workspace id, document id or conversation id can appear in a URL or request body, but the backend must still prove that it belongs to the caller. The important check is not whether the id exists; it is whether the authenticated user is allowed to reach the object through its ownership relationship."),
        P("This is why frontend route hiding is not a security control. A user can edit a request outside the browser UI. The backend repeats the ownership check regardless of how the request was created."),
        NOTE("warn", "Do not treat CORS as authorisation", "CORS controls which browser origins can read cross-origin responses. It does not prove user identity and does not replace JWT authentication or database-level ownership filters."),
      ] },
      { h: "Streaming is a separate response shape", blocks: [
        P("The chat endpoint is not a normal JSON response that happens to arrive slowly. It uses `StreamingHttpResponse` with `Content-Type: text/event-stream`. The frontend reads events from an HTTP response that stays open until the request completes or fails. Validation errors (a blank message, a missing conversation) still come back as ordinary JSON 400 and 404 responses."),
        CODE({ label: "Endpoint", file: "Route registered by chat/urls.py", code: `POST /api/chat/messages/stream/\n\nContent-Type: application/json\nAccept: text/event-stream` }),
        P("This matters when debugging the browser integration and reverse proxy. JSON endpoints can be buffered and completed normally; an SSE response needs the connection to remain open and the proxy must not hold all events until the end."),
      ] },
      { h: "HTTP request basics", blocks: [
        P("The browser sends a request with a method, path, headers and sometimes a body. The backend authenticates it, validates the input, performs an operation and returns a status code, headers and a response body. A request and a connection are different things: an SSE request deliberately keeps one HTTP response open for a stream of events."),
        TBL(["Concept", "How it applies here"], [
          ["HTTP methods", "GET, POST, PUT, PATCH and DELETE; which operations are safe or idempotent decides what a client may retry"],
          ["Status codes", "2xx success, 3xx redirects, 4xx client or request failures and 5xx server failures"],
          ["Headers", "Authorization, Content-Type, Accept, Origin and cache-related headers"],
          ["Origin", "Scheme + host + port; why a separately hosted frontend is cross-origin"],
        ]),
      ] },
      { h: "Idempotency and the Django request path", blocks: [
        P("Resource-oriented URLs, explicit methods, status codes, request validation and consistent errors keep the API predictable. Repeating a request shouldn't create duplicate side effects. Where an operation isn't naturally idempotent, a database uniqueness rule can protect it; upload does this with the unique constraint on workspace and file hash."),
        P("A request passes URL resolution, middleware, the view, DRF authentication and permissions, serializers, ORM querysets, transactions and the response renderer. A serializer validates incoming and outgoing data; it does not replace access-control checks on the queryset."),
        P("For streaming, SSE is one-way server-to-client delivery over HTTP, while WebSockets open a bidirectional connection. The chat endpoint uses SSE."),
      ] },
      { h: "Security mechanisms compared", blocks: [
        TBL(["Mechanism", "Question it answers"], [
          ["CORS", "May JavaScript running at this origin read the cross-origin response?"],
          ["CSRF protection", "Can another site cause a browser to submit an authenticated cookie-based state-changing request?"],
          ["JWT authentication", "Does this request carry a valid application token for a user?"],
          ["Ownership checks", "Is this user allowed to access this specific workspace or record?"],
          ["TLS", "Is traffic protected while moving across the network?"],
        ]),
        P("These mechanisms solve different problems. Enabling CORS does not authenticate a user, and HTTPS does not decide whether the caller owns a document."),
      ] },
      { h: "Request scenarios to walk through", blocks: [
        OL(["Trace a protected GET request from browser to Django view and back.", "Explain the difference between authentication and authorisation using a workspace id as an example.", "Describe why a file upload can return before parsing has completed.", "Explain what happens if a worker receives the same job id twice.", "Compare JSON request/response with a long-lived SSE response."]),
      ] },
    ],
  },

  {
    id: "document-ingestion-pipeline", alias: ["background-jobs-concurrency", "reading-documents"], group: "ingestion", title: "Document ingestion", wide: true,
    lead: "Upload returns quickly. A separate worker process parses, chunks, embeds and extracts tables, claims jobs under a row lock, and recovers from crashes with heartbeats.",
    sections: [
      { h: "Pipeline", blocks: [
        P("Parsing and embedding take far longer than a request should, so the request only validates and records. A worker consumes the job from a Redis queue. Redis carries only the job id; MySQL stays the source of truth."),
        DIA(INGEST, "Ingestion and storage fan-out"),
      ] },
      { h: "Why upload returns before parsing", blocks: [
        P("A synchronous request waits for the work to finish. That suits a quick database lookup but not parsing a large document and embedding every chunk, so the upload request records the document and job and a worker does the expensive part after the commit."),
        P("The queue is a producer and consumer pair with job state, retries, backoff and idempotency around it. Delivery is at-least-once, so the same job id can arrive twice. A queue message is a signal to process a job; it isn't the permanent record of whether that job succeeded. That record is the job row in MySQL."),
      ] },
      { h: "What the upload request checks", blocks: [
        P("The upload endpoint rejects a bad file before anything is stored. Checks run in this order, and the limits are the values the backend enforces."),
        TBL(["Check", "Rule"], [
          ["Workspace", "The workspace must exist and belong to the caller"],
          ["File type", "`.pdf`, `.docx`, `.xlsx` or `.csv` only"],
          ["Size", "At most 50 MB"],
          ["Format check", "PDFs, spreadsheets, Word files and CSVs each get a format validation; `.docx` and `.xlsx` are zip archives, so the archive is also bounded (at most 250 MB uncompressed, 10,000 members, and a 1000x compression ratio) to stop zip bombs"],
          ["Duplicate", "The same SHA-256 in the same workspace returns 200 with `duplicate: true` and the existing document, instead of a second copy. A duplicate of a *failed* document is cleaned up (vectors, tables, file, row) and re-uploaded"],
          ["Document limit", "At most 3 documents per workspace; failed documents don't count"],
        ]),
        P("A successful upload answers 202 with the document id, the job id and status `pending`. A document can't be deleted while it is `pending` or `processing` (the delete endpoint answers 409)."),
      ] },
      { h: "What the worker does", blocks: [
        STEPS([
          { title: "Validate and record", text: ["The request checks the workspace owner, computes a SHA-256 of the file, handles duplicates (unique on workspace + hash) and enforces the three-document limit. `Document` and `IngestionJob` are created together."],
            code: [{ label: "Upload", file: "views.py (simplified sketch)", code: `def upload(request, workspace_id):
    ws = get_owned_workspace(request.user, workspace_id)
    digest = sha256(request.file)
    existing = ws.documents.filter(file_hash=digest).first()
    if existing and existing.status != "failed":
        return Response({"duplicate": True, ...}, 200)
    if existing:
        clean_up(existing)             # vectors, tables, file, row
    if ws.documents.exclude(status="failed").count() >= 3:
        raise Rejected("Maximum 3 documents allowed per workspace.")
    doc = Document.objects.create(workspace=ws, file_hash=digest, status="pending")
    job = IngestionJob.objects.create(document=doc, status="pending")
    transaction.on_commit(lambda: publish_job(job.id))   # after the commit
    return Response({"document_id": doc.id}, 202)` }] },
          { title: "Publish after commit", text: ["The job id goes onto the Redis queue only once the transaction has committed (`transaction.on_commit`). Publishing earlier risks a worker picking up a job that doesn't exist yet."] },
          { title: "Claim the job", text: ["The worker is a management command that blocks on the queue and runs jobs on a thread pool (3 by default). Claiming takes a row lock so two workers can't take the same job. While a job runs, the worker writes a heartbeat every 30 seconds; a job with no heartbeat for 30 minutes counts as stale and is requeued by a recovery pass that runs every 30 seconds. Every one of those numbers is a setting."],
            code: [{ label: "Claim", file: "claim_job.py (simplified sketch)", code: `with transaction.atomic():
    job = (IngestionJob.objects
           .select_for_update()
           .filter(id=job_id, status="pending")
           .first())
    if job is None:
        return                 # another worker has it
    job.status = "processing"
    job.save()` }] },
          { title: "Parse", text: ["PDFs go to LiteParse first and fall back to LlamaParse if it fails. Every other supported format uses LlamaParse. The output is normalised into one shape, text nodes with headings and pages plus table nodes, so later stages don't depend on which parser ran.", "Parsing is the weakest stage. A messy layout produces messy chunks, and nothing downstream repairs that."] },
          { title: "Split text from tables", text: ["A PDF mixes paragraphs, headings, page furniture, lists, real tables and things that only look like tables. Each table is validated. CSV and XLSX are treated as datasets with their own checks; PDF and DOCX tables get stricter checks because parsers often mistake layout for tables.", "A table that passes becomes a physical MySQL table. One that doesn't is turned into labelled text and follows the normal text path."],
            code: [{ label: "Routing", file: "shape of the decision", code: `if table.is_valid_dataset():
    create_physical_table(structured, table)    # SQL path
else:
    text = label_rows(table)    # 'Status: Processed | Order ID: ORD-1024'
    chunks += chunk(text)       # embedded like any other text` }] },
          { title: "Chunk", text: ["`StructureAwareChunker` detects headings (markdown, numbered and ALL-CAPS), keeps section boundaries, splits by paragraph and then by sentence only when needed, and tracks pages. Target size is about 500 tokens (estimated at 4 characters per token) with two sentences of overlap. Every chunk keeps its heading, because a paragraph often doesn't say what it is about but the heading above it does."] },
          { title: "Embed and index", text: ["`mixedbread-ai/mxbai-embed-large-v1` through Sentence Transformers: quantized ONNX on CPU, normalised, 1024 dimensions. Chunks are written to the vector index with their metadata. Similarity is a signal, not a guarantee that a chunk is relevant."],
            code: [{ label: "Chunk metadata", file: "shape", code: `{
  "workspace_id": 12,
  "document_id": 34,
  "chunk_type": "text",
  "page": 3,
  "heading": "Refund eligibility",
  "text": "..."
}` }] },
          { title: "Build the profile", text: ["`DocumentProfileBuilder` writes a compact profile: title, section headings with short previews, table titles, columns and row counts. It goes to the vector profile index, and the planner uses it to decide which documents are worth searching before it searches them."] },
          { title: "Finish or retry", text: ["On success the document becomes ready. A failure retries, up to three times. On a terminal failure the half-written vectors and tables are cleaned up so nothing is left orphaned."] },
        ]),
      ] },
      { h: "Job states", blocks: [
        VIZ("pool"),
        P("The status endpoint returns the document status, and, when a job exists, its id, its status and its attempt count. That is what a frontend polls instead of guessing from elapsed time."),
        NOTE("warn", "Not exactly-once", "Redis alone doesn't give exactly-once delivery. Claiming under a row lock, with job state in MySQL, prevents duplicate work and allows stuck jobs to be recovered."),
      ] },
      { h: "Idempotency, locks and recovery", blocks: [
        P("A worker may crash after doing part of a job but before recording completion, and the queue may then deliver the same job again. Idempotent processing means repeating a step leaves no duplicate or conflicting output. The pieces that make it work are row locks, unique keys, heartbeats, stale-job detection and cleanup of partially written artifacts."),
        P("A row lock isn't exactly-once delivery. It stops two workers from claiming the same row at the same time; recovery and cleanup are still needed for work that fails halfway through."),
      ] },
      { h: "Parsing and chunk trade-offs", blocks: [
        P("Document parsing turns a file layout into structured elements. A PDF is a visual canvas, so reading order, columns, headers, footers and tables aren't always explicit. A parser can return text in the wrong order or mistake a layout block for a table, which is why table validation sits downstream."),
        P("Chunk boundaries, heading context and overlap trade precision against context. Small chunks match precisely but can lose context; large chunks keep more context but admit irrelevant text and use more of the prompt."),
      ] },
      { h: "Embeddings are derived data", blocks: [
        P("An embedding maps text to a fixed-length vector, and similarity search compares vectors to find candidate passages. The index is a derived search structure, not the original document. Cosine similarity, normalisation and dimensions are fixed by the model, so changing the embedding model normally means re-embedding stored content."),
      ] },
      { h: "Ingestion scenarios to walk through", blocks: [
        OL(["Describe the producer, queue and worker flow.", "Explain at-least-once delivery and why a job handler should be idempotent.", "Explain what happens if a worker crashes after writing vectors but before marking a job complete.", "Compare small chunks, large chunks and overlapping chunks.", "Explain why parser output needs validation before it becomes searchable data."]),
      ] },
    ],
  },

  {
    id: "retrieval", group: "ai", title: "Retrieval",
    lead: "Dense and lexical search run side by side, results are merged by rank, and the top five go forward as evidence.",
    sections: [
      { h: "Hybrid search", blocks: [
        P("Text questions go through this path; not every question does. Dense search handles paraphrase and misses exact strings, and BM25 does the reverse. They fail in different places, so both run."),
        DIA(RETR, "Hybrid retrieval"),
        TBL(["Setting", "Value"], [
          ["Dense candidates", "20"],
          ["BM25 candidates", "20"],
          ["RRF constant", "60"],
          ["Final top-K", "5"],
          ["Cross-encoder", "Optional, off unless `RETRIEVAL_RERANKER_ENABLED` is true; up to 60 candidates"],
        ]),
      ] },
      { h: "Dense retrieval", blocks: [
        P("The query is embedded with the same model used at ingestion, the vector store returns the nearest chunks with metadata, and workspace and document scope is applied. 'Can a customer receive money back after cancelling?' can match 'Refund eligibility following cancellation' with almost no shared words."),
      ] },
      { h: "BM25", blocks: [
        P("Lexical scoring on the actual terms. It covers what embeddings blur: invoice ids, product names, specific terminology and numbers. The implementation is fielded, with a different weight per field: content 1.0, heading 0.8, title 0.3. A paragraph can be generic while its heading names the subject, so headings carry weight. The weights are starting values, not tuned results."),
      ] },
      { h: "Rank fusion and reranking", blocks: [
        SPLIT(
          ["The two scores aren't comparable, so Reciprocal Rank Fusion uses rank positions only. A chunk ranked high in both lists rises.", "Duplicates are removed. An optional cross-encoder (`cross-encoder/mmarco-mMiniLMv2-L12-H384-v1` by default, overridable) can then reorder candidates by reading the query and each candidate together, with document title and heading as context. It is slower, which is why it is configurable. If it fails, the RRF order is kept."],
          [{ label: "RRF", file: "rrf.py (simplified sketch)", code: `def rrf(rankings, k=60):
    score = {}
    for ranking in rankings:                    # one list per searcher
        for rank, cid in enumerate(ranking, start=1):
            score[cid] = score.get(cid, 0) + 1 / (k + rank)
    return sorted(score, key=score.get, reverse=True)[:5]` }],
        ),
      ] },
      { h: "Exact keys and full reads", blocks: [
        UL([
          "`search_evidence_by_keys` handles stable identifiers (invoice number, employee id, SKU, reference code) by matching them exactly after normalisation. It adds to meaning search rather than replacing it.",
          "`fetch_document_chunks` returns a document's chunks in reading order, for exhaustive questions such as 'summarise all cancellation conditions', where top-K would miss things. Not every question loads every chunk.",
        ]),
      ] },
      { h: "Safety and failure", blocks: [
        P("Search is filtered by workspace and allowed document ids, and returned candidates are validated again afterwards. The text search asks for text evidence only, so table data doesn't compete with paragraphs. If dense retrieval fails and BM25 succeeds, lexical results are still used and the status is marked degraded."),
        NOTE("note", "Confidence is a heuristic", "Retrieval confidence is a weighted blend of the best dense similarity (0.60), lexical support (0.25) and agreement between the two searchers (0.15). It is a rough signal of match strength, not the probability that the final answer is correct, and is not presented that way."),
      ] },
      { h: "Design trade-offs", blocks: [
        TBL(["Part", "What it decides here"], [
          ["Embedding space", "Text is mapped to vectors and compared by cosine similarity on normalised vectors, so nearest neighbours are candidates, not proof of relevance"],
          ["BM25", "Term frequency, inverse document frequency and length normalisation, with field weights so a heading can outweigh a generic paragraph"],
          ["Reciprocal Rank Fusion", "Ranks from different retrievers are combined because raw dense and lexical scores aren't comparable"],
          ["Cross-encoder reranking", "A query and a candidate are scored together, which costs more than a vector lookup and is why it is optional"],
          ["Recall@K and Precision@K", "How retrieval would be evaluated: whether relevant chunks are retrieved and whether the top results are useful. Not measured yet"],
          ["Chunking", "Chunk size, heading context and overlap trade recall, precision and prompt size against each other"],
        ]),
        NOTE("note", "Tracing one query", "The dense retriever, fielded BM25, RRF fusion and the optional reranker are separate stages. Following one query through all four is the quickest way to see where a result was gained or lost."),
      ] },
    ],
  },

  {
    id: "evidence-and-answers", group: "ai", title: "Evidence and answers",
    lead: "Collected evidence is normalised and tied back to requirements before the answer model sees it. Rules and recorded values stay distinguishable.",
    sections: [
      { h: "Questions that need two sources", blocks: [
        P("'Calculate the refund payable using the cancellation policy and the order records.' The policy defines eligibility, percentages and deductions; the order table holds amounts, dates and ids. The planner names both sources, the selector finds the tables, document search finds the policy text, and the SQL tool pulls the records. A cross-document join service can connect structured evidence from different files on shared keys."),
        DIA(CROSS, "Policy evidence and record evidence"),
        P("This is not an unrestricted join across every table. Selected tables and source ids stay inside the authorised workspace scope. Rules are never produced by SQL and order amounts are never inferred from a paragraph, so the two kinds of evidence stay separate."),
      ] },
      { h: "Evidence assembly", blocks: [
        P("Retrieved material is not passed to the answer model as one block. The backend normalises document and structured evidence into a common shape, keeps source and table identity, associates evidence with requirements, handles duplicate or overlapping table results, tracks retrieval paths that failed or came back incomplete, adds a note when a required rule or source was not found, and keeps evidence and citation metadata in sync."),
        P("The answer model needs to know where each fact came from: the refund rule from a policy paragraph, the amount from a table, the customer id that joined them. Conversation memory is not treated as evidence."),
      ] },
      { h: "Answer generation", blocks: [
        P("Planning identifies what is needed, dispatch collects it, and a separate step writes the response. The generator receives the effective question, document evidence, structured results, the planner's requirements, relevant conversation history and source information. It is instructed to stay inside the evidence, to say so when evidence is incomplete, and to explain a conflict instead of silently choosing a value."),
        NOTE("warn", "What this doesn't guarantee", "This is evidence-grounded generation. It is not hallucination-proof, answers don't pass through a separate verification model, and missing evidence is not automatically repaired in every case."),
      ] },
      { h: "Model configuration", blocks: [
        P("LLM configuration is per task. Planning and Scope Guard, table selection with SQL generation, and final answers each use their own provider key, so a heavy step in one lane doesn't use up another's allowance. There is no rotation or automatic failover between keys; retries stay on the same key. The model, output ceiling and timeout for every task are on [LLM routing](c:llm-routing)."),
      ] },
      { h: "Provenance, rules and records", blocks: [
        P("Each claim in an answer has to be supported by the source attached to it. A retrieved passage is not automatically proof of every claim, so the wording of the claim must match what that source says. Evidence provenance, requirement coverage and source attribution are what the backend tracks for that reason; context precision and context recall are the measures to use once there is a labelled set."),
        P("For mixed questions, applying a business rule and retrieving a recorded value are different operations. A policy paragraph can define the refund rule; a structured row supplies the order amount. The final explanation keeps those sources distinguishable."),
      ] },
    ],
  },

  {
    id: "structured-data", group: "ai", title: "Structured data",
    lead: "Spreadsheets and real tables inside documents become MySQL tables, so counts and sums are computed by SQL instead of estimated from retrieved rows.",
    sections: [
      { h: "Why tables aren't chunked", blocks: [
        P("Take a document containing this table, and the question: how much revenue came from delivered orders?"),
        TBL(["Order ID", "Status", "Amount"], [["ORD-101", "Delivered", "450"], ["ORD-102", "Cancelled", "250"], ["ORD-103", "Delivered", "700"]]),
        P("This is not a similarity problem. The system has to pick the table, filter on status and sum a column. Embedding rows would return the top-k most similar rows and the model would add up whatever came back, which is wrong once the table is larger than k. Valid tables are therefore stored as tables and queried with SQL."),
      ] },
      { h: "Three connections", blocks: [
        TBL(["Alias", "Used by", "Can do"], [
          ["`default`", "Django ORM", "Application data"],
          ["`structured`", "Ingestion worker", "Create tables, insert rows"],
          ["`structured_read`", "Planner SQL tool", "Read-only credentials"],
        ]),
        P("The read/write split is enforced by the database account, not only by code. Generated SQL runs on `structured_read`, so even if validation missed something the connection could not change data."),
      ] },
      { h: "Creating a table", blocks: [
        P("`TableProcessor` takes an extracted table through these steps:"),
        OL(["Extract the header row.", "Normalise column names.", "Remove duplicate header names.", "Normalise row values.", "Validate the structure.", "Create the physical MySQL table.", "Insert the rows."]),
        P("Every column is `TEXT`. There is no type inference at write time, so a messy spreadsheet can't produce a mis-typed column. Numeric or categorical traits are discovered later from the actual rows during schema inspection. The cost is that generated SQL has to cast, which is a real limitation."),
      ] },
      { h: "Naming and metadata", blocks: [
        SPLIT(
          ["Each table name encodes workspace, source document and table index, so a table can always be traced to its document, and one document can yield several tables.", "The table comment carries compact JSON, so the registry can learn what a table is without relying on the name."],
          [
            { label: "Table name", plain: true, file: "schematic", code: `ws_<workspace_id>_doc_<document_id>_table_<index>` },
            { label: "Table comment", file: "shape of the JSON", code: `{
  "title": "Orders",
  "sheet": "Sheet1",
  "heading": "Order register",
  "context": "text near the table in the source",
  "page": 3
}` },
          ],
        ),
      ] },
      { h: "Schema registry", blocks: [
        P("The planner can't rely on a Django model listing every table, because tables are created dynamically. The registry asks MySQL itself."),
        OL(["Start from the workspace id.", "List the workspace's tables from `information_schema` (only names with the `ws_<id>_` prefix are considered).", "Map each table to its document through the name.", "Read column names.", "Build a light table index: name, document, title, columns."]),
        P("Details are loaded lazily, only for the few tables the selector picks: row count, numeric columns and small samples of categorical values. A request-scoped `WorkspaceResources` object shares what has been loaded across planning and dispatch so nothing is fetched twice."),
        NOTE("note", "Not the Django model", "The live catalogue is `information_schema`. `WorkspaceTable` exists but isn't what the planner reads."),
      ] },
    ],
  },

  {
    id: "structured-sql", group: "ai", title: "Table selection and SQL",
    lead: "Three separate steps: choose the tables, generate SQL for them, validate and run it read-only. Generated SQL is treated as untrusted input.",
    sections: [
      { h: "Three steps, not one", blocks: [
        P("The planner doesn't write SQL. Table selection and SQL generation are separate operations because choosing the right table in a workspace and writing a correct query over it fail differently and need different fixes."),
        DIA(SQLF, "From planner output to a read-only result"),
      ] },
      { h: "Table selection", blocks: [
        P("A workspace can have many tables and one document can produce several. The selector receives table names, descriptions, column names, relevant sample values, row counts, the query understanding and the required fields, and assigns each chosen table one or more of five roles:"),
        TBL(["Role", "Meaning"], [
          ["`output`", "Holds the values being asked for"],
          ["`filter`", "Holds fields used to restrict records"],
          ["`input`", "Holds values needed in a calculation"],
          ["`rule`", "Holds a rate, threshold or condition"],
          ["`key`", "Holds identifiers that connect tables"],
        ]),
        P("Two more outputs are lists, not roles: **computed** values (derived from other data, so there is no table for them; the selector picks the tables for their inputs and rules instead) and **unmet** fields (information it couldn't find in the candidate schemas)."),
        P("The selector aims for a minimal set: a question about delivery status shouldn't read unrelated sales or employee tables in the same workspace. Explicitly named tables and resolved entity locations are kept as authoritative candidates within the authorised sources. If selection finds no safe match, it does not widen to every table; it can fall back to document-text retrieval where that makes sense."),
      ] },
      { h: "SQL generation", blocks: [
        SPLIT(
          ["The generator receives the effective query, the selected table schema, requested fields, resolved entities, the operation, population or calculation requirements, planner notes and, for one bounded repair, the previous failed attempt.", "It returns structured output: whether SQL is needed, the query, and the parameters. Values are supplied separately from the statement.", "The `CAST` is there because columns are stored as `TEXT`. Ranking questions get an explicit `ORDER BY` on the cast measure and a `LIMIT` that matches the number asked for."],
          [
            { label: "Query", file: "illustrative, not a fixed output", code: `SELECT SUM(CAST(Amount AS DECIMAL(12,2))) AS total_amount
FROM selected_orders
WHERE Status = %s;` },
            { label: "Params", file: "bound separately", code: `["Delivered"]` },
          ],
        ),
      ] },
      { h: "Validation and execution", blocks: [
        VIZ("locks"),
        TBL(["Rule", "Why"], [
          ["Only `SELECT` or `WITH`", "Reading only"],
          ["One statement", "Nothing appended after the query"],
          ["No comments", "Comments can hide parts of a statement"],
          ["No DML, DDL, admin or `REPLACE INTO`", "Nothing can be changed (insert, update, delete, create, drop, alter, truncate, rename, grant, revoke, call, execute and similar are all refused)"],
          ["No locking reads", "`FOR UPDATE`, `FOR SHARE` and `LOCK IN SHARE MODE` can't block other work"],
          ["No file operations", "`OUTFILE` and `DUMPFILE` are refused, so the database can't write server files"],
          ["Tables must be in the permitted workspace set", "No reading another workspace's data"],
          ["Identifiers validated, parameters bound separately", "Values can't become code"],
          ["Session execution timeout, 100-row cap", "No runaway queries"],
          ["`structured_read` connection", "A second lock if validation misses something"],
        ]),
        SPLIT(
          ["Validation runs before execution, and a failed rule rejects the statement. Statements that pass run on `structured_read` with a per-session `max_execution_time`."],
          [{ label: "Validator", file: "sql_guard.py (simplified sketch)", code: `def check(sql, allowed_tables):
    s = sql.strip().rstrip(";")
    if not s.lower().startswith(("select", "with")):
        raise Rejected("read only")
    if ";" in s or "--" in s or "/*" in s:
        raise Rejected("one statement, no comments")
    if tables_in(s) - allowed_tables:
        raise Rejected("not this workspace's tables")
    return s          # then run on structured_read` }],
        ),
        NOTE("warn", "Two independent locks", "Application-level validation and a database account that can't write protect against different failures. Neither is treated as sufficient alone, and the SQL tool never touches the primary application database."),
      ] },
      { h: "Types, NULL and casting", blocks: [
        P("Extracted table columns are stored as `TEXT`, and SQL still has to calculate over numeric values, so generated queries cast explicitly. `DECIMAL` rather than `FLOAT` for money, date parsing, empty strings versus NULL, invalid numeric values and the way a database handles a failed cast all matter here."),
        NOTE("note", "A real limitation", "Text storage makes ingestion flexible, but it moves type interpretation into query time. It isn't equivalent to a strongly typed schema inferred and validated at ingestion."),
      ] },
      { h: "Query semantics the generator has to get right", blocks: [
        P("Filtering happens before aggregation with `WHERE` and after it with `HAVING`, and `COUNT`, `SUM`, `AVG`, `MIN` and `MAX` behave differently when NULL values are present. Joins matter too: an `INNER JOIN` or `LEFT JOIN` can multiply rows when the key isn't unique, so a total after a join is only trustworthy once the relationship is known to be one-to-one, one-to-many or many-to-many."),
      ] },
      { h: "Safety in depth", blocks: [
        P("Generated SQL is untrusted input. Values are bound as parameters, identifiers are validated, the account is read-only and statements have a timeout and a row cap. Binding a value doesn't make an arbitrary table name safe; identifiers need their own validation."),
        P("A `SELECT` can still be expensive, so read-only doesn't automatically mean harmless. Query-plan cost is the reason for the execution timeout and the 100-row cap."),
      ] },
      { h: "SQL scenarios to walk through", blocks: [
        OL(["Write a grouped count by status and explain `WHERE` versus `HAVING`.", "Explain why a one-to-many join can inflate a `SUM`.", "Explain why a column stored as `TEXT` needs casting before numeric aggregation.", "Show the difference between a bound value and a table identifier.", "Explain why a read-only database account is useful even when the application validates SQL."]),
      ] },
    ],
  },

  {
    id: "scope-guard", group: "ai", title: "Scope Guard",
    lead: "A routing step that runs before the planner. It decides whether a message should reach document retrieval at all.",
    sections: [
      { h: "Why it exists", blocks: [
        P("Without it, a greeting triggers a document search, and a question unrelated to the uploaded data gets an answer assembled from whatever the search returned. Classifying the request first avoids both."),
        DIA(SCOPE, "Scope Guard routing"),
      ] },
      { h: "Rules first, model second", blocks: [
        SPLIT(
          ["Obvious cases are handled deterministically: greetings, clear out-of-scope requests, questions about QueryPilot itself.", "Everything else goes to an LLM classifier (the 20B model, capped at 500 output tokens). It receives the current query, bounded conversation history, the workspace document catalogue and the allowed document ids, and returns structured JSON."],
          [{ label: "Classifier output", file: "illustrative", code: `{
  "target": "document",
  "deliverable": "number",
  "threat_category": "none",
  "route": "DOCUMENT",
  "relevant_document_ids": [12],
  "reason": "asks for a count over an uploaded sheet"
}` }],
        ),
        TBL(["Route", "Responsibility"], [
          ["`DOCUMENT`", "Needs uploaded document or table content; goes on to the planner"],
          ["`WORKSPACE`", "Questions about what's in the workspace"],
          ["`CONVERSATION`", "Questions about earlier chat"],
          ["`PRODUCT`", "Public information about QueryPilot"],
          ["`CHITCHAT`", "Small talk"],
          ["`OUT`", "Outside the corpus, or protected and internal requests"],
          ["`CLARIFY`", "Unresolved intent or reference; ask back"],
        ]),
        P("Not every route ends in document retrieval. Chit-chat, out-of-scope and clarify requests never trigger it. A rule-based `OUT` is only honoured when the workspace has no documents it could belong to; otherwise the message goes to the classifier."),
      ] },
      { h: "Where the security boundary is", blocks: [
        NOTE("warn", "The classifier is not the access rule", "The classifier returns relevant document ids, but the backend keeps its own allowed-document list derived from the conversation's real access scope and validates the returned ids against it. The planner and retrieval keep using that authorised scope. Ownership and allow-lists are the boundary, not the model's output."),
      ] },
      { h: "Routing decisions", blocks: [
        P("Routing is an intent-classification problem with two failure modes. A router that sends too many requests into retrieval wastes work; one that rejects valid questions blocks useful behaviour. That is why obvious cases are decided by rules and only the ambiguous ones reach a classifier."),
        P("The security reasoning is least privilege and tenant isolation, with prompt injection and untrusted model output assumed. Scope Guard can suggest relevant documents, but backend-derived allowed ids remain the access boundary, and a model's classification is never an authorisation decision."),
      ] },
    ],
  },

  {
    id: "planner", group: "ai", title: "Planner",
    lead: "The planner turns a question into a structured description of what has to be established. It doesn't write the answer and it doesn't write SQL.",
    sections: [
      { h: "Inputs", blocks: [
        P("The original question, an effective planning query, the workspace id, authorised document ids, the documents Scope Guard marked relevant, bounded conversation history and the workspace catalogue."),
        P("The effective query matters for follow-ups. After 'Show me the number of cancelled orders', the message 'Now calculate the total amount' means nothing on its own. Context resolves the subject while the user's current wording stays available. The full history is not sent each time."),
      ] },
      { h: "Query understanding", blocks: [
        SPLIT(
          ["The planner returns JSON validated against a schema, so the backend can resolve references and build a plan from fields instead of parsing prose."],
          [{ label: "Understanding", file: "illustrative", code: `{
  "category_hint": "mixed",
  "operation": "calculate",
  "references": [{ "kind": "source", "text": "cancellation policy" }],
  "requested_fields": ["refund_amount"],
  "data_sources_needed": ["orders.xlsx"],
  "needs_instance_data": true,
  "requirements": [ ... ],
  "reason": "rule in a policy plus amounts in an orders table"
}` }],
        ),
        TBL(["Field", "Meaning"], [
          ["`category_hint`", "`metadata`, `structured`, `document`, `mixed`, `conversation` or `product`"],
          ["`operation`", "`describe`, `lookup`, `aggregate`, `calculate`, `filter`, `compare`, `list`, `overview` or `answer`"],
          ["`references`", "Documents, tables, sheets or entities named explicitly"],
          ["`requested_fields`", "Values or attributes being asked for"],
          ["`data_sources_needed`", "Other workspace sources the answer depends on"],
          ["`needs_instance_data`", "Whether actual records are needed"],
          ["`requirements`", "The individual pieces of evidence needed"],
          ["`reason`", "Short explanation of the classification"],
        ]),
      ] },
      { h: "Requirements, not search terms", blocks: [
        SPLIT(
          ["'Calculate the refund payable for each customer according to the cancellation policy' needs several separate facts: the cancellation conditions (a rule, from text), each customer's cancellation date and order value (records, from a table), the applicable refund percentage (a rule), and the calculation, which depends on the others.", "Each requirement describes a fact to establish, not a query string."],
          [{ label: "Requirement", file: "one entry of requirements[]", code: `{
  "id": "R1",
  "kind": "text",
  "type": "rule",
  "description": "Find the applicable cancellation conditions",
  "queries": ["Cancellation eligibility and refund conditions"],
  "entities": [],
  "depends_on": []
}` }],
        ),
        TBL(["Field", "Values"], [
          ["`kind`", "`text` (from document text), `table` (from structured records), `either`"],
          ["`type`", "`rule`, `fact`, `numeric`, `entity`, `status`, `date`, `comparison`, `other`"],
          ["`depends_on`", "Real dependencies between requirements. Validated so they can't be circular"],
        ]),
        P("Requirements are normalised and bounded: up to 12, with up to three retrieval queries each (500 characters at most per query). The raw user query is also kept as an independent retrieval fallback, so planner-generated sub-queries never fully replace what the user asked."),
      ] },
      { h: "Reference resolution", blocks: [
        P("Names are resolved before anything runs, against the workspace catalogue, table metadata and entity-resolution services. The resolver separates source references from entities. In 'Find Rahul's salary in salary.xlsx', `salary.xlsx` is a source, `Rahul` is an entity and salary is the requested attribute."),
        P("If several matches remain, the system asks for clarification instead of picking one. A phrase like 'that second spreadsheet' is only resolved against earlier context when the reference is clear enough."),
      ] },
      { h: "Supporting sources", blocks: [
        P("A question can name a policy document while needing records from another file: 'Did these orders satisfy the cancellation policy?'. `data_sources_needed` carries the second source. The backend resolves those titles against the authorised catalogue and never trusts a model-generated name that isn't in it. Without this, a mixed question gets answered from the first document it mentions."),
      ] },
      { h: "Execution plan", blocks: [
        P("The model supplies meaning and requirements; the backend builds the execution plan from them, the resolved references and the shape of the sources. A plan is a set of capabilities, plus fallback capabilities to try if the first path comes back empty, and a question uses only the ones it needs."),
        TBL(["Capability", "Purpose"], [
          ["`DOCUMENT_SEARCH`", "Retrieve relevant document text"],
          ["`TABLE_QUERY`", "Run structured-data operations"],
          ["`SOURCE_METADATA`", "Inspect available documents and table metadata"],
          ["`CONVERSATION_MEMORY`", "Retrieve conversational context"],
          ["`PRODUCT_KNOWLEDGE`", "Retrieve supported product information"],
        ]),
        P("A document question is `DOCUMENT_SEARCH`, a numbers question is `TABLE_QUERY`, a policy-plus-records calculation is both, and a catalogue question is `SOURCE_METADATA`. At this point nothing has been answered; the system has only decided what has to happen."),
      ] },
      { h: "Design choices", blocks: [
        TBL(["Technique", "Role in the planner"], [
          ["Query decomposition", "A multi-part question becomes separate facts that must be established"],
          ["Structured output", "A validated schema lets the backend inspect fields instead of parsing free-form prose"],
          ["Dependency graph", "A calculation can depend on a rule and records that must be found first"],
          ["Entity resolution", "Names, ids and source titles are resolved against the workspace catalogue"],
          ["Capability routing", "A plan selects only the retrieval or data operations that question requires"],
        ]),
        NOTE("note", "A worked example", "Take a question that needs a policy, a table and a calculation. Its requirements are the rule, the records and the calculation; the calculation depends on the other two, and each one maps to one tool."),
      ] },
    ],
  },

  {
    id: "execution-graph", group: "ai", title: "Execution graph",
    lead: "A LangGraph StateGraph with three nodes: agent, dispatch, finish. Execution is bounded, not an open-ended agent loop.",
    sections: [
      { h: "The graph", blocks: [
        DIA(GRAPH, "agent, dispatch, finish"),
        SPLIT(
          ["`agent` is the entry point. A conditional edge after it sends the flow to `dispatch` when data is needed, or straight to `finish` when it isn't. `dispatch` always continues to `finish`, and `finish` ends the graph."],
          [{ label: "Graph", file: "graph.py (simplified sketch)", code: `graph = StateGraph(AgentState)
graph.add_node("agent", agent_node)
graph.add_node("dispatch", dispatch_node)
graph.add_node("finish", finish_node)
graph.set_entry_point("agent")
graph.add_conditional_edges("agent", route_after_agent,
                            {"dispatch": "dispatch", "finish": "finish"})
graph.add_edge("dispatch", "finish")
graph.add_edge("finish", END)` }],
        ),
      ] },
      { h: "What each node owns", blocks: [
        TBL(["Node", "Responsibility"], [
          ["`agent`", "Reads the query and context, builds the structured understanding, validates requirements, resolves references and entities, finds supporting sources, builds the execution plan, applies the Scope Guard route"],
          ["`dispatch`", "Runs the plan: document retrieval, table selection, SQL generation and execution, source metadata, conversation memory, cross-document evidence, recovery and fallback paths, evidence normalisation"],
          ["`finish`", "Takes the evidence and requirements and calls answer generation"],
        ]),
        P("If the plan needs no data (a catalogue question, say) the agent can go straight to `finish`."),
      ] },
      { h: "Shared state and limits", blocks: [
        P("`AgentState` carries what later stages need without re-deriving it: the question and planning query, workspace id, relevant and allowed document ids, understanding, requirements, resolved references, execution plan, evidence, tool history, table scope, error state, recovery counters and the final answer. Workspace and document scope stay in the state throughout."),
        TBL(["Limit", "Value"], [
          ["Tool calls per question", "12"],
          ["Recovery attempts", "2"],
          ["Agent execution deadline", "60 seconds"],
          ["Whole request budget", "90 seconds"],
          ["Requirements per question", "12"],
        ]),
        P("These bounds mean a hard question can't send dispatch into an endless loop. When one is reached, the request ends with what was collected and an error code instead of continuing."),
        NOTE("note", "Not an autonomous agent", "Each node has a fixed responsibility and the planner chooses tools per request. No question uses all of them, and nothing here claims open-ended autonomy."),
      ] },
      { h: "Bounded execution", blocks: [
        P("The graph is a finite-state machine: a directed graph with conditional edges and shared execution state, so the possible transitions are explicit. The agent node plans, dispatch runs the selected operations and finish produces the response. It isn't an unconstrained loop."),
        P("The bounds are tool-call budgets, deadlines, retry policies, recovery attempts and cancellation. A retry addresses a recoverable failure; it shouldn't repeat an expensive operation indefinitely or silently widen the data scope."),
      ] },
    ],
  },

  {
    id: "llm-routing", group: "ai", title: "LLM routing",
    lead: "Which model runs each task, with which output ceiling and API-key lane, and how failures are retried. The backend has no token scheduler and no key rotation: the provider enforces rate limits.",
    sections: [
      { h: "Tasks, models and key lanes", blocks: [
        P("Every logical task has one profile: a model, a completion ceiling (reasoning tokens count against it), a per-attempt timeout and a reasoning effort. Every task is pinned to exactly one of three Groq API keys, and a key is never borrowed by another task."),
        DIA(LLMF, "Tasks, key lanes and provider"),
        TBL(["Task", "Model", "Max tokens", "Timeout", "Reasoning", "Key"], [
          ["Scope Guard", "gpt-oss-20b", "500", "20 s", "default", "1"],
          ["Chitchat", "gpt-oss-20b", "500", "20 s", "low", "1"],
          ["Title", "gpt-oss-20b", "200", "20 s", "low", "1"],
          ["Planner", "gpt-oss-120b", "3,400", "40 s", "low", "1"],
          ["Table selection", "gpt-oss-120b (fallback gpt-oss-20b)", "2,200", "20 s", "low", "2"],
          ["SQL generation", "gpt-oss-120b", "2,600", "20 s", "low", "2"],
          ["Answer generation", "gpt-oss-120b", "up to 4,000", "40 s", "low", "3"],
        ]),
        NOTE("note", "Model names are configuration", "The model names above are the values in the task profiles at the time of writing. They live in one configuration file, so changing a model is a one-line change."),
      ] },
      { h: "Answer length", blocks: [
        P("Answer generation sizes its output to the question. A normal answer is capped at 2,000 tokens, an arithmetic answer at 2,600 and a multi-step answer at 3,200. The ceiling for any answer is 4,000, and that ceiling also bounds the single retry the backend makes when a response is cut off by length."),
        P("If the provider rejects a request because input plus output would exceed its limit, the backend lowers the output ceiling by the exact excess the provider reports (plus a small margin), but only when what remains is still a usable completion (at least 1,500 tokens) for a reasoning model."),
      ] },
      { h: "Retries and failure", blocks: [
        TBL(["Failure", "Retries", "Behaviour"], [
          ["Rate limit (429)", "0", "Surfaced immediately. No other key is tried"],
          ["Authentication", "0", "Surfaced immediately"],
          ["Timeout", "1", "One retry on the same task-assigned key"],
          ["Connection error", "1", "One retry on the same task-assigned key"],
          ["Provider 5xx", "1", "One retry on the same task-assigned key"],
        ]),
        P("There is a one-second backoff between attempts and a hard cap of three attempts. Only table selection has a model fallback, and the fallback keeps the same key. A prompt that exceeds a task's input hint is logged as a warning for observability; it is never truncated or refused."),
      ] },
      { h: "Usage recording", blocks: [
        P("Each chat request runs inside a passive usage recorder. It logs one `LLM_REQUEST_SUMMARY` line with how many tokens the message used and which key and model handled each call. It is write-only: no router, provider or scheduler reads it to decide anything, so it can't refuse a call, cap a completion or change a retry."),
        NOTE("warn", "No provider failover", "Groq is the only provider adapter. If it is unavailable or a key is rate limited, the request fails with a generic error rather than switching provider or key."),
      ] },
    ],
  },

  {
    id: "deployment-stories", group: "ops", title: "Infrastructure",
    lead: "Backend on AWS, frontend on Vercel. Each service has one job: serve requests, run the slow work, or hold one kind of data.",
    sections: [
      { h: "What runs where", blocks: [
        TBL(["Service", "Role in QueryPilot"], [
          ["Vercel", "Hosts the frontend, on its own origin"],
          ["Nginx", "Reverse proxy in front of Django; terminates HTTPS"],
          ["EC2 (Ubuntu)", "Runs the backend containers: the API and the ingestion worker"],
          ["Docker", "Packages Python, native and model dependencies into one image"],
          ["ECR", "Private registry that holds the built images"],
          ["RDS MySQL", "Relational application data, outside the app containers"],
          ["S3", "Original uploaded documents"],
          ["S3 Vectors", "Production vector backend, selected by configuration"],
          ["Redis", "Job queue, cache and rate-limit counters"],
        ]),
        DIA(DEPLOY, "Request path and storage services"),
      ] },
      { h: "Who does what", blocks: [
        P("The API handles incoming requests and nothing slow. The ingestion worker processes document jobs in a separate process. Redis hands the job id from one to the other. MySQL stores the relational data, object storage keeps the original uploads, and vector storage supports semantic retrieval. Keeping those apart means a problem in one place, such as a long parse or a backed-up queue, shows up in that place instead of everywhere."),
      ] },
      { h: "The server", blocks: [
        P("The backend runs on an Ubuntu EC2 instance. It hosts the containers and what they need to run. It is not where the relational data or the uploaded files live: those are in RDS and S3."),
        P("Network access rules exist to keep a clear line between what the public internet can reach and what only the application should reach. The proxy faces the internet; internal services such as the database aren't meant to. This page doesn't publish addresses, identifiers or access details, on purpose."),
      ] },
    ],
  },

  {
    id: "proxy-and-origins", group: "ops", title: "Nginx, HTTPS and origins",
    lead: "Nginx in front of Django, HTTPS from the browser in, and why a separately hosted frontend needs CORS and CSRF settings.",
    sections: [
      { h: "Reverse proxy", blocks: [
        P("The browser never talks to Django directly. It talks to Nginx over HTTPS, and Nginx forwards the request to the Django application. Along the way it passes on the request body, information about the original caller and the protocol the browser actually used."),
        P("That last part matters because HTTPS ends at the proxy. Without being told, Django would see a plain HTTP request from the proxy and could, for example, build wrong redirect URLs or treat secure cookies incorrectly. Django is configured to trust the proxy's forwarded-protocol header for that reason."),
      ] },
      { h: "Streaming chat through a proxy", blocks: [
        P("Chat streams with Server-Sent Events, which is a normal HTTP response that stays open and sends events as they happen. It is not WebSockets. A proxy can break that in two ways. If it buffers the response, the whole answer arrives as one delayed message at the end. If its timeout is short, a long answer gets cut off partway."),
        P("The application helps: the chat response carries `Cache-Control: no-cache` and `X-Accel-Buffering: no`, the header Nginx reads to switch buffering off for that one response. Even so, buffering and timeouts on the streaming path are deliberate settings, not defaults. If replies ever arrive all at once, proxy buffering is the first thing to check."),
      ] },
      { h: "HTTPS", blocks: [
        P("TLS protects traffic between the browser and the backend, so tokens and message content aren't readable in transit. Outside debug mode, plain HTTP requests are redirected to HTTPS, session and CSRF cookies are marked secure, and HSTS tells browsers to keep using HTTPS for a year, including subdomains."),
        P("Certificate files and keys are not published here."),
      ] },
      { h: "Two origins", blocks: [
        P("The frontend is on Vercel and the API is on AWS, so they live on different origins. DNS points the frontend's name at Vercel and the API's name at the AWS side. Because the origins differ, the browser blocks cross-origin requests unless the backend allows them, so the backend lists trusted frontend origins for CORS and trusted origins for CSRF."),
        P("CORS only tells the browser what it may read. It doesn't authenticate anyone. Login, JWT checks and ownership checks do that, and they apply no matter which origin a request comes from."),
        UL([
          "Explicit allowed hosts (required whenever debug is off).",
          "Configurable CORS origins, with allow-all only in debug mode.",
          "HTTPS redirect outside debug mode, secure session and CSRF cookies, HSTS for one year with subdomains.",
          "`X-Frame-Options: DENY`, content-type sniffing protection and a same-origin referrer policy.",
          "A trusted proxy header so Django knows the original protocol.",
        ]),
        NOTE("warn", "Settings aren't a guarantee", "These settings help. None of them makes a deployment secure on its own, and no domains, records or addresses are published on this page."),
      ] },
      { h: "DNS, TLS and forwarded headers", blocks: [
        P("DNS maps a hostname to network records. The reverse proxy accepts public traffic and forwards requests to the application server. TLS protects data in transit and lets the browser verify the server's certificate; because it ends at the proxy, the backend has to be told the original request scheme through forwarded headers."),
        P("For SSE, response buffering and idle timeouts matter. A proxy that buffers the stream makes the frontend appear to receive the answer only after generation has finished."),
      ] },
      { h: "Same-origin policy in one paragraph", blocks: [
        P("An origin is the combination of scheme, host and port. When the frontend and the API sit on different origins, the browser applies the same-origin policy: CORS response headers let approved origins read responses, and CSRF settings protect cookie-authenticated, state-changing requests. Neither replaces API authentication."),
      ] },
    ],
  },

  {
    id: "docker-and-delivery", group: "ops", title: "Docker and delivery",
    lead: "I package the API and the worker into one image, build it with cached layers, push it to a private registry and pull it onto the server.",
    sections: [
      { h: "Why Docker", blocks: [
        P("The backend needs a lot more than Django. It depends on database drivers, document-parsing libraries, the embedding code and several native system packages. Putting all of that into an image keeps the environment the same on my machine and on the server. Docker gives me a consistent runtime, but it doesn't make the app scalable or highly available on its own."),
      ] },
      { h: "What is in the image", blocks: [
        UL([
          "A Python 3.12 slim base, built in stages.",
          "The system packages the libraries need.",
          "Python packages, with a CPU-only PyTorch install.",
          "The quantized ONNX embedding model, baked into the image.",
          "The application source, running as a non-root user.",
          "The ASGI app, served by Uvicorn.",
        ]),
        P("I bake the model into the image so no container has to download it at start-up. That removes a slow step that can fail. The build also loads the model and checks that it produces a 1024-dimension embedding, so a broken image fails at build time instead of in production."),
      ] },
      { h: "API and worker", blocks: [
        P("Both processes run the same codebase from the same Dockerfile. Only the startup command differs. The API runs under Uvicorn, and the worker starts with `python manage.py ingestion_worker`. I don't describe a specific Compose setup on this page, so what you get here is what each process is responsible for, not how they are supervised."),
        P("I split them for the same reason as in the ingestion pipeline. Parsing and embedding take far longer than a request should, so the upload request only validates and queues, and the worker handles the slow part."),
      ] },
      { h: "Image delivery", blocks: [
        P("Source code, the image built from it, that image in a registry and a running container are four different things."),
        TBL(["Thing", "What it is"], [
          ["Source code in Git", "The files, with their history"],
          ["Docker image", "The built environment plus the code, produced from that source"],
          ["Image in ECR", "A copy of that image in a private registry"],
          ["Running container", "An image started on the EC2 server"],
        ]),
        P("The server pulls a prebuilt image, so I don't have to rebuild the Python environment every time the code changes."),
      ] },
      { h: "Shipping an update", blocks: [
        DIA(SHIP, "From source to a running container"),
        UL([
          "**Revision-based images.** Each image is tied to a source revision, so I can always tell which version of the app is running.",
          "**Build caching.** The previous image is used as a cache source, so a code-only change doesn't reinstall every dependency.",
          "**Incremental updates.** Only the service that changed gets replaced. An API-only change doesn't restart the worker.",
          "**Verify.** After an update I check the logs to confirm the new container came up properly.",
        ]),
        NOTE("note", "No downtime claim", "This cuts down on unnecessary restarts, but it isn't a zero-downtime setup. I don't claim one because I haven't measured it."),
      ] },
      { h: "Configuration", blocks: [
        P("Production and local development differ in a few places: database connections, background processing, cloud storage, the vector backend, authentication and security settings, external service integrations and the allowed frontend origins. All of it comes from environment configuration instead of the source, so secrets never live in the repository and each environment can differ without code changes. The setting names are listed on [Configuration](c:configuration)."),
        P("This mattered most when I connected the separately hosted frontend and backend. The CORS and CSRF trust settings have to match the real frontend origin."),
      ] },
      { h: "Logs", blocks: [
        P("The API and the ingestion worker write separate logs, and that is where I start when something breaks: failed requests, containers that keep restarting, an embedding model that won't load, database connection errors, documents that failed processing, a chat stream that got cut short. Each chat request also logs a trace and a token-usage summary. I don't have a central monitoring dashboard."),
      ] },
      { h: "Processes and containers", blocks: [
        P("A process is a running program with its own memory and file descriptors. A container isolates a process using operating-system namespaces and resource controls. It isn't a virtual machine, and a Docker image is the packaged filesystem and metadata a container starts from."),
        P("Several things decide how the image behaves: image layers, the build cache, multi-stage builds, environment variables, container logs, restart policies, health checks and the split between build-time and run-time configuration. The API and the ingestion worker use the same image with different commands."),
      ] },
      { h: "Operational basics", blocks: [
        P("The operational basics are environment-specific configuration, secret injection, database connection limits, object-storage permissions, log inspection, backups and recovery. A service that starts successfully doesn't prove its dependencies are reachable or that an end-to-end request works."),
        P("This page documents the Dockerfile and the environment-based Django settings. The full deployment setup isn't written up here, so please check infrastructure details against the live deployment before treating them as exact configuration."),
      ] },
      { h: "Deployment scenarios to walk through", blocks: [
        OL(["Explain the difference between a Docker image and a running container.", "Trace a browser request through DNS, TLS termination, Nginx and Django.", "Explain why a reverse proxy must forward the original HTTPS scheme.", "Describe how proxy buffering can affect SSE.", "Explain why secrets belong in runtime configuration rather than source control."]),
      ] },
      { h: "What this adds up to", blocks: [
        UL([
          "Django inside Docker, behind a separate proxy, has to be told about the proxy.",
          "Keeping the API and ingestion apart keeps slow work off the request path.",
          "Per-environment configuration keeps secrets out of the source.",
          "A separately hosted frontend needs deliberate CORS and CSRF settings.",
          "Cached builds and prebuilt images keep a small code change small.",
          "Logs are where an investigation starts.",
        ]),
      ] },
    ],
  },

  {
    id: "api-reference", group: "reference", title: "API reference", wide: true,
    lead: "Every route the backend mounts under /api/, with its method, whether it needs a JWT, and what it does. Status codes and event names are the ones the code returns.",
    sections: [
      { h: "Conventions", blocks: [
        P("All routes are under `/api/`. JSON in, JSON out, except the chat stream, which returns `text/event-stream`. A protected route needs `Authorization: Bearer <access token>`; the authentication routes are the only public ones. Ids in a path or body are locators only: every lookup is filtered by the caller (see [API request lifecycle](c:api-request-lifecycle))."),
        TBL(["Status", "When"], [
          ["`200`", "Success; also a duplicate upload (`duplicate: true`) and a successful delete"],
          ["`202`", "An upload was accepted and a job queued"],
          ["`400`", "Validation failed: bad field, unsupported file, document limit reached, missing query parameter"],
          ["`401`", "Missing, invalid or expired access token"],
          ["`404`", "The id doesn't exist **or isn't yours**; the two look the same on purpose"],
          ["`409`", "A document can't be deleted while it is `pending` or `processing`"],
        ]),
      ] },
      { h: "Authentication", blocks: [
        API([
          ["POST", "/api/auth/register/", "Public", "Start sign-up: stores a pending registration and mails a six-digit code"],
          ["POST", "/api/auth/resend-register-otp/", "Public", "Mail a new code, subject to the 60-second cooldown and hourly caps"],
          ["POST", "/api/auth/verify-otp/", "Public", "Verify the code and create the user"],
          ["POST", "/api/auth/login/", "Public", "Check the password and return an access and a refresh token; rate limited per email and IP"],
          ["POST", "/api/auth/refresh/", "Public", "Exchange a refresh token for a new pair; the old one is revoked"],
          ["POST", "/api/auth/logout/", "JWT", "Revoke the user's refresh tokens"],
          ["GET", "/api/auth/me/", "JWT", "The current user"],
          ["POST", "/api/auth/forgot-password/", "Public", "Mail a reset code; the response is identical whether or not the email exists"],
          ["POST", "/api/auth/reset-password/", "Public", "Set a new password and revoke the user's refresh tokens"],
          ["GET", "/api/auth/oauth/google/start/", "Public", "Begin Google sign-in with a one-time `state`"],
          ["GET", "/api/auth/oauth/google/callback/", "Public", "Google redirects here; the backend verifies the state and ID token"],
          ["POST", "/api/auth/oauth/exchange/", "Public", "Swap the one-time login code (valid 2 minutes) for the normal token pair"],
        ]),
      ] },
      { h: "Workspaces", blocks: [
        API([
          ["GET", "/api/workspaces/", "JWT", "List the caller's workspaces"],
          ["POST", "/api/workspaces/create/", "JWT", "Create a workspace owned by the caller"],
          ["PATCH", "/api/workspaces/<id>/", "JWT", "Update a workspace"],
          ["DELETE", "/api/workspaces/<id>/", "JWT", "Delete a workspace"],
          ["GET", "/api/workspaces/<id>/settings/", "JWT", "Read the workspace's settings"],
        ]),
      ] },
      { h: "Documents", blocks: [
        API([
          ["POST", "/api/documents/upload/", "JWT", "Multipart upload with `workspace_id` and `file`. `202` with the document and job ids; `200` with `duplicate: true` for a repeat; `400` for a bad file or the 3-document limit"],
          ["GET", "/api/documents/?workspace_id=<id>", "JWT", "List a workspace's documents, newest first, excluding failed ones. `workspace_id` is required"],
          ["GET", "/api/documents/<id>/status/", "JWT", "Document status, plus the job id, job status and attempt count when a job exists"],
          ["DELETE", "/api/documents/<id>/", "JWT", "Delete the document with its vectors, tables and file. `409` while ingestion is active"],
        ]),
        NOTE("note", "Delete is best effort on derived data", "If cleaning vectors or tables fails, the document is still deleted and the response says which cleanup may be incomplete. The failure is logged."),
      ] },
      { h: "Chat", blocks: [
        API([
          ["GET", "/api/chat/conversations/", "JWT", "List the caller's conversations"],
          ["POST", "/api/chat/conversations/", "JWT", "Create a conversation in a workspace"],
          ["GET", "/api/chat/conversations/<id>/", "JWT", "One conversation with its messages"],
          ["PATCH", "/api/chat/conversations/<id>/", "JWT", "Update a conversation, for example its title"],
          ["DELETE", "/api/chat/conversations/<id>/", "JWT", "Delete a conversation"],
          ["GET", "/api/chat/conversations/<id>/settings/", "JWT", "Memory and citations flags"],
          ["PATCH", "/api/chat/conversations/<id>/settings/", "JWT", "Change those flags"],
          ["POST", "/api/chat/messages/stream/", "JWT", "Send a message and stream the answer as Server-Sent Events"],
        ]),
      ] },
      { h: "The chat stream", blocks: [
        SPLIT(
          ["The body is `{ \"conversation_id\": <int>, \"message\": \"<non-blank text>\" }`. Send `Accept: text/event-stream`. The response is held open and each event is `event: <name>` followed by a JSON `data:` line shaped `{ \"message\": \"...\", \"data\": { ... } }`.", "A blank message or a bad id fails before the stream starts, as ordinary JSON (400 or 404). A rate-limited user still gets a 200 stream, with one `complete` event that says so."],
          [{ label: "Request and events", file: "POST /api/chat/messages/stream/", code: `POST /api/chat/messages/stream/
Authorization: Bearer <access token>
Accept: text/event-stream

{ "conversation_id": 7, "message": "How many orders were delivered?" }

event: query_received
event: conversation_loaded
event: agent_started
event: planning
event: generating_answer
event: answer_delta
event: complete
event: error        # instead of complete, on failure` }],
        ),
        P("The event meanings are in [Memory and streaming](c:answers-and-memory). A client should treat `complete` and `error` as terminal, append `answer_delta` text as it arrives, and read the final answer, error code and conversation title from `complete`."),
      ] },
    ],
  },

  {
    id: "limits-and-defaults", group: "reference", title: "Limits and defaults", wide: true,
    lead: "Every limit, timeout and default the backend enforces, in one place. Values marked as settings can be changed through environment configuration.",
    sections: [
      { h: "Uploads and workspaces", blocks: [
        TBL(["Limit", "Value", "Notes"], [
          ["Supported file types", "`.pdf`, `.docx`, `.xlsx`, `.csv`", "Anything else is rejected with 400"],
          ["Maximum file size", "50 MB", "Checked before the file is stored"],
          ["Archive bounds (`.docx`, `.xlsx`)", "250 MB uncompressed, 10,000 members, 1000x ratio", "Guards against zip bombs"],
          ["Documents per workspace", "3", "Failed documents don't count"],
          ["Documents per conversation", "3", "For the attach model; no public endpoint yet"],
          ["Duplicate files", "Same SHA-256 in one workspace returns the existing document", "A failed duplicate is cleaned up and re-uploaded"],
        ]),
      ] },
      { h: "Accounts and tokens", blocks: [
        TBL(["Limit", "Default", "Setting"], [
          ["Access token lifetime", "15 minutes", "`ACCESS_TOKEN_LIFETIME_MINUTES`"],
          ["Refresh token lifetime", "7 days", "`REFRESH_TOKEN_LIFETIME_DAYS`"],
          ["OTP lifetime", "10 minutes", "`OTP_LIFETIME_MINUTES`"],
          ["OTP verification attempts", "5", "`OTP_MAX_VERIFICATION_ATTEMPTS`"],
          ["OTP resend cooldown", "60 seconds", "`OTP_RESEND_COOLDOWN_SECONDS`"],
          ["OTP requests per email per hour", "3", "`OTP_HOURLY_LIMIT`"],
          ["OTP requests per IP per hour", "10", "`OTP_IP_HOURLY_LIMIT`"],
          ["Login attempts per email", "10 in 15 minutes", "`LOGIN_RATE_LIMIT_EMAIL_ATTEMPTS`, `LOGIN_RATE_LIMIT_WINDOW_SECONDS`"],
          ["Login attempts per IP", "30 in 15 minutes", "`LOGIN_RATE_LIMIT_IP_ATTEMPTS`"],
          ["Google sign-in state", "10 minutes", "`OAUTH_STATE_LIFETIME_SECONDS`"],
          ["Google one-time login code", "2 minutes", "`OAUTH_LOGIN_CODE_LIFETIME_SECONDS`"],
        ]),
      ] },
      { h: "Chat", blocks: [
        TBL(["Limit", "Value", "Notes"], [
          ["Questions per user", "50, then a 2-hour cooldown", "Counted in Redis; checked before any model call"],
          ["Recent messages in context", "10", "Older messages live in the rolling summary"],
          ["Summary size", "6,000 characters", "Existing summary input capped at 5,000; each message at 3,000"],
          ["Request budget", "90 seconds", "The whole chat request"],
          ["Agent execution deadline", "60 seconds", "The planner graph"],
          ["Tool calls per question", "12", "Across dispatch"],
          ["Recovery attempts", "2", "Per question"],
          ["Requirements per question", "12", "Up to 3 retrieval queries each, 500 characters per query"],
          ["Title generation wait", "1 second", "If the title isn't ready the answer isn't delayed"],
        ]),
      ] },
      { h: "Ingestion worker", blocks: [
        TBL(["Limit", "Default", "Setting"], [
          ["Worker threads", "3", "`INGESTION_WORKER_CONCURRENCY`"],
          ["Job tries", "3", "`INGESTION_MAX_ATTEMPTS`"],
          ["Heartbeat interval", "30 seconds", "`INGESTION_HEARTBEAT_SECONDS`"],
          ["Stale after", "30 minutes without a heartbeat", "`INGESTION_JOB_STALE_SECONDS`"],
          ["Recovery pass", "Every 30 seconds", "`INGESTION_RECOVERY_INTERVAL_SECONDS`"],
          ["Chunk size", "About 500 tokens (4 characters per token), two sentences of overlap", "Chunker defaults"],
          ["Embedding", "1024 dimensions, normalised", "Fixed by the model"],
        ]),
      ] },
      { h: "Retrieval and SQL", blocks: [
        TBL(["Limit", "Value"], [
          ["Dense candidates", "20"],
          ["BM25 candidates", "20"],
          ["RRF constant", "60"],
          ["Evidence kept", "Top 5"],
          ["Reranker candidates", "Up to 60 (reranker off by default)"],
          ["BM25 field weights", "content 1.0, heading 0.8, title 0.3"],
          ["SQL rows returned", "100"],
          ["SQL statement", "One `SELECT` or `WITH`, session execution timeout, read-only account"],
        ]),
      ] },
      { h: "Model calls", blocks: [
        P("Per-task models, output ceilings and timeouts are on [LLM routing](c:llm-routing). In short: 20B tasks are capped at 200 to 500 output tokens with 20-second timeouts; the planner is allowed 3,400 tokens and 40 seconds; table selection 2,200; SQL generation 2,600; answers up to 4,000 tokens and 40 seconds. A timeout, connection error or 5xx is retried once on the same key; a 429 is not retried."),
        NOTE("note", "Defaults, not guarantees", "Values marked as settings are defaults at the time of writing and can differ per environment. The numbers describe what the code enforces, not what the system has been measured to sustain."),
      ] },
    ],
  },

  {
    id: "configuration", group: "reference", title: "Configuration",
    lead: "The environment settings that change how the backend behaves, grouped by area. Names and non-secret defaults only: never a host, key, password or value.",
    sections: [
      { h: "How configuration works", blocks: [
        P("Everything environment-specific comes from environment variables (loaded from a `.env` file in development). The code validates the important ones at start-up and refuses to boot on a bad value, for example a non-positive token lifetime, or `DJANGO_ALLOWED_HOSTS` missing while debug is off."),
        NOTE("warn", "Secrets are never published here", "Signing keys, database credentials, provider API keys, OAuth client secrets and mail keys exist as settings but are deliberately not documented with values, defaults or examples."),
      ] },
      { h: "Settings by area", blocks: [
        TBL(["Area", "Settings", "Effect"], [
          ["Environment", "`DEBUG`, `DJANGO_ALLOWED_HOSTS`, `LOG_LEVEL`", "Debug relaxes CORS and HTTPS; hosts are required when debug is off"],
          ["Browser access", "`CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`", "Which frontend origins the browser may call from"],
          ["Tokens", "`ACCESS_TOKEN_LIFETIME_MINUTES`, `REFRESH_TOKEN_LIFETIME_DAYS`", "How long each token type lives"],
          ["Sign-up codes", "`OTP_LIFETIME_MINUTES`, `OTP_RESEND_COOLDOWN_SECONDS`, `OTP_HOURLY_LIMIT`, `OTP_IP_HOURLY_LIMIT`, `OTP_MAX_VERIFICATION_ATTEMPTS`", "Expiry, resend pace and abuse limits"],
          ["Login limits", "`LOGIN_RATE_LIMIT_EMAIL_ATTEMPTS`, `LOGIN_RATE_LIMIT_IP_ATTEMPTS`, `LOGIN_RATE_LIMIT_WINDOW_SECONDS`", "Failed-login throttling"],
          ["Google sign-in", "`GOOGLE_REDIRECT_URI`, `OAUTH_FRONTEND_CALLBACK_URL`, `OAUTH_STATE_LIFETIME_SECONDS`, `OAUTH_LOGIN_CODE_LIFETIME_SECONDS`", "Where Google returns to and how long one-time values live"],
          ["Vector storage", "`VECTOR_BACKEND` (`chroma` or `s3`)", "Chroma is only allowed with debug on"],
          ["Retrieval", "`RETRIEVAL_RERANKER_ENABLED`, `RETRIEVAL_RERANKER_MODEL`", "Turn the cross-encoder on and pick its model"],
          ["Ingestion worker", "`INGESTION_WORKER_CONCURRENCY`, `INGESTION_MAX_ATTEMPTS`, `INGESTION_HEARTBEAT_SECONDS`, `INGESTION_JOB_STALE_SECONDS`, `INGESTION_RECOVERY_INTERVAL_SECONDS`", "Threads, retries and crash recovery"],
          ["Databases", "Three connections: `default`, `structured`, `structured_read`", "Application data, structured writes, structured reads (read-only account)"],
          ["Storage and cache", "Object-storage bucket and region, Redis connection", "Where uploads, queue and counters live"],
        ]),
      ] },
      { h: "Things that are code, not settings", blocks: [
        P("Some behaviour is deliberately fixed in code rather than configurable: the model assigned to each task and its key lane (one file, see [LLM routing](c:llm-routing)), the per-user question limit of 50 with a 2-hour cooldown, the 3-document workspace limit, the 50 MB file limit, and the retrieval constants (20, 20, 60, 5). Changing any of them is a code change."),
      ] },
    ],
  },

  {
    id: "security-model", group: "reference", title: "Security model",
    lead: "How the pieces fit together as a defence: who is allowed to do what, what is hashed or limited, how generated SQL is contained, and what is explicitly not protected.",
    sections: [
      { h: "Principles", blocks: [
        UL([
          "**Ownership lives inside the query.** A guessed id returns nothing instead of someone else's data, and the response is the same as for an id that doesn't exist.",
          "**The model is never an access rule.** Document ids a model returns are checked against the backend's allow-list; generated SQL is validated and run read-only.",
          "**Two independent locks** wherever one failure would be costly: validator plus a database account that can't write.",
          "**Slow and rate-limited beats impossible.** Codes, logins and questions are throttled, not assumed unguessable.",
          "**Secrets live in the environment**, never in the repository or these docs.",
        ]),
      ] },
      { h: "Threats and controls", blocks: [
        TBL(["Threat", "Control", "Read more"], [
          ["Reading another user's conversation or document", "Lookups filtered by creator or workspace owner inside the query; 404 either way", "[API request lifecycle](c:api-request-lifecycle)"],
          ["Stolen password database", "Passwords stored hashed with a password hash, not reversible encryption", "[Accounts and login](c:authentication-token-lifecycle)"],
          ["Guessing a sign-up code", "Hashed, 10-minute expiry, 5 attempts, resend cooldown, per-email and per-IP caps, single use", "[Limits and defaults](c:limits-and-defaults)"],
          ["Credential stuffing", "Login limits per email (10) and per IP (30) in 15 minutes", "[Limits and defaults](c:limits-and-defaults)"],
          ["Stolen refresh token", "Only its SHA-256 hash is stored; rotation on every use; reuse revokes the rest", "[Accounts and login](c:authentication-token-lifecycle)"],
          ["A model-written destructive query", "Validator (read-only, one statement, own tables) then a database account with no write grant", "[Table selection and SQL](c:structured-sql)"],
          ["A model naming a document it shouldn't see", "Returned ids checked against the backend allow-list", "[Scope Guard](c:scope-guard)"],
          ["A malicious upload", "Type and size checks, format validation, zip-bomb bounds, hash-based duplicate handling", "[Document ingestion](c:document-ingestion-pipeline)"],
          ["Runaway cost or loops", "Question limit, tool-call and recovery budgets, execution and request deadlines, per-task token ceilings", "[Execution graph](c:execution-graph)"],
          ["Cross-site abuse from a browser", "Explicit CORS and CSRF origins, secure cookies, `X-Frame-Options: DENY`, HSTS", "[Nginx, HTTPS and origins](c:proxy-and-origins)"],
          ["Leaking internals in errors", "A failed chat stream returns a generic message, not the exception", "[API reference](c:api-reference)"],
        ]),
      ] },
      { h: "What is not protected", blocks: [
        NOTE("warn", "Honest limits", "An access token that was already issued stays valid until it expires (at most 15 minutes), because there is no blocklist. Prompt injection inside an uploaded document can still influence what the answer model says about that document, though not what data it can reach. No encryption at rest, audit log or per-workspace sharing model is described here because none is claimed."),
        P("These are tracked on [Known gaps](c:known-gaps). A security review of the deployed environment (network rules, instance access, secret handling) is outside what this documentation can state."),
      ] },
    ],
  },

  {
    id: "glossary", group: "reference", title: "Glossary",
    lead: "The terms these docs use, in plain words, with the page that explains each in depth.",
    sections: [
      { h: "Product and data", blocks: [
        TBL(["Term", "Meaning"], [
          ["Workspace", "A user's container for documents, extracted tables and conversations; the isolation boundary. See [Relational model](c:workspaces)"],
          ["Document", "One uploaded file (PDF, DOCX, XLSX or CSV) with a status that moves from pending to ready or failed"],
          ["Ingestion job", "The background operation that parses, chunks, embeds and extracts tables for one document"],
          ["Chunk", "A passage of about 500 tokens with its heading and page, embedded for search"],
          ["Profile", "A compact summary of a document the planner reads to choose sources"],
          ["Structured table", "A real MySQL table created from a valid extracted table, queried with SQL"],
          ["Evidence", "The passages or rows collected for a question; the only thing an answer may rest on"],
        ]),
      ] },
      { h: "Question pipeline", blocks: [
        TBL(["Term", "Meaning"], [
          ["Scope Guard", "The routing step that decides whether a message needs the documents at all. See [Scope Guard](c:scope-guard)"],
          ["Route", "One of DOCUMENT, WORKSPACE, CONVERSATION, PRODUCT, CHITCHAT, OUT or CLARIFY"],
          ["Planner", "The step that describes what has to be established; it writes neither SQL nor the answer. See [Planner](c:planner)"],
          ["Requirement", "One fact to establish, with a kind (text or table), a type and dependencies"],
          ["Capability", "A kind of work a plan can include: document search, table query, source metadata, conversation memory, product knowledge"],
          ["Dispatch", "The graph node that runs the plan's tools within a budget"],
          ["AgentState", "The single object passed between graph nodes"],
          ["Key lane", "One of three provider API keys, each pinned to a group of tasks. See [LLM routing](c:llm-routing)"],
        ]),
      ] },
      { h: "Retrieval and SQL", blocks: [
        TBL(["Term", "Meaning"], [
          ["Dense retrieval", "Nearest-neighbour search over embeddings; matches meaning"],
          ["BM25", "Lexical scoring on actual words; matches codes, names and numbers"],
          ["RRF", "Reciprocal Rank Fusion: merges ranked lists using positions only, with constant 60"],
          ["Cross-encoder", "An optional reranker that reads the query and a candidate together"],
          ["`structured_read`", "The read-only database connection the SQL tool uses"],
          ["Validator", "The first SQL lock: only a single read-only statement over permitted tables"],
        ]),
      ] },
      { h: "Delivery and safety", blocks: [
        TBL(["Term", "Meaning"], [
          ["SSE", "Server-Sent Events: one HTTP response held open that pushes events one way"],
          ["Row lock", "A database lock taken when a worker claims a job so two workers can't take it"],
          ["Heartbeat", "A periodic timestamp a running job writes so a crash can be detected"],
          ["Refresh-token rotation", "Issuing a new refresh token on every use and revoking the old one"],
          ["Allow-list", "The backend's own list of ids a request may touch; the model's output is never the list"],
          ["CORS and CSRF", "Browser rules about which origins may read responses and send cookie-authenticated writes; neither is authentication"],
        ]),
      ] },
    ],
  },

  {
    id: "known-gaps", group: "roadmap", title: "Known gaps and next steps",
    lead: "What QueryPilot can do today, where it reaches its limits, and what still needs work before it can be relied on at production scale.",
    sections: [
      { h: "The honest picture", blocks: [
        P("QueryPilot is a working document-intelligence project, not an unlimited document platform. It can ingest supported files, break a question into smaller requirements, retrieve passages, query structured tables and bring the results together. That is meaningful functionality, but it does not mean the system can absorb an entire company drive, read every kind of visual content or answer every broad question reliably."),
        P("The limits below are not theoretical edge cases. Some are explicit limits in the current backend, some come from the model provider, and some are gaps in evaluation or product behaviour. They are worth being clear about because a good demo and a production-ready service are two different things."),
      ] },
      { h: "It is not built for a large document library yet", blocks: [
        P("The current upload rule allows up to three documents in a workspace, with a maximum file size of 50 MB each. That is enough to demonstrate questions across a small set of related files, but it is not enough for a team that wants to connect hundreds of policies, reports, manuals or spreadsheets. So when we say QueryPilot can answer across documents, that currently means a small, controlled workspace, not an unlimited library."),
        P("There is a second limit after upload. A normal text-retrieval question keeps the top five results after dense search, BM25 and rank fusion. That keeps ordinary questions manageable, but it is not the same as reading every relevant passage in every file. The system does have a full-document read path for exhaustive questions, but that can bring a much larger amount of material into one request."),
        P("The planner can create up to 12 requirements, each with up to three retrieval queries. Dispatch is also bounded to 12 tool calls, a 60-second agent deadline and a 90-second overall request budget. These limits stop one question from running indefinitely. They also mean that a question requiring a very wide investigation across many files may reach its execution budget before every useful source has been examined."),
        NOTE("note", "What this means in practice", "A focused question over a few relevant documents is the right fit today. Asking it to review a large archive, compare every file or produce a complete workspace-wide audit is beyond the current operating envelope."),
      ] },
      { h: "More documents can mean more evidence than the model can read", blocks: [
        P("Finding evidence is only half the job. Before the answer is written, QueryPilot has to fit the question, the planner's requirements, conversation context, retrieved passages, structured query results and source information into the model request. As the number and length of relevant sources grow, that evidence payload grows too."),
        P("The language model has a finite input context. The provider also has a combined input-and-output limit, so a request can become too large even when the answer itself is short. The current code records a warning when a task's input hint is exceeded, but it does not yet have a complete evidence-budget manager that reliably scores, compresses and trims all gathered material before every model call. In some cases the provider can reject an oversized request. The backend can reduce the requested output allowance when the provider reports a context-limit error, but only when enough room remains for a usable answer."),
        P("This is why adding more documents does not automatically make the answer better. A wider search can collect more useful facts, but it can also create a prompt that is too large, consume more of the request deadline or force the answer to work from only part of the evidence. Long-document summaries and questions that span many sources are especially exposed to this trade-off."),
        P("A stronger version needs deliberate evidence budgeting: decide which requirements are essential, deduplicate overlapping passages, limit evidence per requirement, summarise large source groups in stages and then answer from those intermediate results. That kind of staged synthesis is not a complete, guaranteed capability in the current build."),
      ] },
      { h: "The current LLM setup is for a showcase, not sustained production traffic", blocks: [
        P("The current showcase uses free-tier Groq API access to keep the project demonstrable without paying for a production inference allowance. The three API keys are separated into task lanes: planning and routing, table selection and SQL generation, and final answer generation. That separation helps keep one task from consuming another task's key allowance, but it does not create more reliable capacity than the provider grants those accounts."),
        P("Free-tier quotas and rate limits are imposed by the provider and can change with the account, model and current usage. A burst of visitors, repeated large questions or several expensive requests at once can exhaust a lane's allowance. When Groq returns a rate-limit response, the current backend does not rotate to another key or switch to another provider. It surfaces the failure. Timeout, connection and provider-server errors get a retry on the same assigned key; a rate-limit response does not."),
        P("There is also no general provider failover layer or token scheduler today. The usage recorder logs which model and key were used, but it does not use that information to reserve capacity, queue requests or spread work dynamically. This is acceptable for a controlled project demonstration; it is not a basis for promising predictable throughput, uptime or service-level guarantees."),
        NOTE("warn", "Demo capacity is not a performance claim", "The current free-tier setup shows how the application is wired together. It should not be presented as evidence that QueryPilot can support production traffic or a high number of simultaneous users."),
      ] },
      { h: "The parser can only retrieve what it successfully reads", blocks: [
        P("The ingestion pipeline turns files into text, tables and metadata before retrieval can use them. That works best when a document has a reasonably clear reading order and selectable text. Complex multi-column layouts, scanned pages, screenshots, diagrams and charts are harder. The current parser path does not reliably understand every relationship shown visually, especially when the information exists only in an image rather than in ordinary text or a recognised table."),
        P("If a parser misses a label, reads a table in the wrong order or fails to capture a relationship in a diagram, the later stages cannot magically recover the missing meaning. Chunking and embeddings operate on the extracted representation they receive. A clean-looking answer is therefore not proof that every part of the original file was understood."),
        P("A more capable visual extraction path is still needed for image-heavy pages, along with a way to measure whether it actually recovers the information correctly. Until then, important facts that exist only in charts, screenshots or diagrams should be checked against the original file."),
      ] },
      { h: "Finding a passage is not the same as proving an answer", blocks: [
        P("Hybrid retrieval gives QueryPilot two ways to find candidate passages: semantic similarity and keyword matching. The reranker can improve their order, but it cannot recover a passage that neither search method retrieved in the first place. Retrieval recall has not yet been measured against a labelled evaluation set, so we do not have a defensible accuracy figure for how often the right evidence is found."),
        P("The answer model is instructed to stay within the collected evidence and to say when something is missing. That is a useful guardrail, not a guarantee against hallucination. There is no separate claim-by-claim verification pass after generation today. A source can be attached to an answer while still failing to support the exact sentence beside it."),
        P("For now, treat citations and source information as a way to inspect where an answer came from, not as a formal proof that every statement has been verified. A labelled test set, retrieval measurements and a claim-level verification step are still needed before making stronger reliability claims."),
      ] },
      { h: "It does not know which conflicting document is the latest", blocks: [
        P("A workspace can contain two files that disagree: an old refund policy and a revised one, for example. The current document model does not provide a complete version history, an effective-date policy or a reliable supersedes relationship. If both files are retrieved, QueryPilot may see both pieces of evidence without having enough information to know which one should take precedence."),
        P("That makes questions about the latest policy, current contract terms or rules that changed over time risky unless the source documents clearly state their dates and the user checks the answer. Proper document versioning, effective dates and explicit conflict handling are still missing."),
      ] },
      { h: "Spreadsheet answers have their own boundaries", blocks: [
        P("Valid extracted tables are stored in MySQL so QueryPilot can use SQL for filtering, counting and arithmetic instead of trying to calculate from a handful of embedded rows. That is the right separation, but the current table loader stores every column as `TEXT`. Generated SQL therefore has to cast values before doing numeric or date operations. Inconsistent spreadsheet values, ambiguous date formats, currency symbols or unexpected text can still make a query fail or produce a result that needs checking."),
        P("The SQL path is intentionally constrained: it uses permitted tables, a read-only database connection, a statement timeout and a 100-row result cap. Those controls protect the database, but they also mean the product is not a general-purpose analytics warehouse. Very large exports, complex joins and analyses that need more than the allowed result set are not what this path is designed to handle today."),
      ] },
      { h: "Some product details are still unfinished", blocks: [
        P("A few parts of the codebase are present but are not complete product features yet. The `citations_enabled` setting is stored but does not currently switch citation behaviour. `ConversationDocument` exists in the schema, but there is no public attach or detach API. `WorkspaceTable` and `DocumentMetadata` are not the live source of truth for the table catalogue. These are implementation leftovers or incomplete surfaces, not capabilities to promise in a demo."),
        P("There are smaller operational compromises too. Logging out revokes refresh tokens, but an access token already issued remains valid until its short expiry. The per-user chat allowance is currently fixed at 50 questions followed by a two-hour cooldown. The `SQLiteManager` name is legacy naming; the structured-data backend is MySQL. These do not make the core flow unusable, but they are signs that the product still needs a cleanup and hardening pass."),
      ] },
      { h: "What needs to happen before calling it production-ready", blocks: [
        P("The next step is not simply to raise the document limit or buy a larger model. The system needs to grow in a controlled way: raise and test workspace limits, introduce evidence budgets and staged synthesis, measure retrieval and answer quality on a labelled dataset, add claim-level verification, improve parsing for visual content, and give documents version and effective-date handling."),
        P("On the serving side, the demo keys need to be replaced or backed by a paid inference plan with monitored quotas, request scheduling and provider failover. The application also needs load tests, clearer operational dashboards and a deployment setup that can be reproduced and recovered. Until those pieces exist and have been tested, QueryPilot should be described as a technically capable prototype with known operating limits—not as an enterprise-ready platform."),
        NOTE("note", "The standard we are aiming for", "A useful answer should be traceable, fit within a controlled evidence budget and make uncertainty visible. The work ahead is to make that behaviour hold as the number of files, size of questions and number of users increase."),
      ] },
      { h: "Debugging workflow", blocks: [
        P("When something fails, start at the boundary where the request stopped: browser to API, API to MySQL, API to Redis, worker to parser, worker to vector storage, planner to SQL, or backend to the model provider. Capture the request or job identifier, then find the first point where the observed behaviour differs from what should have happened."),
        P("Reproduce the smallest failing case with the same input and environment. Change one thing at a time, make the smallest safe correction and run the original case again. For ingestion or retrieval changes, also check nearby cases: a parser change can alter chunks, and a chunking or embedding change can require the affected documents to be reprocessed."),
        H3("A practical way to investigate"),
        OL(["Write down what the user asked and what QueryPilot actually returned.", "Identify the first stage that lost, changed or rejected the required information.", "Check the source file, extracted representation, retrieved evidence and provider response in that order.", "Make one targeted change and rerun the failing case.", "Run regression questions that cover other files and question types before shipping." ]),
      ] },
      { h: "Changes that affect data", blocks: [
        P("Database migrations, ingestion changes and retrieval-index changes have different rollback risks. A migration changes schema; an ingestion change may require reprocessing files; an embedding-model change may require rebuilding vectors. Record what must be regenerated and how partial work is cleaned up before shipping the change."),
      ] },
    ],
  },

  {
    id: "frontend", group: "development", title: "Frontend and ownership", wide: true,
    lead: "The product interface, how it talks to the backend, and a straight account of who designed it and how the code was written.",
    sections: [
      { h: "The frontend's job", blocks: [
        P("The product frontend is a separate Next.js and React application. It is where users actually work: signing in, moving between workspaces, uploading documents, checking document status, holding conversations and reading the chat stream. It talks to the Django API over HTTP, and the backend stays the authority for identity, ownership, processing state and stored conversations."),
        TBL(["User action", "Backend contract"], [
          ["Create an account or sign in", "`/api/auth/register/`, `/verify-otp/`, `/login/`, `/refresh/`, `/logout/`, `/me/` and Google OAuth routes"],
          ["Open or create a workspace", "`/api/workspaces/` and its create, update, delete and settings routes"],
          ["Upload a document", "`/api/documents/upload/`; the request records the file and queues ingestion"],
          ["Check processing state", "`/api/documents/<document_id>/status/`"],
          ["Open a conversation", "`/api/chat/conversations/` and conversation detail/settings routes"],
          ["Send a chat message", "`/api/chat/messages/stream/`, which returns Server-Sent Events"],
        ]),
        P("Every route, with its methods and status codes, is on the [API reference](c:api-reference)."),
      ] },
      { h: "The upload experience", blocks: [
        P("When the upload request returns, it only means the backend has accepted and recorded the file. The file hasn't been parsed or indexed yet. The frontend needs to keep five states apart: uploading, accepted (pending), processing, ready and failed. The document status endpoint gives it the backend's recorded state, so it never has to guess from elapsed time."),
        P("The backend enforces the workspace owner check, the file type and size limits, the duplicate-hash constraint and the document-count limit. None of these can live only as disabled buttons in the UI, because a client can send a request without ever using the visible form."),
      ] },
      { h: "The chat experience", blocks: [
        P("The frontend sends a message to the chat stream endpoint and reads the SSE events from the response. While planning and tool execution run, the stream reports progress, and after that it delivers the answer text as it is generated. The backend saves the final assistant message before it sends the closing `complete` event."),
        P("A streaming UI has to handle more than the happy path: a dropped connection, an error event, an unfinished response, a double submit, the per-user question limit (which arrives as a normal `complete` event) and the user leaving the conversation in the middle of an answer. The client-side implementation details aren't covered on this page."),
      ] },
      { h: "Component and state design", blocks: [
        P("The interface is built from React components using props, state, controlled inputs, effects and composition. The main design question is where each piece of state lives: local to a component, shared across a page, or persisted by the backend. Loading, empty, success and error states all look different, and an upload modal shouldn't suggest a document is ready just because the upload request succeeded. The backend processes the file asynchronously and exposes a status endpoint for exactly that reason."),
      ] },
      { h: "Routing and rendering", blocks: [
        P("Next.js gives me the App Router, layouts, route segments, client and server components, navigation and query parameters. A client component makes sense when the interface needs browser state, event handlers or browser APIs such as the clipboard and `IntersectionObserver`. Not every page has to be client-rendered."),
      ] },
      { h: "API integration and authentication", blocks: [
        P("The frontend treats the Django API as the authority for identity, workspace ownership, document status and conversation data. Request cancellation, loading and error states, token expiry, refresh handling and protection against double submits all sit on that boundary."),
        P("The backend exposes `/api/auth/` for account operations, `/api/workspaces/` for workspaces, `/api/documents/` for uploads and status, and `/api/chat/` for conversations and streaming messages. How the frontend stores tokens and manages its client-side state isn't covered on this page."),
      ] },
      { h: "Streaming chat and accessibility", blocks: [
        P("For chat, the browser reads a streaming response and parses the SSE event boundaries. The UI has to tell progress events, text deltas, completion and failure apart, and it has to cope with the user navigating away or the connection breaking."),
        P("Interface quality also covers keyboard navigation, focus management, semantic HTML, responsive layout, reduced-motion preferences, contrast and readable type scales. A technical interface should work without a mouse and at narrow viewport widths."),
      ] },
      { h: "Frontend scenarios to walk through", blocks: [
        OL(["Build a controlled upload form with validation and explicit pending/success/failure states.", "Explain when a React component needs `use client` in Next.js.", "Trace a login response into a protected API request without assuming the token-storage method.", "Read an SSE stream and update a chat message as text events arrive.", "Test the interface with a keyboard and with reduced motion enabled."]),
      ] },
      { h: "Design ownership and implementation", blocks: [
        P("I shaped the frontend direction and the visual design. That covers the product's visual language, the layout of the main screens and how users move between workspaces, documents and chat. I also used AI tools heavily while building it, and much of the frontend code was written with that help. I don't want to suggest I hand-wrote every component."),
        P("I think that distinction matters. I can stand behind the product direction and the interface decisions without overstating how the code was produced. The backend architecture and the integration contract are documented separately from the frontend implementation details."),
      ] },
      { h: "How this Engineering documentation is built", blocks: [
        P("This Engineering page is a client-side Next.js documentation view. The chapter content is kept as structured data and rendered through shared blocks for paragraphs, tables, steps, code panels, diagrams, endpoint tables, link cards and callouts. The `?c=<chapter-id>` query parameter picks the chapter, the sidebar keeps every section in view, and AI & Retrieval opens as its own scrollable list."),
        P("The diagrams are SVG-based and show the same information through selectable nodes and a detail panel. The page also has search, keyboard navigation, a reading-position indicator and reduced-motion support. This section describes the docs site itself, not the main product frontend."),
      ] },
      { h: "What is and isn't covered", blocks: [
        NOTE("note", "Scope of this page", "The API routes and the SSE response contract described here come from the backend code. The main frontend's client-side state library, token-storage mechanism, component tree and API wrapper aren't described here."),
      ] },
    ],
  },
];

/* --------------------------- docs chrome --------------------------- */

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60";
const slug = (id: string, i: number) => `${id}-s${i}`;
interface Props { groups: Group[]; chapters: Chapter[]; githubUrl: string; appHref: string; loginHref: string }

/* ----------------------------- markdown + search ----------------------------- */

const fence = (t: { label: string; file?: string; code: string }) => `${t.label}${t.file ? ` (${t.file})` : ""}\n\n\`\`\`\n${t.code}\n\`\`\``;
const list = (a: string[]) => a.map((x, k) => `${k + 1}. ${x}`).join("\n");
/** `[label](c:id)` links become plain labels outside the app. */
const plain = (s: string) => s.replace(/\[([^\]]+)\]\(c:[^)]+\)/g, "$1");
const mdTable = (head: string[], rows: string[][]) => [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${r.map(plain).join(" | ")} |`)].join("\n");

function blockMd(b: Block): string {
  switch (b.t) {
    case "p": return plain(b.text);
    case "h3": return `### ${b.text}`;
    case "ul": return b.items.map((i) => `- ${plain(i)}`).join("\n");
    case "ol": return list(b.items.map(plain));
    case "dia": return `_Diagram: ${b.title}_`;
    case "table": return mdTable(b.head, b.rows);
    case "api": return mdTable(["Method", "Path", "Auth", "What it does"], b.rows);
    case "cards": return b.items.map((c) => `- **${c.title}.** ${plain(c.text)}`).join("\n");
    case "facts": return b.items.map((f) => `- **${f.k}:** ${f.v}${f.sub ? ` (${f.sub})` : ""}`).join("\n");
    case "cmp": return `**${b.q}**\n\n${b.sides.map((s) => `${s.title}\n\n${list(s.lines.map(plain))}\n\n${s.verdict}`).join("\n\n")}`;
    case "code": return b.tabs.map(fence).join("\n\n");
    case "split": return [b.text.map(plain).join("\n\n"), b.list ? list(b.list.map(plain)) : "", b.tabs.map(fence).join("\n\n")].filter(Boolean).join("\n\n");
    case "note": return `> **${b.title}.** ${plain(b.text)}`;
    case "viz": return `_Interactive diagram: ${b.id}_`;
    case "steps": return b.items.map((s, k) => `${k + 1}. **${s.title}**\n\n${s.text.map(plain).join("\n\n")}${s.code ? "\n\n" + s.code.map(fence).join("\n\n") : ""}`).join("\n\n");
    default: return "";
  }
}
const toMarkdown = (c: Chapter) => [`# ${c.title}`, plain(c.lead), ...c.sections.map((s) => [`## ${s.h}`, ...s.blocks.map(blockMd)].join("\n\n"))].join("\n\n");

function blockText(b: Block): string {
  switch (b.t) {
    case "p": case "h3": return b.text;
    case "ul": case "ol": return b.items.join(" ");
    case "table": case "api": return b.rows.map((r) => r.join(" ")).join(" ");
    case "cards": return b.items.map((c) => `${c.title} ${c.text}`).join(" ");
    case "facts": return b.items.map((f) => `${f.k} ${f.v} ${f.sub ?? ""}`).join(" ");
    case "cmp": return `${b.q} ${b.sides.map((s) => `${s.title} ${s.lines.join(" ")} ${s.verdict}`).join(" ")}`;
    case "split": return `${b.text.join(" ")} ${(b.list ?? []).join(" ")}`;
    case "note": return `${b.title} ${b.text}`;
    case "steps": return b.items.map((s) => `${s.title} ${s.text.join(" ")}`).join(" ");
    default: return "";
  }
}

interface Entry { href: string; title: string; where: string; titleL: string; body: string; bodyL: string; rank: number }
interface Hit { href: string; title: string; where: string; snippet?: string }
const clean = (s: string) => plain(s).replace(/[`*]/g, "");

function buildIndex(ordered: Chapter[], groups: Group[]): Entry[] {
  return ordered.flatMap((c) => {
    const g = groups.find((x) => x.id === c.group);
    const where = g?.name ?? "";
    const lead = clean(c.lead);
    const out: Entry[] = [{ href: to(c.id), title: c.title, where, titleL: c.title.toLowerCase(), body: lead, bodyL: lead.toLowerCase(), rank: 30 }];
    c.sections.forEach((sec, i) => {
      const body = clean(sec.blocks.map(blockText).join(" "));
      out.push({ href: `${to(c.id)}#${slug(c.id, i)}`, title: sec.h, where: `${where} / ${c.title}`, titleL: sec.h.toLowerCase(), body, bodyL: body.toLowerCase(), rank: 10 });
    });
    return out;
  });
}

function search(index: Entry[], q: string): Hit[] {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  const tokens = s.split(/\s+/).filter(Boolean);
  const scored: { e: Entry; score: number }[] = [];
  index.forEach((e) => {
    if (!tokens.every((t) => e.titleL.includes(t) || e.bodyL.includes(t))) return;
    let score = e.rank;
    if (e.titleL.includes(s)) score += 50;
    if (tokens.every((t) => e.titleL.includes(t))) score += 20;
    scored.push({ e, score });
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 8).map(({ e }) => {
    let snippet: string | undefined;
    if (!tokens.every((t) => e.titleL.includes(t))) {
      const at = e.bodyL.indexOf(tokens.find((t) => e.bodyL.includes(t)) ?? tokens[0]);
      if (at >= 0) { const from = Math.max(0, at - 36); snippet = `${from > 0 ? "..." : ""}${e.body.slice(from, at + 100).trim()}...`; }
    }
    return { href: e.href, title: e.title, where: e.where, snippet };
  });
}

/* ---------------------------------- chrome ---------------------------------- */

const ACC = "#ffffff";

/** "⌘" on Apple devices, "Ctrl" elsewhere. Resolved after mount so server and client markup match. */
function useModKey() {
  const [k, setK] = useState("Ctrl");
  useEffect(() => { if (/Mac|iPhone|iPad/.test(navigator.platform)) setK("⌘"); }, []);
  return k;
}

function Palette({ open, onClose, index, ordered, groups }: { open: boolean; onClose: () => void; index: Entry[]; ordered: Chapter[]; groups: Group[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cur, setCur] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const hits: Hit[] = useMemo(() => {
    if (q.trim()) return search(index, q);
    return ordered.slice(0, 7).map((c) => ({ href: to(c.id), title: c.title, where: groups.find((g) => g.id === c.group)?.name ?? "" }));
  }, [q, index, ordered, groups]);

  useEffect(() => { if (open) { setQ(""); setCur(0); setTimeout(() => inputRef.current?.focus(), 10); } }, [open]);
  if (!open) return null;

  const go = (h: Hit) => {
    router.push(h.href, { scroll: false });
    onClose();
    const id = h.href.split("#")[1];
    if (id) setTimeout(() => document.getElementById(id)?.scrollIntoView(), 150);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center px-4 pt-[11vh]" role="dialog" aria-modal="true" aria-label="Search the docs">
      <button type="button" aria-label="Close search" onClick={onClose} className="absolute inset-0 bg-black/70" />
      <div className="relative w-full max-w-[680px] overflow-hidden rounded-2xl border border-white/15 bg-[#0d0d0e] shadow-2xl">
        <div className="flex h-14 items-center gap-3 border-b border-white/10 pl-5 pr-3">
          <Icon n="search" className="size-5 shrink-0 text-white/55" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setCur(0); }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              else if (e.key === "ArrowDown") { e.preventDefault(); setCur((c) => (c + 1) % Math.max(1, hits.length)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setCur((c) => (c - 1 + hits.length) % Math.max(1, hits.length)); }
              else if (e.key === "Enter" && hits[cur]) { e.preventDefault(); go(hits[cur]); }
            }}
            placeholder="Search documentation..."
            aria-label="Search the engineering docs"
            className="w-full bg-transparent text-[16.5px] text-white outline-none placeholder:text-white/45"
          />
          <button type="button" onClick={onClose} aria-label="Close search" className={`grid size-9 shrink-0 place-items-center rounded-md text-white/55 hover:bg-white/[0.07] hover:text-white ${FOCUS}`}><Icon n="close" className="size-[18px]" /></button>
        </div>
        <div className="qpe-scroll max-h-[58vh] overflow-y-auto p-2.5">
          {!q.trim() && <p className="px-3 pb-1.5 pt-2 text-[15px] text-white/40">Suggested</p>}
          {hits.length ? hits.map((h, k) => (
            <Link key={h.href} href={h.href} scroll={false} onMouseEnter={() => setCur(k)} onClick={(e) => { e.preventDefault(); go(h); }} className={`block rounded-lg px-3.5 py-3 ${k === cur ? "bg-white/[0.07]" : ""}`}>
              <span className="block text-[16px] text-white">{h.title}</span>
              <span className="block text-[15px] text-white/50">{h.where}</span>
              {h.snippet && <span className="mt-1.5 line-clamp-2 block text-[16px] leading-[1.5] text-white/65">{h.snippet}</span>}
            </Link>
          )) : <p className="px-3 py-8 text-center text-[16.5px] text-white/55">No results for “{q}”.</p>}
        </div>
      </div>
    </div>
  );
}

const NAV_LINKS: { id: string; label: string }[] = [
  { id: "quick-start", label: "Quick start" },
  { id: "product-architecture", label: "Architecture" },
  { id: "api-reference", label: "API reference" },
];

function TopBar({ onMenu, onSearch, authed, scrolled, progress, githubUrl, appHref, loginHref, activeId }: { onMenu: () => void; onSearch: () => void; authed: boolean | null; scrolled: boolean; progress: number; githubUrl: string; appHref: string; loginHref: string; activeId: string }) {
  const mod = useModKey();
  const checking = authed === null;
  return (
    <header className={`sticky top-0 z-40 border-b backdrop-blur-xl transition-[background-color,border-color] duration-300 ${scrolled ? "border-white/10 bg-[#0A0A0A]/85" : "border-white/[0.06] bg-[#0A0A0A]/60"}`}>
      <div className="grid w-full grid-cols-[1fr_auto] items-center gap-4 px-4 sm:px-6 xl:grid-cols-[1fr_auto_1fr]" style={{ height: "var(--nav)" }}>
        <div className="flex min-w-0 items-center gap-2.5 justify-self-start">
          <button type="button" onClick={onMenu} aria-label="Open page list" className={`grid size-9 place-items-center rounded-md text-white/80 hover:bg-white/[0.06] lg:hidden ${FOCUS}`}><Icon n="menu" className="size-5" /></button>
          <Link href="/engineering" scroll={false} aria-label="QueryPilot docs home" className={`flex items-center gap-2.5 rounded-md text-[16px] font-semibold tracking-[-0.02em] text-white ${FOCUS}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/querypilot-logo.svg" alt="" aria-hidden="true" className="size-6 object-contain" />
            <span className="max-[479px]:hidden">QueryPilot</span>
          </Link>
          <span aria-hidden="true" className="h-4 w-px bg-white/15 max-[379px]:hidden" />
          <Link href="/engineering" scroll={false} className={`rounded-md px-1 text-[14px] font-medium text-white/55 transition-colors hover:text-white max-[379px]:hidden ${FOCUS}`}>Docs</Link>
        </div>

        <nav aria-label="Quick links" className="hidden items-center gap-1 xl:flex">
          {NAV_LINKS.map((l) => (
            <Link key={l.id} href={to(l.id)} scroll={false} aria-current={activeId === l.id ? "page" : undefined} className={`rounded-md px-3 py-1.5 text-[14px] transition-colors hover:bg-white/[0.06] ${activeId === l.id ? "text-white" : "text-white/65 hover:text-white"} ${FOCUS}`}>{l.label}</Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 justify-self-end">
          <button type="button" onClick={onSearch} aria-label="Search documentation" className={`flex h-9 w-[240px] items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.03] px-3.5 text-left text-[13.5px] text-white/50 transition-colors hover:border-white/25 hover:text-white/80 max-md:w-9 max-md:justify-center max-md:px-0 ${FOCUS}`}>
            <Icon n="search" className="size-4 shrink-0" />
            <span className="flex-1 max-md:hidden">Search docs</span>
            <span className="qpe-mono hidden shrink-0 items-center gap-1 text-[12px] text-white/40 md:flex"><kbd className="rounded border border-white/15 px-1.5 py-px">{mod}</kbd><kbd className="rounded border border-white/15 px-1.5 py-px">K</kbd></span>
          </button>

          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub (temporarily disabled)"
            title="GitHub"
            onClick={(e) => e.preventDefault()}
            className={`hidden size-9 items-center justify-center rounded-md text-white/80 transition-colors hover:bg-white/[0.06] hover:text-white sm:inline-flex ${FOCUS}`}
          >
            <Icon n="github" className="size-5" />
          </a>

          <div className={`flex items-center gap-1.5 ${checking ? "invisible" : ""}`} aria-hidden={checking ? true : undefined}>
            {authed ? (
              <PixelDissolveButton label="Open QueryPilot" href={appHref} color="#ffffff" textColor={PD_COLORS.whiteText} dissolveColor={PD_COLORS.whiteFx} cellSize={4} className={`${PD_PILL} !h-9`} />
            ) : (
              <>
                <PixelDissolveButton label="Log in" href={loginHref} color="transparent" textColor={PD_COLORS.ghostText} dissolveColor={PD_COLORS.ghostFx} cellSize={4} className={`${PD_PILL} ${PD_GHOST} !h-9 max-[519px]:!hidden`} />
                <PixelDissolveButton label="Sign up" href="/signup" color="#ffffff" textColor={PD_COLORS.whiteText} dissolveColor={PD_COLORS.whiteFx} cellSize={4} className={`${PD_PILL} !h-9`} />
              </>
            )}
          </div>
        </div>
      </div>
      <div aria-hidden="true" className="absolute inset-x-0 -bottom-px h-[2px]">
        <div className="h-full origin-left" style={{ width: `${Math.round(progress * 1000) / 10}%`, background: ACC, opacity: progress > 0 ? 1 : 0, transition: "opacity .2s" }} />
      </div>
    </header>
  );
}

const COLLAPSIBLE = new Set(["ai"]);

function SideNav({ groups, ordered, active, onGo }: { groups: Group[]; ordered: Chapter[]; active: Chapter | null; onGo?: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const activeGroup = active?.group;

  useEffect(() => {
    if (activeGroup && COLLAPSIBLE.has(activeGroup)) setOpen((o) => (o[activeGroup] ? o : { ...o, [activeGroup]: true }));
  }, [activeGroup]);

  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[aria-current="page"]');
    const sc = el?.closest<HTMLElement>(".qpe-scroll");
    if (!el || !sc) return;
    const r = el.getBoundingClientRect(), s = sc.getBoundingClientRect();
    if (r.top < s.top + 8 || r.bottom > s.bottom - 8) sc.scrollTop += r.top - s.top - s.height / 2;
  }, [active?.id, open]);

  // No colour anywhere in the sidebar: white text, and the current page is the one row with a fill.
  const row = (on: boolean) => `flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-[15.5px] leading-6 transition-colors ${FOCUS} ${on ? "bg-white/[0.09] font-medium text-white" : "text-white/90 hover:bg-white/[0.05] hover:text-white"}`;
  const head = "flex w-full items-center gap-3 px-3 pb-2 text-left text-[12.5px] font-medium uppercase leading-6 tracking-[0.12em] text-white/55";

  return (
    <nav ref={ref} aria-label="Engineering pages" className="space-y-7 pt-1">
      {groups.map((g) => {
        const pages = ordered.filter((c) => c.group === g.id);
        if (!pages.length) return null;
        const fold = COLLAPSIBLE.has(g.id);
        const isOpen = !fold || !!open[g.id];
        const label = (
          <>
            <span className="min-w-0 flex-1">{g.name}</span>
          </>
        );
        const links = pages.map((p) => {
          const on = p.id === active?.id;
          return <li key={p.id}><Link href={to(p.id)} scroll={false} onClick={onGo} aria-current={on ? "page" : undefined} className={row(on)}><span className="min-w-0">{p.title}</span></Link></li>;
        });
        return (
          <div key={g.id}>
            {fold ? (
              <button type="button" aria-expanded={isOpen} aria-controls={`nav-${g.id}`} onClick={() => setOpen((o) => ({ ...o, [g.id]: !isOpen }))} className={`${head} ${FOCUS}`}>
                {label}
                <Icon n="chev" className={`size-4 shrink-0 text-white transition-transform ${isOpen ? "rotate-90" : ""}`} />
              </button>
            ) : <p className={head}>{label}</p>}
            {isOpen && (fold
              ? <ul id={`nav-${g.id}`} className="qpe-scroll ml-4 max-h-[min(380px,46vh)] space-y-0.5 overflow-y-auto overscroll-contain border-l border-white/15 pl-2 pr-1">{links}</ul>
              : <ul className="space-y-0.5">{links}</ul>)}
          </div>
        );
      })}
    </nav>
  );
}

const RAIL_ACTION = `flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[15px] text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white ${FOCUS}`;

/* ----------------------------------- shell ----------------------------------- */

function DocsShell({ groups, chapters, githubUrl, appHref, loginHref }: Props) {
  const params = useSearchParams();
  const key = params.get("c") ?? params.get("from") ?? "";
  const ordered = useMemo(() => groups.flatMap((g) => chapters.filter((c) => c.group === g.id).sort((x, y) => ORDER.indexOf(x.id) - ORDER.indexOf(y.id))), [groups, chapters]);
  const items: HubItem[] = useMemo(() => ordered.map((c) => ({ id: c.id, title: c.title, lead: c.lead, group: c.group })), [ordered]);
  const index = useMemo(() => buildIndex(ordered, groups), [ordered, groups]);
  const chapter = chapters.find((c) => c.id === key || c.alias?.includes(key)) ?? chapters.find((c) => c.id === "quick-start") ?? null;
  const isHome = chapter?.id === "quick-start";
  const ci = chapter ? ordered.indexOf(chapter) : -1;
  const group = chapter ? groups.find((g) => g.id === chapter.group) ?? null : null;

  const [part, setPart] = useState(0);
  const [drawer, setDrawer] = useState(false);
  const [pal, setPal] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let has = false;
    try { has = authApi.hasAccess(); } catch { has = false; }
    if (!has) { setAuthed(false); return; }
    setAuthed(true);
    authApi.me().catch(() => { if (!cancelled) setAuthed(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.tagName === "INPUT" || t.tagName === "TEXTAREA";
      if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") || (e.key === "/" && !typing)) { e.preventDefault(); setPal(true); }
    };
    document.addEventListener("keydown", f);
    return () => document.removeEventListener("keydown", f);
  }, []);

  useEffect(() => {
    setPart(0);
    setDrawer(false);
    const el = scrollRef.current;
    if (!el) return;
    const t = setTimeout(() => {
      const h = window.location.hash.slice(1);
      const target = h ? document.getElementById(h) : null;
      if (target) { target.scrollIntoView(); return; }
      el.scrollTop = 0;
    }, 40);
    return () => clearTimeout(t);
  }, [chapter?.id]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    const run = () => {
      raf = 0;
      setScrolled(el.scrollTop > 8);
      const max = el.scrollHeight - el.clientHeight;
      setProgress(chapter && max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0);
      if (!chapter) return;
      const top = el.getBoundingClientRect().top;
      let k = 0;
      chapter.sections.forEach((_, i) => {
        const s = document.getElementById(slug(chapter.id, i));
        if (s && s.getBoundingClientRect().top - top <= 140) k = i;
      });
      setPart(k);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(run); };
    run();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => { el.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [chapter]);

  const markdown = useMemo(() => (chapter ? toMarkdown(chapter) : ""), [chapter]);
  const mins = useMemo(() => Math.max(1, Math.round(markdown.split(/\s+/).length / 220)), [markdown]);

  const body = useMemo(
    () => chapter?.sections.map((s, i) => (
      <section key={s.h} className="mt-14 border-t border-white/[0.08] pt-10 first-of-type:mt-9 first-of-type:border-t-0 first-of-type:pt-0">
        <h2 id={slug(chapter.id, i)} className="group scroll-mt-[calc(var(--nav)+28px)] text-[clamp(24px,2.2vw,30px)] font-semibold leading-[1.25] tracking-[-0.02em] text-white">
          {s.h}
          <a href={`#${slug(chapter.id, i)}`} aria-label={`Link to ${s.h}`} className="ml-2.5 text-[0.8em] text-white/0 transition-colors group-hover:text-white/40 hover:!text-white">#</a>
        </h2>
        <Blocks blocks={s.blocks} />
      </section>
    )),
    [chapter],
  );

  const tocLink = (s: Section, i: number, cls: string) => (
    <a key={s.h} href={`#${slug(chapter!.id, i)}`} aria-current={i === part ? "location" : undefined} className={`${cls} ${FOCUS}`}>{s.h}</a>
  );

  return (
    <div ref={scrollRef} className="qpd qpe-scroll fixed inset-0 z-[100] overflow-y-auto overscroll-contain text-white" style={{ colorScheme: "dark" }}>
      <style>{EXPLORER_CSS + DOCS_CSS}</style>
      <ButtonFx />
      <TopBar onMenu={() => setDrawer(true)} onSearch={() => setPal(true)} authed={authed} scrolled={scrolled} progress={progress} githubUrl={githubUrl} appHref={appHref} loginHref={loginHref} activeId={chapter?.id ?? ""} />
      <Palette open={pal} onClose={() => setPal(false)} index={index} ordered={ordered} groups={groups} />

      {drawer && (
        <div className="fixed inset-0 z-[110] lg:hidden">
          <button type="button" aria-label="Close page list" onClick={() => setDrawer(false)} className="absolute inset-0 bg-black/70" />
          <div className="absolute left-0 top-0 flex h-full w-[360px] max-w-[88vw] flex-col border-r border-white/10 bg-[#0A0A0A]">
            <div className="flex h-[64px] shrink-0 items-center justify-between px-4">
              <span className="text-[17px] font-medium">Engineering docs</span>
              <button type="button" onClick={() => setDrawer(false)} aria-label="Close" className="grid size-10 place-items-center text-white/75 hover:text-white"><Icon n="close" className="size-5" /></button>
            </div>
            <div className="qpe-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-8"><SideNav groups={groups} ordered={ordered} active={chapter} onGo={() => setDrawer(false)} /></div>
          </div>
        </div>
      )}

      <div className="flex w-full">
        <aside className="sticky top-[var(--nav)] hidden h-[calc(100dvh-var(--nav))] w-[320px] shrink-0 flex-col border-r border-white/10 lg:flex">
          <div className="qpe-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6"><SideNav groups={groups} ordered={ordered} active={chapter} /></div>
        </aside>

        <main className="min-w-0 flex-1 px-5 pb-24 pt-8 sm:px-8 lg:px-10 min-[1400px]:px-12">
          <div className="mx-auto w-full max-w-[1080px]">
            {isHome ? <Home startHref={authed ? appHref : loginHref} /> : !chapter ? null : (
              <article>
                <header key={chapter.id}>
                  <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-[14.5px] text-white/50">
                    <Link href="/engineering" scroll={false} aria-label="Docs home" className="hover:text-white"><Icon n="home" className="size-4" /></Link>
                    <span aria-hidden="true">/</span><span>{group?.name}</span><span aria-hidden="true">/</span><span className="text-white/85">{chapter.title}</span>
                  </nav>
                  <h1 className="mt-3 text-[32px] font-medium leading-[1.15] tracking-[-0.02em] text-white">{chapter.title}</h1>
                  <p className="mt-3 max-w-[640px] text-[16px] leading-[1.7] text-white/55">{chapter.lead}</p>
                  <ChapterBanner id={chapter.id} group={group?.name ?? ""} meta={`Updated ${UPDATED} · ${mins} min read · Page ${ci + 1} of ${ordered.length}`} sections={chapter.sections.map((s, i) => ({ h: s.h, id: slug(chapter.id, i) }))} />
                </header>

                {chapter.sections.length > 1 && (
                  <details className="mt-6 rounded-xl border border-white/10 min-[1536px]:hidden">
                    <summary className="cursor-pointer list-none px-4 py-3 text-[16.5px] text-white/75">On this page</summary>
                    <div className="flex flex-col border-t border-white/10 py-2">
                      {chapter.sections.map((s, i) => tocLink(s, i, `px-4 py-2 text-[16.5px] ${i === part ? "text-white" : "text-white/55 hover:text-white"}`))}
                    </div>
                  </details>
                )}

                {body}

                <PageNav prev={items[ci - 1]} next={items[ci + 1]} groups={groups} />
              </article>
            )}
          </div>
        </main>

        {chapter && !isHome && (
          <aside className="sticky top-[var(--nav)] hidden h-fit max-h-[calc(100dvh-var(--nav))] w-[296px] shrink-0 overflow-y-auto pr-6 pt-14 min-[1536px]:block qpe-scroll">
            {chapter.sections.length > 1 && (
              <>
                <p className="text-[16.5px] font-semibold text-white">On this page</p>
                <div className="mt-4 flex flex-col border-l border-white/10">
                  {chapter.sections.map((s, i) => tocLink(s, i, `-ml-px border-l py-2 pl-4 text-[15.5px] leading-[1.4] transition-colors ${i === part ? "border-white text-white" : "border-transparent text-white/50 hover:text-white"}`))}
                </div>
              </>
            )}
            <div className="mt-7 border-t border-white/10 pt-5">
              <button type="button" onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })} className={RAIL_ACTION}><Icon n="up" className="size-4 shrink-0" />Back to top</button>
            </div>
            <Link href={authed ? appHref : loginHref} className={`group mt-6 block rounded-xl border border-white/[0.14] bg-white/[0.02] p-4 transition-colors hover:border-white/35 ${FOCUS}`}>
              <span className="flex items-center justify-between gap-2 text-[16px] font-medium text-white">Ready to try QueryPilot?<Icon n="arrow" className="size-4 shrink-0 -rotate-45 text-white/50 transition-colors group-hover:text-white" /></span>
              <span className="mt-1.5 block text-[14.5px] leading-[1.5] text-white/50">Upload a file and ask it a question.</span>
            </Link>
          </aside>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <DocsShell groups={GROUPS} chapters={CHAPTERS} githubUrl={GITHUB_URL} appHref={APP_HREF} loginHref={LOGIN_HREF} />
    </Suspense>
  );
}