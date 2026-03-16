import { useState, useEffect, useContext } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchClaimById, resolveClaim, deleteClaim } from '../services/claimService'
import { fetchBets, placeBet } from '../services/betService'
import { fetchVotes, castVote } from '../services/voteService'
import { fetchParticipantProfiles } from '../services/profileService'
import { verifyCriteria } from '../lib/openai'
import { AuthContext } from '../App'
import ClaimStatusBadge from '../components/ClaimStatusBadge'
import PlaceBetModal from '../components/PlaceBetModal'
import LoadingSpinner from '../components/LoadingSpinner'

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function BetRow({ bet, profiles }) {
  const profile = profiles.find(p => p.id === bet.userId)
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-800 last:border-0">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-400">
          {(profile?.displayName || profile?.username || '?')[0].toUpperCase()}
        </div>
        <span className="text-sm text-gray-300">{profile?.displayName || profile?.username || 'Unknown'}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
          bet.side === 'for' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
        }`}>
          {bet.side === 'for' ? '✓ For' : '✗ Against'}
        </span>
        <span className="text-sm font-semibold text-gray-200">${bet.amount}</span>
      </div>
    </div>
  )
}

export default function ClaimDetailView() {
  const { id } = useParams()
  const { user } = useContext(AuthContext)
  const navigate = useNavigate()

  const [claim, setClaim] = useState(null)
  const [bets, setBets] = useState([])
  const [votes, setVotes] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showBetModal, setShowBetModal] = useState(false)
  const [criteriaChecks, setCriteriaChecks] = useState([])
  const [aiResult, setAiResult] = useState(null)
  const [isAIVerifying, setIsAIVerifying] = useState(false)
  const [aiError, setAiError] = useState(null)
  const [resolving, setResolving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [votingFor, setVotingFor] = useState(false)
  const [shareToast, setShareToast] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [c, b, v] = await Promise.all([
        fetchClaimById(id),
        fetchBets(id),
        fetchVotes(id),
      ])
      setClaim(c)
      setBets(b)
      setVotes(v)
      setCriteriaChecks((c.verificationCriteria || []).map(() => false))

      // Load profiles
      const userIds = [...new Set([c.ownerId, ...b.map(x => x.userId), ...v.map(x => x.userId)])]
      const p = await fetchParticipantProfiles(userIds)
      setProfiles(p)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  if (loading) return <div className="flex justify-center py-24"><LoadingSpinner size="lg" /></div>
  if (error) return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="card p-6 text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={load} className="btn-secondary">Retry</button>
      </div>
    </div>
  )
  if (!claim) return null

  const isOwner = user?.id === claim.ownerId
  const myBet = bets.find(b => b.userId === user?.id)
  const myVote = votes.find(v => v.userId === user?.id)
  const totalFor = claim.totalForAmount || 0
  const totalAgainst = claim.totalAgainstAmount || 0
  const total = totalFor + totalAgainst
  const forPct = total > 0 ? Math.round((totalFor / total) * 100) : 50
  const hasCriteria = (claim.verificationCriteria || []).length > 0
  const allCriteriaChecked = criteriaChecks.length > 0 && criteriaChecks.every(Boolean)

  const canSelfVerify = isOwner
    && claim.status === 'active'
    && hasCriteria
    && bets.filter(b => b.side === 'against').length === 0

  const canVote = claim.status === 'voting' && !myVote && !isOwner

  async function handlePlaceBet(side, amount) {
    await placeBet(claim.id, user.id, side, amount)
    await load()
  }

  async function handleCastVote(vote) {
    if (!user) return
    setVotingFor(true)
    try {
      await castVote(claim.id, user.id, vote)
      await load()
    } finally {
      setVotingFor(false)
    }
  }

  async function handleAIVerify() {
    if (!hasCriteria) return
    setIsAIVerifying(true)
    setAiError(null)
    try {
      const result = await verifyCriteria(claim.statement, claim.verificationCriteria)
      setAiResult(result)
    } catch (e) {
      setAiError(e.message)
    } finally {
      setIsAIVerifying(false)
    }
  }

  async function handleResolve(result) {
    setResolving(true)
    try {
      await resolveClaim(claim.id, result)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setResolving(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this claim? This cannot be undone.')) return
    setDeleting(true)
    try {
      await deleteClaim(claim.id)
      navigate(-1)
    } catch (e) {
      setError(e.message)
      setDeleting(false)
    }
  }

  function handleShare() {
    const text = `Join my Veridict claim!\nCode: ${claim.shareCode}\n\n"${claim.statement}"`
    navigator.clipboard?.writeText(text).then(() => {
      setShareToast(true)
      setTimeout(() => setShareToast(false), 2000)
    })
  }

  const forBets = bets.filter(b => b.side === 'for')
  const againstBets = bets.filter(b => b.side === 'against')

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      {/* Back */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-400 hover:text-gray-200 text-sm">
        ← Back
      </button>

      {/* Header card */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <ClaimStatusBadge status={claim.status} />
          <div className="flex items-center gap-2">
            <button onClick={handleShare} className="text-xs text-gray-500 hover:text-gray-300 bg-gray-800 px-3 py-1.5 rounded-lg flex items-center gap-1">
              {shareToast ? '✓ Copied!' : '🔗 Share'}
            </button>
            {isOwner && claim.status === 'pending' && (
              <button onClick={handleDelete} disabled={deleting} className="text-xs text-red-400 hover:text-red-300 bg-gray-800 px-3 py-1.5 rounded-lg">
                {deleting ? '...' : '🗑 Delete'}
              </button>
            )}
          </div>
        </div>

        <p className="text-gray-100 font-semibold text-lg leading-snug">{claim.statement}</p>

        {claim.description && (
          <p className="text-gray-400 text-sm">{claim.description}</p>
        )}

        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
          {claim.verifyFromDate && <span>📅 Verify from: {formatDate(claim.verifyFromDate)}</span>}
          <span>⏰ Due: {formatDate(claim.dueDate)}</span>
          {claim.votingDeadline && <span>🗳 Voting deadline: {formatDate(claim.votingDeadline)}</span>}
          {!claim.isPublic && claim.shareCode && (
            <span className="font-mono bg-gray-800 px-2 py-0.5 rounded text-gray-400">
              Code: {claim.shareCode}
            </span>
          )}
        </div>

        {/* Result */}
        {claim.status === 'resolved' && claim.result !== null && (
          <div className={`rounded-xl px-4 py-3 font-semibold text-center ${
            claim.result ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
          }`}>
            {claim.result ? '✓ Proven True' : '✗ Proven False'}
          </div>
        )}
      </div>

      {/* Verification Criteria */}
      {hasCriteria && (
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold text-gray-200 text-sm uppercase tracking-wide">Verification Criteria</h2>
          <div className="space-y-2">
            {claim.verificationCriteria.map((c, i) => (
              <div key={i} className="flex items-start gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2 text-sm text-gray-300">
                <span className="text-green-400 mt-0.5">✓</span>
                {c}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bet Pool */}
      <div className="card p-5 space-y-3">
        <h2 className="font-semibold text-gray-200 text-sm uppercase tracking-wide">Bet Pool</h2>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-green-400 font-semibold">✓ For ${totalFor}</span>
          <span className="text-gray-500 text-xs">${total} total</span>
          <span className="text-red-400 font-semibold">Against ${totalAgainst} ✗</span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full" style={{ width: `${forPct}%` }} />
        </div>
        <p className="text-xs text-gray-500 text-center">{claim.participantCount} participant{claim.participantCount !== 1 ? 's' : ''}</p>

        {/* My bet */}
        {myBet && (
          <div className={`rounded-xl px-3 py-2 text-sm font-medium ${
            myBet.side === 'for' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
          }`}>
            Your bet: ${myBet.amount} {myBet.side === 'for' ? 'For ✓' : 'Against ✗'}
          </div>
        )}

        {/* Place bet button */}
        {!isOwner && !myBet && claim.status !== 'resolved' && claim.status !== 'disputed' && (
          <button onClick={() => setShowBetModal(true)} className="btn-primary w-full">
            Place a Bet
          </button>
        )}

        {isOwner && claim.status !== 'resolved' && claim.status !== 'disputed' && (
          <div className="rounded-xl px-3 py-2 text-sm text-gray-500 bg-gray-800/80">
            You cannot bet on your own claim.
          </div>
        )}
      </div>

      {/* Self Verify (owner) */}
      {canSelfVerify && (
        <div className="card p-5 space-y-4 border-brand-500/30">
          <h2 className="font-semibold text-brand-400">Verify Your Claim</h2>
          <p className="text-sm text-gray-400">No one has bet against you. Verify your criteria and resolve the claim.</p>

          <div className="space-y-2">
            {(claim.verificationCriteria || []).map((c, i) => (
              <label key={i} className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                criteriaChecks[i] ? 'bg-green-500/15 border border-green-500/30' : 'bg-gray-800 border border-transparent'
              }`}>
                <input
                  type="checkbox"
                  checked={criteriaChecks[i]}
                  onChange={e => {
                    const next = [...criteriaChecks]
                    next[i] = e.target.checked
                    setCriteriaChecks(next)
                  }}
                  className="mt-0.5 accent-green-500"
                />
                <span className="text-sm text-gray-300">{c}</span>
              </label>
            ))}
          </div>

          <button
            onClick={handleAIVerify}
            disabled={isAIVerifying}
            className="btn-secondary text-sm flex items-center gap-2"
          >
            {isAIVerifying ? <LoadingSpinner size="sm" /> : '🤖'}
            {isAIVerifying ? 'Verifying...' : 'AI Verify Criteria'}
          </button>

          {aiError && <p className="text-red-400 text-sm">{aiError}</p>}

          {aiResult && (
            <div className="space-y-2">
              {aiResult.results?.map((r, i) => (
                <div key={i} className={`rounded-xl p-3 text-sm ${r.met ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                  <p className={`font-medium ${r.met ? 'text-green-400' : 'text-red-400'}`}>
                    {r.met ? '✓' : '✗'} {r.criterion}
                  </p>
                  <p className="text-gray-400 mt-1">{r.reasoning}</p>
                </div>
              ))}
              <div className="bg-brand-500/10 rounded-xl p-3 text-sm text-brand-400">
                <strong>Summary:</strong> {aiResult.summary}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleResolve(true)}
              disabled={resolving || !allCriteriaChecked}
              className="py-2.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              {resolving ? <LoadingSpinner size="sm" /> : null}
              ✓ Proven True
            </button>
            <button
              onClick={() => handleResolve(false)}
              disabled={resolving}
              className="py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              {resolving ? <LoadingSpinner size="sm" /> : null}
              ✗ Proven False
            </button>
          </div>
        </div>
      )}

      {/* Voting Section */}
      {claim.status === 'voting' && (
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-purple-400">🗳 Voting Phase</h2>
          {claim.votingDeadline && (
            <p className="text-sm text-gray-500">Voting closes: {formatDate(claim.votingDeadline)}</p>
          )}
          <p className="text-sm text-gray-400">
            {votes.filter(v => v.vote).length} True / {votes.filter(v => !v.vote).length} False
            ({votes.length} votes total)
          </p>

          {myVote ? (
            <div className={`rounded-xl px-3 py-2 text-sm font-medium text-center ${
              myVote.vote ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
            }`}>
              You voted: {myVote.vote ? 'True ✓' : 'False ✗'}
            </div>
          ) : canVote ? (
            hasCriteria ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-400">Check each criterion that you believe is met:</p>
                {(claim.verificationCriteria || []).map((c, i) => (
                  <label key={i} className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer ${
                    criteriaChecks[i] ? 'bg-green-500/15 border border-green-500/30' : 'bg-gray-800 border border-transparent'
                  }`}>
                    <input
                      type="checkbox"
                      checked={criteriaChecks[i]}
                      onChange={e => {
                        const next = [...criteriaChecks]
                        next[i] = e.target.checked
                        setCriteriaChecks(next)
                      }}
                      className="mt-0.5 accent-green-500"
                    />
                    <span className="text-sm text-gray-300">{c}</span>
                  </label>
                ))}
                <p className="text-xs text-gray-500">{criteriaChecks.filter(Boolean).length}/{criteriaChecks.length} criteria checked</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleCastVote(true)}
                    disabled={votingFor || !allCriteriaChecked}
                    className="py-2.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-semibold text-sm"
                  >
                    Vote True ✓
                  </button>
                  <button
                    onClick={() => handleCastVote(false)}
                    disabled={votingFor}
                    className="py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-semibold text-sm"
                  >
                    Vote False ✗
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => handleCastVote(true)} disabled={votingFor}
                  className="py-3 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-semibold">
                  True ✓
                </button>
                <button onClick={() => handleCastVote(false)} disabled={votingFor}
                  className="py-3 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-semibold">
                  False ✗
                </button>
              </div>
            )
          ) : isOwner ? (
            <p className="text-sm text-gray-500 italic">You cannot vote on your own claim.</p>
          ) : null}
        </div>
      )}

      {/* Bets list */}
      {bets.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold text-gray-200 text-sm uppercase tracking-wide mb-3">All Bets</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-green-400 font-semibold mb-2">FOR ({forBets.length})</p>
              {forBets.map(b => <BetRow key={b.id} bet={b} profiles={profiles} />)}
            </div>
            <div>
              <p className="text-xs text-red-400 font-semibold mb-2">AGAINST ({againstBets.length})</p>
              {againstBets.map(b => <BetRow key={b.id} bet={b} profiles={profiles} />)}
            </div>
          </div>
        </div>
      )}

      {showBetModal && (
        <PlaceBetModal
          claim={claim}
          onClose={() => setShowBetModal(false)}
          onPlace={handlePlaceBet}
        />
      )}
    </div>
  )
}
