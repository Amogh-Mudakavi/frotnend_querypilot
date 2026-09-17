"use client";

import {
  ArrowUp,
  Check,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  Grid2X2,
  Home,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Settings,
  ThumbsDown,
  ThumbsUp,
  Copy,
  X,
} from "lucide-react";

const QUESTION =
  "How much salary should be deducted from Rahul Sharma based on his leave taken and the salary rules?";

const STEPS = [
  "Understanding question",
  "Resolving Rahul Sharma",
  "Planning execution",
  "Retrieving evidence",
  "Validating answer",
];

const HISTORY = [
  "Rahul salary deduction",
  "Leave policy explanation",
  "Employee salary details",
  "Working days vs leave",
  "Half-day leave calculation",
];

const HISTORY_YESTERDAY = ["Q2 payroll analysis", "Leave balance check"];

type Phase = "upload" | "typing" | "sent" | "thinking" | "answer";

export function QueryPilotApp({ elapsed = 0 }: { elapsed?: number }) {
  /*
   * Demo lifecycle intentionally remains unchanged:
   *
   * 0s  - 3s   upload
   * 3s  - 8s   typing
   * 8s  - 9s   sent
   * 9s  - 23s  thinking
   * 23s+       answer
   *
   * public-site.tsx owns the demo clock.
   * This component only derives its visual state from elapsed.
   */
  const phase: Phase =
    elapsed < 3000
      ? "upload"
      : elapsed < 8000
        ? "typing"
        : elapsed < 9000
          ? "sent"
          : elapsed < 23000
            ? "thinking"
            : "answer";

  const typingProgress = Math.max(0, Math.min(1, (elapsed - 3000) / 5000));

  const typed = QUESTION.slice(0, Math.floor(typingProgress * QUESTION.length));

  const stepIndex =
    phase === "thinking"
      ? Math.min(STEPS.length - 1, Math.floor((elapsed - 9000) / 2800))
      : STEPS.length;

  /*
   * The question only enters the conversation once it is sent.
   * During typing it exists exclusively inside the composer.
   * This prevents the "duplicate user message while typing" glitch.
   */
  const showConversation =
    phase === "sent" || phase === "thinking" || phase === "answer";

  return (
    <main className="h-full min-h-0 overflow-hidden bg-white text-[#111318]">
      <section className="h-full min-h-0 overflow-hidden bg-white">
        <div className="grid h-full min-h-0 grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)]">
          <Sidebar />

          <div className="relative flex min-h-0 min-w-0 flex-col bg-white">
            {/* ----------------------------------------------------------------
                Conversation header
               ---------------------------------------------------------------- */}
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-[#EEF0F3] px-5">
              <div className="flex items-center gap-2 text-sm font-medium text-[#3B404B]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#3FB984]" />
                Ask QueryPilot
              </div>

              <div className="flex items-center gap-2">
                <button className="rounded-md border border-[#E5E7EB] px-3 py-1.5 text-xs text-[#687184]">
                  Share
                </button>

                <MoreHorizontal className="h-4 w-4 text-[#9AA1AF]" />
              </div>
            </div>

            {/* ----------------------------------------------------------------
                Main conversation surface

                Important:
                - The surface itself remains clipped to the product window.
                - Internal content gets min-w-0 so flex/grid cannot force it
                  beyond the available width.
                - We intentionally do not alter the outer window dimensions.
               ---------------------------------------------------------------- */}
            <div className="min-h-0 min-w-0 flex-1 overflow-hidden px-5 py-5 sm:px-8 sm:py-7">
              {phase === "upload" ? <UploadState elapsed={elapsed} /> : null}

              {phase !== "upload" ? (
                <div className="mx-auto flex h-full min-h-0 w-full max-w-[640px] flex-col justify-end pb-2">
                  {showConversation ? (
                    <div className="min-w-0 space-y-5">
                      <UserMessage text={QUESTION} />

                      {phase === "thinking" || phase === "answer" ? (
                        <AssistantMessage>
                          {phase === "thinking" ? (
                            <ThinkingPanel stepIndex={stepIndex} />
                          ) : (
                            <AnswerPanel />
                          )}
                        </AssistantMessage>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* ----------------------------------------------------------------
                Composer

                Production fix:
                The old composer used `truncate`, which forced the demo
                question into one line and clipped the typed content. A later
                fix capped it at two lines with `max-h-10 overflow-hidden`,
                which still clipped on narrower renders of the window.

                The composer now has no height cap: it wraps naturally and
                grows with the typed text, so the full question stays
                visible and stable while it's being typed, however many
                lines it takes. `break-words` still stops a long token from
                escaping horizontally, and the composer sits inside the
                scrollable product window, so it can never push the window
                itself off-screen.
               ---------------------------------------------------------------- */}
            <div className="shrink-0 border-t border-[#EEF0F3] px-5 py-3.5 sm:px-8">
              <div className="mx-auto flex min-h-[44px] max-w-[640px] items-end gap-3 rounded-xl border border-[#E5E7EB] bg-[#FBFBFC] px-3.5 py-2.5">
                <Paperclip className="mb-0.5 h-4 w-4 shrink-0 text-[#9AA1AF]" />

                <div className="min-w-0 flex-1 text-xs leading-5 text-[#20242B]">
                  {phase === "typing" ? (
                    <div className="break-words whitespace-normal">
                      {typed}

                      <span className="ml-0.5 inline-block h-3.5 w-px animate-pulse bg-[#20242B] align-middle" />
                    </div>
                  ) : (
                    <span className="text-[#9AA1AF]">
                      Ask anything about your documents...
                    </span>
                  )}
                </div>

                <button
                  className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#111318] text-white"
                  aria-label="Send"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Sidebar() {
  return (
    <aside className="hidden min-h-0 flex-col border-r border-[#EEF0F3] bg-[#FBFBFC] p-4 md:flex">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#111318]">
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[#3FB984] text-[#3FB984]">
            <span className="h-2 w-2 rounded-full bg-[#3FB984]" />
          </span>
          QueryPilot
        </div>

        <X className="h-3.5 w-3.5 text-[#9AA1AF]" />
      </div>

      <button className="mb-3 flex w-full items-center justify-between rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-left">
        <div>
          <p className="text-xs font-medium text-[#111318]">
            HR Analysis Workspace
          </p>

          <p className="mt-0.5 text-[10px] text-[#9AA1AF]">
            Personal workspace
          </p>
        </div>

        <ChevronDown className="h-3.5 w-3.5 text-[#9AA1AF]" />
      </button>

      <button className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg border border-[#E5E7EB] py-2 text-xs font-medium text-[#3B404B]">
        <Plus className="h-3.5 w-3.5" />
        New Chat
      </button>

      <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#E5E7EB] px-3 py-2 text-xs text-[#9AA1AF]">
        <Search className="h-3.5 w-3.5" />
        Search chats...
        <span className="ml-auto text-[10px] text-[#9AA1AF]">⌘ K</span>
      </div>

      <nav className="space-y-0.5 border-b border-[#EEF0F3] pb-4 text-xs text-[#687184]">
        <NavItem icon={<Home className="h-3.5 w-3.5" />} label="Home" />

        <NavItem
          icon={<FileText className="h-3.5 w-3.5" />}
          label="Documents"
        />

        <NavItem
          icon={<Grid2X2 className="h-3.5 w-3.5" />}
          label="Workspaces"
        />
      </nav>

      <div className="mt-4 min-h-0 flex-1 overflow-hidden">
        <p className="px-2 text-[10px] font-medium text-[#9AA1AF]">Today</p>

        <div className="mt-1.5 space-y-0.5 text-xs text-[#687184]">
          {HISTORY.map((label, i) => (
            <div
              key={label}
              className={
                i === 0
                  ? "rounded-md bg-[#F1F2F5] px-2.5 py-1.5 text-[#111318]"
                  : "truncate rounded-md px-2.5 py-1.5"
              }
            >
              {label}
            </div>
          ))}
        </div>

        <p className="mt-4 px-2 text-[10px] font-medium text-[#9AA1AF]">
          Yesterday
        </p>

        <div className="mt-1.5 space-y-0.5 text-xs text-[#687184]">
          {HISTORY_YESTERDAY.map((label) => (
            <div key={label} className="truncate rounded-md px-2.5 py-1.5">
              {label}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 border-t border-[#EEF0F3] pt-3 text-xs text-[#687184]">
        <div className="flex items-center gap-2 px-1.5 py-1.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F1F2F5] text-[10px] font-medium text-[#3B404B]">
            A
          </span>

          <div className="min-w-0 leading-tight">
            <p className="truncate text-[#3B404B]">Amogh</p>

            <p className="truncate text-[10px] text-[#9AA1AF]">
              QueryPilot builder
            </p>
          </div>
        </div>

        <div className="mt-1 flex items-center gap-2 px-1.5 py-1.5">
          <Settings className="h-3.5 w-3.5" />
          Settings
        </div>
      </div>
    </aside>
  );
}

function NavItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
      {icon}
      {label}
    </div>
  );
}

function UploadState({ elapsed }: { elapsed: number }) {
  const progress = Math.min(1, elapsed / 3000);
  const complete = progress >= 0.92;

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center">
      <div className="w-full max-w-[470px]">
        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[#9AA1AF]">
          Workspace sources
        </p>

        <h3 className="mt-2 text-base font-medium tracking-tight text-[#111318]">
          Preparing your workspace
        </h3>

        <div className="mt-5 space-y-2.5">
          <UploadRow
            icon={<FileText className="h-4 w-4" />}
            name="salary.pdf"
            progress={progress}
            complete={complete}
          />

          <UploadRow
            icon={<FileSpreadsheet className="h-4 w-4" />}
            name="employee.xlsx"
            progress={progress}
            complete={complete}
          />
        </div>
      </div>
    </div>
  );
}

function UploadRow({
  icon,
  name,
  progress,
  complete,
}: {
  icon: React.ReactNode;
  name: string;
  progress: number;
  complete: boolean;
}) {
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-[#FBFBFC] px-3.5 py-3">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#687184]">
          {icon}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-xs font-medium text-[#111318]">
              {name}
            </p>

            {complete ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-[#3FB984]" />
            ) : (
              <span className="text-[10px] text-[#9AA1AF]">Uploading</span>
            )}
          </div>

          <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#EEF0F3]">
            <div
              className="h-full rounded-full bg-[#9AA1AF] transition-[width] duration-100"
              style={{
                width: `${Math.max(8, progress * 100)}%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function UserMessage({ text }: { text: string }) {
  return (
    <div className="flex min-w-0 items-start justify-end gap-3">
      <div className="max-w-[480px] break-words rounded-xl rounded-tr-md bg-[#F1F2F5] px-4 py-3 text-sm leading-6 text-[#111318]">
        {text}
      </div>

      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F1F2F5] text-[10px] font-medium text-[#3B404B]">
        A
      </span>
    </div>
  );
}

function AssistantMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-2.5 flex items-center gap-2 text-xs font-medium text-[#3B404B]">
        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[#3FB984] text-[#3FB984]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#3FB984]" />
        </span>
        QueryPilot
        <span className="text-[10px] font-normal text-[#9AA1AF]">just now</span>
      </div>

      {children}
    </div>
  );
}

function ThinkingPanel({ stepIndex }: { stepIndex: number }) {
  return (
    <div className="rounded-xl border border-[#EEF0F3] bg-[#FBFBFC] p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-medium text-[#3B404B]">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[#9AA1AF]" />
        Working through your question...
      </div>

      <div className="space-y-2">
        {STEPS.map((step, i) => (
          <div key={step} className="flex items-center gap-2.5 text-xs">
            {i < stepIndex ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-[#3FB984]" />
            ) : i === stepIndex ? (
              <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-[#9AA1AF] bg-white" />
            ) : (
              <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-[#E5E7EB]" />
            )}

            <span
              className={
                i < stepIndex
                  ? "text-[#3B404B]"
                  : i === stepIndex
                    ? "text-[#111318]"
                    : "text-[#9AA1AF]"
              }
            >
              {step}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnswerPanel() {
  return (
    <div className="min-w-0 space-y-4">
      <p className="break-words text-sm leading-6 text-[#111318]">
        <span className="font-semibold">
          Rahul Sharma has no salary deduction.
        </span>{" "}
        He took 12 days of leave against a 20-day paid-leave entitlement, so his
        unpaid leave is 0 days and his salary remains ₹60,000.
      </p>

      <div className="rounded-xl border border-[#EEF0F3] bg-[#FBFBFC] p-4">
        <p className="mb-3 text-xs font-medium text-[#687184]">
          Calculation Details
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Metric label="Monthly Salary" value="₹60,000" />

          <Metric label="Paid Leave Entitlement" value="20 days" />

          <Metric label="Leave Taken" value="12 days" />

          <Metric label="Unpaid Leave Days" value="0 days" />

          <Metric label="Salary Deduction" value="₹0" green />
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-[#687184]">
          Sources <span className="text-[#9AA1AF]">2</span>
        </p>

        <div className="flex flex-wrap gap-2">
          <SourceChip
            icon={<FileSpreadsheet className="h-3.5 w-3.5 text-[#3FB984]" />}
            label="employee.xlsx"
            sub="Employee data"
            tag="1"
          />

          <SourceChip
            icon={<FileText className="h-3.5 w-3.5 text-[#687184]" />}
            label="salary.pdf"
            sub="Salary rules"
            tag="2"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1 text-[#9AA1AF]">
        <ThumbsUp className="h-3.5 w-3.5" />
        <ThumbsDown className="h-3.5 w-3.5" />
        <Copy className="h-3.5 w-3.5" />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  green = false,
}: {
  label: string;
  value: string;
  green?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] text-[#9AA1AF]">{label}</p>

      <p
        className={`mt-1 break-words text-xs font-semibold ${
          green ? "text-[#3FB984]" : "text-[#111318]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function SourceChip({
  icon,
  label,
  sub,
  tag,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  tag: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[#EEF0F3] bg-[#FBFBFC] px-3 py-2">
      {icon}

      <div className="min-w-0 leading-tight">
        <p className="truncate text-xs text-[#3B404B]">{label}</p>

        <p className="truncate text-[10px] text-[#9AA1AF]">{sub}</p>
      </div>

      <span className="ml-1 shrink-0 text-[10px] text-[#9AA1AF]">[{tag}]</span>
    </div>
  );
}