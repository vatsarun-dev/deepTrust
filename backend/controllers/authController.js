const crypto = require("crypto");
const User = require("../models/User");

const PASSWORD_KEYLEN = 64;

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hashedPassword = crypto
    .scryptSync(String(password), salt, PASSWORD_KEYLEN)
    .toString("hex");

  return `${salt}:${hashedPassword}`;
}

function verifyPassword(password, passwordHash) {
  const [salt, storedHash] = String(passwordHash || "").split(":");

  if (!salt || !storedHash) {
    return false;
  }

  const hashedBuffer = crypto.scryptSync(String(password), salt, PASSWORD_KEYLEN);
  const storedBuffer = Buffer.from(storedHash, "hex");

  if (hashedBuffer.length !== storedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(hashedBuffer, storedBuffer);
}

function formatUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
  };
}

async function signup(req, res, next) {
  try {
    const name = String(req.body.name || "").trim();
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");

    if (!name || !email || !password) {
      res.status(400);
      throw new Error("Name, email, and password are required.");
    }

    if (password.length < 6) {
      res.status(400);
      throw new Error("Password must be at least 6 characters long.");
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      res.status(409);
      throw new Error("An account with this email already exists.");
    }

    const user = await User.create({
      name,
      email,
      passwordHash: hashPassword(password),
    });

    res.status(201).json({
      success: true,
      message: "Account created successfully.",
      user: formatUser(user),
    });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");

    if (!email || !password) {
      res.status(400);
      throw new Error("Email and password are required.");
    }

    const user = await User.findOne({ email });

    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401);
      throw new Error("Invalid email or password.");
    }

    res.status(200).json({
      success: true,
      message: "Login successful.",
      user: formatUser(user),
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  signup,
  login,
};
