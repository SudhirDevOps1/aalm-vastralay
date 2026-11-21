"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Flame,
  Heart,
  HelpCircle,
  Home,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  Package,
  PackageSearch,
  Phone,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Sun,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import { signOut } from "@/actions/auth";
import { useTheme } from "@/components/theme/ThemeProvider";
import { cn, formatINR } from "@/lib/utils";
import UserAvatar from "@/components/UserAvatar";

type Category = { name: string; slug: string; children: { name: string; slug: string }[] };
type Suggestion = { id: string; title: string; slug: string; price: number; image: string; storeName: string | null };
type HeaderUser = { id: string; fullName: string | null; email: string; role: string } | null;

/** 60-second in-memory cache so typing doesn't fire a request for every keystroke revisit. */
const suggestionCache = new Map<string, { at: number; data: Suggestion[] }>();
function cachedSuggestion(q: string): Suggestion[] | null {
  const hit = suggestionCache.get(q.toLowerCase());
  if (hit && Date.now() - hit.at < 60_000) return hit.data;
  return null;
}

export default function HeaderNav({
  categories,
  user,
  cartCount,
  wishCount,
  unread,
  brandName,
  logoText,
  logoUrl,
  logoSvg,
  showWishlist,
  showNotifications,
  showSellerHub,
  showThemeToggle,
  announcementCount,
}: {
  categories: Category[];
  user: HeaderUser;
  cartCount: number;
  wishCount: number;
  unread: number;
  brandName: string;
  logoText: string;
  logoUrl: string;
  logoSvg: boolean;
  showWishlist: boolean;
  showNotifications: boolean;
  showSellerHub: boolean;
  showThemeToggle: boolean;
  announcementCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { resolvedMode, toggleMode } = useTheme();
  const [drawer, setDrawer] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [desktopActiveCat, setDesktopActiveCat] = useState<string | null>(null);
  const [headerBottom, setHeaderBottom] = useState<number>(112);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await signOut();
    } catch {
      window.location.href = "/api/auth/sign-out";
    }
  };

  const boxRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const navRootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const triggerRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const lastOpenedTriggerRef = useRef<string | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-close mobile drawer on route change (in render per React guidelines)
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    if (drawer) {
      setDrawer(false);
    }
  }

  // Guaranteed body scroll-lock with cleanup + focus restoration
  useEffect(() => {
    if (!drawer) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerRef.current?.focus();
    const hamburgerEl = hamburgerRef.current;
    return () => {
      document.body.style.overflow = originalOverflow;
      hamburgerEl?.focus({ preventScroll: true });
    };
  }, [drawer]);

  // Drawer Keyboard Navigation & Tab-cycle Focus Trap
  const handleDrawerKeyDown = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setDrawer(false);
      return;
    }
    if (e.key !== "Tab" || !drawerRef.current) return;
    const focusables = Array.from(
      drawerRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => el.offsetParent !== null);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  }, []);

  // Measure header bottom offset once on mount & on resize (passive listener, zero scroll listener)
  const updateHeaderHeight = useCallback(() => {
    if (navRootRef.current) {
      const headerEl = navRootRef.current.closest("header");
      const rect = headerEl?.getBoundingClientRect() ?? navRootRef.current.getBoundingClientRect();
      const h = Math.round(rect.bottom || rect.height || 112);
      setHeaderBottom(h);
      document.documentElement.style.setProperty("--header-h", `${h}px`);
    }
  }, []);

  useEffect(() => {
    updateHeaderHeight();
    window.addEventListener("resize", updateHeaderHeight, { passive: true });
    return () => window.removeEventListener("resize", updateHeaderHeight);
  }, [updateHeaderHeight]);

  const openCategory = useCallback((slug: string) => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    if (process.env.NODE_ENV !== "production") {
      const t0 = performance.now();
      requestAnimationFrame(() => {
        const dt = performance.now() - t0;
        if (dt > 100) console.warn(`[HeaderNav] Mega-menu open took ${dt.toFixed(1)}ms (>100ms)`);
      });
    }
    lastOpenedTriggerRef.current = slug;
    setDesktopActiveCat(slug);
  }, []);

  const closeCategory = useCallback((returnFocus = false) => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setDesktopActiveCat(null);
    if (returnFocus && lastOpenedTriggerRef.current) {
      const btn = triggerRefs.current.get(lastOpenedTriggerRef.current);
      if (btn) btn.focus({ preventScroll: true });
    }
  }, []);

  const scheduleCloseCategory = useCallback(() => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = setTimeout(() => {
      setDesktopActiveCat(null);
    }, 160);
  }, []);

  const cancelCloseCategory = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const toggleCategory = useCallback((slug: string) => {
    if (desktopActiveCat === slug) {
      closeCategory(true);
    } else {
      openCategory(slug);
    }
  }, [desktopActiveCat, closeCategory, openCategory]);

  const handleMenuKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeCategory(true);
      return;
    }
    if (!panelRef.current) return;
    const items = Array.from(panelRef.current.querySelectorAll<HTMLAnchorElement>('a[role="menuitem"]'));
    if (items.length === 0) return;
    const currentIndex = items.findIndex((item) => item === document.activeElement);

    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
      items[nextIndex]?.focus({ preventScroll: true });
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
      items[prevIndex]?.focus({ preventScroll: true });
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus({ preventScroll: true });
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus({ preventScroll: true });
    }
  }, [closeCategory]);

  const handleTriggerKeyDown = useCallback((e: React.KeyboardEvent<HTMLButtonElement>, slug: string) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openCategory(slug);
      if (e.key === "ArrowDown") {
        requestAnimationFrame(() => {
          const first = panelRef.current?.querySelector<HTMLAnchorElement>('a[role="menuitem"]');
          first?.focus({ preventScroll: true });
        });
      }
    } else if (e.key === "Escape") {
      closeCategory(false);
    }
  }, [openCategory, closeCategory]);

  // Debounced live search suggestions
  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const key = query.trim().toLowerCase();
      const warm = cachedSuggestion(key);
      if (warm) {
        setSuggestions(warm);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(key)}`, { signal: controller.signal });
        if (res.ok) {
          const json = (await res.json()) as { products: Suggestion[] };
          const data = json.products ?? [];
          suggestionCache.set(key, { at: Date.now(), data });
          if (suggestionCache.size > 200) suggestionCache.delete(suggestionCache.keys().next().value!);
          setSuggestions(data);
        }
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Global click & Escape dismissal for search suggestions, user menu, and desktop mega-menu
  useEffect(() => {
    const onGlobalClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setSuggestions([]);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);

      if (desktopActiveCat && panelRef.current && !panelRef.current.contains(e.target as Node)) {
        let isTrigger = false;
        triggerRefs.current.forEach((btn) => {
          if (btn.contains(e.target as Node)) isTrigger = true;
        });
        if (!isTrigger) closeCategory(false);
      }
    };

    const onGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (desktopActiveCat) closeCategory(true);
        if (userMenuOpen) setUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onGlobalClick);
    document.addEventListener("keydown", onGlobalKeyDown);
    return () => {
      document.removeEventListener("mousedown", onGlobalClick);
      document.removeEventListener("keydown", onGlobalKeyDown);
    };
  }, [desktopActiveCat, userMenuOpen, closeCategory]);

  useEffect(() => {
    document.body.style.overflow = drawer ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawer]);

  const isSeller = user?.role === "seller" || user?.role === "admin";
  const groups = useMemo(() => categories.slice(0, 6), [categories]);
  const activeGroup = useMemo(() => groups.find((g) => g.slug === desktopActiveCat), [groups, desktopActiveCat]);

  function submit(e?: React.SyntheticEvent) {
    if (e) e.preventDefault();
    setSuggestions([]);
    setDrawer(false);
    let targetQ = query.trim();
    if (e && "currentTarget" in e && e.currentTarget instanceof HTMLFormElement) {
      const formData = new FormData(e.currentTarget);
      const formQ = formData.get("q");
      if (typeof formQ === "string" && formQ.trim()) {
        targetQ = formQ.trim();
      }
    }
    if (!targetQ) return;
    router.push(`/products?q=${encodeURIComponent(targetQ)}`);
  }

  return (
    <div ref={navRootRef} className="mx-auto max-w-7xl px-2.5 sm:px-4">
      <div className="flex h-14 sm:h-16 items-center justify-between gap-1.5 sm:gap-4">
        {/* Mobile Hamburger Button */}
        <button
          ref={hamburgerRef}
          type="button"
          onClick={() => setDrawer(true)}
          className="btn btn-ghost btn-icon md:!hidden text-[color:var(--brand)] hover:bg-[color:var(--surface-2)] min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
          aria-label="Open mobile navigation menu"
          aria-expanded={drawer}
          aria-controls="mobile-drawer-panel"
        >
          <Menu className="h-6 w-6" />
        </button>

        {/* Master Brand Identity Logo (Visible in both Light & Dark Mode) */}
        <Link href="/" className="flex shrink-0 items-center gap-2.5 transition-opacity hover:opacity-90">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={brandName} className="h-10 w-auto max-w-[10rem] object-contain" />
          ) : (
            <div className="flex items-center gap-2.5">
              {/* Royal Gold + Purple Medallion Icon */}
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#4A148C] via-[#38006b] to-[#120024] p-0.5 shadow-md ring-1 ring-[#D4AF37]/60">
                <span className="font-serif text-base font-extrabold tracking-tight text-[#D4AF37]">
                  {logoText || "AV"}
                </span>
                <span className="absolute inset-0 rounded-full border border-[#D4AF37]/30" />
              </div>

              {/* Brand Typography */}
              <div className="flex flex-col">
                <span className="font-display text-lg sm:text-xl font-bold tracking-wide leading-none text-[color:var(--brand)]">
                  AALM <span className="font-serif text-[#D4AF37] drop-shadow-xs">VASTRALAY</span>
                </span>
                <span className="hidden sm:block text-[9px] font-semibold tracking-[0.22em] text-[color:var(--text-soft)] uppercase mt-0.5">
                  Wedding &amp; Ethnic Wear Collection
                </span>
              </div>
            </div>
          )}
          <span className="sr-only">Home</span>
        </Link>

        {/* Desktop Search Bar with Live Suggestions */}
        <div ref={boxRef} className="relative hidden flex-1 md:block max-w-2xl mx-auto">
          <form
            action="/products"
            method="GET"
            onSubmit={submit}
            className="flex w-full items-center rounded-full border border-[color:var(--border-strong)] bg-[color:var(--surface-2)] pl-4 pr-1 focus-within:border-[color:var(--accent)] focus-within:ring-2 focus-within:ring-[color:var(--accent)]/20 transition-all"
          >
            <Search className="h-4 w-4 text-[color:var(--text-soft)]" />
            <input
              name="q"
              value={query}
              onChange={(e) => {
                const val = e.target.value;
                setQuery(val);
                if (val.trim().length < 2) setSuggestions([]);
              }}
              type="search"
              placeholder="Try “bridal lehenga”, “banarasi saree”, “sherwani”, “kurta”…"
              className="h-10 w-full bg-transparent px-2.5 text-sm outline-none placeholder:text-[color:var(--text-soft)] text-[color:var(--text)]"
              aria-label="Search products"
            />
            {loading && <Loader2 className="h-4 w-4 animate-spin text-[color:var(--text-soft)] mr-1" />}
            <button
              type="submit"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[color:var(--brand)] text-white hover:opacity-90 transition-opacity"
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </button>
          </form>

          {suggestions.length > 0 && (
            <div className="absolute top-12 left-0 z-50 w-full overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-2xl">
              <p className="border-b border-[color:var(--border)] px-4 py-2 text-[11px] font-bold tracking-wider text-[color:var(--text-soft)] uppercase">
                Matching Ethnic Wear
              </p>
              <ul>
                {suggestions.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/products/${s.slug}`}
                      onClick={() => setSuggestions([])}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-[color:var(--surface-2)] transition-colors"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.image} alt="" className="h-11 w-9 rounded object-cover border border-[color:var(--border)]" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-[color:var(--text)]">{s.title}</span>
                        <span className="block truncate text-xs text-[color:var(--text-soft)]">{s.storeName}</span>
                      </span>
                      <span className="text-sm font-semibold text-[color:var(--brand)]">{formatINR(s.price)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={submit}
                className="w-full border-t border-[color:var(--border)] px-4 py-2 text-center text-xs font-semibold text-[color:var(--brand)] hover:bg-[color:var(--surface-2)]"
              >
                See all results for “{query}” →
              </button>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <nav className="ml-auto flex items-center gap-1 sm:gap-2">
          {showSellerHub && (
            <Link
              href="/seller"
              className="hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-[color:var(--brand)] hover:bg-[color:var(--surface-2)] border border-[color:var(--border)] lg:flex"
            >
              <Store className="h-3.5 w-3.5 text-[color:var(--accent)]" /> {isSeller ? "Seller Hub" : "Sell on Aalm"}
            </Link>
          )}

          {showThemeToggle && (
            <button
              type="button"
              onClick={toggleMode}
              className="btn btn-ghost btn-icon hidden sm:inline-flex"
              aria-label="Toggle light or dark color mode"
            >
              <Sun className="hidden h-5 w-5 dark:block text-amber-400" />
              <Moon className="h-5 w-5 dark:hidden text-slate-700" />
            </button>
          )}

          {user && showNotifications && (
            <Link
              href="/notifications"
              className="relative rounded-full p-2 text-[color:var(--text-muted)] hover:bg-[color:var(--surface-2)]"
              aria-label="Notifications"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[color:var(--accent)] px-1 text-[10px] font-bold text-[color:var(--accent-fg)]">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
          )}

          {showWishlist && (
            <Link
              href="/wishlist"
              className="relative rounded-full p-2 text-[color:var(--text-muted)] hover:bg-[color:var(--surface-2)]"
              aria-label="Wishlist"
            >
              <Heart className="h-5 w-5" />
              {wishCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[color:var(--brand)] px-1 text-[10px] font-bold text-white">
                  {wishCount > 9 ? "9+" : wishCount}
                </span>
              )}
            </Link>
          )}

          <Link
            href="/cart"
            className="relative rounded-full p-2 text-[color:var(--text-muted)] hover:bg-[color:var(--surface-2)]"
            aria-label="Cart"
          >
            <ShoppingBag className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[color:var(--brand)] px-1 text-[10px] font-bold text-white">
                {cartCount > 9 ? "9+" : cartCount}
              </span>
            )}
          </Link>

          {user ? (
            <div ref={userMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen((o) => !o)}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                className="flex cursor-pointer items-center gap-2 rounded-full border border-[color:var(--border-strong)] py-1 pl-1 pr-2.5 hover:bg-[color:var(--surface-2)] transition focus:outline-none focus:ring-2 focus:ring-[color:var(--brand)]/40"
              >
                <UserAvatar
                  seed={user.id}
                  name={user.fullName ?? user.email}
                  size={28}
                  className="h-7 w-7 rounded-full border border-[color:var(--accent)] object-cover shadow-xs"
                />
                <span className="hidden max-w-[7rem] truncate text-sm font-medium sm:block text-[color:var(--text)]">
                  {user.fullName?.split(" ")[0] ?? "Account"}
                </span>
                <ChevronDown className={cn("hidden sm:block h-3.5 w-3.5 text-[color:var(--text-soft)] transition-transform duration-200", userMenuOpen && "rotate-180")} />
              </button>
              {userMenuOpen && (
                <div className="animate-fade-in absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-1.5 text-[color:var(--text)] shadow-2xl ring-1 ring-black/5 dark:ring-white/10">
                  <div className="border-b border-[color:var(--border)] px-3 py-2">
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <UserAvatar
                        seed={user.id}
                        name={user.fullName ?? user.email}
                        size={36}
                        className="h-9 w-9 shrink-0 rounded-full border border-[color:var(--border)] object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[color:var(--text)]">{user.fullName}</p>
                        <p className="truncate text-xs text-[color:var(--text-soft)]">{user.email}</p>
                        <span className="badge mt-1 capitalize">{user.role}</span>
                      </div>
                    </div>
                  </div>
                  <div className="py-1">
                    <MenuLink href="/dashboard" icon={<LayoutDashboard className="h-4 w-4" />} label="My Account" onClick={() => setUserMenuOpen(false)} />
                    <MenuLink href="/orders" icon={<Package className="h-4 w-4" />} label="My Orders" onClick={() => setUserMenuOpen(false)} />
                    {showWishlist && <MenuLink href="/wishlist" icon={<Heart className="h-4 w-4" />} label="Wishlist" onClick={() => setUserMenuOpen(false)} />}
                    {isSeller ? (
                      <MenuLink href="/seller" icon={<Store className="h-4 w-4" />} label="Seller Hub" onClick={() => setUserMenuOpen(false)} />
                    ) : (
                      <MenuLink href="/onboarding" icon={<Store className="h-4 w-4" />} label="Become a Seller" onClick={() => setUserMenuOpen(false)} />
                    )}
                    {user.role === "admin" && (
                      <MenuLink href="/admin" icon={<ShieldCheck className="h-4 w-4" />} label="Admin Panel" onClick={() => setUserMenuOpen(false)} />
                    )}
                  </div>
                  <div className="border-t border-[color:var(--border)] pt-1" onClick={(e) => e.stopPropagation()}>
                    <form action="/api/auth/sign-out" method="POST" onSubmit={handleSignOut}>
                      <button
                        type="submit"
                        disabled={isSigningOut}
                        className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-rose-600 hover:bg-[color:var(--surface-2)] transition disabled:opacity-60"
                      >
                        {isSigningOut ? (
                          <Loader2 className="h-4 w-4 animate-spin text-rose-600" />
                        ) : (
                          <LogOut className="h-4 w-4 text-rose-600" />
                        )}
                        <span>{isSigningOut ? "Signing out..." : "Sign out"}</span>
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="btn btn-primary btn-sm ml-1 text-xs hidden sm:inline-flex"
              >
                Sign in
              </Link>
              <Link
                href="/sign-in"
                className="btn btn-ghost btn-icon sm:hidden text-[color:var(--text-muted)]"
                aria-label="Sign in"
                title="Sign in"
              >
                <UserRound className="h-5 w-5" />
              </Link>
            </>
          )}
        </nav>
      </div>

      {/* Mobile Search Input */}
      <div className="pb-2 md:hidden">
        <form
          action="/products"
          method="GET"
          onSubmit={submit}
          className="flex items-center rounded-full border border-[color:var(--border-strong)] bg-[color:var(--surface-2)] pl-3.5 pr-1 focus-within:border-[color:var(--accent)]"
        >
          <Search className="h-3.5 w-3.5 text-[color:var(--text-soft)] shrink-0" />
          <input
            name="q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="search"
            placeholder="Search sarees, lehengas, kurtas…"
            className="h-8 sm:h-9 w-full bg-transparent px-2 text-xs sm:text-sm text-[color:var(--text)] outline-none placeholder:text-[color:var(--text-soft)]"
            aria-label="Search products"
          />
          <button
            type="submit"
            className="grid h-6.5 w-6.5 sm:h-7 sm:w-7 shrink-0 place-items-center rounded-full bg-[color:var(--brand)] text-white hover:opacity-90"
            aria-label="Search"
          >
            <Search className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          </button>
        </form>
      </div>

      {/* Desktop Category Navigation Strip (Horizontal pill row ONLY) */}
      <div className="hidden border-t border-[color:var(--border)] md:block">
        <div className="no-scrollbar flex snap-x items-center gap-1 overflow-x-auto py-1.5 text-[13px]">
          <Link
            href="/products"
            className="shrink-0 snap-start min-h-[44px] inline-flex items-center rounded-full px-3.5 py-1 font-semibold text-[color:var(--brand)] underline decoration-[#D4AF37] decoration-2 underline-offset-4 hover:bg-[color:var(--surface-2)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
          >
            All Products
          </Link>
          {groups.map((c) => {
            const hasChildren = c.children && c.children.length > 0;
            if (!hasChildren) {
              return (
                <Link
                  key={c.slug}
                  href={`/products?category=${c.slug}`}
                  className="shrink-0 snap-start min-h-[44px] inline-flex items-center rounded-full px-3.5 py-1 font-medium text-[color:var(--text-muted)] hover:bg-[color:var(--surface-2)] hover:text-[color:var(--brand)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
                >
                  {c.name}
                </Link>
              );
            }

            return (
              <button
                key={c.slug}
                ref={(el) => {
                  if (el) triggerRefs.current.set(c.slug, el);
                  else triggerRefs.current.delete(c.slug);
                }}
                type="button"
                aria-expanded={desktopActiveCat === c.slug}
                aria-controls={`mega-menu-${c.slug}`}
                aria-haspopup="menu"
                onClick={() => toggleCategory(c.slug)}
                onMouseEnter={() => openCategory(c.slug)}
                onMouseLeave={scheduleCloseCategory}
                onKeyDown={(e) => handleTriggerKeyDown(e, c.slug)}
                className={cn(
                  "shrink-0 snap-start min-h-[44px] inline-flex items-center gap-1 rounded-full px-3.5 py-1 text-[13px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]",
                  desktopActiveCat === c.slug
                    ? "bg-[color:var(--surface-2)] text-[color:var(--brand)] font-bold shadow-xs ring-1 ring-[color:var(--border)]"
                    : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-2)] hover:text-[color:var(--brand)]"
                )}
              >
                <span>{c.name}</span>
                <ChevronDown
                  className={cn(
                    "h-3 w-3 opacity-60 transition-transform duration-200",
                    desktopActiveCat === c.slug && "rotate-180 opacity-100 text-[color:var(--brand)]"
                  )}
                />
              </button>
            );
          })}
          <Link
            href="/products?sort=discount"
            className="shrink-0 rounded-full px-3.5 py-1 min-h-[44px] inline-flex items-center font-semibold text-amber-600 dark:text-amber-400 hover:bg-[color:var(--surface-2)] gap-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
          >
            <Flame className="h-3.5 w-3.5 fill-amber-500 text-amber-500" /> Wedding Sale
          </Link>
          <Link
            href="/stores"
            className="shrink-0 rounded-full px-3.5 py-1 min-h-[44px] inline-flex items-center font-medium text-[color:var(--text-muted)] hover:bg-[color:var(--surface-2)] hover:text-[color:var(--brand)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
          >
            Stores &amp; Artisans
          </Link>
        </div>
      </div>

      {/* 👑 DESKTOP FIXED MEGA-MENU LAYER (Outside overflow-x-auto container — never clipped) */}
      <div
        ref={panelRef}
        onMouseEnter={cancelCloseCategory}
        onMouseLeave={scheduleCloseCategory}
        onKeyDown={handleMenuKeyDown}
        className={cn(
          "hidden md:block fixed left-0 right-0 z-50 transition-all duration-200 ease-out",
          desktopActiveCat && activeGroup
            ? "visible opacity-100 translate-y-0 pointer-events-auto will-change-[transform,opacity]"
            : "invisible opacity-0 -translate-y-2 pointer-events-none"
        )}
        style={{
          top: `${headerBottom}px`,
          maxHeight: `calc(100dvh - ${headerBottom}px - 20px)`,
        }}
      >
        {/* Backdrop click dismiss */}
        <div
          className={cn(
            "fixed inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-200 -z-10",
            desktopActiveCat ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          style={{ top: `${headerBottom}px` }}
          onClick={() => closeCategory(true)}
          aria-hidden="true"
        />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-2">
          {activeGroup && (
            <div
              id={`mega-menu-${activeGroup.slug}`}
              role="menu"
              aria-label={`${activeGroup.name} subcategories`}
              className="overflow-y-auto no-scrollbar rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)]/98 p-6 shadow-2xl backdrop-blur-xl ring-1 ring-black/5 dark:ring-white/10"
              style={{ maxHeight: `calc(100dvh - ${headerBottom}px - 48px)` }}
            >
              {/* Header Bar */}
              <div className="flex items-center justify-between border-b border-[color:var(--border)]/70 pb-4 mb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold tracking-widest text-[#D4AF37] uppercase">Collection</span>
                    <span className="text-xs text-[color:var(--text-soft)]">·</span>
                    <span className="text-xs text-[color:var(--text-soft)]">{activeGroup.children.length} Subcategories</span>
                  </div>
                  <h3 className="font-display text-xl sm:text-2xl font-bold text-[color:var(--brand)]">
                    {activeGroup.name}
                  </h3>
                </div>

                <div className="flex items-center gap-3">
                  <Link
                    href={`/products?category=${activeGroup.slug}`}
                    onClick={() => closeCategory(false)}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-[color:var(--brand)] px-4 py-2 text-xs font-bold text-white shadow-sm hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
                    role="menuitem"
                  >
                    <span>View All {activeGroup.name}</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>

                  <button
                    type="button"
                    onClick={() => closeCategory(true)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--text-soft)] hover:bg-[color:var(--surface-2)] hover:text-[color:var(--text)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
                    aria-label="Close category menu"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Subcategories Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {activeGroup.children.map((child) => (
                  <Link
                    key={child.slug}
                    href={`/products?category=${child.slug}`}
                    onClick={() => closeCategory(false)}
                    role="menuitem"
                    className="group/item flex min-h-[44px] items-center justify-between rounded-2xl border border-[color:var(--border)]/60 bg-[color:var(--surface-2)] px-4 py-3 text-sm font-medium text-[color:var(--text)] transition-all hover:border-[color:var(--accent)] hover:bg-[color:var(--surface)] hover:text-[color:var(--brand)] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--accent)] transition-transform group-hover/item:scale-150" />
                      <span className="truncate">{child.name}</span>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-[color:var(--text-soft)] transition-transform group-hover/item:translate-x-0.5 group-hover/item:text-[color:var(--brand)]" />
                  </Link>
                ))}
              </div>

              {/* Trust Badge Strip */}
              <div className="mt-5 flex items-center justify-between rounded-2xl border border-[#D4AF37]/30 bg-gradient-to-r from-[#D4AF37]/10 via-transparent to-[#D4AF37]/10 px-4 py-2.5 text-xs text-[color:var(--text-muted)]">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#D4AF37]" />
                  <span className="font-semibold text-[color:var(--text)]">100% Authentic Handcrafted Quality</span>
                  <span className="text-[color:var(--text-soft)]">· Pure Silk, Banarasi &amp; Bridal Collections</span>
                </div>
                <span className="hidden sm:inline text-[11px] font-medium text-[#D4AF37]">Free Shipping &gt; ₹999 · COD Available</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 👑 ELITE FULL-HEIGHT MOBILE DRAWER (Fixed Slide-over) */}
      {drawer && (
        <div className="fixed inset-0 z-[100] md:hidden">
          {/* Backdrop Blur Overlay with interactive close */}
          <button
            type="button"
            aria-label="Close navigation drawer"
            onClick={() => setDrawer(false)}
            className="fixed inset-0 w-full h-full bg-black/70 backdrop-blur-xs transition-opacity duration-300 cursor-default"
            tabIndex={-1}
          />

          {/* Sliding Panel */}
          <aside
            id="mobile-drawer-panel"
            ref={drawerRef}
            tabIndex={-1}
            onKeyDown={handleDrawerKeyDown}
            role="dialog"
            aria-modal="true"
            aria-label="Mobile Navigation"
            className="animate-slide-left fixed inset-y-0 left-0 flex h-full w-[min(88vw,360px)] flex-col bg-[color:var(--surface)] text-[color:var(--text)] shadow-2xl border-r border-[color:var(--border)] z-[101] overflow-hidden outline-none transition-transform duration-250 ease-out motion-reduce:transition-none"
          >
            {/* Royal Header */}
            <div className="relative shrink-0 bg-gradient-to-br from-[#4A148C] via-[#38006b] to-[#1a0033] p-5 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#38006b] border border-[#D4AF37] shadow-md">
                    <span className="font-serif text-lg font-bold text-[#D4AF37]">{logoText || "AV"}</span>
                  </div>
                  <div>
                    <h2 className="font-display text-base font-bold tracking-wide text-white">
                      आलम वस्त्रालय
                    </h2>
                    <p className="text-[10px] font-medium tracking-widest text-[#D4AF37] uppercase">
                      Royal Indian Wedding &amp; Luxury Ethnic Wear
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setDrawer(false)}
                  className="h-11 w-11 grid place-items-center rounded-full text-white/80 hover:bg-white/10 hover:text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* User Bar in Drawer */}
              {user ? (
                <div className="mt-4 rounded-xl bg-white/10 p-2.5 backdrop-blur-sm border border-white/15">
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      seed={user.id}
                      name={user.fullName ?? user.email}
                      size={36}
                      className="h-9 w-9 shrink-0 rounded-full border border-[#D4AF37] object-cover shadow-xs"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-white">{user.fullName || "Account"}</p>
                      <p className="truncate text-[10px] text-white/70">{user.email}</p>
                    </div>
                    <span className="rounded-full bg-[#D4AF37]/20 px-2 py-0.5 text-[10px] font-bold text-[#D4AF37] border border-[#D4AF37]/40 uppercase">
                      {user.role}
                    </span>
                  </div>
                  <div className="mt-2.5 border-t border-white/15 pt-2">
                    <button
                      type="button"
                      onClick={handleSignOut}
                      disabled={isSigningOut}
                      className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-rose-500/20 border border-rose-500/40 px-3 py-2 text-xs font-bold text-rose-200 hover:bg-rose-500/30 transition disabled:opacity-60"
                    >
                      {isSigningOut ? (
                        <Loader2 className="h-4 w-4 animate-spin text-rose-300" />
                      ) : (
                        <LogOut className="h-4 w-4 text-rose-300" />
                      )}
                      <span>{isSigningOut ? "Signing out..." : "Sign out"}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Link
                    href="/sign-in"
                    onClick={() => setDrawer(false)}
                    className="btn btn-gold min-h-[44px] py-2 text-xs text-center justify-center font-bold flex items-center"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/sign-up"
                    onClick={() => setDrawer(false)}
                    className="btn min-h-[44px] py-2 text-xs text-center justify-center border border-white/40 bg-white/10 text-white hover:bg-white/20 flex items-center"
                  >
                    Register
                  </Link>
                </div>
              )}
            </div>

            {/* Quick Action Navigation Grid */}
            <div className="grid grid-cols-3 gap-2 p-3 shrink-0 border-b border-[color:var(--border)] bg-[color:var(--surface-2)] text-center text-xs">
              <Link
                href="/products?sort=discount"
                onClick={() => setDrawer(false)}
                className="flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-xl p-2 hover:bg-[color:var(--surface)] text-amber-600 dark:text-amber-400 font-semibold"
              >
                <Flame className="h-4 w-4" />
                <span>Wedding Sale</span>
              </Link>
              <Link
                href="/track-order"
                onClick={() => setDrawer(false)}
                className="flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-xl p-2 hover:bg-[color:var(--surface)] text-[color:var(--brand)] font-semibold"
              >
                <Truck className="h-4 w-4" />
                <span>Track Order</span>
              </Link>
              <Link
                href="/orders"
                onClick={() => setDrawer(false)}
                className="flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-xl p-2 hover:bg-[color:var(--surface)] text-[color:var(--text)] font-semibold"
              >
                <Package className="h-4 w-4" />
                <span>My Orders</span>
              </Link>
            </div>

            {/* Main Menu Links & Categories */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 space-y-4">
              {/* In-drawer Compact Search */}
              <form
                action="/products"
                method="GET"
                onSubmit={submit}
                className="relative mb-3 flex min-h-[44px] items-center rounded-2xl border border-[color:var(--border-strong)] bg-[color:var(--surface-2)] pl-3 pr-1.5 focus-within:border-[color:var(--accent)]"
              >
                <Search className="h-4 w-4 text-[color:var(--text-soft)] shrink-0" />
                <input
                  name="q"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setQuery("");
                    }
                  }}
                  type="search"
                  placeholder="Search sarees, lehengas…"
                  className="h-9 w-full bg-transparent px-2 text-sm text-[color:var(--text)] outline-none placeholder:text-[color:var(--text-soft)]"
                  aria-label="Search products in navigation drawer"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="h-9 w-9 grid place-items-center rounded-full text-[color:var(--text-soft)] hover:text-[color:var(--text)]"
                    aria-label="Clear search query"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </form>

              {/* Category Taxonomies */}
              <div>
                <p className="px-2 text-[11px] font-bold uppercase tracking-wider text-[color:var(--accent)] mb-1">
                  Shop Ethnic Collections
                </p>
                <div className="space-y-0.5">
                  <Link
                    href="/products"
                    onClick={() => setDrawer(false)}
                    className="flex min-h-[44px] items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold text-[color:var(--brand)] hover:bg-[color:var(--surface-2)]"
                  >
                    <span>Browse All Collections</span>
                    <ChevronRight className="h-4 w-4 text-[color:var(--text-soft)]" />
                  </Link>

                  {categories.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-6 text-center rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-2)]">
                      <PackageSearch className="h-10 w-10 text-[color:var(--text-soft)] mb-2" />
                      <p className="text-sm font-semibold text-[color:var(--text)]">Naye collection jald aa rahe hain</p>
                      <p className="text-xs text-[color:var(--text-soft)] mt-1">Humaare boutique collections browse karein</p>
                      <Link
                        href="/products"
                        onClick={() => setDrawer(false)}
                        className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[color:var(--brand)] px-4 py-2 text-xs font-bold text-white shadow-sm hover:opacity-90"
                      >
                        Browse All Collections
                      </Link>
                    </div>
                  ) : (
                    categories.map((c) => (
                      <div key={c.slug}>
                        {c.children.length === 0 ? (
                          <Link
                            href={`/products?category=${c.slug}`}
                            onClick={() => setDrawer(false)}
                            className="flex min-h-[44px] w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium text-[color:var(--text)] hover:bg-[color:var(--surface-2)] transition-colors"
                          >
                            <span>{c.name}</span>
                            <ChevronRight className="h-4 w-4 text-[color:var(--text-soft)]" />
                          </Link>
                        ) : (
                          <div>
                            <button
                              type="button"
                              onClick={() => setOpenCat(openCat === c.slug ? null : c.slug)}
                              className="flex min-h-[44px] w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium text-[color:var(--text)] hover:bg-[color:var(--surface-2)] transition-colors"
                            >
                              <span>{c.name}</span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] rounded-full bg-[color:var(--surface-2)] px-2 py-0.5 text-[color:var(--text-soft)] font-semibold">
                                  {c.children.length}
                                </span>
                                <ChevronDown
                                  className={cn(
                                    "h-4 w-4 text-[color:var(--text-soft)] transition-transform duration-200",
                                    openCat === c.slug && "rotate-180 text-[color:var(--brand)]",
                                  )}
                                />
                              </div>
                            </button>

                            {openCat === c.slug && (
                              <div className="ml-3 my-1 space-y-1 border-l-2 border-[color:var(--accent)]/40 pl-3">
                                <Link
                                  href={`/products?category=${c.slug}`}
                                  onClick={() => setDrawer(false)}
                                  className="flex min-h-[44px] items-center rounded-lg px-2 py-1.5 text-xs font-semibold text-[color:var(--brand)] hover:bg-[color:var(--surface-2)]"
                                >
                                  All {c.name} →
                                </Link>
                                {c.children.map((child) => (
                                  <Link
                                    key={child.slug}
                                    href={`/products?category=${child.slug}`}
                                    onClick={() => setDrawer(false)}
                                    className="flex min-h-[44px] items-center rounded-lg px-2 py-1.5 text-xs text-[color:var(--text-muted)] hover:bg-[color:var(--surface-2)] hover:text-[color:var(--brand)]"
                                  >
                                    {child.name}
                                  </Link>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Marketplace Links */}
              <div>
                <p className="px-2 text-[11px] font-bold uppercase tracking-wider text-[color:var(--accent)] mb-1">
                  Marketplace &amp; Sellers
                </p>
                <div className="space-y-0.5 text-sm">
                  <Link
                    href="/stores"
                    onClick={() => setDrawer(false)}
                    className="flex min-h-[44px] items-center gap-2.5 rounded-xl px-3 py-2 text-[color:var(--text)] hover:bg-[color:var(--surface-2)]"
                  >
                    <Store className="h-4 w-4 text-[color:var(--accent)]" />
                    <span>Explore Boutiques &amp; Stores</span>
                  </Link>

                  {isSeller ? (
                    <Link
                      href="/seller"
                      onClick={() => setDrawer(false)}
                      className="flex min-h-[44px] items-center gap-2.5 rounded-xl px-3 py-2 text-[color:var(--brand)] font-semibold hover:bg-[color:var(--surface-2)]"
                    >
                      <Store className="h-4 w-4 text-[color:var(--accent)]" />
                      <span>Seller Portal Hub</span>
                    </Link>
                  ) : (
                    <Link
                      href="/onboarding"
                      onClick={() => setDrawer(false)}
                      className="flex min-h-[44px] items-center gap-2.5 rounded-xl px-3 py-2 text-[color:var(--text)] hover:bg-[color:var(--surface-2)]"
                    >
                      <Sparkles className="h-4 w-4 text-[color:var(--accent)]" />
                      <span>Sell with 0% Commission</span>
                    </Link>
                  )}

                  {user?.role === "admin" && (
                    <Link
                      href="/admin"
                      onClick={() => setDrawer(false)}
                      className="flex min-h-[44px] items-center gap-2.5 rounded-xl px-3 py-2 text-purple-700 dark:text-purple-400 font-bold hover:bg-[color:var(--surface-2)]"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      <span>Admin Management Console</span>
                    </Link>
                  )}

                  <Link
                    href="/handbook"
                    onClick={() => setDrawer(false)}
                    className="flex min-h-[44px] items-center gap-2.5 rounded-xl px-3 py-2 text-[color:var(--text)] hover:bg-[color:var(--surface-2)]"
                  >
                    <HelpCircle className="h-4 w-4 text-[color:var(--accent)]" />
                    <span>Seller Handbook &amp; Standards</span>
                  </Link>
                </div>
              </div>

              {/* Direct WhatsApp Consultation Button */}
              <div className="pt-1">
                <a
                  href={`https://wa.me/${(process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || "919876543210").replace(/\D/g, "")}?text=Namaste,%20I%20would%20like%20to%20consult%20for%20bridal/wedding%20wear%20and%20sarees.`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-[44px] items-center justify-center gap-2 w-full rounded-2xl bg-[#25D366] px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#1fb855] transition-all"
                >
                  <MessageCircle className="h-4 w-4 fill-white" />
                  <span>WhatsApp Bridal Consultation</span>
                </a>
                <p className="mt-1 text-center text-[10px] text-[color:var(--text-soft)]">
                  Customer Support: {process.env.NEXT_PUBLIC_SUPPORT_PHONE || "+91 98765 43210"}
                </p>
              </div>

              {/* Theme & Support */}
              <div className="border-t border-[color:var(--border)] pt-3 flex items-center justify-between text-xs text-[color:var(--text-soft)]">
                <button
                  type="button"
                  onClick={toggleMode}
                  className="flex min-h-[44px] items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[color:var(--surface-2)]"
                >
                  {resolvedMode === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
                  <span>{resolvedMode === "dark" ? "Light Mode" : "Dark Mode"}</span>
                </button>

                <Link href="/contact" onClick={() => setDrawer(false)} className="flex min-h-[44px] items-center px-2 py-1.5 hover:text-[color:var(--brand)]">
                  Help &amp; Support
                </Link>
              </div>
            </div>

            {/* Footer Trust Guarantees */}
            <div
              className="border-t border-[color:var(--border)] bg-[color:var(--surface-2)] p-3 text-center text-[11px] font-medium text-[color:var(--text-soft)]"
              style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0.75rem))" }}
            >
              ✨ 100% Authentic Handloom · Free Shipping &gt; ₹999 · COD
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function MenuLink({ href, icon, label, onClick }: { href: string; icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-[color:var(--text-muted)] hover:bg-[color:var(--surface-2)] hover:text-[color:var(--brand)] active:scale-[0.97] active:bg-[color:var(--surface-3)] transition-all tap-feedback select-none"
    >
      {icon} {label}
    </Link>
  );
}
