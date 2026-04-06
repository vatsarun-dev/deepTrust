const { analyzeImage } = require("../services/imageDetectionService");

async function checkImage(req, res, next) {
  try {
    if (!req.file) {
      res.status(400);
      throw new Error("Image file is required.");
    }

    const result = await analyzeImage(req.file);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  checkImage,
};
