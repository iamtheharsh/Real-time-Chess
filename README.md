# CHECKMATE ♟️

A premium, full-stack real-time 1v1 chess application built with the MERN stack and Socket.IO.

![Dashboard Preview](https://images.pexels.com/photos/19327137/pexels-photo-19327137.jpeg)

---

## ✨ Features

- **Real-time multiplayer** — Two players connect via a unique 8-character Game ID
- **Server-authoritative moves** — `chess.js` on the backend validates every move; the client cannot cheat
- **Synchronized clocks** — 10+10 timer (10 min + 10s increment) runs server-side, broadcast to both clients
- **Drag & drop + click-to-move** — Full piece interaction support
- **Resign / Draw offer** — In-game controls with opponent prompts
- **Game history & replay** — View all past games with move-by-move replay
- **JWT Authentication** — Secure login/register with bcrypt password hashing
- **Disconnect recovery** — Automatic socket reconnect with state restoration
- **Premium dark UI** — Warm amber/gold glassmorphism aesthetic throughout

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 (Vite) + Tailwind CSS + lucide-react |
| **Backend** | Node.js + Express |
| **Database** | MongoDB + Mongoose |
| **Real-time** | Socket.IO |
| **Auth** | JWT + bcryptjs |
| **Chess Logic** | chess.js (server-side authority) |
| **Chess Board** | react-chessboard |

---

## 🗂 Project Structure

```
Real time chess/
├── client/                  # Vite + React frontend
│   ├── src/
│   │   ├── context/         # AuthContext (JWT session)
│   │   ├── hooks/           # useSocket hook
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   ├── DashboardPage.jsx   # Welcome, Recent Games, Stats
│   │   │   ├── GamePage.jsx        # Live board, clocks, move history
│   │   │   ├── HistoryPage.jsx     # All past matches
│   │   │   └── ReplayPage.jsx      # Move-by-move replay
│   │   └── services/
│   │       └── gameService.js      # REST API wrappers
│   └── public/
└── server/                  # Node + Express backend
    └── src/
        ├── controllers/     # authController, gameController
        ├── middleware/       # auth middleware (JWT verify)
        ├── models/          # User.js, Game.js
        ├── routes/          # auth.js, games.js
        └── socket/          # index.js — all Socket.IO logic
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- MongoDB Atlas account (or local MongoDB)

### Server Setup
```bash
cd server
cp .env.example .env   # fill in MONGODB_URI, JWT_SECRET, PORT
npm install
npm run dev            # runs on http://localhost:3001
```

### Client Setup
```bash
cd client
npm install
npm run dev            # runs on http://localhost:5173
```

---

## 🔌 How It Works

### Authentication
1. User registers/logs in → server returns a signed JWT
2. JWT stored in `localStorage` → decoded via `AuthContext`
3. All protected API calls include `Authorization: Bearer <token>`

### Game Flow
1. **Create Game** → REST `POST /api/games` → returns 8-char `gameId`, status `WAITING`
2. **Join Game** → REST `POST /api/games/join` → server assigns `blackPlayer`, status → `ACTIVE`
3. Both clients emit `join-game` socket event → placed in a Socket.IO room
4. On `opponent-joined`, both clients re-request a fresh `game-state` (no refresh needed)
5. **Move** → client emits `make-move` → server validates with `chess.js` → broadcasts `move-made` to room
6. **Game End** → server detects checkmate/timeout/resign → emits `game-over`

### Real-time Move Cycle
```
Player 1 drags piece
  → emits make-move { from, to }
    → server validates (chess.js)
      → saves FEN to MongoDB
        → emits move-made { fen, whiteTime, blackTime } to room
          → Player 2 board updates instantly
```

---

## ✅ Implemented Features

- [x] JWT Authentication (register / login)
- [x] Create & join game by ID
- [x] Real-time chess moves via Socket.IO
- [x] Server-authoritative move validation
- [x] 10+10 server-side synchronized clock
- [x] Move history (SAN notation)
- [x] Checkmate / stalemate / timeout detection
- [x] Resign & draw offer/accept/decline
- [x] Disconnect & reconnect recovery
- [x] Game history page
- [x] Move-by-move game replay
- [x] Premium dark UI (amber/gold glassmorphism)
- [x] Drag-and-drop + click-to-move
- [x] Responsive layout

---

## 🎨 Design System

The UI uses a consistent warm amber/gold dark theme across all pages:

| Token | Value | Usage |
|---|---|---|
| Background overlay | `#0D0A07` | Page background |
| Main surface | `rgba(18,14,10,0.90)` | Cards & panels |
| Border | `#3A2E20` | All borders |
| Primary text | `#F5F0E8` | Headings |
| Secondary text | `#B8AEA0` | Labels |
| Accent / Gold | `#D6A84F` | CTAs, highlights |
| Win | `#70C69A` | Win result |
| Loss | `#E57373` | Loss result |
| Draw | `#B8AEA0` | Draw result |
