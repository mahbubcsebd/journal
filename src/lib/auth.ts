import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";
import { db, schema } from "@/db";
import { sendOtpEmail } from "./mailer";

export const auth = betterAuth({
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Journal",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      rateLimit: schema.rateLimit,
    },
  }),
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh daily
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  user: {
    additionalFields: {
      timezone: { type: "string", required: false, defaultValue: "Asia/Dhaka", input: false },
      baseCurrency: { type: "string", required: false, defaultValue: "USD", input: false },
      onboarded: { type: "boolean", required: false, defaultValue: false, input: false },
    },
  },
  rateLimit: {
    enabled: true,
    // Serverless instances don't share memory, so counters live in Postgres.
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/email-otp/send-verification-otp": { window: 60, max: 3 },
      "/sign-in/email-otp": { window: 60, max: 10 },
    },
  },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 60 * 10,
      allowedAttempts: 5,
      storeOTP: "hashed",
      async sendVerificationOTP({ email, otp }) {
        await sendOtpEmail(email, otp);
      },
    }),
    nextCookies(), // must stay last
  ],
});

export type Session = typeof auth.$Infer.Session;
