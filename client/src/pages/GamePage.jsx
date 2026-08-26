import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Chessboard } from 'react-chessboard'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../hooks/useSocket'

// Format milliseconds → mm:ss
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
  const [moves, setMoves] = useState([])
  const [myColor, setMyColor] = useState(null)
  const [status, setStatus] = useState('WAITING')
  const [whitePlayer, setWhitePlayer] = useState('')
  const [blackPlayer, setBlackPlayer] = useState('')

  // ── Clocks (ms) ──
  const [whiteTime, setWhiteTime] = useState(600000)
  const [blackTime, setBlackTime] = useState(600000)
  const clockRef = useRef(null)
  const lastTickRef = useRef(Date.now())

  // ── UI state ──
  const [gameOver, setGameOver] = useState(null)
  const [drawOffered, setDrawOffered] = useState(false)
  const [opponentLeft, setOpponentLeft] = useState(false)
  const [moveError, setMoveError] = useState('')
  const [lastMove, setLastMove] = useState(null)
  const [selectedSquare, setSelectedSquare] = useState(null)
  const [reconnecting, setReconnecting] = useState(false)
  const [copied, setCopied] = useState(false)

  // Derive turn
  const currentTurn = fen === 'start' ? 'w' : fen.split(' ')[1]
  const isMyTurn = myColor === currentTurn

  // Move pairs for table
  const movePairs = []
  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push({ white: moves[i]?.san, black: moves[i + 1]?.san })
  }

  // Client-side clock tick
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

  // Socket event listeners
  useEffect(() => {
    if (!socket || !gameId) return

    const emitJoin = () => {
      setReconnecting(false)
      socket.emit('join-game', { gameId })
    }
    socket.on('connect', emitJoin)
    if (socket.connected) emitJoin()

    socket.on('disconnect', () => setReconnecting(true))

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

    socket.on('move-made', (data) => {
      setFen(data.fen)
      setMoves((prev) => [...prev, data.move])
      setLastMove({ from: data.move.from, to: data.move.to })
      setSelectedSquare(null)
      setWhiteTime(data.whiteTime)
      setBlackTime(data.blackTime)
    })

    socket.on('game-over', (data) => {
      setGameOver({ result: data.result, resultReason: data.resultReason, winnerId: data.winnerId })
      setStatus('COMPLETED')
    })

    socket.on('draw-offered', () => setDrawOffered(true))
    socket.on('draw-declined', () => setDrawOffered(false))

    socket.on('opponent-joined', (data) => {
      setStatus(data?.status || 'ACTIVE')
      setOpponentLeft(false)
      if (data?.whitePlayer) setWhitePlayer(data.whitePlayer)
      if (data?.blackPlayer) setBlackPlayer(data.blackPlayer)
    })

    socket.on('opponent-disconnected', () => setOpponentLeft(true))

    socket.on('move-error', (data) => {
      setMoveError(data.message)
      setTimeout(() => setMoveError(''), 2000)
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

  // Drag and drop handler
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

  // Click to move handler
  const onSquareClick = useCallback((args) => {
    if (!isMyTurn || gameOver || status !== 'ACTIVE') {
      setSelectedSquare(null)
      return
    }

    const clickedSquare = args?.square || args
    const piece = args?.piece
    const pieceType = piece?.pieceType || (typeof piece === 'string' ? piece : '')
    const pieceColor = pieceType?.[0]

    if (!selectedSquare) {
      if (pieceColor === myColor) {
        setSelectedSquare(clickedSquare)
      }
      return
    }

    if (selectedSquare === clickedSquare) {
      setSelectedSquare(null)
      return
    }

    if (pieceColor === myColor) {
      setSelectedSquare(clickedSquare)
      return
    }

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

  const handleCopyId = () => {
    navigator.clipboard.writeText(gameId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Board square highlights
  const customSquareStyles = {
    ...(lastMove
      ? {
          [lastMove.from]: { backgroundColor: 'rgba(110, 231, 183, 0.2)' },
          [lastMove.to]: { backgroundColor: 'rgba(110, 231, 183, 0.3)' },
        }
      : {}),
    ...(selectedSquare
      ? {
          [selectedSquare]: { backgroundColor: 'rgba(110, 231, 183, 0.4)' },
        }
      : {}),
  }

  // Result summary
  const getResultLabel = () => {
    if (!gameOver) return null
    if (gameOver.result === 'draw') return { title: 'Draw', color: 'text-[#A1A1AA]', sub: gameOver.resultReason?.replace(/_/g, ' ') }
    const iWon = (gameOver.result === 'white' && myColor === 'w') || (gameOver.result === 'black' && myColor === 'b')
    return {
      title: iWon ? 'Victory' : 'Defeat',
      color: iWon ? 'text-[#6EE7B7]' : 'text-[#F87171]',
      sub: gameOver.resultReason?.replace(/_/g, ' '),
    }
  }

  const resultLabel = getResultLabel()

  // Minimal Clock component
  const Clock = ({ time, label, active, isMe }) => (
    <div className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-all ${
      active && status === 'ACTIVE' && !gameOver
        ? 'bg-[#1B1B1E] text-[#F5F5F7] border-[#6EE7B7]/40 shadow-sm'
        : 'bg-[#111113] text-[#A1A1AA] border-[#27272A]'
    }`}>
      <div className="flex items-center gap-2">
        {active && status === 'ACTIVE' && !gameOver && (
          <span className="w-1.5 h-1.5 rounded-full bg-[#6EE7B7] animate-pulse" />
        )}
        <span className={`text-xs font-medium ${active && status === 'ACTIVE' ? 'text-[#F5F5F7]' : 'text-[#71717A]'}`}>
          {label} {isMe && '(You)'}
        </span>
      </div>
      <span className="text-base font-mono font-bold tracking-wider tabular-nums text-[#F5F5F7]">{fmt(time)}</span>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-[#F5F5F7] flex flex-col antialiased selection:bg-[#6EE7B7]/20 selection:text-[#6EE7B7]">
      
      {/* Reconnecting banner */}
      {reconnecting && (
        <div className="bg-[#111113] border-b border-[#27272A] text-xs text-[#FBBF24] text-center py-1.5 flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#FBBF24] animate-ping" />
          <span>Reconnecting to game room...</span>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-[#27272A] bg-[#0A0A0B]/80 backdrop-blur-md px-5 sm:px-8 h-14 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/dashboard')}>
          <span className="text-lg">♟</span>
          <span className="font-semibold text-sm tracking-tight text-[#F5F5F7]">Real-Time Chess</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-[#71717A] font-mono">#{gameId}</span>
          {status === 'ACTIVE' && !gameOver && (
            <span className="flex items-center gap-1.5 text-[#6EE7B7]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#6EE7B7] animate-pulse" />
              <span>Live</span>
            </span>
          )}
        </div>
      </header>

      {/* ── Waiting State ── */}
      {status === 'WAITING' && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-[#111113] border border-[#27272A] rounded-xl p-8 max-w-sm w-full text-center space-y-5 shadow-xl">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-[#F5F5F7]">Waiting for opponent</h2>
              <p className="text-xs text-[#71717A]">Share the game code to begin</p>
            </div>

            <div className="bg-[#0A0A0B] border border-[#27272A] rounded-lg p-3 flex items-center justify-between">
              <span className="text-xl font-mono font-bold tracking-widest text-[#F5F5F7]">{gameId}</span>
              <button
                onClick={handleCopyId}
                className="bg-[#1B1B1E] hover:bg-[#27272A] text-xs text-[#F5F5F7] border border-[#27272A] rounded-md px-3 py-1.5 transition"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-[#A1A1AA]">
              <span className="w-2 h-2 rounded-full bg-[#6EE7B7] animate-pulse" />
              <span>Room is active and listening...</span>
            </div>

            <button
              onClick={() => navigate('/dashboard')}
              className="w-full text-xs text-[#71717A] hover:text-[#F5F5F7] transition py-2"
            >
              Cancel Match
            </button>
          </div>
        </div>
      )}

      {/* ── Active Game Layout ── */}
      {status !== 'WAITING' && (
        <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row gap-6 w-full max-w-5xl items-center lg:items-start justify-center">

            {/* Board Column (Hero) */}
            <div className="flex flex-col gap-2.5 w-full max-w-[460px]">
              
              {/* Opponent Clock (Top) */}
              <Clock
                time={myColor === 'w' ? blackTime : whiteTime}
                label={myColor === 'w' ? blackPlayer : whitePlayer}
                active={currentTurn !== myColor}
                isMe={false}
              />

              {/* The Chessboard */}
              <div className="relative aspect-square bg-[#111113] border border-[#27272A] rounded-xl overflow-hidden shadow-2xl p-2 flex items-center justify-center">
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
                    boardStyle: { borderRadius: '6px', width: '100%', maxWidth: '440px' },
                    darkSquareStyle: { backgroundColor: '#27272A' },
                    lightSquareStyle: { backgroundColor: '#E4E4E7' },
                  }}
                />

                {/* Move Error Toast */}
                {moveError && (
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[#F87171] text-[#0A0A0B] text-xs font-semibold px-3 py-1.5 rounded shadow-lg z-20">
                    {moveError}
                  </div>
                )}
              </div>

              {/* Player Clock (Bottom) */}
              <Clock
                time={myColor === 'w' ? whiteTime : blackTime}
                label={myColor === 'w' ? whitePlayer : blackPlayer}
                active={currentTurn === myColor}
                isMe={true}
              />
            </div>

            {/* Sidebar / Move History */}
            <div className="flex flex-col gap-3 w-full max-w-[460px] lg:max-w-64 h-[440px] lg:h-[530px]">
              
              {/* Turn Banner */}
              {!gameOver && status === 'ACTIVE' && (
                <div className={`text-xs font-medium py-2 px-3 rounded-lg border text-center transition ${
                  isMyTurn
                    ? 'bg-[#1B1B1E] text-[#6EE7B7] border-[#6EE7B7]/30'
                    : 'bg-[#111113] text-[#71717A] border-[#27272A]'
                }`}>
                  {isMyTurn ? 'Your turn to move' : "Waiting for opponent..."}
                </div>
              )}

              {/* Opponent Disconnected Indicator */}
              {opponentLeft && (
                <div className="text-xs text-[#FBBF24] bg-[#FBBF24]/10 border border-[#FBBF24]/20 rounded-lg p-2 text-center">
                  Opponent disconnected
                </div>
              )}

              {/* Move History Table */}
              <div className="bg-[#111113] border border-[#27272A] rounded-xl flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="px-3.5 py-2.5 border-b border-[#1D1D20]">
                  <div className="text-xs font-semibold text-[#71717A] uppercase tracking-wider">Moves</div>
                </div>
                <div className="overflow-y-auto flex-1 p-2">
                  {movePairs.length === 0 ? (
                    <div className="text-center py-8 text-xs text-[#71717A]">No moves yet</div>
                  ) : (
                    <table className="w-full text-xs">
                      <tbody>
                        {movePairs.map((pair, i) => (
                          <tr key={i} className="hover:bg-[#1B1B1E] rounded">
                            <td className="text-[#71717A] px-2 py-0.5 w-6 font-mono">{i + 1}.</td>
                            <td className="text-[#F5F5F7] font-mono px-2 py-0.5 w-20">{pair.white}</td>
                            <td className="text-[#A1A1AA] font-mono px-2 py-0.5">{pair.black || ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Draw Offer Prompt */}
              {drawOffered && (
                <div className="bg-[#111113] border border-[#27272A] rounded-xl p-3 text-center space-y-2">
                  <div className="text-xs text-[#A1A1AA]">Draw offered by opponent</div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAcceptDraw}
                      className="flex-1 bg-[#F5F5F7] hover:bg-white text-[#0A0A0B] text-xs font-medium py-1.5 rounded-lg transition"
                    >
                      Accept
                    </button>
                    <button
                      onClick={handleDeclineDraw}
                      className="flex-1 border border-[#27272A] hover:bg-[#1B1B1E] text-xs text-[#A1A1AA] py-1.5 rounded-lg transition"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {!gameOver && status === 'ACTIVE' && (
                <div className="flex gap-2">
                  <button
                    onClick={handleOfferDraw}
                    className="flex-1 bg-[#111113] hover:bg-[#1B1B1E] border border-[#27272A] text-xs text-[#A1A1AA] hover:text-[#F5F5F7] py-2 rounded-lg transition"
                  >
                    Draw
                  </button>
                  <button
                    onClick={handleResign}
                    className="flex-1 bg-[#111113] hover:bg-[#1B1B1E] border border-[#27272A] text-xs text-[#F87171] hover:text-[#F87171] py-2 rounded-lg transition"
                  >
                    Resign
                  </button>
                </div>
              )}

              {gameOver && (
                <button
                  onClick={() => navigate('/dashboard')}
                  className="w-full bg-[#F5F5F7] hover:bg-white text-[#0A0A0B] text-xs font-medium py-2.5 rounded-lg transition"
                >
                  Back to Dashboard
                </button>
              )}

            </div>
          </div>
        </div>
      )}

      {/* ── Game Over Modal ── */}
      {gameOver && resultLabel && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111113] border border-[#27272A] rounded-xl p-6 text-center max-w-xs w-full shadow-2xl space-y-4">
            <div>
              <h2 className={`text-xl font-semibold ${resultLabel.color}`}>{resultLabel.title}</h2>
              <p className="text-xs text-[#71717A] capitalize mt-1">
                {resultLabel.sub || 'Game completed'}
              </p>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full bg-[#F5F5F7] hover:bg-white text-[#0A0A0B] text-xs font-medium py-2 rounded-lg transition"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
