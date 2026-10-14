import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Chessboard } from 'react-chessboard'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../hooks/useSocket'
import { ArrowLeft, Copy, Check, Send } from 'lucide-react'

// ── Design Tokens ──────────────────────────────────────────────────────────────
const T = {
  bg: '#0D0A07',
  surfaceMain: 'rgba(18, 14, 10, 0.92)',
  surfaceSub: 'rgba(28, 22, 16, 0.85)',
  border: '#3A2E20',
  borderSubtle: 'rgba(58, 46, 32, 0.55)',
  textPrimary: '#F5F0E8',
  textSecondary: '#B8AEA0',
  textMuted: '#81776A',
  accent: '#D6A84F',
  accentHover: '#E3BC68',
  win: '#70C69A',
  loss: '#E57373',
  draw: '#B8AEA0',
  warning: '#E8B84B',
}

// Format ms → mm:ss
const fmt = (ms) => {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(totalSec / 60).toString().padStart(2, '0')
  const s = (totalSec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

// ── Clock Component ─────────────────────────────────────────────────────────
function ClockBar({ time, label, active, isMe }) {
  const isLow = time < 30000
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px',
        borderRadius: 12,
        border: `1px solid ${active ? (isLow ? T.loss : T.accent) : T.border}`,
        background: active
          ? (isLow ? 'rgba(229,115,115,0.08)' : 'rgba(214,168,79,0.07)')
          : T.surfaceSub,
        transition: 'all 0.3s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {active && (
          <span
            style={{
              width: 7, height: 7, borderRadius: '50%',
              background: isLow ? T.loss : T.accent,
              display: 'inline-block',
              animation: 'pulse 1.4s ease-in-out infinite',
            }}
          />
        )}
        <span style={{ fontSize: 13, fontWeight: 500, color: active ? T.textPrimary : T.textMuted }}>
          {label}{isMe ? ' (You)' : ''}
        </span>
      </div>
      <span
        style={{
          fontSize: 18, fontFamily: 'monospace', fontWeight: 700,
          letterSpacing: '0.05em',
          color: isLow && active ? T.loss : (active ? T.textPrimary : T.textSecondary),
          transition: 'color 0.3s',
        }}
      >
        {fmt(time)}
      </span>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function GamePage() {
  const { gameId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const socket = useSocket()

  const [fen, setFen] = useState('start')
  const [moves, setMoves] = useState([])
  const [myColor, setMyColor] = useState(null)
  const [status, setStatus] = useState('WAITING')
  const [whitePlayer, setWhitePlayer] = useState('')
  const [blackPlayer, setBlackPlayer] = useState('')

  const [whiteTime, setWhiteTime] = useState(600000)
  const [blackTime, setBlackTime] = useState(600000)
  const clockRef = useRef(null)
  const lastTickRef = useRef(Date.now())

  const [gameOver, setGameOver] = useState(null)
  const [drawOffered, setDrawOffered] = useState(false)
  const [opponentLeft, setOpponentLeft] = useState(false)
  const [moveError, setMoveError] = useState('')
  const [lastMove, setLastMove] = useState(null)
  const [selectedSquare, setSelectedSquare] = useState(null)
  const [reconnecting, setReconnecting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showGameOver, setShowGameOver] = useState(false)

  // ── Chat state (ephemeral — never saved to DB) ──
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const chatBottomRef = useRef(null)

  const currentTurn = fen === 'start' ? 'w' : fen.split(' ')[1]
  const isMyTurn = myColor === currentTurn

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
      if (currentTurn === 'w') setWhiteTime(t => Math.max(0, t - delta))
      else setBlackTime(t => Math.max(0, t - delta))
    }, 200) // every 200 ms updatew 
    return () => clearInterval(clockRef.current)
  }, [status, gameOver, currentTurn])

  // Show game-over modal with a tiny delay so board renders first
  useEffect(() => {
    if (gameOver) {
      const t = setTimeout(() => setShowGameOver(true), 600)
      return () => clearTimeout(t)
    } else {
      setShowGameOver(false)
    }
  }, [gameOver])

  // Socket listeners
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
      setMoves(prev => [...prev, data.move])
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

    // ── KEY FIX: when opponent joins, re-request full game-state ──
    socket.on('opponent-joined', (data) => {
      setOpponentLeft(false)
      if (data?.whitePlayer) setWhitePlayer(data.whitePlayer)
      if (data?.blackPlayer) setBlackPlayer(data.blackPlayer)
      if (data?.status) setStatus(data.status)
      // Re-emit join-game to get a fresh full game-state snapshot
      socket.emit('join-game', { gameId })
    })

    socket.on('opponent-disconnected', () => setOpponentLeft(true))

    socket.on('move-error', (data) => {
      setMoveError(data.message)
      setTimeout(() => setMoveError(''), 2500)
    })

    socket.on('error', (data) => console.error('Socket error:', data.message))

    // ── Chat: receive a message from the opponent ──
    // The server forwards it via socket.to(gameId) — never stored in DB
    socket.on('receive-message', (data) => {
      setChatMessages(prev => [...prev, { ...data, mine: false }])
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
      socket.off('receive-message')
    }
  }, [socket, gameId])

  // Drag drop
  const onPieceDrop = useCallback((args) => {
    let from, to, pieceObj
    if (args && typeof args === 'object' && 'sourceSquare' in args) {
      from = args.sourceSquare; to = args.targetSquare; pieceObj = args.piece
    } else {
      from = arguments[0]; to = arguments[1]; pieceObj = arguments[2]
    }
    if (!to || from === to) return false
    if (!isMyTurn || gameOver || status !== 'ACTIVE') return false
    const pieceType = pieceObj?.pieceType || (typeof pieceObj === 'string' ? pieceObj : '')
    const isPawn = pieceType.toLowerCase().includes('p')
    const isPromotion = isPawn && ((myColor === 'w' && to[1] === '8') || (myColor === 'b' && to[1] === '1'))
    socket.emit('make-move', { gameId, from, to, promotion: isPromotion ? 'q' : undefined })
    setSelectedSquare(null)
    return true
  }, [isMyTurn, gameOver, status, myColor, socket, gameId])

  // Click to move
  const onSquareClick = useCallback((args) => {
    if (!isMyTurn || gameOver || status !== 'ACTIVE') { setSelectedSquare(null); return }
    const clickedSquare = args?.square || args
    const piece = args?.piece
    const pieceType = piece?.pieceType || (typeof piece === 'string' ? piece : '')
    const pieceColor = pieceType?.[0]
    if (!selectedSquare) {
      if (pieceColor === myColor) setSelectedSquare(clickedSquare)
      return
    }
    if (selectedSquare === clickedSquare) { setSelectedSquare(null); return }
    if (pieceColor === myColor) { setSelectedSquare(clickedSquare); return }
    const isPromotion = (myColor === 'w' && clickedSquare[1] === '8') || (myColor === 'b' && clickedSquare[1] === '1')
    socket.emit('make-move', { gameId, from: selectedSquare, to: clickedSquare, promotion: isPromotion ? 'q' : undefined })
    setSelectedSquare(null)
  }, [selectedSquare, isMyTurn, gameOver, status, myColor, socket, gameId])

  const canDragPiece = useCallback((args) => {
    if (!isMyTurn || gameOver || status !== 'ACTIVE') return false
    const piece = args?.piece
    const pieceType = piece?.pieceType || (typeof piece === 'string' ? piece : '')
    return pieceType?.[0] === myColor
  }, [isMyTurn, gameOver, status, myColor])

  const handleResign = () => {
    if (window.confirm('Are you sure you want to resign?')) socket.emit('resign', { gameId })
  }
  const handleOfferDraw = () => socket.emit('offer-draw', { gameId })
  const handleAcceptDraw = () => { socket.emit('accept-draw', { gameId }); setDrawOffered(false) }
  const handleDeclineDraw = () => { socket.emit('decline-draw', { gameId }); setDrawOffered(false) }
  const handleCopyId = () => {
    navigator.clipboard.writeText(gameId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Send chat message (ephemeral) ──
  const handleSendMessage = (e) => {
    e?.preventDefault()
    if (!chatInput.trim() || !socket) return
    const msgText = chatInput.trim().slice(0, 200)
    socket.emit('send-message', { gameId, message: msgText })
    setChatMessages(prev => [...prev, { from: user?.id || 'me', message: msgText, timestamp: Date.now(), mine: true }])
    setChatInput('')
  }

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const customSquareStyles = {
    ...(lastMove ? {
      [lastMove.from]: { backgroundColor: 'rgba(214,168,79,0.18)' },
      [lastMove.to]: { backgroundColor: 'rgba(214,168,79,0.32)' },
    } : {}),
    ...(selectedSquare ? { [selectedSquare]: { backgroundColor: 'rgba(214,168,79,0.42)' } } : {}),
  }

  const getResultLabel = () => {
    if (!gameOver) return null
    if (gameOver.result === 'draw') return { title: 'Draw', color: T.draw, sub: gameOver.resultReason?.replace(/_/g, ' ') }
    const iWon = (gameOver.result === 'white' && myColor === 'w') || (gameOver.result === 'black' && myColor === 'b')
    return { title: iWon ? 'Victory' : 'Defeat', color: iWon ? T.win : T.loss, sub: gameOver.resultReason?.replace(/_/g, ' ') }
  }
  const resultLabel = getResultLabel()

  const opponentLabel = myColor === 'w' ? blackPlayer : whitePlayer
  const myLabel = myColor === 'w' ? whitePlayer : blackPlayer

  return (
    <div
      style={{
        minHeight: '100vh', width: '100%',
        color: T.textPrimary,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif',
        WebkitFontSmoothing: 'antialiased',
        backgroundImage: `linear-gradient(rgba(13,10,7,0.78), rgba(13,10,7,0.92)), url('https://images.pexels.com/photos/19327137/pexels-photo-19327137.jpeg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
        backgroundAttachment: 'fixed',
        display: 'flex', flexDirection: 'column',
      }}
    >
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Reconnecting banner */}
      {reconnecting && (
        <div style={{
          background: 'rgba(232,184,75,0.12)', borderBottom: `1px solid rgba(232,184,75,0.25)`,
          color: T.warning, fontSize: 12, textAlign: 'center',
          padding: '7px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.warning, display: 'inline-block', animation: 'pulse 1.2s infinite' }} />
          Reconnecting to game room…
        </div>
      )}

      {/* Header */}
      <header style={{
        borderBottom: `1px solid ${T.borderSubtle}`,
        background: 'rgba(13,10,7,0.65)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        padding: '0 32px', height: 68,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
          onClick={() => navigate('/dashboard')}
        >
          <ArrowLeft size={15} color={T.textMuted} />
          <span style={{ fontSize: 20, color: T.accent }}>♟</span>
          <span style={{ fontWeight: 600, fontSize: 14, letterSpacing: '0.18em', color: T.textPrimary, textTransform: 'uppercase' }}>CHECKMATE</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 12, fontFamily: 'monospace', color: T.textMuted }}>#{gameId}</span>
          {status === 'ACTIVE' && !gameOver && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.win }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: T.win, display: 'inline-block', animation: 'pulse 1.4s infinite' }} />
              Live
            </div>
          )}
        </div>
      </header>

      {/* ── WAITING STATE ── */}
      {status === 'WAITING' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div
            style={{
              background: T.surfaceMain,
              border: `1px solid ${T.border}`,
              borderRadius: 20,
              padding: '36px 40px',
              maxWidth: 420, width: '100%',
              textAlign: 'center',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.55)',
              animation: 'fadeIn 0.4s ease-out',
            }}
          >
            {/* Animated chess icon */}
            <div style={{ fontSize: 40, marginBottom: 20, opacity: 0.9 }}>♞</div>

            <h2 style={{ fontSize: 20, fontWeight: 600, color: T.textPrimary, margin: '0 0 6px' }}>
              Waiting for opponent
            </h2>
            <p style={{ fontSize: 13, color: T.textMuted, margin: '0 0 28px' }}>Share the game code to begin</p>

            {/* Game ID display */}
            <div
              style={{
                background: 'rgba(13,10,7,0.7)',
                border: `1px solid ${T.border}`,
                borderRadius: 14,
                padding: '14px 20px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 20,
              }}
            >
              <span style={{ fontSize: 24, fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.1em', color: T.textPrimary }}>
                {gameId}
              </span>
              <button
                onClick={handleCopyId}
                style={{
                  background: copied ? 'rgba(112,198,154,0.15)' : T.surfaceSub,
                  border: `1px solid ${copied ? T.win : T.border}`,
                  borderRadius: 8, padding: '7px 14px',
                  color: copied ? T.win : T.textSecondary,
                  fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 5,
                  transition: 'all 0.2s',
                }}
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            {/* Pulse status */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 28 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.accent, display: 'inline-block', animation: 'pulse 1.4s infinite' }} />
              <span style={{ fontSize: 13, color: T.textSecondary }}>Room is active and listening…</span>
            </div>

            <button
              onClick={() => navigate('/dashboard')}
              style={{
                background: 'transparent', border: `1px solid ${T.border}`,
                borderRadius: 10, padding: '9px 20px',
                color: T.textMuted, fontSize: 13, cursor: 'pointer',
                transition: 'all 0.15s', width: '100%',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = T.textPrimary; e.currentTarget.style.borderColor = T.accent }}
              onMouseLeave={e => { e.currentTarget.style.color = T.textMuted; e.currentTarget.style.borderColor = T.border }}
            >
              Cancel Match
            </button>
          </div>
        </div>
      )}

      {/* ── ACTIVE GAME ── */}
      {status !== 'WAITING' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 32px' }}>
          <div style={{
            display: 'flex', flexDirection: 'row', gap: 28,
            width: '100%', maxWidth: 960,
            alignItems: 'center', justifyContent: 'center',
          }}>
            {/* Board Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0, width: '100%', maxWidth: 480 }}>

              {/* Opponent clock */}
              <ClockBar
                time={myColor === 'w' ? blackTime : whiteTime}
                label={opponentLabel || 'Opponent'}
                active={currentTurn !== myColor}
                isMe={false}
              />

              {/* Board wrapper */}
              <div style={{
                position: 'relative',
                background: T.surfaceSub,
                border: `1px solid ${T.border}`,
                borderRadius: 16,
                padding: 10,
                boxShadow: '0 16px 60px rgba(0,0,0,0.5)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
              }}>
                <Chessboard
                  options={{
                    id: 'main-board',
                    position: fen,
                    onPieceDrop,
                    onSquareClick,
                    canDragPiece,
                    allowDragging: isMyTurn && status === 'ACTIVE' && !gameOver,
                    boardOrientation: myColor === 'b' ? 'black' : 'white',
                    squareStyles: customSquareStyles,
                    boardStyle: { borderRadius: 8, width: '100%' },
                    darkSquareStyle: { backgroundColor: '#3A2E20' },
                    lightSquareStyle: { backgroundColor: '#C8B89A' },
                  }}
                />
                {moveError && (
                  <div style={{
                    position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
                    background: T.loss, color: '#1A0A0A',
                    fontSize: 12, fontWeight: 600, padding: '6px 14px',
                    borderRadius: 8, zIndex: 20, whiteSpace: 'nowrap',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                    animation: 'fadeIn 0.2s ease-out',
                  }}>
                    {moveError}
                  </div>
                )}
              </div>

              {/* My clock */}
              <ClockBar
                time={myColor === 'w' ? whiteTime : blackTime}
                label={myLabel || user?.username || 'You'}
                active={currentTurn === myColor}
                isMe={true}
              />
            </div>

            {/* Sidebar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 240, minWidth: 200, alignSelf: 'stretch' }}>

              {/* Turn / status banner */}
              {!gameOver && status === 'ACTIVE' && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '10px 14px',
                    borderRadius: 12,
                    border: `1px solid ${isMyTurn ? T.accent : T.border}`,
                    background: isMyTurn ? 'rgba(214,168,79,0.08)' : T.surfaceSub,
                    fontSize: 13, fontWeight: 600,
                    color: isMyTurn ? T.accent : T.textMuted,
                    transition: 'all 0.3s',
                  }}
                >
                  {isMyTurn ? '⚡ Your turn' : 'Waiting for opponent…'}
                </div>
              )}

              {/* Opponent disconnected */}
              {opponentLeft && (
                <div style={{
                  background: 'rgba(232,184,75,0.08)',
                  border: `1px solid rgba(232,184,75,0.25)`,
                  borderRadius: 12, padding: '10px 14px',
                  fontSize: 12, color: T.warning, textAlign: 'center',
                }}>
                  ⚠ Opponent disconnected
                </div>
              )}

              {/* Move history */}
              <div style={{
                background: T.surfaceMain,
                border: `1px solid ${T.border}`,
                borderRadius: 16,
                flex: 1, display: 'flex', flexDirection: 'column',
                overflow: 'hidden', minHeight: 0,
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
              }}>
                <div style={{
                  padding: '10px 14px',
                  borderBottom: `1px solid ${T.borderSubtle}`,
                  fontSize: 11, fontWeight: 600, color: T.textMuted,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>
                  Moves
                </div>
                <div style={{ overflowY: 'auto', flex: 1, padding: '6px 8px' }}>
                  {movePairs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 12, color: T.textMuted }}>
                      No moves yet
                    </div>
                  ) : (
                    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                      <tbody>
                        {movePairs.map((pair, i) => (
                          <tr
                            key={i}
                            style={{
                              borderRadius: 6,
                              background: i % 2 === 0 ? 'transparent' : 'rgba(58,46,32,0.2)',
                            }}
                          >
                            <td style={{ padding: '4px 8px', color: T.textMuted, fontFamily: 'monospace', width: 28 }}>{i + 1}.</td>
                            <td style={{ padding: '4px 8px', color: T.textPrimary, fontFamily: 'monospace', width: 64, fontWeight: 600 }}>{pair.white}</td>
                            <td style={{ padding: '4px 8px', color: T.textSecondary, fontFamily: 'monospace' }}>{pair.black || ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* ── Ephemeral Live Chat Box ── */}
              <div style={{
                background: T.surfaceMain,
                border: `1px solid ${T.border}`,
                borderRadius: 16,
                height: 170,
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden', flexShrink: 0,
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
              }}>
                <div style={{
                  padding: '8px 14px',
                  borderBottom: `1px solid ${T.borderSubtle}`,
                  fontSize: 11, fontWeight: 600, color: T.textMuted,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span>Live Chat</span>
                  <span style={{ fontSize: 10, color: T.textMuted, textTransform: 'none', fontWeight: 400 }}>Ephemeral</span>
                </div>

                {/* Message area */}
                <div style={{
                  flex: 1, overflowY: 'auto', padding: '8px 12px',
                  display: 'flex', flexDirection: 'column', gap: 6,
                }}>
                  {chatMessages.length === 0 ? (
                    <div style={{ fontSize: 11, color: T.textMuted, textAlign: 'center', marginTop: 16 }}>
                      Say hello to your opponent!
                    </div>
                  ) : (
                    chatMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        style={{
                          alignSelf: msg.mine ? 'flex-end' : 'flex-start',
                          maxWidth: '85%',
                          background: msg.mine ? 'rgba(214,168,79,0.15)' : T.surfaceSub,
                          border: `1px solid ${msg.mine ? 'rgba(214,168,79,0.3)' : T.border}`,
                          borderRadius: msg.mine ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                          padding: '5px 9px',
                          fontSize: 11,
                          color: msg.mine ? T.accent : T.textPrimary,
                          wordBreak: 'break-word',
                        }}
                      >
                        {msg.message}
                      </div>
                    ))
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* Chat Input form */}
                <form onSubmit={handleSendMessage} style={{
                  display: 'flex', gap: 6, padding: '6px 8px',
                  borderTop: `1px solid ${T.borderSubtle}`,
                  background: 'rgba(13,10,7,0.4)',
                }}>
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type a message…"
                    maxLength={200}
                    disabled={status !== 'ACTIVE'}
                    style={{
                      flex: 1, background: T.surfaceSub, border: `1px solid ${T.border}`,
                      borderRadius: 8, padding: '5px 10px', color: T.textPrimary,
                      fontSize: 11, outline: 'none',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || status !== 'ACTIVE'}
                    style={{
                      background: chatInput.trim() && status === 'ACTIVE' ? T.accent : T.surfaceSub,
                      color: chatInput.trim() && status === 'ACTIVE' ? '#1A1106' : T.textMuted,
                      border: `1px solid ${T.border}`, borderRadius: 8,
                      width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: chatInput.trim() && status === 'ACTIVE' ? 'pointer' : 'default',
                      transition: 'all 0.15s',
                    }}
                  >
                    <Send size={12} />
                  </button>
                </form>
              </div>

              {/* Draw offer prompt */}
              {drawOffered && (
                <div style={{
                  background: T.surfaceMain,
                  border: `1px solid ${T.border}`,
                  borderRadius: 14, padding: '14px 16px',
                  textAlign: 'center',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                }}>
                  <p style={{ fontSize: 12, color: T.textSecondary, margin: '0 0 12px' }}>Draw offered by opponent</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={handleAcceptDraw}
                      style={{
                        flex: 1, height: 36, background: T.accent, color: '#1A1106',
                        border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = T.accentHover}
                      onMouseLeave={e => e.currentTarget.style.background = T.accent}
                    >
                      Accept
                    </button>
                    <button
                      onClick={handleDeclineDraw}
                      style={{
                        flex: 1, height: 36, background: 'transparent',
                        border: `1px solid ${T.border}`, borderRadius: 8,
                        fontSize: 12, color: T.textSecondary, cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = T.surfaceSub; e.currentTarget.style.color = T.textPrimary }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.textSecondary }}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              {!gameOver && status === 'ACTIVE' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleOfferDraw}
                    style={{
                      flex: 1, height: 40,
                      background: 'transparent',
                      border: `1px solid ${T.border}`,
                      borderRadius: 10, fontSize: 13,
                      color: T.textSecondary, cursor: 'pointer',
                      fontWeight: 500,
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = T.surfaceSub; e.currentTarget.style.color = T.textPrimary; e.currentTarget.style.borderColor = T.accent }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.textSecondary; e.currentTarget.style.borderColor = T.border }}
                  >
                    Draw
                  </button>
                  <button
                    onClick={handleResign}
                    style={{
                      flex: 1, height: 40,
                      background: 'transparent',
                      border: `1px solid rgba(229,115,115,0.35)`,
                      borderRadius: 10, fontSize: 13,
                      color: T.loss, cursor: 'pointer',
                      fontWeight: 500,
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(229,115,115,0.08)'; e.currentTarget.style.borderColor = T.loss }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(229,115,115,0.35)' }}
                  >
                    Resign
                  </button>
                </div>
              )}

              {gameOver && (
                <button
                  onClick={() => navigate('/dashboard')}
                  style={{
                    height: 42, background: T.accent, color: '#1A1106',
                    border: 'none', borderRadius: 10, fontSize: 13,
                    fontWeight: 600, cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = T.accentHover}
                  onMouseLeave={e => e.currentTarget.style.background = T.accent}
                >
                  Back to Dashboard
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Game Over Modal ── */}
      {showGameOver && resultLabel && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(13,10,7,0.8)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 50, padding: 16,
        }}>
          <div style={{
            background: T.surfaceMain,
            border: `1px solid ${T.border}`,
            borderRadius: 20, padding: '36px 40px',
            maxWidth: 340, width: '100%',
            textAlign: 'center',
            boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
            animation: 'fadeIn 0.35s ease-out',
          }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>
              {resultLabel.title === 'Victory' ? '🏆' : resultLabel.title === 'Draw' ? '🤝' : '♟'}
            </div>
            <h2 style={{ fontSize: 26, fontWeight: 600, color: resultLabel.color, margin: '0 0 8px' }}>
              {resultLabel.title}
            </h2>
            <p style={{ fontSize: 13, color: T.textMuted, margin: '0 0 28px', textTransform: 'capitalize' }}>
              {resultLabel.sub || 'Game completed'}
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                width: '100%', height: 44,
                background: T.accent, color: '#1A1106',
                border: 'none', borderRadius: 12,
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = T.accentHover}
              onMouseLeave={e => e.currentTarget.style.background = T.accent}
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
