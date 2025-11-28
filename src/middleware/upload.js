import multer from "multer";
import path from "node:path";
import fs from "node:fs";

const AVATAR_DIR = path.resolve("uploads/avatars");
fs.mkdirSync(AVATAR_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, AVATAR_DIR),
  filename: (req, file, cb) => {
    // tên file: <userId>-<timestamp><ext>
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${req.user?.id || "unknown"}-${Date.now()}${ext}`);
  }
});

function fileFilter(_req, file, cb) {
  // chỉ cho png/jpg/jpeg/webp
  const ok = ["image/png", "image/jpg", "image/jpeg", "image/webp"].includes(file.mimetype);
  cb(ok ? null : new Error("Invalid image type"), ok);
}

export const uploadAvatarMulter = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB
});


export const uploadAvatarMem = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    const ok = ["image/png","image/jpg","image/jpeg","image/webp"].includes(file.mimetype);
    cb(ok ? null : new Error("Invalid image type"), ok);
  }
});