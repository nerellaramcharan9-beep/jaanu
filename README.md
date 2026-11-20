# Jaanu Campus Events

CampusPulse is a React frontend connected to the Flask/Supabase API.

## Frontend

See [`frontend/README.md`](frontend/README.md). Run it locally with:

```bash
cd frontend
npm ci
npm run dev
```

The local API configuration is in `frontend/.env.local` and points at the deployed backend's `/api/events` endpoint.

## Backend

The Flask API is in `backend/`. It serves the event, registration, and attendee endpoints and allows cross-origin requests from any origin. The frontend has no login or authentication flow.

`render-frontend.yaml` defines the separate React Static Site and points it at the existing Render API.
