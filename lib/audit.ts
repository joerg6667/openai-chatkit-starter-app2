import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
const TTL_DAYS = Number(process.env.AUDIT_TTL_DAYS || "14");

export type AuditEvent =
  | "visit"
  | "session_created"
  | "message_sent"
  | "error";

export async function writeAudit(
  tokenOrName: string,
  event: AuditEvent,
  data?: Record<string, any>
) {
  const ts = new Date().toISOString();
  const key = `audit:${ts.substring(0, 10)}`; // audit:YYYY-MM-DD
  const entry = {
    ts,
    who: resolveName(tokenOrName),
    event,
    ...data,
  };
  await redis.lpush(key, JSON.stringify(entry));
  await redis.expire(key, TTL_DAYS * 24 * 60 * 60);
}

function resolveName(tokenOrName: string) {
  // Match Name zu Token aus INVITE_TOKENS
  const raw = process.env.INVITE_TOKENS || "";
  const map = new Map(
    raw.split(",").map(s => s.trim().split("=") as [string, string])
  );
  for (const [name, tok] of map) {
    if (tok === tokenOrName) return name;
  }
  return tokenOrName; // Fallback
}
