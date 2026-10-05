/**
 * Settings *definitions* – pure data, safe to import from client components.
 * Nothing here touches the database or server-only APIs.
 */

export const SETTINGS_GROUPS = [
  { id: "brand", label: "Brand & identity", icon: "🏷️" },
  { id: "theme", label: "Theme & appearance", icon: "🎨" },
  { id: "home", label: "Homepage & banner", icon: "🖼️" },
  { id: "commerce", label: "Commerce & pricing", icon: "💰" },
  { id: "seller", label: "Seller programme", icon: "🏬" },
  { id: "security", label: "Security & scaling", icon: "🛡️" },
  { id: "features", label: "Feature switches", icon: "🧩" },
] as const;

export type SettingField = {
  key: string;
  group: (typeof SETTINGS_GROUPS)[number]["id"];
  label: string;
  help?: string;
  type: "text" | "textarea" | "number" | "color" | "boolean" | "select" | "json" | "list";
  options?: string[];
  default: string;
  unit?: string;
  min?: number;
  max?: number;
};

const SECTIONS_DEFAULT = JSON.stringify([
  { key: "categories", name: "Shop by Category", enabled: true, order: 1, limit: 4 },
  { key: "occasions", name: "Shop by Occasion", enabled: true, order: 2, limit: 7 },
  { key: "featured", name: "Featured Picks", enabled: true, order: 3, limit: 8 },
  { key: "sellerCta", name: "Become a Seller", enabled: true, order: 4, limit: 1 },
  { key: "newArrivals", name: "New Arrivals", enabled: true, order: 5, limit: 8 },
  { key: "stores", name: "Trusted Stores", enabled: true, order: 6, limit: 4 },
]);

const defaultAppName = process.env.NEXT_PUBLIC_APP_NAME || "Aalm Vastralay";
const defaultTagline = process.env.NEXT_PUBLIC_BRAND_TAGLINE || "Royal Indian Wedding & Luxury Ethnic Wear";
const defaultPhone = process.env.NEXT_PUBLIC_SUPPORT_PHONE || "+91 98765 43210";
const defaultWhatsApp = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || defaultPhone;
const defaultEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@example.com";
const defaultLogoUrl = process.env.NEXT_PUBLIC_DEFAULT_LOGO_URL || "";
const defaultAddress = process.env.NEXT_PUBLIC_STORE_ADDRESS || "Main Market, Bihar, India";

export const SETTINGS_FIELDS: SettingField[] = [
  /* ---------------- brand ---------------- */
  { key: "site.name", group: "brand", label: "Site name", type: "text", default: defaultAppName },
  { key: "site.tagline", group: "brand", label: "Tagline", type: "text", default: defaultTagline },
  { key: "site.logoText", group: "brand", label: "Logo monogram", type: "text", default: defaultAppName.slice(0, 2).toUpperCase(), help: "Shown in the header when no logo image is set." },
  { key: "site.logoUrl", group: "brand", label: "Logo image URL", type: "text", default: defaultLogoUrl, help: "Supports all link types: ImageKit (ik:...), Backblaze B2 (b2:...), Google Drive, Dropbox, OneDrive, or direct https:// image URL." },
  { key: "site.faviconEmoji", group: "brand", label: "Favicon emoji", type: "text", default: "👑" },
  {
    key: "site.announcements",
    group: "brand",
    label: "Announcement bar messages",
    type: "list",
    default: "बेहतरीन क्वालिटी, उचित मूल्य — आपकी पसंद, हमारी पहचान|साड़ी, सूट, लहंगा एवं फैब्रिक्स का संपूर्ण कलेक्शन|हर अंदाज आपके लिए खास — Royal Indian Wedding & Luxury Ethnic Wear|Customer Support Available · Call / WhatsApp for Assistance",
    help: "One message per line. Supports all link types: Markdown [Text](/link), direct URLs (https://...), arrow syntax (Sale -> /products), WhatsApp (wa.me/...), or phone numbers.",
  },
  { key: "site.announcementSpeed", group: "brand", label: "Announcement scroll speed (seconds)", type: "number", default: "26", min: 8, max: 120 },
  { key: "site.phone", group: "brand", label: "Support phone", type: "text", default: defaultPhone },
  { key: "site.whatsapp", group: "brand", label: "WhatsApp number", type: "text", default: defaultWhatsApp },
  { key: "site.email", group: "brand", label: "Support email", type: "text", default: defaultEmail },
  { key: "site.address", group: "brand", label: "Registered address", type: "textarea", default: defaultAddress },
  { key: "site.copyright", group: "brand", label: "Footer copyright line", type: "text", default: `© ${new Date().getFullYear()} ${defaultAppName}. All rights reserved.` },
  { key: "site.socialInstagram", group: "brand", label: "Instagram URL", type: "text", default: "https://instagram.com" },
  { key: "site.socialYoutube", group: "brand", label: "YouTube URL", type: "text", default: "https://youtube.com" },
  { key: "site.socialFacebook", group: "brand", label: "Facebook URL", type: "text", default: "https://facebook.com" },
  { key: "brand.watermark", group: "brand", label: "Show logo watermark on product images", type: "boolean", default: "false" },
  { key: "brand.watermarkOpacity", group: "brand", label: "Watermark opacity (%)", type: "number", default: "22", min: 5, max: 80 },
  { key: "brand.logoSvg", group: "brand", label: "Use full SVG logo in header", type: "boolean", default: "true" },

  /* ---------------- theme ---------------- */
  { key: "theme.defaultMode", group: "theme", label: "Default colour mode", type: "select", options: ["light", "dark", "system"], default: "light" },
  { key: "theme.allowUserToggle", group: "theme", label: "Show dark-mode switch to visitors", type: "boolean", default: "true" },
  { key: "theme.primary", group: "theme", label: "Primary brand colour", type: "color", default: "#4A148C" },
  { key: "theme.primaryLight", group: "theme", label: "Primary (dark mode)", type: "color", default: "#6A1B9A" },
  { key: "theme.accent", group: "theme", label: "Accent / gold colour", type: "color", default: "#D4AF37" },
  { key: "theme.accentLight", group: "theme", label: "Accent (dark mode)", type: "color", default: "#E6CA65" },
  { key: "theme.bgLight", group: "theme", label: "Light background", type: "color", default: "#FAF9F6" },
  { key: "theme.bgDark", group: "theme", label: "Dark background", type: "color", default: "#12100f" },
  { key: "theme.surfaceDark", group: "theme", label: "Dark surface / cards", type: "color", default: "#1c1917" },
  { key: "theme.radius", group: "theme", label: "Corner radius", type: "text", default: "1rem" },
  { key: "theme.fontDisplay", group: "theme", label: "Display font stack", type: "text", default: 'Georgia, "Times New Roman", serif' },
  { key: "theme.density", group: "theme", label: "Layout density", type: "select", options: ["comfortable", "compact"], default: "comfortable" },

  /* ---------------- home ---------------- */
  { key: "home.bannerUrl", group: "home", label: "Hero banner image URL", type: "text", default: "/brand/poster.png" },
  { key: "home.bannerHeight", group: "home", label: "Banner height (px, desktop)", type: "number", default: "520", min: 240, max: 900 },
  { key: "home.bannerOverlay", group: "home", label: "Banner dark overlay (%)", type: "number", default: "55", min: 0, max: 95 },
  { key: "home.bannerBadge", group: "home", label: "Banner badge", type: "text", default: "Aalm Vastralay · Wedding & Ethnic Wear" },
  { key: "home.bannerTitle", group: "home", label: "Banner headline", type: "text", default: "Royal Indian Wedding & Luxury Ethnic Wear" },
  { key: "home.bannerSubtitle", group: "home", label: "Banner sub-headline", type: "textarea", default: "Exquisite Banarasi sarees, handloom silks, bridal lehengas, and regal sherwanis handcrafted by master artisans. Cash on delivery & nationwide delivery." },
  { key: "home.bannerCtaLabel", group: "home", label: "Primary button label", type: "text", default: "Explore Collections" },
  { key: "home.bannerCtaHref", group: "home", label: "Primary button link", type: "text", default: "/products?category=women" },
  { key: "home.bannerCta2Label", group: "home", label: "Secondary button label", type: "text", default: "कॉल करें (Call Us)" },
  { key: "home.bannerCta2Href", group: "home", label: "Secondary button link", type: "text", default: process.env.NEXT_PUBLIC_SUPPORT_PHONE ? `tel:${process.env.NEXT_PUBLIC_SUPPORT_PHONE}` : "tel:+919876543210" },
  { key: "home.bannerStrategy", group: "home", label: "Banner Image Delivery Strategy", type: "select", options: ["wsrv", "direct", "b2", "auto"], default: "wsrv" },
  { key: "home.bannerMirroredUrl", group: "home", label: "Banner Mirrored B2 URL", type: "text", default: "" },
  { key: "home.slides", group: "home", label: "Hero Carousel Slides (Max 5)", type: "json", default: "[]", help: "Auto-rotating Flipkart/Myntra style hero slides." },
  { key: "stats.mirroredBytes", group: "home", label: "Total Mirrored B2 Bytes", type: "number", default: "0" },
  { key: "home.announcementText", group: "home", label: "Top announcement bar text", type: "text", default: "Festive Wedding Season Sale – Up to 40% Off on Bridal Lehengas & Sherwanis" },
  { key: "home.marqueeText", group: "home", label: "Scrolling marquee ticker text", type: "text", default: "✨ Free Nationwide Shipping on Orders Above ₹999 | Handcrafted Banarasi Silks & Bridal Couture ✨" },
  { key: "home.gridDesktop", group: "home", label: "Product grid – desktop columns", type: "select", options: ["2", "3", "4", "5", "6"], default: "4" },
  { key: "home.gridTablet", group: "home", label: "Product grid – tablet columns", type: "select", options: ["2", "3", "4"], default: "3" },
  { key: "home.gridMobile", group: "home", label: "Product grid – mobile columns", type: "select", options: ["1", "2"], default: "2" },
  { key: "home.sections", group: "home", label: "Homepage sections", type: "json", default: SECTIONS_DEFAULT, help: "Enable/disable, reorder and set how many items each section shows." },
  { key: "home.occasions", group: "home", label: "Occasion chips", type: "list", default: "Bridal|Sangeet|Reception|Haldi|Festive|Groom|Wedding Guest|Cocktail" },
  { key: "home.categoryCards", group: "home", label: "Category card images", type: "json", default: JSON.stringify({ women: "/images/bridal-lehenga.jpg", men: "/images/sherwani.jpg", kids: "/images/kids-lehenga.jpg", accessories: "/images/dupatta-jewellery.jpg" }) },

  /* ---------------- commerce ---------------- */
  { key: "commerce.currencySymbol", group: "commerce", label: "Currency symbol", type: "text", default: "₹" },
  { key: "commerce.currencyCode", group: "commerce", label: "Currency code", type: "select", options: ["INR", "USD", "AED", "GBP", "EUR"], default: "INR" },
  { key: "commerce.rateFromINR", group: "commerce", label: "Display conversion rate (from INR)", type: "number", default: "1", min: 0.001, help: "Display only – all orders and invoices are settled in INR to keep calculations safe." },
  { key: "commerce.priceRounding", group: "commerce", label: "Displayed price rounding", type: "select", options: ["none", "nearest1", "nearest5", "nearest10"], default: "none" },
  { key: "commerce.freeShippingThreshold", group: "commerce", label: "Free shipping above", type: "number", default: "999", unit: "₹" },
  { key: "commerce.shippingFee", group: "commerce", label: "Standard shipping fee", type: "number", default: "49", unit: "₹" },
  { key: "commerce.codFee", group: "commerce", label: "COD handling fee", type: "number", default: "0", unit: "₹" },
  { key: "commerce.returnWindowDays", group: "commerce", label: "Return window", type: "number", default: "7", unit: "days" },
  { key: "commerce.gstPercent", group: "commerce", label: "GST rate", type: "number", default: "5", unit: "%" },
  { key: "commerce.gstInclusive", group: "commerce", label: "Prices include GST", type: "boolean", default: "true" },
  { key: "commerce.gstin", group: "commerce", label: "Marketplace GSTIN", type: "text", default: process.env.NEXT_PUBLIC_STORE_GSTIN || "10AAAAA0000A1Z5", help: "15-digit statutory GSTIN printed on tax invoices (State Code: 10 - Bihar)." },
  { key: "commerce.minOrderValue", group: "commerce", label: "Minimum order value", type: "number", default: "0", unit: "₹" },
  { key: "commerce.allowGuestBrowsing", group: "commerce", label: "Allow browsing without signing in", type: "boolean", default: "true" },
  { key: "commerce.weightUnit", group: "commerce", label: "Shipping weight unit", type: "select", options: ["kg", "g"], default: "kg" },
  { key: "products.pageSize", group: "commerce", label: "Products per page (catalogue)", type: "number", default: "24", min: 6, max: 60 },
  {
    key: "products.defaultSort",
    group: "commerce",
    label: "Default catalogue sorting",
    type: "select",
    options: ["relevance", "newest", "price_asc", "price_desc", "discount", "rating"],
    default: "relevance",
  },
  { key: "commerce.showWeight", group: "commerce", label: "Show shipping weight on product page", type: "boolean", default: "true" },

  /* ---------------- seller ---------------- */
  { key: "seller.freeMonths", group: "seller", label: "Commission-free months", type: "number", default: "6", unit: "months" },
  { key: "seller.commissionPercent", group: "seller", label: "Commission after free period", type: "number", default: "2.5", unit: "%" },
  { key: "seller.autoApproveProducts", group: "seller", label: "Auto-approve new listings", type: "boolean", default: "true" },
  { key: "seller.requireGst", group: "seller", label: "Require GSTIN for stores", type: "boolean", default: "false" },
  { key: "seller.maxImagesPerProduct", group: "seller", label: "Max images per product", type: "number", default: "8", min: 1, max: 12 },
  { key: "seller.registrationOpen", group: "seller", label: "Seller registration open", type: "boolean", default: "true" },

  /* ---------------- security ---------------- */
  { key: "security.botProtection", group: "security", label: "Bot protection", type: "select", options: ["pow", "off"], default: "pow", help: "Altcha-style proof-of-work: browsers must solve a hash puzzle before submitting forms. No third-party captcha, no API keys, works offline." },
  {
    key: "security.powDisplayMode",
    group: "security",
    label: "Bot shield archetype & style (10 types)",
    type: "select",
    options: [
      "turnstile",
      "altcha",
      "mcaptcha",
      "slide",
      "biometric",
      "shagun",
      "bar",
      "floating",
      "overlay",
      "invisible",
      "standard",
    ],
    default: "turnstile",
    help: "Choose archetype: turnstile (Cloudflare Turnstile card), altcha (Official ALTCHA PoW), mcaptcha (mCaptcha Speed/Complexity), slide (Swipe to unlock), biometric (Touch/Pulse fingerprint), shagun (Royal ethnic seal), bar (Slim inline strip), floating (Bottom-right badge), overlay (Modal gate), or invisible (Auto background solve).",
  },
  {
    key: "security.powWidgetStyle",
    group: "security",
    label: "Bot shield control style",
    type: "select",
    options: ["checkbox", "switch"],
    default: "checkbox",
    help: "Choose control type: classic checkbox [ ] or modern toggle switch ( O ).",
  },
  {
    key: "security.powLabel",
    group: "security",
    label: "Bot shield prompt label",
    type: "text",
    default: "Main robot nahi hoon",
    help: "Text displayed next to the checkbox or switch (e.g. 'Main robot nahi hoon' or 'I am not a robot').",
  },
  {
    key: "security.powTheme",
    group: "security",
    label: "Bot shield accent theme",
    type: "select",
    options: ["gold", "royal-maroon", "emerald", "neutral"],
    default: "gold",
    help: "Color accent for checkbox/switch active states and loaders.",
  },
  {
    key: "security.powSound",
    group: "security",
    label: "Play verification chime",
    type: "boolean",
    default: "true",
    help: "Plays a gentle, satisfying luxury chime upon successful verification (synthesized in browser, 0KB).",
  },
  { key: "security.powDifficulty", group: "security", label: "Proof-of-work weight (leading zeros)", type: "number", default: "3", min: 2, max: 5, help: "Higher = heavier puzzle = slower bots, slightly slower first submit for real users." },
  { key: "security.powMaxIterations", group: "security", label: "Max iterations offered to clients", type: "number", default: "100000", min: 5000, max: 500000 },
  { key: "security.formRateLimit", group: "security", label: "Form submissions per minute / IP", type: "number", default: "8", min: 1, max: 120 },
  { key: "security.authRateLimit", group: "security", label: "Sign-in attempts per 10 minutes / IP", type: "number", default: "10", min: 3, max: 60 },
  { key: "security.apiRateLimit", group: "security", label: "API requests per minute / IP", type: "number", default: "120", min: 10, max: 1000 },
  { key: "security.lockThreshold", group: "security", label: "Failed logins before lockout", type: "number", default: "6", min: 3, max: 20 },
  { key: "security.lockMinutes", group: "security", label: "Lockout duration", type: "number", default: "15", unit: "minutes" },
  { key: "security.sessionDays", group: "security", label: "Session lifetime", type: "number", default: "30", unit: "days" },
  { key: "security.requireStrongPassword", group: "security", label: "Require strong passwords", type: "boolean", default: "true", help: "Minimum 8 characters with upper, lower and a number." },
  { key: "security.trustProxyHeaders", group: "security", label: "Trust proxy IP headers (Cloudflare)", type: "boolean", default: "true" },
  { key: "security.enforceSameOrigin", group: "security", label: "Reject cross-origin form posts (CSRF)", type: "boolean", default: "true" },
  { key: "security.maxActivePerAccount", group: "security", label: "Max sign-ins per account per 10 minutes", type: "number", default: "20", min: 5, max: 100 },

  /* ---------------- features ---------------- */
  { key: "features.wishlist", group: "features", label: "Wishlist", type: "boolean", default: "true" },
  { key: "features.reviews", group: "features", label: "Ratings & reviews", type: "boolean", default: "true" },
  { key: "features.coupons", group: "features", label: "Coupon codes", type: "boolean", default: "true" },
  { key: "features.cod", group: "features", label: "Cash on Delivery", type: "boolean", default: "true" },
  { key: "features.onlinePayment", group: "features", label: "Online payment (UPI / card)", type: "boolean", default: "true" },
  { key: "features.notifications", group: "features", label: "Notifications centre", type: "boolean", default: "true" },
  { key: "features.addressBook", group: "features", label: "Saved address book", type: "boolean", default: "true" },
  { key: "features.storesDirectory", group: "features", label: "Public stores directory", type: "boolean", default: "true" },
  { key: "features.occasions", group: "features", label: "Occasion chips", type: "boolean", default: "true" },
  { key: "features.sellerHub", group: "features", label: "Seller onboarding & hub", type: "boolean", default: "true" },
  { key: "features.analytics", group: "features", label: "Privacy-friendly analytics", type: "boolean", default: "true" },
  { key: "features.showDemoAccounts", group: "features", label: "Show demo accounts box on sign-in page", type: "boolean", default: "false", help: "Enable only during staging or testing. Keep disabled in live production." },

  /* ---------------- ai & intelligence ---------------- */
  {
    key: "ai.provider",
    group: "features",
    label: "Default AI provider",
    type: "select",
    options: ["auto", "gemini", "groq", "mistral"],
    default: "auto",
    help: "Global AI provider for seller product copywriting, search and recommendations. 'auto' selects the best available free tier API key.",
  },
  {
    key: "ai.model",
    group: "features",
    label: "AI Model override",
    type: "text",
    default: "",
    help: "Optional model override (e.g. 'gemini-2.5-flash', 'llama-3.3-70b-versatile', or 'mistral-small-latest'). Leave blank for automatic best model.",
  },
];

export const SETTINGS_DEFAULTS: Record<string, string> = Object.fromEntries(SETTINGS_FIELDS.map((f) => [f.key, f.default]));
export const SETTING_KEYS = SETTINGS_FIELDS.map((f) => f.key);

export type SettingsMap = Record<string, string>;


export function parseList(raw: string) {
  return raw
    .split(/\r?\n|\|/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export type HomeSection = { key: string; name: string; enabled: boolean; order: number; limit: number };
