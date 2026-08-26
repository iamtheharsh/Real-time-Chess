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
        setHistory(res.data.games || [])
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Failed to fetch game history')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getResultText = (game) => {
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
    <div className="min-h-screen bg-[#0A0A0B] text-[#F5F5F7] flex flex-col antialiased selection:bg-[#6EE7B7]/20 selection:text-[#6EE7B7]">
      
      {/* ── Navigation Header ── */}
      <header className="border-b border-[#27272A] bg-[#0A0A0B]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 h-14 flex items-center justify-between">
          
          <button
            onClick={() => navigate('/dashboard')}
            className="text-xs font-medium text-[#A1A1AA] hover:text-[#F5F5F7] transition flex items-center gap-1.5"
          >
            <span>←</span>
            <span>Dashboard</span>
          </button>

          <span className="font-semibold text-sm tracking-tight text-[#F5F5F7]">Match History</span>

          <div className="text-xs text-[#71717A]">
            {history.length} {history.length === 1 ? 'game' : 'games'}
          </div>

        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-5 sm:px-8 py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#F5F5F7]">All Matches</h1>
          <p className="text-[#A1A1AA] text-xs mt-1">Review past games and inspect move logs</p>
        </div>

        {loading ? (
          <div className="bg-[#111113] border border-[#27272A] rounded-xl p-12 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-[#6EE7B7] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-[#111113] border border-[#27272A] text-[#F87171] rounded-xl p-6 text-center text-sm">
            {error}
          </div>
        ) : history.length === 0 ? (
          <div className="bg-[#111113] border border-[#27272A] rounded-xl p-12 text-center">
            <p className="text-[#A1A1AA] text-sm">No completed matches found</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="mt-4 bg-[#F5F5F7] hover:bg-white text-[#0A0A0B] font-medium text-xs px-4 py-2 rounded-lg transition"
            >
              Go to Dashboard
            </button>
          </div>
        ) : (
          <div className="bg-[#111113] border border-[#27272A] rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#1D1D20] text-xs font-medium text-[#71717A]">
                    <th className="px-5 py-3">Opponent</th>
                    <th className="px-5 py-3">Result</th>
                    <th className="px-5 py-3">Played As</th>
                    <th className="px-5 py-3">Reason</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-4 py-3 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1D1D20]">
                  {history.map((game) => {
                    const isWhite = game.whitePlayer?.username === user?.username
                    return (
                      <tr
                        key={game._id}
                        onClick={() => navigate(`/history/${game.gameId}`)}
                        className="hover:bg-[#1B1B1E] transition duration-100 cursor-pointer group"
                      >
                        <td className="px-5 py-3 text-[#F5F5F7] font-medium">
                          {getOpponent(game) || 'Unknown'}
                        </td>
                        <td className="px-5 py-3">
                          {getResultText(game)}
                        </td>
                        <td className="px-5 py-3 text-xs text-[#A1A1AA]">
                          {isWhite ? 'White' : 'Black'}
                        </td>
                        <td className="px-5 py-3 text-xs text-[#A1A1AA] capitalize">
                          {game.resultReason?.replace(/_/g, ' ') || 'Checkmate'}
                        </td>
                        <td className="px-5 py-3 text-xs text-[#71717A]">
                          {formatDate(game.completedAt)}
                        </td>
                        <td className="px-4 py-3 text-right text-[#71717A] group-hover:text-[#F5F5F7] transition">
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
      </main>

    </div>
  )
}
