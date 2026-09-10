import { dateLabel, schedule } from "../helpers/calendar";
import type { CalendarEvent } from "../types/calendar";

export function EventList({
  events,
  onSelect,
  onSetActive,
  empty,
}: {
  events: CalendarEvent[];
  onSelect: (event: CalendarEvent) => void;
  onSetActive: (event: CalendarEvent) => Promise<void>;
  empty: string;
}) {
  return (
    <ul aria-live="polite">
      {events.length ? (
        events.map((event) => (
          <li key={event.id}>
            <button
              class="event-button"
              type="button"
              onClick={() => onSelect(event)}
            >
              <strong>{event.title}</strong>
              <div class="muted">
                {dateLabel(event.startAt)} — {dateLabel(event.endAt)}
              </div>
              <div class="muted">
                {schedule(event)}
                {event.isActive ? "" : " · Inactive"}
              </div>
            </button>
            <button
              type="button"
              onClick={() => onSetActive(event)}
              aria-label={`${event.isActive ? "Deactivate" : "Activate"} ${event.title}`}
            >
              {event.isActive ? "Deactivate" : "Activate"}
            </button>
          </li>
        ))
      ) : (
        <li class="muted">{empty}</li>
      )}
    </ul>
  );
}
