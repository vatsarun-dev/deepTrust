const Complaint = require("../models/Complaint");

async function submitComplaint(req, res, next) {
  try {
    const { name, email, description } = req.body;

    if (!name || !email || !description) {
      res.status(400);
      throw new Error("Name, email, and description are required.");
    }

    const complaint = await Complaint.create({
      name,
      email,
      description,
    });

    res.status(201).json({
      success: true,
      message: "Complaint submitted successfully.",
      complaint,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  submitComplaint,
};
