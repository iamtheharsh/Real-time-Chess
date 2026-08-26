# Real-Time Chess ♟️

A full-stack real-time 1v1 chess application built with the MERN stack, Socket.IO, and chess.js.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React (Vite) + Tailwind CSS |
| Backend | Node.js + Express |
| Database | MongoDB + Mongoose |
| Real-time | Socket.IO |
| Auth | JWT + bcryptjs |
| Chess Logic | chess.js (server-side authority) |
| Chess UI | react-chessboard |

## Architecture

- **Server-authoritative**: chess.js on the backend validates every move. The client never decides legality.
- **Server-authoritative clock**: The 10+10 timer runs on the server. React renders a display only.
- **FEN-based state**: Board state stored as FEN strings for efficient reconnection recovery.

## Project Structure

```
real-time-chess/
├── client/       # Vite + React frontend
└── server/       # Node + Express backend
```

## Getting Started

### Server
```bash
cd server
cp .env.example .env   # fill in your MONGODB_URI and JWT_SECRET
npm run dev
```

### Client
```bash
cd client
npm run dev
```

## Features (Planned)
- [x] Project scaffold & DB models
- [ ] JWT Authentication
- [ ] Create / Join game
- [ ] Real-time chess moves via Socket.IO
- [ ] 10+10 server-side clock
- [ ] Move history (SAN)
- [ ] Game completion detection
- [ ] Resign / Draw
- [ ] Disconnect & reconnect recovery
- [ ] Game history page
