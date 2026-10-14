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


// --- Middleware ---
app.use(
  cors({
    // Accept both localhost (dev) and the deployed Vercel URL (prod)
    // CLIENT_URL can be a comma-separated list e.g. "https://x.vercel.app"
    origin: (origin, callback) => {
      const allowed = [
        "http://localhost:5173",
        "http://localhost:3000",
        process.env.CLIENT_URL,
      ].filter(Boolean);
      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin || allowed.includes(origin)) return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.json()); // Parse JSON request bodies

// --- Routes ---
// Auth routes
app.use("/api/auth", require("./src/routes/auth"));

// Game routes
app.use("/api/games", require("./src/routes/games"));

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
