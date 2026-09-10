import { useState } from "preact/hooks";
import { api } from "../lib/api";
import {
  blankDraft,
  localDate,
  notesOf,
  weekdayNames,
} from "../helpers/calendar";
import type {
  CalendarEvent,
  EventDraft,
  RegularConfig,
} from "../types/calendar";

export function EventEditor({
  selected,
  onSaved,
  onDeleted,
  onError,
}: {
  selected: CalendarEvent | null;
  onSaved: (event: CalendarEvent, message: string) => Promise<void>;
  onDeleted: () => Promise<void>;
  onError: (error: unknown) => void;
}) {
  const draft = selected
    ? { ...selected, content: { notes: notesOf(selected) } }
    : blankDraft();
  const [repeats, setRepeats] = useState(draft.isRegular);

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget as HTMLFormElement);
    const isRegular = form.get("isRegular") === "on";
    const kind = form.get("regularKind") as RegularConfig["kind"];
    const values = (name: string) => form.getAll(name).map(Number);
    const regularConfig: RegularConfig | null = !isRegular
      ? null
      : kind === "weekdays"
        ? { kind, weekdays: values("weekdays") }
        : kind === "monthDays"
          ? { kind, monthDays: values("monthDays") }
          : { kind, intervalDays: Number(form.get("intervalDays")) };
    const payload: EventDraft = {
      title: String(form.get("title") ?? ""),
      content: { notes: String(form.get("notes") ?? "") },
      startAt: new Date(String(form.get("startAt"))).toISOString(),
      endAt: new Date(String(form.get("endAt"))).toISOString(),
      isActive: form.get("isActive") === "on",
      isRegular,
      regularConfig,
    };
    try {
      const result = await api<{ event: CalendarEvent }>(
        selected ? `/events/${selected.id}` : "/events",
        { method: selected ? "PATCH" : "POST", body: JSON.stringify(payload) },
      );
      await onSaved(result.event, selected ? "Event saved." : "Event created.");
    } catch (error) {
      onError(error);
    }
  };

  return (
    <section aria-labelledby="editor-heading">
      <h2 id="editor-heading">Event editor</h2>
      <p class="muted">
        {selected
          ? `Editing event #${selected.id}.`
          : "Create an event or select one from your list."}
      </p>
      <form key={selected?.id ?? "new"} onSubmit={submit}>
        <label>
          Title
          <input
            name="title"
            required
            maxlength={200}
            defaultValue={draft.title}
          />
        </label>
        <label>
          Notes
          <textarea name="notes" defaultValue={notesOf(draft)} />
        </label>
        <div class="grid">
          <label>
            Start
            <input
              name="startAt"
              type="datetime-local"
              step="1"
              required
              defaultValue={localDate(draft.startAt)}
            />
          </label>
          <label>
            End
            <input
              name="endAt"
              type="datetime-local"
              step="1"
              required
              defaultValue={localDate(draft.endAt)}
            />
          </label>
        </div>
        <div class="row">
          <label>
            <input
              name="isActive"
              type="checkbox"
              defaultChecked={draft.isActive}
            />{" "}
            Active
          </label>
          <label>
            <input
              name="isRegular"
              type="checkbox"
              defaultChecked={draft.isRegular}
              onInput={(event) => setRepeats(event.currentTarget.checked)}
            />{" "}
            Repeats
          </label>
        </div>
        <Recurrence config={draft.regularConfig} enabled={repeats} />
        <div class="actions">
          <button>Save event</button>
          {selected && (
            <button
              class="danger"
              type="button"
              onClick={async () => {
                if (confirm(`Delete “${selected.title}”?`))
                  try {
                    await api<void>(`/events/${selected.id}`, {
                      method: "DELETE",
                    });
                    await onDeleted();
                  } catch (error) {
                    onError(error);
                  }
              }}
            >
              Delete event
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

function Recurrence({
  config,
  enabled,
}: {
  config: RegularConfig | null;
  enabled: boolean;
}) {
  const [on, setOn] = useState(enabled);
  const [kind, setKind] = useState<RegularConfig["kind"]>(
    config?.kind ?? "weekdays",
  );
  return (
    <fieldset class={on ? "" : "hidden"}>
      <legend>Repeat schedule</legend>
      <label>
        Pattern
        <select
          name="regularKind"
          value={kind}
          onInput={(event) =>
            setKind(event.currentTarget.value as RegularConfig["kind"])
          }
        >
          <option value="weekdays">Weekdays</option>
          <option value="monthDays">Days of month</option>
          <option value="intervalDays">Every N days</option>
        </select>
      </label>
      {kind === "weekdays" && (
        <div class="checkboxes">
          {weekdayNames.map((name, index) => (
            <label key={name}>
              <input
                name="weekdays"
                type="checkbox"
                value={index + 1}
                defaultChecked={
                  config?.kind === "weekdays" &&
                  config.weekdays.includes(index + 1)
                }
              />
              {name}
            </label>
          ))}
        </div>
      )}
      {kind === "monthDays" && (
        <div class="checkboxes">
          {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
            <label key={day}>
              <input
                name="monthDays"
                type="checkbox"
                value={day}
                defaultChecked={
                  config?.kind === "monthDays" && config.monthDays.includes(day)
                }
              />
              {day}
            </label>
          ))}
        </div>
      )}
      {kind === "intervalDays" && (
        <label>
          Every
          <input
            name="intervalDays"
            type="number"
            min="1"
            max="365"
            defaultValue={
              config?.kind === "intervalDays" ? config.intervalDays : 1
            }
          />
          days
        </label>
      )}
      <input type="hidden" value="" onInput={() => setOn(on)} />
    </fieldset>
  );
}
