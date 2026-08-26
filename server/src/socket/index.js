const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { Chess } = require("chess.js");
const Game = require("../models/Game");

// In-memory store for active chess instances per game
// Map<gameId, Chess>  — recreated from DB FEN on reconnect
const activeGames = new Map();

const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      credentials: true,
    },
  });

  // ── Middleware: authenticate every socket connection via JWT ──
  // The client passes the token in socket({ auth: { token } })
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token provided"));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id; // attach userId to every socket
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`🔌 Socket connected: ${socket.id} (user: ${socket.userId})`);

    // ──────────────────────────────────────────────────────────────
    // join-game: player opens /game/:gameId
    // ──────────────────────────────────────────────────────────────
    socket.on("join-game", async ({ gameId }) => {
      try {
        const game = await Game.findOne({ gameId })
          .populate("whitePlayer", "username _id")
          .populate("blackPlayer", "username _id");

        if (!game) return socket.emit("error", { message: "Game not found" });

        // Verify this user is actually a player in this game
        const isWhite = game.whitePlayer?._id.toString() === socket.userId;
        const isBlack = game.blackPlayer?._id.toString() === socket.userId;
        if (!isWhite && !isBlack) {
          return socket.emit("error", { message: "You are not a player in this game" });
        }

        // Join the Socket.IO room — all events for this game are scoped here
        socket.join(gameId);
        socket.gameId = gameId;
        socket.color = isWhite ? "w" : "b";

        // Restore chess.js instance from stored FEN (handles reconnects)
        if (!activeGames.has(gameId) && game.status === "ACTIVE") {
          activeGames.set(gameId, new Chess(game.currentFEN));
        }

        // ── Reconnect clock recovery ──
        // Calculate how much time has elapsed since the last move so the
        // reconnecting client receives accurate clock values immediately.
        // The server is the authority — the client never trusts its own countdown.
        let currentWhiteTime = game.whiteTime;
        let currentBlackTime = game.blackTime;

        if (game.status === "ACTIVE" && game.lastMoveAt) {
          const elapsed = Date.now() - new Date(game.lastMoveAt).getTime();
          const chess = activeGames.get(gameId);
          if (chess) {
            if (chess.turn() === "w") {
              currentWhiteTime = Math.max(0, game.whiteTime - elapsed);
            } else {
              currentBlackTime = Math.max(0, game.blackTime - elapsed);
            }
          }
        }

        // Send full current state to the joining player
        socket.emit("game-state", {
          fen: game.currentFEN,
          moves: game.moves,
          status: game.status,
          color: socket.color,
          whitePlayer: game.whitePlayer?.username,
          blackPlayer: game.blackPlayer?.username,
          whiteTime: currentWhiteTime,
          blackTime: currentBlackTime,
          result: game.result,
          resultReason: game.resultReason,
        });

        // Notify the opponent that the other player has (re)joined
        socket.to(gameId).emit("opponent-joined", {
          username: isWhite ? game.whitePlayer?.username : game.blackPlayer?.username,
        });
      } catch (err) {
        console.error("join-game error:", err.message);
        socket.emit("error", { message: "Failed to join game room" });
      }
    });

    // ──────────────────────────────────────────────────────────────
    // make-move: player attempts a move
    // Server is the ONLY authority on whether a move is legal
    // ──────────────────────────────────────────────────────────────
    socket.on("make-move", async ({ gameId, from, to, promotion }) => {
      try {
        const game = await Game.findOne({ gameId });
        if (!game || game.status !== "ACTIVE") {
          return socket.emit("move-error", { message: "Game is not active" });
        }

        // Get (or recreate) the chess instance for this game
        let chess = activeGames.get(gameId);
        if (!chess) {
          chess = new Chess(game.currentFEN);
          activeGames.set(gameId, chess);
        }

        // Verify it is this player's turn before even calling chess.js
        if (chess.turn() !== socket.color) {
          return socket.emit("move-error", { message: "It's not your turn" });
        }

        // ── Server-authoritative clock: calculate elapsed time ──
        // lastMoveAt is set when the game becomes ACTIVE (when black joins)
        // and updated after every successful move.
        const now = Date.now();
        const elapsed = game.lastMoveAt
          ? now - new Date(game.lastMoveAt).getTime()
          : 0;

        // Check timeout BEFORE accepting the move.
        // If the moving player has run out of time, they lose — move is rejected.
        const movingPlayerTime = socket.color === "w" ? game.whiteTime : game.blackTime;
        if (elapsed > movingPlayerTime && game.moves.length > 0) {
          // Timeout — declare the opponent as winner
          const winnerColor = socket.color === "w" ? "black" : "white";
          const winnerId = winnerColor === "white" ? game.whitePlayer : game.blackPlayer;
          game.status = "COMPLETED";
          game.result = winnerColor;
          game.resultReason = "timeout";
          game.winner = winnerId;
          game.completedAt = new Date();
          if (socket.color === "w") game.whiteTime = 0;
          else game.blackTime = 0;
          await game.save();
          io.to(gameId).emit("game-over", { result: winnerColor, resultReason: "timeout", winnerId });
          activeGames.delete(gameId);
          return;
        }

        // Let chess.js validate the move — this is the source of truth
        // promotion defaults to queen ('q') which is correct 99% of the time
        const move = chess.move({ from, to, promotion: promotion || "q" });
        if (!move) {
          return socket.emit("move-error", { message: "Illegal move" });
        }

        // ── Update clocks ──
        // Deduct elapsed time from the moving player, then add the 10s increment.
        // The increment rewards making a move (standard chess clock rule).
        const INCREMENT_MS = game.increment * 1000; // 10s in ms
        if (socket.color === "w") {
          game.whiteTime = Math.max(0, game.whiteTime - elapsed) + INCREMENT_MS;
        } else {
          game.blackTime = Math.max(0, game.blackTime - elapsed) + INCREMENT_MS;
        }

        // Build the move record with SAN from chess.js
        const moveRecord = {
          from: move.from,
          to: move.to,
          san: move.san,
          fen: chess.fen(),
          player: socket.userId,
          timestamp: new Date(),
        };

        // Persist the new state to MongoDB
        game.currentFEN = chess.fen();
        game.moves.push(moveRecord);
        game.lastMoveAt = new Date(now); // record when this move was made

        // ── Check for game-over conditions via chess.js ──
        let gameOver = false;
        let result = null;
        let resultReason = null;

        if (chess.isGameOver()) {
          gameOver = true;
          game.status = "COMPLETED";
          game.completedAt = new Date();

          if (chess.isCheckmate()) {
            // The player who just moved wins
            result = socket.color === "w" ? "white" : "black";
            resultReason = "checkmate";
            game.winner = socket.userId;
          } else if (chess.isStalemate()) {
            result = "draw"; resultReason = "stalemate";
          } else if (chess.isThreefoldRepetition()) {
            result = "draw"; resultReason = "threefold_repetition";
          } else if (chess.isInsufficientMaterial()) {
            result = "draw"; resultReason = "insufficient_material";
          } else if (chess.isDraw()) {
            result = "draw"; resultReason = "fifty_move_rule";
          }
          game.result = result;
          game.resultReason = resultReason;
        }

        await game.save();

        // Broadcast the valid move to BOTH players in the room
        io.to(gameId).emit("move-made", {
          move: moveRecord,
          fen: chess.fen(),
          whiteTime: game.whiteTime,
          blackTime: game.blackTime,
        });

        if (gameOver) {
          io.to(gameId).emit("game-over", { result, resultReason, winnerId: game.winner || null });
          activeGames.delete(gameId);
        }
      } catch (err) {
        console.error("make-move error:", err.message);
        socket.emit("move-error", { message: "Server error processing move" });
      }
    });

    // ──────────────────────────────────────────────────────────────
    // resign
    // ──────────────────────────────────────────────────────────────
    socket.on("resign", async ({ gameId }) => {
      try {
        const game = await Game.findOne({ gameId });
        if (!game || game.status !== "ACTIVE") return;

        const winnerColor = socket.color === "w" ? "black" : "white";
        const winnerId = winnerColor === "white" ? game.whitePlayer : game.blackPlayer;

        game.status = "COMPLETED";
        game.result = winnerColor;
        game.resultReason = "resign";
        game.winner = winnerId;
        game.completedAt = new Date();
        await game.save();

        io.to(gameId).emit("game-over", { result: winnerColor, resultReason: "resign", winnerId });
        activeGames.delete(gameId);
      } catch (err) {
        socket.emit("error", { message: "Failed to resign" });
      }
    });

    // ──────────────────────────────────────────────────────────────
    // Draw offer/accept/decline
    // ──────────────────────────────────────────────────────────────
    socket.on("offer-draw", ({ gameId }) => {
      socket.to(gameId).emit("draw-offered");
    });

    socket.on("accept-draw", async ({ gameId }) => {
      try {
        const game = await Game.findOne({ gameId });
        if (!game || game.status !== "ACTIVE") return;

        game.status = "COMPLETED";
        game.result = "draw";
        game.resultReason = "draw_agreement";
        game.completedAt = new Date();
        await game.save();

        io.to(gameId).emit("game-over", { result: "draw", resultReason: "draw_agreement", winnerId: null });
        activeGames.delete(gameId);
      } catch {
        socket.emit("error", { message: "Failed to accept draw" });
      }
    });

    socket.on("decline-draw", ({ gameId }) => {
      socket.to(gameId).emit("draw-declined");
    });

    // ──────────────────────────────────────────────────────────────
    // Disconnect
    // ──────────────────────────────────────────────────────────────
    socket.on("disconnect", (reason) => {
      console.log(`🔌 Socket disconnected: ${socket.id} — ${reason}`);
      if (socket.gameId) {
        socket.to(socket.gameId).emit("opponent-disconnected");
      }
    });
  });

  return io;
};

module.exports = initSocket;
