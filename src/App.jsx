import { createContext, useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { getSession, onAuthStateChange } from './services/authService'
import { fetchNotifications } from './services/notificationService'
import { FullPageSpinner } from './components/LoadingSpinner'
import AuthView from './views/AuthView'
import FeedView from './views/FeedView'
import MyClaimsView from './views/MyClaimsView'
import CreateClaimView from './views/CreateClaimView'
import ClaimDetailView from './views/ClaimDetailView'
import ProfileView from './views/ProfileView'
import NotificationsView from './views/NotificationsView'

export const AuthContext = createContext({ user: null, session: null })

function NavBar({ user }) {
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!user) return
    fetchNotifications(user.id)
      .then(ns => setUnread(ns.filter(n => !n.isRead).length))
      .catch(() => {})
  }, [user])

  const linkClass = ({ isActive }) =>
    `flex flex-col items-center gap-0.5 text-xs font-medium transition-colors ${
      isActive ? 'text-brand-400' : 'text-gray-500 hover:text-gray-300'
    }`

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-950/90 backdrop-blur border-t border-gray-800 px-2 pb-safe z-40">
      <div className="max-w-2xl mx-auto flex justify-around">
        <NavLink to="/feed" className={linkClass}>
          <span className="text-xl">🌐</span>
          Feed
        </NavLink>
        <NavLink to="/my-claims" className={linkClass}>
          <span className="text-xl">📋</span>
          My Claims
        </NavLink>
        <NavLink to="/notifications" className={linkClass}>
          <span className="relative text-xl">
            🔔
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] flex items-center justify-center font-bold">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </span>
          Alerts
        </NavLink>
        <NavLink to="/profile" className={linkClass}>
          <span className="text-xl">👤</span>
          Profile
        </NavLink>
      </div>
    </nav>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = loading
  const [user, setUser] = useState(null)

  useEffect(() => {
    getSession().then(s => {
      setSession(s)
      setUser(s?.user ?? null)
    })

    const { data: { subscription } } = onAuthStateChange(s => {
      setSession(s)
      setUser(s?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) return <FullPageSpinner />

  return (
    <AuthContext.Provider value={{ user, session }}>
      <BrowserRouter>
        {!user ? (
          <Routes>
            <Route path="*" element={<AuthView />} />
          </Routes>
        ) : (
          <>
            <div className="pb-20"> {/* space for bottom nav */}
              <Routes>
                <Route path="/" element={<Navigate to="/feed" replace />} />
                <Route path="/feed" element={<FeedView />} />
                <Route path="/my-claims" element={<MyClaimsView />} />
                <Route path="/create" element={<CreateClaimView />} />
                <Route path="/claim/:id" element={<ClaimDetailView />} />
                <Route path="/notifications" element={<NotificationsView />} />
                <Route path="/profile" element={<ProfileView />} />
                <Route path="*" element={<Navigate to="/feed" replace />} />
              </Routes>
            </div>
            <NavBar user={user} />
          </>
        )}
      </BrowserRouter>
    </AuthContext.Provider>
  )
}
