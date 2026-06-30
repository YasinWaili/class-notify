import express from "express";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { fetchTerms, searchCourse, summarizeMatch } from "./lib/carletonClient.js";
import { addMonitor, readMonitors, removeMonitor, updateMonitor } from "./lib/monitorStore.js";
import { checkAllMonitors, checkMonitor, startMonitorLoop } from "./lib/monitorRunner.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());
app.use(express.static(path.resolve(__dirname, "../public")));

app.get("/api/terms", async (_request, response, next) => {
  try {
    response.json(await fetchTerms());
  } catch (error) {
    next(error);
  }
});

app.get("/api/monitors", async (_request, response, next) => {
  try {
    response.json(await readMonitors());
  } catch (error) {
    next(error);
  }
});

app.post("/api/monitors", async (request, response, next) => {
  try {
    const monitor = await addMonitor(request.body);
    const checked = await checkMonitor(monitor);
    response.status(201).json(checked);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/monitors/:id", async (request, response, next) => {
  try {
    const monitor = await updateMonitor(request.params.id, request.body);

    if (!monitor) {
      response.status(404).json({ error: "Monitor not found." });
      return;
    }

    response.json(monitor);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/monitors/:id", async (request, response, next) => {
  try {
    const removed = await removeMonitor(request.params.id);
    response.status(removed ? 204 : 404).end();
  } catch (error) {
    next(error);
  }
});

app.post("/api/check", async (_request, response, next) => {
  try {
    response.json(await checkAllMonitors());
  } catch (error) {
    next(error);
  }
});

app.post("/api/probe", async (request, response, next) => {
  try {
    const sections = await searchCourse(request.body);
    response.json(summarizeMatch(request.body, sections));
  } catch (error) {
    next(error);
  }
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: error.message || "Unexpected server error." });
});

const server = http.createServer(app);

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${config.port} is already in use.`);
    console.error("Stop the other server, or start this app on another port with PowerShell:");
    console.error("$env:PORT=3001; npm start");
    process.exit(1);
  }

  throw error;
});

server.listen(config.port, () => {
  console.log(`Class Notify is running at http://localhost:${config.port}`);
  startMonitorLoop(config.pollIntervalSeconds);
});
