"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Check, ExternalLink, Loader2, Plus, RotateCcw, Save, Sparkles, Trash2, Zap } from "lucide-react";
import { resetSettingsGroup, updateSettings, saveBotShieldArchetypeAction } from "@/actions/admin";
import { preventDoubleSubmit } from "@/components/ui/Submit";
import SubmitButton from "@/components/SubmitButton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { resolveImage } from "@/lib/image-resolver";
import ClickToSolve, { type PowDisplayMode, type PowWidgetStyle, type PowTheme } from "@/components/security/ClickToSolve";
import AnnouncementMessage from "@/components/header/AnnouncementMessage";
import type { SettingField } from "@/lib/settings";

type Group = { id: string; label: string; icon: string };

type SectionRow = { key: string; name: string; enabled: boolean; order: number; limit: number };

export default function SettingsEditor({
  groups,
  fields,
  values,
  activeGroup,
}: {
  groups: readonly Group[];
  fields: SettingField[];
  values: Record<string, string>;
  activeGroup: string;
}) {
  const [state, action] = useActionState(updateSettings, null);
  const [live, setLive] = useState<Record<string, string>>(values);
  const [prevValues, setPrevValues] = useState<Record<string, string>>(values);
  const [savingArchetype, setSavingArchetype] = useState(false);

  if (prevValues !== values) {
    setPrevValues(values);
    setLive(values);
  }

  const groupFields = useMemo(() => fields.filter((f) => f.group === activeGroup), [fields, activeGroup]);
  const isPreviewable = ["brand", "theme", "home", "security"].includes(activeGroup);

  const setValue = (key: string, value: string) => setLive((prev) => ({ ...prev, [key]: value }));

  const handleApplyArchetype = async (archetypeId: string) => {
    setValue("security.powDisplayMode", archetypeId);
    setSavingArchetype(true);
    try {
      const res = await saveBotShieldArchetypeAction({
        mode: archetypeId,
        style: live["security.powWidgetStyle"] || "checkbox",
        label: live["security.powLabel"] || "Main robot nahi hoon",
        theme: live["security.powTheme"] || "gold",
      });
      if (res && "error" in res && res.error) {
        toast.error(res.error);
      } else {
        toast.success(`⚡ Archetype saved & applied live! Active mode: ${archetypeId}, style: ${live["security.powWidgetStyle"] || "checkbox"}`);
      }
    } catch {
      toast.error("Failed to apply archetype. Please retry.");
    } finally {
      setSavingArchetype(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <nav className="card flex flex-wrap gap-1 p-2">
          {groups.map((g) => (
            <a
              key={g.id}
              href={`/admin/settings?group=${g.id}`}
              className={cn("chip", activeGroup === g.id && "chip-active")}
            >
              <span aria-hidden>{g.icon}</span> {g.label}
            </a>
          ))}
        </nav>

        <form onSubmit={preventDoubleSubmit} action={action} className="card space-y-5 p-5">
          <input type="hidden" name="__group" value={activeGroup} />
          <header className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-xl font-semibold text-[color:var(--brand)]">{groups.find((g) => g.id === activeGroup)?.label}</h2>
              <p className="text-xs text-[color:var(--text-soft)]">{groupFields.length} options · saved instantly and applied to every visitor</p>
            </div>
            <div className="flex gap-2">
              <SubmitButton pendingText="Saving…">
                <Save className="h-4 w-4" /> Save changes
              </SubmitButton>
            </div>
          </header>

          {groupFields.map((field) => (
            <FieldRow key={field.key} field={field} value={live[field.key] ?? field.default} onChange={(v) => setValue(field.key, v)} />
          ))}

          {state?.error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{state.error}</p>}
          {state?.success && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{state.success}</p>}

          <div className="flex flex-wrap items-center gap-3 border-t border-[color:var(--border)] pt-4">
            <SubmitButton pendingText="Saving…">
              <Save className="h-4 w-4" /> Save {groups.find((g) => g.id === activeGroup)?.label}
            </SubmitButton>
            <button type="submit" formAction={resetSettingsGroup} className="btn btn-ghost btn-sm" name="__group" value={activeGroup}>
              <RotateCcw className="h-4 w-4" /> Reset this section to defaults
            </button>
          </div>
        </form>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-40 xl:h-fit">
        {isPreviewable ? (
          <div className="card overflow-hidden">
            <p className="flex items-center gap-2 border-b border-[color:var(--border)] px-4 py-2 text-xs font-bold tracking-wider text-[color:var(--text-soft)] uppercase">
              <Sparkles className="h-3.5 w-3.5" /> Live preview
            </p>
            {activeGroup === "brand" && (
              <div className="space-y-3 p-4">
                <div className="flex items-center gap-2">
                  {live["site.logoUrl"] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={live["site.logoUrl"]} alt="" className="h-9 w-auto max-w-[8rem] object-contain" />
                  ) : (
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-[color:var(--brand)] font-display text-lg text-[color:var(--accent)]">{live["site.logoText"]}</span>
                  )}
                  <p className="font-display text-lg font-semibold text-[color:var(--brand)]">{live["site.name"]}</p>
                </div>
                <div className="marquee-wrap overflow-hidden rounded-lg bg-[color:var(--brand)] py-1.5 text-[color:var(--brand-fg)]">
                  <div className="px-3 text-[11px] truncate">
                    <AnnouncementMessage raw={(live["site.announcements"] ?? "").split(/\r?\n|\|/)[0]} />
                  </div>
                </div>
                <p className="text-xs text-[color:var(--text-soft)]">{live["site.tagline"]}</p>
              </div>
            )}
            {activeGroup === "theme" && (
              <div className="space-y-3 p-4">
                <div className="flex gap-2">
                  <Swatch label="Primary" color={live["theme.primary"]} />
                  <Swatch label="Accent" color={live["theme.accent"]} />
                  <Swatch label="Dark bg" color={live["theme.bgDark"]} />
                </div>
                <div className="rounded-xl border border-[color:var(--border)] p-3" style={{ borderRadius: live["theme.radius"] }}>
                  <p className="font-display text-lg font-semibold" style={{ color: live["theme.primary"], fontFamily: live["theme.fontDisplay"] }}>
                    Lehenga · साड़ी
                  </p>
                  <p className="text-xs text-[color:var(--text-soft)]">Corner radius {live["theme.radius"]} · density {live["theme.density"]}</p>
                  <div className="mt-2 flex gap-2">
                    <span className="rounded-full px-3 py-1 text-xs text-white" style={{ background: live["theme.primary"] }}>
                      Buy now
                    </span>
                    <span className="rounded-full px-3 py-1 text-xs" style={{ background: live["theme.accent"] }}>
                      Add to bag
                    </span>
                  </div>
                </div>
              </div>
            )}
            {activeGroup === "home" && (
              <div className="space-y-3 p-4">
                <div className="relative overflow-hidden rounded-xl" style={{ height: 150 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={resolveImage(live["home.bannerUrl"] || "/brand/poster.png")}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/brand/poster.png";
                    }}
                  />
                  <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${(Number(live["home.bannerOverlay"]) || 0) / 100})` }} />
                  <div className="absolute inset-0 flex flex-col justify-center gap-1 p-3 text-white">
                    <span className="w-fit rounded-full bg-black/40 px-2 py-0.5 text-[10px]">{live["home.bannerBadge"]}</span>
                    <p className="line-clamp-2 font-display text-sm font-semibold">{live["home.bannerTitle"]}</p>
                    <span className="w-fit rounded-full bg-white/90 px-2 py-0.5 text-[10px] text-black">{live["home.bannerCtaLabel"]}</span>
                  </div>
                </div>
                <p className="text-xs text-[color:var(--text-soft)]">
                  Grid: {live["home.gridMobile"]} / {live["home.gridTablet"]} / {live["home.gridDesktop"]} columns (mobile / tablet / desktop) · height {live["home.bannerHeight"]}px
                </p>
              </div>
            )}
            {activeGroup === "security" && (
              <div className="space-y-3.5 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#D4AF37]">
                    Bot Shield Studio
                  </span>
                  <span className="rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 px-2 py-0.5 text-[10px] font-mono text-[#D4AF37]">
                    {live["security.powDisplayMode"] || "turnstile"}
                  </span>
                </div>

                {/* 1-Click Archetype Switcher */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[11px] font-semibold text-[color:var(--text-soft)]">10 Bot Shield Archetypes:</p>
                    {savingArchetype && (
                      <span className="flex items-center gap-1 text-[10px] text-[#D4AF37] font-medium">
                        <Loader2 className="h-3 w-3 animate-spin" /> Applying...
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                    {[
                      { id: "turnstile", label: "Turnstile Card" },
                      { id: "altcha", label: "ALTCHA PoW" },
                      { id: "mcaptcha", label: "mCaptcha Box" },
                      { id: "slide", label: "Slide to Verify" },
                      { id: "biometric", label: "Touch Sensor" },
                      { id: "shagun", label: "शाही मुहर (Seal)" },
                      { id: "bar", label: "Slim Ribbon" },
                      { id: "floating", label: "Floating" },
                      { id: "overlay", label: "Modal Gate" },
                      { id: "invisible", label: "Invisible" },
                    ].map((m) => {
                      const active = (live["security.powDisplayMode"] || "turnstile") === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleApplyArchetype(m.id)}
                          disabled={savingArchetype}
                          className={cn(
                            "rounded-lg px-2.5 py-1.5 font-medium transition text-left border flex items-center justify-between",
                            active
                              ? "border-[#D4AF37] bg-[#D4AF37]/20 text-[#D4AF37] font-bold shadow-sm"
                              : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text)] hover:border-[#D4AF37]/50",
                          )}
                        >
                          <span className="truncate">{m.label}</span>
                          {active && <Check className="h-3 w-3 text-[#D4AF37] shrink-0 ml-1" />}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleApplyArchetype(live["security.powDisplayMode"] || "turnstile")}
                    disabled={savingArchetype}
                    className="mt-2.5 w-full btn btn-sm bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-black font-semibold border-0 flex items-center justify-center gap-1.5"
                  >
                    {savingArchetype ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                    Save & Apply Archetype to Live Site
                  </button>
                </div>

                {/* Live Interactive Test Widget */}
                <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-2)] p-2">
                  <ClickToSolve
                    key={`${live["security.powDisplayMode"] || "turnstile"}-${live["security.powWidgetStyle"] || "checkbox"}-${live["security.powTheme"] || "gold"}`}
                    action="auth"
                    label={live["security.powLabel"] || "Main robot nahi hoon"}
                    displayMode={(live["security.powDisplayMode"] as PowDisplayMode) || "turnstile"}
                    widgetStyle={(live["security.powWidgetStyle"] as PowWidgetStyle) || "checkbox"}
                    accentTheme={(live["security.powTheme"] as PowTheme) || "gold"}
                  />
                </div>

                <p className="text-[11px] text-[color:var(--text-soft)] leading-relaxed">
                  Mode: <strong className="text-[color:var(--text)]">{live["security.powDisplayMode"] || "turnstile"}</strong> · Style: <strong className="text-[color:var(--text)]">{live["security.powWidgetStyle"] || "checkbox"}</strong> · Accent: <strong className="text-[color:var(--text)]">{live["security.powTheme"] || "gold"}</strong>.
                </p>
              </div>
            )}
            <p className="border-t border-[color:var(--border)] px-4 py-2 text-[11px] text-[color:var(--text-soft)]">Preview updates as you type; press Save to publish.</p>
          </div>
        ) : (
          <div className="card p-4 text-sm text-[color:var(--text-muted)]">
            <p className="font-semibold text-[color:var(--brand)]">Heads-up</p>
            <p className="mt-1 text-xs">
              These options change real behaviour (pricing, commissions, security). Changes are written to the settings table, applied within a second, and recorded in the
              audit log.
            </p>
          </div>
        )}

        <div className="card p-4 text-xs text-[color:var(--text-soft)]">
          <p className="font-semibold text-[color:var(--brand)]">Preview on the live site</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <a href="/" target="_blank" className="chip">
              Homepage <ExternalLink className="h-3 w-3" />
            </a>
            <a href="/products" target="_blank" className="chip">
              Catalogue <ExternalLink className="h-3 w-3" />
            </a>
            <a href="/admin/security" className="chip">
              Audit trail
            </a>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Swatch({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex-1">
      <div className="h-12 w-full rounded-lg border border-[color:var(--border)]" style={{ background: color }} />
      <p className="mt-1 text-[10px] text-[color:var(--text-soft)]">{label}</p>
    </div>
  );
}

function FieldRow({ field, value, onChange }: { field: SettingField; value: string; onChange: (value: string) => void }) {
  const id = `set-${field.key}`;
  return (
    <div className="rounded-2xl border border-[color:var(--border)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="max-w-xl">
          <label htmlFor={id} className="text-sm font-semibold">
            {field.label}
          </label>
          {field.help && <p className="mt-0.5 text-xs text-[color:var(--text-soft)]">{field.help}</p>}
        </div>
        <code className="rounded bg-[color:var(--surface-2)] px-2 py-0.5 text-[10px] text-[color:var(--text-soft)]">{field.key}</code>
      </div>
      <div className="mt-3">
        {field.type === "boolean" ? (
          <label className="flex w-fit cursor-pointer items-center gap-2.5 text-sm select-none">
            <input type="hidden" name={`${field.key}__present`} value="1" />
            <input
              id={id}
              type="checkbox"
              name={field.key}
              checked={value === "true"}
              onChange={(e) => onChange(e.target.checked ? "true" : "false")}
              value="on"
              className="h-4 w-4 rounded accent-[color:var(--brand)] cursor-pointer"
            />
            <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full transition-colors", value === "true" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300" : "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300")}>
              {value === "true" ? "Enabled (सक्रिय)" : "Disabled (निष्क्रिय)"}
            </span>
          </label>
        ) : field.type === "select" ? (
          <select id={id} name={field.key} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
            {(field.options ?? []).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ) : field.type === "textarea" ? (
          <textarea id={id} name={field.key} className="input" value={value} onChange={(e) => onChange(e.target.value)} />
        ) : field.type === "list" ? (
          <ListField id={id} name={field.key} value={value} onChange={onChange} />
        ) : field.key === "home.sections" ? (
          <SectionsEditor id={id} value={value} onChange={onChange} />
        ) : field.type === "json" ? (
          <textarea id={id} name={field.key} className="input font-mono text-xs" rows={5} value={value} onChange={(e) => onChange(e.target.value)} />
        ) : field.type === "color" ? (
          <div className="flex items-center gap-3">
            <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-14 cursor-pointer rounded border border-[color:var(--border)] bg-transparent" aria-label={`${field.label} picker`} />
            <input id={id} name={field.key} className="input w-40 font-mono" value={value} onChange={(e) => onChange(e.target.value)} />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              id={id}
              name={field.key}
              type={field.type === "number" ? "number" : "text"}
              min={field.min}
              max={field.max}
              step={field.type === "number" ? "any" : undefined}
              className="input"
              value={value}
              onChange={(e) => onChange(e.target.value)}
            />
            {field.unit && <span className="text-sm text-[color:var(--text-soft)]">{field.unit}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionsEditor({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  let rows: SectionRow[] = [];
  try {
    rows = JSON.parse(value) as SectionRow[];
  } catch {
    rows = [];
  }
  const commit = (next: SectionRow[]) => onChange(JSON.stringify(next.sort((a, b) => a.order - b.order)));

  return (
    <div className="space-y-2">
      <input type="hidden" id={id} name="home.sections" value={JSON.stringify(rows)} />
      <ul className="space-y-1.5">
        {rows.map((row, index) => (
          <li key={row.key} className="flex flex-wrap items-center gap-2 rounded-xl border border-[color:var(--border)] p-2 text-sm">
            <label className="flex flex-1 items-center gap-2">
              <input
                type="checkbox"
                checked={row.enabled}
                onChange={(e) => {
                  const next = [...rows];
                  next[index] = { ...row, enabled: e.target.checked };
                  commit(next);
                }}
                className="h-4 w-4 accent-[color:var(--brand)]"
              />
              <span className="font-medium">{row.name}</span>
              <code className="text-[10px] text-[color:var(--text-soft)]">{row.key}</code>
            </label>
            <label className="flex items-center gap-1 text-xs">
              order
              <input
                type="number"
                min={1}
                className="input w-16 py-1"
                value={row.order}
                onChange={(e) => {
                  const next = [...rows];
                  next[index] = { ...row, order: Number(e.target.value) };
                  commit(next);
                }}
              />
            </label>
            <label className="flex items-center gap-1 text-xs">
              items
              <input
                type="number"
                min={1}
                max={24}
                className="input w-16 py-1"
                value={row.limit}
                onChange={(e) => {
                  const next = [...rows];
                  next[index] = { ...row, limit: Number(e.target.value) };
                  commit(next);
                }}
              />
            </label>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => commit([...rows, { key: `custom${rows.length + 1}`, name: "New section", enabled: false, order: rows.length + 1, limit: 4 }])}
        >
          <Plus className="h-3.5 w-3.5" /> Add row
        </button>
        {rows.length > 0 && (
          <button type="button" className="btn btn-ghost btn-sm text-rose-600" onClick={() => commit([])}>
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>
      <p className="text-xs text-[color:var(--text-soft)]">Tick to show a homepage section, set its order and how many products it renders. Unknown keys are ignored safely.</p>
    </div>
  );
}

function ListField({
  id,
  name,
  value,
  onChange,
}: {
  id: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [text, setText] = useState(() => (value ? value.split("|").join("\n") : ""));

  const lastExternalValue = useRef(value);
  useEffect(() => {
    if (value !== lastExternalValue.current) {
      lastExternalValue.current = value;
      setText(value ? value.split("|").join("\n") : "");
    }
  }, [value]);

  return (
    <>
      <textarea
        id={id}
        name={name}
        className="input font-sans text-xs leading-relaxed min-h-[110px]"
        rows={4}
        value={text}
        placeholder="One message per line..."
        onChange={(e) => {
          const newText = e.target.value;
          setText(newText);
          const normalized = newText
            .split(/\r?\n/)
            .map((s) => s.trim())
            .filter(Boolean)
            .join("|");
          lastExternalValue.current = normalized;
          onChange(normalized);
        }}
      />
      <p className="mt-1 text-xs text-[color:var(--text-soft)]">
        One message per line. They scroll automatically in the header announcement bar across every page.
      </p>
    </>
  );
}
