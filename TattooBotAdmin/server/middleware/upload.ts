import path from "path";
import fs from "fs";
import multer from "multer";

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve(process.cwd(), "uploads");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const querySubdir = (() => {
      const value = (req.query?.subdir ?? req.body?.subdir) as unknown;
      if (typeof value === "string") return value;
      if (Array.isArray(value)) return value[0];
      return undefined;
    })();

    const sanitized = querySubdir
      ? String(querySubdir)
          .replace(/\.\.+/g, "")
          .replace(/[^a-zA-Z0-9/_-]+/g, "-")
          .replace(/^\/+/, "")
          .replace(/\/+/g, "/")
      : "";

    const targetDir = sanitized ? path.join(UPLOAD_DIR, sanitized) : UPLOAD_DIR;
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    cb(null, targetDir);
  },
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const safe = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const ext = path.extname(safe);
    const base = path.basename(safe, ext);
    cb(null, `${base}-${ts}${ext || ".bin"}`);
  },
});

export const upload = multer({ storage });
