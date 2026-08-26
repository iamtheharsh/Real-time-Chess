const mongoose = require("mongoose");

// --- Sub-schema for individual moves ---
// Stored as an array inside the Game document
const moveSchema = new mongoose.Schema(
  {
    from: { type: String, required: true },    // e.g. "e2"
    to: { type: String, required: true },      // e.g. "e4"
    san: { type: String, required: true },     // Standard Algebraic Notation e.g. "e4", "Nf3"
    fen: { type: String, required: true },     // Board state AFTER this move
    player: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false } // Moves don't need their own _id, saves space
);

const gameSchema = new mongoose.Schema(
  {
    gameId: {
      type: String,
      required: true,
      unique: true,
      index: true, // Fast lookups by gameId
    },

    // --- Players ---
    // whitePlayer is always assigned at creation
    // blackPlayer is null until someone joins
    whitePlayer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    blackPlayer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // --- Game Lifecycle ---
    // WAITING: Created, waiting for opponent
    // ACTIVE:  Both players joined, game in progress
    // COMPLETED: Game over (by any means)
    status: {
      type: String,
      enum: ["WAITING", "ACTIVE", "COMPLETED"],
      default: "WAITING",
    },

    // --- Chess State ---
    // FEN string representing the current board position
    // Initialized to the standard starting position
    currentFEN: {
      type: String,
      default: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    },

    // Full move history — each entry is a moveSchema object
    moves: [moveSchema],

    // --- Result (populated when game ends) ---
    // winner/loser stores userId ObjectId, or null for a draw
    result: {
      type: String,
      enum: ["white", "black", "draw", null],
      default: null,
    },
    resultReason: {
      type: String,
      enum: [
        "checkmate",
        "stalemate",
        "timeout",
        "resign",
        "draw_agreement",
        "threefold_repetition",
        "insufficient_material",
        "fifty_move_rule",
        null,
      ],
      default: null,
    },
    winner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // --- Time Control: 10+10 ---
    // initialTime and increment are in SECONDS
    initialTime: { type: Number, default: 600 }, // 10 minutes
    increment: { type: Number, default: 10 },     // 10 seconds per move

    // Remaining time for each player in MILLISECONDS
    // Stored as ms for precision during server-side calculations
    whiteTime: { type: Number, default: 600000 }, // 10 min in ms
    blackTime: { type: Number, default: 600000 },

    // Tracks when the current player's clock started ticking
    // Used by the server to calculate elapsed time on each move
    lastMoveAt: { type: Date, default: null },

    completedAt: { type: Date, default: null },
  },
  {
    timestamps: true, // auto createdAt, updatedAt
  }
);

// --- Compound index for fetching a user's game history efficiently ---
// When we query: "find all completed games for userId"
// MongoDB can use this index instead of scanning all documents
gameSchema.index({ whitePlayer: 1, status: 1 });
gameSchema.index({ blackPlayer: 1, status: 1 });

module.exports = mongoose.model("Game", gameSchema);
