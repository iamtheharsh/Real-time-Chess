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
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1) // -1 is the starting position

  useEffect(() => {
    getGame(gameId)
      .then((res) => {
        setGame(res.data.game)
        // If there are moves, default to showing the final position of the game
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
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !game) {
    return (
      <div className="min-h-screen bg-[#0f1117] text-white flex flex-col items-center justify-center p-4">
        <div className="text-5xl mb-4">⚠️</div>
        <p className="text-red-400 mb-6 font-semibold">{error || 'Game not found'}</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-6 py-2 transition"
        >
          Back to Dashboard
        </button>
      </div>
    )
  }

  const moves = game.moves || []
  
  // Determine position FEN based on current selected move index
  const getPositionFen = () => {
    if (currentMoveIndex === -1) {
      return 'start' // standard start FEN
    }
    return moves[currentMoveIndex]?.fen
  }

  // Navigation handlers
  const handleFirst = () => setCurrentMoveIndex(-1)
  const handlePrev = () => setCurrentMoveIndex((idx) => Math.max(-1, idx - 1))
  const handleNext = () => setCurrentMoveIndex((idx) => Math.min(moves.length - 1, idx + 1))
  const handleLast = () => setCurrentMoveIndex(moves.length - 1)

  // Group moves into rows for the sidebar
  const movePairs = []
  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push({
      index: Math.floor(i / 2) + 1,
      white: { san: moves[i]?.san, moveIndex: i },
      black: moves[i + 1] ? { san: moves[i + 1]?.san, moveIndex: i + 1 } : null,
    })
  }

  // Get result and explanation details
  const getResultDetails = () => {
    if (game.result === 'draw') {
      return { title: 'Draw', desc: `by ${game.resultReason?.replace(/_/g, ' ')}` }
    }
    const winnerUsername = game.result === 'white' ? game.whitePlayer?.username : game.blackPlayer?.username
    return {
      title: `${winnerUsername} won!`,
      desc: `by ${game.resultReason?.replace(/_/g, ' ')}`,
    }
  }

  const resultDetails = getResultDetails()

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
        <span className="font-semibold text-sm text-slate-400 font-mono">Replay: {gameId}</span>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex flex-col md:flex-row items-center justify-center p-6 gap-6 max-w-5xl mx-auto w-full">
        
        {/* Board & Controls */}
        <div className="flex flex-col gap-4 items-center">
          {/* Top Player (Black) */}
          <div className="w-full flex justify-between items-center px-2">
            <span className="font-medium text-slate-300">
              {game.blackPlayer?.username} (Black)
            </span>
          </div>

          <div className="w-[400px] sm:w-[480px]">
            <Chessboard
              position={getPositionFen()}
              boardWidth={typeof window !== 'undefined' ? Math.min(480, window.innerWidth - 32) : 480}
              arePiecesDraggable={false} // Read-only replay
              customBoardStyle={{ borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
              customDarkSquareStyle={{ backgroundColor: '#4a6741' }}
              customLightSquareStyle={{ backgroundColor: '#f0d9b5' }}
            />
          </div>

          {/* Bottom Player (White) */}
          <div className="w-full flex justify-between items-center px-2">
            <span className="font-medium text-slate-300">
              {game.whitePlayer?.username} (White)
            </span>
          </div>

          {/* Replay Controls */}
          <div className="flex gap-2 w-full max-w-xs mt-2">
            <button
              onClick={handleFirst}
              disabled={currentMoveIndex === -1}
              className="flex-1 bg-[#1e2130] hover:bg-[#252840] border border-[#2d3148] disabled:opacity-40 rounded-lg py-2 text-sm font-semibold transition"
            >
              « First
            </button>
            <button
              onClick={handlePrev}
              disabled={currentMoveIndex === -1}
              className="flex-1 bg-[#1e2130] hover:bg-[#252840] border border-[#2d3148] disabled:opacity-40 rounded-lg py-2 text-sm font-semibold transition"
            >
              ‹ Prev
            </button>
            <button
              onClick={handleNext}
              disabled={currentMoveIndex === moves.length - 1}
              className="flex-1 bg-[#1e2130] hover:bg-[#252840] border border-[#2d3148] disabled:opacity-40 rounded-lg py-2 text-sm font-semibold transition"
            >
              Next ›
            </button>
            <button
              onClick={handleLast}
              disabled={currentMoveIndex === moves.length - 1}
              className="flex-1 bg-[#1e2130] hover:bg-[#252840] border border-[#2d3148] disabled:opacity-40 rounded-lg py-2 text-sm font-semibold transition"
            >
              Last »
            </button>
          </div>
        </div>

        {/* Sidebar info & moves */}
        <div className="flex flex-col gap-4 w-full md:w-80 h-[560px] bg-[#1e2130] border border-[#2d3148] rounded-xl p-4">
          
          {/* Game summary */}
          <div className="border-b border-[#2d3148] pb-4">
            <h3 className="text-lg font-bold text-white">Game Summary</h3>
            <div className="mt-2 text-sm">
              <p className="text-slate-400">Result: <span className="font-semibold text-indigo-400 capitalize">{resultDetails.title}</span></p>
              <p className="text-slate-400 text-xs capitalize mt-0.5">{resultDetails.desc}</p>
              <p className="text-slate-500 text-xs mt-2">Played on: {new Date(game.createdAt).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Moves list */}
          <div className="flex-1 overflow-y-auto pr-1">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Move List</h4>
            <div className="space-y-1">
              {movePairs.map((pair) => (
                <div key={pair.index} className="flex text-sm py-1 px-2 rounded hover:bg-[#252840]/30 transition items-center">
                  <span className="w-8 text-slate-500 font-mono">{pair.index}.</span>
                  
                  {/* White Move */}
                  <button
                    onClick={() => setCurrentMoveIndex(pair.white.moveIndex)}
                    className={`flex-1 text-left font-mono px-1 rounded transition ${
                      currentMoveIndex === pair.white.moveIndex
                        ? 'bg-indigo-600 text-white font-semibold'
                        : 'text-white hover:bg-[#252840]'
                    }`}
                  >
                    {pair.white.san}
                  </button>

                  {/* Black Move */}
                  {pair.black ? (
                    <button
                      onClick={() => setCurrentMoveIndex(pair.black.moveIndex)}
                      className={`flex-1 text-left font-mono px-1 rounded transition ${
                        currentMoveIndex === pair.black.moveIndex
                          ? 'bg-indigo-600 text-white font-semibold'
                          : 'text-slate-300 hover:bg-[#252840]'
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
                <p className="text-slate-500 text-center py-8 text-sm">No moves recorded in this game.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
