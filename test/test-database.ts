import { type Pool, type PoolClient } from "pg";

const TEST_DATABASE_NAME = "EmpaTestDB";
const TEST_DATABASE_PORT = "5433";
const LOCAL_TEST_DATABASE_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "host.docker.internal",
  "empadb-test",
]);

type Queryable = Pick<Pool | PoolClient, "query">;

export function getValidatedTestDatabaseUrl(
  databaseUrl = process.env.DATABASE_URL,
): string {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL must be set for the isolated test database.");
  }

  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
  }

  const configuredCiHost = process.env.TEST_DATABASE_CI_HOST;
  const allowedHosts = new Set(LOCAL_TEST_DATABASE_HOSTS);
  if (configuredCiHost) allowedHosts.add(configuredCiHost);

  if (
    (url.protocol !== "postgres:" && url.protocol !== "postgresql:") ||
    url.hostname === "" ||
    !allowedHosts.has(url.hostname) ||
    url.port !== TEST_DATABASE_PORT ||
    url.pathname !== `/${TEST_DATABASE_NAME}`
  ) {
    throw new Error(
      "DATABASE_URL must target exactly EmpaTestDB on port 5433 at a local test host or TEST_DATABASE_CI_HOST.",
    );
  }

  return databaseUrl;
}

export function assertTestDatabaseUrl(): void {
  getValidatedTestDatabaseUrl();
}

export async function resetTestDatabase(client: Queryable): Promise<void> {
  assertTestDatabaseUrl();
  await client.query(
    "TRUNCATE TABLE calendar_sharing, calendar_events, sessions, users RESTART IDENTITY CASCADE",
  );
}
