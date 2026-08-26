const { nanoid } = require("nanoid");
const Game = require("../models/Game");

// -------------------------------------------------------------------
// @desc    Create a new game
// @route   POST /api/games/create
// @access  Protected
// -------------------------------------------------------------------
const createGame = async (req, res) => {
  try {
    // Generate a short, unique, human-shareable game ID (e.g. "V1StGXR8")
    const gameId = nanoid(8);

    const game = await Game.create({
      gameId,
      whitePlayer: req.user._id, // creator always plays white
      status: "WAITING",
    });

    res.status(201).json({
      success: true,
      gameId: game.gameId,
      message: "Game created. Share the game ID with your opponent.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to create game" });
  }
};

// -------------------------------------------------------------------
// @desc    Join an existing game
// @route   POST /api/games/join
// @access  Protected
// -------------------------------------------------------------------
const joinGame = async (req, res) => {
  const { gameId } = req.body;

  if (!gameId) {
    return res.status(400).json({ success: false, message: "Game ID is required" });
  }

  try {
    const game = await Game.findOne({ gameId });

    if (!game) {
      return res.status(404).json({ success: false, message: "Game not found" });
    }

    if (game.status !== "WAITING") {
      return res.status(400).json({ success: false, message: "Game is already full or completed" });
    }

    // Prevent creator from joining their own game as black
    if (game.whitePlayer.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: "You cannot join your own game" });
    }

    // Assign black player and activate the game
    game.blackPlayer = req.user._id;
    game.status = "ACTIVE";
    game.lastMoveAt = new Date(); // start the clock reference point
    await game.save();

    res.json({
      success: true,
      gameId: game.gameId,
      message: "Joined successfully. Game is now active.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to join game" });
  }
};

// -------------------------------------------------------------------
// @desc    Get a single game by gameId
// @route   GET /api/games/:gameId
// @access  Protected
// -------------------------------------------------------------------
const getGame = async (req, res) => {
  try {
    const game = await Game.findOne({ gameId: req.params.gameId })
      .populate("whitePlayer", "username")
      .populate("blackPlayer", "username")
      .populate("winner", "username");

    if (!game) {
      return res.status(404).json({ success: false, message: "Game not found" });
    }

    // Only the two players can view the game
    const isPlayer =
      game.whitePlayer?._id.toString() === req.user._id.toString() ||
      game.blackPlayer?._id.toString() === req.user._id.toString();

    if (!isPlayer) {
      return res.status(403).json({ success: false, message: "Not authorized to view this game" });
    }

    res.json({ success: true, game });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch game" });
  }
};

// -------------------------------------------------------------------
// @desc    Get current user's game history (completed games)
// @route   GET /api/games/history
// @access  Protected
// -------------------------------------------------------------------
const getHistory = async (req, res) => {
  try {
    const games = await Game.find({
      $or: [
        { whitePlayer: req.user._id },
        { blackPlayer: req.user._id },
      ],
      status: "COMPLETED",
    })
      .populate("whitePlayer", "username")
      .populate("blackPlayer", "username")
      .populate("winner", "username")
      .sort({ completedAt: -1 }) // newest first
      .limit(20)
      .select("-moves"); // exclude full move list for performance

    res.json({ success: true, games });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch history" });
  }
};

module.exports = { createGame, joinGame, getGame, getHistory };
