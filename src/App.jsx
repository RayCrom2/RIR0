import React from 'react'
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom'
import { MdRestaurant, MdFitnessCenter, MdAccessibility, MdPerson } from 'react-icons/md'
import DiagramPage from './pages/DiagramPage'
import Videos from './pages/Videos'
import Nutrition from './pages/Nutrition'
import ExerciseLogger from './pages/ExerciseLogger'
import Profile from './pages/Profile'
import { AuthProvider, useAuth } from './context/AuthContext'
import AuthModal from './components/AuthModal'
import OnboardingModal from './components/OnboardingModal'
import { supabase } from './lib/supabase'

function NavAuth() {
  const { user, setModalOpen } = useAuth();
  const navigate = useNavigate();
  if (user) {
    const avatarUrl = user.user_metadata?.avatar_url;
    const initial = (user.user_metadata?.full_name || user.email || '?')[0].toUpperCase();
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="avatar"
            title="Profile & Goals"
            onClick={() => navigate('/profile')}
            style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, cursor: 'pointer' }}
          />
        ) : (
          <div
            title="Profile & Goals"
            onClick={() => navigate('/profile')}
            style={{ width: 30, height: 30, borderRadius: '50%', background: '#ff8c42', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0, cursor: 'pointer' }}
          >
            {initial}
          </div>
        )}
        <button
          onClick={() => supabase.auth.signOut()}
          style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 13, color: '#555' }}
        >
          Sign Out
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={() => setModalOpen(true)}
      style={{ marginLeft: 'auto', background: '#ff8c42', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
    >
      Sign In
    </button>
  );
}

function BottomNav() {
  const { user, setModalOpen } = useAuth();
  const avatarUrl = user?.user_metadata?.avatar_url;
  const initial = (user?.user_metadata?.full_name || user?.email || '?')[0]?.toUpperCase();
  return (
    <nav className="bottom-nav">
      <NavLink to="/nutrition" className={({ isActive }) => 'bottom-nav-item' + (isActive ? ' active' : '')}>
        <MdRestaurant size={24} />
        <span>Nutrition</span>
      </NavLink>
      <NavLink to="/exerciselogger" className={({ isActive }) => 'bottom-nav-item' + (isActive ? ' active' : '')}>
        <MdFitnessCenter size={24} />
        <span>Exercise</span>
      </NavLink>
      <NavLink to="/diagram" className={({ isActive }) => 'bottom-nav-item' + (isActive ? ' active' : '')}>
        <MdAccessibility size={24} />
        <span>Diagram</span>
      </NavLink>
      {user ? (
        <NavLink to="/profile" className={({ isActive }) => 'bottom-nav-item' + (isActive ? ' active' : '')}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#ff8c42', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
              {initial}
            </div>
          )}
          <span>Profile</span>
        </NavLink>
      ) : (
        <button className="bottom-nav-item" onClick={() => setModalOpen(true)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
          <MdPerson size={24} />
          <span>Sign In</span>
        </button>
      )}
    </nav>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <div className="app">
        <nav className="top-nav">
          {/* <NavLink to="/">Home</NavLink> */}
          <NavLink to="/nutrition">Nutrition</NavLink>
          <NavLink to="/exerciselogger">Exercise Logger</NavLink>
          <NavLink to="/diagram">Muscle Diagram</NavLink>
          {/* <NavLink to="/videos">Videos</NavLink> */}
          <NavAuth />
        </nav>
        {/* <p>
        <img src="/pwa-icon.svg" alt="0" style={{ width: '3em', height: '3em', verticalAlign: 'middle', marginBottom: '0.15em' }} />
        </p> */}

        <Routes>
          <Route path="/" element={<Navigate to="/nutrition" replace />} />
          <Route path="/nutrition" element={<Nutrition />} />
          <Route path="/exerciselogger" element={<ExerciseLogger />} />
          <Route path="/diagram" element={<DiagramPage />} />
          <Route path="/profile" element={<Profile />} />
          {/* <Route path="/videos" element={<Videos />} /> */}
        </Routes>

        <AuthModal />
        <OnboardingModal />
        <BottomNav />
      </div>
    </AuthProvider>
  )
}
