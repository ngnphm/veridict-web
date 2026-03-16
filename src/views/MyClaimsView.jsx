import { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchMyClaims, fetchClaimsIBetOn } from '../services/claimService'
import ClaimCard from '../components/ClaimCard'
import LoadingSpinner from '../components/LoadingSpinner'
import { AuthContext } from '../App'

export default function MyClaimsView() {
  const { user } = useContext(AuthContext)
  const [tab, setTab] = useState('created')
  const [createdClaims, setCreatedClaims] = useState([])
  const [bettingClaims, setBettingClaims] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [created, betting] = await Promise.all([
        fetchMyClaims(user.id),
        fetchClaimsIBetOn(user.id),
      ])
      setCreatedClaims(created)
      setBettingClaims(betting)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const displayed = tab === 'created' ? createdClaims : bettingClaims

  const emptyMessages = {
    created: { icon: '📝', title: "No claims yet", sub: "Tap + to create your first claim" },
    betting: { icon: '🎯', title: "No bets yet", sub: "Browse the feed to find claims to bet on" },
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-100">My Claims</h1>
        <button
          onClick={() => navigate('/create')}
          className="w-10 h-10 rounded-full bg-brand-500 hover:bg-brand-600 flex items-center justify-center text-white text-2xl font-bold transition-colors"
          title="Create new claim"
        >
          +
        </button>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 bg-gray-900 border border-gray-800 p-1 rounded-xl mb-5">
        {[
          { key: 'created', label: `Created (${createdClaims.length})` },
          { key: 'betting', label: `Betting On (${bettingClaims.length})` },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === t.key ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : error ? (
        <div className="card p-6 text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={load} className="btn-secondary">Retry</button>
        </div>
      ) : displayed.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">{emptyMessages[tab].icon}</div>
          <p className="text-gray-400 font-medium">{emptyMessages[tab].title}</p>
          <p className="text-gray-600 text-sm mt-1">{emptyMessages[tab].sub}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map(claim => (
            <ClaimCard key={claim.id} claim={claim} />
          ))}
        </div>
      )}
    </div>
  )
}
