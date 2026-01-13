const fs = require("node:fs");
const path = require("node:path");

class FileLogger {
  constructor() {
    const execBase = (process.execPath || "").toLowerCase();
    this.baseDir = execBase.endsWith("\\node.exe")
      ? process.cwd()
      : path.dirname(process.execPath);
    this.logPath = path.join(this.baseDir, "app.log");

    this.handleUncaught = (err) => this.log("FATAL", "uncaughtException", err);
    this.handleUnhandled = (reason) =>
      this.log("FATAL", "unhandledRejection", reason);

    process.on("uncaughtException", this.handleUncaught);
    process.on("unhandledRejection", this.handleUnhandled);

    this.log("INFO", "process start", {
      argv: process.argv,
      cwd: process.cwd(),
      execPath: process.execPath,
      node: process.version,
      platform: process.platform,
    });
    this.log("INFO", "logPath", this.logPath);
  }

  safeToString(value) {
    if (value instanceof Error) {
      return value.stack || value.message || String(value);
    }
    if (typeof value === "string") return value;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  writeLine(line) {
    try {
      fs.appendFileSync(this.logPath, line + "\n", { encoding: "utf8" });
    } catch (e) {
      try {
        console.error("[logger] failed to write log file:", this.logPath, e);
      } catch {}
    }
  }

  log(level, message, extra) {
    const ts = new Date().toISOString();
    const parts = [`[${ts}]`, `[${level}]`, message];
    if (extra !== undefined) parts.push(this.safeToString(extra));
    this.writeLine(parts.join(" "));
  }

  // 선택: 리스너 해제용
  dispose() {
    try {
      process.off("uncaughtException", this.handleUncaught);
      process.off("unhandledRejection", this.handleUnhandled);
    } catch {}
  }
}

function createFileLogger() {
  const l = new FileLogger();
  return { baseDir: l.baseDir, logPath: l.logPath, log: l.log.bind(l) };
}

module.exports = { FileLogger, createFileLogger };
