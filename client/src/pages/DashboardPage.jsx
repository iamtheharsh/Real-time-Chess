import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { createGame, joinGame, getGame, getHistory } from '../services/gameService'

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  // Modal states
  const [modal, setModal] = useState(null) // null | 'create' | 'join'
  const [createdGameId, setCreatedGameId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [waitingStatus, setWaitingStatus] = useState('waiting') // 'waiting' | 'active'
  const [copied, setCopied] = useState(false)
  const pollRef = useRef(null)

  // Join game state
  const [joinId, setJoinId] = useState('')
  const [joinError, setJoinError] = useState('')
  const [joining, setJoining] = useState(false)

  // History state
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)

  // Load history on mount
  useEffect(() => {
    getHistory()
      .then((res) => setHistory(res.data.games || []))
      .catch(() => {})
      .finally(() => setHistoryLoading(false))
  }, [])

  // Dynamic statistics calculation
  const stats = useMemo(() => {
    const total = history.length
    if (total === 0) {
      return { gamesPlayed: 0, wins: 0, draws: 0, losses: 0, winRate: 0 }
    }

    const wins = history.filter((g) => {
      const isWinner = g.winner?._id === user?.id || g.winner?.username === user?.username
      return isWinner && g.result !== 'draw'
    }).length

    const draws = history.filter((g) => g.result === 'draw').length
    const losses = total - wins - draws
    const winRate = Math.round((wins / total) * 100)

    return { gamesPlayed: total, wins, draws, losses, winRate }
  }, [history, user])

  // Poll game status while waiting in create modal
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
        } catch {
          // ignore transient poll errors
        }
      }, 2000)
    }
    return () => clearInterval(pollRef.current)
  }, [createdGameId, waitingStatus, navigate])

  const handleCreateGame = async () => {
    setCreating(true)
    try {
      const res = await createGame()
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
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  const getResultLabel = (game) => {
    if (game.result === 'draw') {
      return <span className="text-xs font-semibold text-[#A1A1AA]">DRAW</span>
    }
    const won = game.winner?._id === user?.id || game.winner?.username === user?.username
    if (won) {
      return <span className="text-xs font-semibold text-[#6EE7B7]">WIN</span>
    }
    return <span className="text-xs font-semibold text-[#F87171]">LOSS</span>
  }

  const getOpponent = (game) => {
    const isWhite = game.whitePlayer?.username === user?.username
    return isWhite ? game.blackPlayer?.username : game.whitePlayer?.username
  }

  return (
    <div className="relative min-h-screen bg-[#0A0A0B] text-[#F5F5F7] flex flex-col font-sans selection:bg-[#6EE7B7]/20 selection:text-[#6EE7B7]">
      
      {/* Background Atmosphere */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat pointer-events-none opacity-25"
        style={{ backgroundImage: 'url(/dashboard-bg.jpg)' }}
      />
      <div className="fixed inset-0 bg-gradient-to-b from-[#0A0A0B]/90 via-[#0A0A0B]/95 to-[#0A0A0B] pointer-events-none" />

      {/* ── Top Navbar (Compact 56px) ── */}
      <header className="border-b border-[#27272A] bg-[#0A0A0B]/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-[1180px] mx-auto px-5 sm:px-6 h-14 flex items-center justify-between">
          
          {/* Brand */}
          <div className="flex items-center gap-2">
            <span className="text-base text-[#F5F5F7]">♟</span>
            <span className="font-bold text-xs tracking-[0.2em] text-[#F5F5F7] uppercase">CHECKMATE</span>
          </div>

          {/* Nav Center */}
          <nav className="flex items-center gap-6 text-xs sm:text-sm">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-[#F5F5F7] font-medium transition"
            >
              Dashboard
            </button>
            <button
              onClick={() => navigate('/history')}
              className="text-[#A1A1AA] hover:text-[#F5F5F7] font-medium transition"
            >
              History
            </button>
          </nav>

          {/* Right Profile & Logout */}
          <div className="flex items-center gap-3">
            <div className="text-xs text-[#E4E4E7] bg-[#161618] border border-[#27272A] rounded-md px-2.5 py-1 font-mono">
              {user?.username}
            </div>
            <button
              onClick={handleLogout}
              className="text-xs text-[#A1A1AA] hover:text-[#F5F5F7] transition px-2 py-1 rounded hover:bg-[#1B1B1E]"
            >
              Logout
            </button>
          </div>

        </div>
      </header>

      {/* ── Main Content (Tight 20px - 28px vertical rhythm) ── */}
      <main className="relative z-10 flex-1 max-w-[1180px] mx-auto w-full px-5 sm:px-6 pt-5 pb-10 space-y-6">
        
        {/* 1. Welcome & Actions Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F5F5F7]">
              Welcome back, {user?.username}
            </h1>
            <p className="text-[#A1A1AA] text-xs sm:text-sm mt-0.5 font-normal">
              Ready for another game?
            </p>
          </div>

          {/* Actions Baseline Aligned */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <button
              onClick={handleCreateGame}
              disabled={creating}
              className="h-9.5 bg-[#F5F5F7] hover:bg-white text-[#0A0A0B] font-semibold text-xs px-4.5 rounded-lg transition duration-150 shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] disabled:opacity-60"
            >
              {creating ? (
                <>
                  <span className="w-3 h-3 border-2 border-[#0A0A0B] border-t-transparent rounded-full animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create Game</span>
              )}
            </button>

            <button
              onClick={() => setModal('join')}
              className="h-9.5 bg-[#161618] hover:bg-[#202024] text-[#F5F5F7] border border-[#27272A] font-semibold text-xs px-4.5 rounded-lg transition duration-150 cursor-pointer active:scale-[0.99]"
            >
              Join Game
            </button>
          </div>
        </div>

        {/* 2. Performance Stats Section (Directly Below Welcome Header) */}
        <div className="space-y-2.5">
          <div className="text-[11px] font-semibold text-[#A1A1AA] uppercase tracking-wider">
            Performance
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            
            {/* Games Played */}
            <div className="bg-[#141416] border border-[#27272A] rounded-xl p-4 flex flex-col justify-between shadow-md shadow-black/20">
              <div className="text-[11px] font-semibold text-[#A1A1AA] uppercase tracking-wider">Games Played</div>
              <div className="text-2xl font-bold text-[#F5F5F7] my-1.5">{stats.gamesPlayed}</div>
              <div className="text-xs text-[#A1A1AA]">Total matches</div>
            </div>

            {/* Wins */}
            <div className="bg-[#141416] border border-[#27272A] rounded-xl p-4 flex flex-col justify-between shadow-md shadow-black/20">
              <div className="text-[11px] font-semibold text-[#A1A1AA] uppercase tracking-wider">Wins</div>
              <div className="text-2xl font-bold text-[#F5F5F7] my-1.5">{stats.wins}</div>
              <div className="text-xs text-[#A1A1AA]">You won</div>
            </div>

            {/* Draws */}
            <div className="bg-[#141416] border border-[#27272A] rounded-xl p-4 flex flex-col justify-between shadow-md shadow-black/20">
              <div className="text-[11px] font-semibold text-[#A1A1AA] uppercase tracking-wider">Draws</div>
              <div className="text-2xl font-bold text-[#F5F5F7] my-1.5">{stats.draws}</div>
              <div className="text-xs text-[#A1A1AA]">Games drawn</div>
            </div>

            {/* Win Rate */}
            <div className="bg-[#141416] border border-[#27272A] rounded-xl p-4 flex flex-col justify-between shadow-md shadow-black/20">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-semibold text-[#A1A1AA] uppercase tracking-wider">Win Rate</div>
                <span className="w-1.5 h-1.5 rounded-full bg-[#6EE7B7]" />
              </div>
              <div className="text-2xl font-bold text-[#F5F5F7] my-1.5">{stats.winRate}%</div>
              <div className="text-xs text-[#A1A1AA]">
                {stats.gamesPlayed > 0 ? `${stats.wins} of ${stats.gamesPlayed} won` : '0 of 0 won'}
              </div>
            </div>

          </div>
        </div>

        {/* 3. Recent Games Section (Below Stats) */}
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-semibold text-[#A1A1AA] uppercase tracking-wider">Recent Games</h2>
            <button
              onClick={() => navigate('/history')}
              className="text-xs font-medium text-[#A1A1AA] hover:text-[#F5F5F7] transition flex items-center gap-1 cursor-pointer"
            >
              <span>View All History</span>
              <span>→</span>
            </button>
          </div>

          {historyLoading ? (
            <div className="bg-[#141416] border border-[#27272A] rounded-xl p-10 flex items-center justify-center shadow-md">
              <div className="w-5 h-5 border-2 border-[#6EE7B7] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <div className="bg-[#141416] border border-[#27272A] rounded-xl p-8 text-center shadow-md">
              <p className="text-[#E4E4E7] text-sm font-medium">No games recorded yet</p>
              <p className="text-[#A1A1AA] text-xs mt-1">Create a new game or join with an ID to begin your match history.</p>
            </div>
          ) : (
            <div className="bg-[#141416] border border-[#27272A] rounded-xl overflow-hidden shadow-lg shadow-black/30">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-[#27272A] text-[11px] font-semibold text-[#A1A1AA] uppercase tracking-wider bg-[#101012]">
                      <th className="px-5 py-3">Opponent</th>
                      <th className="px-5 py-3">Result</th>
                      <th className="px-5 py-3">Reason</th>
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#27272A]">
                    {history.map((game) => {
                      const opponentName = getOpponent(game) || 'Unknown'
                      const initial = opponentName.charAt(0).toUpperCase()
                      return (
                        <tr
                          key={game._id}
                          onClick={() => navigate(`/history/${game.gameId}`)}
                          className="hover:bg-[#1E1E22] transition duration-150 cursor-pointer group"
                        >
                          {/* Opponent with initial circle */}
                          <td className="px-5 py-3.5 text-[#F5F5F7] font-medium">
                            <div className="flex items-center gap-3">
                              <div className="w-6 h-6 rounded-full bg-[#202024] border border-[#303036] flex items-center justify-center text-[11px] font-semibold text-[#D4D4D8] group-hover:text-[#F5F5F7] group-hover:border-[#3F3F46] transition">
                                {initial}
                              </div>
                              <span className="truncate">{opponentName}</span>
                            </div>
                          </td>

                          {/* Result */}
                          <td className="px-5 py-3.5">
                            {getResultLabel(game)}
                          </td>

                          {/* Reason */}
                          <td className="px-5 py-3.5 text-[#A1A1AA] text-xs capitalize font-normal">
                            {game.resultReason?.replace(/_/g, ' ') || 'Checkmate'}
                          </td>

                          {/* Date */}
                          <td className="px-5 py-3.5 text-[#A1A1AA] text-xs font-normal">
                            {formatDate(game.completedAt)}
                          </td>

                          {/* Action Chevron */}
                          <td className="px-5 py-3.5 text-right text-[#71717A] group-hover:text-[#F5F5F7] transition font-mono">
                            ›
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

      </main>

      {/* ── Create Game Modal ── */}
      {modal === 'create' && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={handleCloseModal}
        >
          <div
            className="bg-[#141416] border border-[#27272A] rounded-xl p-5 sm:p-6 w-full max-w-sm shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {waitingStatus === 'active' ? (
              <div className="text-center py-4 space-y-1.5">
                <div className="w-2 h-2 bg-[#6EE7B7] rounded-full mx-auto mb-1 animate-ping" />
                <h3 className="text-sm font-semibold text-[#F5F5F7]">Opponent Joined</h3>
                <p className="text-xs text-[#A1A1AA]">Starting match room...</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-[#F5F5F7]">Create Game</h3>
                    <p className="text-[11px] text-[#A1A1AA]">10 + 10 Blitz • 10m + 10s increment</p>
                  </div>
                  <button
                    onClick={handleCloseModal}
                    className="text-[#71717A] hover:text-[#F5F5F7] text-xs"
                  >
                    ✕
                  </button>
                </div>

                {/* Game ID Display */}
                <div className="bg-[#0A0A0B] border border-[#27272A] rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-[#A1A1AA] uppercase tracking-wider font-semibold">Game ID</div>
                    <div className="text-lg font-mono font-bold tracking-wider text-[#F5F5F7] mt-0.5">{createdGameId}</div>
                  </div>
                  <button
                    onClick={handleCopyId}
                    className="bg-[#1E1E22] hover:bg-[#27272A] text-xs text-[#F5F5F7] border border-[#27272A] rounded-md px-2.5 py-1 transition font-medium cursor-pointer"
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>

                {/* Live Status */}
                <div className="flex items-center gap-2 text-xs text-[#A1A1AA]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6EE7B7] animate-pulse" />
                  <span>Waiting for opponent to connect...</span>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => navigate(`/game/${createdGameId}`)}
                    className="flex-1 h-9 bg-[#F5F5F7] hover:bg-white text-[#0A0A0B] font-semibold rounded-lg text-xs transition cursor-pointer"
                  >
                    Enter Room
                  </button>
                  <button
                    onClick={handleCloseModal}
                    className="h-9 border border-[#27272A] hover:bg-[#1E1E22] text-[#A1A1AA] hover:text-[#F5F5F7] font-medium rounded-lg px-3.5 text-xs transition cursor-pointer"
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
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={handleCloseModal}
        >
          <div
            className="bg-[#141416] border border-[#27272A] rounded-xl p-5 sm:p-6 w-full max-w-sm shadow-2xl space-y-3.5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#F5F5F7]">Join Game</h3>
              <button
                onClick={handleCloseModal}
                className="text-[#71717A] hover:text-[#F5F5F7] text-xs"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#A1A1AA]">
              Enter the 8-character Game ID provided by your opponent.
            </p>

            <form onSubmit={handleJoinGame} className="space-y-3">
              {joinError && (
                <div className="text-xs text-[#F87171] bg-[#F87171]/10 border border-[#F87171]/20 rounded-lg p-2.5">
                  {joinError}
                </div>
              )}
              
              <div>
                <input
                  type="text"
                  value={joinId}
                  onChange={(e) => { setJoinId(e.target.value); setJoinError('') }}
                  placeholder="Enter Game ID"
                  maxLength={12}
                  autoFocus
                  className="w-full bg-[#0A0A0B] border border-[#27272A] focus:border-[#6EE7B7] text-[#F5F5F7] placeholder-[#71717A] rounded-lg h-10 px-3.5 text-xs font-mono tracking-wide transition outline-none"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={joining || !joinId.trim()}
                  className="flex-1 h-9 bg-[#F5F5F7] hover:bg-white active:scale-[0.99] disabled:opacity-50 text-[#0A0A0B] font-semibold rounded-lg text-xs transition cursor-pointer"
                >
                  {joining ? 'Connecting...' : 'Join Game'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="h-9 border border-[#27272A] hover:bg-[#1E1E22] text-[#A1A1AA] hover:text-[#F5F5F7] font-medium rounded-lg px-3.5 text-xs transition cursor-pointer"
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
