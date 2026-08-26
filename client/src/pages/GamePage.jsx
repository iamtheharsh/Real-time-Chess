import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Chessboard } from 'react-chessboard'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../hooks/useSocket'

// Format seconds → mm:ss
const fmt = (ms) => {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(totalSec / 60).toString().padStart(2, '0')
  const s = (totalSec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export default function GamePage() {
  const { gameId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const socket = useSocket()

  // ── Game state ──
  const [fen, setFen] = useState('start')
  const [moves, setMoves] = useState([])         // array of { san, player }
  const [myColor, setMyColor] = useState(null)   // 'w' | 'b'
  const [status, setStatus] = useState('WAITING')
  const [whitePlayer, setWhitePlayer] = useState('')
  const [blackPlayer, setBlackPlayer] = useState('')

  // ── Clocks ── (ms)
  const [whiteTime, setWhiteTime] = useState(600000)
  const [blackTime, setBlackTime] = useState(600000)
  const [activeClock, setActiveClock] = useState('w') // whose clock is ticking
  const clockRef = useRef(null)
  const lastTickRef = useRef(Date.now())

  // ── UI state ──
  const [gameOver, setGameOver] = useState(null)      // { result, resultReason }
  const [drawOffered, setDrawOffered] = useState(false)
  const [opponentLeft, setOpponentLeft] = useState(false)
  const [moveError, setMoveError] = useState('')
  const [lastMove, setLastMove] = useState(null)      // { from, to } for highlighting
  const [selectedSquare, setSelectedSquare] = useState(null) // square selected for click-to-move
  const [reconnecting, setReconnecting] = useState(false)

  // ── Derive current turn from FEN ──
  const currentTurn = fen === 'start' ? 'w' : fen.split(' ')[1]
  const isMyTurn = myColor === currentTurn

  // ── Pair moves into rows [{ white: 'e4', black: 'e5' }] ──
  const movePairs = []
  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push({ white: moves[i]?.san, black: moves[i + 1]?.san })
  }

  // ── Client-side clock tick (cosmetic, re-syncs from server on every move) ──
  useEffect(() => {
    if (status !== 'ACTIVE' || gameOver) {
      clearInterval(clockRef.current)
      return
    }
    lastTickRef.current = Date.now()
    clockRef.current = setInterval(() => {
      const now = Date.now()
      const delta = now - lastTickRef.current
      lastTickRef.current = now
      if (currentTurn === 'w') {
        setWhiteTime((t) => Math.max(0, t - delta))
      } else {
        setBlackTime((t) => Math.max(0, t - delta))
      }
    }, 200)
    return () => clearInterval(clockRef.current)
  }, [status, gameOver, currentTurn])

  // ── Socket event listeners ──
  useEffect(() => {
    if (!socket || !gameId) return

    // Always re-join on connect AND reconnect.
    // Socket.IO fires 'connect' on initial connect AND after every reconnection.
    // This is the mechanism for seamless reconnect recovery:
    // server recalculates live clock values and sends full game state.
    const emitJoin = () => {
      setReconnecting(false)
      socket.emit('join-game', { gameId })
    }
    socket.on('connect', emitJoin)
    if (socket.connected) emitJoin()

    // Show reconnecting banner while socket is trying to reconnect
    socket.on('disconnect', () => setReconnecting(true))

    // Server sends full game state on join (handles reconnects too)
    socket.on('game-state', (data) => {
      setFen(data.fen || 'start')
      setMoves(data.moves || [])
      setMyColor(data.color)
      setStatus(data.status)
      setWhitePlayer(data.whitePlayer || '')
      setBlackPlayer(data.blackPlayer || '')
      setWhiteTime(data.whiteTime ?? 600000)
      setBlackTime(data.blackTime ?? 600000)
      if (data.result) setGameOver({ result: data.result, resultReason: data.resultReason })
    })

    // A valid move was made (by either player)
    socket.on('move-made', (data) => {
      setFen(data.fen)
      setMoves((prev) => [...prev, data.move])
      setLastMove({ from: data.move.from, to: data.move.to })
      setSelectedSquare(null)
      // Re-sync clocks from server truth
      setWhiteTime(data.whiteTime)
      setBlackTime(data.blackTime)
    })

    // Game ended (checkmate, stalemate, resign, draw, timeout)
    socket.on('game-over', (data) => {
      setGameOver({ result: data.result, resultReason: data.resultReason, winnerId: data.winnerId })
      setStatus('COMPLETED')
    })

    // Draw offer events
    socket.on('draw-offered', () => setDrawOffered(true))
    socket.on('draw-declined', () => setDrawOffered(false))

    // Opponent joined the waiting room
    socket.on('opponent-joined', (data) => {
      setStatus(data?.status || 'ACTIVE')
      setOpponentLeft(false)
      if (data?.whitePlayer) setWhitePlayer(data.whitePlayer)
      if (data?.blackPlayer) setBlackPlayer(data.blackPlayer)
    })

    // Opponent disconnected temporarily
    socket.on('opponent-disconnected', () => setOpponentLeft(true))

    // Move was rejected by server
    socket.on('move-error', (data) => {
      setMoveError(data.message)
      setTimeout(() => setMoveError(''), 2500)
    })

    socket.on('error', (data) => {
      console.error('Socket error:', data.message)
    })

    return () => {
      socket.off('connect', emitJoin)
      socket.off('disconnect')
      socket.off('game-state')
      socket.off('move-made')
      socket.off('game-over')
      socket.off('draw-offered')
      socket.off('draw-declined')
      socket.off('opponent-joined')
      socket.off('opponent-disconnected')
      socket.off('move-error')
      socket.off('error')
    }
  }, [socket, gameId])

  // ── onPieceDrop: called by react-chessboard when user drags a piece ──
  const onPieceDrop = useCallback((args) => {
    let from, to, pieceObj
    if (args && typeof args === 'object' && 'sourceSquare' in args) {
      from = args.sourceSquare
      to = args.targetSquare
      pieceObj = args.piece
    } else {
      from = arguments[0]
      to = arguments[1]
      pieceObj = arguments[2]
    }

    if (!to || from === to) return false
    if (!isMyTurn || gameOver || status !== 'ACTIVE') return false

    // Detect pawn promotion
    const pieceType = pieceObj?.pieceType || (typeof pieceObj === 'string' ? pieceObj : '')
    const isPawn = pieceType.toLowerCase().includes('p')
    const isPromotion =
      isPawn &&
      ((myColor === 'w' && to[1] === '8') || (myColor === 'b' && to[1] === '1'))

    socket.emit('make-move', {
      gameId,
      from,
      to,
      promotion: isPromotion ? 'q' : undefined,
    })
    setSelectedSquare(null)
    return true
  }, [isMyTurn, gameOver, status, myColor, socket, gameId])

  // ── onSquareClick: click-to-move support ──
  const onSquareClick = useCallback((args) => {
    if (!isMyTurn || gameOver || status !== 'ACTIVE') {
      setSelectedSquare(null)
      return
    }

    const clickedSquare = args?.square || args
    const piece = args?.piece
    const pieceType = piece?.pieceType || (typeof piece === 'string' ? piece : '')
    const pieceColor = pieceType?.[0]

    // 1. If no square is currently selected
    if (!selectedSquare) {
      if (pieceColor === myColor) {
        setSelectedSquare(clickedSquare)
      }
      return
    }

    // 2. If clicking the exact same square -> deselect
    if (selectedSquare === clickedSquare) {
      setSelectedSquare(null)
      return
    }

    // 3. If clicking another piece of the player's own color -> switch selection
    if (pieceColor === myColor) {
      setSelectedSquare(clickedSquare)
      return
    }

    // 4. Otherwise -> attempt move from selectedSquare to clickedSquare
    const isPromotion =
      (myColor === 'w' && clickedSquare[1] === '8') ||
      (myColor === 'b' && clickedSquare[1] === '1')

    socket.emit('make-move', {
      gameId,
      from: selectedSquare,
      to: clickedSquare,
      promotion: isPromotion ? 'q' : undefined,
    })

    setSelectedSquare(null)
  }, [selectedSquare, isMyTurn, gameOver, status, myColor, socket, gameId])

  const canDragPiece = useCallback((args) => {
    if (!isMyTurn || gameOver || status !== 'ACTIVE') return false
    const piece = args?.piece
    const pieceType = piece?.pieceType || (typeof piece === 'string' ? piece : '')
    const pieceColor = pieceType?.[0]
    return pieceColor === myColor
  }, [isMyTurn, gameOver, status, myColor])

  const handleResign = () => {
    if (window.confirm('Are you sure you want to resign?')) {
      socket.emit('resign', { gameId })
    }
  }

  const handleOfferDraw = () => socket.emit('offer-draw', { gameId })
  const handleAcceptDraw = () => { socket.emit('accept-draw', { gameId }); setDrawOffered(false) }
  const handleDeclineDraw = () => { socket.emit('decline-draw', { gameId }); setDrawOffered(false) }

  // Custom square styles for last move highlight and selected square
  const customSquareStyles = {
    ...(lastMove
      ? {
          [lastMove.from]: { backgroundColor: 'rgba(255, 255, 100, 0.35)' },
          [lastMove.to]: { backgroundColor: 'rgba(255, 255, 100, 0.45)' },
        }
      : {}),
    ...(selectedSquare
      ? {
          [selectedSquare]: { backgroundColor: 'rgba(99, 102, 241, 0.65)' },
        }
      : {}),
  }

  // ── Game over result label ──
  const getResultLabel = () => {
    if (!gameOver) return null
    if (gameOver.result === 'draw') return { title: 'Draw!', color: 'text-yellow-400', sub: gameOver.resultReason?.replace(/_/g, ' ') }
    const iWon = (gameOver.result === 'white' && myColor === 'w') || (gameOver.result === 'black' && myColor === 'b')
    return {
      title: iWon ? 'You Won! 🎉' : 'You Lost',
      color: iWon ? 'text-green-400' : 'text-red-400',
      sub: gameOver.resultReason?.replace(/_/g, ' '),
    }
  }

  const resultLabel = getResultLabel()

  // ── Clock display component ──
  const Clock = ({ time, label, active, isMe }) => (
    <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border transition-all ${
      active && status === 'ACTIVE' && !gameOver
        ? 'bg-white text-black border-white'
        : 'bg-[#1e2130] text-white border-[#2d3148]'
    }`}>
      <span className={`text-sm font-medium ${active && status === 'ACTIVE' ? 'text-gray-700' : 'text-slate-400'}`}>
        {label} {isMe && '(You)'}
      </span>
      <span className="text-xl font-mono font-bold tabular-nums">{fmt(time)}</span>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0f1117] text-white flex flex-col">

      {/* Reconnecting banner */}
      {reconnecting && (
        <div className="fixed top-0 inset-x-0 bg-yellow-600/90 text-white text-xs text-center py-2 z-50 flex items-center justify-center gap-2">
          <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
          Reconnecting to game...
        </div>
      )}

      {/* Navbar */}
      <header className="border-b border-[#2d3148] bg-[#1a1d27] px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/dashboard')}>
          <span className="text-xl">♟️</span>
          <span className="font-bold text-sm tracking-tight">Real-Time Chess</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-500 font-mono text-xs">Game #{gameId}</span>
          {status === 'ACTIVE' && !gameOver && (
            <span className="bg-green-500/10 text-green-400 border border-green-500/20 rounded-full px-3 py-0.5 text-xs font-medium">
              Live
            </span>
          )}
        </div>
      </header>

      {/* ── Waiting state ── */}
      {status === 'WAITING' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-1">Waiting for opponent</h2>
            <p className="text-slate-400 text-sm mb-4">Share the game ID to invite someone</p>
            <div className="inline-flex items-center gap-3 bg-[#1e2130] border border-[#2d3148] rounded-xl px-5 py-3">
              <span className="text-2xl font-mono font-bold tracking-widest text-indigo-400">{gameId}</span>
              <button
                onClick={() => navigator.clipboard.writeText(gameId)}
                className="text-xs text-slate-400 hover:text-white border border-[#2d3148] rounded-lg px-2 py-1 transition"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Active game layout ── */}
      {status !== 'WAITING' && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="flex flex-col lg:flex-row gap-4 w-full max-w-5xl">

            {/* ── Board column ── */}
            <div className="flex flex-col gap-3 flex-shrink-0">
              {/* Opponent clock (top) */}
              <Clock
                time={myColor === 'w' ? blackTime : whiteTime}
                label={myColor === 'w' ? blackPlayer : whitePlayer}
                active={currentTurn !== myColor}
                isMe={false}
              />

              {/* Chess Board */}
              <div className="relative">
                <Chessboard
                  options={{
                    id: "main-board",
                    position: fen,
                    onPieceDrop: onPieceDrop,
                    onSquareClick: onSquareClick,
                    canDragPiece: canDragPiece,
                    allowDragging: isMyTurn && status === 'ACTIVE' && !gameOver,
                    boardOrientation: myColor === 'b' ? 'black' : 'white',
                    squareStyles: customSquareStyles,
                    boardStyle: { borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', width: '100%', maxWidth: '480px' },
                    darkSquareStyle: { backgroundColor: '#4a6741' },
                    lightSquareStyle: { backgroundColor: '#f0d9b5' },
                  }}
                />

                {/* Move error toast */}
                {moveError && (
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-red-600 text-white text-xs font-medium px-4 py-2 rounded-lg shadow-lg z-10 animate-bounce">
                    {moveError}
                  </div>
                )}
              </div>

              {/* My clock (bottom) */}
              <Clock
                time={myColor === 'w' ? whiteTime : blackTime}
                label={myColor === 'w' ? whitePlayer : blackPlayer}
                active={currentTurn === myColor}
                isMe={true}
              />
            </div>

            {/* ── Sidebar ── */}
            <div className="flex flex-col gap-3 flex-1 min-w-0 lg:max-w-64">

              {/* Turn indicator */}
              {!gameOver && status === 'ACTIVE' && (
                <div className={`text-center text-sm font-medium py-2 px-4 rounded-xl border ${
                  isMyTurn
                    ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/30'
                    : 'bg-[#1e2130] text-slate-400 border-[#2d3148]'
                }`}>
                  {isMyTurn ? '⚡ Your turn' : "Opponent's turn"}
                </div>
              )}

              {/* Opponent disconnected banner */}
              {opponentLeft && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs rounded-xl px-4 py-2 text-center">
                  ⚠️ Opponent disconnected
                </div>
              )}

              {/* Move history */}
              <div className="bg-[#1e2130] border border-[#2d3148] rounded-xl flex-1 flex flex-col min-h-0">
                <div className="px-4 py-3 border-b border-[#2d3148]">
                  <h3 className="text-sm font-semibold text-slate-300">Move History</h3>
                </div>
                <div className="overflow-y-auto flex-1 p-2 max-h-72 lg:max-h-96">
                  {movePairs.length === 0 ? (
                    <p className="text-slate-600 text-xs text-center py-4">No moves yet</p>
                  ) : (
                    <table className="w-full text-xs">
                      <tbody>
                        {movePairs.map((pair, i) => (
                          <tr key={i} className="hover:bg-[#252840] rounded">
                            <td className="text-slate-500 px-2 py-1 w-6">{i + 1}.</td>
                            <td className="text-white font-mono px-2 py-1 w-20">{pair.white}</td>
                            <td className="text-slate-300 font-mono px-2 py-1">{pair.black || ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Draw offer banner */}
              {drawOffered && (
                <div className="bg-[#1e2130] border border-yellow-500/40 rounded-xl p-4 text-center">
                  <p className="text-yellow-400 text-sm font-medium mb-3">Draw offered</p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAcceptDraw}
                      className="flex-1 bg-green-600 hover:bg-green-500 text-white text-xs font-semibold rounded-lg py-2 transition"
                    >
                      Accept
                    </button>
                    <button
                      onClick={handleDeclineDraw}
                      className="flex-1 bg-[#0f1117] hover:bg-[#252840] border border-[#2d3148] text-slate-300 text-xs rounded-lg py-2 transition"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              {!gameOver && status === 'ACTIVE' && (
                <div className="flex gap-2">
                  <button
                    onClick={handleOfferDraw}
                    className="flex-1 bg-[#1e2130] hover:bg-[#252840] border border-[#2d3148] text-slate-300 hover:text-white text-xs font-medium rounded-xl py-2.5 transition"
                  >
                    Offer Draw
                  </button>
                  <button
                    onClick={handleResign}
                    className="flex-1 bg-red-900/30 hover:bg-red-900/50 border border-red-800/40 text-red-400 hover:text-red-300 text-xs font-medium rounded-xl py-2.5 transition"
                  >
                    Resign
                  </button>
                </div>
              )}

              {/* Back to dashboard after game ends */}
              {gameOver && (
                <button
                  onClick={() => navigate('/dashboard')}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl py-2.5 transition"
                >
                  Back to Dashboard
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Game Over Overlay ── */}
      {gameOver && resultLabel && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-[#1e2130] border border-[#2d3148] rounded-2xl p-8 text-center max-w-sm w-full shadow-2xl">
            <div className="text-5xl mb-4">
              {gameOver.result === 'draw' ? '🤝' : resultLabel.title.includes('Won') ? '👑' : '😔'}
            </div>
            <h2 className={`text-2xl font-bold mb-1 ${resultLabel.color}`}>{resultLabel.title}</h2>
            <p className="text-slate-400 text-sm capitalize mb-6">
              {resultLabel.sub || 'Game over'}
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl py-3 transition"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
