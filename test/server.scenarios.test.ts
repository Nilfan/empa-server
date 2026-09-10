import { describe, expect, it } from "vitest";
import {
  api,
  eventPayload,
  password,
  register,
  registerTestUser,
  testUser,
} from "./helpers.ts";

describe("P0 authentication and access boundaries", () => {
  it("rejects unauthenticated protected resources and invalid credentials", async () => {
    await api.get("/api/v1/session").expect(401);
    await api.get("/api/v1/events").expect(401);
    await api
      .post("/api/v1/login")
      .send({ email: "none@example.com", password: "bad" })
      .expect(401);
  });

  it("normalizes registration, prevents duplicates, and invalidates logout sessions", async () => {
    const alice = testUser("Alice");
    const { agent } = await register(
      ` ${alice.name} `,
      alice.email.toUpperCase(),
    );
    await api
      .post("/api/v1/register")
      .send({ ...testUser("Other"), email: alice.email, password })
      .expect(409);
    await agent
      .get("/api/v1/session")
      .expect(200)
      .expect(({ body }) => expect(body.user.email).toBe(alice.email));
    await agent.post("/api/v1/logout").expect(204);
    await agent.get("/api/v1/session").expect(401);
  });
});

describe("P0 event ownership, lifecycle, and recurrence validation", () => {
  it("allows only the owner to read, mutate, deactivate, reactivate, and delete an event", async () => {
    const owner = await registerTestUser("Owner");
    const other = await registerTestUser("Other");
    const created = await owner.agent
      .post("/api/v1/events")
      .send(eventPayload())
      .expect(201);
    const id = created.body.event.id;
    await other.agent.get(`/api/v1/events/${id}`).expect(404);
    await other.agent
      .patch(`/api/v1/events/${id}`)
      .send({ title: "Stolen" })
      .expect(404);
    await other.agent.post(`/api/v1/events/${id}/deactivate`).expect(404);
    await other.agent.delete(`/api/v1/events/${id}`).expect(404);
    await owner.agent.post(`/api/v1/events/${id}/deactivate`).expect(200);
    await owner.agent
      .get("/api/v1/events")
      .expect(200)
      .expect(({ body }) => expect(body.events).toEqual([]));
    await owner.agent
      .get("/api/v1/events?includeInactive=true")
      .expect(200)
      .expect(({ body }) => expect(body.events[0].isActive).toBe(false));
    await owner.agent.post(`/api/v1/events/${id}/activate`).expect(200);
    await owner.agent.delete(`/api/v1/events/${id}`).expect(204);
  });

  it("accepts valid recurrence and rejects invalid dates, intervals, and configurations", async () => {
    const { agent } = await registerTestUser("Owner");
    await agent
      .post("/api/v1/events")
      .send(
        eventPayload({
          isRegular: true,
          regularConfig: { kind: "weekdays", weekdays: [1, 5] },
        }),
      )
      .expect(201);
    await agent
      .post("/api/v1/events")
      .send(eventPayload({ endAt: "2026-01-15T09:00:00.000Z" }))
      .expect(400);
    await agent
      .post("/api/v1/events")
      .send(
        eventPayload({
          isRegular: true,
          regularConfig: { kind: "intervalDays", intervalDays: 0 },
        }),
      )
      .expect(400);
    await agent
      .post("/api/v1/events")
      .send(
        eventPayload({
          isRegular: true,
          regularConfig: { kind: "monthDays", monthDays: [1, 1] },
        }),
      )
      .expect(400);
  });
});

describe("P1 calendar sharing and reciprocal sharing", () => {
  it("shares active owner events, hides inactive events, and blocks recipients from owner APIs", async () => {
    const owner = await registerTestUser("Owner");
    const recipient = await registerTestUser("Recipient");
    const created = await owner.agent
      .post("/api/v1/events")
      .send(eventPayload())
      .expect(201);
    const id = created.body.event.id;
    await owner.agent
      .put("/api/v1/calendar/shares")
      .send({ recipients: [recipient.id] })
      .expect(200);
    await recipient.agent
      .get("/api/v1/shared-events")
      .expect(200)
      .expect(({ body }) => expect(body.events[0].id).toBe(id));
    await recipient.agent.get(`/api/v1/events/${id}`).expect(404);
    await owner.agent.post(`/api/v1/events/${id}/deactivate`).expect(200);
    await recipient.agent
      .get("/api/v1/shared-events")
      .expect(200)
      .expect(({ body }) => expect(body.events).toEqual([]));
  });

  it("creates and removes reciprocal shares from both calendars", async () => {
    const alice = await registerTestUser("Alice");
    const bob = await registerTestUser("Bob");
    await alice.agent.post(`/api/v1/calendar/shares/${bob.id}`).expect(200);
    await alice.agent
      .get("/api/v1/calendar/shares")
      .expect(200)
      .expect(({ body }) =>
        expect(body.users.map((user: { id: number }) => user.id)).toEqual([
          bob.id,
        ]),
      );
    await bob.agent
      .get("/api/v1/calendar/shares")
      .expect(200)
      .expect(({ body }) =>
        expect(body.users.map((user: { id: number }) => user.id)).toEqual([
          alice.id,
        ]),
      );
    await alice.agent
      .delete(`/api/v1/calendar/reciprocal-shares/${bob.id}`)
      .expect(204);
    await bob.agent
      .get("/api/v1/calendar/shares")
      .expect(200)
      .expect(({ body }) => expect(body.users).toEqual([]));
  });
});
