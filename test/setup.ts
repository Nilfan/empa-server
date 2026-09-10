import { afterAll, beforeEach } from "vitest";
import { assertTestDatabaseUrl, resetTestDatabase } from "./test-database.ts";

assertTestDatabaseUrl();

const { closeDatabasePool, pool } = await import("../src/db/index.ts");

beforeEach(async () => {
  await resetTestDatabase(pool);
});

afterAll(async () => {
  await closeDatabasePool();
});
