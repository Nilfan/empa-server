import { argon2, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { and, eq, gt } from "drizzle-orm";

import { db } from "./db/index.ts";
import { sessions, users } from "./db/schema.ts";

const COOKIE_NAME = "sessionId";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30;
const PASSWORD_HASH_VERSION = 1;
const ARGON2_OPTIONS = {
  parallelism: 1,
  tagLength: 32,
  memory: 65_536,
  passes: 3,
} as const;

export type AuthenticatedUser = {
  id: number;
  name: string;
  email: string;
  roles: string[];
};

declare global {
  namespace Express {
    interface Request {
      auth?: { user: AuthenticatedUser; sessionId: number };
    }
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_DURATION_MS,
};

export const clearSessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

function tokenDigest(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function hashPassword(
  password: string,
): Promise<{ hash: string; salt: string }> {
  const salt = randomBytes(16);
  const hash = await new Promise<Buffer>((resolve, reject) => {
    argon2(
      "argon2id",
      { message: password, nonce: salt, ...ARGON2_OPTIONS },
      (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey);
      },
    );
  });

  return { hash: hash.toString("hex"), salt: salt.toString("hex") };
}

export async function verifyPassword(
  password: string,
  storedHash: string,
  salt: string,
): Promise<boolean> {
  const expectedHash = Buffer.from(storedHash, "hex");
  if (expectedHash.length !== ARGON2_OPTIONS.tagLength || salt.length !== 32)
    return false;

  const derivedHash = await new Promise<Buffer>((resolve, reject) => {
    argon2(
      "argon2id",
      { message: password, nonce: Buffer.from(salt, "hex"), ...ARGON2_OPTIONS },
      (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey);
      },
    );
  });

  return timingSafeEqual(derivedHash, expectedHash);
}

export async function createSession(
  userId: number,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await db
    .insert(sessions)
    .values({ userId, tokenHash: tokenDigest(token), expiresAt });
  return { token, expiresAt };
}

export async function revokeSession(token: string | undefined): Promise<void> {
  if (typeof token === "string" && token.length > 0) {
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenDigest(token)));
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = req.cookies?.[COOKIE_NAME];
  if (typeof token !== "string" || token.length === 0) {
    res.status(401).json({ message: "Authentication required." });
    return;
  }

  const [record] = await db
    .select({
      sessionId: sessions.id,
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
        roles: users.roles,
      },
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, tokenDigest(token)),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!record) {
    await revokeSession(token);
    res.clearCookie(COOKIE_NAME, clearSessionCookieOptions);
    res.status(401).json({ message: "Authentication required." });
    return;
  }

  req.auth = { user: record.user, sessionId: record.sessionId };
  next();
}

export { COOKIE_NAME, PASSWORD_HASH_VERSION };
