import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

function serializeError(error) {
  if (!(error instanceof Error)) {
    return { message: String(error || "Unknown error") };
  }

  return {
    name: error.name,
    message: error.message,
    stack: error.stack
  };
}

async function writeLog(fileName, event) {
  const logDir = path.resolve(process.env.LOG_DIR || "logs");
  const record = {
    ts: new Date().toISOString(),
    pid: process.pid,
    ...event
  };

  const line = `${JSON.stringify(record)}\n`;
  try {
    await mkdir(logDir, { recursive: true });
    await appendFile(path.join(logDir, fileName), line, "utf8");
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      message: "Failed to write application log.",
      logFile: fileName,
      error: serializeError(error)
    }));
  }
}

export function logRequest(event) {
  console.log(JSON.stringify({ level: "info", event: "request", ...event }));
  void writeLog("request.log", { level: "info", event: "request", ...event });
}

export function logError(event) {
  const payload = {
    level: "error",
    event: "error",
    ...event,
    error: serializeError(event.error)
  };

  console.error(JSON.stringify(payload));
  void writeLog("error.log", payload);
}

export function logAiFailure(event) {
  const payload = {
    level: "warn",
    event: "ai_failure",
    ...event,
    error: serializeError(event.error)
  };

  console.warn(JSON.stringify(payload));
  void writeLog("ai-failures.log", payload);
}

export function logSlowRequest(event) {
  const payload = {
    level: "warn",
    event: "slow_request",
    ...event
  };

  console.warn(JSON.stringify(payload));
  void writeLog("slow-requests.log", payload);
}
