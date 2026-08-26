const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { createGame, joinGame, getGame, getHistory } = require("../controllers/gameController");

// All game routes require authentication
router.use(protect);

// POST /api/games/create
router.post("/create", createGame);

// POST /api/games/join
router.post("/join", joinGame);

// GET /api/games/history  — must be BEFORE /:gameId to avoid "history" being treated as a gameId
router.get("/history", getHistory);

// GET /api/games/:gameId
router.get("/:gameId", getGame);

module.exports = router;
