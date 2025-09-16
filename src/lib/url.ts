import { env } from "./env";

export function getBaseUrl() {
  if (env.SITE_URL) {
    return env.SITE_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }
  return "http://localhost:3000";
}
