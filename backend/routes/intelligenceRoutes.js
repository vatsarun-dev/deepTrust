const express = require("express");
const multer = require("multer");
const {
  getTrendingFakes,
  imageTrace,
  generateDefenseKit,
  reputationCheck,
} = require("../controllers/intelligenceController");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
});

router.get("/trending-fakes", getTrendingFakes);
router.post("/image-trace", upload.single("image"), imageTrace);
router.post("/defense-kit", generateDefenseKit);
router.post("/reputation-check", upload.single("image"), reputationCheck);

module.exports = router;
