import crypto from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiCache } from "@/db/schema";

/**
 * 👑 AALM VASTRALAY — 100% FREE AI INFERENCE CLIENT
 *
 * Multi-Tier Free AI Orchestration:
 * - Google Gemini 2.5 Flash: Exceptional Hinglish/Indic understanding & structured JSON schemas.
 * - Groq Cloud Llama-3.3-70B: Sub-300ms ultra-low-latency real-time inference.
 * - Zero-Dependency: Uses native fetch (Cloudflare & Node.js edge compatible).
 * - Multi-Level Caching: In-memory LRU + Neon `ai_cache` table to conserve free quotas.
 * - Deterministic Fallbacks: Gracefully generates rich content even if keys are unset or quotas exhausted.
 */

export type AiProvider = "gemini" | "groq" | "mistral" | "fallback";

export type AiGenerationOptions = {
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  feature: "description" | "search" | "recommendation";
  preferredProvider?: "gemini" | "groq" | "mistral" | "auto";
  model?: string;
};

// In-memory LRU cache for ultra-fast deduplication (lasts lifetime of server instance)
const memoryCache = new Map<string, { data: unknown; expiresAt: number }>();
const MAX_MEMORY_CACHE_ITEMS = 250;
const MEMORY_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Rate limiter token bucket per client/IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 20;

/**
 * Checks in-memory client rate limit to protect free tier quotas.
 */
export function checkAiRateLimit(identifier: string): { ok: boolean; remaining: number; retryAfterSec: number } {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(identifier, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { ok: true, remaining: MAX_REQUESTS_PER_WINDOW - 1, retryAfterSec: 0 };
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfterSec = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
    return { ok: false, remaining: 0, retryAfterSec };
  }

  record.count += 1;
  return { ok: true, remaining: MAX_REQUESTS_PER_WINDOW - record.count, retryAfterSec: 0 };
}

/**
 * Generate a deterministic SHA-256 hash for caching prompts and features.
 */
export function computeAiCacheKey(feature: string, prompt: string): string {
  return crypto.createHash("sha256").update(`${feature}:${prompt.trim().toLowerCase()}`).digest("hex");
}

/**
 * Retrieve cached response from memory or Neon PostgreSQL `ai_cache`.
 */
export async function getCachedAiResponse<T>(cacheKey: string): Promise<T | null> {
  const now = Date.now();
  const memHit = memoryCache.get(cacheKey);
  if (memHit && memHit.expiresAt > now) {
    return memHit.data as T;
  }

  try {
    const [row] = await db
      .select({ response: aiCache.response })
      .from(aiCache)
      .where(eq(aiCache.cacheKey, cacheKey))
      .limit(1);

    if (row && row.response) {
      // Async update hit count
      db.update(aiCache)
        .set({
          hitCount: sql`${aiCache.hitCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(aiCache.cacheKey, cacheKey))
        .catch(() => {});

      memoryCache.set(cacheKey, { data: row.response, expiresAt: now + MEMORY_CACHE_TTL_MS });
      return row.response as T;
    }
  } catch (err) {
    console.warn("[AiCache] Database lookup error (continuing without cache):", err);
  }

  return null;
}

/**
 * Save AI response to memory and Neon PostgreSQL `ai_cache`.
 */
export async function setCachedAiResponse<T>(
  cacheKey: string,
  feature: "description" | "search" | "recommendation",
  data: T
): Promise<void> {
  const now = Date.now();
  if (memoryCache.size >= MAX_MEMORY_CACHE_ITEMS) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey) memoryCache.delete(oldestKey);
  }
  memoryCache.set(cacheKey, { data, expiresAt: now + MEMORY_CACHE_TTL_MS });

  try {
    await db
      .insert(aiCache)
      .values({
        cacheKey,
        feature,
        response: data as Record<string, unknown>,
        hitCount: 1,
      })
      .onConflictDoUpdate({
        target: aiCache.cacheKey,
        set: {
          response: data as Record<string, unknown>,
          hitCount: sql`${aiCache.hitCount} + 1`,
          updatedAt: new Date(),
        },
      });
  } catch (err) {
    console.warn("[AiCache] Database insert error (in-memory cached):", err);
  }
}

/**
 * Call Google Gemini 2.5 Flash with fallback to 1.5 Flash.
 */
async function callGemini(options: AiGenerationOptions): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");

  const models = ["gemini-2.5-flash", "gemini-1.5-flash"];
  let lastError: Error | null = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload: Record<string, unknown> = {
        contents: [
          ...(options.systemPrompt
            ? [{ role: "user", parts: [{ text: `System Instructions: ${options.systemPrompt}` }] }, { role: "model", parts: [{ text: "Understood. I will strictly follow these instructions." }] }]
            : []),
          { role: "user", parts: [{ text: options.userPrompt }] },
        ],
        generationConfig: {
          temperature: options.temperature ?? 0.4,
          maxOutputTokens: options.maxTokens ?? 1024,
          ...(options.jsonMode ? { responseMimeType: "application/json" } : {}),
        },
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12_000);

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini ${model} HTTP ${res.status}: ${errText}`);
      }

      const json = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };

      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error(`Empty response from Gemini ${model}`);

      return text;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // If error is 404 (model not found), proceed to fallback model
      if (!String(err).includes("404")) {
        break; // Other error, don't waste extra calls
      }
    }
  }

  throw lastError ?? new Error("Gemini invocation failed");
}

/**
 * Call Groq Cloud Llama 3.3 70B with fallback to Llama 3.1 8B.
 */
async function callGroq(options: AiGenerationOptions): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured.");

  const customModel = options.model || process.env.GROQ_MODEL;
  const models = customModel ? [customModel, "llama-3.3-70b-versatile", "llama-3.1-8b-instant"] : ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
  let lastError: Error | null = null;

  for (const model of models) {
    try {
      const url = "https://api.groq.com/openai/v1/chat/completions";
      const messages = [
        ...(options.systemPrompt ? [{ role: "system", content: options.systemPrompt }] : []),
        { role: "user", content: options.userPrompt },
      ];

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9_000);

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: options.temperature ?? 0.3,
          max_tokens: options.maxTokens ?? 1024,
          ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Groq ${model} HTTP ${res.status}: ${errText}`);
      }

      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };

      const text = json.choices?.[0]?.message?.content;
      if (!text) throw new Error(`Empty response from Groq ${model}`);

      return text;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error("Groq invocation failed");
}

/**
 * Call Mistral AI with mistral-small-latest or mistral-large-latest.
 */
async function callMistral(options: AiGenerationOptions): Promise<string> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new Error("MISTRAL_API_KEY is not configured.");

  const customModel = options.model || process.env.MISTRAL_MODEL;
  const models = customModel ? [customModel, "mistral-small-latest", "open-mistral-nemo"] : ["mistral-small-latest", "open-mistral-nemo", "mistral-large-latest"];
  let lastError: Error | null = null;

  for (const model of models) {
    try {
      const url = "https://api.mistral.ai/v1/chat/completions";
      const messages = [
        ...(options.systemPrompt ? [{ role: "system", content: options.systemPrompt }] : []),
        { role: "user", content: options.userPrompt },
      ];

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: options.temperature ?? 0.35,
          max_tokens: options.maxTokens ?? 1024,
          ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Mistral ${model} HTTP ${res.status}: ${errText}`);
      }

      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };

      const text = json.choices?.[0]?.message?.content;
      if (!text) throw new Error(`Empty response from Mistral ${model}`);

      return text;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error("Mistral invocation failed");
}

/**
 * Unified Free AI inference engine with automatic multi-tier fallback.
 * Automatically tries available keys (Gemini, Groq, Mistral) in order of preference.
 */
export async function executeAiCompletion(
  options: AiGenerationOptions
): Promise<{ text: string; provider: AiProvider; cached: boolean }> {
  const cacheKey = computeAiCacheKey(options.feature, `${options.systemPrompt ?? ""}:${options.userPrompt}`);

  // Check cache first
  const cached = await getCachedAiResponse<string>(cacheKey);
  if (cached) {
    return { text: cached, provider: "fallback", cached: true };
  }

  // Determine provider candidates based on configured API keys
  const candidates: { provider: AiProvider; fn: (opts: AiGenerationOptions) => Promise<string> }[] = [];

  const hasGemini = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY);
  const hasGroq = Boolean(process.env.GROQ_API_KEY);
  const hasMistral = Boolean(process.env.MISTRAL_API_KEY);

  const preferred = options.preferredProvider || (process.env.AI_PROVIDER as "gemini" | "groq" | "mistral" | undefined) || "auto";

  if (preferred === "mistral" && hasMistral) {
    candidates.push({ provider: "mistral", fn: callMistral });
  } else if (preferred === "groq" && hasGroq) {
    candidates.push({ provider: "groq", fn: callGroq });
  } else if (preferred === "gemini" && hasGemini) {
    candidates.push({ provider: "gemini", fn: callGemini });
  }

  // Add remaining available providers as automatic fallbacks
  if (hasGemini && !candidates.some((c) => c.provider === "gemini")) {
    candidates.push({ provider: "gemini", fn: callGemini });
  }
  if (hasGroq && !candidates.some((c) => c.provider === "groq")) {
    candidates.push({ provider: "groq", fn: callGroq });
  }
  if (hasMistral && !candidates.some((c) => c.provider === "mistral")) {
    candidates.push({ provider: "mistral", fn: callMistral });
  }

  // If no API keys configured, try Gemini as default (which throws clear error to trigger deterministic fallback)
  if (candidates.length === 0) {
    candidates.push({ provider: "gemini", fn: callGemini });
  }

  for (const { provider, fn } of candidates) {
    try {
      const text = await fn(options);
      await setCachedAiResponse(cacheKey, options.feature, text);
      return { text, provider, cached: false };
    } catch (err) {
      console.warn(`[AI Engine] ${provider} failed (${err}). Trying next fallback...`);
    }
  }

  throw new Error("All configured AI providers failed.");
}
