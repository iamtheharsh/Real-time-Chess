import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { createGame, joinGame, getGame, getHistory } from '../services/gameService'

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  // Modal state
  const [modal, setModal] = useState(null) // null | 'create' | 'join'

  // Create game state
  const [createdGameId, setCreatedGameId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [waitingStatus, setWaitingStatus] = useState('waiting') // 'waiting' | 'active'
  const pollRef = useRef(null)

  // Join game state
  const [joinId, setJoinId] = useState('')
  const [joinError, setJoinError] = useState('')
  const [joining, setJoining] = useState(false)

  // History state
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)

  // Load game history on mount
  useEffect(() => {
    getHistory()
      .then((res) => setHistory(res.data.games))
      .catch(() => {})
      .finally(() => setHistoryLoading(false))
  }, [])

  // Poll game status while waiting for opponent
  useEffect(() => {
    if (createdGameId && waitingStatus === 'waiting') {
      pollRef.current = setInterval(async () => {
        try {
          const res = await getGame(createdGameId)
          if (res.data.game.status === 'ACTIVE') {
            clearInterval(pollRef.current)
            setWaitingStatus('active')
            // Brief pause so user sees the "Game started!" message
            setTimeout(() => navigate(`/game/${createdGameId}`), 1200)
          }
        } catch (e) { /* ignore */ }
      }, 2000) // poll every 2 seconds
    }
    return () => clearInterval(pollRef.current)
  }, [createdGameId, waitingStatus, navigate])

  const handleCreateGame = async () => {
    setCreating(true)
    try {
      const res = await createGame()
      setCreatedGameId(res.data.gameId)
      setModal('create')
    } catch (e) {
      alert('Failed to create game')
    } finally {
      setCreating(false)
    }
  }

  const handleJoinGame = async (e) => {
    e.preventDefault()
    setJoinError('')
    setJoining(true)
    try {
      await joinGame(joinId.trim().toUpperCase())
      navigate(`/game/${joinId.trim().toUpperCase()}`)
    } catch (err) {
      setJoinError(err.response?.data?.message || 'Failed to join game')
    } finally {
      setJoining(false)
    }
  }

  const handleCloseModal = () => {
    clearInterval(pollRef.current)
    setModal(null)
    setCreatedGameId(null)
    setWaitingStatus('waiting')
    setJoinId('')
    setJoinError('')
  }

  const handleLogout = () => { logout(); navigate('/login') }

  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

  const getResultLabel = (game) => {
    if (game.result === 'draw') return { label: 'Draw', color: 'text-yellow-400' }
    const won = game.winner?._id === user?.id || game.winner?.username === user?.username
    return won
      ? { label: 'Win', color: 'text-green-400' }
      : { label: 'Loss', color: 'text-red-400' }
  }

  const getOpponent = (game) => {
    const isWhite = game.whitePlayer?.username === user?.username
    return isWhite ? game.blackPlayer?.username : game.whitePlayer?.username
  }

  return (
    <div className="min-h-screen bg-[#0f1117] text-white">

      {/* Navbar */}
      <header className="border-b border-[#2d3148] bg-[#1a1d27] sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">♟️</span>
            <span className="font-bold text-lg tracking-tight">Real-Time Chess</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-slate-400 text-sm">
              <span className="text-white font-medium">{user?.username}</span>
            </span>
            <button
              onClick={handleLogout}
              className="text-sm text-slate-400 hover:text-white border border-[#2d3148] hover:border-slate-500 rounded-lg px-4 py-1.5 transition"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-6 py-10">

        {/* Greeting */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold">Good to see you, {user?.username} 👋</h2>
          <p className="text-slate-400 mt-1 text-sm">Ready for a game?</p>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          <button
            onClick={handleCreateGame}
            disabled={creating}
            className="group bg-[#1e2130] hover:bg-[#252840] border border-[#2d3148] hover:border-indigo-500/60 rounded-2xl p-6 text-left transition-all duration-200 disabled:opacity-60"
          >
            <div className="text-3xl mb-3">⚔️</div>
            <h3 className="text-lg font-semibold text-white group-hover:text-indigo-300 transition">
              {creating ? 'Creating...' : 'Create Game'}
            </h3>
            <p className="text-slate-400 text-sm mt-1">Start a new game and share the ID</p>
          </button>

          <button
            onClick={() => setModal('join')}
            className="group bg-[#1e2130] hover:bg-[#252840] border border-[#2d3148] hover:border-indigo-500/60 rounded-2xl p-6 text-left transition-all duration-200"
          >
            <div className="text-3xl mb-3">🔗</div>
            <h3 className="text-lg font-semibold text-white group-hover:text-indigo-300 transition">Join Game</h3>
            <p className="text-slate-400 text-sm mt-1">Enter a game ID to join</p>
          </button>
        </div>

        {/* Game History */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Recent Games</h3>
          {historyLoading ? (
            <div className="bg-[#1e2130] border border-[#2d3148] rounded-2xl p-8 flex justify-center">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <div className="bg-[#1e2130] border border-[#2d3148] rounded-2xl p-8 text-center">
              <p className="text-slate-500 text-sm">No games yet. Create or join one above!</p>
            </div>
          ) : (
            <div className="bg-[#1e2130] border border-[#2d3148] rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2d3148] text-slate-400">
                    <th className="text-left px-6 py-3 font-medium">Opponent</th>
                    <th className="text-left px-6 py-3 font-medium">Result</th>
                    <th className="text-left px-6 py-3 font-medium">Reason</th>
                    <th className="text-left px-6 py-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((game) => {
                    const { label, color } = getResultLabel(game)
                    return (
                      <tr
                        key={game._id}
                        className="border-b border-[#2d3148] last:border-0 hover:bg-[#252840] transition cursor-pointer"
                        onClick={() => navigate(`/history/${game.gameId}`)}
                      >
                        <td className="px-6 py-3 text-white font-medium">{getOpponent(game) || '—'}</td>
                        <td className={`px-6 py-3 font-semibold ${color}`}>{label}</td>
                        <td className="px-6 py-3 text-slate-400 capitalize">{game.resultReason?.replace(/_/g, ' ') || '—'}</td>
                        <td className="px-6 py-3 text-slate-400">{formatDate(game.completedAt)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* ── Modal Backdrop ── */}
      {modal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4"
          onClick={handleCloseModal}
        >
          <div
            className="bg-[#1e2130] border border-[#2d3148] rounded-2xl p-8 w-full max-w-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >

            {/* ── CREATE GAME MODAL ── */}
            {modal === 'create' && (
              <>
                {waitingStatus === 'active' ? (
                  <div className="text-center py-4">
                    <div className="text-4xl mb-3">🎉</div>
                    <h3 className="text-xl font-bold text-green-400">Opponent joined!</h3>
                    <p className="text-slate-400 text-sm mt-1">Starting game...</p>
                  </div>
                ) : (
                  <>
                    <h3 className="text-lg font-bold text-white mb-1">Game Created!</h3>
                    <p className="text-slate-400 text-sm mb-5">Share this ID with your opponent</p>

                    {/* Game ID display */}
                    <div className="bg-[#0f1117] border border-[#2d3148] rounded-xl px-4 py-3 flex items-center justify-between mb-5">
                      <span className="text-2xl font-mono font-bold tracking-widest text-indigo-400">
                        {createdGameId}
                      </span>
                      <button
                        onClick={() => navigator.clipboard.writeText(createdGameId)}
                        className="text-xs text-slate-400 hover:text-white border border-[#2d3148] rounded-lg px-3 py-1.5 transition"
                      >
                        Copy
                      </button>
                    </div>

                    {/* Waiting indicator */}
                    <div className="flex items-center gap-3 text-slate-400 text-sm">
                      <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                      <span>Waiting for opponent to join...</span>
                    </div>

                    <button
                      onClick={handleCloseModal}
                      className="w-full mt-5 text-sm text-slate-400 hover:text-white border border-[#2d3148] hover:border-slate-500 rounded-lg py-2 transition"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </>
            )}

            {/* ── JOIN GAME MODAL ── */}
            {modal === 'join' && (
              <>
                <h3 className="text-lg font-bold text-white mb-1">Join a Game</h3>
                <p className="text-slate-400 text-sm mb-5">Enter the game ID shared by your opponent</p>

                <form onSubmit={handleJoinGame} className="space-y-4">
                  {joinError && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-2.5">
                      {joinError}
                    </div>
                  )}
                  <input
                    type="text"
                    value={joinId}
                    onChange={(e) => { setJoinId(e.target.value); setJoinError('') }}
                    placeholder="e.g. V1StGXR8"
                    maxLength={8}
                    autoFocus
                    className="w-full bg-[#0f1117] border border-[#2d3148] text-white text-center text-xl font-mono tracking-widest rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder-slate-700 uppercase transition"
                  />
                  <button
                    type="submit"
                    disabled={joining || joinId.length < 4}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg py-2.5 text-sm transition flex items-center justify-center gap-2"
                  >
                    {joining ? (
                      <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Joining...</>
                    ) : 'Join Game'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="w-full text-sm text-slate-400 hover:text-white border border-[#2d3148] hover:border-slate-500 rounded-lg py-2 transition"
                  >
                    Cancel
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
