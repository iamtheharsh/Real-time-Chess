import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login(form.email, form.password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-[#0A0A0B] text-[#F5F5F7] flex items-center justify-center p-5 sm:p-8 antialiased selection:bg-[#6EE7B7]/20 selection:text-[#6EE7B7] overflow-hidden">
      
      {/* Background Image with Integrated Subtle Dark Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none"
        style={{ backgroundImage: 'url(/auth-bg.jpg)' }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0B]/95 via-[#0A0A0B]/88 to-[#0A0A0B]/80 pointer-events-none" />

      {/* Main Container: Split-screen composition */}
      <div className="relative z-10 max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-center min-h-[560px]">
        
        {/* Left Side: Brand & Product Statement */}
        <div className="hidden lg:flex lg:col-span-6 flex-col justify-between h-full py-4 pr-6 space-y-12 select-none">
          {/* Brand Wordmark */}
          <div className="flex items-center gap-2">
            <span className="text-xl">♟</span>
            <span className="font-bold text-sm tracking-[0.2em] text-[#F5F5F7] uppercase">CHECKMATE</span>
          </div>

          {/* Statement */}
          <div className="space-y-3">
            <h1 className="text-3xl xl:text-4xl font-semibold tracking-tight text-[#F5F5F7] leading-tight">
              Real-time chess.<br />
              Nothing unnecessary.
            </h1>
            <p className="text-[#A1A1AA] text-sm tracking-wide">
              Play. Compete. Reconnect.
            </p>
          </div>

          {/* Minimal Tagline */}
          <div className="text-xs text-[#71717A] tracking-wider uppercase font-mono">
            Authoritative clocks • 10+10 Blitz
          </div>
        </div>

        {/* Right Side: Authentication Panel */}
        <div className="lg:col-span-6 flex justify-center lg:justify-end">
          <div className="w-full max-w-[390px] bg-[#111113]/90 border border-white/[0.08] rounded-2xl p-7 sm:p-8 shadow-2xl backdrop-blur-md">
            
            {/* Mobile Brand Wordmark */}
            <div className="lg:hidden flex items-center gap-2 mb-6">
              <span className="text-lg">♟</span>
              <span className="font-bold text-xs tracking-[0.2em] text-[#F5F5F7] uppercase">CHECKMATE</span>
            </div>

            {/* Header */}
            <div className="mb-6 space-y-1">
              <h2 className="text-2xl font-semibold tracking-tight text-[#F5F5F7]">Welcome back</h2>
              <p className="text-sm text-[#A1A1AA]">Sign in to your account to continue.</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Error Message */}
              {error && (
                <div className="text-xs text-[#F87171] bg-[#F87171]/10 border border-[#F87171]/20 rounded-xl p-3">
                  {error}
                </div>
              )}

              {/* Email Input */}
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-[13px] font-medium text-[#A1A1AA]">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  placeholder="name@example.com"
                  className="w-full bg-[#151517] border border-[#27272A] focus:border-[#6EE7B7] text-[#F5F5F7] placeholder-[#71717A] rounded-xl h-11 px-3.5 text-sm transition outline-none"
                />
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-[13px] font-medium text-[#A1A1AA]">
                    Password
                  </label>
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full bg-[#151517] border border-[#27272A] focus:border-[#6EE7B7] text-[#F5F5F7] placeholder-[#71717A] rounded-xl h-11 px-3.5 text-sm transition outline-none"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#F5F5F7] hover:bg-white active:scale-[0.99] disabled:opacity-50 text-[#0A0A0B] font-semibold h-11 rounded-xl text-sm transition duration-150 shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-[#0A0A0B] border-t-transparent rounded-full animate-spin" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <span>Sign In</span>
                  )}
                </button>
              </div>
            </form>

            {/* Register Link */}
            <div className="mt-6 pt-5 border-t border-[#1D1D20] text-center text-xs text-[#71717A]">
              Don't have an account?{' '}
              <Link to="/register" className="text-[#F5F5F7] hover:text-[#6EE7B7] font-medium transition">
                Sign up
              </Link>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}
