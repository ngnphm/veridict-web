import { useState } from 'react'
import { signIn, signUp, signInWithApple, signInWithCode } from '../services/authService'
import LoadingSpinner from '../components/LoadingSpinner'

function AppleLogo() {
  return (
    <svg viewBox="0 0 814 1000" className="w-5 h-5" fill="currentColor">
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 389.1 0 230 0 131.5 0 49.7 28.1 0 90.3 0c39 0 87.5 21.4 128.3 21.4 38.3 0 87.5-21.4 138.7-21.4 54 0 108.2 21.4 144.1 81.9 37.1-22 106.7-81.9 180.3-81.9 27.4 0 130.3 3.2 130.3 3.2-.6 0-23.2 54.6-23.2 144.4zM548.9 0c-42.2 0-106.7 28.3-146.3 72.8-36.5 40.8-64.6 101.9-64.6 163.1 0 8.3 1.3 16.6 1.9 19.2 3.2.6 8.4 1.3 13.6 1.3 37.8 0 100-25.7 138-68.8 37.1-41.5 64-101.9 64-162.5 0-7.1-1.3-14.2-6.6-25.1z"/>
    </svg>
  )
}

// ── Login with Code ──────────────────────────────────────────────
function CodeLoginView() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (code.trim().length < 6) return
    setLoading(true)
    setError(null)
    try {
      await signInWithCode(code)
      // session change handled by App.jsx
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <div className="text-4xl">📱</div>
        <p className="text-gray-300 font-medium">Use your iPhone to log in</p>
        <p className="text-gray-500 text-sm">
          Open the Veridict app → Profile → Generate Login Code, then enter it below.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          className="input text-center text-3xl font-bold tracking-[0.4em] uppercase"
          placeholder="XXXXXX"
          value={code}
          onChange={e => setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6))}
          maxLength={6}
          autoComplete="off"
          autoFocus
        />
        <p className="text-xs text-gray-600 text-center">Code expires in 5 minutes</p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || code.trim().length < 6}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {loading ? <LoadingSpinner size="sm" /> : null}
          {loading ? 'Verifying...' : 'Log In with Code'}
        </button>
      </form>
    </div>
  )
}

// ── Email Login / Signup ─────────────────────────────────────────
function EmailLoginView() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [appleLoading, setAppleLoading] = useState(false)
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
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleApple() {
    setAppleLoading(true)
    setError(null)
    try {
      await signInWithApple()
    } catch (e) {
      setError(e.message)
      setAppleLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Sign in with Apple */}
      <button
        onClick={handleApple}
        disabled={appleLoading}
        className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-black font-semibold py-3 rounded-xl transition-colors disabled:opacity-50"
      >
        {appleLoading ? <LoadingSpinner size="sm" /> : <AppleLogo />}
        {appleLoading ? 'Redirecting...' : 'Sign in with Apple'}
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-800" />
        <span className="text-xs text-gray-600 font-medium">or</span>
        <div className="flex-1 h-px bg-gray-800" />
      </div>

      {/* Sign in / Sign up toggle */}
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
  )
}

// ── Main AuthView ────────────────────────────────────────────────
export default function AuthView() {
  const [tab, setTab] = useState('code') // 'code' | 'email'

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

        <div className="card p-6 space-y-5">
          {/* Tab switcher */}
          <div className="grid grid-cols-2 bg-gray-800 p-1 rounded-xl">
            <button
              onClick={() => setTab('code')}
              className={`py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                tab === 'code' ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              📱 App Code
            </button>
            <button
              onClick={() => setTab('email')}
              className={`py-2 rounded-lg text-sm font-semibold transition-colors ${
                tab === 'email' ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              ✉️ Email
            </button>
          </div>

          {tab === 'code' ? <CodeLoginView /> : <EmailLoginView />}
        </div>
      </div>
    </div>
  )
}
