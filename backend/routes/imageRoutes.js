const express = require("express");
const multer = require("multer");
const { checkImage } = require("../controllers/imageController");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const allowedMimes = new Set(["image/jpeg", "image/jpg", "image/png"]);
    if (!allowedMimes.has(String(file.mimetype || "").toLowerCase())) {
      cb(new Error("Only JPG and PNG images are allowed."));
      return;
    }
    cb(null, true);
  },
});

router.post("/image-check", upload.single("image"), checkImage);

module.exports = router;
