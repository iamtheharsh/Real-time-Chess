const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { Chess } = require("chess.js");
const Game = require("../models/Game");
const { isOriginAllowed } = require("../config/cors");

// ─────────────────────────────────────────────────────────────────────────────
// In-memory store: keeps one chess.js instance per active game
// Why? chess.js is a library that tracks the board state in memory.
// We can't store it in MongoDB (it's a class instance, not plain data).
// So we keep it in a Map: gameId → Chess instance
// If the server restarts, we recreate it from the saved FEN in MongoDB.
// ─────────────────────────────────────────────────────────────────────────────
const activeGames = new Map();

// ─────────────────────────────────────────────────────────────────────────────
// initSocket(httpServer)
// Sets up the entire Socket.IO real-time system.
// Called once from server.js at startup.
// Returns the 'io' instance (the Socket.IO server).
// ─────────────────────────────────────────────────────────────────────────────
const initSocket = (httpServer) => {
  // Attach Socket.IO to the raw HTTP server (not Express)
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (isOriginAllowed(origin)) return callback(null, true);
        callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
    },
  });

  // ──────────────────────────────────────────────────────────────
  // MIDDLEWARE: Authenticate every socket connection via JWT
  //
  // Before any socket is allowed to connect, we verify their JWT.
  // The React client passes the token when connecting:
  //   socket = io(URL, { auth: { token: localStorage.getItem('token') } })
  //
  // If the token is valid, we attach socket.userId so we always
  // know which user owns this socket — no need to pass userId with every event.
  // ──────────────────────────────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token provided"));
    try {
      // jwt.verify checks the signature AND the expiry
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id; // attach to socket for later use
      next(); // allow the connection
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  // ──────────────────────────────────────────────────────────────
  // connection: fires when a new socket successfully connects
  // ──────────────────────────────────────────────────────────────
  io.on("connection", (socket) => {
    console.log(`🔌 Socket connected: ${socket.id} (user: ${socket.userId})`);

    // ──────────────────────────────────────────────────────────────
    // EVENT: join-game
    //
    // Fires when a player navigates to /game/:gameId
    // This is the most complex event handler — it does:
    //   1. Verify the user is a player in this game
    //   2. Auto-assign Black seat if game is still waiting
    //   3. Add this socket to the game's Socket.IO "room"
    //   4. Send full current game state back to this player
    //   5. Notify the other player that someone joined
    // ──────────────────────────────────────────────────────────────
    socket.on("join-game", async ({ gameId }) => {
      try {
        // Load the game with player usernames populated
        // .populate("whitePlayer", "username _id") replaces the ObjectId
        // reference with the actual { _id, username } from the User collection
        const game = await Game.findOne({ gameId })
          .populate("whitePlayer", "username _id")
          .populate("blackPlayer", "username _id");

        if (!game) return socket.emit("error", { message: "Game not found" });

        // Determine which color this user is playing
        let isWhite = game.whitePlayer?._id.toString() === socket.userId;
        let isBlack = game.blackPlayer?._id.toString() === socket.userId;

        // Auto-assign Black if the seat is empty and game is waiting
        // This can happen if the join REST call already set them, or as a fallback
        if (!isWhite && !isBlack && game.status === "WAITING" && !game.blackPlayer) {
          game.blackPlayer = socket.userId;
          game.status = "ACTIVE";
          game.lastMoveAt = new Date(); // start the clock when game becomes active
          await game.save();
          await game.populate("blackPlayer", "username _id");
          isBlack = true;
        }

        // Reject if this user is neither player (spectators not supported)
        if (!isWhite && !isBlack) {
          return socket.emit("error", { message: "You are not a player in this game" });
        }

        // socket.join(gameId) places this socket into a "room"
        // Rooms are private channels: io.to(gameId).emit() only reaches
        // sockets that have joined this room
        socket.join(gameId);
        socket.gameId = gameId;     // store on socket so disconnect handler can use it
        socket.color = isWhite ? "w" : "b"; // 'w' or 'b' — used for move validation

        // Restore the chess.js instance from the saved FEN
        // This handles reconnect: if the player refreshes, we rebuild the game state
        if (!activeGames.has(gameId) && game.status === "ACTIVE") {
          activeGames.set(gameId, new Chess(game.currentFEN));
        }

        // ── Clock Recovery ──
        // We can't just send the stored whiteTime/blackTime from MongoDB
        // because time has been ticking since the last move was saved.
        // We calculate how much time has passed and compensate.
        let currentWhiteTime = game.whiteTime;
        let currentBlackTime = game.blackTime;

        if (game.status === "ACTIVE" && game.lastMoveAt) {
          // How many ms have elapsed since the last move?
          const elapsed = Date.now() - new Date(game.lastMoveAt).getTime();
          const chess = activeGames.get(gameId);
          if (chess) {
            // The player whose turn it is has been losing time
            if (chess.turn() === "w") {
              currentWhiteTime = Math.max(0, game.whiteTime - elapsed);
            } else {
              currentBlackTime = Math.max(0, game.blackTime - elapsed);
            }
          }
        }

        // Send the complete game snapshot to THIS player only (not the room)
        // The client uses this to set up the board, clocks, and color
        socket.emit("game-state", {
          fen: game.currentFEN,       // current board position
          moves: game.moves,          // full move history (for the sidebar)
          status: game.status,        // WAITING / ACTIVE / COMPLETED
          color: socket.color,        // THIS player's color
          whitePlayer: game.whitePlayer?.username,
          blackPlayer: game.blackPlayer?.username,
          whiteTime: currentWhiteTime,
          blackTime: currentBlackTime,
          result: game.result,
          resultReason: game.resultReason,
        });

        // Notify EVERYONE ELSE in the room (the opponent) that this player joined
        // socket.to(gameId) = everyone in the room EXCEPT this socket
        // io.to(gameId) = everyone in the room INCLUDING this socket
        socket.to(gameId).emit("opponent-joined", {
          username: isWhite ? game.whitePlayer?.username : game.blackPlayer?.username,
          status: game.status,
          whitePlayer: game.whitePlayer?.username,
          blackPlayer: game.blackPlayer?.username,
        });
      } catch (err) {
        console.error("join-game error:", err.message);
        socket.emit("error", { message: "Failed to join game room" });
      }
    });

    // ──────────────────────────────────────────────────────────────
    // EVENT: make-move
    //
    // Fires when a player makes a move (drag-drop or click-to-move).
    // The server is the ONLY authority on legality.
    // Flow:
    //   1. Validate it's the right player's turn
    //   2. Check for timeout
    //   3. Ask chess.js if the move is legal
    //   4. Update clocks
    //   5. Persist to MongoDB
    //   6. Broadcast to both players
    //   7. If game over, emit game-over and clean up
    // ──────────────────────────────────────────────────────────────
    socket.on("make-move", async ({ gameId, from, to, promotion }) => {
      try {
        const game = await Game.findOne({ gameId });
        if (!game || game.status !== "ACTIVE") {
          return socket.emit("move-error", { message: "Game is not active" });
        }

        // Get the chess.js instance, or recreate it from saved FEN
        let chess = activeGames.get(gameId);
        if (!chess) {
          chess = new Chess(game.currentFEN);
          activeGames.set(gameId, chess);
        }

        // Verify this player's color matches whose turn it is
        // chess.turn() returns 'w' or 'b'
        if (chess.turn() !== socket.color) {
          return socket.emit("move-error", { message: "It's not your turn" });
        }

        // ── Server-side clock: calculate elapsed time ──
        // lastMoveAt is set when the game started and after every move
        const now = Date.now();
        const elapsed = game.lastMoveAt
          ? now - new Date(game.lastMoveAt).getTime()
          : 0;

        // Timeout check: if this player's time has run out, they lose
        const movingPlayerTime = socket.color === "w" ? game.whiteTime : game.blackTime;
        if (elapsed > movingPlayerTime && game.moves.length > 0) {
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
          // Broadcast game-over to both players in the room
          io.to(gameId).emit("game-over", { result: winnerColor, resultReason: "timeout", winnerId });
          activeGames.delete(gameId); // free memory
          return;
        }

        // chess.move() validates legality and returns the move object if valid
        // or null if the move is illegal
        // promotion: what piece the pawn promotes to ('q'=queen, default)
        const move = chess.move({ from, to, promotion: promotion || "q" });
        if (!move) {
          // Illegal move — send error only to this player (not the opponent)
          return socket.emit("move-error", { message: "Illegal move" });
        }

        // ── Update clocks ──
        // Standard chess clock rule: deduct elapsed time, then add the increment
        // INCREMENT_MS = 10 seconds (in milliseconds)
        const INCREMENT_MS = game.increment * 1000;
        if (socket.color === "w") {
          game.whiteTime = Math.max(0, game.whiteTime - elapsed) + INCREMENT_MS;
        } else {
          game.blackTime = Math.max(0, game.blackTime - elapsed) + INCREMENT_MS;
        }

        // Build the move record to save in MongoDB
        // move.san = Standard Algebraic Notation (e.g. "Nf3", "e4", "O-O" for castling)
        const moveRecord = {
          from: move.from,
          to: move.to,
          san: move.san,          // human-readable notation
          fen: chess.fen(),       // board state AFTER this move
          player: socket.userId,
          timestamp: new Date(),
        };

        // Persist updated state to MongoDB
        game.currentFEN = chess.fen();
        game.moves.push(moveRecord);
        game.lastMoveAt = new Date(now); // reset the clock timestamp

        // ── Check all game-over conditions via chess.js ──
        // chess.js handles: checkmate, stalemate, threefold repetition,
        // insufficient material, fifty-move rule
        let gameOver = false;
        let result = null;
        let resultReason = null;

        if (chess.isGameOver()) {
          gameOver = true;
          game.status = "COMPLETED";
          game.completedAt = new Date();

          if (chess.isCheckmate()) {
            // The player who just moved is the winner
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

        await game.save(); // persist everything to MongoDB

        // Broadcast the valid move to BOTH players in this game's room
        // io.to(gameId) = all sockets in the room (both players)
        io.to(gameId).emit("move-made", {
          move: moveRecord,
          fen: chess.fen(),
          whiteTime: game.whiteTime,
          blackTime: game.blackTime,
        });

        // If the game ended, send the result and clean up
        if (gameOver) {
          io.to(gameId).emit("game-over", { result, resultReason, winnerId: game.winner || null });
          activeGames.delete(gameId); // remove from memory, game is done
        }
      } catch (err) {
        console.error("make-move error:", err.message);
        socket.emit("move-error", { message: "Server error processing move" });
      }
    });

    // ──────────────────────────────────────────────────────────────
    // EVENT: resign
    // The resigning player loses. Opponent wins.
    // ──────────────────────────────────────────────────────────────
    socket.on("resign", async ({ gameId }) => {
      try {
        const game = await Game.findOne({ gameId });
        if (!game || game.status !== "ACTIVE") return;

        // The player who resigned loses — opponent wins
        const winnerColor = socket.color === "w" ? "black" : "white";
        const winnerId = winnerColor === "white" ? game.whitePlayer : game.blackPlayer;

        game.status = "COMPLETED";
        game.result = winnerColor;
        game.resultReason = "resign";
        game.winner = winnerId;
        game.completedAt = new Date();
        await game.save();

        // Broadcast game-over to both players
        io.to(gameId).emit("game-over", { result: winnerColor, resultReason: "resign", winnerId });
        activeGames.delete(gameId);
      } catch (err) {
        socket.emit("error", { message: "Failed to resign" });
      }
    });

    // ──────────────────────────────────────────────────────────────
    // EVENT: offer-draw
    // Just forwards the draw offer to the opponent.
    // The server doesn't store this — it's transient.
    // ──────────────────────────────────────────────────────────────
    socket.on("offer-draw", ({ gameId }) => {
      // socket.to(gameId) = everyone in the room EXCEPT the sender
      socket.to(gameId).emit("draw-offered");
    });

    // ──────────────────────────────────────────────────────────────
    // EVENT: accept-draw
    // Both players agreed to a draw. Save result and end game.
    // ──────────────────────────────────────────────────────────────
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

    // ──────────────────────────────────────────────────────────────
    // EVENT: decline-draw
    // Just tells the opponent their draw offer was declined.
    // ──────────────────────────────────────────────────────────────
    socket.on("decline-draw", ({ gameId }) => {
      socket.to(gameId).emit("draw-declined");
    });

    // ──────────────────────────────────────────────────────────────
    // EVENT: send-message (in-game chat)
    //
    // Forwards the chat message to the opponent ONLY.
    // Intentionally NOT saved to MongoDB — messages are ephemeral
    // and disappear when the game ends or the page is closed.
    // This is by design: no privacy concerns, no storage overhead.
    // ──────────────────────────────────────────────────────────────
    socket.on("send-message", ({ gameId, message }) => {
      // Basic safety: ignore empty or excessively long messages
      if (!message || typeof message !== "string") return;
      const trimmed = message.trim().slice(0, 200); // max 200 chars
      if (!trimmed) return;

      // Forward to opponent only (not back to sender)
      // socket.userId is set by the JWT middleware on connection
      socket.to(gameId).emit("receive-message", {
        from: socket.userId,
        message: trimmed,
        timestamp: Date.now(),
      });
    });

    // ──────────────────────────────────────────────────────────────
    // EVENT: disconnect
    // Fires automatically when a player's connection drops
    // (tab closed, internet lost, etc.)
    // ──────────────────────────────────────────────────────────────
    socket.on("disconnect", (reason) => {
      console.log(`🔌 Socket disconnected: ${socket.id} — ${reason}`);
      // Notify the opponent so they can show "Opponent disconnected"
      if (socket.gameId) {
        socket.to(socket.gameId).emit("opponent-disconnected");
      }
    });
  });

  return io;
};

module.exports = initSocket;
