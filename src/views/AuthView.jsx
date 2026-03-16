import { useState } from 'react'
import { signIn, signUp } from '../services/authService'
import LoadingSpinner from '../components/LoadingSpinner'

export default function AuthView() {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'signin') {
        await signIn(email, password)
      } else {
        if (!username.trim()) throw new Error('Username is required.')
        if (username.length < 3) throw new Error('Username must be at least 3 characters.')
        await signUp(email, password, username.trim().toLowerCase())
      }
      // Auth state change handled by App.jsx
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-950">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-500/20 mb-4">
            <span className="text-3xl">⚖️</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-100">Veridict</h1>
          <p className="text-gray-500 mt-1">Make claims. Back them up. Win.</p>
        </div>

        <div className="card p-6 space-y-4">
          {/* Toggle */}
          <div className="grid grid-cols-2 bg-gray-800 p-1 rounded-xl">
            <button
              onClick={() => { setMode('signin'); setError(null) }}
              className={`py-2 rounded-lg text-sm font-semibold transition-colors ${
                mode === 'signin' ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('signup'); setError(null) }}
              className={`py-2 rounded-lg text-sm font-semibold transition-colors ${
                mode === 'signup' ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="label">Username</label>
                <input
                  className="input"
                  placeholder="your_username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
            )}
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                required
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? <LoadingSpinner size="sm" /> : null}
              {loading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
