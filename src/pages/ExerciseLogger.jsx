import { useState, useRef, useEffect } from 'react';
import muscles from '../data/muscles.js';
import '../pages-css/ExerciseLogger.css';

const ROUTINES_KEY = 'exercise_routines';

// Deduplicated list of all exercises from muscles.js
const ALL_EXERCISES = [...new Set(
  Object.values(muscles).flatMap(m => [
    ...(m.exercises || []),
    ...(m.parts || []).flatMap(p => p.exercises || []),
  ])
)].sort();


export default function ExerciseLogger() {
  const [view, setView] = useState('select');

  // ── routines (persisted)
  const [routines, setRoutines] = useState(() => {
    try { return JSON.parse(localStorage.getItem(ROUTINES_KEY) || '[]'); } catch { return []; }
  });

  // ── create-routine state
  // cExs shape: [{ name, unit, sets: [{ reps, weight, rir }] }]
  const [cName,         setCName]         = useState('');
  const [cExs,          setCExs]          = useState([]);
  const [cSearch,       setCSearch]       = useState('');
  const [cDropdownOpen, setCDropdownOpen] = useState(false);
  const [cError,        setCError]        = useState('');
  const cSearchRef = useRef(null);

  // ── session state
  // sessionExs shape: [{ name, unit, sets: [{ reps, weight, rir, done }] }]
  const [sessionName,   setSessionName]   = useState('');
  const [sessionSource, setSessionSource] = useState('free');
  const [sessionExs,    setSessionExs]    = useState([]);
  const [sSearch,       setSSearch]       = useState('');
  const [sDropdownOpen, setSDropdownOpen] = useState(false);
  const [ending,        setEnding]        = useState(false);
  const [saveName,      setSaveName]      = useState('');
  const sSearchRef = useRef(null);

  // Derived session stats — only count sets marked done
  const doneSets  = sessionExs.flatMap(ex => ex.sets.filter(s => s.done));
  const totalSets = doneSets.length;
  const uniqueEx  = new Set(
    sessionExs.filter(ex => ex.sets.some(s => s.done)).map(ex => ex.name)
  ).size;
  const totalVol  = doneSets.reduce((sum, s) => {
    const w = Number(s.weight), r = Number(s.reps);
    return sum + (w > 0 && r > 0 ? w * r : 0);
  }, 0);

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // Close both search dropdowns on outside click
  useEffect(() => {
    function handleClick(e) {
      if (cSearchRef.current && !cSearchRef.current.contains(e.target)) setCDropdownOpen(false);
      if (sSearchRef.current && !sSearchRef.current.contains(e.target)) setSDropdownOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ── helpers
  function persistRoutines(next) {
    setRoutines(next);
    localStorage.setItem(ROUTINES_KEY, JSON.stringify(next));
  }

  // ── select actions
  function goCreate() {
    setCName(''); setCExs([]); setCSearch(''); setCDropdownOpen(false); setCError('');
    setView('create');
  }
  function goFreeSession() {
    setSessionName('New Workout'); setSessionSource('free');
    setSessionExs([]); setSSearch(''); setSDropdownOpen(false);
    setEnding(false); setSaveName('');
    setView('session');
  }
  function goRoutineSession(r) {
    setSessionName(r.name); setSessionSource('routine');
    // Pre-populate exercise cards from the saved routine
    const initialExs = r.exercises.map(ex => {
      const sets = Array.isArray(ex.sets)
        ? ex.sets.map(s => ({
            reps:   String(s.reps   != null ? s.reps   : ''),
            weight: String(s.weight != null ? s.weight : ''),
            rir:    String(s.rir    != null ? s.rir    : ''),
            done:   false,
          }))
        : [{ reps: String(ex.reps || ''), weight: String(ex.weight != null ? ex.weight : ''), rir: String(ex.rir != null ? ex.rir : ''), done: false }];
      return { name: ex.name, unit: ex.unit || 'lbs', sets };
    });
    setSessionExs(initialExs);
    setSSearch(''); setSDropdownOpen(false);
    setEnding(false); setSaveName(r.name);
    setView('session');
  }
  function deleteRoutine(id) {
    if (window.confirm('Delete this routine?')) persistRoutines(routines.filter(r => r.id !== id));
  }

  // ── create-routine: search
  const cSearchResults = cSearch.trim()
    ? ALL_EXERCISES.filter(ex => ex.toLowerCase().includes(cSearch.toLowerCase()))
    : [];

  function cAddExercise(name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (cExs.some(e => e.name.toLowerCase() === trimmed.toLowerCase())) {
      setCSearch(''); setCDropdownOpen(false); return;
    }
    setCExs(prev => [...prev, { name: trimmed, unit: 'lbs', sets: [{ reps: '', weight: '', rir: '' }] }]);
    setCSearch(''); setCDropdownOpen(false); setCError('');
  }
  function cHandleSearchKey(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (cSearchResults.length > 0) cAddExercise(cSearchResults[0]);
    else if (cSearch.trim()) cAddExercise(cSearch);
  }
  function cAddSet(exIdx) {
    setCExs(prev => prev.map((ex, i) => {
      if (i !== exIdx) return ex;
      return { ...ex, sets: [...ex.sets, { ...ex.sets[ex.sets.length - 1] }] };
    }));
  }
  function cRemoveSet(exIdx, setIdx) {
    setCExs(prev => prev.map((ex, i) => {
      if (i !== exIdx || ex.sets.length <= 1) return ex;
      return { ...ex, sets: ex.sets.filter((_, j) => j !== setIdx) };
    }));
  }
  function cUpdateSet(exIdx, setIdx, field, value) {
    setCExs(prev => prev.map((ex, i) => {
      if (i !== exIdx) return ex;
      return { ...ex, sets: ex.sets.map((s, j) => j !== setIdx ? s : { ...s, [field]: value }) };
    }));
  }
  function cUpdateUnit(exIdx, value) {
    setCExs(prev => prev.map((ex, i) => i !== exIdx ? ex : { ...ex, unit: value }));
  }
  function cRemoveEx(exIdx) {
    setCExs(prev => prev.filter((_, i) => i !== exIdx));
  }
  function cSave() {
    if (!cName.trim())     { setCError('Routine name is required.'); return; }
    if (cExs.length === 0) { setCError('Add at least one exercise.'); return; }
    const exercises = cExs.map(ex => ({
      name: ex.name,
      unit: ex.unit,
      sets: ex.sets.map(s => ({
        reps:   Number(s.reps)  || 1,
        weight: s.weight !== '' ? Number(s.weight) : null,
        rir:    s.rir    !== '' ? Number(s.rir)    : null,
      })),
    }));
    persistRoutines([...routines, { id: String(Date.now()), name: cName.trim(), exercises }]);
    setView('select');
  }

  // ── session: search
  const sSearchResults = sSearch.trim()
    ? ALL_EXERCISES.filter(ex => ex.toLowerCase().includes(sSearch.toLowerCase()))
    : [];

  function sAddExercise(name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (sessionExs.some(e => e.name.toLowerCase() === trimmed.toLowerCase())) {
      setSSearch(''); setSDropdownOpen(false); return;
    }
    setSessionExs(prev => [...prev, { name: trimmed, unit: 'lbs', sets: [{ reps: '', weight: '', rir: '', done: false }] }]);
    setSSearch(''); setSDropdownOpen(false);
  }
  function sHandleSearchKey(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (sSearchResults.length > 0) sAddExercise(sSearchResults[0]);
    else if (sSearch.trim()) sAddExercise(sSearch);
  }
  function sAddSet(exIdx) {
    setSessionExs(prev => prev.map((ex, i) => {
      if (i !== exIdx) return ex;
      const last = ex.sets[ex.sets.length - 1];
      return { ...ex, sets: [...ex.sets, { ...last, done: false }] };
    }));
  }
  function sRemoveSet(exIdx, setIdx) {
    setSessionExs(prev => prev.map((ex, i) => {
      if (i !== exIdx || ex.sets.length <= 1) return ex;
      return { ...ex, sets: ex.sets.filter((_, j) => j !== setIdx) };
    }));
  }
  function sUpdateSet(exIdx, setIdx, field, value) {
    setSessionExs(prev => prev.map((ex, i) => {
      if (i !== exIdx) return ex;
      return { ...ex, sets: ex.sets.map((s, j) => j !== setIdx ? s : { ...s, [field]: value }) };
    }));
  }
  function sToggleDone(exIdx, setIdx) {
    setSessionExs(prev => prev.map((ex, i) => {
      if (i !== exIdx) return ex;
      return { ...ex, sets: ex.sets.map((s, j) => j !== setIdx ? s : { ...s, done: !s.done }) };
    }));
  }
  function sUpdateUnit(exIdx, value) {
    setSessionExs(prev => prev.map((ex, i) => i !== exIdx ? ex : { ...ex, unit: value }));
  }
  function sRemoveEx(exIdx) {
    setSessionExs(prev => prev.filter((_, i) => i !== exIdx));
  }
  function doSaveAsRoutine() {
    if (!saveName.trim()) return;
    const exercises = sessionExs.map(ex => ({
      name: ex.name,
      unit: ex.unit,
      sets: ex.sets.map(({ done: _, ...s }) => ({
        reps:   Number(s.reps)  || 1,
        weight: s.weight !== '' ? Number(s.weight) : null,
        rir:    s.rir    !== '' ? Number(s.rir)    : null,
      })),
    }));
    persistRoutines([...routines, { id: String(Date.now()), name: saveName.trim(), exercises }]);
    finishSession();
  }
  function finishSession() { setView('select'); setEnding(false); setSessionExs([]); }

  // ═══════════════════════════════════════════════
  // SELECT VIEW
  // ═══════════════════════════════════════════════
  if (view === 'select') return (
    <div className="exercise-logger">
      <h2 style={{ marginBottom: 4 }}>Exercise Logger</h2>
      <p className="logger-subtitle">{today}</p>

      <div className="select-grid">
        <button onClick={goCreate} className="create-routine-btn">
          <div className="action-card-icon">📋</div>
          <div className="action-card-title">Create Routine</div>
          <div className="action-card-desc">Build a named template with exercises to reuse later</div>
        </button>
        <button onClick={goFreeSession} className="new-workout-btn">
          <div className="action-card-icon">⚡</div>
          <div className="action-card-title">New Workout</div>
          <div className="action-card-desc">Log exercises as you go — option to save as a routine when done</div>
        </button>
      </div>

      <div className="routines-header">
        <span className="routines-label">My Routines</span>
        <span className="routines-count">({routines.length})</span>
      </div>

      {routines.length === 0 ? (
        <div className="no-routines">
          No routines yet — create your first one above.
        </div>
      ) : (
        routines.map(r => (
          <div key={r.id} className="routine-item">
            <div className="routine-info">
              <div className="routine-name">{r.name}</div>
              <div className="routine-exercises">
                {r.exercises.length} exercise{r.exercises.length !== 1 ? 's' : ''}: {r.exercises.map(e => e.name).join(', ')}
              </div>
            </div>
            <div className="routine-actions">
              <button onClick={() => goRoutineSession(r)} className="btn-start">▶ Start</button>
              <button onClick={() => deleteRoutine(r.id)} className="btn-delete-routine" title="Delete routine">✕</button>
            </div>
          </div>
        ))
      )}
    </div>
  );

  // ═══════════════════════════════════════════════
  // CREATE ROUTINE VIEW
  // ═══════════════════════════════════════════════
  if (view === 'create') return (
    <div className="exercise-logger">
      <div className="logger-header">
        <button onClick={() => setView('select')} className="btn-back">← Back</button>
        <h2>Create Routine</h2>
      </div>
      <p className="logger-subtitle">Build a reusable workout template</p>

      {/* Routine name */}
      <div className="form-card">
        <label className="form-label">Routine Name *</label>
        <input
          value={cName}
          onChange={e => { setCName(e.target.value); setCError(''); }}
          placeholder="e.g. Push Day, Full Body, Upper/Lower…"
          className="logger-input full-width"
        />
      </div>

      {/* Exercise search */}
      <div className="search-card">
        <div ref={cSearchRef} className="search-wrapper">
          <input
            value={cSearch}
            onChange={e => { setCSearch(e.target.value); setCDropdownOpen(true); setCError(''); }}
            onKeyDown={cHandleSearchKey}
            onFocus={() => setCDropdownOpen(true)}
            placeholder="Search exercises or type a custom name…"
            className="logger-input full-width search-padded"
          />
          <span className="search-icon">🔍</span>
          {cDropdownOpen && cSearch.trim() && (
            <div className="search-dropdown">
              {cSearchResults.length > 0 ? (
                cSearchResults.map(ex => (
                  <button key={ex} onMouseDown={e => { e.preventDefault(); cAddExercise(ex); }}
                    className="dropdown-item"
                  >{ex}</button>
                ))
              ) : (
                <button onMouseDown={e => { e.preventDefault(); cAddExercise(cSearch); }}
                  className="dropdown-add"
                >+ Add &ldquo;{cSearch}&rdquo; as custom exercise</button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Exercise cards */}
      {cExs.length > 0 && (
        <div className="exercise-list">
          {cExs.map((ex, exIdx) => (
            <ExerciseCard
              key={exIdx}
              ex={ex}
              showDone={false}
              onUpdateSet={(si, field, val) => cUpdateSet(exIdx, si, field, val)}
              onRemoveSet={si => cRemoveSet(exIdx, si)}
              onAddSet={() => cAddSet(exIdx)}
              onUpdateUnit={val => cUpdateUnit(exIdx, val)}
              onRemove={() => cRemoveEx(exIdx)}
            />
          ))}
        </div>
      )}

      {cError && <p className="logger-error">{cError}</p>}

      <button onClick={cSave} className="btn-save-routine">
        Save Routine
      </button>
    </div>
  );

  // ═══════════════════════════════════════════════
  // SESSION VIEW
  // ═══════════════════════════════════════════════
  return (
    <div className="exercise-logger">
      {/* Header */}
      <div className="session-header">
        <div className="session-title-group">
          <h2>{sessionName}</h2>
          {sessionSource === 'routine' && (
            <span className="routine-badge">ROUTINE</span>
          )}
        </div>
        {!ending && (
          <button onClick={() => setEnding(true)} className="btn-end-session">
            End Session
          </button>
        )}
      </div>
      <p className="logger-subtitle">{today}</p>

      {/* End session panel */}
      {ending && (
        <div className="end-session-panel">
          <div className="end-panel-header">
            <div>
              <h3>Finish Workout</h3>
              <p className="end-panel-stats">
                {uniqueEx} exercise{uniqueEx !== 1 ? 's' : ''} · {totalSets} set{totalSets !== 1 ? 's' : ''} completed{totalVol > 0 ? ` · ${totalVol.toLocaleString()} vol` : ''}
              </p>
            </div>
            <button onClick={() => setEnding(false)} className="btn-close-panel">✕</button>
          </div>
          <div className="save-as-routine-row">
            <input
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              placeholder="Routine name to save as…"
              className="logger-input flex-save"
            />
            <button
              onClick={doSaveAsRoutine}
              disabled={!saveName.trim()}
              className={`btn-save-as-routine ${saveName.trim() ? 'enabled' : 'disabled'}`}
            >Save as Routine</button>
          </div>
          <button onClick={finishSession} className="btn-finish-without-saving">
            Finish Without Saving
          </button>
        </div>
      )}

      {/* Summary cards */}
      <div className="summary-grid">
        {[
          { label: 'Exercises',  value: uniqueEx,                                        sub: 'with completed sets', color: '#ff8c42' },
          { label: 'Sets Done',  value: totalSets,                                       sub: 'sets completed',      color: '#4f8ef7' },
          { label: 'Volume',     value: totalVol > 0 ? totalVol.toLocaleString() : '—', sub: 'weighted only',       color: '#5cb85c' },
        ].map(card => (
          <div key={card.label} className="summary-card" style={{ borderTop: `4px solid ${card.color}` }}>
            <div className="summary-value" style={{ color: card.color }}>{card.value}</div>
            <div className="summary-sub">{card.sub}</div>
            <div className="summary-label">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Add exercise search */}
      <div className="search-card">
        <div ref={sSearchRef} className="search-wrapper">
          <input
            value={sSearch}
            onChange={e => { setSSearch(e.target.value); setSDropdownOpen(true); }}
            onKeyDown={sHandleSearchKey}
            onFocus={() => setSDropdownOpen(true)}
            placeholder="Search exercises or type a custom name…"
            className="logger-input full-width search-padded"
          />
          <span className="search-icon">🔍</span>
          {sDropdownOpen && sSearch.trim() && (
            <div className="search-dropdown">
              {sSearchResults.length > 0 ? (
                sSearchResults.map(ex => (
                  <button key={ex} onMouseDown={e => { e.preventDefault(); sAddExercise(ex); }}
                    className="dropdown-item"
                  >{ex}</button>
                ))
              ) : (
                <button onMouseDown={e => { e.preventDefault(); sAddExercise(sSearch); }}
                  className="dropdown-add"
                >+ Add &ldquo;{sSearch}&rdquo; as custom exercise</button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Exercise cards */}
      {sessionExs.length === 0 ? (
        <div className="no-exercises">
          Search for an exercise above to get started.
        </div>
      ) : (
        sessionExs.map((ex, exIdx) => (
          <ExerciseCard
            key={exIdx}
            ex={ex}
            showDone={true}
            onUpdateSet={(si, field, val) => sUpdateSet(exIdx, si, field, val)}
            onRemoveSet={si => sRemoveSet(exIdx, si)}
            onAddSet={() => sAddSet(exIdx)}
            onUpdateUnit={val => sUpdateUnit(exIdx, val)}
            onRemove={() => sRemoveEx(exIdx)}
            onToggleDone={si => sToggleDone(exIdx, si)}
          />
        ))
      )}
    </div>
  );
}

// ── Shared exercise card component
function ExerciseCard({ ex, showDone, onUpdateSet, onRemoveSet, onAddSet, onUpdateUnit, onRemove, onToggleDone }) {
  const colClass = showDone ? 'with-done' : 'no-done';

  return (
    <div className="exercise-card">
      {/* Exercise header */}
      <div className="exercise-card-header">
        <span className="exercise-name">{ex.name}</span>
        <div className="exercise-card-controls">
          <select
            value={ex.unit}
            onChange={e => onUpdateUnit(e.target.value)}
            className="logger-select"
          >
            <option value="lbs">lbs</option>
            <option value="kg">kg</option>
          </select>
          <button onClick={onRemove} className="btn-remove-exercise" title="Remove exercise">✕</button>
        </div>
      </div>

      {/* Column labels */}
      <div className={`col-labels ${colClass}`}>
        {showDone && <span />}
        <span />
        <span className="col-label">REPS</span>
        <span className="col-label">WEIGHT</span>
        <span className="col-label">RIR</span>
        <span />
      </div>

      {/* Set rows */}
      {ex.sets.map((s, si) => {
        const done = showDone && s.done;
        return (
          <div key={si} className={`set-row ${colClass}${done ? ' completed' : ''}`}>
            {showDone && (
              <button
                onClick={() => onToggleDone(si)}
                title={done ? 'Mark incomplete' : 'Mark complete'}
                className={`toggle-done-btn ${done ? 'done' : 'undone'}`}
              >{done ? '✓' : ''}</button>
            )}
            <span className="set-number">{si + 1}</span>
            <input
              type="number" min="1" placeholder="—" value={s.reps}
              onChange={e => onUpdateSet(si, 'reps', e.target.value)}
              className={`logger-input center-text set-input${done ? ' faded' : ''}`}
            />
            <input
              type="number" min="0" step="0.5" placeholder="—" value={s.weight}
              onChange={e => onUpdateSet(si, 'weight', e.target.value)}
              className={`logger-input center-text set-input${done ? ' faded' : ''}`}
            />
            <input
              type="number" min="0" max="10" placeholder="—" value={s.rir}
              onChange={e => onUpdateSet(si, 'rir', e.target.value)}
              className={`logger-input center-text set-input${done ? ' faded' : ''}`}
            />
            <button
              onClick={() => onRemoveSet(si)}
              disabled={ex.sets.length === 1}
              className="btn-remove-set"
              title="Remove set"
            >✕</button>
          </div>
        );
      })}

      {/* Add set */}
      <button onClick={onAddSet} className="btn-add-set">+ Add Set</button>
    </div>
  );
}
