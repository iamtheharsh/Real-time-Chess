import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Chessboard } from 'react-chessboard'
import { getGame } from '../services/gameService'

export default function ReplayPage() {
  const { gameId } = useParams()
  const navigate = useNavigate()

  const [game, setGame] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1) // -1 = initial start position

  useEffect(() => {
    getGame(gameId)
      .then((res) => {
        setGame(res.data.game)
        if (res.data.game.moves && res.data.game.moves.length > 0) {
          setCurrentMoveIndex(res.data.game.moves.length - 1)
        }
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Failed to fetch game replay')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [gameId])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[#6EE7B7] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !game) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] text-[#F5F5F7] flex flex-col items-center justify-center p-4">
        <p className="text-[#F87171] text-sm mb-4">{error || 'Game not found'}</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="bg-[#F5F5F7] text-[#0A0A0B] font-medium text-xs rounded-lg px-4 py-2 transition"
        >
          Back to Dashboard
        </button>
      </div>
    )
  }

  const moves = game.moves || []

  const getPositionFen = () => {
    if (currentMoveIndex === -1) {
      return 'start'
    }
    return moves[currentMoveIndex]?.fen
  }

  const handleFirst = () => setCurrentMoveIndex(-1)
  const handlePrev = () => setCurrentMoveIndex((idx) => Math.max(-1, idx - 1))
  const handleNext = () => setCurrentMoveIndex((idx) => Math.min(moves.length - 1, idx + 1))
  const handleLast = () => setCurrentMoveIndex(moves.length - 1)

  const movePairs = []
  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push({
      index: Math.floor(i / 2) + 1,
      white: { san: moves[i]?.san, moveIndex: i },
      black: moves[i + 1] ? { san: moves[i + 1]?.san, moveIndex: i + 1 } : null,
    })
  }

  const getResultSummary = () => {
    if (game.result === 'draw') {
      return { title: 'Draw', desc: `by ${game.resultReason?.replace(/_/g, ' ')}` }
    }
    const winnerUsername = game.result === 'white' ? game.whitePlayer?.username : game.blackPlayer?.username
    return {
      title: `${winnerUsername} won`,
      desc: `by ${game.resultReason?.replace(/_/g, ' ')}`,
    }
  }

  const resultSummary = getResultSummary()

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-[#F5F5F7] flex flex-col antialiased selection:bg-[#6EE7B7]/20 selection:text-[#6EE7B7]">
      
      {/* Header */}
      <header className="border-b border-[#27272A] bg-[#0A0A0B]/80 backdrop-blur-md px-5 sm:px-8 h-14 flex items-center justify-between">
        <button
          onClick={() => navigate('/history')}
          className="text-xs font-medium text-[#A1A1AA] hover:text-[#F5F5F7] transition flex items-center gap-1.5"
        >
          <span>←</span>
          <span>History</span>
        </button>
        <span className="font-mono text-xs text-[#71717A]">Game #{gameId}</span>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex flex-col lg:flex-row items-center justify-center p-6 gap-8 max-w-5xl mx-auto w-full">
        
        {/* Board & Playback Controls */}
        <div className="flex flex-col gap-3 items-center">
          
          {/* Top Player (Black) */}
          <div className="w-full max-w-[460px] flex justify-between items-center px-1 text-xs text-[#A1A1AA]">
            <span className="font-medium text-[#F5F5F7]">{game.blackPlayer?.username}</span>
            <span>Black</span>
          </div>

          <div className="w-full max-w-[460px] aspect-square bg-[#111113] border border-[#27272A] rounded-xl overflow-hidden shadow-2xl p-2 flex items-center justify-center">
            <Chessboard
              options={{
                position: getPositionFen(),
                allowDragging: false,
                boardStyle: { borderRadius: '6px', width: '100%', maxWidth: '440px' },
                darkSquareStyle: { backgroundColor: '#27272A' },
                lightSquareStyle: { backgroundColor: '#E4E4E7' },
              }}
            />
          </div>

          {/* Bottom Player (White) */}
          <div className="w-full max-w-[460px] flex justify-between items-center px-1 text-xs text-[#A1A1AA]">
            <span className="font-medium text-[#F5F5F7]">{game.whitePlayer?.username}</span>
            <span>White</span>
          </div>

          {/* Playback Controls */}
          <div className="flex gap-2 w-full max-w-[460px] mt-2">
            <button
              onClick={handleFirst}
              disabled={currentMoveIndex === -1}
              className="flex-1 bg-[#111113] hover:bg-[#1B1B1E] border border-[#27272A] disabled:opacity-30 rounded-lg py-2 text-xs font-medium transition"
            >
              « First
            </button>
            <button
              onClick={handlePrev}
              disabled={currentMoveIndex === -1}
              className="flex-1 bg-[#111113] hover:bg-[#1B1B1E] border border-[#27272A] disabled:opacity-30 rounded-lg py-2 text-xs font-medium transition"
            >
              ‹ Prev
            </button>
            <button
              onClick={handleNext}
              disabled={currentMoveIndex === moves.length - 1}
              className="flex-1 bg-[#111113] hover:bg-[#1B1B1E] border border-[#27272A] disabled:opacity-30 rounded-lg py-2 text-xs font-medium transition"
            >
              Next ›
            </button>
            <button
              onClick={handleLast}
              disabled={currentMoveIndex === moves.length - 1}
              className="flex-1 bg-[#111113] hover:bg-[#1B1B1E] border border-[#27272A] disabled:opacity-30 rounded-lg py-2 text-xs font-medium transition"
            >
              Last »
            </button>
          </div>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4 w-full lg:w-72 h-[520px] bg-[#111113] border border-[#27272A] rounded-xl p-4">
          
          <div className="border-b border-[#1D1D20] pb-3">
            <div className="text-xs font-semibold text-[#71717A] uppercase tracking-wider">Summary</div>
            <div className="text-sm font-semibold text-[#F5F5F7] mt-1">{resultSummary.title}</div>
            <div className="text-xs text-[#A1A1AA] capitalize mt-0.5">{resultSummary.desc}</div>
          </div>

          <div className="flex-1 overflow-y-auto pr-1">
            <div className="text-xs font-medium text-[#71717A] mb-2">Move List</div>
            <div className="space-y-0.5">
              {movePairs.map((pair) => (
                <div key={pair.index} className="flex text-xs py-1 px-1.5 rounded hover:bg-[#1B1B1E] transition items-center">
                  <span className="w-6 text-[#71717A] font-mono">{pair.index}.</span>
                  
                  <button
                    onClick={() => setCurrentMoveIndex(pair.white.moveIndex)}
                    className={`flex-1 text-left font-mono px-1.5 py-0.5 rounded transition ${
                      currentMoveIndex === pair.white.moveIndex
                        ? 'bg-[#F5F5F7] text-[#0A0A0B] font-semibold'
                        : 'text-[#F5F5F7] hover:bg-[#27272A]'
                    }`}
                  >
                    {pair.white.san}
                  </button>

                  {pair.black ? (
                    <button
                      onClick={() => setCurrentMoveIndex(pair.black.moveIndex)}
                      className={`flex-1 text-left font-mono px-1.5 py-0.5 rounded transition ${
                        currentMoveIndex === pair.black.moveIndex
                          ? 'bg-[#F5F5F7] text-[#0A0A0B] font-semibold'
                          : 'text-[#A1A1AA] hover:bg-[#27272A]'
                      }`}
                    >
                      {pair.black.san}
                    </button>
                  ) : (
                    <span className="flex-1" />
                  )}
                </div>
              ))}
              {moves.length === 0 && (
                <p className="text-[#71717A] text-center py-6 text-xs">No moves logged.</p>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
