const form = document.querySelector("#monitorForm");
const monitorsEl = document.querySelector("#monitors");
const termSelect = document.querySelector("#termCode");
const statusText = document.querySelector("#statusText");
const checkAllButton = document.querySelector("#checkAll");

let terms = [];

function setStatus(text) {
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

function statusClass(monitor) {
  if (monitor.lastResult?.open) {
    return "open";
  }

  if (monitor.lastSeenStatus) {
    return "closed";
  }

  return "";
}

function renderMonitors(monitors) {
  if (monitors.length === 0) {
    monitorsEl.innerHTML = '<div class="empty">No courses are being watched yet.</div>';
    return;
  }

  monitorsEl.innerHTML = monitors.map((monitor) => {
    const section = monitor.section ? ` ${escapeHtml(monitor.section)}` : "";
    const status = escapeHtml(monitor.lastSeenStatus || "Pending");
    const badgeClass = statusClass(monitor);
    const deliveries = monitor.lastResult?.deliveries?.length ? `Sent: ${escapeHtml(monitor.lastResult.deliveries.join(", "))}` : "";
    const error = monitor.lastResult?.error ? `Error: ${escapeHtml(monitor.lastResult.error)}` : "";

    return `
      <article class="monitor">
        <div>
          <div class="course">
            <span>${escapeHtml(monitor.subject)} ${escapeHtml(monitor.number)}${section}</span>
            <span class="badge ${badgeClass}">${status}</span>
          </div>
          <p class="meta">${escapeHtml(monitor.termLabel || monitor.termCode)}<br>Last checked: ${formatDate(monitor.lastCheckedAt)}${deliveries ? `<br>${deliveries}` : ""}${error ? `<br>${error}` : ""}</p>
        </div>
        <div class="actions">
          <button type="button" data-action="toggle" data-id="${monitor.id}">${monitor.active ? "Pause" : "Resume"}</button>
          <button class="danger" type="button" data-action="delete" data-id="${monitor.id}">Delete</button>
        </div>
      </article>
    `;
  }).join("");
}

async function loadTerms() {
  terms = await api("/api/terms");
  termSelect.innerHTML = terms.map((term) => (
    `<option value="${term.code}" ${term.selected ? "selected" : ""}>${term.label}</option>`
  )).join("");
}

async function loadMonitors() {
  const monitors = await api("/api/monitors");
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

  await api("/api/monitors", {
    method: "POST",
    body: JSON.stringify(data)
  });

  setStatus("Monitor added");
  await loadMonitors();
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
  const monitors = await api("/api/check", { method: "POST", body: "{}" });
  renderMonitors(monitors);
  setStatus("Check complete");
});

try {
  await loadTerms();
  await loadMonitors();
  setStatus("Ready");
} catch (error) {
  setStatus(error.message);
}
