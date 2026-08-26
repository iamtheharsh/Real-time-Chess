import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getHistory } from '../services/gameService'

export default function HistoryPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getHistory()
      .then((res) => {
        setHistory(res.data.games)
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Failed to fetch game history')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  const getResultLabel = (game) => {
    if (game.result === 'draw') return { label: 'Draw', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' }
    const won = game.winner?._id === user?.id || game.winner?.username === user?.username
    return won
      ? { label: 'Win', color: 'text-green-400 bg-green-400/10 border-green-400/20' }
      : { label: 'Loss', color: 'text-red-400 bg-red-400/10 border-red-400/20' }
  }

  const getOpponent = (game) => {
    const isWhite = game.whitePlayer?.username === user?.username
    return isWhite ? game.blackPlayer?.username : game.whitePlayer?.username
  }

  return (
    <div className="min-h-screen bg-[#0f1117] text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-[#2d3148] bg-[#1a1d27] px-6 py-4 flex items-center justify-between">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition text-sm"
        >
          ← Back to Dashboard
        </button>
        <span className="font-semibold text-lg">Completed Games</span>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-10">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Game History</h2>
          <span className="text-slate-400 text-sm font-medium">{history.length} games played</span>
        </div>

        {loading ? (
          <div className="bg-[#1e2130] border border-[#2d3148] rounded-2xl p-12 flex justify-center items-center">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl p-6 text-center">
            {error}
          </div>
        ) : history.length === 0 ? (
          <div className="bg-[#1e2130] border border-[#2d3148] rounded-2xl p-12 text-center">
            <div className="text-5xl mb-4">♟️</div>
            <p className="text-slate-400 mb-2 font-medium">No completed games found</p>
            <p className="text-slate-600 text-sm mb-6">Play your first match to start tracking your records!</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-6 py-2 transition text-sm font-semibold"
            >
              Go to Dashboard
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {history.map((game) => {
              const { label, color } = getResultLabel(game)
              const opponent = getOpponent(game) || 'Unknown Player'
              const colorPlayed = game.whitePlayer?.username === user?.username ? 'White' : 'Black'

              return (
                <div
                  key={game._id}
                  onClick={() => navigate(`/history/${game.gameId}`)}
                  className="bg-[#1e2130] border border-[#2d3148] hover:border-indigo-500/60 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-indigo-500/5"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">♟️</span>
                    <div>
                      <div className="font-semibold text-lg">vs {opponent}</div>
                      <div className="text-xs text-slate-400 mt-0.5 flex gap-3">
                        <span>Played as {colorPlayed}</span>
                        <span>•</span>
                        <span>{formatDate(game.completedAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <div className="text-right hidden sm:block">
                      <div className="text-xs text-slate-500 font-mono">Game ID: {game.gameId}</div>
                      <div className="text-xs text-slate-400 capitalize mt-0.5">by {game.resultReason?.replace(/_/g, ' ')}</div>
                    </div>
                    <span className={`text-sm font-bold px-3 py-1 rounded-full border ${color}`}>
                      {label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
