const mongoose = require("mongoose");

const reputationProfileSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    normalizedName: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    referenceImageName: {
      type: String,
      trim: true,
      default: "",
    },
    reputationScore: {
      type: Number,
      default: 50,
      min: 0,
      max: 100,
    },
    badge: {
      type: String,
      trim: true,
      default: "Neutral",
    },
    totalComplaints: {
      type: Number,
      default: 0,
      min: 0,
    },
    correctComplaints: {
      type: Number,
      default: 0,
      min: 0,
    },
    incorrectComplaints: {
      type: Number,
      default: 0,
      min: 0,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("ReputationProfile", reputationProfileSchema);
