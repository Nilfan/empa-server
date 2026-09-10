import { Notice } from "./Notice";
import type { NoticeState } from "../types/calendar";

export function AuthView({
  onSubmit,
  notice,
}: {
  onSubmit: (
    path: "/login" | "/register",
    body: Record<string, string>,
    success: string,
  ) => Promise<void>;
  notice: NoticeState;
}) {
  const submit =
    (path: "/login" | "/register", success: string) =>
    async (event: SubmitEvent) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget as HTMLFormElement);
      await onSubmit(
        path,
        Object.fromEntries(data) as Record<string, string>,
        success,
      );
    };
  return (
    <main>
      <header>
        <h1>Calendar</h1>
      </header>
      <Notice notice={notice} />
      <section aria-labelledby="auth-heading">
        <h2 id="auth-heading">Sign in or create an account</h2>
        <div class="grid">
          <form onSubmit={submit("/login", "Signed in successfully.")}>
            <h3>Sign in</h3>
            <label>
              Email
              <input name="email" type="email" autocomplete="email" required />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autocomplete="current-password"
                required
              />
            </label>
            <button>Sign in</button>
          </form>
          <form
            onSubmit={submit("/register", "Account created and signed in.")}
          >
            <h3>Create account</h3>
            <label>
              Name
              <input name="name" autocomplete="name" required maxlength={100} />
            </label>
            <label>
              Email
              <input name="email" type="email" autocomplete="email" required />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autocomplete="new-password"
                required
                minlength={12}
              />
            </label>
            <button>Create account</button>
          </form>
        </div>
      </section>
    </main>
  );
}
