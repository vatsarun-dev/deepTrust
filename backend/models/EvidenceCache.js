const mongoose = require("mongoose");

const evidenceCacheSchema = new mongoose.Schema(
  {
    contentHash: { type: String, required: true, unique: true, index: true },
    documentId: { type: String, required: true },
    title: { type: String, default: "" },
    sourceName: { type: String, default: "" },
    url: { type: String, default: "" },
    publishedAt: { type: String, default: "" },
    sourceQuality: { type: String, default: "low" },
    retrievedAt: { type: Date, default: Date.now, index: true },
    text: { type: String, required: true },
    embedding: { type: [Number], default: [] },
  },
  { timestamps: true },
);

module.exports = mongoose.model("EvidenceCache", evidenceCacheSchema);
