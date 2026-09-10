import { dateLabel, notesOf, schedule } from "../helpers/calendar";
import type { SharedEvent } from "../types/calendar";

export function SharedList({ events }: { events: SharedEvent[] }) {
  return (
    <ul aria-live="polite">
      {events.length ? (
        events.map((event) => (
          <li key={event.id}>
            <strong>{event.title}</strong>
            <div class="muted">
              Owner: {event.owner.name} ({event.owner.email})
            </div>
            <div class="muted">
              {dateLabel(event.startAt)} — {dateLabel(event.endAt)}
            </div>
            <div class="muted">{schedule(event)}</div>
            {notesOf(event) && <div>Notes: {notesOf(event)}</div>}
          </li>
        ))
      ) : (
        <li class="muted">No events have been shared with you.</li>
      )}
    </ul>
  );
}
