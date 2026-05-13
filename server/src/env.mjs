import { existsSync, readFileSync } from "node:fs";

export function loadEnvFiles() {
  for (const file of [
    "/etc/idol-mode/idol-mode-api.env",
    ".env.production",
    ".env.local",
    ".env",
    "../.env.local",
    "../.env"
  ]) {
    if (!existsSync(file)) continue;
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}
