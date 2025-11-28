import { Router } from "express";
import multer from "multer";
import os from "os";
import path from "path";
import fs from "fs";
import { promisify } from "util";
import { execFile } from "child_process";
import { randomUUID } from "crypto";

const uploadDir = process.env.UPLOAD_DIR || path.resolve(process.cwd(), "uploads");
const dataDir = path.resolve(process.cwd(), "data");
const botConfigDir = path.resolve(process.cwd(), "bot-config");

const execFileAsync = promisify(execFile);

function ensureDir(p: string) {
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
}

function parseDatabaseUrl(url: string) {
  const fallback = { host: "db", port: "5432", database: "tattooadmin", user: "postgres", password: "postgres" };
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || fallback.host,
      port: parsed.port || fallback.port,
      database: parsed.pathname.replace(/^\//, "") || fallback.database,
      user: decodeURIComponent(parsed.username || fallback.user),
      password: decodeURIComponent(parsed.password || fallback.password),
    };
  } catch (e) {
    console.warn("[backup] failed to parse DATABASE_URL, using defaults", e);
    return fallback;
  }
}

async function runPgDump(target: string) {
  const cfg = parseDatabaseUrl(process.env.DATABASE_URL || "");
  const env = { ...process.env, PGPASSWORD: cfg.password };
  await execFileAsync(
    "pg_dump",
    [
      "--clean",
      "--if-exists",
      "--no-owner",
      "--no-privileges",
      "-h",
      cfg.host,
      "-p",
      cfg.port,
      "-U",
      cfg.user,
      "-d",
      cfg.database,
      "-f",
      target,
    ],
    { env },
  );
}

async function runPsqlRestore(dumpPath: string) {
  const cfg = parseDatabaseUrl(process.env.DATABASE_URL || "");
  const env = { ...process.env, PGPASSWORD: cfg.password };
  await execFileAsync(
    "psql",
    ["-h", cfg.host, "-p", cfg.port, "-U", cfg.user, "-d", cfg.database, "-f", dumpPath],
    { env },
  );
}

function copyDir(from: string, to: string) {
  fs.rmSync(to, { recursive: true, force: true });
  if (!fs.existsSync(from)) return;
  ensureDir(path.dirname(to));
  fs.cpSync(from, to, { recursive: true });
}

export function attachBackupRoutes(api: Router) {
  const upload = multer({ dest: os.tmpdir() });

  api.get("/backup/export", async (req, res, next) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tattoo-backup-"));
    const dumpPath = path.join(tmpDir, "db.sql");

    try {
      ensureDir(tmpDir);
      await runPgDump(dumpPath);

      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const archivePath = path.join(tmpDir, `tattoo-backup-${stamp}.zip`);

      if (fs.existsSync(dataDir)) fs.cpSync(dataDir, path.join(tmpDir, "data"), { recursive: true });
      if (fs.existsSync(uploadDir)) fs.cpSync(uploadDir, path.join(tmpDir, "uploads"), { recursive: true });
      if (fs.existsSync(botConfigDir)) fs.cpSync(botConfigDir, path.join(tmpDir, "bot-config"), { recursive: true });

      const entries = ["db.sql"];
      if (fs.existsSync(path.join(tmpDir, "data"))) entries.push("data");
      if (fs.existsSync(path.join(tmpDir, "uploads"))) entries.push("uploads");
      if (fs.existsSync(path.join(tmpDir, "bot-config"))) entries.push("bot-config");

      await execFileAsync("zip", ["-r", archivePath, ...entries], { cwd: tmpDir });

      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename=tattoo-backup-${stamp}.zip`);
      const stream = fs.createReadStream(archivePath);
      stream.on("error", next);
      res.on("finish", () => fs.rmSync(tmpDir, { recursive: true, force: true }));
      stream.pipe(res);
    } catch (error) {
      next(error);
    }
  });

  api.post("/backup/import", upload.single("file"), async (req, res, next) => {
    if (!req.file) {
      res.status(400).json({ message: "Файл архива не получен" });
      return;
    }

    const extractDir = fs.mkdtempSync(path.join(os.tmpdir(), `tattoo-restore-${randomUUID()}-`));
    try {
      await execFileAsync("unzip", ["-o", req.file.path, "-d", extractDir]);

      const dumpPath = path.join(extractDir, "db.sql");
      if (!fs.existsSync(dumpPath)) {
        res.status(400).json({ message: "В архиве нет db.sql" });
        return;
      }

      const extractedData = path.join(extractDir, "data");
      const extractedUploads = path.join(extractDir, "uploads");
      const extractedBotConfig = path.join(extractDir, "bot-config");

      if (fs.existsSync(extractedData)) copyDir(extractedData, dataDir);
      if (fs.existsSync(extractedUploads)) copyDir(extractedUploads, uploadDir);
      if (fs.existsSync(extractedBotConfig)) copyDir(extractedBotConfig, botConfigDir);

      await runPsqlRestore(dumpPath);

      res.json({ restored: true });
    } catch (error) {
      next(error);
    } finally {
      fs.rmSync(extractDir, { recursive: true, force: true });
      if (req.file?.path) fs.rmSync(req.file.path, { force: true });
    }
  });
}
