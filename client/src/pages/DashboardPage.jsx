import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-[#0f1117] text-white">

      {/* Navbar */}
      <header className="border-b border-[#2d3148] bg-[#1a1d27]">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">♟️</span>
            <span className="font-bold text-lg tracking-tight">Real-Time Chess</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-slate-400 text-sm">
              Welcome, <span className="text-white font-medium">{user?.username}</span>
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

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-6 py-12">

        {/* Greeting */}
        <div className="mb-10">
          <h2 className="text-3xl font-bold">Good evening, {user?.username} 👋</h2>
          <p className="text-slate-400 mt-1">Ready to play a game?</p>
        </div>

        {/* Action cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">

          {/* Create Game */}
          <button
            onClick={() => navigate('/dashboard')} // Phase 3: navigate to create game
            className="group bg-[#1e2130] hover:bg-[#252840] border border-[#2d3148] hover:border-indigo-500/50 rounded-2xl p-6 text-left transition-all duration-200"
          >
            <div className="text-3xl mb-3">⚔️</div>
            <h3 className="text-lg font-semibold text-white group-hover:text-indigo-300 transition">Create Game</h3>
            <p className="text-slate-400 text-sm mt-1">Start a new game and share the ID with a friend</p>
          </button>

          {/* Join Game */}
          <button
            onClick={() => navigate('/dashboard')} // Phase 3: open join modal
            className="group bg-[#1e2130] hover:bg-[#252840] border border-[#2d3148] hover:border-indigo-500/50 rounded-2xl p-6 text-left transition-all duration-200"
          >
            <div className="text-3xl mb-3">🔗</div>
            <h3 className="text-lg font-semibold text-white group-hover:text-indigo-300 transition">Join Game</h3>
            <p className="text-slate-400 text-sm mt-1">Enter a game ID to join an existing game</p>
          </button>
        </div>

        {/* Recent Games placeholder */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Recent Games</h3>
          <div className="bg-[#1e2130] border border-[#2d3148] rounded-2xl p-8 text-center">
            <p className="text-slate-500 text-sm">No games yet. Create or join one above!</p>
          </div>
        </div>
      </main>
    </div>
  )
}
