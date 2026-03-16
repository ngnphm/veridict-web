import { useState } from 'react'
import LoadingSpinner from './LoadingSpinner'

export default function ShareCodeModal({ onClose, onJoin }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleJoin() {
    if (!code.trim()) return
    setLoading(true)
    setError(null)
    try {
      await onJoin(code.trim())
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="card w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Join Private Claim</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 text-xl">&times;</button>
        </div>
        <p className="text-sm text-gray-400">Enter the share code to access a private claim.</p>
        <input
          className="input font-mono tracking-widest"
          placeholder="Share code"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          maxLength={12}
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          onClick={handleJoin}
          disabled={loading || !code.trim()}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {loading ? <LoadingSpinner size="sm" /> : null}
          {loading ? 'Looking up...' : 'Join Claim'}
        </button>
      </div>
    </div>
  )
}
