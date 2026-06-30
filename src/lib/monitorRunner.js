import { searchCourse, summarizeMatch } from "./carletonClient.js";
import { notifyOpenSection } from "./notifier.js";
import { readMonitors, updateMonitor } from "./monitorStore.js";

function statusSummary(matches) {
  if (matches.length === 0) {
    return "No matching section found";
  }

  return matches.map((section) => `${section.section || "?"}: ${section.status}`).join(", ");
}

export async function checkMonitor(monitor) {
  const sections = await searchCourse({
    termCode: monitor.termCode,
    subject: monitor.subject,
    number: monitor.number
  });

  const summary = summarizeMatch(monitor, sections);
  const nextStatus = statusSummary(summary.matches);
  const openSection = summary.openMatches[0];
  let deliveries = [];

  if (openSection && monitor.lastNotifiedStatus !== openSection.status) {
    deliveries = await notifyOpenSection(monitor, openSection);
  }

  const updated = await updateMonitor(monitor.id, {
    lastSeenStatus: nextStatus,
    lastCheckedAt: summary.checkedAt,
    lastNotifiedStatus: openSection ? openSection.status : "",
    lastResult: {
      open: Boolean(openSection),
      matches: summary.matches,
      deliveries
    }
  });

  return updated;
}

export async function checkAllMonitors() {
  const monitors = await readMonitors();
  const results = [];

  for (const monitor of monitors.filter((item) => item.active)) {
    try {
      results.push(await checkMonitor(monitor));
    } catch (error) {
      results.push(await updateMonitor(monitor.id, {
        lastCheckedAt: new Date().toISOString(),
        lastResult: {
          open: false,
          error: error.message
        }
      }));
    }
  }

  return results;
}

export function startMonitorLoop(intervalSeconds) {
  const intervalMs = Math.max(60, intervalSeconds) * 1000;

  setInterval(() => {
    checkAllMonitors().catch((error) => {
      console.error("[monitor] Scheduled check failed:", error);
    });
  }, intervalMs);
}
