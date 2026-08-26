const jwt = require("jsonwebtoken");
const User = require("../models/User");

// protect middleware: verifies JWT on every protected request
// Usage: router.get("/me", protect, controller)
const protect = async (req, res, next) => {
  let token;

  // JWT is sent as: Authorization: Bearer <token>
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: "Not authorized, no token" });
  }

  try {
    // jwt.verify throws if token is expired or tampered with
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach the user document to req so controllers can use it
    // select("-password") ensures the hashed password is never attached
    req.user = await User.findById(decoded.id).select("-password");

    if (!req.user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Not authorized, token invalid" });
  }
};

module.exports = { protect };
