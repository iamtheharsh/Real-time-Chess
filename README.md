# CHECKMATE ♟️

A real-time 1v1 online chess website built using Node.js, Express, React, MongoDB, and Socket.IO.

![Dashboard Preview](https://images.pexels.com/photos/19327137/pexels-photo-19327137.jpeg)

---

## ✨ Features

- **Play Live with Friends** — Create a game room, copy the unique 8-character code, and share it with a friend to play live.
- **Fair & Safe Moves** — Moves are checked on the server using `chess.js`. Players cannot make illegal moves or cheat.
- **Custom Match Timers** — Choose between 3 Minutes (Bullet), 5 Minutes (Blitz), or 10 Minutes (Rapid) without time add-on per move. Clocks are controlled and kept in sync by the server.
- **In-Game Live Chat** — Talk with your opponent while playing. Chat messages are live and disappear when the game finishes (nothing saved in database).
- **Easy Board Controls** — Move pieces by dragging and dropping or clicking squares.
- **Resign & Draw Options** — Surrender anytime or offer a draw to your opponent during the match.
- **Game History & Replay** — Look back at all your previous games and watch them move-by-move.
- **Secure User Accounts** — Sign up and log in safely using encrypted passwords and JWT tokens.
- **Auto Reconnect** — If your internet disconnects or you refresh the browser, you join back into your match instantly.
- **Dark Gold Design** — Premium dark amber theme with smooth glassmorphism style.

---

## 🛠 Tech Stack

| Part | Technology Used | What It Does |
|---|---|---|
| **Frontend** | React 18 (Vite) | User interface and pages |
| **Backend** | Node.js + Express | Server logic and API routes |
| **Database** | MongoDB + Mongoose | Stores user accounts and game records |
| **Real-time** | Socket.IO | Instant live communication between players |
| **Auth** | JWT + bcryptjs | Secure login tokens and password hashing |
| **Chess Rules** | chess.js | Checks if moves are legal and detects checkmate |
| **Chess Board** | react-chessboard | Renders the interactive chess board |

---

## 🗂 Project Structure

```
Real time chess/
├── client/                  # Frontend (React + Vite)
│   ├── src/
│   │   ├── context/         # AuthContext (stores logged-in user state)
│   │   ├── hooks/           # useSocket (shared Socket.IO connection)
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   ├── DashboardPage.jsx   # Main home screen after login
│   │   │   ├── GamePage.jsx        # Live chess board, timers, moves & chat
│   │   │   ├── HistoryPage.jsx     # Past matches list
│   │   │   └── ReplayPage.jsx      # Move-by-move match player
│   │   └── services/
│   │       └── gameService.js      # REST API helper functions
│   └── public/
└── server/                  # Backend (Node.js + Express)
    └── src/
        ├── controllers/     # authController, gameController
        ├── middleware/       # Auth check middleware (JWT)
        ├── models/          # User.js, Game.js (Database schemas)
        ├── routes/          # API route definitions
        └── socket/          # index.js (Socket.IO moves, timer & chat logic)
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js installed on your computer
- MongoDB database link (MongoDB Atlas or local)

### 1. Backend Setup
```bash
cd server
cp .env.example .env   # add your MONGODB_URI, JWT_SECRET, PORT
npm install
npm run dev            # server starts on http://localhost:3001
```

### 2. Frontend Setup
```bash
cd client
npm install
npm run dev            # app starts on http://localhost:5173
```

---

## 🔌 How It Works (Simple Explanation)

### 1. Login Flow
- User enters email and password -> Server checks password -> Server sends back a secure token (JWT).
- Browser remembers the token so you stay logged in.

### 2. Match Creation Flow
- **Player A** clicks "Create Game" -> Chooses time format (3, 5, or 10 min) -> Server creates room & returns 8-letter code.
- **Player B** enters code -> Both players enter the live match room automatically.

### 3. Real-Time Move Flow
- **Player A** moves a piece on screen.
- Move is sent to the server via Socket.IO.
- Server uses `chess.js` to confirm the move is legal.
- Server updates the board position and timers in MongoDB.
- Server sends the new position to **Player B**'s screen instantly.

### 4. Live Chat Flow
- **Player A** types a message -> Message is sent via Socket directly to **Player B**.
- Message appears in the chat box on screen.
- Nothing is stored in MongoDB, so messages vanish when the match ends.

---

## ✅ Completed Features Checklist

- [x] User Registration & Login (JWT Auth)
- [x] Create Game & Join via 8-letter code
- [x] Real-time live moves via Socket.IO
- [x] Server-side move validation (no cheating)
- [x] Selectable match clocks (3 min Bullet, 5 min Blitz, 10 min Rapid - 0s increment)
- [x] Ephemeral live in-game chat (not saved in database)
- [x] Move history table (Algebraic notation e.g. `e4`, `Nf3`)
- [x] Win detection (Checkmate, Timeout, Resignation)
- [x] Draw options (Stalemate, Agreement, 3-fold repetition)
- [x] Automatic reconnect on page refresh
- [x] Match history page
- [x] Move-by-move match replay
- [x] Dark gold glassmorphism UI
- [x] Drag & drop and click-to-move support
