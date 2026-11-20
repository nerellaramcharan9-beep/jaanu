import { useCallback, useEffect, useMemo, useState } from "react";

const EVENTS_ENDPOINT = (import.meta.env.VITE_API_EVENTS_URL || "https://jaanu-1.onrender.com/api/events").replace(/\/+$/, "");
const API_BASE_URL = EVENTS_ENDPOINT.replace(/\/events$/, "");
const cardAccents = ["#8b5cf6", "#f08a4d", "#4d70d9", "#ca65a8", "#39a98e"];
const cardGlyphs = ["✳", "↗", "✦", "◈", "✷"];

async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, options);
  } catch {
    throw new Error("Could not reach the event API. Check your connection and try again.");
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `The API returned ${response.status}.`);
  }
  return body;
}

function Mark({ children, className = "" }) {
  return <span className={`category-icon ${className}`} aria-hidden="true">{children}</span>;
}

function EventCard({ event, index, onDetails, onRegister }) {
  const capacity = Number(event.capacity);
  const hasCapacity = Number.isFinite(capacity) && capacity > 0;
  return (
    <article className="event-card" style={{ "--card-accent": cardAccents[index % cardAccents.length] }}>
      <div className="card-top">
        <span className="event-category"><Mark>{cardGlyphs[index % cardGlyphs.length]}</Mark> CAMPUS EVENT</span>
        <span className="status-pill">{event.status || "Open"}</span>
      </div>
      <h3 className="event-title">{event.title || "Untitled event"}</h3>
      <span className="event-id">{event.id}</span>
      <div className="event-meta"><span className="capacity-icon" aria-hidden="true">◉</span><span>{hasCapacity ? `Capacity: ${capacity}` : "Capacity not listed"}</span></div>
      <div className="card-actions">
        <span className="capacity-label">{hasCapacity ? <><strong>{capacity}</strong> total capacity</> : "Event details"}</span>
        <div className="event-actions">
          <button className="details-button" type="button" onClick={() => onDetails(event)}>Details</button>
          <button className="register-button" type="button" onClick={() => onRegister(event)}>Join event ↗</button>
        </div>
      </div>
    </article>
  );
}

function Modal({ title, kicker, description, onClose, children, className = "" }) {
  useEffect(() => {
    function handleEscape(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`dialog-card ${className}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <button className="dialog-close" type="button" onClick={onClose} aria-label="Close">×</button>
        <span className="dialog-kicker">{kicker}</span>
        <h2 id="modal-title">{title}</h2>
        {description && <p className="dialog-description">{description}</p>}
        {children}
      </section>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState("explore");
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [registrationUserId, setRegistrationUserId] = useState("");
  const [registrationBusy, setRegistrationBusy] = useState(false);
  const [registrationMessage, setRegistrationMessage] = useState("");
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [scheduleUserId, setScheduleUserId] = useState("");
  const [registrations, setRegistrations] = useState([]);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState("");
  const [scheduleError, setScheduleError] = useState(false);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const data = await apiRequest("/events");
      if (!Array.isArray(data)) throw new Error("The events endpoint returned an unexpected response.");
      setEvents(data);
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const visibleEvents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return events.filter((event) => {
      const status = String(event.status || "").toLowerCase();
      const matchesFilter = filter === "all"
        || (filter === "upcoming" && status === "upcoming")
        || (filter === "open" && ["open", "active", "upcoming"].includes(status));
      const matchesSearch = `${event.title || ""} ${event.status || ""}`.toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [events, filter, search]);

  const openDetails = useCallback(async (event) => {
    setSelectedEvent(event);
    setDetails(null);
    setDetailsLoading(true);
    try {
      const result = await apiRequest(`/events/${encodeURIComponent(event.id)}`);
      setDetails(result);
    } catch (error) {
      setDetails({ error: error.message });
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  function openRegistration(event) {
    setDetails(null);
    setSelectedEvent(event);
    setRegistrationMessage("");
    setRegistrationSuccess(false);
    setRegistrationUserId("");
  }

  async function submitRegistration(event) {
    event.preventDefault();
    setRegistrationBusy(true);
    setRegistrationMessage("Saving your spot…");
    try {
      await apiRequest("/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: registrationUserId.trim(), event_id: selectedEvent.id }),
      });
      setRegistrationSuccess(true);
      setRegistrationMessage("You’re on the list! Your registration is saved.");
    } catch (error) {
      setRegistrationSuccess(false);
      setRegistrationMessage(error.message);
    } finally {
      setRegistrationBusy(false);
    }
  }

  async function findRegistrations(event) {
    event.preventDefault();
    setScheduleBusy(true);
    setScheduleError(false);
    setScheduleMessage("Loading registrations…");
    setRegistrations([]);
    try {
      const data = await apiRequest("/me/registrations", {
        headers: { "X-User-Id": scheduleUserId.trim() },
      });
      setRegistrations(data);
      setScheduleMessage(`${data.length} ${data.length === 1 ? "registration" : "registrations"} found.`);
    } catch (error) {
      setScheduleError(true);
      setScheduleMessage(error.message);
    } finally {
      setScheduleBusy(false);
    }
  }

  const modalClose = useCallback(() => setSelectedEvent(null), []);

  return (
    <>
      <div className="ambient ambient-purple" />
      <div className="ambient ambient-orange" />
      <header className="topbar">
        <a className="brand" href="#explore" onClick={(event) => { event.preventDefault(); setPage("explore"); }} aria-label="CampusPulse home">
          <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 12h3l2.1-6 4.2 12 2.1-6H21" /></svg></span>
          <span>Campus<span className="brand-accent">Pulse</span></span>
        </a>
        <nav className="main-nav" aria-label="Main navigation">
          <button className={`nav-link ${page === "explore" ? "active" : ""}`} onClick={() => setPage("explore")} type="button">Explore</button>
          <button className={`nav-link ${page === "schedule" ? "active" : ""}`} onClick={() => setPage("schedule")} type="button">My schedule</button>
        </nav>
        <div className="topbar-right">
          <span className="live-pill"><i /> CAMPUS LIVE</span>
          <span className="avatar-button" title="No account required" aria-label="No account required">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.7-3.4 3.1-5.2 7-5.2s6.3 1.8 7 5.2"/></svg>
          </span>
        </div>
      </header>

      {page === "explore" ? (
        <main className="page-shell">
          <section className="hero">
            <div className="hero-copy">
              <div className="eyebrow"><span className="eyebrow-star">✳</span> YOUR CAMPUS, IN MOTION</div>
              <h1>Find your people.<br /><span>Find your next thing.</span></h1>
              <p className="hero-description">The talks, meetups, and big ideas happening around campus. Pick a pulse and show up.</p>
              <div className="hero-meta"><span className="meta-dot" /><span>{loading ? "Finding events…" : `${events.length} ${events.length === 1 ? "event" : "events"} on the calendar`}</span><span className="meta-divider">/</span><span>Make today count</span></div>
            </div>
            <div className="hero-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="hero-spark spark-one">✳</div><div className="hero-spark spark-two">✦</div><div className="hero-ticket"><span className="ticket-kicker">YOUR NEXT<br/>BIG IDEA</span><span className="ticket-glyph">↗</span><span className="ticket-caption">IS OUT THERE</span></div><div className="hero-sticker">GO<br/>WHERE<br/>IT HAPPENS</div></div>
          </section>

          <section className="discovery" aria-labelledby="events-title">
            <div className="section-heading"><div><span className="section-kicker">THE CAMPUS CALENDAR</span><h2 id="events-title">Explore events <span className="heading-period">.</span></h2></div><button onClick={loadEvents} className="refresh-button" type="button" disabled={loading}><span aria-hidden="true">↻</span> {loading ? "Refreshing" : "Refresh"}</button></div>
            <div className="toolbar">
              <label className="search-box"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.3"/><path d="m16 16 4.2 4.2"/></svg><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search events…" autoComplete="off" /></label>
              <div className="filter-list" role="group" aria-label="Filter events">{[["all", "All events"], ["upcoming", "Upcoming"], ["open", "Open now"]].map(([key, label]) => <button key={key} className={`filter-chip ${filter === key ? "selected" : ""}`} type="button" onClick={() => setFilter(key)}>{label}</button>)}</div>
              <span className="result-count">{visibleEvents.length} {visibleEvents.length === 1 ? "event" : "events"}</span>
            </div>
            {loadError && <div className="notice" role="alert">{loadError}<button className="inline-retry" type="button" onClick={loadEvents}>Try again</button></div>}
            <div className="events-grid" aria-live="polite">
              {loading && !events.length ? <div className="empty-state"><div className="empty-icon">✳</div><h3>Finding your next thing…</h3><p>Connecting to the campus event feed.</p></div>
                : !loading && !loadError && visibleEvents.length === 0 ? <div className="empty-state"><div className="empty-icon">✳</div><h3>No events in this orbit</h3><p>Try another filter, or clear your search to see everything.</p></div>
                  : visibleEvents.map((event, index) => <EventCard key={event.id} event={event} index={index} onDetails={openDetails} onRegister={openRegistration} />)}
            </div>
          </section>
          <footer className="footer"><a className="footer-brand" href="#explore">Campus<span className="brand-accent">Pulse</span></a><span>Good things happen when you show up.</span><span className="footer-status"><i /> Connected to live campus events</span></footer>
        </main>
      ) : (
        <main className="page-shell schedule-page">
          <div className="schedule-hero"><span className="section-kicker">YOUR NEXT CHAPTER</span><h1>My <span>schedule.</span></h1><p>Look up registrations linked to your user ID.</p></div>
          <form className="schedule-lookup" onSubmit={findRegistrations}><label htmlFor="schedule-user-id">User ID</label><div className="lookup-row"><input id="schedule-user-id" className="text-field" required value={scheduleUserId} onChange={(event) => setScheduleUserId(event.target.value)} placeholder="Paste your users.id UUID" autoComplete="off"/><button className="submit-button" type="submit" disabled={scheduleBusy}>{scheduleBusy ? "Searching…" : <>Find my registrations <span aria-hidden="true">↗</span></>}</button></div><p className="field-hint">No login is used. The ID filters registrations in the database; it does not verify identity.</p></form>
          {scheduleMessage && <div className={`notice ${scheduleError ? "" : "success"}`} role="status">{scheduleMessage}</div>}
          <div className="schedule-list">{registrations.map((registration) => <article className="registration-row" key={registration.id}><div><h3>{registration.events?.title || `Event ${registration.event_id}`}</h3><p>Registered {registration.created_at ? new Date(registration.created_at).toLocaleDateString() : "Date not listed"} · {registration.id}</p></div><span className="registration-tag">Registered</span></article>)}</div>
        </main>
      )}

      {selectedEvent && details && (
        <Modal title={details.title || selectedEvent.title || "Event details"} kicker="EVENT DETAILS" onClose={modalClose} className="details-dialog">
          {details.error ? <p className="dialog-description">{details.error}</p> : <>
            <div className="details-body"><div className="detail-row"><span>Status</span><strong>{details.status || "Not listed"}</strong></div><div className="detail-row"><span>Capacity</span><strong>{details.capacity ?? "Not listed"}</strong></div><div className="detail-row"><span>Event ID</span><strong className="event-id">{details.id}</strong></div></div>
            <button className="submit-button" type="button" onClick={() => openRegistration(details)}>Reserve my spot <span aria-hidden="true">↗</span></button>
          </>}
        </Modal>
      )}
      {selectedEvent && !details && detailsLoading && (
        <Modal title="Loading event…" kicker="EVENT DETAILS" onClose={modalClose} className="details-dialog"><div className="details-body">Getting the latest event information.</div></Modal>
      )}
      {selectedEvent && details === null && !detailsLoading && (
        <Modal title="SAVE YOUR SPOT" kicker="REGISTRATION" description="Enter an existing user ID from your campus database to link this registration. There’s no sign-in or password." onClose={modalClose}>
          <form onSubmit={submitRegistration}>
            <label className="field-label" htmlFor="registration-user-id">Your user ID</label>
            <input id="registration-user-id" className="text-field" required value={registrationUserId} onChange={(event) => setRegistrationUserId(event.target.value)} placeholder="Paste your users.id UUID" autoComplete="off" />
            <p className="field-hint">This identifies the registration; it does not verify who you are.</p>
            <button className="submit-button" type="submit" disabled={registrationBusy}>{registrationBusy ? "Saving your spot…" : <>Reserve my spot <span aria-hidden="true">↗</span></>}</button>
            {registrationMessage && <div className={`form-feedback ${registrationSuccess ? "success" : "error"}`} role="status">{registrationMessage}</div>}
          </form>
        </Modal>
      )}
    </>
  );
}
