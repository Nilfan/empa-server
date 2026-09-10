export type User = { id: number; name: string; email: string };

export type RegularConfig =
  | { kind: "weekdays"; weekdays: number[] }
  | { kind: "monthDays"; monthDays: number[] }
  | { kind: "intervalDays"; intervalDays: number };

export type CalendarEvent = {
  id: number;
  title: string;
  content: { notes?: unknown };
  startAt: string;
  endAt: string;
  isActive: boolean;
  isRegular: boolean;
  regularConfig: RegularConfig | null;
};

export type SharedEvent = CalendarEvent & { owner: User };
export type EventDraft = Omit<CalendarEvent, "id">;
export type NoticeState = { text: string; error?: boolean };
