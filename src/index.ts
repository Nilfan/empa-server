import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cookieParser from "cookie-parser";

import { eventsRouter } from "./routes/events.routes.ts";
import { usersRouter } from "./routes/users.routes.ts";

const app: Express = express();

app.use(express.json({ limit: "16kb" }));
app.use(cookieParser());

if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);

app.get("/api/v1/greeting", (_req: Request, res: Response) => {
  res.json({ content: "Hello World!" });
});

app.use("/api/v1", usersRouter);
app.use("/api/v1", eventsRouter);

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled API error", error);
  if (!res.headersSent)
    res.status(500).json({ message: "Internal server error." });
});

app.listen(3000);
