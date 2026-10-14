require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const connectDB = require("./src/config/db");
const initSocket = require("./src/socket/index");

const app = express();

// --- Create HTTP server ---
const httpServer = http.createServer(app);

// --- Initialize Socket.IO ---
const io = initSocket(httpServer);

// --- Connect to MongoDB ---
connectDB();


const { isOriginAllowed } = require("./src/config/cors");

// --- Middleware ---
app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.json()); // Parse JSON request bodies

// --- Routes ---
const authRoutes = require("./src/routes/auth");
const gameRoutes = require("./src/routes/games");

// Auth routes (supports /api/auth, /auth, and accidental /api/api/auth)
app.use(["/api/auth", "/auth", "/api/api/auth"], authRoutes);

// Game routes (supports /api/games, /games, and /api/api/games)
app.use(["/api/games", "/games", "/api/api/games"], gameRoutes);

// --- Health check route ---
app.get(["/api/health", "/health", "/"], (req, res) => {
  res.json({ status: "ok", message: "Real-Time Chess API is running" });
});

// --- 404 handler ---
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// --- Global error handler ---
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

// --- Start server ---
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📌 Environment: ${process.env.NODE_ENV}`);
});

module.exports = { app, httpServer };
