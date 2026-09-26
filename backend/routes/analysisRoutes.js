const express = require("express");
const multer = require("multer");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { analyzeContent } = require("../controllers/analysisController");
const { IMAGE_MIMES, VIDEO_MIMES } = require("../services/mediaStorageService");

const router = express.Router();
const temporaryDirectory = path.join(os.tmpdir(), "deeptrust-analysis");
fs.mkdirSync(temporaryDirectory, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: temporaryDirectory,
    filename(req, file, callback) {
      const extension = path.extname(file.originalname || "").toLowerCase().replace(/[^.a-z0-9]/g, "");
      callback(null, `${crypto.randomUUID()}${extension}`);
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    const mimetype = String(file.mimetype || "").toLowerCase();
    if (IMAGE_MIMES.has(mimetype) || VIDEO_MIMES.has(mimetype)) return callback(null, true);
    return callback(new Error("Unsupported media type. Upload a JPG, PNG, WebP, GIF, MP4, WebM, or MOV file."));
  },
});

router.post("/", upload.fields([{ name: "media", maxCount: 1 }, { name: "image", maxCount: 1 }]), analyzeContent);

module.exports = router;
