# Empa

[Русская версия](README.ru.md)

## Overview

Empa is an authenticated Preact calendar application backed by Express, PostgreSQL, and Drizzle. Registered users can manage their own events and share their complete calendar with other registered users.

### User scenarios

- A user registers, signs in, and creates an event in their calendar. They can later edit it, activate or deactivate it, or delete it.
- A user schedules a recurring event using selected weekdays, selected days of the month, or an every-_N_-days interval.
- A user shares their entire calendar with another registered user by email address or numeric ID. The recipient sees the owner’s active shared events in read-only mode; the owner may also make the access mutual.

## Prerequisites

- Node.js and npm.
- Docker and Docker Compose, to run PostgreSQL locally.
- An available local PostgreSQL port `5432`, API port `3000`, and frontend port `5173`.

## Local startup

Open a terminal in the project root and install the Node dependencies:

```sh
npm ci
```

### Terminal 1: database and migrations

Start PostgreSQL:

```sh
docker compose up -d
```

This starts the database named `EmpaDB` on `localhost:5432` with user `postgres` and password `postgres`.

Set the database connection string **in the shell that runs migrations and the API**:

```sh
export DATABASE_URL='postgresql://postgres:postgres@localhost:5432/EmpaDB'
```

Then apply migrations:

```sh
npm run db:migrate
```

### Terminal 1: backend API

With `DATABASE_URL` still exported in this terminal, start the API:

```sh
npm run start
```

The API is available at <http://localhost:3000>. During development, `npm run watch` is an alternative to `npm run start`.

### Terminal 2: frontend

In a second terminal, start the Preact frontend:

```sh
npm run web-app:dev
```

Vite normally serves it at <http://localhost:5173>. Its development server proxies `/api/v1` requests to `http://localhost:3000`.

### Environment note

There is no dotenv loader. A `.env` file alone is not automatically loaded, so export environment variables in the shell that starts the relevant command. The application has a `DATABASE_URL` fallback, but explicitly exporting the connection string above is recommended. `NODE_ENV=production` changes secure-cookie and trust-proxy behavior.

## Available scripts

| Script                  | Purpose                                 |
| ----------------------- | --------------------------------------- |
| `npm run start`         | Start the API server.                   |
| `npm run watch`         | Start the API in watch mode.            |
| `npm run web-app:dev`   | Start the frontend development server.  |
| `npm run web-app:build` | Build the frontend into `web-app-dist`. |
| `npm run db:migrate`    | Apply database migrations.              |
| `npm run db:generate`   | Generate Drizzle migrations.            |
| `npm run build`         | Build the backend project.              |
| `npm run typecheck`     | Run TypeScript type checking.           |

## API, authentication, and security notes

- The frontend uses the `/api/v1` API path and requires an authenticated session for calendar use.
- Users can register, log in, and log out.
- A signed-in user can create, edit, activate, deactivate, and delete only their own events.
- Sharing is calendar-wide, not event-by-event. Recipients must already be registered, are identified by email address or numeric ID, and can view only active shared events in read-only mode.
- Authentication depends on session cookies. In production, configure `NODE_ENV=production`, proxy handling, cookie security, and cross-origin behavior deliberately for the deployment topology.

## FAQ

### Docker will not start, or port `5432` is already in use

Ensure Docker is running. Stop the service using local port `5432`, or make the PostgreSQL port configuration and `DATABASE_URL` agree before starting the stack again.

### `DATABASE_URL` appears to be ignored or the database cannot be reached

`.env` is not loaded automatically. Export `DATABASE_URL` in the same terminal that runs `npm run db:migrate`, `npm run start`, or `npm run watch`. Confirm that Docker is up and that the URL targets `localhost:5432/EmpaDB` with the configured local credentials.

### Migrations fail or tables are missing

Start PostgreSQL first, export `DATABASE_URL`, then run `npm run db:migrate`. Run migrations before starting the API when preparing a fresh local database.

### The frontend cannot reach the API

Run the backend at `http://localhost:3000` and start the frontend with `npm run web-app:dev`; the Vite development server normally proxies `/api/v1` to port `3000`. If ports or hosts are changed, update the setup so the frontend’s API routing matches the backend.

### Login does not persist, or requests look unauthenticated

The app uses session cookies. Use the normal local frontend/API pairing when developing. For a separated frontend and API deployment, configure cookie attributes and CORS deliberately; `NODE_ENV=production` also affects secure-cookie and trust-proxy behavior.

### Signup validation rejects my input

Registration is validated by the application. Supply valid registration details and correct any validation feedback before signing in; the API does not provide password reset functionality.

### Can I share one event, invite someone, or edit a shared calendar?

No. Sharing applies to the entire calendar, recipients must be registered, and recipients see active shared events read-only. There are no invitations, per-event sharing controls, or collaborative editing.

### Why are recurring occurrences not appearing as separate events?

Recurrence can be configured by weekdays, days of the month, or every _N_ days, but the application does not generate repeat occurrences. It also has no reminders, timezone preferences, or export feature.

## Production build caveat

Build the frontend with:

```sh
npm run web-app:build
```

The output is written to `web-app-dist` and uses the `/web-app/` base path. Express does not serve these static assets. A production deployment must host the built assets separately or through another static host and route `/api/v1` correctly to the API. If the frontend and API are on different origins, configure CORS and cross-origin cookies deliberately.
