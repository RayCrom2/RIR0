import React from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import DiagramPage from './pages/DiagramPage'
import Videos from './pages/Videos'
import Nutrition from './pages/Nutrition'
import ExerciseLogger from './pages/ExerciseLogger'
import { AuthProvider, useAuth } from './context/AuthContext'
import AuthModal from './components/AuthModal'
import { supabase } from './lib/supabase'

function NavAuth() {
  const { user, setModalOpen } = useAuth();
  return user ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
      <span style={{ fontSize: 13, color: '#888' }}>{user.email}</span>
      <button
        onClick={() => supabase.auth.signOut()}
        style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 13, color: '#555' }}
      >
        Sign Out
      </button>
    </div>
  ) : (
    <button
      onClick={() => setModalOpen(true)}
      style={{ marginLeft: 'auto', background: '#ff8c42', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
    >
      Sign In
    </button>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <div className="app">
        <nav className="top-nav">
          <NavLink to="/">Home</NavLink>
          <NavLink to="/diagram">Muscle Diagram</NavLink>
          <NavLink to="/videos">Videos</NavLink>
          <NavLink to="/nutrition">Nutrition</NavLink>
          <NavLink to="/exerciselogger">Exercise Logger</NavLink>
          <NavAuth />
        </nav>
        <p className="font-bold text-[2rem] mb-1">
          RIR<span style={{ color: "red" }}>0</span>
        </p>

        <Routes>
          <Route path="/" element={<div><h2>Welcome to AIOFitness</h2><p>Select a page from the navigation above.</p></div>} />
          <Route path="/diagram" element={<DiagramPage />} />
          <Route path="/videos" element={<Videos />} />
          <Route path="/nutrition" element={<Nutrition />} />
          <Route path="/exerciselogger" element={<ExerciseLogger />} />
        </Routes>

        <AuthModal />
      </div>
    </AuthProvider>
  )
}
