import { defineConfig, Config } from "drizzle-kit";

type ConnectionMode = "local" | "prod";

const connectionMode: ConnectionMode =
  process.env.NODE_ENV === "production" ? "prod" : "local";

let url;
if (connectionMode === "prod") {
  const databaseUrl = process.env.POSTGRES_URL_NON_POOLING;

  url = new URL(databaseUrl);

  url.searchParams.set("sslmode", "require");
  url.searchParams.set("uselibpqcompat", "true");
} else {
  url =
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/EmpaDB";
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: url.toString(),
  },
});
