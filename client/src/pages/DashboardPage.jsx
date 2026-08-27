import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { createGame, joinGame, getGame, getHistory } from '../services/gameService'
import {
  Plus, LogIn, LogOut, Clock, ArrowRight, ChevronRight,
  Gamepad2, Trophy, Handshake, LineChart, ChevronDown
} from 'lucide-react'

// ── Design Tokens ──────────────────────────────────────────────────────────────
const T = {
  bgOverlay: '#0D0A07',
  surfaceMain: 'rgba(18, 14, 10, 0.88)',
  surfaceSub: 'rgba(28, 22, 16, 0.82)',
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
}

// ── Circular Progress ──────────────────────────────────────────────────────────
function CircularProgress({ percentage }) {
  const radius = 24
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percentage / 100) * circumference
  return (
    <div className="relative flex items-center justify-center w-16 h-16">
      <svg className="w-16 h-16 transform -rotate-90">
        <circle stroke="rgba(58,46,32,0.6)" strokeWidth="4" fill="transparent" r={radius} cx="32" cy="32" />
        <circle
          stroke={T.accent}
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          r={radius}
          cx="32"
          cy="32"
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
      </svg>
      <span style={{ fontSize: 11, fontWeight: 700, color: T.accent }} className="absolute">{percentage}%</span>
    </div>
  )
}

// ── Stat Card ──────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, extra }) {
  return (
    <div
      style={{
        background: T.surfaceSub,
        border: `1px solid ${T.border}`,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: 16,
        padding: '24px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div
            style={{
              width: 38, height: 38, borderRadius: 10,
              background: 'rgba(214,168,79,0.12)',
              border: `1px solid rgba(214,168,79,0.25)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: T.accent,
            }}
          >
            <Icon size={18} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary }}>{label}</span>
        </div>
        <div style={{ fontSize: 32, fontWeight: 600, color: T.textPrimary, lineHeight: 1, marginBottom: 6 }}>{value}</div>
        <div style={{ fontSize: 12, color: T.textMuted }}>{sub}</div>
      </div>
      {extra}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [modal, setModal] = useState(null)
  const [createdGameId, setCreatedGameId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [waitingStatus, setWaitingStatus] = useState('waiting')
  const [copied, setCopied] = useState(false)
  const pollRef = useRef(null)

  const [joinId, setJoinId] = useState('')
  const [joinError, setJoinError] = useState('')
  const [joining, setJoining] = useState(false)

  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)

  useEffect(() => {
    getHistory()
      .then((res) => setHistory(res.data.games || []))
      .catch(() => {})
      .finally(() => setHistoryLoading(false))
  }, [])

  const stats = useMemo(() => {
    const total = history.length
    if (total === 0) return { gamesPlayed: 0, wins: 0, draws: 0, losses: 0, winRate: 0 }
    const wins = history.filter((g) => {
      const isWinner = g.winner?._id === user?.id || g.winner?.username === user?.username
      return isWinner && g.result !== 'draw'
    }).length
    const draws = history.filter((g) => g.result === 'draw').length
    const losses = total - wins - draws
    const winRate = Math.round((wins / total) * 100)
    return { gamesPlayed: total, wins, draws, losses, winRate }
  }, [history, user])

  useEffect(() => {
    if (createdGameId && waitingStatus === 'waiting') {
      pollRef.current = setInterval(async () => {
        try {
          const res = await getGame(createdGameId)
          if (res.data?.game?.status === 'ACTIVE') {
            clearInterval(pollRef.current)
            setWaitingStatus('active')
            setTimeout(() => navigate(`/game/${createdGameId}`), 800)
          }
        } catch { }
      }, 2000)
    }
    return () => clearInterval(pollRef.current)
  }, [createdGameId, waitingStatus, navigate])

  const [selectedTimeControl, setSelectedTimeControl] = useState(10)

  const handleCreateGame = async (timeMinutes = selectedTimeControl) => {
    setCreating(true)
    try {
      const res = await createGame(timeMinutes)
      setCreatedGameId(res.data.gameId)
      setModal('create')
      setWaitingStatus('waiting')
    } catch {
      alert('Failed to create game. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  const handleJoinGame = async (e) => {
    e.preventDefault()
    if (!joinId.trim()) return
    setJoinError('')
    setJoining(true)
    try {
      await joinGame(joinId.trim())
      navigate(`/game/${joinId.trim()}`)
    } catch (err) {
      setJoinError(err.response?.data?.message || 'Failed to join game')
    } finally {
      setJoining(false)
    }
  }

  const handleCopyId = () => {
    if (!createdGameId) return
    navigator.clipboard.writeText(createdGameId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCloseModal = () => {
    clearInterval(pollRef.current)
    setModal(null)
    setCreatedGameId(null)
    setWaitingStatus('waiting')
    setCopied(false)
    setJoinId('')
    setJoinError('')
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const getOpponent = (game) => {
    const isWhite = game.whitePlayer?.username === user?.username
    return isWhite ? game.blackPlayer?.username : game.whitePlayer?.username
  }

  const renderResult = (game) => {
    if (game.result === 'draw') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', color: T.draw }}>DRAW</span>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.draw, display: 'inline-block' }} />
        </div>
      )
    }
    const won = game.winner?._id === user?.id || game.winner?.username === user?.username
    if (won) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', color: T.win }}>WIN</span>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.win, display: 'inline-block' }} />
        </div>
      )
    }
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', color: T.loss }}>LOSS</span>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.loss, display: 'inline-block' }} />
      </div>
    )
  }

  // ── Shared modal backdrop ──
  const backdropStyle = {
    position: 'fixed', inset: 0,
    background: 'rgba(13,10,7,0.85)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 50, padding: 16,
  }

  const modalCardStyle = {
    background: T.surfaceMain,
    border: `1px solid ${T.border}`,
    borderRadius: 20,
    padding: '28px 32px',
    width: '100%', maxWidth: 400,
    boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        color: T.textPrimary,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif',
        WebkitFontSmoothing: 'antialiased',
        backgroundImage: `linear-gradient(rgba(13,10,7,0.72), rgba(13,10,7,0.88)), url('https://images.pexels.com/photos/19327137/pexels-photo-19327137.jpeg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
        backgroundAttachment: 'fixed',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* ── Navbar ── */}
      <header
        style={{
          width: '100%',
          borderBottom: `1px solid ${T.borderSubtle}`,
          background: 'rgba(13,10,7,0.65)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        <div
          style={{
            maxWidth: 1280, margin: '0 auto',
            padding: '0 32px', height: 68,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}
        >
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20, color: T.accent }}>♟</span>
            <span
              style={{
                fontWeight: 600,
                fontSize: 14,
                letterSpacing: '0.18em',
                color: T.textPrimary,
                textTransform: 'uppercase',
              }}
            >
              CHECKMATE
            </span>
          </div>

          {/* Nav */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 32, height: '100%' }}>
            {[
              { label: 'Dashboard', path: '/dashboard', active: true },
              { label: 'History', path: '/history', active: false },
            ].map(({ label, path, active }) => (
              <div key={label} style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center' }}>
                <button
                  onClick={() => navigate(path)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 14, fontWeight: 500,
                    color: active ? T.textPrimary : T.textMuted,
                    transition: 'color 0.15s',
                  }}
                >
                  {label}
                </button>
                {active && (
                  <div
                    style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      height: 2, background: T.accent, borderRadius: 1,
                    }}
                  />
                )}
              </div>
            ))}
          </nav>

          {/* Right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: T.surfaceSub,
                border: `1px solid ${T.border}`,
                borderRadius: 99,
                padding: '5px 14px 5px 6px',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: 'rgba(214,168,79,0.15)',
                  border: `1px solid rgba(214,168,79,0.3)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, color: T.accent,
                }}
              >
                {user?.username?.substring(0, 2).toUpperCase() || 'US'}
              </div>
              <span style={{ fontSize: 12, fontFamily: 'monospace', color: T.textSecondary }}>
                {user?.username}
              </span>
              <ChevronDown size={13} color={T.textMuted} />
            </div>
            <button
              onClick={handleLogout}
              style={{
                background: 'none', border: `1px solid ${T.border}`,
                borderRadius: 10, padding: 8, cursor: 'pointer',
                color: T.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = T.textPrimary; e.currentTarget.style.borderColor = T.border }}
              onMouseLeave={e => { e.currentTarget.style.color = T.textMuted; e.currentTarget.style.borderColor = T.border }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main
        style={{
          flex: 1, width: '100%', maxWidth: 1280,
          padding: '48px 32px',
          display: 'flex', flexDirection: 'column', gap: 28,
        }}
      >
        {/* 1. Welcome Row */}
        <div
          style={{
            background: T.surfaceMain,
            border: `1px solid ${T.border}`,
            borderRadius: 20,
            padding: '32px 36px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 24,
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.35)',
          }}
        >
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 600, color: T.textPrimary, margin: 0, lineHeight: 1.2 }}>
              Welcome back, {user?.username}
            </h1>
            <p style={{ fontSize: 14, color: T.textSecondary, marginTop: 6, margin: '6px 0 0' }}>
              Ready for another game?
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            {/* Create Game */}
            <button
              onClick={() => setModal('select-time')}
              disabled={creating}
              style={{
                height: 44,
                background: T.accent,
                color: '#1A1106',
                border: 'none',
                borderRadius: 12,
                padding: '0 22px',
                fontWeight: 600,
                fontSize: 14,
                cursor: creating ? 'not-allowed' : 'pointer',
                opacity: creating ? 0.65 : 1,
                display: 'flex', alignItems: 'center', gap: 8,
                transition: 'background 0.15s, transform 0.1s',
                boxShadow: '0 4px 16px rgba(214,168,79,0.25)',
              }}
              onMouseEnter={e => { if (!creating) e.currentTarget.style.background = T.accentHover }}
              onMouseLeave={e => { e.currentTarget.style.background = T.accent }}
              onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.98)' }}
              onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
            >
              <Plus size={16} />
              Create Game
            </button>

            {/* Join Game */}
            <button
              onClick={() => setModal('join')}
              style={{
                height: 44,
                background: 'transparent',
                color: T.textPrimary,
                border: `1px solid ${T.border}`,
                borderRadius: 12,
                padding: '0 22px',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
                transition: 'background 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = T.surfaceSub; e.currentTarget.style.borderColor = T.accent }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = T.border }}
            >
              <LogIn size={16} color={T.textSecondary} />
              Join Game
            </button>
          </div>
        </div>

        {/* 2. Recent Games */}
        <div
          style={{
            background: T.surfaceMain,
            border: `1px solid ${T.border}`,
            borderRadius: 20,
            overflow: 'hidden',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.35)',
          }}
        >
          {/* Card Header */}
          <div
            style={{
              padding: '20px 32px',
              borderBottom: `1px solid ${T.borderSubtle}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Clock size={18} color={T.accent} />
              <h2 style={{ fontSize: 18, fontWeight: 600, color: T.textPrimary, margin: 0 }}>Recent Games</h2>
            </div>
            <button
              onClick={() => navigate('/history')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 500, color: T.accent,
                display: 'flex', alignItems: 'center', gap: 6,
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = T.accentHover}
              onMouseLeave={e => e.currentTarget.style.color = T.accent}
            >
              View All History <ArrowRight size={14} />
            </button>
          </div>

          {/* Table */}
          <div style={{ minHeight: 260 }}>
            {historyLoading ? (
              <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 24, height: 24, border: `2px solid ${T.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              </div>
            ) : history.length === 0 ? (
              <div style={{ height: 260, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <p style={{ fontSize: 15, color: T.textPrimary, margin: 0 }}>No games recorded yet</p>
                <p style={{ fontSize: 13, color: T.textMuted, margin: 0 }}>Create or join a game to get started.</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr>
                    {['Opponent', 'Result', 'Reason', 'Date', ''].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: '14px 32px',
                          textAlign: h === '' ? 'right' : 'left',
                          fontSize: 12, fontWeight: 500,
                          color: T.textMuted,
                          letterSpacing: '0.04em',
                          borderBottom: `1px solid ${T.borderSubtle}`,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((game) => {
                    const opponentName = getOpponent(game) || 'Unknown'
                    const initial = opponentName.charAt(0).toUpperCase()
                    return (
                      <tr
                        key={game._id}
                        onClick={() => navigate(`/history/${game.gameId}`)}
                        style={{ cursor: 'pointer', transition: 'background 0.15s', borderBottom: `1px solid ${T.borderSubtle}` }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(214,168,79,0.05)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '18px 32px', color: T.textPrimary, fontWeight: 600 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div
                              style={{
                                width: 32, height: 32, borderRadius: '50%',
                                background: 'rgba(58,46,32,0.8)',
                                border: `1px solid ${T.border}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 13, fontWeight: 700, color: T.textSecondary,
                              }}
                            >
                              {initial}
                            </div>
                            {opponentName}
                          </div>
                        </td>
                        <td style={{ padding: '18px 32px' }}>{renderResult(game)}</td>
                        <td style={{ padding: '18px 32px', color: T.textSecondary, textTransform: 'capitalize' }}>
                          {game.resultReason?.replace(/_/g, ' ') || 'Checkmate'}
                        </td>
                        <td style={{ padding: '18px 32px', color: T.textMuted }}>{formatDate(game.completedAt)}</td>
                        <td style={{ padding: '18px 32px', textAlign: 'right' }}>
                          <ChevronRight size={16} color={T.textMuted} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* 3. Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
          <StatCard icon={Gamepad2} label="Games Played" value={stats.gamesPlayed} sub="Total games logged" />
          <StatCard icon={Trophy} label="Wins" value={stats.wins} sub="You won" />
          <StatCard icon={Handshake} label="Draws" value={stats.draws} sub="Games drawn" />
          <StatCard
            icon={LineChart}
            label="Win Rate"
            value={`${stats.winRate}%`}
            sub={stats.gamesPlayed > 0 ? `${stats.wins} of ${stats.gamesPlayed} games won` : '0 of 0 games won'}
            extra={<CircularProgress percentage={stats.winRate} />}
          />
        </div>
      </main>

      {/* ── Spin Keyframe ── */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Select Time Control Modal ── */}
      {modal === 'select-time' && (
        <div style={backdropStyle} onClick={handleCloseModal}>
          <div style={{ ...modalCardStyle, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h3 style={{ color: T.textPrimary, fontSize: 18, fontWeight: 600, margin: '0 0 4px' }}>Select Time Control</h3>
                <p style={{ color: T.textMuted, fontSize: 12, margin: 0 }}>Choose match clock format (no increment per move)</p>
              </div>
              <button onClick={handleCloseModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textMuted, fontSize: 20, lineHeight: 1 }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {[
                { min: 3, label: '3 Minutes', tag: '⚡ Bullet / Fast Blitz', desc: '3:00 per player • 0s add-on' },
                { min: 5, label: '5 Minutes', tag: '⏱ Standard Blitz', desc: '5:00 per player • 0s add-on' },
                { min: 10, label: '10 Minutes', tag: '⌛ Rapid', desc: '10:00 per player • 0s add-on' },
              ].map((opt) => (
                <button
                  key={opt.min}
                  onClick={() => handleCreateGame(opt.min)}
                  disabled={creating}
                  style={{
                    background: T.surfaceSub,
                    border: `1px solid ${selectedTimeControl === opt.min ? T.accent : T.border}`,
                    borderRadius: 14, padding: '14px 18px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    cursor: creating ? 'not-allowed' : 'pointer',
                    textAlign: 'left', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.background = 'rgba(214,168,79,0.08)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = T.surfaceSub }}
                >
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary, marginBottom: 2 }}>{opt.label}</div>
                    <div style={{ fontSize: 12, color: T.textMuted }}>{opt.desc}</div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: T.accent,
                    background: 'rgba(214,168,79,0.12)', border: '1px solid rgba(214,168,79,0.25)',
                    padding: '4px 10px', borderRadius: 8,
                  }}>
                    {opt.tag}
                  </span>
                </button>
              ))}
            </div>

            {creating && (
              <div style={{ textAlign: 'center', fontSize: 13, color: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span style={{ width: 14, height: 14, border: `2px solid ${T.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                Generating game room…
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Create Game Modal ── */}
      {modal === 'create' && (
        <div style={backdropStyle} onClick={handleCloseModal}>
          <div style={modalCardStyle} onClick={e => e.stopPropagation()}>
            {waitingStatus === 'active' ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ width: 10, height: 10, background: T.win, borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
                <h3 style={{ color: T.textPrimary, fontSize: 16, fontWeight: 600, margin: '0 0 6px' }}>Opponent Joined</h3>
                <p style={{ color: T.textMuted, fontSize: 13, margin: 0 }}>Starting match room…</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                  <div>
                    <h3 style={{ color: T.textPrimary, fontSize: 16, fontWeight: 600, margin: '0 0 4px' }}>Create Game</h3>
                    <p style={{ color: T.textMuted, fontSize: 12, margin: 0 }}>Share the Game ID with your opponent</p>
                  </div>
                  <button onClick={handleCloseModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textMuted, fontSize: 18, lineHeight: 1 }}>×</button>
                </div>

                <div style={{ background: 'rgba(13,10,7,0.7)', border: `1px solid ${T.border}`, borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 4 }}>Game ID</div>
                    <div style={{ fontSize: 22, fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.1em', color: T.textPrimary }}>{createdGameId}</div>
                  </div>
                  <button
                    onClick={handleCopyId}
                    style={{
                      background: copied ? 'rgba(112,198,154,0.15)' : T.surfaceSub,
                      border: `1px solid ${copied ? T.win : T.border}`,
                      borderRadius: 8, padding: '7px 14px',
                      color: copied ? T.win : T.textSecondary,
                      fontSize: 12, fontWeight: 500, cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.accent, display: 'inline-block', animation: 'spin 2s linear infinite' }} />
                  <span style={{ fontSize: 12, color: T.textMuted }}>Waiting for opponent to connect…</span>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => navigate(`/game/${createdGameId}`)}
                    style={{
                      flex: 1, height: 42, background: T.accent, color: '#1A1106',
                      border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 13,
                      cursor: 'pointer', transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = T.accentHover}
                    onMouseLeave={e => e.currentTarget.style.background = T.accent}
                  >
                    Enter Room
                  </button>
                  <button
                    onClick={handleCloseModal}
                    style={{
                      height: 42, padding: '0 18px', background: 'transparent',
                      border: `1px solid ${T.border}`, borderRadius: 10,
                      color: T.textSecondary, fontSize: 13, cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = T.surfaceSub; e.currentTarget.style.color = T.textPrimary }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.textSecondary }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Join Game Modal ── */}
      {modal === 'join' && (
        <div style={backdropStyle} onClick={handleCloseModal}>
          <div style={modalCardStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h3 style={{ color: T.textPrimary, fontSize: 16, fontWeight: 600, margin: '0 0 4px' }}>Join Game</h3>
                <p style={{ color: T.textMuted, fontSize: 12, margin: 0 }}>Enter the Game ID from your opponent</p>
              </div>
              <button onClick={handleCloseModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textMuted, fontSize: 18, lineHeight: 1 }}>×</button>
            </div>

            <form onSubmit={handleJoinGame} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {joinError && (
                <div style={{ background: 'rgba(229,115,115,0.1)', border: `1px solid rgba(229,115,115,0.3)`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: T.loss }}>
                  {joinError}
                </div>
              )}

              <input
                type="text"
                value={joinId}
                onChange={e => { setJoinId(e.target.value); setJoinError('') }}
                placeholder="Enter Game ID"
                maxLength={12}
                autoFocus
                style={{
                  background: 'rgba(13,10,7,0.7)',
                  border: `1px solid ${T.border}`,
                  borderRadius: 10, height: 44, padding: '0 16px',
                  color: T.textPrimary, fontSize: 14,
                  fontFamily: 'monospace', letterSpacing: '0.08em',
                  outline: 'none', transition: 'border-color 0.15s',
                  width: '100%', boxSizing: 'border-box',
                }}
                onFocus={e => e.target.style.borderColor = T.accent}
                onBlur={e => e.target.style.borderColor = T.border}
              />

              <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                <button
                  type="submit"
                  disabled={joining || !joinId.trim()}
                  style={{
                    flex: 1, height: 42, background: T.accent, color: '#1A1106',
                    border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 13,
                    cursor: joining || !joinId.trim() ? 'not-allowed' : 'pointer',
                    opacity: joining || !joinId.trim() ? 0.55 : 1,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (!joining && joinId.trim()) e.currentTarget.style.background = T.accentHover }}
                  onMouseLeave={e => { e.currentTarget.style.background = T.accent }}
                >
                  {joining ? 'Connecting…' : 'Join Game'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  style={{
                    height: 42, padding: '0 18px', background: 'transparent',
                    border: `1px solid ${T.border}`, borderRadius: 10,
                    color: T.textSecondary, fontSize: 13, cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = T.surfaceSub; e.currentTarget.style.color = T.textPrimary }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.textSecondary }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
