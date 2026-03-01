import React from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import DiagramPage from './pages/DiagramPage'
import Videos from './pages/Videos'
import Nutrition from './pages/Nutrition'

export default function App() {
  return (
    <div className="app">
      <nav className="top-nav">
        <NavLink to="/">Home</NavLink>
        <NavLink to="/diagram">Muscle Diagram</NavLink>
        <NavLink to="/videos">Videos</NavLink>
        <NavLink to="/nutrition">Nutrition</NavLink>
        <NavLink to="/workouts">Workouts</NavLink>
      </nav>
      <h1>AIOFitness</h1>

      <Routes>
        <Route path="/" element={<div><h2>Welcome to AIOFitness</h2><p>Select a page from the navigation above.</p></div>} />
        <Route path="/diagram" element={<DiagramPage />} />
        <Route path="/videos" element={<Videos />} />
        <Route path="/nutrition" element={<Nutrition />} />
        <Route path="/workouts" element={<div><h2>Workouts Page</h2></div>} />
      </Routes>
    </div>
  )
}
