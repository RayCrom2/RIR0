import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import HumanDiagram from '../components/HumanDiagram'
import HumanDiagramBack from '../components/HumanDiagramBack'
import HumanDiagramFemaleFront from '../components/HumanDiagramFemaleFront'
import HumanDiagramFemaleBack from '../components/HumanDiagramFemaleBack'
import muscles from '../data/muscles'
import '../pages-css/DiagramPage.css'

export default function DiagramPage() {
  const [selected, setSelected] = useState(null)
  const [activePart, setActivePart] = useState(null)
  const [diagramView, setDiagramView] = useState('front')
  const diagramRef = useRef(null)
  const navigate = useNavigate()

  const extractSlug = (val) => {
    if (typeof val === 'string') return val

    if (val && typeof val === 'object') {
      if (val.slug || val.name || val.id || val.key) {
        return val.slug || val.name || val.id || val.key
      }
      const t = val.target || val.currentTarget
      if (t) {
        const el = t.closest ? t.closest('[data-muscle], [aria-label]') : t
        const byData =
          el?.dataset?.muscle ??
          el?.getAttribute?.('data-muscle') ??
          t?.dataset?.muscle ??
          t?.getAttribute?.('data-muscle')
        const byAria =
          el?.getAttribute?.('aria-label') ?? t?.getAttribute?.('aria-label')
        if (byData) return byData
        if (byAria) return byAria

        const id = el?.id || t?.id
        if (id && /[a-z]+(\.(left|right))?$/i.test(id)) return id
      }
    }

    return null
  }

  const normalizeForDisplay = (slug) => {
    if (!slug) return null
    const base = slug.replace(/\.(left|right)$/i, '')
    return base.charAt(0).toUpperCase() + base.slice(1)
  }

  const handleSelect = (val) => {
    const raw = extractSlug(val)
    if (typeof raw === 'string' && raw.trim()) {
      setSelected(raw.trim())
    }
  }

  useEffect(() => {
    const root = diagramRef.current
    if (!root) return

    const onClickCapture = (e) => {
      const slug = extractSlug(e)
      if (slug) setSelected(slug)
    }

    const onCustom = (e) => {
      const slug = e?.detail?.slug || extractSlug(e)
      if (slug) setSelected(slug)
    }

    root.addEventListener('click', onClickCapture, true)
    window.addEventListener('muscle-select', onCustom)

    return () => {
      root.removeEventListener('click', onClickCapture, true)
      window.removeEventListener('muscle-select', onCustom)
    }
  }, [])

  const displayName = useMemo(() => normalizeForDisplay(selected), [selected])

  const displayInfo = useMemo(() => {
    if (!selected) return null
    const base = selected.replace(/\.(left|right)$/i, '')
    return muscles[base] || null
  }, [selected])

  useEffect(() => {
    setActivePart(null)
  }, [selected])

  return (
    <>
      <div className="diagram-view-controls">
        <button
          type="button"
          onClick={() => setDiagramView('front')}
          className={`view-btn${diagramView === 'front' ? ' active' : ''}`}
        >
          Front (Male)
        </button>
        <button
          type="button"
          onClick={() => setDiagramView('back')}
          className={`view-btn${diagramView === 'back' ? ' active' : ''}`}
        >
          Back (Male)
        </button>
        <button
          type="button"
          onClick={() => setDiagramView('front2')}
          className={`view-btn${diagramView === 'front2' ? ' active' : ''}`}
        >
          Front (Female)
        </button>
        <button
          type="button"
          onClick={() => setDiagramView('back2')}
          className={`view-btn${diagramView === 'back2' ? ' active' : ''}`}
        >
          Back (Female)
        </button>
      </div>

      <div className="layout" ref={diagramRef}>
        {diagramView === 'front' ? (
          <HumanDiagram
            selected={selected}
            selectedSubpart={selected && activePart ? `${selected}.${activePart}` : selected}
            onSelect={handleSelect}
          />
        ) : diagramView === 'back' ? (
          <HumanDiagramBack selected={selected} onSelect={handleSelect} />
        ) : diagramView === 'front2' ? (
          <HumanDiagramFemaleFront selected={selected} onSelect={handleSelect} />
        ) : (
          <HumanDiagramFemaleBack selected={selected} onSelect={handleSelect} />
        )}

        <div className="info">
          <h2>
            <strong>{displayName}</strong>
          </h2>
          {displayInfo ? (
            <>
              <p>{displayInfo.description}</p>
              {displayInfo.tips ? (
                <p>
                  <strong>Tips:</strong> {displayInfo.tips}
                </p>
              ) : null}
              {displayInfo.parts && displayInfo.parts.length ? (
                <div className="parts-container">
                  <p>
                    <strong>Parts</strong>
                  </p>
                  <div className="parts-list">
                    {displayInfo.parts.map((p) => (
                      <button
                        key={p.key}
                        onClick={() => setActivePart(p.key)}
                        className={`part-btn${activePart === p.key ? ' active' : ''}`}
                      >
                        {p.name}
                      </button>
                    ))}
                    <button
                      onClick={() => setActivePart(null)}
                      className="part-btn-clear"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              ) : null}

              {activePart ? (
                (() => {
                  const part = displayInfo.parts?.find(
                    (pp) => pp.key === activePart
                  )
                  if (!part) return null
                  return (
                    <div className="part-detail">
                      <p>{part.description}</p>
                      {part.tips ? (
                        <p>
                          <strong>Tips:</strong> {part.tips}
                        </p>
                      ) : null}
                      {part.exercises && part.exercises.length ? (
                        <>
                          <p>
                            <strong>Exercises</strong>
                          </p>
                          <ul>
                            {part.exercises.map((ex) => (
                              <li key={ex}>
                                <a
                                  href="#"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    navigate(`/videos?exercise=${encodeURIComponent(ex)}`)
                                  }}
                                >
                                  {ex}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : null}
                    </div>
                  )
                })()
              ) : displayInfo.exercises && displayInfo.exercises.length ? (
                <>
                  <p>
                    <strong>Exercises</strong>
                  </p>
                  <ul>
                    {displayInfo.exercises.map((ex) => (
                      <li key={ex}>
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault()
                            navigate(`/videos?exercise=${encodeURIComponent(ex)}`)
                          }}
                        >
                          {ex}
                        </a>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              {displayInfo.contraindications &&
                displayInfo.contraindications.length ? (
                <>
                  <p>
                    <strong>Contraindications</strong>
                  </p>
                  <ul>
                    {displayInfo.contraindications.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </>
          ) : (
            <p>No muscle selected. Click the diagram.</p>
          )}
        </div>
      </div>
    </>
  )
}
