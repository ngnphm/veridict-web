import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchPublicClaims, fetchClaimByShareCode } from '../services/claimService'
import ClaimCard from '../components/ClaimCard'
import ShareCodeModal from '../components/ShareCodeModal'
import LoadingSpinner from '../components/LoadingSpinner'

export default function FeedView() {
  const [claims, setClaims] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showShareModal, setShowShareModal] = useState(false)
  const navigate = useNavigate()

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchPublicClaims()
      setClaims(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleJoinByCode(code) {
    const claim = await fetchClaimByShareCode(code)
    navigate(`/claim/${claim.id}`)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Feed</h1>
          <p className="text-gray-500 text-sm">Public claims & bets</p>
        </div>
        <button
          onClick={() => setShowShareModal(true)}
          className="btn-secondary text-sm flex items-center gap-2"
        >
          🔑 Join Private
        </button>
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
      ) : claims.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">🌐</div>
          <p className="text-gray-400 font-medium">No public claims yet</p>
          <p className="text-gray-600 text-sm mt-1">Be the first to create one!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {claims.map(claim => (
            <ClaimCard key={claim.id} claim={claim} />
          ))}
        </div>
      )}

      {/* Refresh button */}
      {!loading && (
        <div className="flex justify-center mt-6">
          <button onClick={load} className="btn-secondary text-sm">
            ↻ Refresh
          </button>
        </div>
      )}

      {showShareModal && (
        <ShareCodeModal
          onClose={() => setShowShareModal(false)}
          onJoin={handleJoinByCode}
        />
      )}
    </div>
  )
}
