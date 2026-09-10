import { Router, type Request, type Response } from "express";
import { and, arrayContains, asc, eq, inArray, ne, or } from "drizzle-orm";

import { requireAuth } from "../auth.ts";
import { db } from "../db/index.ts";
import { calendarEvents, calendarSharing, users } from "../db/schema.ts";

const eventsRouter = Router();

type EventContent = Record<string, unknown>;
type RegularConfig =
  | { kind: "weekdays"; weekdays: number[] }
  | { kind: "monthDays"; monthDays: number[] }
  | { kind: "intervalDays"; intervalDays: number };

type EventInput = {
  title: string;
  content: EventContent;
  startAt: Date;
  endAt: Date;
  isActive: boolean;
  isRegular: boolean;
  regularConfig: RegularConfig | null;
};

const RFC3339_DATE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseId(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function parseRouteId(value: string | string[]): number | null {
  return typeof value === "string" ? parseId(value) : null;
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !RFC3339_DATE.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function uniqueBoundedNumbers(
  value: unknown,
  minimum: number,
  maximum: number,
): number[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (
    !value.every(
      (item) => Number.isInteger(item) && item >= minimum && item <= maximum,
    )
  )
    return null;
  return new Set(value).size === value.length ? value : null;
}

function parseRegularConfig(
  value: unknown,
  isRegular: boolean,
): RegularConfig | null | undefined {
  if (!isRegular)
    return value === null || value === undefined ? null : undefined;
  if (!isRecord(value) || typeof value.kind !== "string") return undefined;

  if (value.kind === "weekdays" && Object.keys(value).length === 2) {
    const weekdays = uniqueBoundedNumbers(value.weekdays, 1, 7);
    return weekdays ? { kind: "weekdays", weekdays } : undefined;
  }
  if (value.kind === "monthDays" && Object.keys(value).length === 2) {
    const monthDays = uniqueBoundedNumbers(value.monthDays, 1, 31);
    return monthDays ? { kind: "monthDays", monthDays } : undefined;
  }
  if (
    value.kind === "intervalDays" &&
    Object.keys(value).length === 2 &&
    typeof value.intervalDays === "number" &&
    Number.isInteger(value.intervalDays) &&
    value.intervalDays >= 1 &&
    value.intervalDays <= 365
  ) {
    return { kind: "intervalDays", intervalDays: value.intervalDays };
  }
  return undefined;
}

function parseEventState(value: unknown): EventInput | null {
  if (!isRecord(value)) return null;
  const {
    title,
    content,
    startAt,
    endAt,
    isActive = true,
    isRegular = false,
    regularConfig = null,
  } = value;
  const normalizedTitle = typeof title === "string" ? title.trim() : "";
  const parsedStart = parseDate(startAt);
  const parsedEnd = parseDate(endAt);
  const parsedConfig = parseRegularConfig(regularConfig, isRegular === true);
  if (
    normalizedTitle.length < 1 ||
    normalizedTitle.length > 200 ||
    !isRecord(content) ||
    !parsedStart ||
    !parsedEnd ||
    parsedEnd <= parsedStart ||
    typeof isActive !== "boolean" ||
    typeof isRegular !== "boolean" ||
    parsedConfig === undefined
  )
    return null;
  return {
    title: normalizedTitle,
    content,
    startAt: parsedStart,
    endAt: parsedEnd,
    isActive,
    isRegular,
    regularConfig: parsedConfig,
  };
}

function parseEventPatch(
  value: unknown,
  current: EventInput,
): EventInput | null {
  if (
    !isRecord(value) ||
    Object.keys(value).some(
      (key) =>
        ![
          "title",
          "content",
          "startAt",
          "endAt",
          "isActive",
          "isRegular",
          "regularConfig",
        ].includes(key),
    )
  )
    return null;
  const merged = {
    ...current,
    startAt: current.startAt.toISOString(),
    endAt: current.endAt.toISOString(),
    ...value,
  } as Record<string, unknown>;
  if (!("regularConfig" in value) && value.isRegular === false)
    merged.regularConfig = null;
  return parseEventState(merged);
}

function serializeEvent(event: typeof calendarEvents.$inferSelect) {
  return {
    id: event.id,
    title: event.title,
    content: event.content,
    startAt: event.startAt.toISOString(),
    endAt: event.endAt.toISOString(),
    isActive: event.isActive,
    isRegular: event.isRegular,
    regularConfig: event.regularConfig,
  };
}

async function ownedEvent(eventId: number, ownerId: number) {
  const [event] = await db
    .select()
    .from(calendarEvents)
    .where(
      and(eq(calendarEvents.id, eventId), eq(calendarEvents.ownerId, ownerId)),
    )
    .limit(1);
  return event;
}

function notFound(res: Response): void {
  res.status(404).json({ message: "Resource not found." });
}

function eventInputFromRecord(
  event: typeof calendarEvents.$inferSelect,
): EventInput | null {
  return parseEventState({
    title: event.title,
    content: event.content,
    startAt: event.startAt.toISOString(),
    endAt: event.endAt.toISOString(),
    isActive: event.isActive,
    isRegular: event.isRegular,
    regularConfig: event.regularConfig,
  });
}

type ShareRecipient = number | string;

function parseShareRecipients(value: unknown): ShareRecipient[] | null {
  if (!isRecord(value) || Object.keys(value).length !== 1) return null;
  const input = "emails" in value ? value.emails : value.recipients;
  if (!Array.isArray(input)) return null;

  const recipients: ShareRecipient[] = [];
  for (const recipient of input) {
    if (typeof recipient === "number") {
      if (!Number.isSafeInteger(recipient) || recipient <= 0) return null;
      recipients.push(recipient);
      continue;
    }
    if (typeof recipient !== "string") return null;
    const email = recipient.trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return null;
    recipients.push(email);
  }
  return recipients;
}

function serializeUser(
  user: Pick<typeof users.$inferSelect, "id" | "name" | "email">,
) {
  return { id: user.id, name: user.name, email: user.email };
}

async function getCalendarShares(
  ownerId: number,
  res: Response,
): Promise<void> {
  const [sharing] = await db
    .select()
    .from(calendarSharing)
    .where(eq(calendarSharing.userId, ownerId))
    .limit(1);
  const sharedWith = sharing?.sharedWith ?? [];
  const sharedUsers = sharedWith.length
    ? await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(inArray(users.id, sharedWith))
    : [];
  res.json({ users: sharedUsers.map(serializeUser) });
}

async function replaceCalendarShares(
  ownerId: number,
  body: unknown,
  res: Response,
): Promise<void> {
  const recipientReferences = parseShareRecipients(body);
  if (!recipientReferences) {
    res.status(400).json({ message: "Invalid sharing recipients." });
    return;
  }
  const recipientIds = recipientReferences.filter(
    (recipient): recipient is number => typeof recipient === "number",
  );
  const recipientEmails = recipientReferences.filter(
    (recipient): recipient is string => typeof recipient === "string",
  );
  const recipients = recipientReferences.length
    ? await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(
          or(
            recipientIds.length ? inArray(users.id, recipientIds) : undefined,
            recipientEmails.length
              ? inArray(users.email, recipientEmails)
              : undefined,
          ),
        )
    : [];
  const usersById = new Map(recipients.map((user) => [user.id, user]));
  const usersByEmail = new Map(
    recipients.map((user) => [user.email.toLowerCase(), user]),
  );
  const resolvedRecipients = recipientReferences.map((recipient) =>
    typeof recipient === "number"
      ? usersById.get(recipient)
      : usersByEmail.get(recipient),
  );
  if (resolvedRecipients.some((recipient) => !recipient)) {
    res
      .status(400)
      .json({ message: "One or more sharing recipients were not found." });
    return;
  }
  const resolvedUsers = resolvedRecipients as (typeof users.$inferSelect)[];
  if (resolvedUsers.some((user) => user.id === ownerId)) {
    res.status(400).json({ message: "You cannot share events with yourself." });
    return;
  }
  if (
    new Set(resolvedUsers.map((user) => user.id)).size !== resolvedUsers.length
  ) {
    res.status(400).json({ message: "Sharing recipients must be unique." });
    return;
  }
  await db
    .insert(calendarSharing)
    .values({
      userId: ownerId,
      sharedWith: resolvedUsers.map((user) => user.id),
    })
    .onConflictDoUpdate({
      target: calendarSharing.userId,
      set: { sharedWith: resolvedUsers.map((user) => user.id) },
    });
  res.json({ users: resolvedUsers.map(serializeUser) });
}

async function revokeCalendarShare(
  ownerId: number,
  recipientId: number | null,
  res: Response,
): Promise<void> {
  if (!recipientId) return notFound(res);
  const [sharing] = await db
    .select()
    .from(calendarSharing)
    .where(eq(calendarSharing.userId, ownerId))
    .limit(1);
  if (!sharing || !sharing.sharedWith.includes(recipientId))
    return notFound(res);
  await db
    .update(calendarSharing)
    .set({
      sharedWith: sharing.sharedWith.filter((id) => id !== recipientId),
    })
    .where(eq(calendarSharing.userId, ownerId));
  res.status(204).end();
}

function addUniqueRecipient(
  recipientIds: number[],
  recipientId: number,
): number[] {
  return [...new Set([...recipientIds, recipientId])];
}

function removeRecipient(
  recipientIds: number[],
  recipientId: number,
): number[] {
  return [...new Set(recipientIds.filter((id) => id !== recipientId))];
}

async function createReciprocalCalendarShare(
  ownerId: number,
  recipientId: number,
): Promise<Pick<typeof users.$inferSelect, "id" | "name" | "email">[] | null> {
  return db.transaction(async (tx) => {
    const [recipient] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, recipientId))
      .limit(1);
    if (!recipient) return null;

    const sharingRecords = await tx
      .select()
      .from(calendarSharing)
      .where(inArray(calendarSharing.userId, [ownerId, recipientId]));
    const sharedWithByUserId = new Map(
      sharingRecords.map((sharing) => [sharing.userId, sharing.sharedWith]),
    );
    const ownerSharedWith = addUniqueRecipient(
      sharedWithByUserId.get(ownerId) ?? [],
      recipientId,
    );
    const recipientSharedWith = addUniqueRecipient(
      sharedWithByUserId.get(recipientId) ?? [],
      ownerId,
    );

    await tx
      .insert(calendarSharing)
      .values({ userId: ownerId, sharedWith: ownerSharedWith })
      .onConflictDoUpdate({
        target: calendarSharing.userId,
        set: { sharedWith: ownerSharedWith },
      });
    await tx
      .insert(calendarSharing)
      .values({ userId: recipientId, sharedWith: recipientSharedWith })
      .onConflictDoUpdate({
        target: calendarSharing.userId,
        set: { sharedWith: recipientSharedWith },
      });

    return tx
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(inArray(users.id, ownerSharedWith));
  });
}

async function revokeReciprocalCalendarShare(
  ownerId: number,
  recipientId: number,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [recipient] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, recipientId))
      .limit(1);
    if (!recipient) return false;

    const sharingRecords = await tx
      .select()
      .from(calendarSharing)
      .where(inArray(calendarSharing.userId, [ownerId, recipientId]));
    const sharedWithByUserId = new Map(
      sharingRecords.map((sharing) => [sharing.userId, sharing.sharedWith]),
    );
    const ownerSharing = sharedWithByUserId.get(ownerId);
    const recipientSharing = sharedWithByUserId.get(recipientId);

    if (ownerSharing) {
      await tx
        .update(calendarSharing)
        .set({ sharedWith: removeRecipient(ownerSharing, recipientId) })
        .where(eq(calendarSharing.userId, ownerId));
    }
    if (recipientSharing) {
      await tx
        .update(calendarSharing)
        .set({ sharedWith: removeRecipient(recipientSharing, ownerId) })
        .where(eq(calendarSharing.userId, recipientId));
    }
    return true;
  });
}

eventsRouter.get(
  "/events",
  requireAuth,
  async (req: Request, res: Response) => {
    const includeInactive = req.query.includeInactive === "true";
    if (
      req.query.includeInactive !== undefined &&
      !includeInactive &&
      req.query.includeInactive !== "false"
    ) {
      res
        .status(400)
        .json({ message: "includeInactive must be true or false." });
      return;
    }
    const conditions = [eq(calendarEvents.ownerId, req.auth!.user.id)];
    if (!includeInactive) conditions.push(eq(calendarEvents.isActive, true));
    const events = await db
      .select()
      .from(calendarEvents)
      .where(and(...conditions))
      .orderBy(asc(calendarEvents.startAt));
    res.json({ events: events.map(serializeEvent) });
  },
);

eventsRouter.post(
  "/events",
  requireAuth,
  async (req: Request, res: Response) => {
    const input = parseEventState(req.body);
    if (!input) {
      res.status(400).json({ message: "Invalid event details." });
      return;
    }
    const [event] = await db
      .insert(calendarEvents)
      .values({ ...input, ownerId: req.auth!.user.id })
      .returning();
    res.status(201).json({ event: serializeEvent(event) });
  },
);

eventsRouter.get("/events/:eventId", requireAuth, async (req, res) => {
  const eventId = parseRouteId(req.params.eventId);
  const event = eventId && (await ownedEvent(eventId, req.auth!.user.id));
  if (!event) return notFound(res);
  res.json({ event: serializeEvent(event) });
});

async function updateOwnedEvent(
  req: Request,
  res: Response,
  patch: unknown,
): Promise<void> {
  const eventId = parseRouteId(req.params.eventId);
  const event = eventId && (await ownedEvent(eventId, req.auth!.user.id));
  if (!event) return notFound(res);
  const current = eventInputFromRecord(event);
  const input = current && parseEventPatch(patch, current);
  if (!input) {
    res.status(400).json({ message: "Invalid event details." });
    return;
  }
  const [updated] = await db
    .update(calendarEvents)
    .set(input)
    .where(eq(calendarEvents.id, event.id))
    .returning();
  res.json({ event: serializeEvent(updated) });
}

eventsRouter.patch("/events/:eventId", requireAuth, async (req, res) => {
  await updateOwnedEvent(req, res, req.body);
});

eventsRouter.post(
  "/events/:eventId/deactivate",
  requireAuth,
  async (req, res) => {
    await updateOwnedEvent(req, res, { isActive: false });
  },
);

eventsRouter.post(
  "/events/:eventId/activate",
  requireAuth,
  async (req, res) => {
    await updateOwnedEvent(req, res, { isActive: true });
  },
);

eventsRouter.delete("/events/:eventId", requireAuth, async (req, res) => {
  const eventId = parseRouteId(req.params.eventId);
  const event = eventId && (await ownedEvent(eventId, req.auth!.user.id));
  if (!event) return notFound(res);
  await db.delete(calendarEvents).where(eq(calendarEvents.id, event.id));
  res.status(204).end();
});

eventsRouter.get("/events/:eventId/shares", requireAuth, async (req, res) => {
  const eventId = parseRouteId(req.params.eventId);
  const event = eventId && (await ownedEvent(eventId, req.auth!.user.id));
  if (!event) return notFound(res);
  await getCalendarShares(req.auth!.user.id, res);
});

eventsRouter.put("/events/:eventId/shares", requireAuth, async (req, res) => {
  const eventId = parseRouteId(req.params.eventId);
  const event = eventId && (await ownedEvent(eventId, req.auth!.user.id));
  if (!event) return notFound(res);
  await replaceCalendarShares(req.auth!.user.id, req.body, res);
});

eventsRouter.delete(
  "/events/:eventId/shares/:userId",
  requireAuth,
  async (req, res) => {
    const eventId = parseRouteId(req.params.eventId);
    const recipientId = parseRouteId(req.params.userId);
    const event = eventId && (await ownedEvent(eventId, req.auth!.user.id));
    if (!event) return notFound(res);
    await revokeCalendarShare(req.auth!.user.id, recipientId, res);
  },
);

eventsRouter.get("/calendar/shares", requireAuth, async (req, res) => {
  await getCalendarShares(req.auth!.user.id, res);
});

eventsRouter.put("/calendar/shares", requireAuth, async (req, res) => {
  await replaceCalendarShares(req.auth!.user.id, req.body, res);
});

eventsRouter.delete(
  "/calendar/shares/:userId",
  requireAuth,
  async (req, res) => {
    await revokeCalendarShare(
      req.auth!.user.id,
      parseRouteId(req.params.userId),
      res,
    );
  },
);

eventsRouter.post("/calendar/shares/:userId", requireAuth, async (req, res) => {
  const recipientId = parseRouteId(req.params.userId);
  if (!recipientId) return notFound(res);
  if (recipientId === req.auth!.user.id) {
    res.status(400).json({ message: "You cannot share events with yourself." });
    return;
  }
  const sharedUsers = await createReciprocalCalendarShare(
    req.auth!.user.id,
    recipientId,
  );
  if (!sharedUsers) return notFound(res);
  res.json({ users: sharedUsers.map(serializeUser) });
});

eventsRouter.delete(
  "/calendar/reciprocal-shares/:userId",
  requireAuth,
  async (req, res) => {
    const recipientId = parseRouteId(req.params.userId);
    if (!recipientId) return notFound(res);
    if (recipientId === req.auth!.user.id) {
      res
        .status(400)
        .json({ message: "You cannot share events with yourself." });
      return;
    }
    const recipientExists = await revokeReciprocalCalendarShare(
      req.auth!.user.id,
      recipientId,
    );
    if (!recipientExists) return notFound(res);
    res.status(204).end();
  },
);

eventsRouter.get("/shared-events", requireAuth, async (req, res) => {
  const records = await db
    .select({
      event: calendarEvents,
      owner: { id: users.id, name: users.name, email: users.email },
    })
    .from(calendarEvents)
    .innerJoin(
      calendarSharing,
      eq(calendarSharing.userId, calendarEvents.ownerId),
    )
    .innerJoin(users, eq(users.id, calendarEvents.ownerId))
    .where(
      and(
        eq(calendarEvents.isActive, true),
        ne(calendarEvents.ownerId, req.auth!.user.id),
        arrayContains(calendarSharing.sharedWith, [req.auth!.user.id]),
      ),
    )
    .orderBy(asc(calendarEvents.startAt));
  res.json({
    events: records.map(({ event, owner }) => ({
      ...serializeEvent(event),
      owner: serializeUser(owner),
    })),
  });
});

eventsRouter.get("/shared-events/:eventId", requireAuth, async (req, res) => {
  const eventId = parseRouteId(req.params.eventId);
  if (!eventId) return notFound(res);
  const [record] = await db
    .select({
      event: calendarEvents,
      owner: { id: users.id, name: users.name, email: users.email },
    })
    .from(calendarEvents)
    .innerJoin(
      calendarSharing,
      eq(calendarSharing.userId, calendarEvents.ownerId),
    )
    .innerJoin(users, eq(users.id, calendarEvents.ownerId))
    .where(
      and(
        eq(calendarEvents.id, eventId),
        eq(calendarEvents.isActive, true),
        ne(calendarEvents.ownerId, req.auth!.user.id),
        arrayContains(calendarSharing.sharedWith, [req.auth!.user.id]),
      ),
    )
    .limit(1);
  if (!record) return notFound(res);
  res.json({
    event: {
      ...serializeEvent(record.event),
      owner: serializeUser(record.owner),
    },
  });
});

export { eventsRouter };
