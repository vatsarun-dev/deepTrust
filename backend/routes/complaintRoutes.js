const express = require("express");
const fs = require("fs");
const multer = require("multer");
const path = require("path");
const {
  submitComplaint,
  generateComplaintDraft,
  downloadComplaintPdf,
} = require("../controllers/complaintController");

const router = express.Router();
const complaintUploadDir = path.join(__dirname, "..", "uploads", "complaints");
fs.mkdirSync(complaintUploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, complaintUploadDir);
  },
  filename(req, file, cb) {
    const safeName = String(file.originalname || "evidence").replace(/\s+/g, "-").toLowerCase();
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024, files: 8 },
});

router.post("/generate", generateComplaintDraft);
router.post("/", upload.array("evidenceFiles", 8), submitComplaint);
router.get("/:id/pdf", downloadComplaintPdf);

module.exports = router;
