import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");
const STORE_PATH = path.join(DATA_DIR, "monitors.json");

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, "[]\n", "utf8");
  }
}

export async function readMonitors() {
  await ensureStore();
  const raw = await fs.readFile(STORE_PATH, "utf8");
  return JSON.parse(raw);
}

export async function writeMonitors(monitors) {
  await ensureStore();
  await fs.writeFile(STORE_PATH, `${JSON.stringify(monitors, null, 2)}\n`, "utf8");
}

export async function addMonitor(input) {
  const monitors = await readMonitors();
  const now = new Date().toISOString();
  const monitor = {
    id: randomUUID(),
    termCode: String(input.termCode || "").trim(),
    termLabel: String(input.termLabel || "").trim(),
    subject: String(input.subject || "").trim().toUpperCase(),
    number: String(input.number || "").trim(),
    section: String(input.section || "").trim().toUpperCase(),
    notifyEmail: String(input.notifyEmail || "").trim(),
    notifyPhone: String(input.notifyPhone || "").trim(),
    active: true,
    createdAt: now,
    updatedAt: now,
    lastSeenStatus: "",
    lastCheckedAt: "",
    lastNotifiedStatus: "",
    lastResult: null
  };

  if (!monitor.termCode || !monitor.subject || !monitor.number) {
    throw new Error("Term, subject, and course number are required.");
  }

  monitors.push(monitor);
  await writeMonitors(monitors);
  return monitor;
}

export async function updateMonitor(id, patch) {
  const monitors = await readMonitors();
  const index = monitors.findIndex((monitor) => monitor.id === id);

  if (index === -1) {
    return null;
  }

  monitors[index] = {
    ...monitors[index],
    ...patch,
    updatedAt: new Date().toISOString()
  };

  await writeMonitors(monitors);
  return monitors[index];
}

export async function removeMonitor(id) {
  const monitors = await readMonitors();
  const next = monitors.filter((monitor) => monitor.id !== id);
  await writeMonitors(next);
  return next.length !== monitors.length;
}
