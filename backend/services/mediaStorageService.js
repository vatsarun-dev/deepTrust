const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const VIDEO_MIMES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

function mediaKind(mimetype) {
  const value = String(mimetype || "").toLowerCase();
  if (IMAGE_MIMES.has(value)) return "image";
  if (VIDEO_MIMES.has(value)) return "video";
  return null;
}

function typeFromSignature(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (buffer.subarray(0, 3).toString("hex") === "ffd8ff") return "image/jpeg";
  if (buffer.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") return "image/png";
  if (buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a") return "image/gif";
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (buffer.subarray(0, 4).toString("hex") === "1a45dfa3") return "video/webm";
  if (buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buffer.subarray(8, 12).toString("ascii").toLowerCase();
    return brand.includes("qt") ? "video/quicktime" : "video/mp4";
  }
  return null;
}

async function validateUploadedMedia(file) {
  if (!file?.path) throw new Error("Media upload is missing.");
  const declaredType = String(file.mimetype || "").toLowerCase();
  const kind = mediaKind(declaredType);
  if (!kind) throw new Error("Unsupported media type. Upload a JPG, PNG, WebP, GIF, MP4, WebM, or MOV file.");

  const handle = await fs.open(file.path, "r");
  let buffer;
  try {
    buffer = Buffer.alloc(32);
    await handle.read(buffer, 0, 32, 0);
  } finally {
    await handle.close();
  }
  const detectedType = typeFromSignature(buffer);
  if (!detectedType || mediaKind(detectedType) !== kind) {
    throw new Error("The media contents do not match the declared file type.");
  }
  return { kind, detectedType };
}

function hasImageKitConfiguration() {
  return Boolean(
    String(process.env.IMAGEKIT_PRIVATE_KEY || "").trim() &&
    String(process.env.IMAGEKIT_URL_ENDPOINT || "").trim(),
  );
}

async function uploadToImageKit(file, kind) {
  if (!hasImageKitConfiguration()) {
    return { url: null, storage: "not_configured", uploadError: "ImageKit is not configured." };
  }

  const form = new FormData();
  const extension = path.extname(file.originalname || "") || (kind === "video" ? ".mp4" : ".jpg");
  const safeName = `${crypto.randomUUID()}${extension.toLowerCase()}`;
  form.append("file", await fs.readFile(file.path), { filename: safeName, contentType: file.mimetype });
  form.append("fileName", safeName);
  form.append("folder", "/deeptrust-verifications");
  form.append("useUniqueFileName", "true");

  try {
    const privateKey = String(process.env.IMAGEKIT_PRIVATE_KEY || "").trim();
    const response = await axios.post("https://upload.imagekit.io/api/v1/files/upload", form, {
      headers: { ...form.getHeaders() },
      auth: { username: privateKey, password: "" },
      timeout: 45000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    return {
      url: response?.data?.url || null,
      fileId: response?.data?.fileId || null,
      storage: "imagekit",
      uploadError: null,
    };
  } catch (error) {
    console.warn(`ImageKit upload failed: ${error.message}`);
    return { url: null, storage: "upload_failed", uploadError: "ImageKit upload could not be completed." };
  }
}

module.exports = {
  IMAGE_MIMES,
  VIDEO_MIMES,
  mediaKind,
  validateUploadedMedia,
  uploadToImageKit,
};
