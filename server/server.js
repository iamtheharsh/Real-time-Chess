require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const connectDB = require("./src/config/db");

const app = express();

// --- Create HTTP server ---
// We wrap Express in a raw HTTP server so Socket.IO can attach to it later (Phase 4)
const httpServer = http.createServer(app);

// --- Connect to MongoDB ---
connectDB();

// --- Middleware ---
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173", // Vite default port
    credentials: true,
  })
);
app.use(express.json()); // Parse JSON request bodies

// --- Routes ---
// Auth routes
app.use("/api/auth", require("./src/routes/auth"));

// Phase 3: Game routes will be added here
// app.use("/api/games", require("./src/routes/games"));

// --- Health check route ---
app.get("/api/health", (req, res) => {
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
