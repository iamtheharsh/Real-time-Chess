import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getHistory } from '../services/gameService'
import { ArrowLeft, ChevronRight, Clock } from 'lucide-react'

// ── Design Tokens (same as Dashboard) ─────────────────────────────────────────
const T = {
  bgOverlay: '#0D0A07',
  surfaceMain: 'rgba(18, 14, 10, 0.90)',
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

export default function HistoryPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getHistory()
      .then((res) => setHistory(res.data.games || []))
      .catch((err) => setError(err.response?.data?.message || 'Failed to fetch game history'))
      .finally(() => setLoading(false))
  }, [])

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  }

  const getOpponent = (game) => {
    const isWhite = game.whitePlayer?.username === user?.username
    return isWhite ? game.blackPlayer?.username : game.whitePlayer?.username
  }

  const renderResult = (game) => {
    if (game.result === 'draw') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: T.draw }}>DRAW</span>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.draw, display: 'inline-block' }} />
        </div>
      )
    }
    const won = game.winner?._id === user?.id || game.winner?.username === user?.username
    if (won) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: T.win }}>WIN</span>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.win, display: 'inline-block' }} />
        </div>
      )
    }
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: T.loss }}>LOSS</span>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.loss, display: 'inline-block' }} />
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        color: T.textPrimary,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif',
        WebkitFontSmoothing: 'antialiased',
        backgroundImage: `linear-gradient(rgba(13,10,7,0.72), rgba(13,10,7,0.92)), url('https://images.pexels.com/photos/19327137/pexels-photo-19327137.jpeg')`,
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
          {/* Back */}
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              color: T.textMuted, fontSize: 13, fontWeight: 500,
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = T.textPrimary}
            onMouseLeave={e => e.currentTarget.style.color = T.textMuted}
          >
            <ArrowLeft size={15} />
            Dashboard
          </button>

          {/* Center title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20, color: T.accent }}>♟</span>
            <span style={{ fontWeight: 600, fontSize: 15, color: T.textPrimary }}>Match History</span>
          </div>

          {/* Game count badge */}
          <div
            style={{
              background: T.surfaceSub,
              border: `1px solid ${T.border}`,
              borderRadius: 99,
              padding: '4px 12px',
              fontSize: 12,
              color: T.textMuted,
              fontWeight: 500,
            }}
          >
            {loading ? '…' : `${history.length} ${history.length === 1 ? 'game' : 'games'}`}
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main
        style={{
          flex: 1, width: '100%', maxWidth: 1280,
          padding: '48px 32px',
          display: 'flex', flexDirection: 'column', gap: 28,
        }}
      >
        {/* Page header */}
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 600, color: T.textPrimary, margin: '0 0 8px' }}>All Matches</h1>
          <p style={{ fontSize: 14, color: T.textSecondary, margin: 0 }}>Review past games and inspect move logs</p>
        </div>

        {/* Content Card */}
        {loading ? (
          <div
            style={{
              background: T.surfaceMain,
              border: `1px solid ${T.border}`,
              borderRadius: 20,
              padding: '80px 32px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              boxShadow: '0 8px 40px rgba(0,0,0,0.35)',
            }}
          >
            <div
              style={{
                width: 28, height: 28,
                border: `2px solid ${T.accent}`,
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 0.7s linear infinite',
              }}
            />
          </div>
        ) : error ? (
          <div
            style={{
              background: T.surfaceMain,
              border: `1px solid rgba(229,115,115,0.3)`,
              borderRadius: 20, padding: '32px',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              color: T.loss, fontSize: 14, textAlign: 'center',
            }}
          >
            {error}
          </div>
        ) : history.length === 0 ? (
          <div
            style={{
              background: T.surfaceMain,
              border: `1px solid ${T.border}`,
              borderRadius: 20, padding: '80px 32px',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              boxShadow: '0 8px 40px rgba(0,0,0,0.35)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
            }}
          >
            <Clock size={32} color={T.textMuted} />
            <p style={{ color: T.textPrimary, fontSize: 16, fontWeight: 600, margin: 0 }}>No completed matches yet</p>
            <p style={{ color: T.textMuted, fontSize: 13, margin: 0 }}>Play a game to see it recorded here.</p>
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                marginTop: 8,
                background: T.accent,
                color: '#1A1106',
                border: 'none',
                borderRadius: 10,
                padding: '10px 20px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = T.accentHover}
              onMouseLeave={e => e.currentTarget.style.background = T.accent}
            >
              Go to Dashboard
            </button>
          </div>
        ) : (
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
            {/* Card header */}
            <div
              style={{
                padding: '20px 32px',
                borderBottom: `1px solid ${T.borderSubtle}`,
                display: 'flex', alignItems: 'center', gap: 10,
              }}
            >
              <Clock size={18} color={T.accent} />
              <h2 style={{ fontSize: 18, fontWeight: 600, color: T.textPrimary, margin: 0 }}>Game Records</h2>
              <span
                style={{
                  marginLeft: 'auto',
                  background: 'rgba(214,168,79,0.12)',
                  border: `1px solid rgba(214,168,79,0.25)`,
                  borderRadius: 99,
                  padding: '2px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: T.accent,
                  letterSpacing: '0.04em',
                }}
              >
                {history.length} TOTAL
              </span>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr>
                    {['Opponent', 'Result', 'Played As', 'Reason', 'Date', ''].map((h, i) => (
                      <th
                        key={i}
                        style={{
                          padding: '14px 32px',
                          textAlign: i === 5 ? 'right' : 'left',
                          fontSize: 12,
                          fontWeight: 500,
                          color: T.textMuted,
                          letterSpacing: '0.04em',
                          borderBottom: `1px solid ${T.borderSubtle}`,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((game) => {
                    const isWhite = game.whitePlayer?.username === user?.username
                    const opponentName = getOpponent(game) || 'Unknown'
                    const initial = opponentName.charAt(0).toUpperCase()

                    return (
                      <tr
                        key={game._id}
                        onClick={() => navigate(`/history/${game.gameId}`)}
                        style={{
                          cursor: 'pointer',
                          transition: 'background 0.15s',
                          borderBottom: `1px solid ${T.borderSubtle}`,
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(214,168,79,0.05)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        {/* Opponent */}
                        <td style={{ padding: '18px 32px', color: T.textPrimary, fontWeight: 600, whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div
                              style={{
                                width: 34, height: 34, borderRadius: '50%',
                                background: 'rgba(58,46,32,0.8)',
                                border: `1px solid ${T.border}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 13, fontWeight: 700, color: T.textSecondary,
                                flexShrink: 0,
                              }}
                            >
                              {initial}
                            </div>
                            {opponentName}
                          </div>
                        </td>

                        {/* Result */}
                        <td style={{ padding: '18px 32px', whiteSpace: 'nowrap' }}>
                          {renderResult(game)}
                        </td>

                        {/* Played As */}
                        <td style={{ padding: '18px 32px', whiteSpace: 'nowrap' }}>
                          <div
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 6,
                              background: isWhite ? 'rgba(245,240,232,0.08)' : 'rgba(28,22,16,0.8)',
                              border: `1px solid ${T.border}`,
                              borderRadius: 99,
                              padding: '3px 10px',
                              fontSize: 11,
                              fontWeight: 500,
                              color: isWhite ? T.textSecondary : T.textMuted,
                            }}
                          >
                            <span
                              style={{
                                width: 8, height: 8, borderRadius: '50%',
                                background: isWhite ? '#E8E0D0' : '#2A2018',
                                border: `1px solid ${T.border}`,
                                display: 'inline-block',
                              }}
                            />
                            {isWhite ? 'White' : 'Black'}
                          </div>
                        </td>

                        {/* Reason */}
                        <td style={{ padding: '18px 32px', color: T.textSecondary, fontSize: 13, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                          {game.resultReason?.replace(/_/g, ' ') || 'Checkmate'}
                        </td>

                        {/* Date */}
                        <td style={{ padding: '18px 32px', color: T.textMuted, fontSize: 13, whiteSpace: 'nowrap' }}>
                          {formatDate(game.completedAt)}
                        </td>

                        {/* Chevron */}
                        <td style={{ padding: '18px 32px', textAlign: 'right' }}>
                          <ChevronRight size={16} color={T.textMuted} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
