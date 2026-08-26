const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Helper: sign a JWT for a given userId
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  });
};

// -------------------------------------------------------------------
// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
// -------------------------------------------------------------------
const register = async (req, res) => {
  const { username, email, password } = req.body;

  // Basic input validation
  if (!username || !email || !password) {
    return res.status(400).json({ success: false, message: "Please provide username, email and password" });
  }

  try {
    // Check if email or username is already taken
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      const field = existingUser.email === email ? "Email" : "Username";
      return res.status(400).json({ success: false, message: `${field} is already taken` });
    }

    // Create user — the pre-save hook in User.js handles password hashing
    const user = await User.create({ username, email, password });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    // Handle Mongoose validation errors nicely
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages[0] });
    }
    res.status(500).json({ success: false, message: "Server error during registration" });
  }
};

// -------------------------------------------------------------------
// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
// -------------------------------------------------------------------
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Please provide email and password" });
  }

  try {
    // .select("+password") is required because password has select:false in schema
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      // Generic message — don't reveal whether email exists or not
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error during login" });
  }
};

// -------------------------------------------------------------------
// @desc    Get currently logged-in user
// @route   GET /api/auth/me
// @access  Protected (requires valid JWT)
// -------------------------------------------------------------------
const getMe = async (req, res) => {
  // req.user is attached by the protect middleware
  res.json({
    success: true,
    user: {
      id: req.user._id,
      username: req.user.username,
      email: req.user.email,
      createdAt: req.user.createdAt,
    },
  });
};

module.exports = { register, login, getMe };
