import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { createGame, joinGame, getGame, getHistory } from '../services/gameService'
import { 
  Plus, LogIn, LogOut, Clock, ArrowRight, ChevronRight, 
  Gamepad2, Trophy, Handshake, LineChart, ChevronDown
} from 'lucide-react'

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
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  const getOpponent = (game) => {
    const isWhite = game.whitePlayer?.username === user?.username
    return isWhite ? game.blackPlayer?.username : game.whitePlayer?.username
  }

  // Helper for Result Text & Dot
  const renderResult = (game) => {
    if (game.result === 'draw') {
      return (
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#A1A1AA]">DRAW</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#A1A1AA]"></span>
        </div>
      )
    }
    const won = game.winner?._id === user?.id || game.winner?.username === user?.username
    if (won) {
      return (
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#6EE7B7]">WIN</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#6EE7B7]"></span>
        </div>
      )
    }
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-[#F87171]">LOSS</span>
        <span className="w-1.5 h-1.5 rounded-full bg-[#F87171]"></span>
      </div>
    )
  }

  // Circular Progress for Win Rate
  const CircularProgress = ({ percentage }) => {
    const radius = 24
    const circumference = 2 * Math.PI * radius
    const strokeDashoffset = circumference - (percentage / 100) * circumference

    return (
      <div className="relative flex items-center justify-center">
        <svg className="w-16 h-16 transform -rotate-90">
          <circle
            className="text-[#1D1D20]"
            strokeWidth="4"
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx="32"
            cy="32"
          />
          <circle
            className="text-[#6EE7B7] transition-all duration-1000 ease-out"
            strokeWidth="4"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx="32"
            cy="32"
          />
        </svg>
        <span className="absolute text-[11px] font-bold text-[#6EE7B7]">
          {percentage}%
        </span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#09090B] text-[#F5F5F7] flex flex-col font-sans selection:bg-[#6EE7B7]/20 selection:text-[#6EE7B7]">
      
      {/* ── Top Navbar ── */}
      <header className="border-b border-[#1D1D20] bg-[#09090B]">
        <div className="max-w-[1240px] mx-auto px-6 sm:px-8 h-[72px] flex items-center justify-between">
          
          {/* Brand */}
          <div className="flex items-center gap-3">
            <span className="text-2xl text-[#F5F5F7]">♟</span>
            <span className="font-bold text-sm tracking-[0.2em] text-[#F5F5F7] uppercase mt-0.5">CHECKMATE</span>
          </div>

          {/* Nav Center */}
          <nav className="hidden sm:flex items-center gap-8 h-full">
            <div className="relative h-full flex items-center">
              <button
                onClick={() => navigate('/dashboard')}
                className="text-[#F5F5F7] font-medium text-sm transition"
              >
                Dashboard
              </button>
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#6EE7B7]" />
            </div>
            <div className="h-full flex items-center">
              <button
                onClick={() => navigate('/history')}
                className="text-[#A1A1AA] hover:text-[#F5F5F7] font-medium text-sm transition"
              >
                History
              </button>
            </div>
          </nav>

          {/* Right Profile & Logout */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5 bg-[#111113] border border-[#1D1D20] rounded-full py-1.5 pl-1.5 pr-3 cursor-pointer hover:bg-[#18181B] transition">
              <div className="w-6 h-6 rounded-full bg-[#183327] text-[#6EE7B7] flex items-center justify-center text-[10px] font-bold">
                {user?.username?.substring(0, 2).toUpperCase() || 'US'}
              </div>
              <span className="text-xs font-mono text-[#A1A1AA]">{user?.username}</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#71717A]" />
            </div>
            <button
              onClick={handleLogout}
              className="p-2 border border-[#1D1D20] text-[#71717A] rounded-lg hover:text-[#F5F5F7] hover:bg-[#18181B] transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>
      </header>

      {/* ── Main Content Container ── */}
      <main className="flex-1 max-w-[1240px] mx-auto w-full px-6 sm:px-8 py-8 space-y-6">
        
        {/* 1. Welcome Card */}
        <div className="bg-[#111113] border border-[#1D1D20] rounded-[20px] p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 shadow-sm">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#F5F5F7] mb-2">
              Welcome back, {user?.username}
            </h1>
            <p className="text-[#A1A1AA] text-sm">
              Ready for another game?
            </p>
          </div>

          <div className="flex items-center gap-4 flex-shrink-0">
            <button
              onClick={handleCreateGame}
              disabled={creating}
              className="h-[42px] bg-[#F5F5F7] hover:bg-white text-[#09090B] font-semibold text-sm px-5 rounded-xl transition duration-150 flex items-center justify-center gap-2.5 active:scale-[0.98] disabled:opacity-60 shadow-sm"
            >
              {creating ? (
                <span className="w-4 h-4 border-2 border-[#09090B] border-t-transparent rounded-full animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              <span>Create Game</span>
            </button>

            <button
              onClick={() => setModal('join')}
              className="h-[42px] bg-transparent hover:bg-[#18181B] text-[#F5F5F7] border border-[#27272A] font-semibold text-sm px-5 rounded-xl transition duration-150 flex items-center justify-center gap-2.5 active:scale-[0.98]"
            >
              <LogIn className="w-4 h-4 text-[#A1A1AA]" />
              <span>Join Game</span>
            </button>
          </div>
        </div>

        {/* 2. Recent Games Card */}
        <div className="bg-[#111113] border border-[#1D1D20] rounded-[20px] overflow-hidden shadow-sm flex flex-col">
          {/* Card Header */}
          <div className="px-8 py-5 flex items-center justify-between border-b border-[#1D1D20]">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-[#6EE7B7]" />
              <h2 className="text-lg font-semibold text-[#F5F5F7]">Recent Games</h2>
            </div>
            <button
              onClick={() => navigate('/history')}
              className="text-sm font-medium text-[#6EE7B7] hover:text-[#5eead4] transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>View All History</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Table Content */}
          <div className="flex-1 min-h-[300px]">
            {historyLoading ? (
              <div className="h-[300px] flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-[#6EE7B7] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : history.length === 0 ? (
              <div className="h-[300px] flex flex-col items-center justify-center text-center">
                <p className="text-[#E4E4E7] text-base font-medium mb-1">No games recorded yet</p>
                <p className="text-[#A1A1AA] text-sm">Create a new game or join with an ID to begin.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className="text-[13px] font-medium text-[#A1A1AA]">
                      <th className="px-8 py-4 font-normal">Opponent</th>
                      <th className="px-8 py-4 font-normal">Result</th>
                      <th className="px-8 py-4 font-normal">Reason</th>
                      <th className="px-8 py-4 font-normal">Date</th>
                      <th className="px-8 py-4 font-normal text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((game, idx) => {
                      const opponentName = getOpponent(game) || 'Unknown'
                      const initial = opponentName.charAt(0).toUpperCase()
                      return (
                        <tr
                          key={game._id}
                          onClick={() => navigate(`/history/${game.gameId}`)}
                          className="hover:bg-[#18181B] transition duration-150 cursor-pointer group border-t border-[#1D1D20]"
                        >
                          {/* Opponent */}
                          <td className="px-8 py-5 text-[#F5F5F7] font-semibold">
                            <div className="flex items-center gap-4">
                              <div className="w-8 h-8 rounded-full bg-[#27272A] flex items-center justify-center text-[13px] font-bold text-[#F5F5F7]">
                                {initial}
                              </div>
                              <span>{opponentName}</span>
                            </div>
                          </td>

                          {/* Result */}
                          <td className="px-8 py-5">
                            {renderResult(game)}
                          </td>

                          {/* Reason */}
                          <td className="px-8 py-5 text-[#A1A1AA] capitalize">
                            {game.resultReason?.replace(/_/g, ' ') || 'Checkmate'}
                          </td>

                          {/* Date */}
                          <td className="px-8 py-5 text-[#A1A1AA]">
                            {formatDate(game.completedAt)}
                          </td>

                          {/* Action */}
                          <td className="px-8 py-5 text-right text-[#A1A1AA] group-hover:text-[#F5F5F7] transition">
                            <ChevronRight className="w-4 h-4 ml-auto" />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* 3. Statistics Row (4 Cards) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          
          {/* Games Played */}
          <div className="bg-[#111113] border border-[#1D1D20] rounded-[20px] p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-[10px] bg-[#183327] flex items-center justify-center text-[#6EE7B7]">
                <Gamepad2 className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-[#A1A1AA]">Games Played</span>
            </div>
            <div className="text-3xl font-semibold text-[#F5F5F7] mb-1">{stats.gamesPlayed}</div>
            <div className="text-xs text-[#A1A1AA]">Total games logged</div>
          </div>

          {/* Wins */}
          <div className="bg-[#111113] border border-[#1D1D20] rounded-[20px] p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-[10px] bg-[#183327] flex items-center justify-center text-[#6EE7B7]">
                <Trophy className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-[#A1A1AA]">Wins</span>
            </div>
            <div className="text-3xl font-semibold text-[#F5F5F7] mb-1">{stats.wins}</div>
            <div className="text-xs text-[#A1A1AA]">You won</div>
          </div>

          {/* Draws */}
          <div className="bg-[#111113] border border-[#1D1D20] rounded-[20px] p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-[10px] bg-[#27272A] flex items-center justify-center text-[#A1A1AA]">
                <Handshake className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-[#A1A1AA]">Draws</span>
            </div>
            <div className="text-3xl font-semibold text-[#F5F5F7] mb-1">{stats.draws}</div>
            <div className="text-xs text-[#A1A1AA]">Games drawn</div>
          </div>

          {/* Win Rate */}
          <div className="bg-[#111113] border border-[#1D1D20] rounded-[20px] p-6 shadow-sm flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-[10px] bg-[#183327] flex items-center justify-center text-[#6EE7B7]">
                  <LineChart className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium text-[#A1A1AA]">Win Rate</span>
              </div>
              <div className="text-3xl font-semibold text-[#F5F5F7] mb-1">{stats.winRate}%</div>
              <div className="text-xs text-[#A1A1AA]">
                {stats.gamesPlayed > 0 ? `${stats.wins} of ${stats.gamesPlayed} games won` : '0 of 0 games won'}
              </div>
            </div>
            <CircularProgress percentage={stats.winRate} />
          </div>

        </div>

      </main>

      {/* ── Create Game Modal ── */}
      {modal === 'create' && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={handleCloseModal}
        >
          <div
            className="bg-[#111113] border border-[#27272A] rounded-2xl p-6 sm:p-7 w-full max-w-sm shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {waitingStatus === 'active' ? (
              <div className="text-center py-5 space-y-2">
                <div className="w-2.5 h-2.5 bg-[#6EE7B7] rounded-full mx-auto mb-2 animate-ping" />
                <h3 className="text-base font-semibold text-[#F5F5F7]">Opponent Joined</h3>
                <p className="text-xs text-[#A1A1AA]">Starting match room...</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-[#F5F5F7]">Create Game</h3>
                    <p className="text-[11px] text-[#A1A1AA] mt-1">10 + 10 Blitz • 10m + 10s increment</p>
                  </div>
                  <button onClick={handleCloseModal} className="text-[#71717A] hover:text-[#F5F5F7]">✕</button>
                </div>

                <div className="bg-[#09090B] border border-[#27272A] rounded-xl p-3.5 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-[#71717A] uppercase tracking-wider font-bold">Game ID</div>
                    <div className="text-xl font-mono font-bold tracking-wider text-[#F5F5F7] mt-0.5">{createdGameId}</div>
                  </div>
                  <button
                    onClick={handleCopyId}
                    className="bg-[#18181B] hover:bg-[#27272A] text-xs text-[#F5F5F7] border border-[#27272A] rounded-lg px-3 py-1.5 transition font-medium cursor-pointer"
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs text-[#A1A1AA]">
                  <span className="w-2 h-2 rounded-full bg-[#6EE7B7] animate-pulse" />
                  <span>Waiting for opponent to connect...</span>
                </div>

                <div className="flex gap-2.5 pt-1">
                  <button
                    onClick={() => navigate(`/game/${createdGameId}`)}
                    className="flex-1 h-10 bg-[#F5F5F7] hover:bg-white text-[#09090B] font-semibold rounded-xl text-xs transition cursor-pointer"
                  >
                    Enter Room
                  </button>
                  <button
                    onClick={handleCloseModal}
                    className="h-10 border border-[#27272A] hover:bg-[#18181B] text-[#A1A1AA] hover:text-[#F5F5F7] font-medium rounded-xl px-4 text-xs transition cursor-pointer"
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
            className="bg-[#111113] border border-[#27272A] rounded-2xl p-6 sm:p-7 w-full max-w-sm shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#F5F5F7]">Join Game</h3>
              <button onClick={handleCloseModal} className="text-[#71717A] hover:text-[#F5F5F7]">✕</button>
            </div>

            <p className="text-xs text-[#A1A1AA]">
              Enter the 8-character Game ID provided by your opponent.
            </p>

            <form onSubmit={handleJoinGame} className="space-y-4">
              {joinError && (
                <div className="text-xs text-[#F87171] bg-[#F87171]/10 border border-[#F87171]/20 rounded-xl p-3">
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
                  className="w-full bg-[#09090B] border border-[#27272A] focus:border-[#6EE7B7] text-[#F5F5F7] placeholder-[#71717A] rounded-xl h-11 px-4 text-sm font-mono tracking-wide transition outline-none"
                />
              </div>

              <div className="flex gap-2.5 pt-1">
                <button
                  type="submit"
                  disabled={joining || !joinId.trim()}
                  className="flex-1 h-10 bg-[#F5F5F7] hover:bg-white active:scale-[0.99] disabled:opacity-50 text-[#09090B] font-semibold rounded-xl text-xs transition cursor-pointer"
                >
                  {joining ? 'Connecting...' : 'Join Game'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="h-10 border border-[#27272A] hover:bg-[#18181B] text-[#A1A1AA] hover:text-[#F5F5F7] font-medium rounded-xl px-4 text-xs transition cursor-pointer"
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
