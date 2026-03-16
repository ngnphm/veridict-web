import { useState } from 'react'
import LoadingSpinner from './LoadingSpinner'

const PRESETS = [50, 100, 250, 500]

export default function PlaceBetModal({ claim, onClose, onPlace }) {
  const [side, setSide] = useState('for')
  const [amount, setAmount] = useState(100)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handlePlace() {
    if (amount < 1) return
    setLoading(true)
    setError(null)
    try {
      await onPlace(side, amount)
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="card w-full max-w-md p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Place a Bet</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 text-xl">&times;</button>
        </div>

        {/* Claim summary */}
        <p className="text-sm text-gray-400 bg-gray-800 rounded-xl p-3 line-clamp-3">
          {claim.statement}
        </p>

        {/* Side picker */}
        <div>
          <label className="label">Your position</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setSide('for')}
              className={`py-3 rounded-xl font-semibold text-sm transition-colors ${
                side === 'for'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              ✓ For
            </button>
            <button
              onClick={() => setSide('against')}
              className={`py-3 rounded-xl font-semibold text-sm transition-colors ${
                side === 'against'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              ✗ Against
            </button>
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="label">Bet amount</label>
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => setAmount(a => Math.max(1, a - 10))}
              className="w-10 h-10 rounded-xl bg-gray-800 hover:bg-gray-700 text-xl font-bold flex items-center justify-center"
            >−</button>
            <div className="flex-1 text-center text-3xl font-bold text-gray-100">
              ${amount}
            </div>
            <button
              onClick={() => setAmount(a => a + 10)}
              className="w-10 h-10 rounded-xl bg-gray-800 hover:bg-gray-700 text-xl font-bold flex items-center justify-center"
            >+</button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {PRESETS.map(p => (
              <button
                key={p}
                onClick={() => setAmount(p)}
                className={`py-2 rounded-xl text-sm font-semibold transition-colors ${
                  amount === p ? 'bg-brand-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                ${p}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          onClick={handlePlace}
          disabled={loading || amount < 1}
          className={`w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-colors ${
            side === 'for'
              ? 'bg-green-600 hover:bg-green-700 disabled:opacity-50'
              : 'bg-red-600 hover:bg-red-700 disabled:opacity-50'
          }`}
        >
          {loading ? <LoadingSpinner size="sm" /> : null}
          {loading ? 'Placing...' : `Bet $${amount} ${side === 'for' ? 'For' : 'Against'}`}
        </button>
      </div>
    </div>
  )
}
