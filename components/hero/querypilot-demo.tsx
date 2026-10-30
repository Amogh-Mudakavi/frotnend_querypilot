"use client";

import React, { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Check, ChevronRight, FastForward, FileSpreadsheet, FileText } from "lucide-react";
import { MONO, QP, SANS, STAGE_ORDER, formatMs } from "./agent-trace-demo";
import type { RunStatus, StageId, StageState, StageStatus, TraceRun } from "./agent-trace-demo";

type Props = {
  className?: string;
  /** Accepted so the workspace can label the demo. Not rendered. */
  title?: string;
  /** Pass this callback to AgentTrace's `run` prop in the parent component. */
  onTraceChange?: (run: TraceRun | null) => void;
  /** Start the first showcase once the chat scrolls into view. Defaults to true. */
  autoPlayFirst?: boolean;
};

/* -------------------------------------------------------------------------- */
/*  Pacing                                                                    */
/*                                                                            */
/*  PACE stretches every step. The times shown in the chat and on the graph   */
/*  nodes are the stretched times, so what you read matches what you watch.   */
/*  HOLD is the pause on the final node before the graph rearranges.          */
/* -------------------------------------------------------------------------- */

const PACE = 1.8;
const HOLD = 1000;

/* -------------------------------------------------------------------------- */
/*  Router                                                                    */
/*                                                                            */
/*  Everything between ROUTER-START and ROUTER-END is a pure function:        */
/*  (message, session) -> (route, nextSession). No LLM, timers, randomness    */
/*  or DOM. The route decides the answer and the path the graph shows, so     */
/*  the chat and the graph cannot disagree.                                   */
/* -------------------------------------------------------------------------- */

/* ROUTER-START */
type Topic = "salary" | "tax" | "policy" | "profile" | "leave" | "cross";
type RouteKind =
  | "chitchat"
  | "followup"
  | "table"
  | "hybrid"
  | "cross"
  | "policy"
  | "notfound"
  | "clarify"
  | "unsupported"
  | "unavailable"
  | "blocked"
  | "error";

/* The workspace: salary.xlsx (10 rows), leave.xlsx (days taken, 10 rows), taxslabs.pdf (progressive slabs,
   Rs. 75,000 standard deduction) and leavepolicy.pdf (24 days a year, 10 carry forward). */

interface Employee {
  id: string;
  first: string;
  last: string;
  name: string;
  salary: number;
}
const mkEmp = (id: string, name: string, salary: number): Employee => {
  const [first, ...rest] = name.split(" ");
  return { id, first, last: rest.join(" "), name, salary };
};
const EMPLOYEES: Employee[] = [
  mkEmp("E001", "Rahul Sharma", 25000),
  mkEmp("E002", "Priya Nair", 40000),
  mkEmp("E003", "Arjun Mehta", 70000),
  mkEmp("E004", "Sneha Reddy", 90000),
  mkEmp("E005", "Vikram Singh", 120000),
  mkEmp("E006", "Ananya Iyer", 150000),
  mkEmp("E007", "Karan Malhotra", 200000),
  mkEmp("E008", "Divya Krishnan", 55000),
  mkEmp("E009", "Aditya Rao", 180000),
  mkEmp("E010", "Meera Pillai", 32000),
];

const STD_DEDUCTION = 75000;
const SLABS: ReadonlyArray<{ n: number; lo: number; hi: number; rate: number }> = [
  { n: 1, lo: 0, hi: 400000, rate: 0 },
  { n: 2, lo: 400000, hi: 800000, rate: 0.05 },
  { n: 3, lo: 800000, hi: 1200000, rate: 0.1 },
  { n: 4, lo: 1200000, hi: 1600000, rate: 0.15 },
  { n: 5, lo: 1600000, hi: 2000000, rate: 0.2 },
  { n: 6, lo: 2000000, hi: 2400000, rate: 0.25 },
  { n: 7, lo: 2400000, hi: Infinity, rate: 0.3 },
];

interface TaxCalc {
  monthly: number;
  annual: number;
  taxable: number;
  parts: Array<{ n: number; portion: number; rate: number; tax: number }>;
  annualTax: number;
  exact: number;
  /** Monthly TDS rounded to the nearest rupee (halves round up), as the policy says. */
  tds: number;
  slab: number;
  net: number;
}

function computeTax(monthly: number): TaxCalc {
  const annual = monthly * 12;
  const taxable = Math.max(0, annual - STD_DEDUCTION);
  const parts: TaxCalc["parts"] = [];
  let annualTax = 0;
  let slab = 1;
  for (const s of SLABS) {
    const portion = Math.min(Math.max(taxable - s.lo, 0), s.hi - s.lo);
    if (portion > 0) {
      const tax = portion * s.rate;
      parts.push({ n: s.n, portion, rate: s.rate, tax });
      annualTax += tax;
      slab = s.n;
    }
  }
  const exact = annualTax / 12;
  const tds = Math.floor(exact + 0.5);
  return { monthly, annual, taxable, parts, annualTax, exact, tds, slab, net: monthly - tds };
}

/* leave.xlsx holds days taken this year. leavepolicy.pdf holds the entitlement and the carry-forward cap. */
const LEAVE_ENT = 24;
const CARRY_MAX = 10;
const LEAVE_TAKEN: Record<string, number> = { E001: 9, E002: 14, E003: 6, E004: 20, E005: 11, E006: 3, E007: 17, E008: 8, E009: 12, E010: 22 };

interface LeaveCalc {
  taken: number;
  balance: number;
  /** Days that carry into next year. */
  carry: number;
  /** Days above the cap that lapse on 31 March. */
  lapse: number;
}
function computeLeave(e: Employee): LeaveCalc {
  const taken = LEAVE_TAKEN[e.id] ?? 0;
  const balance = Math.max(0, LEAVE_ENT - taken);
  const carry = Math.min(balance, CARRY_MAX);
  return { taken, balance, carry, lapse: balance - carry };
}

interface Subject {
  label: string;
  first: string;
  calc: TaxCalc;
  emp: Employee | null;
}
const subjectOf = (e: Employee, override: number | null = null): Subject => ({ label: e.name, first: e.first, calc: computeTax(override ?? e.salary), emp: e });

/* ------------------------------ execution types --------------------------- */

interface Step {
  node: StageId;
  /** Shown while the step runs. */
  status: string;
  /** Short result shown on the graph node. */
  detail: string;
  ms: number;
  /** Final status once the run has finished (e.g. "blocked", "failed"). */
  end?: StageStatus;
}

interface Route {
  kind: RouteKind;
  label: string;
  reason: string;
  intent: string;
  title: string;
  body: string;
  sources: string[];
  steps: Step[];
  final: StageId;
  status: RunStatus;
}

interface LastResult {
  title: string;
  explain: string;
  sources: string[];
}

interface Session {
  /** Messages handled so far. */
  turns: number;
  /** Topic of the last substantive answer. */
  topic: Topic | null;
  /** The one employee the conversation is about, set only when the last answer was about exactly one. */
  employee: string | null;
  last: LastResult | null;
  /** Set when QueryPilot asked "which employee?" and is waiting for a name. */
  awaiting: { topic: Topic | null; amount: number | null } | null;
}

interface Decision {
  route: Route;
  next: Session;
}

const initialSession = (): Session => ({ turns: 0, topic: null, employee: null, last: null, awaiting: null });

const INR = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const empByName = (name: string | null) => (name ? (EMPLOYEES.find((e) => e.name === name) ?? null) : null);
const joinNames = (names: string[]) => (names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);
const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
const pct = (r: number) => `${Math.round(r * 100)}%`;
const ALL_FIRST = joinNames(EMPLOYEES.map((e) => e.first));

/* ----------------------------- text helpers ------------------------------ */

const norm = (t: string) =>
  t
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9'.÷₹\s-]/g, " ")
    .replace(/\.(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const stripFiller = (n: string) => {
  let t = n;
  for (let i = 0; i < 4; i++) {
    const u = t.replace(/^(?:hm+|hmm+|well|ok|okay|so|and|then|right|alright|oh|ah|but|also|um+|uh+|actually|now|please|pls|can you|could you|just)\s+/, "");
    if (u === t) break;
    t = u;
  }
  return t.replace(/\s+(?:then|though|please|pls|macha|bro|man|dude|buddy|ok|okay)$/, "");
};

/** True when `a` and `b` are equal or one edit apart. */
function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** Finds employees by first name, last name or ID. Tolerates one typo on names of five or more letters. */
function findEmployees(m: string): { list: Employee[]; tokens: Set<string> } {
  const found: Employee[] = [];
  const tokens = new Set<string>();
  for (const raw of m.split(" ")) {
    const w = raw.replace(/'s?$/, "");
    if (w.length < 3) continue;
    for (const e of EMPLOYEES) {
      const names = [e.first.toLowerCase(), e.last.toLowerCase()];
      const hit = w === e.id.toLowerCase() || names.some((x) => w === x || (w.length >= 5 && x.length >= 5 && withinOneEdit(w, x)));
      if (hit) {
        tokens.add(raw);
        if (!found.includes(e)) found.push(e);
      }
    }
  }
  return { list: found, tokens };
}

/* ------------------------------- small talk ------------------------------- */
/* Small talk is recognised by shape, not by an exact phrase: every word must be a greeting or a casual
   filler word, and at least one must be a greeting, a "how are you" or a "what's up". Anything with a real
   word in it (a name, "tax", "salary", "leave") goes through the full pipeline. */

const GREET_TOK = /^(?:h|h+i+|hy+|he+y+|hye|hai|hiya|heya|yo+|su+p|wa?z*s+u+p|wa+z+u+p|wh?a?t?s+up|hola|namaste|howdy|hlo|h[ae]l+o+|gm)$/;
const CASUAL = new Set(
  ("how are you u r ya is it its it's going doing what whats what's up good morning afternoon evening there bro man dude macha buddy mate " +
    "friend today again then now guys guy all sir bud bruh and so oh ah well ok okay hmm lol yaar da boss hru wbu been have long time nice to " +
    "meet see hows how's the day").split(" "),
);
const HOW_RE = /\bhow(?:'?s| is)? (?:it going|you|u)\b|\bhow (?:are|r) (?:you|u|ya)\b|\bhru\b|\bhow do you do\b/;
const SUP_RE = /\b(?:what'?s|whats|wass?|wazz) ?up\b|\bsup\b/;
const DAYTIME_RE = /\bgood (morning|afternoon|evening)\b/;

function isSmallTalk(n: string): boolean {
  const t = n.split(" ").filter(Boolean);
  if (!t.length || t.length > 7) return false;
  if (!t.every((w) => CASUAL.has(w) || GREET_TOK.test(w))) return false;
  return t.some((w) => GREET_TOK.test(w)) || HOW_RE.test(n) || SUP_RE.test(n) || DAYTIME_RE.test(n);
}

const THANKS =
  /^(?:(?:ok|okay|cool|great|awesome|perfect|nice|alright|hmm+)\s+)?(?:thanks?|thank you|thank u|thx|tysm|ty|cheers|much appreciated|appreciate (?:it|that)|that helps|helpful)(?:\s+(?:a lot|so much|very much|again|macha|bro|man|buddy))*$/;
const BYE = /^(?:bye|goodbye|good ?night|see (?:you|ya)(?: later| soon)?|take care|cya|ttyl|later|gotta go)(?:\s+\w+)?$/;
const HELP =
  /^(?:who are you|what are you|what is querypilot|what'?s querypilot|what can you do|what do you do|how (?:does|do) (?:this|it|you) work|help|help me|how can you help(?: me)?|what (?:can|do) i ask(?: you)?|what should i ask|can you help(?: me)?|capabilities|show me what you can do|demo|how to use(?: this)?)$/;
const ACK =
  /^(?:hm+|hmm+|mm+|mhm|uh ?huh|ok+|okay|k|kk|alright|all right|fine|sure|cool|nice|great|awesome|got it|i see|oh|ah+|aha|oh i see|ohh+|right|makes sense|understood|interesting|wow|noted|fair enough|yeah|yep|yes|yup|true|ic|no|nope|nah)$/;
const NEXT =
  /^(?:(?:so|and|ok|okay|well|hmm+)\s+)*(?:what(?:'s| is)? next|whats next|what now|what else|what(?:'s| is) (?:the )?next step|next step|next|anything else|something else|more|(?:what )?should i (?:do|ask|try)(?: next| now)?|what (?:do|can|could|should) (?:i|we) (?:do|ask|try)(?: next| now)?|where (?:do|should) we go(?: from here| next)?|then what|now what|what do you (?:suggest|recommend)|any (?:suggestions?|ideas?)|suggest(?: something)?|give me (?:an )?(?:idea|suggestion)s?|ideas?|continue|go on|carry on|keep going)(?:\s+(?:then|now|though|please))?$/;
const EXPLAIN =
  /^(?:why(?: is that| is it| so| though| was that| did you say that)?|how(?: so| come)?|how did you (?:get|know|calculate|compute|work (?:that|it) out|come up with (?:that|this))(?: that| this| it)?|how (?:is|was) (?:that|it) (?:calculated|worked out|computed|decided|derived)|explain(?: (?:that|this|it|more|further|please|the (?:result|answer|calculation|logic|math)))*(?: again| simply)?|(?:can|could) you explain(?: that| this| it| more| again)*|what does that mean|what do you mean|what(?:'s| is) that based on|show (?:me )?(?:your )?(?:work|working|steps|calculation|math|proof|sources?)|where (?:did|does) (?:that|this|it) come from|where(?:'s| is| did you get) (?:that|this|it|the (?:data|number|answer))(?: from| come from)?|which sources?(?: did you use)?|what(?:'s| is| was) the source|sources?|evidence|proof|are you sure|really|seriously|is that (?:right|correct|true)|double[- ]check(?: that| it)?|verify(?: that| it)?|break (?:it|that) down|elaborate|tell me more|more (?:details?|info)|details?|i (?:don'?t|do not) (?:get|understand)(?: (?:it|that|this))?|huh|what|come again|say that again|repeat(?: that| it)?|once more|sorry what)$/;

const INJECT =
  /\b(?:ignore|disregard|forget|bypass|override)\b.{0,30}\b(?:rules?|instructions?|restrictions?|guardrails?|polic(?:y|ies)|prompt)\b|\bsystem prompt\b|\bjailbreak\b|\bdeveloper mode\b|\bact as\b.{0,20}\b(?:admin|root|dan)\b|\breveal (?:your|the) (?:prompt|instructions)\b/;
const WRITE =
  /\b(?:delete|remove|drop|truncate|insert|overwrite|alter|edit|modify|update|change|raise|rename)\b[^?.!]{0,40}\b(?:salary|salaries|leave|leaves|row|rows|table|record|records|spreadsheet|employee data|slab|slabs|rate|rates|deduction|file|policy|pdf)\b|\bdrop table\b|\bdelete from\b|\bupdate \w+ set\b/;
const HYPO = /\b(?:what if|suppose|assuming|hypothetical\w*|if)\b/;
const UNAVAILABLE_RE =
  /\b(?:(?:finance|hr|legal|sales|marketing|engineering|ops|operations)(?:'s)?\s+(?:team|folder|drive|files?|docs?|documents?|sheets?|spreadsheets?|reports?|budget|data)|budget|forecast|roadmap|contracts?|nda|offer letters?|handbook|org chart|google drive|gdrive|sharepoint|onedrive|dropbox|notion|confluence|slack|jira|salesforce|e-?mails?|inbox|calendar|crm|erp|sap|workday|database)\b/;
const KNOWN_FILES = new Set(["salary.xlsx", "leave.xlsx", "taxslabs.pdf", "leavepolicy.pdf"]);
const OUT_OF_SCOPE_RE =
  /\b(?:weather|temperature|rain(?:ing)?|sports?|football|soccer|cricket|ipl|score|match|movie|film|series|song|music|lyrics|recipe|joke|poem|story|news|stocks?|share price|bitcoin|crypto|capital of|president|prime minister|ceo of|translate|python|javascript|code|bug|homework|time in|date today|horoscope|restaurant|flight|hotel|traffic|cab)\b/;
const FIELD_RE =
  /\b(?:bonus|appraisal|performance|promotion|pf|provident|esi|professional|statutory|gratuity|insurance|reimbursement|payslip|attendance|overtime|designation|department|manager|joining date|date of joining|age|address|phone|birthday|gender|location|office|title|role|experience|rating|incentive|allowance|hra)\b/;
const MONEY_FIELD = /^(?:bonus|appraisal|pf|provident|esi|professional|statutory|gratuity|insurance|reimbursement|payslip|overtime|incentive|allowance|hra)$/;

const T_TAX = /\b(?:tax(?:es|ed|able)?|tds|deduct\w*|withh\w*|take.?home|net pay|net salary|in.?hand|slab\w*|liabilit\w*|exempt\w*)\b/;
const T_POLICY =
  /\b(?:policy|policies|rules?|formula|clause|guidelines?|taxslabs\.pdf|pdf|document|slabs?|rates?|tds|standard deduction|std deduction|rounding|rounded|annuali[sz]\w*|cess|surcharge|brackets?|progressive|computed|calculated|calculation)\b/;
const T_SALARY = /\b(?:salar(?:y|ies)|pay|earn\w*|income|compensation|ctc|wages?|per month|monthly|gross|(?:highest|lowest|best|most|least) paid|top earner)\b/;
const T_PROFILE = /\b(?:details?|info|information|profile|records?|row|summary|overview|everything)\b|\btell me about\b|\bwho is\b/;
/** Leave questions. "entitlement" alone is not enough, so "tax entitlement" stays a tax question. */
const T_LEAVE = /\b(?:leaves?|time off|pto|days off|vacations?|carry ?forward|carried forward|lapse\w*|leavepolicy\.pdf|leave\.xlsx)\b/;
/** Wording that asks about the leave rule rather than a person's balance. */
const LEAVE_RULE = /\b(?:carry ?forward|carried|lapse\w*|entitle\w*|per year|a year|yearly|annual|allowed|encash\w*|policy|rules?)\b/;
const PRON = /\b(?:he|she|him|her|his|hers|they|them|their|theirs)\b/;
const PRON_WORD = /^(?:he|she|him|her|his|hers|they|them|their|theirs)$/;
const EVERYONE = /\b(?:everyone|everybody|all (?:the )?(?:employees|staff|people|of them|ten|salaries|rows)|each (?:employee|person)|every ?(?:employee|one|body)|whole (?:team|table))\b/;
const WHO = /\b(?:who|which|anyone|anybody|everyone|everybody|any employee|employees|staff|how many)\b/;
const RANK = /\b(?:highest|lowest|top|most|least|fewest|biggest|largest|smallest|max|maximum|min|minimum|best|worst|average|avg|mean|total|sum|rank\w*|sort\w*|order|list|count)\b/;
const ABOVE = /\b(?:above|over|more than|greater than|exceed\w*|higher than|at least|beyond)\b/;
const BELOW = /\b(?:below|under|less than|lower than|fewer than|at most)\b/;
const NO_TAX = /\b(?:no tax|zero tax|nil|exempt\w*|not pay|don'?t pay|doesn'?t pay|pays? nothing|pays? no|tax[- ]free|without tax)\b/;
const TABLE_WORDS = /\b(?:employee table|employees|spreadsheet|salary\.xlsx|table|rows|records|staff|team|people)\b/;

const FILLER = new Set([
  "the", "a", "an", "of", "for", "and", "what", "whats", "about", "how", "is", "are", "does", "do", "did", "his", "her",
  "their", "its", "my", "me", "tell", "show", "give", "check", "see", "get", "find", "please", "can", "you", "now", "then",
  "too", "also", "as", "well", "instead", "same", "ok", "okay", "much", "many", "to", "it", "that", "this", "with", "on",
  "in", "any", "s", "every", "each", "month", "pay", "pays",
]);

const NAME_STOP = new Set(
  ("the this that these those them him her his their our your my me you it its everyone everybody anyone anybody all each every " +
    "employees employee staff team people person salary salaries pay leave leaves days balance vacation time off policy rule rules " +
    "deduction deductions tax taxes tds slab slabs standard rounding rounded formula annual annually gross net income take home rate " +
    "rates cess surcharge clause pdf computed calculated calculation month year week today now someone somebody one both any most more " +
    "less much many who which what how when why table sheet spreadsheet data document documents file files workspace limit payroll " +
    "taken last next first lakh lakhs salaried highest lowest top she he they there here other others another").split(" "),
);

function unknownName(m: string): string | null {
  const patterns = [
    /\b(?:of|for|about|on)\s+([a-z]{3,})\b/,
    /\b([a-z]{3,})'s\s+(?:salary|pay|tax|tds|take|details|record|info|slab|leave)\b/,
    /\b(?:does|did|is|has|will|can)\s+([a-z]{3,})\s+(?:need|have|earn|get|owe|make|pay|paid|fall|come)\b/,
    /\bhow much (?:does|did|is|tax does)\s+([a-z]{3,})\b/,
  ];
  for (const re of patterns) {
    const hit = re.exec(m);
    if (hit && !NAME_STOP.has(hit[1])) return hit[1];
  }
  return null;
}

function unavailableSource(n: string): string | null {
  const file = n.match(/\b([\w-]+\.(?:xlsx?|csv|pdf|docx?|pptx?|json|txt|md))\b/);
  if (file && !KNOWN_FILES.has(file[1])) return file[1];
  const hit = n.match(UNAVAILABLE_RE);
  return hit ? hit[0] : null;
}

function looksUnparseable(n: string): boolean {
  if (!/[a-z]/.test(n)) return true;
  const words = n.split(" ");
  if (words.length > 2) return false;
  return words.every((w) => {
    const vowels = (w.match(/[aeiou]/g) ?? []).length;
    return (w.length >= 5 && vowels / w.length < 0.2) || /^(.)\1{3,}$/.test(w);
  });
}

/** "80000", "80k", "1.2 lakh", "2 crore". Commas are stripped before this runs. */
function parseAmount(m: string): number | null {
  const lakh = m.match(/\b(\d+(?:\.\d+)?)\s*(?:lakhs?|lacs?)\b/);
  if (lakh) return Math.round(Number(lakh[1]) * 100000);
  const crore = m.match(/\b(\d+(?:\.\d+)?)\s*(?:crores?|cr)\b/);
  if (crore) return Math.round(Number(crore[1]) * 10000000);
  const k = m.match(/\b(\d+(?:\.\d+)?)\s*k\b/);
  if (k) return Math.round(Number(k[1]) * 1000);
  const plain = m.match(/\b(\d{4,9})\b/);
  return plain ? Number(plain[1]) : null;
}

/** Words left after removing names, pronouns, topic words and filler. Empty means "a bare follow-up". */
function residue(m: string, nameTokens: Set<string>): string[] {
  const topicWord = (w: string) => [T_TAX, T_POLICY, T_SALARY, T_PROFILE, T_LEAVE].some((r) => r.test(w));
  return m
    .replace(/'s\b/g, "")
    .split(" ")
    .filter((w) => w && !FILLER.has(w) && !nameTokens.has(w) && !PRON_WORD.test(w) && !topicWord(w));
}

/* ----------------------------- execution path ---------------------------- */

/** Every step goes through here, so PACE stretches the whole run and the displayed times stay honest. */
const st = (node: StageId, status: string, detail: string, ms: number, end?: StageStatus): Step => ({ node, status, detail, ms: Math.round(ms * PACE), end });

interface PathInfo {
  intent: string;
  ctx: string;
  resolve?: string;
  plan?: string;
  guard?: string;
  sql?: string;
  docs?: string;
  /** Second document lookup (cross-document route): the rule file. */
  rule?: string;
  join?: string;
  evidence?: string;
  answer?: string;
  note?: string;
  /** The document a policy route reads. Defaults to taxslabs.pdf. */
  file?: string;
  sqlLabel?: string;
  docsLabel?: string;
  joinLabel?: string;
}

function buildPath(kind: RouteKind, d: PathInfo): Step[] {
  const file = d.file ?? "taxslabs.pdf";
  const head = st("context", "Loading conversation context", d.ctx, 260);
  const tail = [st("stream", "Streaming the answer to the chat", "answer chunks ready", 220), st("response", "Returning the final response", "response returned", 200)];
  const prep = (plan: string, guard: string) => [
    st("understand", "Reading the request and picking an intent", `intent = ${d.intent}`, 380),
    st("resolve", "Resolving people and sources", d.resolve ?? "salary.xlsx, taxslabs.pdf", 420),
    st("plan", "Choosing the cheapest safe plan", plan, 380),
    st("guard", "Checking workspace and source permissions", guard, 320),
  ];
  const close = (docsOnly = false) => [
    st("reconcile", "Assembling the evidence", d.join && !docsOnly ? d.join : "1 evidence source", 360),
    st("evidence", "Checking the evidence supports an answer", d.evidence ?? "supported", 300),
    st("finish", "Checking the answer is ready", "answerable, within scope", 240),
    st("answer", "Writing the grounded answer", d.answer ?? "answer ready", 520),
  ];
  switch (kind) {
    case "chitchat":
      // Two steps on purpose: small talk needs no context, planner or data.
      return [st("chitchat", "Recognising small talk", `intent = ${d.intent}`, 340), st("response", "Sending the reply", "reply sent", 200)];
    case "followup":
      return [
        head,
        st("followup", "Resolving the follow-up from the last turn", d.note ?? "context resolved", 380),
        st("finish", "Checking the reply is ready", "no new query needed", 220),
        st("response", "Sending the reply", "reply sent", 200),
      ];
    case "table":
      return [
        head,
        ...prep("table only, documents skipped", "read-only, salary.xlsx"),
        st("dispatch", "Dispatching the table query", "read-only SQL", 300),
        st("sql", "Running a read-only table query", d.sql ?? "rows returned", 620),
        ...close(),
        ...tail,
      ];
    case "policy":
      return [
        head,
        ...prep("documents only, table skipped", `read-only, ${file}`),
        st("dispatch", "Dispatching the document search", "retrieval only", 300),
        st("retrieve", `Searching ${file}`, d.docs ?? `1 passage from ${file}`, 600),
        st("supplement", "Pulling the exact clause", d.join ?? "clause found", 440),
        ...close(true),
        ...tail,
      ];
    case "hybrid":
      return [
        head,
        ...prep(d.plan ?? "salary rows + tax rules", d.guard ?? "read-only, both sources"),
        st("dispatch", "Dispatching the table query and document search", "documents + read-only SQL", 300),
        st("retrieve", d.docsLabel ?? "Searching taxslabs.pdf for the slabs", d.docs ?? "slabs + standard deduction", 560),
        st("sql", d.sqlLabel ?? "Reading the salary rows with a read-only query", d.sql ?? "rows returned", 560),
        st("cross_document", d.joinLabel ?? "Applying the slabs to each salary", d.join ?? "rows joined to rules", 520),
        st("reconcile", "Assembling the evidence", "2 evidence sources", 320),
        st("evidence", "Checking both sources support the answer", d.evidence ?? "both sources agree", 300),
        st("finish", "Checking the answer is ready", "answerable, within scope", 240),
        st("answer", "Writing the grounded answer", d.answer ?? "answer ready", 520),
        ...tail,
      ];
    case "cross":
      // Two spreadsheets and two documents: the planner fans out to three executors, then joins.
      return [
        head,
        ...prep("2 tables + 2 documents, fan out", "read-only, 4 sources"),
        st("dispatch", "Dispatching the table query and both document lookups", "3 executors in parallel", 300),
        st("retrieve", "Searching taxslabs.pdf for the slabs", d.docs ?? "7 slabs, ₹75,000 deduction", 560),
        st("supplement", "Reading leavepolicy.pdf for the entitlement", d.rule ?? "24 days, carry 10", 480),
        st("sql", "Reading salary.xlsx and leave.xlsx with a read-only query", d.sql ?? "1 row, 2 tables", 560),
        st("cross_document", "Applying each rule to its row", d.join ?? "leave + tax joined", 540),
        st("reconcile", "Assembling the evidence", "4 evidence sources", 340),
        st("evidence", "Checking every claim has a source", d.evidence ?? "4 of 4 sources agree", 320),
        st("finish", "Checking the answer is ready", "answerable, within scope", 240),
        st("answer", "Writing the grounded answer", d.answer ?? "answer ready", 540),
        ...tail,
      ];
    case "notfound":
      return [
        head,
        ...prep("table only, documents skipped", "read-only, salary.xlsx"),
        st("dispatch", "Dispatching the table query", "read-only SQL", 300),
        st("sql", "Looking the person up in the table", d.sql ?? "0 rows, no match", 600),
        st("reconcile", "Assembling the evidence", "nothing to assemble", 260),
        st("evidence", "Checking the evidence supports an answer", d.evidence ?? "insufficient, 0 rows", 360, "failed"),
        st("finish", "Deciding the safe exit", "not answerable, falling back", 280),
        st("fallback", "Returning a cautious reply", "no invented answer", 320),
        st("response", "Returning the final response", "response returned", 200),
      ];
    case "clarify":
      return [
        head,
        st("understand", "Reading the request", `intent = ${d.intent}`, 340),
        st("resolve", "Checking what is available", d.resolve ?? "salary.xlsx, taxslabs.pdf", 340),
        st("plan", "Deciding whether a safe plan exists", d.plan ?? "missing detail, no safe plan", 340),
        st("guard", "Confirming workspace scope", "scope unchanged", 260),
        st("dispatch", "Holding the tools back", "nothing dispatched", 240),
        st("clarify", "Asking for the missing detail", d.note ?? "waiting for the user", 340),
        st("finish", "Finalising the question", "no query executed", 200),
        st("response", "Sending the question", "reply sent", 200),
      ];
    case "unsupported":
      return [
        head,
        st("understand", "Classifying the request", `intent = ${d.intent}`, 340),
        st("resolve", "Looking for a source that covers this", d.resolve ?? "no matching source", 360),
        st("plan", "Checking whether any capability fits", "no matching capability", 320),
        st("guard", "Staying inside the workspace", "no source touched", 260),
        st("dispatch", "Nothing to dispatch", "no SQL or search", 240),
        st("fallback", "Returning a scoped reply", "outside workspace", 320),
        st("response", "Returning the final response", "response returned", 200),
      ];
    case "blocked":
    case "unavailable":
      return [
        head,
        st("understand", "Reading the request", `intent = ${d.intent}`, 340),
        st("resolve", "Checking the sources named", d.resolve ?? "salary.xlsx, authorized", 380),
        st("plan", "Checking whether execution may proceed", d.plan ?? "not permitted", 340),
        st("guard", "Stopping before anything runs", d.guard ?? "blocked, nothing executed", 560, "blocked"),
      ];
    case "error":
      return [
        head,
        st("understand", "Trying to plan the request", "no intent found", 380),
        st("error", "The planner could not parse this", "no valid plan", 420, "failed"),
        st("finish", "Choosing the safe exit", "no query run", 240),
        st("fallback", "Returning a cautious reply", "asking to rephrase", 320),
        st("response", "Returning the final response", "response returned", 200),
      ];
  }
}

function ctxNote(s: Session, o: { topic?: boolean; employee?: boolean; last?: boolean }): string {
  if (s.turns === 0) return "first message, nothing to inherit";
  const bits: string[] = [];
  if (o.topic && s.topic) bits.push(`topic ${s.topic}`);
  if (o.employee && s.employee) bits.push(s.employee.split(" ")[0]);
  if (o.last && s.last) bits.push("last answer");
  return bits.length ? `inherits ${bits.join(", ")}` : "new request, nothing inherited";
}

const T_SRC = (n = 1) => `salary.xlsx [${n}]`;
const L_SRC = (n = 1) => `leave.xlsx [${n}]`;
const D_SRC = (n = 1) => `taxslabs.pdf [${n}]`;
const P_SRC = (n = 1) => `leavepolicy.pdf [${n}]`;

const EXPLAIN_CHIP = "How was that calculated?";

/** Suggestions are self-contained: they name the person instead of saying "he" or "his". */
function suggestionsFor(s: Session): string[] {
  const e = empByName(s.employee);
  const out: string[] = [];
  if (!s.last) {
    return ["What is Rahul's leave balance and tax entitlement?", "Who has the highest salary?", "How is monthly TDS calculated?", "Who has the least leave left?"];
  }
  if (e) {
    const idx = EMPLOYEES.indexOf(e);
    const other = EMPLOYEES[(idx + 4) % EMPLOYEES.length];
    out.push(`What about ${other.first}?`);
    out.push(s.topic === "tax" ? `What if ${e.first} earned ₹2,50,000 a month?` : `How much tax does ${e.first} pay?`);
    out.push(s.topic === "leave" || s.topic === "cross" ? "How does leave carry forward?" : s.topic === "salary" ? `What is ${e.first}'s take-home after tax?` : `What is ${e.first}'s leave balance?`);
  } else {
    if (s.topic !== "salary") out.push("Who has the highest salary?");
    if (s.topic !== "tax") out.push("Who pays the most tax?");
    if (s.topic !== "leave") out.push("Who has the least leave left?");
    out.push("What are the tax slabs?");
    out.push("What is Rahul's leave balance and tax entitlement?");
  }
  out.push(EXPLAIN_CHIP);
  return out.slice(0, 4);
}

/** The whole router. Pure and deterministic. */
function routeMessage(raw: string, s: Session): Decision {
  // "1,20,000" -> "120000" so amounts survive normalisation.
  const text = raw.trim().slice(0, 400).replace(/(\d),(?=\d)/g, "$1");
  const n = norm(text);
  const m = stripFiller(n);

  const advance = (patch: Partial<Session> = {}): Session => ({ ...s, turns: s.turns + 1, ...patch });
  const mk = (
    kind: RouteKind,
    p: { label: string; reason: string; intent: string; title: string; body: string; sources?: string[]; path?: Partial<PathInfo>; ctx?: string },
  ): Route => {
    const steps = buildPath(kind, { intent: p.intent, ctx: p.ctx ?? ctxNote(s, {}), ...p.path });
    const blocked = kind === "blocked" || kind === "unavailable";
    return {
      kind,
      label: p.label,
      reason: p.reason,
      intent: p.intent,
      title: p.title,
      body: p.body,
      sources: p.sources ?? [],
      steps,
      final: steps[steps.length - 1].node,
      status: blocked ? "blocked" : "completed",
    };
  };

  /* ---- 1. Small talk and conversation about the conversation ---- */
  const lastTitle = s.last ? s.last.title : null;
  const chat = (intent: string, title: string, body: string): Decision => ({
    route: mk("chitchat", {
      label: "Direct reply",
      reason: "Small talk needs no data, so context, planning, table queries and document search are all skipped.",
      intent,
      title,
      body,
    }),
    next: advance(),
  });
  const follow = (intent: string, title: string, body: string, sources: string[] = [], note?: string): Decision => ({
    route: mk("followup", {
      label: "Follow-up from context",
      reason: "This message only makes sense next to the last answer, so QueryPilot reads the conversation and replies without a new query.",
      intent,
      title,
      body,
      sources,
      ctx: ctxNote(s, { last: true }),
      path: { note: note ?? (s.last ? "using the last answer" : "no earlier answer yet") },
    }),
    next: advance(),
  });

  if (THANKS.test(n)) return chat("thanks", "You're welcome.", "Ask another question when you're ready.");
  if (BYE.test(n)) return chat("farewell", "Goodbye.", "The workspace stays read-only and unchanged.");
  if (isSmallTalk(n) || isSmallTalk(m)) {
    const how = HOW_RE.test(n);
    const day = DAYTIME_RE.exec(n);
    const again = s.turns % 2 === 1;
    const title = day
      ? `Good ${day[1]}.`
      : how
        ? again
          ? "Running normally."
          : "All systems normal."
        : SUP_RE.test(n) || /\b(?:wa?z*s+u+p|su+p)\b/.test(n)
          ? "Ready for a question."
          : again
            ? "Hello again."
            : "Hello.";
    const body = lastTitle
      ? "Continue from the last answer, or ask something new."
      : "Ask about salaries, leave, monthly tax (TDS) or the policies. QueryPilot picks the sources.";
    return chat("greeting", title, body);
  }
  if (HELP.test(n)) {
    return chat(
      "capabilities",
      "Sources and capabilities.",
      "Four sources: salary.xlsx and leave.xlsx (ten employees each), taxslabs.pdf (income tax rules) and leavepolicy.pdf (leave rules).\n• Salary and leave-taken questions use the tables\n• Rule questions use the documents\n• Tax, leave balance and mixed questions use both: the rows plus the rules\nAccess is read-only. Anything outside the workspace is refused, not guessed.",
    );
  }

  if (NEXT.test(n) || NEXT.test(m)) {
    const picks = suggestionsFor(s).filter((x) => x !== EXPLAIN_CHIP);
    const lines = picks.map((x) => `• ${x}`).join("\n");
    return follow(
      "next_steps",
      s.last ? "Suggested next questions." : "Suggested questions.",
      s.last ? `Based on the last answer:\n${lines}` : `Nothing to build on yet. Starting points:\n${lines}`,
    );
  }
  if (EXPLAIN.test(m)) {
    if (s.last) return follow("explain_last", "How this was derived.", s.last.explain, s.last.sources, "explaining the last answer");
    return follow("explain_last", "Nothing to explain yet.", "Ask a question first, like “Who has the highest salary?”, and the derivation will be shown here.");
  }
  if (ACK.test(m) || ACK.test(n)) {
    const tip = suggestionsFor(s)[0];
    return follow(
      "acknowledgement",
      s.last ? "Understood." : "Ready.",
      s.last ? `Ask “${EXPLAIN_CHIP}” to see the working, or try “${tip}”` : `Start with “${tip}”`,
    );
  }

  /* ---- 2. Safety ---- */
  if (INJECT.test(n)) {
    return {
      route: mk("blocked", {
        label: "Blocked by guard",
        reason: "The message tried to override QueryPilot's rules. The guard stops it before any plan or query exists.",
        intent: "policy_override",
        title: "That won't change the rules.",
        body: "The request tried to override QueryPilot's restrictions, so the guard stopped it before any query ran. Nothing was read or changed.",
        path: { resolve: "no source access attempted", plan: "no plan created", guard: "blocked, override attempt" },
      }),
      next: advance(),
    };
  }
  if (WRITE.test(n) && !HYPO.test(n)) {
    return {
      route: mk("blocked", {
        label: "Read-only guard",
        reason: "Every query in this workspace is read-only. A write is rejected at the access check before it can run.",
        intent: "modify_data",
        title: "This workspace is read-only.",
        body: "I can read and calculate from the sheets, but I can't change them. The request was stopped at the access check and nothing was written.",
        path: { resolve: "salary.xlsx, authorized", plan: "write not permitted", guard: "blocked, read-only" },
      }),
      next: advance(),
    };
  }
  if (looksUnparseable(n)) {
    return {
      route: mk("error", {
        label: "Couldn't parse",
        reason: "The planner could not turn this into a request, so QueryPilot takes the safe exit and asks you to rephrase.",
        intent: "unknown",
        title: "I couldn't make sense of that.",
        body: "I couldn't turn that into a request I can plan. Try a short question like “Who has the highest salary?” or “How much tax does Vikram pay?”",
      }),
      next: advance(),
    };
  }
  const missing = unavailableSource(n);
  if (missing) {
    return {
      route: mk("unavailable", {
        label: "Source unavailable",
        reason: "The request names a source that isn't in this workspace. The guard stops before reading or querying anything.",
        intent: "read_source",
        title: `${missing} isn't in this workspace.`,
        body: "This workspace only has salary.xlsx, leave.xlsx, taxslabs.pdf and leavepolicy.pdf. QueryPilot stopped at the access check, so nothing was opened or queried, and nothing is guessed.",
        path: { resolve: `${missing} not found`, plan: "source outside evidence", guard: "blocked, nothing queried" },
      }),
      next: advance(),
    };
  }

  /* ---- 3. Substantive questions ---- */
  const { list: named, tokens: nameTokens } = findEmployees(m);
  const pronoun = PRON.test(m);
  const everyone = EVERYONE.test(m);
  const ctxEmp = empByName(s.employee);
  const amount = parseAmount(m);
  const compare = ABOVE.test(m) || BELOW.test(m);
  const aggish = WHO.test(m) || RANK.test(m) || everyone || compare;
  const personish = named.length > 0 || pronoun || everyone;

  const pol = T_POLICY.test(m);
  const tax = T_TAX.test(m);
  const sal = T_SALARY.test(m);
  const leaveQ = T_LEAVE.test(m);
  let topic: Topic | null = null;
  if (leaveQ) {
    // Leave + tax needs all four sources, a leave rule needs only the policy, a balance needs the row and the rule.
    if (tax) topic = "cross";
    else if (!personish && (pol || LEAVE_RULE.test(m))) topic = "policy";
    else topic = "leave";
  } else if (pol && !personish && !aggish) topic = "policy";
  else if (tax || pol) topic = "tax";
  else if (sal) topic = "salary";
  else if (T_PROFILE.test(m)) topic = "profile";
  const explicitTopic = topic;
  const bare = residue(m, nameTokens).length === 0;

  // Inherit the topic for "what about Priya?", "and her?", "same for everyone".
  let inheritedTopic = false;
  if (topic === null && bare && (named.length || pronoun || everyone)) {
    const t = s.awaiting?.topic ?? s.topic;
    if (t) {
      topic = t === "policy" ? "tax" : t;
      inheritedTopic = true;
    }
  }

  // Inherit the employee for pronouns and bare topics ("his salary", "and tax?").
  let targets: Employee[] = named;
  let inheritedEmp = false;
  if (!targets.length && ctxEmp && !everyone && (pronoun || (explicitTopic !== null && explicitTopic !== "policy" && bare))) {
    targets = [ctxEmp];
    inheritedEmp = true;
  }
  const isAll = everyone && !named.length;
  const ctx = () => ctxNote(s, { topic: inheritedTopic, employee: inheritedEmp });

  const remember = (title: string, explain: string, sources: string[], t: Topic | null, subject: Employee | null): Session =>
    advance({ topic: t, employee: subject ? subject.name : null, last: { title, explain, sources }, awaiting: null });

  const unsupported = (title: string, body: string, intent: string, resolve: string): Decision => ({
    route: mk("unsupported", {
      label: "Out of scope",
      reason: "Nothing in the workspace covers this, so QueryPilot says so instead of inventing an answer.",
      intent,
      title,
      body,
      path: { resolve },
    }),
    next: advance({ awaiting: null }),
  });

  const clarifyEmployee = (t: Topic | null, amt: number | null, who?: string): Decision => {
    const what = t === "salary" ? "salary" : t === "tax" ? "tax" : t === "leave" ? "leave balance" : t === "cross" ? "leave and tax" : "details";
    return {
      route: mk("clarify", {
        label: "Needs clarification",
        reason: "The question needs a person, but none was named and nothing earlier points to one, so QueryPilot asks instead of guessing.",
        intent: "ambiguous_entity",
        title: who ? `Who do you mean by “${who}”?` : "Which employee do you mean?",
        body: `I need a name to look up the ${what}. The workspace has ${ALL_FIRST}.${t === "salary" || t === "tax" ? " You can also ask about everyone, or give me a salary to work with." : ""}`,
        path: { plan: "missing employee", note: "waiting for a name" },
      }),
      next: advance({ awaiting: { topic: t, amount: amt } }),
    };
  };

  const table = (p: {
    title: string;
    body: string;
    explain: string;
    intent: string;
    sql: string;
    answer: string;
    topic: Topic;
    subject: Employee | null;
    resolve?: string;
  }): Decision => ({
    route: mk("table", {
      label: "Table only",
      reason: "One table answers this, so QueryPilot queries it directly and skips document search.",
      intent: p.intent,
      title: p.title,
      body: p.body,
      sources: [T_SRC()],
      ctx: ctx(),
      path: { resolve: p.resolve ?? "salary.xlsx, monthly_gross_salary", sql: p.sql, answer: p.answer, evidence: "rows verified" },
    }),
    next: remember(p.title, p.explain, [T_SRC()], p.topic, p.subject),
  });

  const hybrid = (p: {
    title: string;
    body: string;
    explain: string;
    intent: string;
    sql: string;
    join: string;
    answer: string;
    subject: Employee | null;
    resolve: string;
    docs?: string;
    reason?: string;
    plan?: string;
    guard?: string;
    sources?: string[];
    docsLabel?: string;
    sqlLabel?: string;
    joinLabel?: string;
    topic?: Topic;
  }): Decision => {
    const sources = p.sources ?? [T_SRC(1), D_SRC(2)];
    return {
      route: mk("hybrid", {
        label: "Data + policy",
        reason: p.reason ?? "The salary rows give the income and taxslabs.pdf gives the slabs and the standard deduction. QueryPilot applies one to the other.",
        intent: p.intent,
        title: p.title,
        body: p.body,
        sources,
        ctx: ctx(),
        path: {
          resolve: p.resolve,
          sql: p.sql,
          docs: p.docs ?? "7 slabs, ₹75,000 deduction",
          join: p.join,
          answer: p.answer,
          plan: p.plan,
          guard: p.guard,
          docsLabel: p.docsLabel,
          sqlLabel: p.sqlLabel,
          joinLabel: p.joinLabel,
        },
      }),
      next: remember(p.title, p.explain, sources, p.topic ?? "tax", p.subject),
    };
  };

  const RULE_TEXT =
    "taxslabs.pdf says: annual income is monthly salary × 12, minus a flat ₹75,000 standard deduction. The rest is taxed progressively across seven slabs (0% up to 30%), divided by 12, and rounded to the nearest rupee.";
  const LEAVE_RULE_TEXT = `leavepolicy.pdf says: every employee gets ${LEAVE_ENT} days of paid leave a year. At the 31 March year end, up to ${CARRY_MAX} unused days carry forward and the rest lapse. Days taken are recorded in leave.xlsx.`;

  /* ---- salary (table only) ---- */
  const salaryFor = (list: Employee[]): Decision => {
    const one = list.length === 1;
    const e = list[0];
    let body: string;
    if (one) body = `Gross monthly salary from salary.xlsx (${e.id}). Ask about tax to see what comes off.`;
    else {
      body = list.map((x) => `• ${x.name}: ${INR(x.salary)} / month`).join("\n");
      if (list.length === 2) {
        const [a, b] = list[0].salary >= list[1].salary ? [list[0], list[1]] : [list[1], list[0]];
        body += a.salary === b.salary ? "\nThey earn the same." : `\n${a.first} earns ${INR(a.salary - b.salary)} more than ${b.first}.`;
      }
    }
    return table({
      title: one ? `${e.name} earns ${INR(e.salary)} a month.` : `Salaries for ${joinNames(list.map((x) => x.first))}.`,
      body,
      explain: `I read the monthly gross salary column for ${joinNames(list.map((x) => x.name))} in salary.xlsx. Salary only lives in the table, so no document search was needed.`,
      intent: "lookup_salary",
      sql: one ? `1 row, ${e.first}` : `${list.length} rows, salary`,
      answer: one ? INR(e.salary) : `${list.length} salaries`,
      topic: "salary",
      subject: one ? e : null,
    });
  };

  const salaryAggregate = (): Decision => {
    const sorted = [...EMPLOYEES].sort((a, b) => b.salary - a.salary);
    const total = EMPLOYEES.reduce((sum, e) => sum + e.salary, 0);
    const topN = /\btop (\d{1,2})\b/.exec(m);
    const word = (re: RegExp) => re.test(m);
    if (amount !== null && compare) {
      const up = ABOVE.test(m);
      const hits = sorted.filter((e) => (up ? e.salary > amount : e.salary < amount));
      return table({
        title: hits.length ? `${plural(hits.length, "employee")} ${hits.length === 1 ? "earns" : "earn"} ${up ? "more" : "less"} than ${INR(amount)}.` : `No one earns ${up ? "more" : "less"} than ${INR(amount)}.`,
        body: hits.length ? hits.map((e) => `• ${e.name}: ${INR(e.salary)} / month`).join("\n") : "Every salary in the table is on the other side of that line.",
        explain: `I filtered salary.xlsx for monthly salary ${up ? "above" : "below"} ${INR(amount)} and sorted the matches.`,
        intent: "filter_salary",
        sql: `${hits.length} of 10 rows match`,
        answer: `${hits.length} match`,
        topic: "salary",
        subject: hits.length === 1 ? hits[0] : null,
      });
    }
    if (topN) {
      const k = Math.min(10, Math.max(1, Number(topN[1])));
      const rows = sorted.slice(0, k);
      return table({
        title: `The top ${k} salaries, led by ${rows[0].name}.`,
        body: rows.map((e, i) => `• ${i + 1}. ${e.name}: ${INR(e.salary)} / month`).join("\n"),
        explain: `I sorted salary.xlsx by monthly salary, highest first, and kept ${k} rows.`,
        intent: "rank_salary",
        sql: `${k} rows, top ${k} by salary`,
        answer: `top ${k}`,
        topic: "salary",
        subject: null,
      });
    }
    if (word(/\b(?:lowest|least|min|minimum|smallest|worst)\b/)) {
      const e = sorted[sorted.length - 1];
      return table({
        title: `${e.name} has the lowest salary.`,
        body: `${e.first} earns ${INR(e.salary)} a month, the lowest of the ${EMPLOYEES.length} employees in the table.`,
        explain: "I sorted the ten rows in salary.xlsx by monthly salary and took the smallest. No document was needed.",
        intent: "rank_salary",
        sql: "10 rows, bottom 1 by salary",
        answer: INR(e.salary),
        topic: "salary",
        subject: e,
      });
    }
    if (word(/\b(?:average|avg|mean)\b/)) {
      const avg = total / EMPLOYEES.length;
      return table({
        title: `The average salary is ${INR(avg)} a month.`,
        body: `The mean of all ${EMPLOYEES.length} rows in the salary table.`,
        explain: `I added the ten monthly salaries (${INR(total)}) and divided by 10 in salary.xlsx.`,
        intent: "aggregate_salary",
        sql: "10 rows, avg(salary)",
        answer: INR(avg),
        topic: "salary",
        subject: null,
      });
    }
    if (word(/\b(?:total|sum)\b/)) {
      return table({
        title: `Total monthly salary is ${INR(total)}.`,
        body: `The sum of all ${EMPLOYEES.length} gross salaries in the table, or ${INR(total * 12)} a year.`,
        explain: `I added the ten monthly salaries in salary.xlsx: ${EMPLOYEES.map((e) => INR(e.salary)).join(" + ")}.`,
        intent: "aggregate_salary",
        sql: "10 rows, sum(salary)",
        answer: INR(total),
        topic: "salary",
        subject: null,
      });
    }
    if (word(/\b(?:list|everyone|everybody|all|each|rank\w*|sort\w*|order|employees)\b/) && !word(/\b(?:highest|top|most|best|biggest|largest|max|maximum)\b/)) {
      return table({
        title: "All ten salaries, highest first.",
        body: sorted.map((e) => `• ${e.name}: ${INR(e.salary)} / month`).join("\n"),
        explain: "I read all ten rows from salary.xlsx and sorted them by monthly salary.",
        intent: "list_salaries",
        sql: "10 rows, sorted by salary",
        answer: "10 salaries",
        topic: "salary",
        subject: null,
      });
    }
    const e = sorted[0];
    return table({
      title: `${e.name} has the highest salary.`,
      body: `${e.first} earns ${INR(e.salary)} a month, the highest of the ${EMPLOYEES.length} employees in the table. No document search was needed.`,
      explain: "I sorted the ten rows in salary.xlsx by monthly salary and took the top one. Salary only lives in the table, so no document was searched.",
      intent: "rank_salary",
      sql: "10 rows, top 1 by salary",
      answer: INR(e.salary),
      topic: "salary",
      subject: e,
    });
  };

  /* ---- profile ---- */
  const profileFor = (list: Employee[]): Decision => {
    const one = list.length === 1;
    const e = list[0];
    const line = (x: Employee) => `${x.name} (${x.id}): ${INR(x.salary)} a month`;
    return table({
      title: one ? `${e.name}'s record.` : list.length === EMPLOYEES.length ? `All ${EMPLOYEES.length} rows in the salary table.` : `Rows for ${joinNames(list.map((x) => x.first))}.`,
      body: one ? `${line(e)}. The table holds an ID, a name and a gross monthly salary.` : list.map((x) => `• ${line(x)}`).join("\n"),
      explain: `I read ${one ? "that row" : "those rows"} from salary.xlsx. The table has employee ID, name and monthly gross salary.`,
      intent: "show_rows",
      sql: `${list.length} row${list.length === 1 ? "" : "s"} returned`,
      answer: `${list.length} row${list.length === 1 ? "" : "s"}`,
      topic: "profile",
      subject: one ? e : null,
      resolve: "salary.xlsx, all columns",
    });
  };

  /* ---- tax (needs the table and the document) ---- */
  const breakdown = (c: TaxCalc): string[] => {
    const taxed = c.parts.filter((p) => p.rate > 0);
    return taxed.map((p) => `• Slab ${p.n}: ${INR(p.portion)} at ${pct(p.rate)} = ${INR(p.tax)}`);
  };

  const explainTax = (subs: Subject[]) => {
    const s0 = subs[0];
    const c = s0.calc;
    return `${RULE_TEXT} Worked for ${s0.label}: ${INR(c.monthly)} × 12 = ${INR(c.annual)}; minus ${INR(STD_DEDUCTION)} = ${INR(c.taxable)} taxable; annual tax ${INR(c.annualTax)}; ÷ 12 = ${INR(c.tds)} a month.`;
  };

  const taxFor = (subs: Subject[], hypo: boolean, scopeAll: boolean): Decision => {
    const owing = subs.filter((x) => x.calc.tds > 0);
    const total = owing.reduce((sum, x) => sum + x.calc.tds, 0);
    let title: string;
    let body: string;
    let join: string;
    if (subs.length === 1) {
      const sub = subs[0];
      const c = sub.calc;
      const person = sub.emp !== null;
      title =
        c.tds > 0
          ? hypo
            ? person
              ? `At ${INR(c.monthly)} a month, ${sub.first} would pay ${INR(c.tds)} TDS.`
              : `A ${INR(c.monthly)} monthly salary pays ${INR(c.tds)} TDS a month.`
            : `${sub.label} pays ${INR(c.tds)} TDS a month.`
          : hypo
            ? `No tax is due at ${INR(c.monthly)} a month.`
            : `No tax is due for ${sub.first}.`;
      const lines = [
        `${INR(c.monthly)} × 12 = ${INR(c.annual)} a year. ${c.annual > STD_DEDUCTION ? `After the ${INR(STD_DEDUCTION)} standard deduction, ${INR(c.taxable)} is taxable.` : `That's within the ${INR(STD_DEDUCTION)} standard deduction, so nothing is taxable.`}`,
      ];
      if (c.tds > 0) {
        lines.push(...breakdown(c));
        lines.push(`Annual tax ${INR(c.annualTax)} ÷ 12 ${Math.abs(c.exact - c.tds) < 0.001 ? "=" : "rounds to"} ${INR(c.tds)} a month, leaving ${INR(c.net)} before other deductions.`);
      } else if (c.annual > STD_DEDUCTION) {
        lines.push(`Taxable income stays inside Slab 1 (0% up to ${INR(SLABS[0].hi)}), so no tax is due.`);
      }
      if (hypo && sub.emp) lines.push(`Recorded salary is ${INR(sub.emp.salary)}.`);
      body = lines.join("\n");
      join = c.tds > 0 ? `${INR(c.taxable)} taxable, slab ${c.slab}` : "taxable income in slab 1";
    } else if (scopeAll) {
      const ranked = [...subs].sort((a, b) => b.calc.tds - a.calc.tds);
      title = owing.length ? `${owing.length} of ${subs.length} employees pay TDS: ${INR(total)} a month in total.` : "No one pays tax.";
      body = ranked.map((x) => `• ${x.label}: ${x.calc.tds > 0 ? `${INR(x.calc.tds)} (Slab ${x.calc.slab})` : "no tax"}`).join("\n");
      join = `${owing.length} of ${subs.length} above slab 1`;
    } else {
      title = `Monthly TDS for ${joinNames(subs.map((x) => x.first))}.`;
      body = subs.map((x) => `• ${x.label}: ${INR(x.calc.monthly)} gives ${x.calc.tds > 0 ? `${INR(x.calc.tds)} TDS (Slab ${x.calc.slab})` : "no tax"}`).join("\n");
      join = `${subs.length} salaries, ${owing.length} taxed`;
    }
    const first = subs[0];
    return hybrid({
      title,
      body,
      explain: explainTax(subs),
      intent: hypo ? "what_if_tax" : scopeAll ? "tax_all" : "calculate_tax",
      resolve: scopeAll ? "all rows, salary.xlsx, taxslabs.pdf" : `${joinNames(subs.map((x) => x.first))}, salary.xlsx, taxslabs.pdf`,
      sql: scopeAll ? "10 rows, read-only" : hypo && !first.emp ? "no row, amount given" : `${subs.length} row${subs.length === 1 ? "" : "s"}, read-only`,
      join,
      answer: subs.length === 1 ? `${INR(first.calc.tds)}, 2 sources` : `${INR(total)}, 2 sources`,
      subject: subs.length === 1 ? first.emp : null,
    });
  };

  const taxAggregate = (): Decision => {
    const subs = EMPLOYEES.map((e) => subjectOf(e));
    const ranked = [...subs].sort((a, b) => b.calc.tds - a.calc.tds);
    const owing = subs.filter((x) => x.calc.tds > 0);
    const total = owing.reduce((sum, x) => sum + x.calc.tds, 0);
    const word = (re: RegExp) => re.test(m);
    const send = (title: string, body: string, intent: string, join: string, answer: string, subject: Employee | null, explainExtra: string): Decision =>
      hybrid({
        title,
        body,
        explain: `${RULE_TEXT} I applied that to all ten salaries in salary.xlsx. ${explainExtra}`,
        intent,
        resolve: "all rows, salary.xlsx, taxslabs.pdf",
        sql: "10 rows, read-only",
        join,
        answer,
        subject,
      });
    if (word(NO_TAX)) {
      const free = subs.filter((x) => x.calc.tds === 0);
      return send(
        free.length ? `${plural(free.length, "employee")} ${free.length === 1 ? "pays" : "pay"} no tax.` : "Everyone pays some tax.",
        free.length ? free.map((x) => `• ${x.label}: ${INR(x.calc.monthly)} a month, ${INR(x.calc.taxable)} taxable, inside Slab 1`).join("\n") : "Every salary in the table crosses the 0% slab.",
        "filter_tax",
        `${free.length} of 10 in slab 1`,
        `${free.length} tax-free`,
        free.length === 1 ? free[0].emp : null,
        "Anyone whose taxable income stays at or under ₹4,00,000 pays nothing.",
      );
    }
    if (word(/\b(?:how many|count)\b/)) {
      return send(
        `${owing.length} of ${subs.length} employees pay tax.`,
        `${joinNames(owing.map((x) => x.first))} ${owing.length === 1 ? "pays" : "pay"} TDS. ${joinNames(subs.filter((x) => x.calc.tds === 0).map((x) => x.first))} ${subs.length - owing.length === 1 ? "is" : "are"} in the 0% slab.`,
        "count_tax",
        `${owing.length} of 10 taxed`,
        `${owing.length} taxed`,
        null,
        "I counted the salaries whose taxable income crosses ₹4,00,000.",
      );
    }
    if (word(/\b(?:lowest|least|min|minimum|smallest)\b/)) {
      const low = owing[owing.length ? owing.findIndex((x) => x.calc.tds === Math.min(...owing.map((y) => y.calc.tds))) : 0];
      if (!low) return taxFor(subs, false, true);
      return send(
        `${low.label} pays the least tax of those taxed.`,
        `${low.first}'s monthly TDS is ${INR(low.calc.tds)} (Slab ${low.calc.slab}). ${subs.length - owing.length} ${subs.length - owing.length === 1 ? "person pays" : "people pay"} nothing at all.`,
        "rank_tax",
        "lowest non-zero TDS",
        INR(low.calc.tds),
        low.emp,
        "I ranked the non-zero results. People in the 0% slab are listed separately.",
      );
    }
    if (word(/\b(?:total|sum)\b/)) {
      return send(
        `Total monthly TDS is ${INR(total)}.`,
        `${owing.length} of ${subs.length} employees pay it, which is ${INR(total * 12)} a year across the team.`,
        "aggregate_tax",
        `${owing.length} of 10 taxed`,
        INR(total),
        null,
        "I summed each person's rounded monthly TDS.",
      );
    }
    if (word(/\b(?:average|avg|mean)\b/)) {
      const avg = total / subs.length;
      return send(
        `Average monthly TDS is ${INR(avg)}.`,
        `${INR(total)} of TDS spread across all ${subs.length} employees, including those who pay nothing.`,
        "aggregate_tax",
        "10 rows averaged",
        INR(avg),
        null,
        "I averaged over all ten people, not only the ones who pay.",
      );
    }
    if (word(/\b(?:highest|most|top|biggest|largest|max|maximum|best|worst)\b/) && !word(/\b(?:list|everyone|all)\b/)) {
      const top = ranked[0];
      return send(
        `${top.label} pays the most tax.`,
        `${top.first}'s monthly TDS is ${INR(top.calc.tds)} (Slab ${top.calc.slab}) on a salary of ${INR(top.calc.monthly)}. The next highest is ${ranked[1].label} at ${INR(ranked[1].calc.tds)}.`,
        "rank_tax",
        `top of ${owing.length} taxed`,
        INR(top.calc.tds),
        top.emp,
        `${top.first}: ${INR(top.calc.monthly)} × 12 = ${INR(top.calc.annual)}, taxable ${INR(top.calc.taxable)}, annual tax ${INR(top.calc.annualTax)}.`,
      );
    }
    return taxFor(subs, false, true);
  };

  /* ---- leave (leave.xlsx for days taken, leavepolicy.pdf for the entitlement) ---- */
  const leaveHybrid = (p: { title: string; body: string; explain: string; intent: string; sql: string; join: string; answer: string; subject: Employee | null; resolve: string }): Decision =>
    hybrid({
      ...p,
      docs: `${LEAVE_ENT} days, carry ${CARRY_MAX}`,
      reason: "leave.xlsx has the days taken and leavepolicy.pdf has the yearly entitlement. QueryPilot subtracts one from the other.",
      plan: "leave rows + leave policy",
      guard: "read-only, leave sources",
      sources: [L_SRC(1), P_SRC(2)],
      docsLabel: "Searching leavepolicy.pdf for the entitlement",
      sqlLabel: "Reading the leave rows with a read-only query",
      joinLabel: "Subtracting days taken from the entitlement",
      topic: "leave",
    });

  const leaveFor = (list: Employee[]): Decision => {
    const rows = list.map((e) => ({ e, l: computeLeave(e) }));
    if (rows.length === 1) {
      const { e, l } = rows[0];
      return leaveHybrid({
        title: `${e.name} has ${plural(l.balance, "day")} of leave left.`,
        body: [
          `• ${LEAVE_ENT} days a year (leavepolicy.pdf), ${l.taken} taken (leave.xlsx).`,
          `• ${plural(l.carry, "day")} carry forward on 31 March${l.lapse > 0 ? `, ${l.lapse} would lapse` : ""}.`,
        ].join("\n"),
        explain: `${LEAVE_RULE_TEXT} For ${e.name}: ${LEAVE_ENT} − ${l.taken} taken = ${l.balance} left; ${l.carry} can carry forward${l.lapse > 0 ? ` and ${l.lapse} lapse` : ""}.`,
        intent: "leave_balance",
        resolve: `${e.first}, leave.xlsx, leavepolicy.pdf`,
        sql: `1 row, ${e.first}`,
        join: `${LEAVE_ENT} − ${l.taken} = ${l.balance}`,
        answer: `${l.balance} days, 2 sources`,
        subject: e,
      });
    }
    return leaveHybrid({
      title: `Leave left for ${joinNames(list.map((x) => x.first))}.`,
      body: rows.map(({ e, l }) => `• ${e.name}: ${plural(l.balance, "day")} left (${l.taken} of ${LEAVE_ENT} taken)`).join("\n"),
      explain: `${LEAVE_RULE_TEXT} Balance is ${LEAVE_ENT} minus days taken, per person.`,
      intent: "leave_balance",
      resolve: `${list.length} people, leave.xlsx, leavepolicy.pdf`,
      sql: `${list.length} rows, read-only`,
      join: `${list.length} balances computed`,
      answer: `${list.length} balances`,
      subject: null,
    });
  };

  const leaveAggregate = (): Decision => {
    const rows = EMPLOYEES.map((e) => ({ e, l: computeLeave(e) }));
    const least = /\b(?:least|lowest|fewest|min|minimum|smallest|worst)\b/.test(m);
    const most = /\b(?:most|highest|top|max|maximum|best)\b/.test(m);
    const sorted = [...rows].sort((a, b) => (most && !least ? b.l.balance - a.l.balance : a.l.balance - b.l.balance));
    const lead = sorted[0];
    const title =
      most && !least
        ? `${lead.e.name} has the most leave left: ${plural(lead.l.balance, "day")}.`
        : least
          ? `${lead.e.name} has the least leave left: ${plural(lead.l.balance, "day")}.`
          : "Leave left for all ten employees.";
    return leaveHybrid({
      title,
      body: sorted.map(({ e, l }) => `• ${e.name}: ${plural(l.balance, "day")} left (${l.taken} taken)`).join("\n"),
      explain: `${LEAVE_RULE_TEXT} I subtracted each person's days taken from ${LEAVE_ENT} and sorted the ten balances.`,
      intent: "rank_leave",
      resolve: "all rows, leave.xlsx, leavepolicy.pdf",
      sql: "10 rows, read-only",
      join: "10 balances computed",
      answer: `${lead.l.balance} days`,
      subject: most !== least ? lead.e : null,
    });
  };

  /* ---- leave + tax: the cross-document route ---- */
  const crossFor = (list: Employee[]): Decision => {
    const rows = list.map((e) => ({ e, l: computeLeave(e), c: computeTax(e.salary) }));
    const sources = [T_SRC(1), L_SRC(2), D_SRC(3), P_SRC(4)];
    const first = rows[0];
    let title: string;
    let body: string;
    if (rows.length === 1) {
      const { e, l, c } = first;
      title = `${e.name} has ${plural(l.balance, "day")} of leave left and ${c.tds > 0 ? `pays ${INR(c.tds)} TDS a month` : "owes no tax"}.`;
      const lines = [
        `• Leave: ${LEAVE_ENT} days a year (leavepolicy.pdf), ${l.taken} taken (leave.xlsx), ${l.balance} left.`,
        `• Carry-forward: ${plural(l.carry, "day")} carry over on 31 March${l.lapse > 0 ? `, ${l.lapse} lapse` : ""}.`,
        `• Tax: ${INR(c.monthly)} × 12 = ${INR(c.annual)}. After the ${INR(STD_DEDUCTION)} standard deduction (taxslabs.pdf), ${INR(c.taxable)} is taxable.`,
      ];
      if (c.tds > 0) lines.push(`• TDS: annual tax ${INR(c.annualTax)} ÷ 12 rounds to ${INR(c.tds)} a month.`);
      else lines.push(`• TDS: all of it sits in Slab 1 (0% up to ${INR(SLABS[0].hi)}), so none is due. ${INR(Math.max(0, SLABS[0].hi - c.taxable))} more taxable income fits before the 5% slab starts.`);
      body = lines.join("\n");
    } else {
      title = `Leave and tax for ${joinNames(list.map((x) => x.first))}.`;
      body = rows.map(({ e, l, c }) => `• ${e.name}: ${plural(l.balance, "day")} left, ${c.tds > 0 ? `${INR(c.tds)} TDS` : "no tax"}`).join("\n");
    }
    const f = first;
    const explain =
      `${LEAVE_RULE_TEXT} ${RULE_TEXT} ` +
      `For ${f.e.name}: leave ${LEAVE_ENT} − ${f.l.taken} = ${f.l.balance}; ${INR(f.c.monthly)} × 12 = ${INR(f.c.annual)}, minus ${INR(STD_DEDUCTION)} = ${INR(f.c.taxable)} taxable, annual tax ${INR(f.c.annualTax)}, ÷ 12 = ${INR(f.c.tds)} a month.`;
    return {
      route: mk("cross", {
        label: "Cross-document",
        reason: "The answer needs two spreadsheets and two policy documents. QueryPilot fans out to all four, applies each rule to its row, and checks every claim has a source.",
        intent: "leave_and_tax",
        title,
        body,
        sources,
        ctx: ctx(),
        path: {
          resolve: `${joinNames(list.map((x) => x.first))}, 4 sources`,
          sql: rows.length === 1 ? "1 row, salary + leave" : `${rows.length} rows, salary + leave`,
          docs: "7 slabs, ₹75,000 deduction",
          rule: `${LEAVE_ENT} days, carry ${CARRY_MAX}`,
          join: rows.length === 1 ? `${f.l.balance} days left, ${INR(f.c.tds)} TDS` : `${rows.length} people joined`,
          evidence: "4 of 4 sources agree",
          answer: rows.length === 1 ? `${f.l.balance} days, ${INR(f.c.tds)} TDS` : `${rows.length} answers`,
        },
      }),
      next: remember(title, explain, sources, "cross", rows.length === 1 ? f.e : null),
    };
  };

  /* ---- policy (documents only) ---- */
  const policyAnswer = (): Decision => {
    let title: string;
    let body: string;
    let docs: string;
    let clause: string;
    let explain: string;
    let file = "taxslabs.pdf";
    let src = D_SRC();
    if (leaveQ) {
      file = "leavepolicy.pdf";
      src = P_SRC();
      if (/\b(?:carry|carried|forward|lapse\w*|encash\w*)\b/.test(m)) {
        title = `Up to ${CARRY_MAX} unused days carry forward.`;
        body = `Leave is ${LEAVE_ENT} days a year. At the 31 March year end, up to ${CARRY_MAX} unused days carry into the next year. Anything above that lapses.`;
        docs = "clause 3, carry-forward";
        clause = `carry = min(balance, ${CARRY_MAX})`;
        explain = "I searched leavepolicy.pdf for the carry-forward clause in section 3.";
      } else {
        title = `Everyone gets ${LEAVE_ENT} days of paid leave a year.`;
        body = [
          `• ${LEAVE_ENT} days a year, the same for every employee`,
          `• Up to ${CARRY_MAX} unused days carry forward`,
          "• Days above that lapse on 31 March",
          "• Days taken are recorded in leave.xlsx",
        ].join("\n");
        docs = "clause 1, entitlement";
        clause = `${LEAVE_ENT} days a year`;
        explain = "I searched leavepolicy.pdf for the entitlement clause in section 1.";
      }
    } else if (/\b(?:standard deduction|std deduction)\b/.test(m)) {
      title = "The standard deduction is ₹75,000 a year.";
      body = "A flat amount taken off annual gross income before the slabs apply. It doesn't change with income, role or grade.";
      docs = "clause 3, standard deduction";
      clause = "taxable = gross − ₹75,000";
      explain = "I searched taxslabs.pdf for the standard deduction clause. It's section 3, a fixed ₹75,000 for every employee.";
    } else if (/\b(?:round\w*)\b/.test(m)) {
      title = "Monthly TDS is rounded to the nearest rupee.";
      body = "Halves round up, anything under half rounds down. Rounding is applied only to the final monthly figure, never to the steps before it.";
      docs = "clause 8, rounding";
      clause = "round(final monthly TDS)";
      explain = "I searched taxslabs.pdf for the rounding rule. Section 8 says only the final monthly TDS is rounded.";
    } else if (/\b(?:cess|surcharge)\b/.test(m)) {
      title = "There's no surcharge or cess.";
      body = "The policy applies the slab rates and nothing on top. It also doesn't cover PF, ESI or professional tax.";
      docs = "clauses 4 and 9, no cess";
      clause = "no surcharge, no cess";
      explain = "I searched taxslabs.pdf. Sections 4 and 9 both state that no surcharge or education cess applies.";
    } else if (/\b(?:annuali[sz]\w*|annual|per year)\b/.test(m)) {
      title = "Salary is annualised by multiplying by 12.";
      body = "Monthly gross × 12 gives annual gross income. After tax is worked out for the year, the monthly TDS is the annual tax divided by 12.";
      docs = "clause 2, annualisation";
      clause = "annual = monthly × 12";
      explain = "I searched taxslabs.pdf for the annualisation clause in section 2.";
    } else if (/\b(?:slabs?|rates?|brackets?|progressive)\b/.test(m)) {
      title = "There are seven progressive tax slabs.";
      body = [
        "• Up to ₹4,00,000: 0%",
        "• ₹4,00,001 to ₹8,00,000: 5%",
        "• ₹8,00,001 to ₹12,00,000: 10%",
        "• ₹12,00,001 to ₹16,00,000: 15%",
        "• ₹16,00,001 to ₹20,00,000: 20%",
        "• ₹20,00,001 to ₹24,00,000: 25%",
        "• Above ₹24,00,000: 30%",
        "Each rate applies only to the part of taxable income inside its slab.",
      ].join("\n");
      docs = "section 4, 7 slabs";
      clause = "7 slabs, 0% to 30%";
      explain = "I searched taxslabs.pdf for the slab table in section 4. Rates apply progressively, so each one covers only its own band of taxable income.";
    } else {
      title = "How monthly TDS is worked out.";
      body = [
        "• Annual income = monthly salary × 12",
        "• Taxable income = annual income − ₹75,000 standard deduction",
        "• Apply the seven progressive slabs to taxable income",
        "• Monthly TDS = annual tax ÷ 12, rounded to the nearest rupee",
        "Name an employee and the same method runs on their salary row.",
      ].join("\n");
      docs = "sections 2 to 5, method";
      clause = "×12 − 75,000, slabs, ÷12";
      explain = "I searched taxslabs.pdf and pulled the four-step method from section 5. No employee was named, so the table wasn't needed.";
    }
    return {
      route: mk("policy", {
        label: "Policy lookup",
        reason: "A rule question lives in a policy document, so QueryPilot searches documents and skips the tables.",
        intent: leaveQ ? "explain_leave_policy" : "explain_policy",
        title,
        body,
        sources: [src],
        ctx: ctx(),
        path: { docs, join: clause, evidence: "clause found", answer: "policy rule", file, resolve: file },
      }),
      next: remember(title, explain, [src], "policy", null),
    };
  };

  /* ---- routing decisions ---- */

  // What-if with a salary: "what if Priya earned 2 lakh", "tax on 1,50,000 a month".
  const whatIf = amount !== null && !compare && (topic === "tax" || topic === "policy" || (topic === "salary" && HYPO.test(m)) || (topic === null && (s.topic === "tax" || s.awaiting?.topic === "tax")));
  const awaitedAmount = s.awaiting?.amount ?? null;
  if (whatIf) {
    const list = named.length ? named : ctxEmp ? [ctxEmp] : [];
    inheritedEmp = !named.length && !!ctxEmp;
    if (list.length) return taxFor(list.map((e) => subjectOf(e, amount)), true, false);
    return taxFor([{ label: "That salary", first: "That salary", calc: computeTax(amount as number), emp: null }], true, false);
  }
  if (awaitedAmount !== null && named.length && bare) return taxFor(named.map((e) => subjectOf(e, awaitedAmount)), true, false);

  // Fields the tables don't have (bonus, department, ...) and topics outside the workspace.
  const field = FIELD_RE.exec(m);
  if (field && (explicitTopic === null || MONEY_FIELD.test(field[0]))) {
    const statutory = /^(?:pf|provident|esi|professional|statutory)$/.test(field[0]);
    return unsupported(
      statutory ? "That deduction isn't covered here." : "That field isn't in the workspace.",
      statutory
        ? "taxslabs.pdf covers income tax only. It doesn't cover PF, ESI, professional tax or any other statutory deduction, so I won't make a number up."
        : `The tables only have employee ID, name, monthly gross salary and days of leave taken. Nothing in the workspace covers ${field[0]}, so I won't make one up.`,
      statutory ? "unsupported_deduction" : "unsupported_field",
      statutory ? "taxslabs.pdf, income tax only" : "salary.xlsx, leave.xlsx, field not found",
    );
  }
  if (explicitTopic === null && !named.length && OUT_OF_SCOPE_RE.test(m)) {
    return unsupported(
      "That's outside this workspace.",
      "This workspace only knows salary.xlsx, leave.xlsx, taxslabs.pdf and leavepolicy.pdf, so I can't answer that without making something up. Try salaries, leave, monthly tax, or the policies.",
      "unsupported_topic",
      "4 workspace sources only",
    );
  }

  // A name that isn't in the table.
  if (!named.length && !pronoun && explicitTopic !== null) {
    const unknown = unknownName(m);
    if (unknown) {
      const who = cap(unknown);
      return {
        route: mk("notfound", {
          label: "No match, fallback",
          reason: "The table lookup returned 0 rows, so the evidence gate rejected it and QueryPilot fell back instead of inventing numbers.",
          intent: "lookup_employee",
          title: `I can't find “${who}” in the table.`,
          body: `The workspace has ten people: ${ALL_FIRST}. I won't guess numbers for someone who isn't there. Try one of them.`,
          sources: [T_SRC()],
          ctx: ctx(),
          path: { sql: `0 rows, no “${who}”` },
        }),
        next: advance({ awaiting: null }),
      };
    }
  }

  // A person but no topic: ask what to look up and remember who.
  if (topic === null && (named.length || pronoun)) {
    const e = named[0] ?? ctxEmp;
    if (!e) return clarifyEmployee(null, null, PRON.exec(m)?.[0]);
    return {
      route: mk("clarify", {
        label: "Needs clarification",
        reason: "A person was named but not what to look up, so QueryPilot keeps the name and asks for the topic.",
        intent: "ambiguous_topic",
        title: `What would you like to know about ${e.first}?`,
        body: `I can look up ${e.first}'s salary or leave balance, or work out their monthly tax.`,
        path: { plan: "missing topic", note: "waiting for a topic" },
        ctx: ctx(),
      }),
      next: advance({ employee: e.name, awaiting: null }),
    };
  }

  if (topic === "policy") return policyAnswer();

  if (topic !== null) {
    if (targets.length) {
      if (topic === "salary") return salaryFor(targets);
      if (topic === "tax") return taxFor(targets.map((e) => subjectOf(e)), false, false);
      if (topic === "leave") return leaveFor(targets);
      if (topic === "cross") return crossFor(targets);
      return profileFor(targets);
    }
    // No person: aggregate questions about everyone, otherwise ask who.
    const aggregate = isAll || aggish || TABLE_WORDS.test(m);
    if (topic === "salary") return aggregate ? salaryAggregate() : clarifyEmployee("salary", null);
    if (topic === "tax") return aggregate ? (isAll && !RANK.test(m) && !NO_TAX.test(m) ? taxFor(EMPLOYEES.map((e) => subjectOf(e)), false, true) : taxAggregate()) : clarifyEmployee("tax", null);
    if (topic === "leave") return aggregate ? leaveAggregate() : clarifyEmployee("leave", null);
    if (topic === "cross") return clarifyEmployee("cross", null);
    if (topic === "profile") return aggregate ? profileFor(EMPLOYEES) : clarifyEmployee("profile", null);
  }

  // Mentions the table but nothing specific: show the rows.
  if (TABLE_WORDS.test(m)) return profileFor(EMPLOYEES);

  // Nothing recognised. Vague wording gets a question; a clear but unknown topic gets a scoped refusal.
  const words = m.split(" ").filter(Boolean);
  const vague = /\b(?:this|that|it|these|those|something|anything|stuff|things?)\b/.test(m) || words.length <= 2;
  if (vague) {
    return {
      route: mk("clarify", {
        label: "Needs clarification",
        reason: "The request is too vague to pick a safe path, so QueryPilot asks what to look at instead of guessing.",
        intent: "ambiguous_request",
        title: "What would you like me to check?",
        body: "I can answer questions about salaries, leave, monthly tax (TDS) and the policies. Give me a person or a topic.",
        path: { plan: "missing intent or entity", note: "waiting for the user" },
      }),
      next: advance({ awaiting: null }),
    };
  }
  return unsupported(
    "That's outside this workspace.",
    "This workspace only knows salary.xlsx, leave.xlsx, taxslabs.pdf and leavepolicy.pdf, so I can't answer that without making something up. Try salaries, leave, monthly tax, or the policies.",
    "unsupported_topic",
    "4 workspace sources only",
  );
}
/* ROUTER-END */

/* -------------------------------------------------------------------------- */
/*  Trace builder                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Builds the graph state for one run from the route that produced the chat answer. Every stage the route
 * does not touch is explicitly "skipped", so the graph only ever shows the path this message took. The graph
 * draws a stage once it has started, so the graph and the chat's step list grow together.
 */
function makeTrace(runId: number, question: string, route: Route, activeIndex: number | null, finished: boolean): TraceRun {
  const stages: Partial<Record<StageId, StageState>> = {};
  STAGE_ORDER.forEach((node) => {
    stages[node] = { status: "skipped", detail: "Not part of this route" };
  });
  stages.question = { status: "done", detail: question };
  route.steps.forEach((step, index) => {
    let status: StageStatus = "pending";
    if (finished || (activeIndex !== null && index < activeIndex)) status = "done";
    if (!finished && activeIndex === index) status = "active";
    if (finished && step.end) status = step.end;
    const settled = status === "done" || status === "failed" || status === "blocked";
    stages[step.node] = { status, detail: step.detail, ms: settled ? step.ms : undefined };
  });
  return {
    id: String(runId),
    question,
    status: finished ? route.status : "running",
    stages,
    destination: route.final,
    label: route.label,
    reason: route.reason,
    totalMs: finished ? route.steps.reduce((sum, step) => sum + step.ms, 0) : undefined,
  };
}

/* -------------------------------------------------------------------------- */
/*  UI                                                                        */
/* -------------------------------------------------------------------------- */

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");
const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

/** Delay before the next character is typed. Deterministic, with a longer beat after punctuation. */
const keyDelay = (text: string, i: number) => {
  const ch = text[i - 1];
  const jitter = (ch.charCodeAt(0) * 7 + i * 13) % 34;
  const beat = /[,.?]/.test(ch) ? 140 : ch === " " ? 30 : 0;
  return 30 + jitter + beat;
};

/** The message the demo types by itself when it scrolls into view. */
const FIRST_PROMPT = "What is Rahul's leave balance and tax entitlement?";

type Size = "xs" | "sm" | "md" | "lg" | "xl";

/* The chat shows three plain steps instead of the full pipeline. A route only shows the ones it used:
   small talk is two, a blocked request is one. The graph keeps the detail. */
const PHASE_LABEL = ["Planning", "Finding evidence", "Generating answer"] as const;
const EVIDENCE_NODES = new Set<StageId>(["product", "metadata", "sql", "retrieve", "memory", "recovery", "supplement", "coverage", "cross_document", "reconcile", "evidence"]);
const ANSWER_NODES = new Set<StageId>(["finish", "fallback", "answer", "stream", "response"]);
const phaseIndex = (node: StageId) => (EVIDENCE_NODES.has(node) ? 1 : ANSWER_NODES.has(node) ? 2 : 0);

interface PhaseRow {
  i: number;
  label: string;
  ms: number;
}

function phasesOf(route: Route): PhaseRow[] {
  const rows = PHASE_LABEL.map((label, i) => ({ i, label: label as string, ms: 0, n: 0 }));
  route.steps.forEach((s) => {
    const r = rows[phaseIndex(s.node)];
    r.ms += s.ms;
    r.n += 1;
  });
  return rows.filter((r) => r.n > 0).map(({ i, label, ms }) => ({ i, label, ms }));
}

interface Msg {
  id: number;
  role: "assistant" | "user";
  text: string;
  detail?: string;
  sources?: string[];
  runId?: number;
  pending?: boolean;
  /** True for an answer that just finished live, so its body streams in once. */
  fresh?: boolean;
  /** The steps this route used, with their times. */
  phases?: PhaseRow[];
  /** Index into `phases` of the step running now. */
  cur?: number;
  /** Route name, e.g. "Cross-document". */
  label?: string;
  trace?: TraceRun;
}

interface ActiveRun {
  id: number;
  assistantId: number;
  question: string;
  route: Route;
}

/** A message being typed into the composer by the demo. */
interface Script {
  text: string;
  cancel: () => void;
}

const RICH_SPLIT = /(`[^`]+`|\b[\w-]+\.(?:xlsx|csv|pdf|docx?)\b|₹[\d,]+)/g;

/** Wraps `inline code`, file names like taxslabs.pdf (coloured by type), and rupee amounts. */
function Rich({ text }: { text: string }) {
  const parts = text.split(RICH_SPLIT);
  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;
        if (i % 2 === 0) return <React.Fragment key={i}>{part}</React.Fragment>;
        if (part.startsWith("₹")) {
          return (
            <span key={i} className="qd-amt">
              {part}
            </span>
          );
        }
        const raw = part.startsWith("`") ? part.slice(1, -1) : part;
        return (
          <code key={i} className="qd-code" data-t={/\.pdf$/.test(raw) ? "pdf" : /\.(?:xlsx|csv)$/.test(raw) ? "xlsx" : "code"}>
            {raw}
          </code>
        );
      })}
    </>
  );
}

/** Lines that start with a bullet get a hanging marker, so lists read as lists. */
function Lines({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) =>
        line.startsWith("•") ? (
          <span key={i} className="qd-li">
            <i aria-hidden />
            <span>
              <Rich text={line.replace(/^•\s?/, "")} />
            </span>
          </span>
        ) : (
          <span key={i} className="qd-ln">
            <Rich text={line} />
          </span>
        ),
      )}
    </>
  );
}

/** Reveals an answer a few words at a time. */
function Stream({ text, animate, onGrow }: { text: string; animate: boolean; onGrow?: () => void }) {
  const pieces = useMemo(() => text.split(/(\s+)/), [text]);
  const [count, setCount] = useState(animate ? 0 : pieces.length);
  const growRef = useRef(onGrow);
  growRef.current = onGrow;

  useEffect(() => {
    if (!animate) return;
    let i = 0;
    const id = window.setInterval(() => {
      i += 2;
      setCount(Math.min(pieces.length, i));
      growRef.current?.();
      if (i >= pieces.length) window.clearInterval(id);
    }, 34);
    return () => window.clearInterval(id);
  }, [animate, pieces]);

  return <Lines text={pieces.slice(0, count).join("")} />;
}

/** The files the answer read: icon by file type, the file name, then its [n] marker. */
function Sources({ sources }: { sources: string[] }) {
  return (
    <div className="qd-res">
      {sources.map((source) => {
        const pdf = source.includes(".pdf");
        const Icon = pdf ? FileText : FileSpreadsheet;
        const match = /^(.*?)(\s*\[\d+\])?$/.exec(source);
        return (
          <span key={source} className="qd-cite" data-t={pdf ? "pdf" : "xlsx"}>
            <Icon size={12} strokeWidth={1.8} aria-hidden />
            <span className="qd-ell">{match?.[1] ?? source}</span>
            {match?.[2] ? <em>{match[2].trim()}</em> : null}
          </span>
        );
      })}
    </div>
  );
}

/** While the agent works: the steps this route uses, a spinner on the current one, a tick on finished ones. */
function Steps({ message }: { message: Msg }) {
  const phases = message.phases ?? [];
  const cur = message.cur ?? -1;
  return (
    <ul className="qd-steps" aria-label="Progress">
      {phases.map((p, i) => {
        const s = i < cur ? "done" : i === cur ? "live" : "next";
        return (
          <li key={p.i} data-s={s}>
            <span className="qd-mark" aria-hidden>
              {s === "done" ? <Check size={10} strokeWidth={3} /> : null}
            </span>
            {p.label}
          </li>
        );
      })}
    </ul>
  );
}

/** After the answer: one collapsed line that opens into the same steps with their times. */
function Recap({ message, canView, selected, onView }: { message: Msg; canView: boolean; selected: boolean; onView: () => void }) {
  const [open, setOpen] = useState(false);
  const phases = message.phases ?? [];
  if (!phases.length) return null;
  const total = phases.reduce((sum, p) => sum + p.ms, 0);
  return (
    <div className="qd-recap">
      <div className="qd-rrow">
        <button type="button" className="qd-rb" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <ChevronRight size={13} strokeWidth={2.2} className="qd-chev" data-open={open ? "1" : "0"} aria-hidden />
          {message.label} <span className="qd-dim">· {formatMs(total)}</span>
        </button>
        {message.trace && !selected ? (
          <button type="button" className="qd-rb qd-view" disabled={!canView} onClick={onView}>
            View in graph
          </button>
        ) : null}
      </div>
      {open ? (
        <ul className="qd-ph qd-fade">
          {phases.map((p) => (
            <li key={p.i}>
              <span>{p.label}</span>
              <span className="qd-mono qd-dim">{formatMs(p.ms)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

const STYLES = `
.qd, .qd * { box-sizing: border-box; }
.qd {
  --fs: 15px;
  --px: calc(var(--fs) * 1.6);
  --ink: #ececec; --ink2: rgba(236,236,236,.8); --ink3: rgba(236,236,236,.55); --ink4: rgba(236,236,236,.34);
  --line: rgba(255,255,255,.08); --line2: rgba(255,255,255,.16);
  --raise: #1c1c1f;
  --ok: #86d4ab;
  --tbl: ${QP.table}; --docs: ${QP.docs};
  position: relative;
  display: flex; flex-direction: column; min-height: 0; min-width: 0; overflow: hidden;
  background: transparent;
  color: var(--ink); font-family: ${SANS}; color-scheme: dark;
}
.qd[data-size="xs"] { --px: calc(var(--fs) * 1.1); }
.qd[data-size="sm"] { --px: calc(var(--fs) * 1.3); }
.qd ::selection { background: rgba(255,255,255,.2); color: #fff; }
:where(.qd) button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; }
:where(.qd) button:disabled { cursor: default; }
.qd button:focus-visible { outline: 2px solid rgba(255,255,255,.7); outline-offset: 2px; }
.qd-mono { font-family: ${MONO}; font-variant-numeric: tabular-nums; }
.qd-t { font-size: var(--fs); line-height: 1.6; }
.qd-dim { color: var(--ink4); }
.qd-ell { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.qd-sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.qd-scroll { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.16) transparent; }
.qd-px { padding-left: var(--px); padding-right: var(--px); }
.qd-col { width: 100%; max-width: calc(var(--fs) * 46); margin: 0 auto; }

/* conversation */
.qd-feed { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding-top: calc(var(--fs) * 1.4); padding-bottom: calc(var(--fs) * 1.2); }
.qd-stack { display: grid; gap: calc(var(--fs) * 1.8); }
.qd-in { animation: qd-in .2s ease-out both; }
.qd-fade { animation: qd-in .16s ease-out both; }
.qd-u { display: flex; justify-content: flex-end; }
/* a sent message lands from the composer: slightly large and low, then settles to size */
.qd-ub { max-width: 86%; overflow-wrap: anywhere; padding: 10px 16px; border-radius: 18px; background: var(--raise); border: 1px solid var(--line); transform-origin: 100% 100%; animation: qd-land .42s cubic-bezier(.2,.8,.2,1) both; }
.qd-a { display: grid; gap: 12px; min-width: 0; }
.qd-h { margin: 0; font-size: calc(var(--fs) * 1.04); font-weight: 560; line-height: 1.45; letter-spacing: -.012em; color: var(--ink); }
.qd-b { margin: -6px 0 0; color: var(--ink2); }
.qd-ln { display: block; } .qd-ln + .qd-ln, .qd-ln + .qd-li, .qd-li + .qd-ln, .qd-li + .qd-li { margin-top: 3px; }
.qd-li { display: flex; gap: 10px; }
.qd-li i { flex: none; width: 6px; height: 1px; margin-top: calc(var(--fs) * .8); background: var(--ink3); }
.qd-amt { font-family: ${MONO}; font-variant-numeric: tabular-nums; font-weight: 600; letter-spacing: -.02em; color: #fff; }
.qd-code { padding: 1px 6px; border-radius: 5px; border: 1px solid var(--line); background: rgba(255,255,255,.04); font-family: ${MONO}; font-size: .86em; color: var(--ink); }
.qd-code[data-t="xlsx"] { color: var(--tbl); } .qd-code[data-t="pdf"] { color: var(--docs); }

/* live steps */
.qd-steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.qd-steps li { display: flex; align-items: center; gap: 10px; font-size: calc(var(--fs) * .92); color: var(--ink4); transition: color .2s; }
.qd-steps li[data-s="live"] { color: var(--ink); }
.qd-steps li[data-s="done"] { color: var(--ink3); }
.qd-mark { display: grid; place-items: center; flex: none; width: 16px; height: 16px; border-radius: 99px; border: 1.5px solid var(--line2); }
.qd-steps li[data-s="done"] .qd-mark { background: var(--ok); border-color: var(--ok); color: #08140d; }
.qd-steps li[data-s="live"] .qd-mark { border-color: var(--ink); border-top-color: transparent; animation: qd-spin .8s linear infinite; }

/* recap above a finished answer */
.qd-rrow { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.qd-rb { display: inline-flex; align-items: center; gap: 6px; min-height: 24px; font-size: calc(var(--fs) * .86); color: var(--ink3); transition: color .15s; }
.qd-rb:hover:not(:disabled) { color: var(--ink); }
.qd-view { font-size: calc(var(--fs) * .8); }
.qd-chev { transition: transform .15s; } .qd-chev[data-open="1"] { transform: rotate(90deg); }
.qd-ph { list-style: none; margin: 6px 0 0; padding: 0 0 0 10px; border-left: 1px solid var(--line2); display: grid; gap: 6px; font-size: calc(var(--fs) * .84); color: var(--ink2); }
.qd-ph li { display: flex; justify-content: space-between; gap: 16px; }

/* sources the answer read */
.qd-res { display: grid; gap: 3px; min-width: 0; padding: 1px 0 1px 10px; border-left: 1px solid var(--line2); font-family: ${MONO}; font-size: calc(var(--fs) * .74); line-height: 1.5; color: var(--ink2); }
.qd-cite { display: flex; align-items: center; gap: 7px; min-width: 0; }
.qd-cite svg { flex: none; }
.qd-cite em { flex: none; font-style: normal; color: var(--ink4); }
.qd-cite[data-t="xlsx"] svg { color: var(--tbl); } .qd-cite[data-t="pdf"] svg { color: var(--docs); }

/* follow-ups: one row, scrolls sideways, fades out on the right edge.
   Selectors carry the .qd prefix so a host page's button reset cannot strip the pill. */
.qd .qd-try { display: flex; align-items: center; gap: 6px; flex: none; padding: 3px 1px 12px; overflow-x: auto; overscroll-behavior-x: contain; scrollbar-width: none; -webkit-overflow-scrolling: touch; -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 28px), transparent); mask-image: linear-gradient(90deg, #000 calc(100% - 28px), transparent); }
.qd .qd-try::-webkit-scrollbar { display: none; }
.qd .qd-chip { flex: none; min-height: 32px; padding: 0 13px; border-radius: 99px; border: 1px solid var(--line2); background: transparent; color: var(--ink2); font-size: calc(var(--fs) * .86); white-space: nowrap; transition: border-color .15s, background .15s, color .15s; }
.qd .qd-chip:hover { border-color: var(--ink3); background: rgba(255,255,255,.06); color: var(--ink); }

/* composer. The rounded container shows focus, so the textarea draws no outline of its own. */
.qd-dock { flex: none; padding-top: 2px; padding-bottom: calc(var(--fs) * 1.1); }
.qd-cmp { display: flex; align-items: flex-end; gap: 6px; padding: 0 8px 0 0; border-radius: 18px; border: 1px solid var(--line2); background: rgba(255,255,255,.02); transition: border-color .15s; }
.qd-cmp:focus-within, .qd-cmp[data-typing="1"] { border-color: var(--ink3); }
.qd .qd-input { display: block; flex: 1; min-width: 0; min-height: 48px; max-height: 128px; resize: none; padding: 13px 4px 13px 18px; border: 0; outline: none; background: transparent; color: var(--ink); font: inherit; font-size: max(16px, var(--fs)); line-height: 1.5; }
.qd .qd-input:focus, .qd .qd-input:focus-visible { outline: none; box-shadow: none; }
.qd-input::placeholder { color: var(--ink4); }
.qd .qd-send, .qd .qd-skip { display: grid; place-items: center; flex: none; width: 32px; height: 32px; margin-bottom: 8px; border-radius: 99px; transition: background .15s, color .15s, transform .12s; }
.qd .qd-send { background: var(--ink); color: #0b0b0c; }
.qd .qd-send:hover:not(:disabled) { background: #fff; }
.qd .qd-send:disabled { background: rgba(255,255,255,.1); color: var(--ink4); }
.qd .qd-send[data-press="1"] { background: #fff; transform: scale(.84); }
.qd .qd-skip { border: 1px solid var(--ink3); color: var(--ink); }
.qd .qd-skip:hover { background: rgba(255,255,255,.08); }

@keyframes qd-in { from { opacity: 0; transform: translateY(3px) } to { opacity: 1; transform: none } }
@keyframes qd-land { from { opacity: 0; transform: translateY(26px) scale(1.12) } to { opacity: 1; transform: none } }
@keyframes qd-spin { to { transform: rotate(360deg) } }
@media (prefers-reduced-motion: reduce) {
  .qd-in, .qd-fade, .qd-ub, .qd-steps li[data-s="live"] .qd-mark { animation: none; }
  .qd-chev, .qd .qd-send { transition: none; }
  .qd .qd-send[data-press="1"] { transform: none; }
}
`;

/**
 * Give this component a definite height from its parent
 * (e.g. `className="h-full"` inside a flex cell). The conversation scrolls inside it.
 * The parent decides what to do with the trace: open the graph panel when a run arrives.
 */
export function QueryPilotDemo({ className = "", onTraceChange, autoPlayFirst = true }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [typing, setTyping] = useState(false);
  const [pressing, setPressing] = useState(false);
  const [turns, setTurns] = useState(0);
  const [chips, setChips] = useState<string[]>([]);
  const [selectedRun, setSelectedRun] = useState<number | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [inView, setInView] = useState(false);
  const [fs, setFs] = useState(15);
  const [size, setSize] = useState<Size>("md");

  const sessionRef = useRef<Session>(initialSession());
  const activeRef = useRef<ActiveRun | null>(null);
  const scriptRef = useRef<Script | null>(null);
  const reduceRef = useRef(false);
  const started = useRef(false);
  const stick = useRef(true);
  const runCounter = useRef(0);
  const nextId = useRef(1);
  const onTraceRef = useRef(onTraceChange);
  const rootRef = useRef<HTMLElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    onTraceRef.current = onTraceChange;
  }, [onTraceChange]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReduceMotion(media.matches);
      reduceRef.current = media.matches;
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.22 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Type scale and layout follow the panel width and, on very large screens, the viewport.
  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    const measure = () => {
      const w = element.getBoundingClientRect().width;
      const vw = window.innerWidth;
      let f = 14;
      if (w >= 400) f += 0.5;
      if (w >= 560) f += 0.5;
      if (w >= 780) f += 1;
      if (vw >= 1800) f += 1;
      if (vw >= 2500) f += 2;
      setFs(f);
      setSize(w < 380 ? "xs" : w < 520 ? "sm" : w < 720 ? "md" : w < 1000 ? "lg" : "xl");
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Keep the newest message in view, unless the reader scrolled up.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stick.current) el.scrollTo({ top: el.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" });
  }, [messages, running, chips, reduceMotion]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [input]);

  /** Called while an answer streams in, so the view follows the growing text. */
  const followStream = useCallback(() => {
    const el = scrollRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, []);

  /** Turns a run into its final chat state. Used for normal completion, "skip", and being interrupted. */
  const settle = useCallback((run: ActiveRun): TraceRun => {
    const trace = makeTrace(run.id, run.question, run.route, run.route.steps.length - 1, true);
    const phases = phasesOf(run.route);
    setMessages((previous) =>
      previous.map((message) =>
        message.id === run.assistantId
          ? {
              ...message,
              pending: false,
              fresh: true,
              cur: undefined,
              text: run.route.title,
              detail: run.route.body,
              sources: run.route.sources,
              label: run.route.label,
              phases,
              trace,
            }
          : message,
      ),
    );
    return trace;
  }, []);

  const finishUi = useCallback(() => {
    setRunning(false);
    setChips(suggestionsFor(sessionRef.current).slice(0, 3));
  }, []);

  const startRun = useCallback(
    (question: string) => {
      const text = question.trim();
      if (!text) return;
      started.current = true;
      stick.current = true;

      // A new message while one is still running: settle the old one so its bubble shows the answer
      // that matches its own question, then start the new run.
      const previous = activeRef.current;
      if (previous) {
        settle(previous);
        activeRef.current = null;
      }

      // Routing happens once, here. The same Route drives the answer, the graph and the steps.
      const { route, next } = routeMessage(text, sessionRef.current);
      sessionRef.current = next;

      const id = ++runCounter.current;
      const userId = nextId.current++;
      const assistantId = nextId.current++;
      const run: ActiveRun = { id, assistantId, question: text, route };
      const phases = phasesOf(route);
      activeRef.current = run;

      setRunning(true);
      setSelectedRun(id);
      setTurns((t) => t + 1);
      setChips([]);
      setMessages((prev) => [
        ...prev,
        { id: userId, role: "user", text },
        { id: assistantId, role: "assistant", text: "Working", pending: true, runId: id, phases, cur: -1 },
      ]);

      const send = (trace: TraceRun) => {
        if (activeRef.current?.id === id) onTraceRef.current?.(trace);
      };
      send(makeTrace(id, text, route, null, false));

      void (async () => {
        for (let i = 0; i < route.steps.length; i++) {
          if (activeRef.current?.id !== id) return;
          const step = route.steps[i];
          const cur = phases.findIndex((p) => p.i === phaseIndex(step.node));
          // The chat step and the graph step start together: both come from this loop.
          setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, cur } : m)));
          send(makeTrace(id, text, route, i, false));
          await new Promise<void>((resolve) => window.setTimeout(resolve, reduceRef.current ? 90 : step.ms));
        }
        if (activeRef.current?.id !== id) return;
        // Hold on the finished route for a moment before the graph rearranges and the answer appears.
        if (!reduceRef.current) {
          send(makeTrace(id, text, route, route.steps.length, false));
          await new Promise<void>((resolve) => window.setTimeout(resolve, HOLD));
          if (activeRef.current?.id !== id) return;
        }
        const trace = settle(run);
        activeRef.current = null;
        onTraceRef.current?.(trace);
        finishUi();
      })();
    },
    [settle, finishUi],
  );

  const cancelScript = useCallback(() => {
    scriptRef.current?.cancel();
    scriptRef.current = null;
    setTyping(false);
    setPressing(false);
  }, []);

  /**
   * Types a message into the composer one character at a time, presses send, then starts the run. With
   * reduced motion it skips the typing and sends straight away.
   */
  const play = useCallback(
    (text: string) => {
      started.current = true;
      cancelScript();
      if (reduceRef.current) {
        setInput("");
        startRun(text);
        return;
      }
      let cancelled = false;
      scriptRef.current = { text, cancel: () => (cancelled = true) };
      setInput("");
      setTyping(true);
      void (async () => {
        for (let i = 1; i <= text.length; i++) {
          await sleep(keyDelay(text, i));
          if (cancelled) return;
          setInput(text.slice(0, i));
        }
        await sleep(420);
        if (cancelled) return;
        setPressing(true);
        await sleep(180);
        if (cancelled) return;
        scriptRef.current = null;
        setPressing(false);
        setTyping(false);
        setInput("");
        startRun(text);
      })();
    },
    [cancelScript, startRun],
  );

  const skip = () => {
    const run = activeRef.current;
    if (!run) return;
    const trace = settle(run);
    activeRef.current = null;
    onTraceRef.current?.(trace);
    finishUi();
  };

  useEffect(() => {
    if (!autoPlayFirst || !inView || started.current) return;
    play(FIRST_PROMPT);
  }, [autoPlayFirst, inView, play]);

  // Cancel any in-flight typing or run on unmount.
  useEffect(
    () => () => {
      scriptRef.current?.cancel();
      scriptRef.current = null;
      activeRef.current = null;
    },
    [],
  );

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    // Sending while the demo is still typing sends the full message at once.
    const script = scriptRef.current;
    if (script) {
      cancelScript();
      setInput("");
      startRun(script.text);
      return;
    }
    const text = input.trim();
    if (!text) return;
    setInput("");
    startRun(text);
  };

  const viewTrace = (message: Msg) => {
    if (running || !message.trace) return;
    setSelectedRun(message.runId ?? null);
    onTraceRef.current?.(message.trace);
  };

  const canSend = input.trim().length > 0;
  const showSkip = running && !canSend;
  const showChips = !running && !typing && turns > 0 && chips.length > 0;

  return (
    <section
      ref={rootRef}
      data-size={size}
      className={cx("qd", className)}
      style={{ ["--fs" as string]: `${fs}px` }}
      aria-label="QueryPilot interactive chat demo"
    >
      <style>{STYLES}</style>

      <span className="qd-sr" role="status" aria-live="polite">
        {running ? "Working" : turns > 0 ? "Ready" : ""}
      </span>

      <div
        ref={scrollRef}
        onScroll={(event) => {
          const el = event.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="qd-feed qd-scroll qd-px"
      >
        <div className="qd-col">
          <div className="qd-stack">
            {messages.map((message) =>
              message.role === "user" ? (
                <div key={message.id} className="qd-u">
                  <div className="qd-ub qd-t">
                    <Rich text={message.text} />
                  </div>
                </div>
              ) : (
                <div key={message.id} className="qd-in qd-a qd-t">
                  {message.pending ? (
                    <Steps message={message} />
                  ) : (
                    <>
                      <Recap message={message} canView={!running} selected={selectedRun === message.runId} onView={() => viewTrace(message)} />
                      <p className="qd-h">
                        <Rich text={message.text} />
                      </p>
                      {message.detail ? (
                        <p className="qd-b">
                          <Stream text={message.detail} animate={!!message.fresh && !reduceMotion} onGrow={followStream} />
                        </p>
                      ) : null}
                      {message.sources && message.sources.length > 0 ? <Sources sources={message.sources} /> : null}
                    </>
                  )}
                </div>
              ),
            )}
          </div>
        </div>
      </div>

      {/* follow-ups: one scrollable row of self-contained suggestions, next to the composer */}
      {showChips ? (
        <div className="qd-px qd-fade">
          <div className="qd-col qd-try" role="group" aria-label="Suggested follow-ups">
            {chips.map((chip) => (
              <button key={chip} type="button" onClick={() => play(chip)} className="qd-chip" title={chip}>
                {chip}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="qd-dock qd-px">
        <div className="qd-col">
          <form onSubmit={submit} className="qd-cmp" data-typing={typing ? "1" : "0"}>
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              maxLength={400}
              readOnly={typing}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  submit();
                }
              }}
              placeholder={running ? "Send another message to interrupt" : turns > 0 ? "Ask a follow-up" : "Ask about salaries, leave or tax"}
              aria-label="Ask QueryPilot a question"
              className="qd-input"
            />
            {showSkip ? (
              <button type="button" onClick={skip} aria-label="Skip to the answer" title="Skip to the answer" className="qd-skip">
                <FastForward size={14} strokeWidth={2} />
              </button>
            ) : (
              <button type="submit" disabled={!canSend} data-press={pressing ? "1" : "0"} aria-label={running ? "Send and interrupt" : "Send"} title={running ? "Send and interrupt" : "Send"} className="qd-send">
                <ArrowUp size={16} strokeWidth={2.4} />
              </button>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}
export default QueryPilotDemo;