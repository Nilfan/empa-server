import type { CalendarEvent, EventDraft } from "../types/calendar";

export const weekdayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function blankDraft(): EventDraft {
  return {
    title: "",
    content: { notes: "" },
    startAt: "",
    endAt: "",
    isActive: true,
    isRegular: false,
    regularConfig: null,
  };
}

export function localDate(iso: string) {
  if (!iso) return "";
  const date = new Date(iso);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 19);
}

export function dateLabel(iso: string) {
  return new Date(iso).toLocaleString();
}

export function notesOf(event: CalendarEvent | EventDraft) {
  return typeof event.content?.notes === "string" ? event.content.notes : "";
}

export function schedule(event: CalendarEvent) {
  const config = event.regularConfig;
  if (!event.isRegular || !config) return "One-time event";
  if (config.kind === "weekdays")
    return `Repeats weekdays: ${config.weekdays.join(", ")}`;
  if (config.kind === "monthDays")
    return `Repeats monthly on days: ${config.monthDays.join(", ")}`;
  return `Repeats every ${config.intervalDays} day${config.intervalDays === 1 ? "" : "s"}`;
}
