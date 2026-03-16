import { useState, useEffect, useContext } from 'react'
import { fetchMyProfile, updateProfile } from '../services/profileService'
import { signOut } from '../services/authService'
import { AuthContext } from '../App'
import LoadingSpinner from '../components/LoadingSpinner'

function StatCard({ label, value, valueClass = '' }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 text-center">
      <p className={`text-2xl font-bold ${valueClass || 'text-gray-100'}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  )
}

export default function ProfileView() {
  const { user } = useContext(AuthContext)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [signingOut, setSigningOut] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const p = await fetchMyProfile(user.id)
      setProfile(p)
      setDisplayName(p.displayName || '')
      setUsername(p.username || '')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      const updated = await updateProfile(user.id, { displayName, username })
      setProfile(updated)
      setEditing(false)
    } catch (e) {
      setSaveError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
    } catch {
      setSigningOut(false)
    }
  }

  const winRate = profile
    ? profile.betsWon + profile.betsLost > 0
      ? Math.round((profile.betsWon / (profile.betsWon + profile.betsLost)) * 100)
      : 0
    : 0

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-100">Profile</h1>
        <button onClick={load} className="text-gray-500 hover:text-gray-300 text-sm">↻</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : error ? (
        <div className="card p-6 text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={load} className="btn-secondary">Retry</button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Avatar + name */}
          <div className="card p-6 flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-brand-500/20 flex items-center justify-center text-3xl">
              👤
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-100">
                {profile?.displayName || profile?.username || 'User'}
              </h2>
              <p className="text-gray-500 text-sm">@{profile?.username}</p>
              <p className="text-gray-600 text-xs mt-0.5">
                Member since {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'}
              </p>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Claims Created" value={profile?.claimsCreated ?? 0} />
            <StatCard label="Proven True" value={profile?.claimsProven ?? 0} valueClass="text-green-400" />
            <StatCard label="Busted" value={profile?.claimsBusted ?? 0} valueClass="text-red-400" />
            <StatCard label="Bets Won" value={profile?.betsWon ?? 0} valueClass="text-green-400" />
            <StatCard label="Bets Lost" value={profile?.betsLost ?? 0} valueClass="text-red-400" />
            <StatCard
              label="Net Winnings"
              value={`$${profile?.totalWinnings ?? 0}`}
              valueClass={(profile?.totalWinnings ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}
            />
          </div>

          {/* Win rate */}
          <div className="card p-4 flex items-center justify-between">
            <span className="text-gray-400 text-sm font-medium">Win Rate</span>
            <span className={`text-2xl font-bold ${
              winRate >= 60 ? 'text-green-400' : winRate >= 40 ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {winRate}%
            </span>
          </div>

          {/* Edit profile */}
          {editing ? (
            <div className="card p-5 space-y-4">
              <h2 className="font-semibold">Edit Profile</h2>
              <div>
                <label className="label">Display Name</label>
                <input className="input" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your display name" />
              </div>
              <div>
                <label className="label">Username</label>
                <input className="input" value={username} onChange={e => setUsername(e.target.value)} placeholder="username" />
              </div>
              {saveError && <p className="text-red-400 text-sm">{saveError}</p>}
              <div className="flex gap-3">
                <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {saving ? <LoadingSpinner size="sm" /> : null}
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button onClick={() => setEditing(false)} className="btn-secondary flex-1">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} className="btn-secondary w-full">
              ✏️ Edit Profile
            </button>
          )}

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="btn-danger w-full flex items-center justify-center gap-2"
          >
            {signingOut ? <LoadingSpinner size="sm" /> : null}
            {signingOut ? 'Signing out...' : '→ Sign Out'}
          </button>
        </div>
      )}
    </div>
  )
}
