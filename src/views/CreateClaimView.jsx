import { useState, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { createClaim } from '../services/claimService'
import { generateVerificationCriteria } from '../lib/openai'
import { AuthContext } from '../App'
import LoadingSpinner from '../components/LoadingSpinner'

export default function CreateClaimView({ onCreated }) {
  const { user } = useContext(AuthContext)
  const navigate = useNavigate()

  const [statement, setStatement] = useState('')
  const [description, setDescription] = useState('')
  const [verifyFromDate, setVerifyFromDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [criteria, setCriteria] = useState([])
  const [refinedStatement, setRefinedStatement] = useState('')
  const [dateReason, setDateReason] = useState('')

  const [isGenerating, setIsGenerating] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState(null)
  const [aiError, setAiError] = useState(null)

  // Today string for min dates
  const today = new Date().toISOString().split('T')[0]

  async function handleGenerateCriteria() {
    if (!statement.trim()) return
    setIsGenerating(true)
    setAiError(null)
    try {
      const result = await generateVerificationCriteria(statement)
      if (result.criteria) setCriteria(result.criteria)
      if (result.refinedStatement) setRefinedStatement(result.refinedStatement)
      if (result.verifyFromDate) setVerifyFromDate(result.verifyFromDate)
      if (result.dueDate) setDueDate(result.dueDate)
      if (result.dateReason) setDateReason(result.dateReason)
    } catch (e) {
      setAiError(e.message)
    } finally {
      setIsGenerating(false)
    }
  }

  function applyRefinedStatement() {
    if (refinedStatement) {
      setStatement(refinedStatement)
      setRefinedStatement('')
    }
  }

  function removeCriterion(idx) {
    setCriteria(c => c.filter((_, i) => i !== idx))
  }

  async function handleCreate() {
    if (!statement.trim()) { setError('Please enter a claim statement.'); return }
    if (!dueDate) { setError('Please set a due date.'); return }
    setError(null)
    setIsCreating(true)
    try {
      const claim = await createClaim({
        ownerId: user.id,
        statement: statement.trim(),
        description: description.trim() || null,
        verifyFromDate: verifyFromDate || null,
        dueDate,
        isPublic,
        verificationCriteria: criteria.length ? criteria : null,
      })
      if (onCreated) onCreated()
      navigate(`/claim/${claim.id}`)
    } catch (e) {
      setError(e.message)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-200">
          ←
        </button>
        <h1 className="text-2xl font-bold">New Claim</h1>
      </div>

      <div className="space-y-5">
        {/* Statement */}
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold text-gray-200">Claim Statement</h2>
          <textarea
            className="input resize-none"
            rows={4}
            placeholder="e.g. Bitcoin will reach $150,000 by end of 2025..."
            value={statement}
            onChange={e => setStatement(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              onClick={handleGenerateCriteria}
              disabled={isGenerating || !statement.trim()}
              className="btn-secondary text-sm flex items-center gap-2 flex-1"
            >
              {isGenerating ? <LoadingSpinner size="sm" /> : '🤖'}
              {isGenerating ? 'Analyzing...' : 'Generate Criteria (AI)'}
            </button>
          </div>
          {aiError && <p className="text-red-400 text-sm">{aiError}</p>}
        </div>

        {/* AI Suggestion */}
        {refinedStatement && (
          <div className="card p-5 space-y-3 border-brand-500/30">
            <h2 className="font-semibold text-brand-400">✨ AI-Refined Statement</h2>
            <p className="text-gray-300 text-sm leading-relaxed">{refinedStatement}</p>
            <button onClick={applyRefinedStatement} className="btn-primary text-sm">
              Use Refined Statement
            </button>
          </div>
        )}

        {/* Verification Criteria */}
        {criteria.length > 0 && (
          <div className="card p-5 space-y-3">
            <h2 className="font-semibold text-gray-200">Verification Criteria</h2>
            <p className="text-xs text-gray-500">All criteria must be true for the claim to be proven.</p>
            <div className="space-y-2">
              {criteria.map((c, i) => (
                <div key={i} className="flex items-start gap-3 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2">
                  <span className="text-green-400 mt-0.5">✓</span>
                  <p className="text-sm text-gray-300 flex-1">{c}</p>
                  <button
                    onClick={() => removeCriterion(i)}
                    className="text-gray-600 hover:text-red-400 text-xs mt-0.5"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold text-gray-200">Details <span className="text-gray-600 font-normal">(optional)</span></h2>
          <textarea
            className="input resize-none"
            rows={3}
            placeholder="Add context or notes about your claim..."
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        {/* Verification Window */}
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold text-gray-200">Verification Window</h2>
          {dateReason && (
            <p className="text-xs text-brand-400 bg-brand-500/10 rounded-lg px-3 py-2">
              💡 {dateReason}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Verify From</label>
              <input
                type="date"
                className="input"
                min={today}
                value={verifyFromDate}
                onChange={e => setVerifyFromDate(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Due Date *</label>
              <input
                type="date"
                className="input"
                min={verifyFromDate || today}
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        {/* Visibility */}
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-200">Visibility</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {isPublic ? 'Anyone can see this claim in the feed' : 'Only people with the share code can view this'}
              </p>
            </div>
            <button
              onClick={() => setIsPublic(p => !p)}
              className={`relative w-12 h-6 rounded-full transition-colors ${isPublic ? 'bg-brand-500' : 'bg-gray-700'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${isPublic ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleCreate}
          disabled={isCreating || !statement.trim() || !dueDate}
          className="btn-primary w-full py-3.5 text-base flex items-center justify-center gap-2"
        >
          {isCreating ? <LoadingSpinner size="sm" /> : null}
          {isCreating ? 'Creating...' : 'Create Claim'}
        </button>
      </div>
    </div>
  )
}
