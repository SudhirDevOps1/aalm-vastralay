import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink, emailOTP } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { sendEmail, escapeHtml } from "./email";

/**
 * 👑 AALM VASTRALAY — BETTER AUTH SERVER CONFIGURATION
 *
 * Stack: Next.js 16 (App Router), TypeScript, Drizzle ORM (Neon PostgreSQL), Vercel.
 * Email Provider: 100% Free Google Apps Script (GAS) Webhook (Gmail).
 *
 * ----------------------------------------------------------------------------
 * 🔒 SECURITY ARCHITECTURE PRINCIPLES (सुरक्षा नियम):
 * ----------------------------------------------------------------------------
 * 1. void sendEmail(...) — Timing Attack Defense:
 *    Better Auth ke callbacks me email bhejne ko kabhi bhi `await` nahi karna chahiye.
 *    Agar hum `await` karte hain, toh attacker server ke response time (latency) ko
 *    measure karke pata laga sakta hai ki email database me exist karta hai ya nahi
 *    (e.g., existing user ko email bhejne me 800ms lagega aur non-existent user par 50ms).
 *    Isliye hum `void sendEmail(...)` use karte hain taaki email background me dispatch
 *    ho aur response client ko instantly mil jaye bina kisi timing leakage ke.
 *
 * 2. GAS_SECRET_TOKEN — Webhook Authentication:
 *    Google Apps Script ka Web App URL public hota hai. Koi bhi third-party bot ise
 *    call karke aapke personal Gmail se spam bhej sakta hai. Isliye request body me
 *    `token: process.env.GAS_SECRET_TOKEN` bheja jata hai jise GAS script match karti hai.
 *
 * 3. escapeHtml(...) — Email HTML Injection / XSS Defense:
 *    Email ke andar user ka naam, email, ya link daalte samay unhe HTML-escape karna
 *    anivarya hai taaki koi malicious input email client me script ya tag inject na kare.
 * ----------------------------------------------------------------------------
 */

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
      // Map Better Auth entities to Drizzle tables
      user: schema.users,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  user: {
    modelName: "users",
    fields: {
      name: "fullName",
      image: "avatarUrl",
      emailVerified: "isActive",
    },
  },
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? {
          github: {
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
          },
        }
      : {}),
  },
  secret:
    process.env.AUTH_SECRET ||
    process.env.BETTER_AUTH_SECRET ||
    "aalm-vastralay-auth-secret-key-32-characters-minimum-length",
  baseURL:
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
    "http://localhost:3000",
  trustedOrigins: Array.from(
    new Set(
      [
        "http://localhost:3000",
        "https://aalm-vastralay.vercel.app",
        process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, ""),
        process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, ""),
        process.env.BETTER_AUTH_URL?.replace(/\/$/, ""),
        process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.replace(/\/$/, "")}` : undefined,
      ].filter(Boolean) as string[]
    )
  ),

  // 1. Email Verification (ईमेल सत्यापन)
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      const safeName = escapeHtml(user.name || "Customer");
      const safeUrl = escapeHtml(url);

      const htmlBody = `
        <div style="font-family:Georgia,serif;max-width:560px;margin:auto;border:1px solid #e5e7eb;padding:32px;background:#faf8f5;border-radius:12px;">
          <h2 style="color:#7a1f2b;margin:0 0 16px;font-size:24px;">आलम वस्त्रालय (Aalm Vastralay)</h2>
          <p style="font-size:16px;color:#374151;">नमस्ते ${safeName},</p>
          <p style="font-size:15px;color:#4b5563;line-height:1.6;">
            Aalm Vastralay par apna account verify karne ke liye kripya niche diye gaye button par click karein:
          </p>
          <div style="margin:24px 0;">
            <a href="${safeUrl}" style="background:#7a1f2b;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">
              ईमेल सत्यापित करें (Verify Email)
            </a>
          </div>
          <p style="font-size:13px;color:#6b7280;word-break:break-all;">
            Yadi button kaam na kare toh is link ko browser me paste karein:<br/>
            <a href="${safeUrl}" style="color:#7a1f2b;">${safeUrl}</a>
          </p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
          <p style="font-size:12px;color:#9ca3af;">Aalm Vastralay • Indian Ethnic Fashion • Zero Spam Guaranteed</p>
        </div>
      `;

      // Non-blocking void call to eliminate timing attacks
      void sendEmail({
        to: user.email,
        subject: "आलम वस्त्रालय — अपने ईमेल पते की पुष्टि करें (Verify Your Email)",
        html: htmlBody,
        text: `Verify your email by opening: ${url}`,
        type: "GENERAL",
        name: user.name,
      });
    },
  },

  // 2. Password Reset (पासवर्ड रीसेट लिंक)
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      const safeName = escapeHtml(user.name || "Customer");
      const safeUrl = escapeHtml(url);

      const htmlBody = `
        <div style="font-family:Georgia,serif;max-width:560px;margin:auto;border:1px solid #e5e7eb;padding:32px;background:#faf8f5;border-radius:12px;">
          <h2 style="color:#7a1f2b;margin:0 0 16px;font-size:24px;">आलम वस्त्रालय (Aalm Vastralay)</h2>
          <p style="font-size:16px;color:#374151;">नमस्ते ${safeName},</p>
          <p style="font-size:15px;color:#4b5563;line-height:1.6;">
            Aapne apna password reset karne ka anurodh kiya hai. Apna naya password set karne ke liye niche click karein:
          </p>
          <div style="margin:24px 0;">
            <a href="${safeUrl}" style="background:#7a1f2b;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">
              नया पासवर्ड बनाएं (Reset Password)
            </a>
          </div>
          <p style="font-size:13px;color:#6b7280;">
            Ye link suraksha karno se 15 minute ke liye hi valid hai. Agar aapne ye request nahi ki thi, toh is email ko ignore karein.
          </p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
          <p style="font-size:12px;color:#9ca3af;">Aalm Vastralay • Samastipur, Bihar • Secure Authentication</p>
        </div>
      `;

      // Non-blocking void call to eliminate timing attacks
      void sendEmail({
        to: user.email,
        subject: "आलम वस्त्रालय — पासवर्ड रीसेट लिंक (Password Reset Request)",
        html: htmlBody,
        text: `Reset your password at: ${url}`,
        type: "FORGOT_PASSWORD",
        name: user.name,
      });
    },
  },

  plugins: [
    // 3. Magic Link Plugin (1-क्लिक पासवर्डलेस लॉगिन — 5 मिनट एक्सपायरी)
    magicLink({
      expiresIn: 300, // 5 minutes in seconds
      sendMagicLink: async ({ email, url }) => {
        const safeUrl = escapeHtml(url);

        const htmlBody = `
          <div style="font-family:Georgia,serif;max-width:560px;margin:auto;border:1px solid #e5e7eb;padding:32px;background:#faf8f5;border-radius:12px;">
            <h2 style="color:#7a1f2b;margin:0 0 16px;font-size:24px;">आलम वस्त्रालय (Aalm Vastralay)</h2>
            <p style="font-size:16px;color:#374151;">नमस्ते,</p>
            <p style="font-size:15px;color:#4b5563;line-height:1.6;">
              Aalm Vastralay me 1-click passwordless login karne ke liye niche diye gaye button par click karein:
            </p>
            <div style="margin:24px 0;">
              <a href="${safeUrl}" style="background:#b8860b;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">
                तुरंत लॉगिन करें (Magic Login)
              </a>
            </div>
            <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px;margin:16px 0;border-radius:4px;">
              <p style="font-size:13px;color:#92400e;margin:0;">
                ⚠️ <strong>नोट:</strong> यह लिंक सिर्फ <strong>5 मिनट</strong> के लिए मान्य है (Expires in 5 minutes).
              </p>
            </div>
            <p style="font-size:12px;color:#9ca3af;margin-top:20px;">
              Yadi aapne login request nahi ki thi, toh kisi ko bhi ye link share na karein.
            </p>
          </div>
        `;

        // Non-blocking void call to eliminate timing attacks
        void sendEmail({
          to: email,
          subject: "आलम वस्त्रालय — आपका 1-क्लिक मैजिक लॉगिन लिंक (5 Min Expiry)",
          html: htmlBody,
          text: `Log in using this magic link (valid for 5 minutes): ${url}`,
          type: "GENERAL",
        });
      },
    }),

    // 4. Email OTP Plugin (6-अंकों का सुरक्षित OTP कोड)
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        const safeOtp = escapeHtml(otp);
        let subject = "आलम वस्त्रालय — आपका सुरक्षा OTP कोड";
        let purposeText = "Aapke account ke suraksha verification ke liye OTP:";

        if (type === "sign-in") {
          subject = "आलम वस्त्रालय — लॉगिन OTP कोड (Sign-In Code)";
          purposeText = "Aalm Vastralay account me login karne ke liye aapka OTP:";
        } else if (type === "email-verification") {
          subject = "आलम वस्त्रालय — ईमेल सत्यापन OTP कोड (Verification Code)";
          purposeText = "Apna email address verify karne ke liye aapka OTP:";
        } else if (type === "forget-password") {
          subject = "आलम वस्त्रालय — पासवर्ड रीसेट OTP कोड (Reset Code)";
          purposeText = "Apna password reset karne ke liye aapka 6-digit OTP:";
        }

        const htmlBody = `
          <div style="font-family:Georgia,serif;max-width:560px;margin:auto;border:1px solid #e5e7eb;padding:32px;background:#faf8f5;border-radius:12px;text-align:center;">
            <h2 style="color:#7a1f2b;margin:0 0 16px;font-size:24px;">आलम वस्त्रालय (Aalm Vastralay)</h2>
            <p style="font-size:15px;color:#4b5563;text-align:left;">नमस्ते,</p>
            <p style="font-size:15px;color:#4b5563;text-align:left;">${purposeText}</p>
            
            <div style="margin:28px auto;padding:16px 24px;background:#ffffff;border:2px dashed #7a1f2b;border-radius:10px;display:inline-block;letter-spacing:8px;font-size:32px;font-weight:bold;color:#7a1f2b;font-family:monospace;">
              ${safeOtp}
            </div>

            <p style="font-size:13px;color:#dc2626;margin:12px 0 20px;">
              ⏱️ यह कोड 10 मिनट के लिए मान्य है। किसी के साथ शेयर न करें।
            </p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
            <p style="font-size:12px;color:#9ca3af;">Aalm Vastralay • Samastipur, Bihar • 100% Secure Shopping</p>
          </div>
        `;

        // Non-blocking void call to eliminate timing attacks
        void sendEmail({
          to: email,
          subject,
          html: htmlBody,
          text: `Your Aalm Vastralay verification code is: ${otp}. Valid for 10 minutes.`,
          type: type === "forget-password" ? "FORGOT_PASSWORD" : "GENERAL",
          otp,
        });
      },
    }),
  ],
});
