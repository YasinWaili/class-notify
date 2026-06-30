const form = document.querySelector("#monitorForm");
const monitorsEl = document.querySelector("#monitors");
const termSelect = document.querySelector("#termCode");
const statusText = document.querySelector("#statusText");
const checkAllButton = document.querySelector("#checkAll");

let terms = [];
let monitors = [];
let pollIntervalSeconds = 300;
let statusOverrideUntil = 0;

function setStatus(text, durationMs = 2500) {
  statusOverrideUntil = Date.now() + durationMs;
  statusText.textContent = text;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "content-type": "application/json"
    },
    ...options
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed with HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function formatDate(value) {
  if (!value) {
    return "Not checked yet";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function maskEmail(value) {
  const email = String(value || "");
  const [name, domain] = email.split("@");

  if (!name || !domain) {
    return email;
  }

  const visible = name.length <= 3 ? name : `${name.slice(0, 3)}...`;
  return `${visible}@${domain}`;
}

function maskPhone(value) {
  const phone = String(value || "");
  const digits = phone.replace(/\D/g, "");

  if (digits.length < 4) {
    return phone;
  }

  return `${phone.startsWith("+") ? "+" : ""}${digits.slice(0, 1)}...${digits.slice(-4)}`;
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function statusClass(monitor) {
  if (monitor.lastResult?.open) {
    return "open";
  }

  if (monitor.lastSeenStatus) {
    return "closed";
  }

  return "";
}

function contactPill(label, value, formatter, fallback) {
  const body = value ? escapeHtml(formatter(value)) : `<span class="muted">${fallback}</span>`;
  return `<span class="contact-pill"><b>${label}</b> ${body}</span>`;
}

function updateNextCheckText() {
  if (Date.now() < statusOverrideUntil) {
    return;
  }

  const activeChecked = monitors
    .filter((monitor) => monitor.active && monitor.lastCheckedAt)
    .map((monitor) => new Date(monitor.lastCheckedAt).getTime())
    .filter(Number.isFinite);

  if (activeChecked.length === 0) {
    statusText.textContent = "Ready";
    return;
  }

  const nextCheckAt = Math.min(...activeChecked) + pollIntervalSeconds * 1000;
  const remaining = nextCheckAt - Date.now();
  statusText.textContent = remaining <= 0 ? "Checking soon" : `Next check in about ${formatDuration(remaining)}`;
}

function renderMonitors(items) {
  if (items.length === 0) {
    monitorsEl.innerHTML = '<div class="empty">No courses are being watched yet.</div>';
    updateNextCheckText();
    return;
  }

  monitorsEl.innerHTML = items.map((monitor) => {
    const section = monitor.section ? ` ${escapeHtml(monitor.section)}` : "";
    const status = escapeHtml(monitor.lastSeenStatus || "Pending");
    const badgeClass = statusClass(monitor);
    const title = monitor.lastResult?.matches?.find((match) => match.title)?.title || "";
    const deliveries = monitor.lastResult?.deliveries?.length ? `Sent: ${escapeHtml(monitor.lastResult.deliveries.join(", "))}` : "";
    const error = monitor.lastResult?.error ? `Error: ${escapeHtml(monitor.lastResult.error)}` : "";
    const email = contactPill("Email", monitor.notifyEmail, maskEmail, "default email");
    const phone = contactPill("SMS", monitor.notifyPhone, maskPhone, "default phone");
    const openNote = monitor.lastResult?.open ? '<p class="open-note">Open now. Notification handled.</p>' : "";

    return `
      <article class="monitor ${monitor.lastResult?.open ? "available" : ""}">
        <div>
          <div class="course">
            <span>${escapeHtml(monitor.subject)} ${escapeHtml(monitor.number)}${section}</span>
            <span class="badge ${badgeClass}">${status}</span>
          </div>
          ${title ? `<p class="title">${escapeHtml(title)}</p>` : ""}
          <div class="contacts" aria-label="Notification contacts">
            ${email}
            ${phone}
          </div>
          ${openNote}
          <p class="meta">${escapeHtml(monitor.termLabel || monitor.termCode)}<br>Last checked: ${formatDate(monitor.lastCheckedAt)}${deliveries ? `<br>${deliveries}` : ""}${error ? `<br>${error}` : ""}</p>
        </div>
        <div class="actions">
          <button type="button" data-action="toggle" data-id="${monitor.id}">${monitor.active ? "Pause" : "Resume"}</button>
          <button class="danger" type="button" data-action="delete" data-id="${monitor.id}">Delete</button>
        </div>
      </article>
    `;
  }).join("");

  updateNextCheckText();
}

async function loadConfig() {
  const appConfig = await api("/api/config");
  pollIntervalSeconds = Number(appConfig.pollIntervalSeconds || pollIntervalSeconds);
}

async function loadTerms() {
  terms = await api("/api/terms");
  termSelect.innerHTML = terms.map((term) => (
    `<option value="${term.code}" ${term.selected ? "selected" : ""}>${term.label}</option>`
  )).join("");
}

async function loadMonitors() {
  monitors = await api("/api/monitors");
  renderMonitors(monitors);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("Adding monitor...");

  const data = Object.fromEntries(new FormData(form));
  const term = terms.find((item) => item.code === data.termCode);
  data.termLabel = term?.label || "";
  data.subject = data.subject.toUpperCase();
  data.section = data.section.toUpperCase();

  try {
    await api("/api/monitors", {
      method: "POST",
      body: JSON.stringify(data)
    });

    setStatus("Monitor added");
    form.reset();
    await loadMonitors();
  } catch (error) {
    setStatus(error.message, 5000);
  }
});

monitorsEl.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const { action, id } = button.dataset;
  setStatus(action === "delete" ? "Deleting..." : "Updating...");

  if (action === "delete") {
    await api(`/api/monitors/${id}`, { method: "DELETE" });
  } else {
    const active = button.textContent === "Resume";
    await api(`/api/monitors/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ active })
    });
  }

  setStatus("Ready");
  await loadMonitors();
});

checkAllButton.addEventListener("click", async () => {
  setStatus("Checking Carleton...");
  monitors = await api("/api/check", { method: "POST", body: "{}" });
  renderMonitors(monitors);
  setStatus("Check complete");
});

try {
  await loadConfig();
  await loadTerms();
  await loadMonitors();
  updateNextCheckText();
  setInterval(updateNextCheckText, 1000);
  setInterval(() => {
    loadMonitors().catch((error) => setStatus(error.message, 5000));
  }, 30000);
} catch (error) {
  setStatus(error.message);
}
