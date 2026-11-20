const API_BASE = "";
const eventsGrid = document.querySelector("#events-grid");
const notice = document.querySelector("#notice");
const searchInput = document.querySelector("#search-input");
const resultCount = document.querySelector("#result-count");
const heroCount = document.querySelector("#hero-count");
const registrationDialog = document.querySelector("#registration-dialog");
const detailsDialog = document.querySelector("#details-dialog");

let events = [];
let activeFilter = "all";
let selectedEvent = null;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function showNotice(message, kind = "error") {
  notice.textContent = message;
  notice.className = `notice ${kind === "success" ? "success" : ""}`;
  notice.hidden = false;
}

function statusMatches(event) {
  const status = String(event.status || "").toLowerCase();
  if (activeFilter === "all") return true;
  if (activeFilter === "upcoming") return status === "upcoming";
  if (activeFilter === "open") return ["open", "active", "upcoming"].includes(status);
  return true;
}

function renderEvents() {
  const query = searchInput.value.trim().toLowerCase();
  const visible = events.filter((event) => {
    const matchesSearch = `${event.title || ""} ${event.status || ""}`.toLowerCase().includes(query);
    return matchesSearch && statusMatches(event);
  });
  resultCount.textContent = `${visible.length} ${visible.length === 1 ? "event" : "events"}`;

  if (!visible.length) {
    eventsGrid.innerHTML = '<div class="empty-state"><div class="empty-icon">✳</div><h3>No events in this orbit</h3><p>Try another filter, or clear your search to see everything.</p></div>';
    return;
  }

  const accents = ["#8b5cf6", "#f08a4d", "#4d70d9", "#ca65a8", "#39a98e"];
  const glyphs = ["✳", "↗", "✦", "◈", "✷"];
  eventsGrid.innerHTML = visible.map((event, index) => {
    const status = event.status || "Open";
    const capacity = Number(event.capacity);
    const hasCapacity = Number.isFinite(capacity) && capacity > 0;
    return `<article class="event-card" style="--card-accent:${accents[index % accents.length]}">
      <div class="card-top"><span class="event-category"><span class="category-icon">${glyphs[index % glyphs.length]}</span> CAMPUS EVENT</span><span class="status-pill">${escapeHtml(status)}</span></div>
      <h3 class="event-title">${escapeHtml(event.title || "Untitled event")}</h3>
      <span class="event-id">${escapeHtml(event.id)}</span>
      <div class="event-meta"><span class="capacity-icon">◉</span><span>${hasCapacity ? `Capacity: ${capacity}` : "Capacity not listed"}</span></div>
      <div class="card-actions"><span class="capacity-label">${hasCapacity ? `<strong>${capacity}</strong> total capacity` : "Event details"}</span>
        <div class="event-actions"><button class="details-button" data-details="${escapeHtml(event.id)}" type="button">Details</button><button class="register-button" data-register="${escapeHtml(event.id)}" type="button">Join event ↗</button></div>
      </div>
    </article>`;
  }).join("");
}

async function loadEvents() {
  eventsGrid.innerHTML = '<div class="empty-state"><div class="empty-icon">✳</div><h3>Finding your next thing…</h3><p>Connecting to the campus event feed.</p></div>';
  notice.hidden = true;
  try {
    const response = await fetch(`${API_BASE}/api/events`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Could not load events (${response.status}).`);
    if (!Array.isArray(data)) throw new Error("The events endpoint returned an unexpected response.");
    events = data;
    heroCount.textContent = `${events.length} events on the calendar`;
    renderEvents();
  } catch (error) {
    eventsGrid.innerHTML = '<div class="empty-state"><div class="empty-icon">!</div><h3>Could not load the event feed</h3><p>Check the connection and try refreshing.</p></div>';
    heroCount.textContent = "Campus feed unavailable";
    showNotice(`${error.message} If this continues, check the backend deployment and database permissions.`);
  }
}

function openRegistration(event) {
  selectedEvent = event;
  document.querySelector("#dialog-event-title").textContent = event.title || "Join the event";
  document.querySelector("#dialog-event-id").value = event.id;
  document.querySelector("#registration-feedback").textContent = "";
  document.querySelector("#registration-feedback").className = "form-feedback";
  registrationDialog.showModal();
}

async function openDetails(eventId) {
  const title = document.querySelector("#details-title");
  const body = document.querySelector("#details-body");
  title.textContent = "Loading event…";
  body.innerHTML = "";
  selectedEvent = events.find((event) => event.id === eventId) || null;
  document.querySelector("#details-register").disabled = !selectedEvent;
  detailsDialog.showModal();
  try {
    const response = await fetch(`${API_BASE}/api/events/${encodeURIComponent(eventId)}`);
    const event = await response.json();
    if (!response.ok) throw new Error(event.error || "Could not load event details.");
    selectedEvent = event;
    title.textContent = event.title || "Event details";
    body.innerHTML = `<div class="detail-row"><span>Status</span><strong>${escapeHtml(event.status || "Not listed")}</strong></div><div class="detail-row"><span>Capacity</span><strong>${event.capacity == null ? "Not listed" : escapeHtml(event.capacity)}</strong></div><div class="detail-row"><span>Event ID</span><strong class="event-id">${escapeHtml(event.id)}</strong></div>`;
    document.querySelector("#details-register").disabled = false;
  } catch (error) {
    title.textContent = "Details unavailable";
    body.textContent = error.message;
  }
}

eventsGrid.addEventListener("click", (event) => {
  const registerButton = event.target.closest("[data-register]");
  const detailsButton = event.target.closest("[data-details]");
  if (registerButton) {
    const item = events.find((entry) => entry.id === registerButton.dataset.register);
    if (item) openRegistration(item);
  }
  if (detailsButton) openDetails(detailsButton.dataset.details);
});

document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));
document.querySelector("#details-register").addEventListener("click", () => {
  if (selectedEvent) {
    detailsDialog.close();
    openRegistration(selectedEvent);
  }
});
document.querySelector("#refresh-button").addEventListener("click", loadEvents);
searchInput.addEventListener("input", renderEvents);
document.querySelectorAll(".filter-chip").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll(".filter-chip").forEach((chip) => chip.classList.toggle("selected", chip === button));
  activeFilter = button.dataset.filter;
  renderEvents();
}));

document.querySelector("#registration-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const feedback = document.querySelector("#registration-feedback");
  const button = form.querySelector(".submit-button");
  const userId = document.querySelector("#user-id-input").value.trim();
  const eventId = document.querySelector("#dialog-event-id").value;
  feedback.className = "form-feedback";
  feedback.textContent = "Saving your spot…";
  button.disabled = true;
  try {
    const response = await fetch(`${API_BASE}/api/registrations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, event_id: eventId }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Registration failed (${response.status}).`);
    feedback.className = "form-feedback success";
    feedback.textContent = "You’re on the list! Your registration is saved.";
    form.reset();
    setTimeout(() => registrationDialog.close(), 1400);
  } catch (error) {
    feedback.className = "form-feedback error";
    feedback.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

document.querySelectorAll(".nav-link").forEach((button) => button.addEventListener("click", () => {
  const showSchedule = button.dataset.page === "schedule";
  document.querySelector("#explore").hidden = showSchedule;
  document.querySelector("#schedule-page").hidden = !showSchedule;
  document.querySelectorAll(".nav-link").forEach((link) => link.classList.toggle("active", link === button));
}));

document.querySelector("#schedule-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const feedback = document.querySelector("#schedule-feedback");
  const list = document.querySelector("#schedule-list");
  const userId = document.querySelector("#schedule-user-id").value.trim();
  feedback.hidden = false;
  feedback.className = "notice";
  feedback.textContent = "Loading registrations…";
  list.innerHTML = "";
  try {
    const response = await fetch(`${API_BASE}/api/me/registrations`, { headers: { "X-User-Id": userId } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Could not load registrations (${response.status}).`);
    feedback.className = "notice success";
    feedback.textContent = `${data.length} ${data.length === 1 ? "registration" : "registrations"} found.`;
    if (!data.length) {
      list.innerHTML = '<div class="empty-state"><div class="empty-icon">✳</div><h3>Your schedule is clear</h3><p>Explore events and reserve your first spot.</p></div>';
      return;
    }
    list.innerHTML = data.map((registration) => {
      const title = registration.events?.title || `Event ${registration.event_id}`;
      const created = registration.created_at ? new Date(registration.created_at).toLocaleDateString() : "Date not listed";
      return `<article class="registration-row"><div><h3>${escapeHtml(title)}</h3><p>Registered ${escapeHtml(created)} · ${escapeHtml(registration.id)}</p></div><span class="registration-tag">Registered</span></article>`;
    }).join("");
  } catch (error) {
    feedback.className = "notice";
    feedback.textContent = error.message;
  }
});

loadEvents();
