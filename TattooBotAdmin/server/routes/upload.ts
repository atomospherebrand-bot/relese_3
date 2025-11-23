import { Router } from "express";
import path from "path";
import { upload } from "../middleware/upload";

const UPLOAD_ROOT = process.env.UPLOAD_DIR || path.resolve(process.cwd(), "uploads");

const router = Router();

/**
 * POST /api/upload
 * multipart/form-data with "file"
 * -> { url: "/uploads/<file>" }
 */
router.post("/upload", upload.fields([{ name: "file", maxCount: 1 }, { name: "thumbnail", maxCount: 1 }]), (req, res) => {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  const file = Array.isArray(files?.file) ? files?.file[0] : undefined;
  const thumbnailFile = Array.isArray(files?.thumbnail) ? files?.thumbnail[0] : undefined;

  if (!file) {
    return res.status(400).json({ message: "Файл не получен (формат multipart/form-data, поле 'file')." });
  }

  const relativeMain = path
    .relative(UPLOAD_ROOT, file.path)
    .replace(/\\+/g, "/");
  const mediaType = file.mimetype?.startsWith("video/") ? "video" : "image";
  const response: Record<string, any> = {
    url: `/uploads/${relativeMain}`,
    mediaType,
  };

  if (thumbnailFile) {
    const relativeThumb = path
      .relative(UPLOAD_ROOT, thumbnailFile.path)
      .replace(/\\+/g, "/");
    response.thumbnail = `/uploads/${relativeThumb}`;
  }

  res.json(response);
});

export default router;
