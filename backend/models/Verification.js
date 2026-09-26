const mongoose = require("mongoose");

const verificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
    claim: { type: String, default: "", trim: true },
    claimVerification: { type: mongoose.Schema.Types.Mixed, required: true },
    media: { type: mongoose.Schema.Types.Mixed, default: null },
    mediaVerification: { type: mongoose.Schema.Types.Mixed, default: null },
    claimMediaConsistency: { type: mongoose.Schema.Types.Mixed, default: null },
    evidence: { type: [mongoose.Schema.Types.Mixed], default: [] },
    explanation: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Verification", verificationSchema);
