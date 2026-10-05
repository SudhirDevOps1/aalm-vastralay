"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, Heart, Loader2, Minus, Plus, ShoppingBag, Zap } from "lucide-react";
import { addToCart, toggleWishlist } from "@/actions/cart";
import { cn, formatINR } from "@/lib/utils";

export type VariantOption = { id: string; size: string | null; color: string | null; stock: number; priceAdjustment: number };

export default function PurchasePanel({
  productId,
  price,
  mrp,
  stock,
  variants,
  initialWishlisted,
  freeShippingAbove = 999,
}: {
  productId: string;
  price: number;
  mrp?: number;
  stock: number;
  variants: VariantOption[];
  initialWishlisted: boolean;
  freeShippingAbove?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"cart" | "buy" | "wish" | null>(null);
  const [qty, setQty] = useState(1);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [wishlisted, setWishlisted] = useState(initialWishlisted);

  const sizes = useMemo(() => [...new Set(variants.map((v) => v.size).filter(Boolean))] as string[], [variants]);
  const colors = useMemo(() => [...new Set(variants.map((v) => v.color).filter(Boolean))] as string[], [variants]);
  const [size, setSize] = useState<string | null>(sizes.length === 1 ? sizes[0] : null);
  const [color, setColor] = useState<string | null>(colors.length === 1 ? colors[0] : null);

  const hasVariants = variants.length > 0;
  const selected = hasVariants
    ? variants.find((v) => (sizes.length ? v.size === size : true) && (colors.length ? v.color === color : true))
    : undefined;
  const needsSelection = hasVariants && ((sizes.length > 0 && !size) || (colors.length > 0 && !color));
  const available = hasVariants ? (selected?.stock ?? 0) : stock;
  const effectivePrice = price + (selected?.priceAdjustment ?? 0);
  const effectiveMrp = mrp && mrp > price ? mrp + (selected?.priceAdjustment ?? 0) : mrp ?? 0;
  const effectiveDiscount = effectiveMrp > effectivePrice ? Math.round(((effectiveMrp - effectivePrice) / effectiveMrp) * 100) : 0;

  const sizeAvailable = (s: string) => variants.some((v) => v.size === s && (colors.length && color ? v.color === color : true) && v.stock > 0);
  const colorAvailable = (c: string) => variants.some((v) => v.color === c && (sizes.length && size ? v.size === size : true) && v.stock > 0);

  function run(kind: "cart" | "buy") {
    if (needsSelection) {
      setMessage({ type: "err", text: `Please select ${!size && sizes.length ? "a size" : "a colour"}.` });
      return;
    }
    if (available <= 0) {
      setMessage({ type: "err", text: "This option is out of stock." });
      return;
    }
    setBusy(kind);
    setMessage(null);
    startTransition(async () => {
      const res = await addToCart(productId, selected?.id ?? null, qty);
      setBusy(null);
      if (res.requiresAuth) {
        router.push(`/sign-in?redirect_url=${encodeURIComponent(pathname)}`);
        return;
      }
      if (!res.ok) {
        setMessage({ type: "err", text: res.error ?? "Something went wrong." });
        return;
      }
      if (kind === "buy") {
        router.push("/checkout");
      } else {
        setMessage({ type: "ok", text: "Added to your bag!" });
        router.refresh();
      }
    });
  }

  function wish() {
    setBusy("wish");
    startTransition(async () => {
      const res = await toggleWishlist(productId);
      setBusy(null);
      if (res.requiresAuth) {
        router.push(`/sign-in?redirect_url=${encodeURIComponent(pathname)}`);
        return;
      }
      if (res.ok) setWishlisted(Boolean(res.wishlisted));
    });
  }

  return (
    <div className="space-y-5">
      {/* Dynamic Price Header synced live to variant selection */}
      <div>
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="text-3xl font-extrabold text-maroon-900 dark:text-rose-300">
            {formatINR(effectivePrice)}
          </span>
          {effectiveMrp > effectivePrice && (
            <>
              <span className="text-lg text-slate-400 dark:text-stone-500 line-through">
                {formatINR(effectiveMrp)}
              </span>
              <span className="rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 text-sm font-bold text-emerald-700 dark:text-emerald-300">
                {effectiveDiscount}% off
              </span>
            </>
          )}
        </div>
        <p className="mt-1 text-xs text-slate-600 dark:text-stone-400 font-medium">
          Inclusive of all taxes · {effectivePrice >= freeShippingAbove ? "Free delivery" : `${formatINR(49)} delivery, free above ${formatINR(freeShippingAbove)}`}
        </p>
      </div>

      {selected && selected.priceAdjustment !== 0 && (
        <div className="inline-flex items-center gap-1.5 rounded-lg bg-cream-100/80 dark:bg-stone-800/80 border border-cream-300 dark:border-stone-700 px-3 py-1 text-xs text-slate-700 dark:text-stone-300">
          <span>Option Selected:</span>
          <span className="font-bold text-maroon-900 dark:text-gold-400">
            {size ? `Size ${size}` : ""} {color ? `· Colour ${color}` : ""} ({selected.priceAdjustment > 0 ? `+${formatINR(selected.priceAdjustment)}` : formatINR(selected.priceAdjustment)})
          </span>
        </div>
      )}

      {sizes.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-bold text-slate-900 dark:text-stone-100">
            Select Size {size && <span className="font-medium text-slate-600 dark:text-gold-400">· {size}</span>}
          </p>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => {
              const ok = sizeAvailable(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSize(s)}
                  className={cn(
                    "min-w-11 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition active:scale-95 shadow-2xs",
                    size === s
                      ? "border-maroon-800 bg-maroon-700 text-white shadow-sm ring-2 ring-maroon-700/25 dark:border-gold-400 dark:bg-maroon-700 dark:text-white dark:ring-2 dark:ring-gold-400/40"
                      : "border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 hover:border-maroon-600 dark:hover:border-gold-400 hover:bg-stone-50 dark:hover:bg-stone-700",
                    !ok && "opacity-40 line-through",
                  )}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {colors.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-bold text-slate-900 dark:text-stone-100">
            Select Colour {color && <span className="font-medium text-slate-600 dark:text-gold-400">· {color}</span>}
          </p>
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => {
              const ok = colorAvailable(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-sm font-semibold transition active:scale-95 shadow-2xs",
                    color === c
                      ? "border-maroon-800 bg-maroon-700 text-white shadow-sm ring-2 ring-maroon-700/25 dark:border-gold-400 dark:bg-maroon-700 dark:text-white dark:ring-2 dark:ring-gold-400/40"
                      : "border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 hover:border-maroon-600 dark:hover:border-gold-400 hover:bg-stone-50 dark:hover:bg-stone-700",
                    !ok && "opacity-40 line-through",
                  )}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center rounded-full border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 shadow-xs">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="p-2 text-stone-700 dark:text-stone-200 hover:text-maroon-700 dark:hover:text-gold-300 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-l-full transition-colors"
            aria-label="Decrease"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-8 text-center text-sm font-bold text-stone-900 dark:text-stone-50">{qty}</span>
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(10, Math.max(1, Math.min(available || 10, q + 1))))}
            className="p-2 text-stone-700 dark:text-stone-200 hover:text-maroon-700 dark:hover:text-gold-300 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-r-full transition-colors"
            aria-label="Increase"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <span
          className={cn(
            "text-xs font-semibold px-3 py-1 rounded-full border inline-flex items-center gap-1.5 shadow-2xs",
            needsSelection
              ? "border-amber-300/80 bg-amber-50 text-amber-800 dark:border-amber-700/70 dark:bg-amber-950/50 dark:text-amber-300"
              : available > 0
                ? available <= 5
                  ? "border-amber-300/80 bg-amber-50 text-amber-800 dark:border-amber-700/70 dark:bg-amber-950/50 dark:text-amber-300 font-bold"
                  : "border-emerald-300/80 bg-emerald-50 text-emerald-800 dark:border-emerald-700/70 dark:bg-emerald-950/50 dark:text-emerald-300"
                : "border-rose-300/80 bg-rose-50 text-rose-800 dark:border-rose-700/70 dark:bg-rose-950/50 dark:text-rose-300",
          )}
        >
          {needsSelection
            ? "⚠️ Select size/options for availability"
            : available > 0
              ? available <= 5
                ? `⚡ Hurry! Only ${available} left in stock`
                : "✓ In stock · Ready for dispatch"
              : "✕ Currently out of stock"}
        </span>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => run("cart")}
          disabled={pending}
          className="btn flex-1 sm:flex-none sm:px-8 border-2 border-maroon-700 dark:border-gold-400 text-maroon-800 dark:text-gold-200 bg-white dark:bg-stone-900 hover:bg-maroon-50 dark:hover:bg-gold-500/10 active:scale-95 font-bold shadow-xs transition-all"
        >
          {busy === "cart" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" />} Add to Bag
        </button>
        <button
          type="button"
          onClick={() => run("buy")}
          disabled={pending}
          className="btn flex-1 sm:flex-none sm:px-8 bg-gradient-to-r from-maroon-700 via-maroon-800 to-rose-900 dark:from-maroon-600 dark:via-rose-700 dark:to-amber-600 text-white border border-transparent dark:border-gold-400/40 hover:brightness-110 active:scale-95 font-bold shadow-md hover:shadow-lg transition-all"
        >
          {busy === "buy" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />} Buy Now
        </button>
        <button
          type="button"
          onClick={wish}
          disabled={pending}
          aria-label="Wishlist"
          className={cn(
            "grid h-11 w-11 place-items-center rounded-full border transition-all active:scale-95 shadow-xs",
            wishlisted
              ? "border-maroon-700 bg-maroon-50 text-maroon-700 dark:border-rose-400 dark:bg-rose-950/60 dark:text-rose-300"
              : "border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:text-maroon-700 dark:hover:text-gold-300 hover:border-maroon-400",
          )}
        >
          {busy === "wish" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className={cn("h-5 w-5", wishlisted && "fill-maroon-700 dark:fill-rose-400")} />}
        </button>
      </div>

      {message && (
        <p className={cn("flex items-center gap-1.5 text-sm font-medium", message.type === "ok" ? "text-emerald-700" : "text-rose-700")}>
          {message.type === "ok" && <Check className="h-4 w-4" />} {message.text}
        </p>
      )}
    </div>
  );
}
