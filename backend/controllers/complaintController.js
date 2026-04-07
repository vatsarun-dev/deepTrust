const fs = require("fs/promises");
const Complaint = require("../models/Complaint");
const { isDatabaseReady } = require("../config/db");
const { buildComplaintDraft, classifyByKeywords } = require("../services/complaintAIService");
const {
  buildImpactScore,
  buildEmotionalRisk,
  buildComplaintPriority,
} = require("../services/intelligenceService");

function normalizeText(value) {
  return String(value || "").trim();
}

function escapePdfText(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function parseJsonField(value, fallback) {
  if (!value) return fallback;
  if (Array.isArray(value) || typeof value === "object") return value;

  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function flattenLines(text, lineWidth = 90) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > lineWidth) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }

  if (line) lines.push(line);
  return lines;
}

function buildSimplePdfBuffer(lines) {
  const safeLines = lines.map((line) => escapePdfText(line));
  const textCommands = safeLines
    .map((line, index) => `1 0 0 1 50 ${770 - index * 16} Tm (${line}) Tj`)
    .join("\n");

  const objects = [];
  objects.push("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj");
  objects.push("2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj");
  objects.push(
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj"
  );
  objects.push("4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj");

  const stream = `BT /F1 11 Tf 0 g\n${textCommands}\nET`;
  objects.push(`5 0 obj << /Length ${Buffer.byteLength(stream, "utf8")} >> stream\n${stream}\nendstream endobj`);

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${obj}\n`;
  }

  const xrefStart = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

function buildEvidenceList(req) {
  const files = Array.isArray(req.files) ? req.files : [];
  const links = parseJsonField(req.body.evidenceLinks, []);
  const evidenceMeta = parseJsonField(req.body.evidenceMeta, {});
  const platform = normalizeText(req.body.platform) || "Unknown";

  const fileEvidence = files.map((file, index) => {
    const meta = evidenceMeta?.files?.[index] || {};
    return {
      sourceType: "file",
      fileType: normalizeText(file.mimetype),
      fileName: normalizeText(file.originalname),
      fileUrl: `/uploads/complaints/${normalizeText(file.filename)}`,
      link: "",
      platform: normalizeText(meta.platform) || platform,
      timestamp: normalizeText(meta.timestamp) || new Date().toISOString(),
      description: normalizeText(meta.description) || "",
    };
  });

  const linkEvidence = Array.isArray(links)
    ? links
        .map((item, index) => {
          if (!item) return null;
          const normalizedLink = normalizeText(typeof item === "string" ? item : item.url);
          if (!normalizedLink) return null;
          const meta = evidenceMeta?.links?.[index] || item || {};
          return {
            sourceType: "link",
            fileType: "url",
            fileName: "",
            fileUrl: "",
            link: normalizedLink,
            platform: normalizeText(meta.platform) || platform,
            timestamp: normalizeText(meta.timestamp) || new Date().toISOString(),
            description: normalizeText(meta.description) || "",
          };
        })
        .filter(Boolean)
    : [];

  return [...fileEvidence, ...linkEvidence];
}

async function generateComplaintDraft(req, res, next) {
  try {
    const description = normalizeText(req.body.description);
    if (!description || description.length < 20) {
      res.status(400);
      throw new Error("Please provide a detailed description (at least 20 characters).");
    }

    const input = {
      issueType: normalizeText(req.body.issueType),
      description,
      platform: normalizeText(req.body.platform) || "Unknown",
      name: normalizeText(req.body.name),
      email: normalizeText(req.body.email),
      evidence: parseJsonField(req.body.evidencePreview, []),
    };

    const generated = await buildComplaintDraft(input);
    const impact = buildImpactScore(description);
    const emotional = buildEmotionalRisk(description);
    res.status(200).json({
      success: true,
      complaintType: generated.complaintType,
      aiComplaint: generated.draft,
      recommendedActions: generated.recommendedActions,
      impact,
      emotionalRisk: emotional.emotionalRisk,
      priority: buildComplaintPriority(emotional.emotionalRisk, impact),
    });
  } catch (error) {
    next(error);
  }
}

async function submitComplaint(req, res, next) {
  const uploadedFiles = Array.isArray(req.files) ? req.files : [];

  try {
    if (!isDatabaseReady()) {
      res.status(503);
      throw new Error("Database is temporarily unavailable. Complaint drafting still works, but complaint storage is offline right now.");
    }

    const name = normalizeText(req.body.name);
    const email = normalizeText(req.body.email);
    const description = normalizeText(req.body.description);
    const platform = normalizeText(req.body.platform) || "Unknown";
    const issueType = normalizeText(req.body.issueType);

    if (!name || !email || !description) {
      res.status(400);
      throw new Error("Name, email, and description are required.");
    }

    const evidence = buildEvidenceList(req);
    const impact = buildImpactScore(description);
    const emotional = buildEmotionalRisk(description);
    const priority = buildComplaintPriority(emotional.emotionalRisk, impact);

    const generated = await buildComplaintDraft({
      issueType,
      description,
      platform,
      name,
      email,
      evidence,
    });

    const complaint = await Complaint.create({
      name,
      email,
      description,
      complaintType: generated.complaintType || classifyByKeywords({ description, platform, issueType }),
      platform,
      severity: generated?.draft?.severity || "Medium",
      priority,
      emotionalRisk: emotional.emotionalRisk,
      aiComplaint: generated.draft,
      recommendations: generated.recommendedActions || [],
      evidence,
    });

    res.status(201).json({
      success: true,
      message: "Complaint submitted successfully.",
      complaint,
      aiComplaint: generated.draft,
      recommendedActions: generated.recommendedActions,
      impact,
      emotionalRisk: emotional.emotionalRisk,
      priority,
    });
  } catch (error) {
    // Cleanup files if save fails.
    await Promise.all(
      uploadedFiles.map(async (file) => {
        try {
          await fs.unlink(file.path);
        } catch {
          return null;
        }
        return null;
      })
    );
    next(error);
  }
}

async function downloadComplaintPdf(req, res, next) {
  try {
    if (!isDatabaseReady()) {
      res.status(503);
      throw new Error("Database is temporarily unavailable. Complaint PDF download is offline right now.");
    }

    const complaint = await Complaint.findById(req.params.id).lean();
    if (!complaint) {
      res.status(404);
      throw new Error("Complaint not found.");
    }

    const lines = [
      "DeepTrust Complaint Summary",
      `Generated At: ${new Date().toISOString()}`,
      "",
      `Name: ${complaint.name || "n/a"}`,
      `Email: ${complaint.email || "n/a"}`,
      `Type: ${complaint.complaintType || "n/a"}`,
      `Platform: ${complaint.platform || "n/a"}`,
      `Severity: ${complaint.severity || "n/a"}`,
      "",
      "Description:",
      ...flattenLines(complaint.description || "n/a"),
      "",
      "AI Draft Title:",
      ...flattenLines(complaint?.aiComplaint?.title || "n/a"),
      "",
      "AI Draft Body:",
      ...flattenLines(complaint?.aiComplaint?.body || "n/a"),
      "",
      "Recommended Actions:",
      ...(Array.isArray(complaint.recommendations) && complaint.recommendations.length
        ? complaint.recommendations.map((item, index) => `${index + 1}. ${item}`)
        : ["1. Preserve evidence and report through official channels."]),
      "",
      "Evidence:",
      ...(Array.isArray(complaint.evidence) && complaint.evidence.length
        ? complaint.evidence.map(
            (item, index) =>
              `${index + 1}. ${item.sourceType || "file"} | ${item.fileType || "n/a"} | ${
                item.link || item.fileName || "n/a"
              } | ${item.timestamp || "n/a"}`
          )
        : ["No evidence submitted."]),
    ];

    const pdfBuffer = buildSimplePdfBuffer(lines.slice(0, 42));
    const safeName = String(complaint._id);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=\"deeptrust-complaint-${safeName}.pdf\"`);
    res.status(200).send(pdfBuffer);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  submitComplaint,
  generateComplaintDraft,
  downloadComplaintPdf,
};
