"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from "react";

import { PixelDissolveButton } from "@/components/pixel-dissolve-button";

/* ============================================================================
 * MobileGate
 *
 * A glass black screen that sits on top of the whole site on phones. It says
 * the site is better on a laptop, lets the visitor send themselves the link,
 * or lets them carry on with the phone anyway.
 *
 * Same look as the landing page: canvas #0A0A0A, white/10 hairlines, the dot
 * grid and soft cool wash from the hero, brand blue #3A44A8, Geist font, and
 * the same PixelDissolveButton the landing page uses.
 *
 * WHEN IT SHOWS
 *  Only on a real phone: a narrow screen (under 768px) AND a touch screen as
 *  the main input (`pointer: coarse`). A laptop never shows it, even if the
 *  browser window is dragged narrow or zoomed in.
 *
 *  Two layers make sure of this:
 *   1. Plain CSS in this file hides it unless the phone rule matches. No
 *      Tailwind involved, and no flash of the gate on a laptop.
 *   2. Once the page loads, JavaScript checks the same rule and removes the
 *      gate completely if it is not a phone.
 *
 *  To test on a laptop: Chrome DevTools, device toolbar (Ctrl+Shift+M), pick a
 *  phone like "iPhone 14", reload. Shrinking the window alone will NOT show it,
 *  on purpose.
 *
 * OTHER BEHAVIOUR
 *  - "Squint through it anyway" hides it for the rest of that browser session
 *    (sessionStorage). Close the tab and open again, it shows again.
 *  - The page behind it cannot scroll while it is open.
 *  - It sits above the navbar (nav is z-[60], this is z-[100]).
 *
 * Use: render <MobileGate /> once inside the landing page root, before
 * <PublicNav />. If you also render it inside EngineeringPage, one dismiss
 * covers both pages.
 * ========================================================================== */

const PHONE_QUERY = "(max-width: 767px) and (pointer: coarse)";
const STORAGE_KEY = "qp-mobile-gate-dismissed";

/* Same button settings the landing page uses. */
const BRAND_BLUE = "#3a44a8";
const BRAND_DISSOLVE_BLUE = "#2a3282";
const GHOST_TEXT = "rgba(255,255,255,0.8)";
const GHOST_DISSOLVE = "#4A4A4A";
const PD_PILL = "!rounded-full !min-h-0 !px-4 !text-[13px] !font-medium !normal-case !tracking-normal";
const PD_GHOST_BORDER = "border !border-white/15";
const PD_FULL = "!h-11 !w-full !text-[15px]";

/* Same dot grid as the hero, faded from the top right. */
const DOTS: CSSProperties = {
  backgroundImage: "radial-gradient(rgba(255,255,255,.1) 1px, transparent 1px)",
  backgroundSize: "18px 18px",
  WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 85% 0%, #000 0%, transparent 72%)",
  maskImage: "radial-gradient(ellipse 80% 70% at 85% 0%, #000 0%, transparent 72%)",
};

/* Same cool grey wash the demo card uses, one patch behind the card. */
const WASH: CSSProperties = {
  background: "radial-gradient(ellipse 60% 38% at 50% 46%, rgba(160,172,240,.16), transparent 75%)",
};

const GATE_CSS = `
.qpg-root { display: none; }
@media ${PHONE_QUERY} {
  .qpg-root { display: block; }
}
@keyframes qpgFade { from { opacity: 0 } to { opacity: 1 } }
@keyframes qpgRise {
  from { opacity: 0; transform: translateY(14px); filter: blur(6px) }
  to { opacity: 1; transform: none; filter: none }
}
.qpg-root { animation: qpgFade .4s ease-out both; outline: none; }
.qpg-rise { animation: qpgRise 1.1s cubic-bezier(.16,1,.3,1) both }
@media (prefers-reduced-motion: reduce) {
  .qpg-root, .qpg-rise { animation: none }
}
`;

/**
 * Runs `action` when the wrapped pixel button is pressed, and stops the button
 * from navigating anywhere. PixelDissolveButton is built as a link (it always
 * gets an href on the landing page), so these two buttons pass href="#" and
 * this wrapper catches the click first.
 */
function Press({ action, children }: { action: () => void; children: ReactNode }) {
  const onClickCapture = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    action();
  };
  return (
    <div onClickCapture={onClickCapture} className="w-full">
      {children}
    </div>
  );
}

export function MobileGate() {
  const [dismissed, setDismissed] = useState(false);
  // null = not checked yet (first render). The CSS above decides until we know.
  const [isPhone, setIsPhone] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Read the saved choice once, on the client.
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(STORAGE_KEY) === "1") setDismissed(true);
    } catch {
      /* storage can be blocked (private mode). Ignore and show the gate. */
    }
  }, []);

  // Track whether this is a real phone. Also reacts if the phone is rotated.
  useEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY);
    const update = () => setIsPhone(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const open = isPhone === true && !dismissed;

  // Lock the page behind the gate.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Screen readers start inside the gate.
  useEffect(() => {
    if (open) rootRef.current?.focus({ preventScroll: true });
  }, [open]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  // On phones the share sheet is the easiest way to send a link to yourself
  // (WhatsApp, mail, notes). If it is not there, copy the link instead.
  const sendLink = useCallback(async () => {
    const url = window.location.href;

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "QueryPilot", url });
        return;
      } catch (err) {
        // The person closed the sheet. Nothing to do.
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Any other failure: fall through to copy.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        return;
      }
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2400);
  }, []);

  // Not a phone, or already dismissed: render nothing at all.
  if (dismissed || isPhone === false) return null;

  return (
    <>
      <style>{GATE_CSS}</style>

      <div
        ref={rootRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="qpg-title"
        aria-describedby="qpg-desc"
        className="qpg-root fixed inset-0 z-[100] overflow-y-auto overscroll-contain bg-[#0A0A0A]/60 text-white backdrop-blur-2xl"
        style={{ WebkitBackdropFilter: "blur(40px)" }}
      >
        {/* hero dot grid + soft wash, both ignore touches */}
        <div aria-hidden="true" className="pointer-events-none fixed inset-0" style={DOTS} />
        <div aria-hidden="true" className="pointer-events-none fixed inset-0" style={WASH} />

        <div
          className="relative flex min-h-full items-center justify-center px-5"
          style={{
            paddingTop: "max(24px, env(safe-area-inset-top))",
            paddingBottom: "max(24px, env(safe-area-inset-bottom))",
          }}
        >
          <div
            className="qpg-rise w-full max-w-[380px] rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-md"
            style={{ boxShadow: "0 0 0 1px rgba(0,0,0,.6), 0 40px 90px -40px rgba(0,0,0,.95)" }}
          >
            <div className="text-[16px] font-semibold tracking-[-0.02em]">QueryPilot</div>

            <h2
              id="qpg-title"
              className="mt-6 text-[30px] font-medium leading-[1.08] tracking-[-0.03em]"
            >
              <span className="block text-white/50">Nice phone.</span>
              <span className="block">Wrong screen.</span>
            </h2>

            <p id="qpg-desc" className="mt-4 text-[15px] leading-[1.55] text-white/60">
              This page has a live graph, a chat and a whole docs site, and they all need some
              elbow room. On a phone they get squished, and I put a lot of work into them.
              Give it two minutes on a laptop.
            </p>

            <div className="mt-6 flex flex-col gap-2.5">
              <Press action={sendLink}>
                <PixelDissolveButton
                  label={copied ? "Link copied" : "Send myself the link"}
                  href="#"
                  color={BRAND_BLUE}
                  dissolveColor={BRAND_DISSOLVE_BLUE}
                  cellSize={5}
                  className={`${PD_PILL} ${PD_FULL}`}
                />
              </Press>

              <Press action={dismiss}>
                <PixelDissolveButton
                  label="Squint through it anyway"
                  href="#"
                  color="transparent"
                  textColor={GHOST_TEXT}
                  dissolveColor={GHOST_DISSOLVE}
                  cellSize={5}
                  className={`${PD_PILL} ${PD_GHOST_BORDER} ${PD_FULL}`}
                />
              </Press>
            </div>

            <p className="mt-4 text-center text-[12.5px] text-white/35">
              Tip: WhatsApp it to yourself and open it at your desk.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default MobileGate;