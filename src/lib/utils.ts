import type { OrderStatus } from "@/db/schema";
import { formatMoney } from "./format";
import { settingsSnapshot } from "./settings-snapshot";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/** Currency-aware money formatting (symbol, conversion + rounding come from admin settings). */
export function formatINR(value: number | string | null | undefined) {
  return formatMoney(Number(value ?? 0));
}

/** Raw INR formatting, used for invoices/payouts where the settled currency must show. */
export function formatINRRaw(value: number | string | null | undefined) {
  return formatMoney(Number(value ?? 0), { raw: true });
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

export function formatDay(value: Date | string | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

/**
 * Safely extracts a single string query parameter from Next.js Page searchParams
 * which can be string | string[] | undefined (e.g. ?q=1&q=2).
 */
export function getSingleParam(param: string | string[] | undefined | null): string {
  if (Array.isArray(param)) return param[0] ?? "";
  if (typeof param === "string") return param;
  return "";
}

/**
 * Strips dangerous HTML attribute breakout characters and limits query string length.
 * Prevents XSS reflection and OWASP ZAP 10031 / 90022 injection alerts.
 */
export function sanitizeSearchQuery(param: string | string[] | undefined | null, maxLength = 100): string {
  const raw = getSingleParam(param);
  return raw.replace(/[<>"'/\\{}]/g, "").trim().slice(0, maxLength);
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function uniqueSlug(base: string) {
  return `${slugify(base)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function generateOrderNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `AV-${ts}-${rand}`;
}

/** Money-safe rounding: everything is rounded to paise before it is stored. */
export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function freeShippingThreshold() {
  return Number(settingsSnapshot()["commerce.freeShippingThreshold"] ?? 999) || 0;
}

export function shippingFee() {
  return Number(settingsSnapshot()["commerce.shippingFee"] ?? 49) || 0;
}

export function codFee() {
  return Number(settingsSnapshot()["commerce.codFee"] ?? 0) || 0;
}

export function returnWindowDays() {
  return Number(settingsSnapshot()["commerce.returnWindowDays"] ?? 7) || 7;
}

export function gstPercent() {
  return Number(settingsSnapshot()["commerce.gstPercent"] ?? 5) || 0;
}

/** Delivery charge for one store sub-order, based on the admin-configured rules. */
export function shippingFor(subtotal: number, method: "cod" | "upi" | "online" = "online") {
  const threshold = freeShippingThreshold();
  const base = subtotal >= threshold && threshold > 0 ? 0 : shippingFee();
  const extra = method === "cod" ? codFee() : 0;
  return round2(base + extra);
}

/** GST split shown on invoices (prices are GST-inclusive by default). */
export function gstBreakdown(total: number) {
  const rate = gstPercent();
  const inclusive = (settingsSnapshot()["commerce.gstInclusive"] ?? "true") === "true";
  if (rate <= 0) return { taxable: round2(total), gst: 0, rate, inclusive };
  if (inclusive) {
    const taxable = round2((total * 100) / (100 + rate));
    return { taxable, gst: round2(total - taxable), rate, inclusive };
  }
  const gst = round2((total * rate) / 100);
  return { taxable: round2(total), gst, rate, inclusive };
}

export const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  confirmed: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30",
  processing: "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/30",
  shipped: "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30",
  delivered: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  cancelled: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30",
  returned: "bg-slate-200 text-slate-800 border-slate-300 dark:bg-white/10 dark:text-slate-300 dark:border-white/15",
};

export function statusStyle(status: string) {
  return STATUS_STYLES[status as OrderStatus] ?? "bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/10 dark:text-slate-300";
}

export const INDIAN_STATES = [
  "Andhra Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh",
  "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Odisha", "Punjab", "Rajasthan",
  "Tamil Nadu", "Telangana", "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

export function pluralize(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function initials(name: string | null | undefined) {
  if (!name) return "AV";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/** Tailwind-safe grid class builder for the configurable product grids. */
export function gridClass(cols: { desktop: number; tablet: number; mobile: number }, extra = "gap-4") {
  const colMap: Record<number, string> = {
    1: "grid-cols-1",
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
    5: "grid-cols-5",
    6: "grid-cols-6",
  };
  const smMap: Record<number, string> = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4" };
  const lgMap: Record<number, string> = {
    2: "lg:grid-cols-2",
    3: "lg:grid-cols-3",
    4: "lg:grid-cols-4",
    5: "lg:grid-cols-5",
    6: "lg:grid-cols-6",
  };
  return cn("grid", colMap[cols.mobile] ?? "grid-cols-2", smMap[cols.tablet] ?? "sm:grid-cols-3", lgMap[cols.desktop] ?? "lg:grid-cols-4", extra);
}
