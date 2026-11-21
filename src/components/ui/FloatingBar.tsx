"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HelpCircle, MessageCircle, Moon, Settings2, Sun, Type, Zap } from "lucide-react";
import { useTheme, sanitizeScale } from "@/components/theme/ThemeProvider";
import { cn } from "@/lib/utils";

/** Floating helper bar: theme switch, personalisation, WhatsApp support, back-to-top. */
export default function FloatingBar({ whatsapp, phone, showThemeToggle }: { whatsapp: string; phone: string; showThemeToggle: boolean }) {
  const { prefs, setPrefs, toggleMode, panelOpen, setPanelOpen } = useTheme();
  const [visible, setVisible] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const waLink = `https://wa.me/${whatsapp.replace(/[^0-9]/g, "")}?text=${encodeURIComponent("Namaste! I need help with an order on Aalm Vastralay.")}`;

  return (
    <>
      <div className="no-print fixed right-3 bottom-[128px] z-40 flex flex-col items-end gap-2 sm:right-5 sm:bottom-6">
        {visible && (
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="animate-fade-up grid h-9 w-9 place-items-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] shadow-lg hover:text-[color:var(--brand)] sm:h-10 sm:w-10"
            aria-label="Back to top"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}

        {showThemeToggle && (
          <button
            type="button"
            onClick={toggleMode}
            className="hidden h-10 w-10 place-items-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--brand)] shadow-md sm:grid"
            aria-label="Toggle colour mode"
          >
            <Sun className="hidden h-4 w-4 dark:block" />
            <Moon className="h-4 w-4 dark:hidden" />
          </button>
        )}

        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className="hidden h-10 w-10 place-items-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] shadow-md hover:text-[color:var(--brand)] sm:grid"
          aria-label="Display settings"
          title="Display settings"
        >
          <Settings2 className="h-4 w-4" />
        </button>

        {whatsapp && (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex items-center"
          >
            <span className="pointer-events-none mr-2 hidden rounded-full border border-emerald-200 dark:border-emerald-800/60 bg-white/95 dark:bg-zinc-900/95 px-2.5 py-1 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 shadow-md backdrop-blur-xs transition-opacity duration-300 md:inline-block">
              सहायता चाहिए? WhatsApp करें
            </span>
            <div className="animate-pulse-ring grid h-11 w-11 place-items-center rounded-full bg-emerald-600 text-white shadow-xl hover:bg-emerald-700">
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
              <span className="sr-only">Chat on WhatsApp</span>
            </div>
          </a>
        )}
      </div>

      {/* preferences drawer */}
      {panelOpen && (
        <div className="no-print fixed inset-0 z-[75]">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40" onClick={() => setPanelOpen(false)} />
          <aside className="animate-slide-in absolute top-0 right-0 flex h-full w-[min(92vw,360px)] flex-col gap-5 overflow-y-auto border-l border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-2xl">
            <header className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-[color:var(--brand)]">Display & comfort</p>
                <p className="text-xs text-[color:var(--text-soft)]">Saved on this device – सजावट आपके हिसाब से</p>
              </div>
              <button type="button" onClick={() => setPanelOpen(false)} className="btn btn-ghost btn-icon" aria-label="Close">
                ✕
              </button>
            </header>

            <Section title="Colour mode">
              <div className="grid grid-cols-3 gap-2">
                {(["light", "dark", "system"] as const).map((mode) => (
                  <button key={mode} type="button" onClick={() => setPrefs({ mode })} className={cn("chip justify-center capitalize", prefs.mode === mode && "chip-active")}>
                    {mode}
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Text size" icon={<Type className="h-4 w-4" />}>
              <div className="flex items-center gap-3">
                <button type="button" className="chip min-h-[44px] min-w-[44px] justify-center" onClick={() => setPrefs({ scale: sanitizeScale(prefs.scale - 0.05) })} aria-label="Smaller text">
                  A−
                </button>
                <input
                  type="range"
                  min={0.9}
                  max={1.25}
                  step={0.05}
                  value={sanitizeScale(prefs.scale)}
                  onChange={(e) => setPrefs({ scale: sanitizeScale(e.target.value) })}
                  className="h-1.5 flex-1 accent-[#D4AF37]"
                  aria-label="Text size"
                />
                <button type="button" className="chip min-h-[44px] min-w-[44px] justify-center" onClick={() => setPrefs({ scale: sanitizeScale(prefs.scale + 0.05) })} aria-label="Larger text">
                  A+
                </button>
              </div>
              <p className="text-xs text-[color:var(--text-soft)]">{Math.round(sanitizeScale(prefs.scale) * 100)}% text size</p>
            </Section>

            <Section title="Layout density">
              <div className="grid grid-cols-2 gap-2">
                {(["comfortable", "compact"] as const).map((d) => (
                  <button key={d} type="button" onClick={() => setPrefs({ density: d })} className={cn("chip justify-center capitalize", prefs.density === d && "chip-active")}>
                    {d}
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Motion" icon={<Zap className="h-4 w-4" />}>
              <button
                type="button"
                role="switch"
                aria-checked={prefs.motion}
                aria-label="Animations and transitions"
                onClick={() => setPrefs({ motion: !prefs.motion })}
                className={cn(
                  "flex w-full min-h-[44px] items-center justify-between rounded-xl border px-3 text-sm transition-colors",
                  prefs.motion
                    ? "border-[#D4AF37]/50 bg-[#D4AF37]/10 text-[color:var(--text)]"
                    : "border-[color:var(--border)] text-[color:var(--text-muted)]",
                )}
              >
                <span>Animations & transitions</span>
                <span
                  className={cn(
                    "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                    prefs.motion ? "bg-[#D4AF37]" : "bg-[color:var(--border-strong)]",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
                      prefs.motion ? "left-[22px]" : "left-0.5",
                    )}
                  />
                </span>
              </button>
            </Section>

            <Section title="Need help?" icon={<HelpCircle className="h-4 w-4" />}>
              <p className="text-sm text-[color:var(--text-muted)]">
                Call or WhatsApp <span className="font-semibold">{phone}</span>. We reply within a few hours, 7 days a week.
              </p>
              <button type="button" onClick={() => startTransition(() => router.push("/dashboard"))} className="btn btn-outline btn-sm mt-2">
                Go to my account
              </button>
            </Section>
          </aside>
        </div>
      )}
    </>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-2 border-t border-[color:var(--border)] pt-4 first-of-type:border-0 first-of-type:pt-0">
      <p className="flex items-center gap-2 text-xs font-bold tracking-wider text-[color:var(--text-soft)] uppercase">
        {icon} {title}
      </p>
      {children}
    </section>
  );
}
