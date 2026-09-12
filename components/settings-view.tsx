"use client";

import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  FolderOpen,
  LogOut,
  Menu,
  Settings,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  authApi,
  workspaceApi,
  type ApiError,
  type User,
  type Workspace,
} from "@/lib/django-api";

function getErrorMessage(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

function Button({
  children,
  variant = "secondary",
  onClick,
  disabled = false,
  className = "",
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const styles =
    variant === "primary"
      ? "border-transparent bg-[#0c6b43] text-white hover:bg-[#095d3a]"
      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-950";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-[12px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function SettingsView() {
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    Promise.all([authApi.me(), workspaceApi.list()])
      .then(([me, workspaceItems]) => {
        if (!mounted) return;
        setUser(me);
        setWorkspaces(workspaceItems);
      })
      .catch((err) => {
        if (!mounted) return;

        const apiError = err as ApiError;

        if (apiError.status === 401 || apiError.status === 403) {
          authApi.clearTokens();
          router.replace("/login");
          return;
        }

        setError(getErrorMessage(err));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [router]);

  const logout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      await authApi.logout();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      router.replace("/login");
    }
  };

  const initials = (() => {
    const source = user?.username?.trim() || user?.email?.trim() || "";
    if (!source) return "—";

    const parts = source.split(/\s+/).filter(Boolean);

    return parts.length >= 2
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : source.slice(0, 2).toUpperCase();
  })();

  const displayName = user?.username?.trim() || "Account";

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbfcfb] text-slate-900">
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-sm text-slate-400">Loading settings…</div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#fbfcfb] text-slate-900">
      <div className="relative flex min-h-screen overflow-hidden">
        {/* Desktop QueryPilot shell */}
        <aside className="relative z-30 hidden w-[260px] shrink-0 border-r border-slate-200/80 bg-white/90 backdrop-blur-xl lg:flex lg:flex-col">
          <div className="px-7 pt-7">
            <Link href="/workspaces" className="flex items-center gap-2.5">
              <img
                src="/querypilot-logo.svg"
                alt="QueryPilot"
                className="size-6 object-contain"
              />
              <span className="text-[17px] font-semibold tracking-[-0.035em] text-slate-950">
                QueryPilot
              </span>
            </Link>
          </div>

          <nav className="mt-10 px-4" aria-label="Primary navigation">
            <Link
              href="/workspaces"
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-[14px] font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
            >
              <FolderOpen size={17} strokeWidth={1.8} />
              Workspaces
            </Link>

            <Link
              href="/settings"
              aria-current="page"
              className="mt-1 flex w-full items-center gap-3 rounded-xl bg-emerald-50/80 px-4 py-3.5 text-[14px] font-semibold text-slate-950"
            >
              <Settings size={17} strokeWidth={1.8} />
              Settings
            </Link>
          </nav>

          <div className="mt-auto">
            <div className="border-t border-slate-200/70 px-5 py-5">
              <button
                type="button"
                onClick={() => setProfileOpen((current) => !current)}
                className="flex w-full items-center gap-3 text-left"
              >
                <div className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-300 text-[10px] font-semibold text-white">
                  {initials}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold text-slate-900">
                    {displayName}
                  </p>
                  <p className="truncate text-[10px] text-slate-500">
                    {user?.email ?? ""}
                  </p>
                </div>

                <ChevronDown
                  size={13}
                  className={`shrink-0 text-slate-400 transition ${
                    profileOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {profileOpen && (
                <div className="mt-3 rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_18px_40px_rgba(15,23,42,0.1)]">
                  <div className="px-3 py-2">
                    <p className="truncate text-[11px] font-semibold text-slate-900">
                      {displayName}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] text-slate-500">
                      {user?.email ?? ""}
                    </p>
                  </div>

                  <div className="my-1 border-t border-slate-100" />

                  <button
                    type="button"
                    onClick={() => void logout()}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                  >
                    <LogOut size={14} strokeWidth={1.8} />
                    Sign out
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              className="flex w-full items-center gap-3 border-t border-slate-200/70 px-7 py-4 text-[13px] font-medium text-slate-600 transition hover:text-slate-950"
            >
              <span className="grid size-5 place-items-center rounded-md border border-slate-200 text-[10px]">
                ?
              </span>
              Help &amp; Support
            </button>
          </div>
        </aside>

        <section className="relative min-w-0 flex-1 overflow-hidden">
          {/* Full-page environmental image treatment */}
          <div className="pointer-events-none absolute inset-0 z-0">
            <img
              src="/hh.avif"
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover object-center opacity-[0.105] mix-blend-multiply"
            />
            <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(251,252,251,0.97)_0%,rgba(251,252,251,0.91)_38%,rgba(251,252,251,0.76)_72%,rgba(251,252,251,0.60)_100%)]" />
            <div className="absolute -right-40 top-20 h-[480px] w-[760px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(225,237,231,0.45),transparent_70%)] blur-[8px]" />
          </div>

          {/* Mobile header */}
          <header className="relative z-20 flex items-center justify-between border-b border-slate-200/70 bg-white/60 px-4 py-3 backdrop-blur-md lg:hidden">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                aria-label="Open navigation"
                onClick={() => setMobileNavOpen(true)}
                className="grid size-8 place-items-center rounded-lg text-slate-600 hover:bg-slate-100"
              >
                <Menu size={18} strokeWidth={1.8} />
              </button>

              <img
                src="/querypilot-logo.svg"
                alt="QueryPilot"
                className="size-6 object-contain"
              />

              <span className="text-[15px] font-semibold tracking-[-0.035em] text-slate-950">
                QueryPilot
              </span>
            </div>

            <div className="grid size-8 place-items-center rounded-full bg-slate-300 text-[10px] font-semibold text-white">
              {initials}
            </div>
          </header>

          <div className="relative z-10 mx-auto w-full max-w-[1180px] px-5 pb-12 pt-8 sm:px-8 lg:px-12 xl:px-16">
            <header className="border-b border-slate-300/70 pb-8">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-700">
                Preferences
              </p>

              <div className="mt-3 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                <div>
                  <h1 className="text-[38px] font-medium leading-none tracking-[-0.055em] text-slate-950 sm:text-[46px]">
                    Settings
                  </h1>
                  <p className="mt-3 max-w-[600px] text-[13px] leading-6 text-slate-500 sm:text-[14px]">
                    Account, workspace access, and session controls.
                  </p>
                </div>

                <div className="hidden rounded-full border border-slate-200/80 bg-white/55 px-4 py-2 text-[10px] font-medium text-slate-500 backdrop-blur-sm md:block">
                  {workspaces.length} workspace{workspaces.length === 1 ? "" : "s"}
                </div>
              </div>
            </header>

            {error && (
              <div
                role="alert"
                className="mt-6 rounded-xl border border-red-200 bg-red-50/85 px-4 py-3 text-sm leading-6 text-red-700"
              >
                {error}
              </div>
            )}

            <div className="mt-8 space-y-5">
              {/* Account */}
              <section className="rounded-2xl border border-slate-200/80 bg-white/58 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.025)] backdrop-blur-sm sm:p-7">
                <div className="grid gap-7 lg:grid-cols-[210px_1fr]">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                      01
                    </p>
                    <h2 className="mt-2 text-[16px] font-semibold tracking-[-0.02em]">
                      Account
                    </h2>
                    <p className="mt-1.5 text-[11px] leading-5 text-slate-500">
                      Your signed-in account.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Username
                      </p>
                      <div className="mt-2 rounded-xl border border-slate-200 bg-white/78 px-4 py-3 text-sm text-slate-900">
                        {user?.username || "—"}
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Email
                      </p>
                      <div className="mt-2 break-all rounded-xl border border-slate-200 bg-white/78 px-4 py-3 text-sm text-slate-900">
                        {user?.email || "—"}
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Role
                      </p>
                      <div className="mt-2 flex min-h-[46px] items-center justify-between rounded-xl border border-slate-200 bg-white/78 px-4 py-3 text-sm text-slate-900">
                        <span>{user?.role || "—"}</span>
                        {user?.role && (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
                            Active
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Workspaces */}
              <section className="rounded-2xl border border-slate-200/80 bg-white/58 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.025)] backdrop-blur-sm sm:p-7">
                <div className="grid gap-7 lg:grid-cols-[210px_1fr]">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                      02
                    </p>
                    <h2 className="mt-2 text-[16px] font-semibold tracking-[-0.02em]">
                      Workspaces
                    </h2>
                    <p className="mt-1.5 text-[11px] leading-5 text-slate-500">
                      Your QueryPilot workspaces.
                    </p>
                  </div>

                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[17px] font-semibold tracking-[-0.025em] text-slate-950">
                        {workspaces.length} workspace{workspaces.length === 1 ? "" : "s"}
                      </p>
                      <p className="mt-1.5 text-[12px] leading-5 text-slate-500">
                        Create, open, or remove workspaces from the workspace view.
                      </p>
                    </div>

                    <Link
                      href="/workspaces"
                      className="inline-flex shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-[12px] font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
                    >
                      Manage workspaces
                      <ChevronRight size={14} className="ml-2" />
                    </Link>
                  </div>
                </div>
              </section>

              {/* Security */}
              <section className="rounded-2xl border border-slate-200/80 bg-white/58 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.025)] backdrop-blur-sm sm:p-7">
                <div className="grid gap-7 lg:grid-cols-[210px_1fr]">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                      03
                    </p>
                    <h2 className="mt-2 text-[16px] font-semibold tracking-[-0.02em]">
                      Security
                    </h2>
                    <p className="mt-1.5 text-[11px] leading-5 text-slate-500">
                      Session access.
                    </p>
                  </div>

                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[15px] font-semibold tracking-[-0.02em] text-slate-950">
                        Current session
                      </p>
                      <p className="mt-1.5 text-[12px] leading-5 text-slate-500">
                        Signed in as {displayName}. Log out to revoke the current refresh session.
                      </p>
                    </div>

                    <Button
                      variant="secondary"
                      onClick={() => void logout()}
                      disabled={loggingOut}
                      className="shrink-0 rounded-xl px-4 py-3 text-[12px]"
                    >
                      <LogOut size={14} />
                      {loggingOut ? "Signing out…" : "Log out"}
                    </Button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </section>
      </div>

      {/* Mobile navigation */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/15 lg:hidden"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setMobileNavOpen(false);
          }}
        >
          <aside className="flex h-full w-[min(86vw,310px)] flex-col border-r border-slate-200 bg-white/96 shadow-[20px_0_60px_rgba(15,23,42,0.12)] backdrop-blur-xl">
            <div className="flex items-center justify-between px-5 py-5">
              <Link
                href="/workspaces"
                onClick={() => setMobileNavOpen(false)}
                className="flex items-center gap-2.5"
              >
                <img
                  src="/querypilot-logo.svg"
                  alt="QueryPilot"
                  className="size-6 object-contain"
                />
                <span className="text-[16px] font-semibold tracking-[-0.035em] text-slate-950">
                  QueryPilot
                </span>
              </Link>

              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setMobileNavOpen(false)}
                className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X size={17} strokeWidth={1.8} />
              </button>
            </div>

            <nav className="px-3 pt-2" aria-label="Mobile navigation">
              <Link
                href="/workspaces"
                onClick={() => setMobileNavOpen(false)}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-[14px] font-medium text-slate-600 hover:bg-slate-50"
              >
                <FolderOpen size={17} strokeWidth={1.8} />
                Workspaces
              </Link>

              <Link
                href="/settings"
                onClick={() => setMobileNavOpen(false)}
                className="mt-1 flex w-full items-center gap-3 rounded-xl bg-emerald-50/80 px-4 py-3.5 text-[14px] font-semibold text-slate-950"
                aria-current="page"
              >
                <Settings size={17} strokeWidth={1.8} />
                Settings
              </Link>
            </nav>

            <div className="mt-auto border-t border-slate-200/70 px-5 py-5">
              <div className="flex items-center gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-300 text-[10px] font-semibold text-white">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold text-slate-900">
                    {displayName}
                  </p>
                  <p className="truncate text-[10px] text-slate-500">
                    {user?.email ?? ""}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void logout()}
                className="mt-4 flex w-full items-center gap-2 rounded-lg px-1 py-2 text-[12px] font-medium text-slate-600 hover:text-slate-950"
              >
                <LogOut size={14} strokeWidth={1.8} />
                Sign out
              </button>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}

