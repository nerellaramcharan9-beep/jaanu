# CampusPulse React frontend

This folder contains the independent React + Vite frontend. It calls the Flask API at the Render URL.

## Run locally

```bash
npm install
npm run dev
```

Vite loads `VITE_API_EVENTS_URL` from `.env.local`. The provided local value points to:

```text
https://jaanu-1.onrender.com/api/events
```

The frontend derives the API base from that events endpoint and calls the matching event-details, registration, and schedule routes. To change backends, update `.env.local` and restart Vite.

## Build

```bash
npm run build
```

## Deploy as a separate Render frontend

Use the frontend-only Blueprint in [`../render-frontend.yaml`](../render-frontend.yaml) to create a Render Static Site without recreating the backend service. Render Blueprints support selecting a custom YAML file path.

If creating the Static Site manually, connect this repository with:

- Root directory: `frontend`
- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- Environment variable: `VITE_API_EVENTS_URL=https://jaanu-1.onrender.com/api/events`

The backend's CORS response allows frontend requests from other origins.

No login or authentication flow is included. Creating a registration and looking up a schedule ask for a `users.id` UUID because the API/database require it; the value is not verified as proof of identity.
