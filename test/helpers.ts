import request from "supertest";
import { app } from "../src/app.ts";

export const api = request(app);
export const password = "correct-horse-battery-staple";
let fixtureSequence = 0;

export function testUser(label: string) {
  const suffix = `${process.pid}-${Date.now()}-${fixtureSequence++}`;
  return {
    name: `${label} ${suffix}`,
    email: `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${suffix}@example.test`,
  };
}

export async function registerTestUser(label: string) {
  const user = testUser(label);
  return register(user.name, user.email);
}

export async function register(
  name: string,
  email: string,
): Promise<{ agent: ReturnType<typeof request.agent>; id: number }> {
  const agent = request.agent(app);
  const response = await agent
    .post("/api/v1/register")
    .send({ name, email, password })
    .expect(201);
  return { agent, id: response.body.user.id };
}

export function eventPayload(overrides: Record<string, unknown> = {}) {
  const suffix = `${process.pid}-${Date.now()}-${fixtureSequence++}`;
  return {
    title: `Team sync ${suffix}`,
    content: { note: `Discuss delivery ${suffix}` },
    startAt: "2026-01-15T10:00:00.000Z",
    endAt: "2026-01-15T11:00:00.000Z",
    ...overrides,
  };
}
