import type { NoticeState } from "../types/calendar";

export function Notice({ notice }: { notice: NoticeState }) {
  return (
    <p
      class={`notice ${notice.error ? "error" : "success"}`}
      role="status"
      aria-live="polite"
    >
      {notice.text}
    </p>
  );
}
