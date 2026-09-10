import { execFileSync } from "node:child_process";
import { Client } from "pg";
import {
  getValidatedTestDatabaseUrl,
  resetTestDatabase,
} from "../test/test-database.ts";

const databaseUrl = getValidatedTestDatabaseUrl();

if (process.argv[2] === "migrate") {
  execFileSync("npx", ["drizzle-kit", "migrate"], {
    stdio: "inherit",
    env: process.env,
  });
} else if (process.argv[2] === "reset") {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await resetTestDatabase(client);
  } finally {
    await client.end();
  }
} else {
  throw new Error("Usage: tsx scripts/test-db.ts <migrate|reset>");
}
