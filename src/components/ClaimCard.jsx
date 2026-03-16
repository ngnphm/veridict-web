import { useNavigate } from 'react-router-dom'
import ClaimStatusBadge from './ClaimStatusBadge'

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ClaimCard({ claim }) {
  const navigate = useNavigate()
  const total = (claim.totalForAmount || 0) + (claim.totalAgainstAmount || 0)
  const forPct = total > 0 ? Math.round((claim.totalForAmount / total) * 100) : 50

  return (
    <div
      className="card p-4 cursor-pointer hover:border-gray-700 transition-colors"
      onClick={() => navigate(`/claim/${claim.id}`)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <ClaimStatusBadge status={claim.status} />
        <span className="text-xs text-gray-500">{formatDate(claim.dueDate)}</span>
      </div>

      {/* Statement */}
      <p className="text-gray-100 font-medium leading-snug line-clamp-3 mb-3">
        {claim.statement}
      </p>

      {/* Result banner */}
      {claim.status === 'resolved' && claim.result !== null && (
        <div className={`rounded-lg px-3 py-1.5 mb-3 text-sm font-semibold ${
          claim.result ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
        }`}>
          {claim.result ? '✓ Proven True' : '✗ Proven False'}
        </div>
      )}

      {/* Bet bar */}
      {total > 0 && (
        <div className="mb-2">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span className="text-green-400 font-medium">For ${claim.totalForAmount}</span>
            <span className="text-red-400 font-medium">Against ${claim.totalAgainstAmount}</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${forPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
        <span>💰 ${total} pool</span>
        <span>👥 {claim.participantCount} participants</span>
        {!claim.isPublic && <span>🔒 Private</span>}
      </div>
    </div>
  )
}
