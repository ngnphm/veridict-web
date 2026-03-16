import { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchNotifications, markAsRead, markAllAsRead } from '../services/notificationService'
import { AuthContext } from '../App'
import LoadingSpinner from '../components/LoadingSpinner'

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const TYPE_CONFIGS = {
  newBet:         { icon: '💵', color: 'text-blue-400' },
  claimActive:    { icon: '⚡', color: 'text-green-400' },
  votingStarted:  { icon: '🗳', color: 'text-purple-400' },
  claimResolved:  { icon: '✅', color: 'text-green-400' },
  claimDisputed:  { icon: '⚠️', color: 'text-red-400' },
}

export default function NotificationsView() {
  const { user } = useContext(AuthContext)
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchNotifications(user.id)
      setNotifications(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleRead(notification) {
    if (!notification.isRead) {
      await markAsRead(notification.id)
      setNotifications(ns => ns.map(n => n.id === notification.id ? { ...n, isRead: true } : n))
    }
    if (notification.claimId) {
      navigate(`/claim/${notification.claimId}`)
    }
  }

  async function handleMarkAllRead() {
    await markAllAsRead(user.id)
    setNotifications(ns => ns.map(n => ({ ...n, isRead: true })))
  }

  const unreadCount = notifications.filter(n => !n.isRead).length

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-500">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button onClick={handleMarkAllRead} className="btn-secondary text-xs py-1.5">
            Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : error ? (
        <div className="card p-6 text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={load} className="btn-secondary">Retry</button>
        </div>
      ) : notifications.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">🔔</div>
          <p className="text-gray-400 font-medium">No notifications yet</p>
          <p className="text-gray-600 text-sm mt-1">You'll be notified about bets and claim updates</p>
        </div>
      ) : (
        <div className="card divide-y divide-gray-800">
          {notifications.map(n => {
            const cfg = TYPE_CONFIGS[n.type] || { icon: '🔔', color: 'text-gray-400' }
            return (
              <div
                key={n.id}
                onClick={() => handleRead(n)}
                className={`flex items-start gap-3 p-4 cursor-pointer hover:bg-gray-800/50 transition-colors ${
                  !n.isRead ? 'bg-blue-500/5' : ''
                }`}
              >
                <div className={`text-xl ${cfg.color} flex-shrink-0 mt-0.5`}>{cfg.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${!n.isRead ? 'text-gray-100' : 'text-gray-300'}`}>
                    {n.title}
                  </p>
                  {n.body && <p className="text-xs text-gray-500 mt-0.5 truncate">{n.body}</p>}
                  <p className="text-xs text-gray-600 mt-1">{timeAgo(n.createdAt)}</p>
                </div>
                {!n.isRead && (
                  <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0 mt-1.5" />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
