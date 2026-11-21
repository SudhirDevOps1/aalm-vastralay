import { NextResponse } from "next/server";
import { Avatar } from "@dicebear/core";
import definition from "@dicebear/styles/lorelei.json";

export const dynamic = "force-dynamic";

/**
 * Sanitizes the seed input:
 * - Strips any special characters to prevent XSS or injection
 * - Enforces a strict 50-character length limit to prevent DoS attacks
 * - Defaults to 'guest' if empty or invalid
 */
function sanitizeSeed(raw: string | null): string {
  if (!raw) return "guest";
  // Allow alphanumerics, underscores, dashes, and periods (e.g. user ID or sanitized email)
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_\-.]/g, "").slice(0, 50);
  return cleaned || "guest";
}

/**
 * 👑 Next.js App Router API Route: Self-Hosted DiceBear Avatar Generator
 * GET /api/avatar?seed=<user_id_or_email>
 *
 * Benefits:
 *  1. Privacy-First: Deterministic SVG generated in-memory on the server; zero external API calls.
 *  2. Infinite Scale: Free & unlimited, completely eliminating third-party rate limits.
 *  3. Vercel Caching: 1-year immutable Cache-Control header caches responses at edge PoPs,
 *     ensuring repeated avatar loads cost zero serverless function execution bandwidth.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const rawSeed = url.searchParams.get("seed");
    const seed = sanitizeSeed(rawSeed);

    // Generate the SVG synchronously using DiceBear's lorelei collection
    const avatar = new Avatar(definition, {
      seed,
      size: 128,
      backgroundColor: ["f3e5f5", "ede7f6", "fff8e1", "fce4ec"],
    });

    const svg = avatar.toString();

    // Return pure SVG with 1-year immutable edge caching headers
    return new Response(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        // Crucial for Vercel: 1-year immutable cache eliminates repetitive function invocations
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("[Avatar:Generator] Failed to generate avatar:", err);
    return NextResponse.json(
      { success: false, error: "Failed to generate avatar." },
      { status: 500 }
    );
  }
}
