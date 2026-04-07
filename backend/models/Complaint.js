const mongoose = require("mongoose");

const complaintSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    complaintType: {
      type: String,
      trim: true,
      default: "Fake News / Defamation",
    },
    platform: {
      type: String,
      trim: true,
      default: "Unknown",
    },
    severity: {
      type: String,
      trim: true,
      default: "Medium",
    },
    aiComplaint: {
      title: { type: String, trim: true, default: "" },
      body: { type: String, trim: true, default: "" },
      severity: { type: String, trim: true, default: "Medium" },
    },
    recommendations: [
      {
        type: String,
        trim: true,
      },
    ],
    evidence: [
      {
        sourceType: { type: String, trim: true, default: "file" },
        fileType: { type: String, trim: true, default: "" },
        fileName: { type: String, trim: true, default: "" },
        fileUrl: { type: String, trim: true, default: "" },
        link: { type: String, trim: true, default: "" },
        platform: { type: String, trim: true, default: "" },
        timestamp: { type: String, trim: true, default: "" },
        description: { type: String, trim: true, default: "" },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Complaint", complaintSchema);
