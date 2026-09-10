import { Router, type Request, type Response } from "express";
import {
  COOKIE_NAME,
  PASSWORD_HASH_VERSION,
  clearSessionCookieOptions,
  createSession,
  hashPassword,
  requireAuth,
  revokeSession,
  sessionCookieOptions,
  verifyPassword,
} from "../auth.ts";
import { db } from "../db/index.ts";
import { users } from "../db/schema.ts";
import { eq } from "drizzle-orm";

const usersRouter = Router();

function normalizedRegistration(
  body: unknown,
): { name: string; email: string; password: string } | null {
  if (!body || typeof body !== "object") return null;
  const { name, email, password } = body as Record<string, unknown>;
  if (
    typeof name !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string"
  )
    return null;

  const normalizedName = name.trim();
  const normalizedEmail = email.trim().toLowerCase();
  if (
    normalizedName.length < 1 ||
    normalizedName.length > 100 ||
    normalizedEmail.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
    password.length < 12 ||
    password.length > 1024
  )
    return null;
  return { name: normalizedName, email: normalizedEmail, password };
}

function normalizedCredentials(
  body: unknown,
): { email: string; password: string } | null {
  if (!body || typeof body !== "object") return null;
  const { email, password } = body as Record<string, unknown>;
  if (typeof email !== "string" || typeof password !== "string") return null;
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail.length > 254 || password.length > 1024) return null;
  return { email: normalizedEmail, password };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (("code" in error && error.code === "23505") ||
      ("cause" in error && isUniqueViolation(error.cause)))
  );
}

usersRouter.post("/register", async (req: Request, res: Response) => {
  const input = normalizedRegistration(req.body);
  if (!input) {
    res.status(400).json({ message: "Invalid registration details." });
    return;
  }

  const password = await hashPassword(input.password);
  try {
    const [user] = await db
      .insert(users)
      .values({
        name: input.name,
        email: input.email,
        passwordHash: password.hash,
        salt: password.salt,
        passwordHashVersion: PASSWORD_HASH_VERSION,
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        roles: users.roles,
      });
    const session = await createSession(user.id);
    res.cookie(COOKIE_NAME, session.token, sessionCookieOptions);
    res.status(201).json({ user });
  } catch (error) {
    if (isUniqueViolation(error)) {
      res
        .status(409)
        .json({ message: "An account with that email already exists." });
      return;
    }
    throw error;
  }
});

usersRouter.post("/login", async (req: Request, res: Response) => {
  const credentials = normalizedCredentials(req.body);
  const invalidCredentials = () =>
    res.status(401).json({ message: "Invalid email or password." });
  if (!credentials) return invalidCredentials();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, credentials.email))
    .limit(1);
  if (
    !user ||
    !(await verifyPassword(credentials.password, user.passwordHash, user.salt))
  )
    return invalidCredentials();

  await revokeSession(req.cookies?.[COOKIE_NAME]);
  const session = await createSession(user.id);
  res.cookie(COOKIE_NAME, session.token, sessionCookieOptions);
  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      roles: user.roles,
    },
  });
});

usersRouter.post("/logout", async (req: Request, res: Response) => {
  await revokeSession(req.cookies?.[COOKIE_NAME]);
  res.clearCookie(COOKIE_NAME, clearSessionCookieOptions);
  res.status(204).end();
});

usersRouter.get("/session", requireAuth, (req: Request, res: Response) => {
  res.json({ user: req.auth!.user });
});

export { usersRouter };
