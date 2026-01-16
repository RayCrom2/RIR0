import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import muscles from '../data/muscles'
import videos from '../data/videos'

const slugify = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

// robust extract youtube id from many URL formats (youtu.be, youtube.com, nocookie, embed, shorts, /v/)
function getYouTubeId(url) {
  if (!url) return null
  // quick reject
  if (typeof url !== 'string' || !url.trim()) return null
  // try URL parsing first
  try {
    const u = new URL(url)
    const host = (u.hostname || '').replace(/^www\./, '')
    if (host.includes('youtu.be')) {
      // short url: youtu.be/ID
      const parts = u.pathname.split('/').filter(Boolean)
      return parts[0] || null
    }

    if (host.includes('youtube.com') || host.includes('youtube-nocookie.com')) {
      // typical watch?v=ID
      const v = u.searchParams.get('v')
      if (v) return v

      // paths like /embed/ID, /v/ID, /shorts/ID
      const parts = u.pathname.split('/').filter(Boolean)
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i]
        if (p === 'embed' || p === 'v' || p === 'shorts') {
          if (parts[i + 1]) return parts[i + 1]
        }
      }

      // sometimes the id is the last segment (rare)
      const last = parts[parts.length - 1]
      if (last && /^[A-Za-z0-9_-]{6,}$/.test(last)) return last
    }
  } catch (err) {
    // fall through to regex fallback
  }

  // regex fallback to catch common patterns
  const m = url.match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i)
  if (m && m[1]) return m[1]

  // very loose fallback
  const m2 = url.match(/([A-Za-z0-9_-]{6,})/)
  return m2 ? m2[1] : null
}

const thumbFor = (id) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`

export default function Videos() {
  const [searchParams] = useSearchParams()
  const targetExercise = searchParams.get('exercise')
  
  const [playing, setPlaying] = useState(null) // youtube id currently playing

  // normalized lookup maps for case-insensitive matching
  const normalizedVideos = useMemo(() => {
    const map = Object.create(null)
    const slugMap = Object.create(null)
    Object.entries(videos).forEach(([k, v]) => {
      if (!k) return
      map[k.toLowerCase().trim()] = v
      slugMap[slugify(k)] = v
    })
    return { map, slugMap }
  }, [])

  // aggregate unique exercises from muscles data
  const exercises = useMemo(() => {
    const set = new Set()
    Object.values(muscles).forEach((m) => {
      if (m.exercises && m.exercises.length) m.exercises.forEach((e) => set.add(e))
      if (m.parts && m.parts.length)
        m.parts.forEach((p) => p.exercises && p.exercises.forEach((e) => set.add(e)))
    })
    return Array.from(set).sort()
  }, [])

  const listRef = useRef(null)

  useEffect(() => {
    if (!targetExercise) return
    const id = slugify(targetExercise)
    // wait a tick for rendering
    setTimeout(() => {
      const el = document.getElementById(id)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
  }, [targetExercise])

  return (
    <div style={{ padding: 16 }}>
      <h2>Exercise Videos</h2>
      
      <div
        ref={listRef}
        style={{
          display: 'grid',
          gap: 12,
          marginTop: 12,
          gridTemplateColumns: 'repeat(2, 1fr)',
        }}
      >
        {exercises.map((ex) => {
          const id = slugify(ex)
          const key = ex?.toString?.().toLowerCase().trim()
          const url =
            (key && normalizedVideos.map[key]) ||
            normalizedVideos.slugMap[id] ||
            null
          const yt = getYouTubeId(url)
          const thumb = yt ? thumbFor(yt) : null
          return (
            <div
              id={id}
              key={id}
              style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}
            >
              <h3 style={{ margin: '0 0 8px 0' }}>{ex}</h3>

              {yt ? (
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: '100%' }}>
                    {playing === yt ? (
                      <div style={{ position: 'relative', paddingTop: '56.25%' }}>
                        <iframe
                          title={ex}
                          src={`https://www.youtube.com/embed/${yt}?autoplay=1&rel=0`}
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                          }}
                        />
                      </div>
                    ) : (
                      <button
                        onClick={() => setPlaying(yt)}
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: 0,
                          border: 'none',
                          background: 'none',
                          cursor: 'pointer',
                        }}
                        aria-label={`Play ${ex}`}
                      >
                        <div style={{ position: 'relative' }}>
                          <img
                            src={thumb}
                            alt={`${ex} thumbnail`}
                            style={{ width: '100%', display: 'block', borderRadius: 6 }}
                          />
                          <div
                            style={{
                              position: 'absolute',
                              inset: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <div
                              style={{
                                width: 64,
                                height: 64,
                                borderRadius: 32,
                                background: 'rgba(0,0,0,0.6)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <svg width="28" height="28" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      </button>
                    )}
                  </div>
                  
                </div>
              ) : (
                <em>No video available</em>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
