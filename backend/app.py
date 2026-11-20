import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request
from postgrest import APIError
from supabase import Client, create_client

load_dotenv()

frontend_dir = Path(__file__).resolve().parent.parent / "frontend"
app = Flask(
    __name__,
    template_folder=str(frontend_dir),
    static_folder=str(frontend_dir / "static"),
    static_url_path="/static",
)

supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_PUBLISHABLE_KEY")
supabase: Client | None = (
    create_client(supabase_url, supabase_key) if supabase_url and supabase_key else None
)


@app.after_request
def add_cors_headers(response):
    """Allow browser clients from any origin to call this API."""
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, X-User-Id"
    response.headers["Access-Control-Max-Age"] = "86400"
    return response


@app.errorhandler(APIError)
def handle_database_error(error):
    # PostgreSQL unique_violation; used when two registration requests race.
    if getattr(error, "code", None) == "23505":
        return jsonify({"error": "You are already registered for this event."}), 409
    app.logger.exception("Supabase request failed")
    return jsonify({"error": "Database request failed."}), 500


def get_supabase() -> Client:
    if supabase is None:
        raise RuntimeError("Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY to use the API.")
    return supabase


def current_user_id():
    """Read the caller's claimed ID; without authentication it is not verified."""
    return request.headers.get("X-User-Id") or request.args.get("user_id")


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/health")
def health():
    return jsonify({"status": "ok", "service": "jaanu event API"})


@app.get("/api/events")
def list_events():
    result = get_supabase().table("events").select("*").execute()
    return jsonify(result.data)


@app.get("/api/events/<event_id>")
def get_event(event_id):
    result = (
        get_supabase().table("events").select("*").eq("id", event_id).limit(1).execute()
    )
    if not result.data:
        return jsonify({"error": "Event not found."}), 404
    return jsonify(result.data[0])


@app.post("/api/registrations")
def create_registration():
    payload = request.get_json(silent=True) or {}
    user_id = payload.get("user_id") or current_user_id()
    event_id = payload.get("event_id")
    if not user_id or not event_id:
        return jsonify({"error": "user_id and event_id are required."}), 400

    db = get_supabase()
    event_result = db.table("events").select("id, capacity, status").eq("id", event_id).limit(1).execute()
    if not event_result.data:
        return jsonify({"error": "Event not found."}), 404
    event = event_result.data[0]
    if event.get("status") and event["status"].lower() not in {"open", "active", "upcoming"}:
        return jsonify({"error": "This event is not accepting registrations."}), 409

    existing = (
        db.table("registrations")
        .select("id")
        .eq("user_id", user_id)
        .eq("event_id", event_id)
        .limit(1)
        .execute()
    )
    if existing.data:
        return jsonify({"error": "You are already registered for this event."}), 409

    if event.get("capacity") is not None:
        count = (
            db.table("registrations")
            .select("id", count="exact")
            .eq("event_id", event_id)
            .execute()
        )
        if (count.count or 0) >= event["capacity"]:
            return jsonify({"error": "This event is full."}), 409

    result = (
        db.table("registrations")
        .insert({"user_id": user_id, "event_id": event_id})
        .execute()
    )
    return jsonify(result.data[0] if result.data else {}), 201


@app.get("/api/me/registrations")
def list_my_registrations():
    user_id = current_user_id()
    if not user_id:
        return jsonify({"error": "Provide your user ID in the X-User-Id header."}), 400
    result = (
        get_supabase()
        .table("registrations")
        .select("*, events(*)")
        .eq("user_id", user_id)
        .execute()
    )
    return jsonify(result.data)


@app.get("/api/events/<event_id>/registrations")
def list_event_registrations(event_id):
    user_id = current_user_id()
    if not user_id:
        return jsonify({"error": "Provide your user ID in the X-User-Id header."}), 400

    db = get_supabase()
    event_result = (
        db.table("events").select("id, organizer_id").eq("id", event_id).limit(1).execute()
    )
    if not event_result.data:
        return jsonify({"error": "Event not found."}), 404
    if event_result.data[0].get("organizer_id") != user_id:
        return jsonify({"error": "Only the event organizer can view attendees."}), 403

    result = (
        db.table("registrations")
        .select("*, users(id, email, role)")
        .eq("event_id", event_id)
        .execute()
    )
    return jsonify(result.data)


if __name__ == "__main__":
    app.run(debug=True)
