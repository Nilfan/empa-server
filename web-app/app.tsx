import { useEffect, useState } from "preact/hooks";
import { AuthView } from "./components/AuthView";
import { CalendarSharing } from "./components/CalendarSharing";
import { EventEditor } from "./components/EventEditor";
import { EventList } from "./components/EventList";
import { Notice } from "./components/Notice";
import { SharedList } from "./components/SharedList";
import { api } from "./lib/api";
import type {
  CalendarEvent,
  NoticeState,
  SharedEvent,
  User,
} from "./types/calendar";

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [owned, setOwned] = useState<CalendarEvent[]>([]);
  const [shared, setShared] = useState<SharedEvent[]>([]);
  const [recipients, setRecipients] = useState<User[]>([]);
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [notice, setNotice] = useState<NoticeState>({ text: "" });

  const refresh = async () => {
    const [ownedResult, sharedResult, sharesResult] = await Promise.all([
      api<{ events: CalendarEvent[] }>(
        `/events?includeInactive=${includeInactive}`,
      ),
      api<{ events: SharedEvent[] }>("/shared-events"),
      api<{ users: User[] }>("/calendar/shares"),
    ]);
    setOwned(ownedResult.events ?? []);
    setShared(sharedResult.events ?? []);
    setRecipients(sharesResult.users ?? []);
    setSelected(
      (current: CalendarEvent | null) =>
        (current &&
          (ownedResult.events ?? []).find(({ id }) => id === current.id)) ||
        null,
    );
  };
  const report = (error: unknown) =>
    setNotice({
      text: error instanceof Error ? error.message : "Request failed.",
      error: true,
    });

  useEffect(() => {
    api<{ user: User }>("/session")
      .then(({ user: sessionUser }) => setUser(sessionUser))
      .catch((error: unknown) => {
        if (!(error instanceof Error) || !error.message.includes("(401)"))
          report(error);
      });
  }, []);
  useEffect(() => {
    if (user) refresh().catch(report);
  }, [user, includeInactive]);

  async function authenticate(
    path: "/login" | "/register",
    body: Record<string, string>,
    success: string,
  ) {
    try {
      const result = await api<{ user: User }>(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setUser(result.user);
      setNotice({ text: success });
    } catch (error) {
      report(error);
    }
  }
  async function logout() {
    try {
      await api<void>("/logout", { method: "POST" });
      setUser(null);
      setSelected(null);
      setOwned([]);
      setShared([]);
      setRecipients([]);
      setNotice({ text: "Signed out." });
    } catch (error) {
      report(error);
    }
  }
  async function setEventActive(event: CalendarEvent) {
    try {
      await api<{ event: CalendarEvent }>(
        `/events/${event.id}/${event.isActive ? "deactivate" : "activate"}`,
        { method: "POST" },
      );
      await refresh();
      setNotice({
        text: `Event ${event.isActive ? "deactivated" : "activated"}.`,
      });
    } catch (error) {
      report(error);
    }
  }

  if (!user) return <AuthView onSubmit={authenticate} notice={notice} />;
  return (
    <main>
      <header>
        <h1>Calendar</h1>
        <div>
          {user.name} ({user.email}){" "}
          <button type="button" onClick={logout}>
            Log out
          </button>
        </div>
      </header>
      <Notice notice={notice} />
      <CalendarSharing
        recipients={recipients}
        setRecipients={setRecipients}
        onError={report}
        onRefresh={refresh}
      />
      <div class="grid">
        <section aria-labelledby="owned-heading">
          <div class="row">
            <h2 id="owned-heading">My events</h2>
            <label>
              <input
                type="checkbox"
                checked={includeInactive}
                onInput={(event) =>
                  setIncludeInactive(event.currentTarget.checked)
                }
              />{" "}
              Show inactive
            </label>
            <button type="button" onClick={() => setSelected(null)}>
              New event
            </button>
          </div>
          <EventList
            events={owned}
            onSelect={setSelected}
            onSetActive={setEventActive}
            empty="No events found."
          />
        </section>
        <EventEditor
          key={selected?.id ?? "new"}
          selected={selected}
          onSaved={async (event, message) => {
            setSelected(event);
            await refresh();
            setNotice({ text: message });
          }}
          onDeleted={async () => {
            setSelected(null);
            await refresh();
            setNotice({ text: "Event deleted." });
          }}
          onError={report}
        />
      </div>
      <section aria-labelledby="shared-heading">
        <h2 id="shared-heading">Shared with me</h2>
        <p class="muted">These events are view-only.</p>
        <SharedList events={shared} />
      </section>
    </main>
  );
}
