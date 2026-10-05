"use client";
import { preventDoubleSubmit } from "@/components/ui/Submit";
import { useActionState, useMemo, useRef, useState } from "react";
import { saveStore } from "@/actions/seller";
import SubmitButton from "@/components/SubmitButton";
import { resolveImage, sanitizeImageUrl } from "@/lib/image-resolver";
import type { Store } from "@/db/schema";
import UniversalMediaPicker, { type MediaSelectResult } from "@/components/media/UniversalMediaPicker";
import { UploadCloud, X, Loader2, Link2, Sparkles } from "lucide-react";

function safePreviewUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== "string") return "/images/placeholder.svg";
  const trimmed = rawUrl.trim();
  if (!trimmed) return "/images/placeholder.svg";
  const resolved = sanitizeImageUrl(resolveImage(trimmed));
  if (!resolved || resolved === "/images/placeholder.svg") return "/images/placeholder.svg";
  try {
    const parsed = new URL(resolved, "https://aalmvastralay.com");
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return encodeURI(parsed.toString());
    }
  } catch {
    // fallback
  }
  return "/images/placeholder.svg";
}

export default function StoreForm({ store, states }: { store?: Store | null; states: string[] }) {
  const [state, action] = useActionState(saveStore, null);
  const [logoVal, setLogoVal] = useState(store?.logoUrl ?? "");
  const [bannerVal, setBannerVal] = useState(store?.bannerUrl ?? "");
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [dragOverLogo, setDragOverLogo] = useState(false);
  const [dragOverBanner, setDragOverBanner] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const logoFileRef = useRef<HTMLInputElement>(null);
  const bannerFileRef = useRef<HTMLInputElement>(null);

  const safeLogo = useMemo(() => {
    if (!logoVal.trim()) return "";
    return safePreviewUrl(logoVal);
  }, [logoVal]);

  const safeBanner = useMemo(() => {
    if (!bannerVal.trim()) return "";
    return safePreviewUrl(bannerVal);
  }, [bannerVal]);

  async function uploadFileDirect(file: File, kind: "logo" | "banner") {
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image must be 5 MB or smaller.");
      return;
    }
    if (!/^image\/(png|jpe?g|webp|avif|svg\+xml)$/i.test(file.type)) {
      setUploadError("Unsupported image format. Please use JPG, PNG, WebP, AVIF, or SVG.");
      return;
    }

    setUploadError("");
    if (kind === "logo") setIsUploadingLogo(true);
    else setIsUploadingBanner(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "brand");

      const res = await fetch("/api/media/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.asset?.servableUrl) {
        throw new Error(data.error || "Upload failed. Please check your network.");
      }

      if (kind === "logo") {
        setLogoVal(data.asset.servableUrl);
      } else {
        setBannerVal(data.asset.servableUrl);
      }
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Failed to upload image. Please try again.");
    } finally {
      if (kind === "logo") setIsUploadingLogo(false);
      else setIsUploadingBanner(false);
    }
  }

  return (
    <form onSubmit={preventDoubleSubmit} action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="label" htmlFor="storeName">
          Store name
        </label>
        <input id="storeName" name="storeName" className="input" defaultValue={store?.storeName ?? ""} placeholder="e.g. Rajwada Couture" required minLength={3} />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="description">
          About your store
        </label>
        <textarea id="description" name="description" className="input" defaultValue={store?.description ?? ""} placeholder="What do you make or sell? Where are you based? What makes your pieces special?" maxLength={1000} />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="address">
          Pickup address
        </label>
        <input id="address" name="address" className="input" defaultValue={store?.address ?? ""} placeholder="Shop no., street, area" />
      </div>
      <div>
        <label className="label" htmlFor="city">
          City
        </label>
        <input id="city" name="city" className="input" defaultValue={store?.city ?? ""} required />
      </div>
      <div>
        <label className="label" htmlFor="state">
          State
        </label>
        <select id="state" name="state" className="input" defaultValue={store?.state ?? ""} required>
          <option value="" disabled>
            Select state
          </option>
          {states.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="pincode">
          Pincode
        </label>
        <input id="pincode" name="pincode" className="input" defaultValue={store?.pincode ?? ""} required pattern="[0-9]{6}" inputMode="numeric" />
      </div>
      <div>
        <label className="label" htmlFor="gstNumber">
          GSTIN (optional)
        </label>
        <input id="gstNumber" name="gstNumber" className="input uppercase" defaultValue={store?.gstNumber ?? ""} placeholder="15-character GST number" maxLength={15} />
      </div>

      {uploadError && (
        <div className="sm:col-span-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300">
          {uploadError}
        </div>
      )}

      {/* ─── LOGO SECTION (Drag & Drop + B2 Picker + URL) ─── */}
      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-2)] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-[color:var(--brand)]">
            Store Logo
          </label>
          {logoVal && (
            <button
              type="button"
              onClick={() => setLogoVal("")}
              className="text-[11px] text-rose-500 hover:text-rose-700 flex items-center gap-1 font-medium"
            >
              <X className="h-3 w-3" /> Remove
            </button>
          )}
        </div>

        {/* Drag-and-drop / preview box */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverLogo(true);
          }}
          onDragLeave={() => setDragOverLogo(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOverLogo(false);
            const file = e.dataTransfer.files?.[0];
            if (file) uploadFileDirect(file, "logo");
          }}
          onClick={() => logoFileRef.current?.click()}
          className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center cursor-pointer transition-all ${
            dragOverLogo
              ? "border-[color:var(--brand)] bg-[color:var(--brand-soft)]/20"
              : "border-[color:var(--border)] hover:border-[color:var(--brand)]/50 bg-[color:var(--surface)]"
          }`}
        >
          <input
            ref={logoFileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadFileDirect(file, "logo");
            }}
          />

          {isUploadingLogo ? (
            <div className="flex flex-col items-center gap-2 py-4">
              <Loader2 className="h-6 w-6 animate-spin text-[color:var(--brand)]" />
              <span className="text-xs text-[color:var(--text-soft)]">Uploading to Backblaze B2...</span>
            </div>
          ) : safeLogo && safeLogo !== "/images/placeholder.svg" ? (
            <div className="flex items-center gap-3">
              <div
                className="h-16 w-16 shrink-0 rounded-xl border border-[color:var(--border)] bg-cover bg-center shadow-xs"
                style={{ backgroundImage: `url("${safeLogo}")` }}
              />
              <div className="text-left">
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 block">✓ Logo Loaded</span>
                <span className="text-[11px] text-[color:var(--text-muted)]">Click or drag new image to replace</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 py-2">
              <UploadCloud className="h-6 w-6 text-[color:var(--brand)] opacity-70" />
              <span className="text-xs font-medium">Drag &amp; drop logo here, or <span className="text-[color:var(--brand)] underline">browse</span></span>
              <span className="text-[10px] text-[color:var(--text-muted)]">PNG, JPG, WebP, SVG up to 5MB</span>
            </div>
          )}
        </div>

        {/* Action Row: B2 Picker & URL input */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <UniversalMediaPicker
              folder="brand"
              buttonLabel="B2 Library / Web Link"
              onSelect={(res: MediaSelectResult) => {
                if (res.url) setLogoVal(res.url);
              }}
              className="btn btn-outline btn-sm text-xs py-1 px-2.5"
            />
            <span className="text-[11px] text-[color:var(--text-soft)]">or paste link:</span>
          </div>
          <div className="relative">
            <Link2 className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[color:var(--text-muted)]" />
            <input
              id="logoUrl"
              name="logoUrl"
              className="input pl-8 py-1.5 text-xs font-mono"
              value={logoVal}
              onChange={(e) => setLogoVal(e.target.value)}
              placeholder="https://... or b2:... or Google Drive link"
            />
          </div>
        </div>
      </div>

      {/* ─── BANNER SECTION (Drag & Drop + B2 Picker + URL) ─── */}
      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-2)] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-[color:var(--brand)]">
            Store Banner (16:5 ratio)
          </label>
          {bannerVal && (
            <button
              type="button"
              onClick={() => setBannerVal("")}
              className="text-[11px] text-rose-500 hover:text-rose-700 flex items-center gap-1 font-medium"
            >
              <X className="h-3 w-3" /> Remove
            </button>
          )}
        </div>

        {/* Drag-and-drop / preview box */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverBanner(true);
          }}
          onDragLeave={() => setDragOverBanner(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOverBanner(false);
            const file = e.dataTransfer.files?.[0];
            if (file) uploadFileDirect(file, "banner");
          }}
          onClick={() => bannerFileRef.current?.click()}
          className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center cursor-pointer transition-all ${
            dragOverBanner
              ? "border-[color:var(--brand)] bg-[color:var(--brand-soft)]/20"
              : "border-[color:var(--border)] hover:border-[color:var(--brand)]/50 bg-[color:var(--surface)]"
          }`}
        >
          <input
            ref={bannerFileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadFileDirect(file, "banner");
            }}
          />

          {isUploadingBanner ? (
            <div className="flex flex-col items-center gap-2 py-4">
              <Loader2 className="h-6 w-6 animate-spin text-[color:var(--brand)]" />
              <span className="text-xs text-[color:var(--text-soft)]">Uploading to Backblaze B2...</span>
            </div>
          ) : safeBanner && safeBanner !== "/images/placeholder.svg" ? (
            <div className="flex items-center gap-3">
              <div
                className="h-16 w-28 shrink-0 rounded-xl border border-[color:var(--border)] bg-cover bg-center shadow-xs"
                style={{ backgroundImage: `url("${safeBanner}")` }}
              />
              <div className="text-left">
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 block">✓ Banner Loaded</span>
                <span className="text-[11px] text-[color:var(--text-muted)]">Click or drag new image to replace</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 py-2">
              <UploadCloud className="h-6 w-6 text-[color:var(--brand)] opacity-70" />
              <span className="text-xs font-medium">Drag &amp; drop banner here, or <span className="text-[color:var(--brand)] underline">browse</span></span>
              <span className="text-[10px] text-[color:var(--text-muted)]">Wide 16:5 format, up to 5MB</span>
            </div>
          )}
        </div>

        {/* Action Row: B2 Picker & URL input */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <UniversalMediaPicker
              folder="brand"
              buttonLabel="B2 Library / Web Link"
              onSelect={(res: MediaSelectResult) => {
                if (res.url) setBannerVal(res.url);
              }}
              className="btn btn-outline btn-sm text-xs py-1 px-2.5"
            />
            <span className="text-[11px] text-[color:var(--text-soft)]">or paste link:</span>
          </div>
          <div className="relative">
            <Link2 className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[color:var(--text-muted)]" />
            <input
              id="bannerUrl"
              name="bannerUrl"
              className="input pl-8 py-1.5 text-xs font-mono"
              value={bannerVal}
              onChange={(e) => setBannerVal(e.target.value)}
              placeholder="https://... or b2:... or Google Drive link"
            />
          </div>
        </div>
      </div>

      {state?.error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:col-span-2">{state.error}</p>}
      {state?.success && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 sm:col-span-2">{state.success}</p>}

      <div className="sm:col-span-2">
        <SubmitButton pendingText="Saving…">{store ? "Save store details" : "Create my store"}</SubmitButton>
      </div>
    </form>
  );
}