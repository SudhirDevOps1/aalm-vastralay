import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { settings as settingsTable } from "@/db/schema";
import type { DeliveryStrategy, HeroSlide } from "@/types/media";
import { refreshDisplayConfig, type DisplayConfig } from "./format";
import { writeSettingsSnapshot } from "./settings-snapshot";
import {
  SETTINGS_DEFAULTS,
  SETTINGS_FIELDS,
  SETTINGS_GROUPS,
  parseList,
  parseJson,
  type HomeSection,
  type SettingField,
  type SettingsMap,
} from "./settings-defs";

export {
  SETTINGS_DEFAULTS,
  SETTINGS_FIELDS,
  SETTINGS_GROUPS,
  SETTING_KEYS,
  parseList,
  parseJson,
} from "./settings-defs";
export type { HomeSection, SettingField, SettingsMap } from "./settings-defs";

/* ------------------------------------------------------------------ */
/*  Editable site configuration – every value can be changed from      */
/*  /admin/settings without touching code or redeploying.              */
/* ------------------------------------------------------------------ */

/** Tag for Vercel shared data cache — revalidated on every admin settings save. */
export const SITE_SETTINGS_TAG = "site-settings";

let snapshot: { values: SettingsMap; at: number } | null = null;
const TTL_MS = 60_000;

/**
 * Called after settings writes so the change is visible immediately.
 * Clears the in-process snapshot AND busts the Vercel shared data cache
 * so all Lambda instances pick up the new values within seconds.
 * Must be called from a Server Action context (same pattern as invalidateCatalog).
 */
export async function invalidateSettings() {
  snapshot = null;
  const { updateTag, revalidateTag, refresh } = await import("next/cache");
  try {
    updateTag(SITE_SETTINGS_TAG);
  } catch {
    /* ignore */
  }
  try {
    revalidateTag(SITE_SETTINGS_TAG, "max");
  } catch {
    /* ignore */
  }
  try {
    if (typeof refresh === "function") refresh();
  } catch {
    /* ignore */
  }
}

async function readAll(): Promise<SettingsMap> {
  const values: SettingsMap = { ...SETTINGS_DEFAULTS };
  try {
    const rows = await db.select().from(settingsTable);
    for (const row of rows) {
      if (row.value !== null) values[row.key] = row.value;
    }
  } catch {
    // Table not yet migrated – fall back to defaults so the UI never breaks.
  }
  snapshot = { values, at: Date.now() };
  writeSettingsSnapshot(values);
  refreshDisplayConfig({
    currencySymbol: values["commerce.currencySymbol"] || "₹",
    currencyCode: values["commerce.currencyCode"] || "INR",
    rateFromINR: Number(values["commerce.rateFromINR"]) || 1,
    rounding: (values["commerce.priceRounding"] as DisplayConfig["rounding"]) ?? "none",
    weightUnit: (values["commerce.weightUnit"] as DisplayConfig["weightUnit"]) ?? "kg",
  });
  return values;
}

/**
 * Shared data cache — survives across Lambda cold starts on Vercel.
 * TTL: 1 hour. Busted immediately by invalidateSettings() after admin saves.
 * L1: in-process 60s snapshot (TTL_MS) avoids redundant unstable_cache calls.
 */
const getSettingsCached = unstable_cache(readAll, ["site-settings-v1"], {
  revalidate: 3600,
  tags: [SITE_SETTINGS_TAG],
});

/** Request-deduped settings read (L1: in-process, L2: shared data cache). */
export const getSettings = cache(async (): Promise<SettingsMap> => {
  if (snapshot && Date.now() - snapshot.at < TTL_MS) return snapshot.values;
  return getSettingsCached();
});

/** Values read synchronously by formatting helpers (display-only, never money calculations). */
export function settingsSnapshot(): SettingsMap {
  return snapshot?.values ?? SETTINGS_DEFAULTS;
}

export async function getSetting(key: string, fallback?: string) {
  const values = await getSettings();
  return values[key] ?? fallback ?? SETTINGS_DEFAULTS[key] ?? "";
}

export async function getSettingNumber(key: string, fallback = 0) {
  const raw = await getSetting(key);
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export async function getSettingBool(key: string, fallback = false) {
  const raw = await getSetting(key);
  if (raw === "") return fallback;
  return raw === "true" || raw === "1" || raw === "on";
}

/**
 * Programmatic single-key writer (used by server flows like the B2 mirror
 * stats counter). Same upsert + cache-bust contract as updateSettings.
 */
export async function setSetting(key: string, value: string, updatedBy?: string | null): Promise<void> {
  const cleanKey = key.trim().slice(0, 120);
  if (!cleanKey) throw new Error("Setting key is required");
  await db
    .insert(settingsTable)
    .values({ key: cleanKey, value: value.slice(0, 20000), group: "stats", label: cleanKey, updatedBy: updatedBy ?? null, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: value.slice(0, 20000), updatedAt: new Date(), updatedBy: updatedBy ?? null } });
  await invalidateSettings();
}

export type BrandConfig = {
  name: string;
  tagline: string;
  logoText: string;
  logoUrl: string;
  faviconEmoji: string;
  announcements: string[];
  announcementSpeed: number;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  copyright: string;
  social: { instagram: string; youtube: string; facebook: string };
};

export async function getBrand(): Promise<BrandConfig> {
  const s = await getSettings();
  return {
    name: s["site.name"],
    tagline: s["site.tagline"],
    logoText: s["site.logoText"],
    logoUrl: s["site.logoUrl"],
    faviconEmoji: s["site.faviconEmoji"],
    announcements: parseList(s["site.announcements"]),
    announcementSpeed: Number(s["site.announcementSpeed"]) || 26,
    phone: s["site.phone"],
    whatsapp: s["site.whatsapp"],
    email: s["site.email"],
    address: s["site.address"],
    copyright: s["site.copyright"],
    social: { instagram: s["site.socialInstagram"], youtube: s["site.socialYoutube"], facebook: s["site.socialFacebook"] },
  };
}

export type ThemeConfig = {
  defaultMode: "light" | "dark" | "system";
  allowUserToggle: boolean;
  primary: string;
  primaryLight: string;
  accent: string;
  accentLight: string;
  bgLight: string;
  bgDark: string;
  surfaceDark: string;
  radius: string;
  fontDisplay: string;
  density: "comfortable" | "compact";
};

export async function getTheme(): Promise<ThemeConfig> {
  const s = await getSettings();
  return {
    defaultMode: (s["theme.defaultMode"] as ThemeConfig["defaultMode"]) ?? "light",
    allowUserToggle: s["theme.allowUserToggle"] === "true",
    primary: s["theme.primary"],
    primaryLight: s["theme.primaryLight"],
    accent: s["theme.accent"],
    accentLight: s["theme.accentLight"],
    bgLight: s["theme.bgLight"],
    bgDark: s["theme.bgDark"],
    surfaceDark: s["theme.surfaceDark"],
    radius: s["theme.radius"],
    fontDisplay: s["theme.fontDisplay"],
    density: (s["theme.density"] as ThemeConfig["density"]) ?? "comfortable",
  };
}

export type CommerceConfig = {
  currencySymbol: string;
  currencyCode: string;
  rateFromINR: number;
  rounding: "none" | "nearest1" | "nearest5" | "nearest10";
  freeShippingThreshold: number;
  shippingFee: number;
  codFee: number;
  returnWindowDays: number;
  gstPercent: number;
  gstInclusive: boolean;
  minOrderValue: number;
  weightUnit: "kg" | "g";
  showWeight: boolean;
};

export async function getCommerce(): Promise<CommerceConfig> {
  const s = await getSettings();
  return {
    currencySymbol: s["commerce.currencySymbol"] || "₹",
    currencyCode: s["commerce.currencyCode"] || "INR",
    rateFromINR: Number(s["commerce.rateFromINR"]) || 1,
    rounding: (s["commerce.priceRounding"] as CommerceConfig["rounding"]) ?? "none",
    freeShippingThreshold: Number(s["commerce.freeShippingThreshold"]) || 0,
    shippingFee: Number(s["commerce.shippingFee"]) || 0,
    codFee: Number(s["commerce.codFee"]) || 0,
    returnWindowDays: Number(s["commerce.returnWindowDays"]) || 7,
    gstPercent: Number(s["commerce.gstPercent"]) || 0,
    gstInclusive: s["commerce.gstInclusive"] === "true",
    minOrderValue: Number(s["commerce.minOrderValue"]) || 0,
    weightUnit: (s["commerce.weightUnit"] as "kg" | "g") ?? "kg",
    showWeight: s["commerce.showWeight"] === "true",
  };
}

export type HomeConfig = {
  banner: {
    url: string;
    height: number;
    overlay: number;
    badge: string;
    title: string;
    subtitle: string;
    ctaLabel: string;
    ctaHref: string;
    cta2Label: string;
    cta2Href: string;
    strategy?: DeliveryStrategy;
    mirroredUrl?: string;
  };
  slides: HeroSlide[];
  grid: { desktop: number; tablet: number; mobile: number };
  sections: HomeSection[];
  occasions: string[];
  categoryCards: Record<string, string>;
};

export async function getHomeConfig(): Promise<HomeConfig> {
  const s = await getSettings();

  const bannerUrl = (!s["home.bannerUrl"] || s["home.bannerUrl"] === "/brand/poster.jpg") ? "/brand/poster.png" : s["home.bannerUrl"];
  const bannerBadge = s["home.bannerBadge"] || "Aalm Vastralay · Wedding & Ethnic Wear";
  const bannerTitle = s["home.bannerTitle"] || "Royal Indian Wedding & Luxury Ethnic Wear";
  const bannerSubtitle = s["home.bannerSubtitle"] || "Exquisite Banarasi sarees, handloom silks, bridal lehengas, and regal sherwanis handcrafted by master artisans. Cash on delivery & nationwide delivery.";
  const defaultWhatsAppClean = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP?.replace(/\D/g, "") || "919876543210";
  const defaultPhoneHref = process.env.NEXT_PUBLIC_SUPPORT_PHONE ? `tel:${process.env.NEXT_PUBLIC_SUPPORT_PHONE}` : "tel:+919876543210";
  const defaultWhatsAppHref = `https://wa.me/${defaultWhatsAppClean}`;

  const bannerCtaLabel = s["home.bannerCtaLabel"] || "Explore Collections";
  const bannerCtaHref = s["home.bannerCtaHref"] || "/products?category=women";
  const bannerCta2Label = s["home.bannerCta2Label"] || "कॉल करें (Call Us)";
  const bannerCta2Href = s["home.bannerCta2Href"] || defaultPhoneHref;

  // Parse slides from home.slides setting
  const rawSlides = parseJson<HeroSlide[]>(s["home.slides"], []);
  let activeSlides: HeroSlide[] = [];
  if (Array.isArray(rawSlides) && rawSlides.length > 0) {
    activeSlides = rawSlides
      .filter((sl) => sl && sl.active && sl.image)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .slice(0, 5);
  }

  // Fallback defaults: derive 5 slides from existing banner + top categories when setting absent/empty
  if (activeSlides.length === 0) {
    activeSlides = [
      {
        id: "default-slide-1",
        image: bannerUrl,
        title: bannerTitle,
        subtitle: bannerSubtitle,
        badge: bannerBadge,
        ctaLabel: bannerCtaLabel,
        ctaHref: bannerCtaHref,
        cta2Label: bannerCta2Label,
        cta2Href: bannerCta2Href,
        alt: bannerTitle,
        active: true,
        order: 0,
        strategy: (s["home.bannerStrategy"] as DeliveryStrategy) || "wsrv",
        mirroredUrl: s["home.bannerMirroredUrl"] || undefined,
      },
      {
        id: "default-slide-2",
        image: "/brand/poster.png",
        title: "Pure Banarasi & Heritage Handloom Sarees",
        subtitle: "Woven by Varanasi master artisans with authentic gold zari motifs and lustrous silk borders.",
        badge: "Varanasi Heritage",
        ctaLabel: "Shop Silk Sarees",
        ctaHref: "/products",
        cta2Label: "WhatsApp Consult",
        cta2Href: defaultWhatsAppHref,
        alt: "Pure Banarasi & Heritage Handloom Sarees",
        active: true,
        order: 1,
        strategy: "wsrv",
      },
      {
        id: "default-slide-3",
        image: "/brand/poster.png",
        title: "Royal Bridal Lehengas & Wedding Ensembles",
        subtitle: "Opulent velvet, silk, and organza bridal lehengas featuring handcrafted zardozi embroidery.",
        badge: "Bridal Couture",
        ctaLabel: "View Bridal Wear",
        ctaHref: "/products",
        cta2Label: "Call Stylist",
        cta2Href: defaultPhoneHref,
        alt: "Royal Bridal Lehengas & Wedding Ensembles",
        active: true,
        order: 2,
        strategy: "wsrv",
      },
      {
        id: "default-slide-4",
        image: "/brand/poster.png",
        title: "Regal Groom Sherwanis & Kurta Sets",
        subtitle: "Distinguished groom couture tailored with royal silhouettes, pearl brooches, and stoles.",
        badge: "Groom's Collection",
        ctaLabel: "Explore Groom Wear",
        ctaHref: "/products",
        cta2Label: "Boutique Visit",
        cta2Href: defaultPhoneHref,
        alt: "Regal Groom Sherwanis & Kurta Sets",
        active: true,
        order: 3,
        strategy: "wsrv",
      },
      {
        id: "default-slide-5",
        image: "/brand/poster.png",
        title: "Festive Family & Celebratory Wear",
        subtitle: "Complete celebratory wardrobe for the entire family. Fast dispatch & cash on delivery across India.",
        badge: "Festive Celebrations",
        ctaLabel: "All Collections",
        ctaHref: "/products",
        cta2Label: "Track Order",
        cta2Href: "/track-order",
        alt: "Festive Family & Celebratory Wear",
        active: true,
        order: 4,
        strategy: "wsrv",
      },
    ];
  }

  return {
    banner: {
      url: bannerUrl,
      height: Number(s["home.bannerHeight"]) || 520,
      overlay: Number(s["home.bannerOverlay"]) ?? 62,
      badge: bannerBadge,
      title: bannerTitle,
      subtitle: bannerSubtitle,
      ctaLabel: bannerCtaLabel,
      ctaHref: bannerCtaHref,
      cta2Label: bannerCta2Label,
      cta2Href: bannerCta2Href,
      strategy: (s["home.bannerStrategy"] as DeliveryStrategy) || "wsrv",
      mirroredUrl: s["home.bannerMirroredUrl"] || undefined,
    },
    slides: activeSlides,
    grid: {
      desktop: Number(s["home.gridDesktop"]) || 4,
      tablet: Number(s["home.gridTablet"]) || 3,
      mobile: Number(s["home.gridMobile"]) || 2,
    },
    sections: parseJson<HomeSection[]>(s["home.sections"], []).slice().sort((a, b) => a.order - b.order),
    occasions: parseList(s["home.occasions"]),
    categoryCards: parseJson<Record<string, string>>(s["home.categoryCards"], {}),
  };
}

export { ensureSettingsRows } from "@/db/init";

export async function getSettingsByGroup(group: string) {
  const rows = await db.select().from(settingsTable).where(inArray(settingsTable.group, [group]));
  return rows.sort((a, b) => (a.label ?? a.key).localeCompare(b.label ?? b.key));
}
