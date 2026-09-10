import { api } from "../lib/api";
import { useState } from "preact/hooks";
import type { User } from "../types/calendar";

export function CalendarSharing({
  recipients,
  setRecipients,
  onError,
  onRefresh,
}: {
  recipients: User[];
  setRecipients: (users: User[]) => void;
  onError: (error: unknown) => void;
  onRefresh: () => Promise<void>;
}) {
  const [pendingRecipientIds, setPendingRecipientIds] = useState<Set<number>>(
    new Set(),
  );
  const replace = async (form: HTMLFormElement) => {
    const recipients = String(new FormData(form).get("recipients") ?? "")
      .split(/[\n,]+/)
      .map((recipient) => recipient.trim())
      .filter(Boolean)
      .map((recipient) =>
        /^\d+$/.test(recipient) ? Number(recipient) : recipient,
      );
    try {
      const result = await api<{ users: User[] }>("/calendar/shares", {
        method: "PUT",
        body: JSON.stringify({ recipients }),
      });
      setRecipients(result.users ?? []);
    } catch (error) {
      onError(error);
    }
  };
  const setRecipientPending = (userId: number, pending: boolean) => {
    setPendingRecipientIds((current) => {
      const next = new Set(current);
      if (pending) next.add(userId);
      else next.delete(userId);
      return next;
    });
  };
  const shareReciprocally = async (user: User) => {
    setRecipientPending(user.id, true);
    try {
      const result = await api<{ users: User[] }>(
        `/calendar/shares/${user.id}`,
        { method: "POST" },
      );
      setRecipients(result.users ?? []);
      await onRefresh();
    } catch (error) {
      onError(error);
    } finally {
      setRecipientPending(user.id, false);
    }
  };
  const revoke = async (user: User) => {
    setRecipientPending(user.id, true);
    try {
      await api<void>(`/calendar/reciprocal-shares/${user.id}`, {
        method: "DELETE",
      });
      setRecipients(recipients.filter(({ id }) => id !== user.id));
      await onRefresh();
    } catch (error) {
      onError(error);
    } finally {
      setRecipientPending(user.id, false);
    }
  };

  return (
    <section aria-labelledby="sharing-heading">
      <h2 id="sharing-heading">Share calendar</h2>
      <p class="muted">Recipients can view active events only.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          replace(event.currentTarget);
        }}
      >
        <label>
          Recipient email addresses or user IDs (comma or new line separated)
          <textarea
            name="recipients"
            defaultValue={recipients.map(({ email }) => email).join("\n")}
          />
        </label>
        <button>Save recipients</button>
      </form>
      <ul aria-live="polite">
        {recipients.length ? (
          recipients.map((user) => (
            <li key={user.id}>
              {user.name} ({user.email}){" "}
              <button
                type="button"
                onClick={() => shareReciprocally(user)}
                disabled={pendingRecipientIds.has(user.id)}
                aria-label={`Share reciprocally with ${user.name} (${user.email})`}
              >
                Share reciprocally
              </button>{" "}
              <button
                class="danger remove-recipient"
                type="button"
                onClick={() => revoke(user)}
                disabled={pendingRecipientIds.has(user.id)}
                aria-label={`Remove ${user.name} (${user.email}) from shared calendar`}
                title="Remove recipient"
              >
                ×
              </button>
            </li>
          ))
        ) : (
          <li class="muted">Not shared with anyone.</li>
        )}
      </ul>
    </section>
  );
}
