import { useState } from 'react';

const ROUTINES_KEY = 'exercise_routines';
const LOG_KEY      = 'exercise_log';
const DATE_KEY     = 'exercise_date';

const EMPTY = { name: '', sets: '', reps: '', weight: '', unit: 'lbs', rir: '' };

function todayStr() { return new Date().toISOString().slice(0, 10); }
function vol(e) {
  const w = Number(e.weight);
  return w > 0 ? Number(e.sets) * Number(e.reps) * w : 0;
}
function makeEntry(f) {
  return {
    id:     Date.now(),
    time:   new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
    name:   String(f.name).trim(),
    sets:   Number(f.sets)  || 1,
    reps:   Number(f.reps)  || 1,
    weight: (f.weight !== '' && f.weight != null) ? Number(f.weight) : null,
    unit:   f.unit || 'lbs',
    rir:    (f.rir !== '' && f.rir != null) ? Number(f.rir) : null,
  };
}

export default function ExerciseLogger() {
  // ── view
  const [view, setView] = useState('select'); // 'select' | 'create' | 'session'

  // ── routines (persisted)
  const [routines, setRoutines] = useState(() => {
    try { return JSON.parse(localStorage.getItem(ROUTINES_KEY) || '[]'); } catch { return []; }
  });

  // ── create-routine state
  const [cName,  setCName]  = useState('');
  const [cExs,   setCExs]   = useState([]);
  const [cForm,  setCForm]  = useState(EMPTY);
  const [cError, setCError] = useState('');

  // ── session state
  const [sessionName,    setSessionName]    = useState('');
  const [sessionSource,  setSessionSource]  = useState('free');
  const [sessionRoutine, setSessionRoutine] = useState(null);
  const [entries,        setEntries]        = useState([]);
  const [sForm,          setSForm]          = useState(EMPTY);
  const [sError,         setSError]         = useState('');
  const [planOpen,       setPlanOpen]       = useState(true);
  const [ending,         setEnding]         = useState(false);
  const [saveName,       setSaveName]       = useState('');

  const totalSets = entries.reduce((s, e) => s + e.sets, 0);
  const totalVol  = entries.reduce((s, e) => s + vol(e), 0);
  const uniqueEx  = new Set(entries.map(e => e.name)).size;
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // ── helpers
  function persistRoutines(next) {
    setRoutines(next);
    localStorage.setItem(ROUTINES_KEY, JSON.stringify(next));
  }
  function persistEntries(next) {
    setEntries(next);
    localStorage.setItem(DATE_KEY, todayStr());
    localStorage.setItem(LOG_KEY, JSON.stringify(next));
  }

  // ── select actions
  function goCreate() {
    setCName(''); setCExs([]); setCForm(EMPTY); setCError('');
    setView('create');
  }
  function goFreeSession() {
    setSessionName('New Workout'); setSessionSource('free');
    setSessionRoutine(null); setEntries([]); setSForm(EMPTY); setSError('');
    setEnding(false); setSaveName('');
    setView('session');
  }
  function goRoutineSession(r) {
    setSessionName(r.name); setSessionSource('routine');
    setSessionRoutine(r); setEntries([]); setSForm(EMPTY); setSError('');
    setPlanOpen(true); setEnding(false); setSaveName(r.name);
    setView('session');
  }
  function deleteRoutine(id) {
    if (window.confirm('Delete this routine?')) persistRoutines(routines.filter(r => r.id !== id));
  }

  // ── create-routine actions
  function cAddEx(e) {
    e.preventDefault();
    if (!cForm.name.trim()) { setCError('Exercise name is required.'); return; }
    setCExs(prev => [...prev, {
      name:   cForm.name.trim(),
      sets:   Number(cForm.sets)  || 3,
      reps:   Number(cForm.reps)  || 10,
      weight: cForm.weight !== '' ? Number(cForm.weight) : null,
      unit:   cForm.unit,
      rir:    cForm.rir !== ''    ? Number(cForm.rir) : null,
    }]);
    setCForm(EMPTY); setCError('');
  }
  function cSave() {
    if (!cName.trim())     { setCError('Routine name is required.'); return; }
    if (cExs.length === 0) { setCError('Add at least one exercise.'); return; }
    persistRoutines([...routines, { id: String(Date.now()), name: cName.trim(), exercises: cExs }]);
    setView('select');
  }

  // ── session actions
  function sAdd(e) {
    e.preventDefault();
    if (!sForm.name.trim())                    { setSError('Exercise name is required.'); return; }
    if (!sForm.sets || Number(sForm.sets) < 1) { setSError('Enter a valid number of sets.'); return; }
    if (!sForm.reps || Number(sForm.reps) < 1) { setSError('Enter a valid number of reps.'); return; }
    if (sForm.rir !== '' && (isNaN(Number(sForm.rir)) || Number(sForm.rir) < 0 || Number(sForm.rir) > 10)) {
      setSError('RIR must be 0–10.'); return;
    }
    persistEntries([...entries, makeEntry(sForm)]);
    setSForm(EMPTY); setSError('');
  }
  function logFromPlan(ex) { persistEntries([...entries, makeEntry(ex)]); }
  function prefillFromPlan(ex) {
    setSForm({
      name:   ex.name,
      sets:   String(ex.sets),
      reps:   String(ex.reps),
      weight: ex.weight != null ? String(ex.weight) : '',
      unit:   ex.unit || 'lbs',
      rir:    ex.rir  != null ? String(ex.rir) : '',
    });
    setSError('');
  }
  function deleteEntry(id) { persistEntries(entries.filter(e => e.id !== id)); }
  function doSaveAsRoutine() {
    if (!saveName.trim()) return;
    const seen = new Set();
    const exercises = entries
      .filter(e => { if (seen.has(e.name)) return false; seen.add(e.name); return true; })
      .map(({ id: _id, time: _t, ...ex }) => ex);
    persistRoutines([...routines, { id: String(Date.now()), name: saveName.trim(), exercises }]);
    finishSession();
  }
  function finishSession() { setView('select'); setEnding(false); setEntries([]); }

  // ═══════════════════════════════════════════════
  // SELECT VIEW
  // ═══════════════════════════════════════════════
  if (view === 'select') return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 8px' }}>
      <h2 style={{ marginBottom: 4 }}>Exercise Logger</h2>
      <p style={{ color: '#888', marginBottom: 24, fontSize: 14 }}>{today}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 32 }}>
        {/* Create routine card */}
        <button
          onClick={goCreate}
          style={{ background: '#fff', border: '2px dashed #e0e0e0', borderRadius: 12, padding: '28px 24px', cursor: 'pointer', textAlign: 'left', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#ff8c42'}
          onMouseLeave={e => e.currentTarget.style.borderColor = '#e0e0e0'}
        >
          <div style={{ fontSize: 26, marginBottom: 10 }}>📋</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#333' }}>Create Routine</div>
          <div style={{ fontSize: 13, color: '#aaa', marginTop: 6, lineHeight: 1.4 }}>Build a named template with exercises to reuse later</div>
        </button>
        {/* New workout card */}
        <button
          onClick={goFreeSession}
          style={{ background: '#ff8c42', border: 'none', borderRadius: 12, padding: '28px 24px', cursor: 'pointer', textAlign: 'left', boxShadow: '0 4px 16px rgba(255,140,66,0.35)' }}
        >
          <div style={{ fontSize: 26, marginBottom: 10 }}>⚡</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>New Workout</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 6, lineHeight: 1.4 }}>Log exercises as you go — option to save as a routine when done</div>
        </button>
      </div>

      {/* Saved routines */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>My Routines</span>
        <span style={{ fontSize: 12, color: '#ccc' }}>({routines.length})</span>
      </div>

      {routines.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 10, padding: '36px 0', textAlign: 'center', color: '#bbb', fontSize: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          No routines yet — create your first one above.
        </div>
      ) : (
        routines.map(r => (
          <div key={r.id} style={{
            background: '#fff', borderRadius: 10, padding: '16px 20px', marginBottom: 10,
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{r.name}</div>
              <div style={{ fontSize: 12, color: '#aaa', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {r.exercises.length} exercise{r.exercises.length !== 1 ? 's' : ''}: {r.exercises.map(e => e.name).join(', ')}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button onClick={() => goRoutineSession(r)} style={{
                background: '#ff8c42', color: '#fff', border: 'none',
                borderRadius: 7, padding: '7px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 13,
              }}>▶ Start</button>
              <button onClick={() => deleteRoutine(r.id)} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: 16, padding: '4px 6px',
              }} title="Delete routine">✕</button>
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
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 4 }}>
        <button onClick={() => setView('select')} style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 7, padding: '6px 14px', cursor: 'pointer', fontSize: 13, color: '#555' }}>← Back</button>
        <h2 style={{ margin: 0 }}>Create Routine</h2>
      </div>
      <p style={{ color: '#888', marginBottom: 24, fontSize: 14 }}>Build a reusable workout template</p>

      {/* Routine name */}
      <div style={{ background: '#fff', borderRadius: 10, padding: '20px 24px', boxShadow: '0 4px 14px rgba(0,0,0,0.07)', marginBottom: 20 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: '#555', display: 'block', marginBottom: 8 }}>Routine Name *</label>
        <input
          value={cName}
          onChange={e => { setCName(e.target.value); setCError(''); }}
          placeholder="e.g. Push Day, Full Body, Upper/Lower…"
          style={inputStyle({ width: '100%', boxSizing: 'border-box' })}
        />
      </div>

      {/* Add exercise */}
      <div style={{ background: '#fff', borderRadius: 10, padding: '20px 24px', boxShadow: '0 4px 14px rgba(0,0,0,0.07)', marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Add Exercise</h3>
        <form onSubmit={cAddEx}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
            <input name="name" placeholder="Exercise name *" value={cForm.name}
              onChange={e => setCForm(f => ({ ...f, name: e.target.value }))}
              style={inputStyle({ flex: '3 1 200px' })} />
            <input name="sets" type="number" min="1" placeholder="Sets" value={cForm.sets}
              onChange={e => setCForm(f => ({ ...f, sets: e.target.value }))}
              style={inputStyle({ flex: '1 1 70px' })} />
            <input name="reps" type="number" min="1" placeholder="Reps" value={cForm.reps}
              onChange={e => setCForm(f => ({ ...f, reps: e.target.value }))}
              style={inputStyle({ flex: '1 1 70px' })} />
            <div style={{ display: 'flex', gap: 6, flex: '2 1 150px' }}>
              <input name="weight" type="number" min="0" step="0.5" placeholder="Weight" value={cForm.weight}
                onChange={e => setCForm(f => ({ ...f, weight: e.target.value }))}
                style={inputStyle({ flex: 1, minWidth: 0 })} />
              <select name="unit" value={cForm.unit} onChange={e => setCForm(f => ({ ...f, unit: e.target.value }))}
                style={{ ...inputStyle(), padding: '9px 8px', cursor: 'pointer', width: 58, flexShrink: 0 }}>
                <option value="lbs">lbs</option>
                <option value="kg">kg</option>
              </select>
            </div>
            <input name="rir" type="number" min="0" max="10" placeholder="RIR (optional)" value={cForm.rir}
              onChange={e => setCForm(f => ({ ...f, rir: e.target.value }))}
              style={inputStyle({ flex: '1 1 120px' })} />
          </div>
          {cError && <p style={{ color: '#e05c5c', margin: '0 0 10px', fontSize: 13 }}>{cError}</p>}
          <button type="submit" style={{ background: '#4f8ef7', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 22px', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
            + Add Exercise
          </button>
        </form>
      </div>

      {/* Exercise list preview */}
      {cExs.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 10, padding: '20px 24px', boxShadow: '0 4px 14px rgba(0,0,0,0.07)', marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 16 }}>Exercises ({cExs.length})</h3>
          {cExs.map((ex, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '9px 12px', borderRadius: 8, marginBottom: 6,
              background: '#fafafa', border: '1px solid #f0f0f0',
            }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{ex.name}</span>
                <span style={{ fontSize: 12, color: '#aaa', marginLeft: 10 }}>
                  {ex.sets}×{ex.reps}
                  {ex.weight != null && ` @ ${ex.weight} ${ex.unit}`}
                  {ex.rir  != null && ` · RIR ${ex.rir}`}
                </span>
              </div>
              <button onClick={() => setCExs(prev => prev.filter((_, idx) => idx !== i))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: 16, padding: '2px 6px' }}>✕</button>
            </div>
          ))}
        </div>
      )}

      <button onClick={cSave} style={{ background: '#ff8c42', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 32px', fontWeight: 700, cursor: 'pointer', fontSize: 15 }}>
        Save Routine
      </button>
    </div>
  );

  // ═══════════════════════════════════════════════
  // SESSION VIEW
  // ═══════════════════════════════════════════════
  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 8px' }}>
      {/* Session header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <h2 style={{ margin: 0 }}>{sessionName}</h2>
          {sessionSource === 'routine' && (
            <span style={{ fontSize: 11, fontWeight: 600, background: '#f0f4ff', color: '#4f8ef7', borderRadius: 5, padding: '3px 8px' }}>ROUTINE</span>
          )}
        </div>
        {!ending && (
          <button onClick={() => setEnding(true)} style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 8, padding: '7px 16px', cursor: 'pointer', fontSize: 13, color: '#555', fontWeight: 600, flexShrink: 0 }}>
            End Session
          </button>
        )}
      </div>
      <p style={{ color: '#888', marginBottom: 20, fontSize: 14 }}>{today}</p>

      {/* End session panel */}
      {ending && (
        <div style={{ background: '#fff', borderRadius: 10, padding: '20px 24px', boxShadow: '0 4px 14px rgba(0,0,0,0.07)', marginBottom: 24, border: '2px solid #ff8c42' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>Finish Workout</h3>
              <p style={{ margin: 0, fontSize: 13, color: '#888' }}>
                {uniqueEx} exercise{uniqueEx !== 1 ? 's' : ''} · {totalSets} sets{totalVol > 0 ? ` · ${totalVol.toLocaleString()} vol` : ''}
              </p>
            </div>
            <button onClick={() => setEnding(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', fontSize: 20, lineHeight: 1, padding: 4 }} title="Keep logging">✕</button>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <input
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              placeholder="Routine name to save as…"
              style={inputStyle({ flex: '1 1 200px' })}
            />
            <button
              onClick={doSaveAsRoutine}
              disabled={!saveName.trim()}
              style={{ background: saveName.trim() ? '#ff8c42' : '#f0f0f0', color: saveName.trim() ? '#fff' : '#aaa', border: 'none', borderRadius: 8, padding: '9px 20px', fontWeight: 600, cursor: saveName.trim() ? 'pointer' : 'default', fontSize: 14 }}
            >Save as Routine</button>
          </div>
          <button onClick={finishSession} style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontSize: 13, color: '#666' }}>
            Finish Without Saving
          </button>
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Exercises', value: uniqueEx,                                              sub: 'unique',         color: '#ff8c42' },
          { label: 'Total Sets', value: totalSets,                                             sub: 'sets this session', color: '#4f8ef7' },
          { label: 'Volume',     value: totalVol > 0 ? totalVol.toLocaleString() : '—',       sub: 'weighted only',  color: '#5cb85c' },
        ].map(card => (
          <div key={card.label} style={{ background: '#fff', borderRadius: 10, padding: '16px 20px', boxShadow: '0 4px 14px rgba(0,0,0,0.07)', borderTop: `4px solid ${card.color}`, textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: card.color }}>{card.value}</div>
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{card.sub}</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* Workout plan (routine sessions) */}
      {sessionSource === 'routine' && sessionRoutine && (
        <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 4px 14px rgba(0,0,0,0.07)', marginBottom: 24, overflow: 'hidden' }}>
          <button onClick={() => setPlanOpen(o => !o)} style={{
            width: '100%', background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 20px', fontSize: 15, fontWeight: 600, color: '#333',
          }}>
            <span>Workout Plan <span style={{ fontSize: 12, fontWeight: 400, color: '#aaa', marginLeft: 6 }}>{sessionRoutine.exercises.length} exercises</span></span>
            <span style={{ fontSize: 12, color: '#aaa' }}>{planOpen ? '▲' : '▼'}</span>
          </button>
          {planOpen && (
            <div style={{ padding: '0 16px 16px' }}>
              {sessionRoutine.exercises.map((ex, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '9px 12px', borderRadius: 8, marginBottom: 6,
                  background: '#fafafa', border: '1px solid #f0f0f0',
                }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{ex.name}</span>
                    <span style={{ fontSize: 12, color: '#aaa', marginLeft: 10 }}>
                      {ex.sets}×{ex.reps}
                      {ex.weight != null && ` @ ${ex.weight} ${ex.unit}`}
                      {ex.rir  != null && ` · RIR ${ex.rir}`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => prefillFromPlan(ex)} style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 12, color: '#555' }} title="Pre-fill form to adjust before logging">Edit & Log</button>
                    <button onClick={() => logFromPlan(ex)} style={{ background: '#ff8c42', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>+ Log</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Log form */}
      <div style={{ background: '#fff', borderRadius: 10, padding: '20px 24px', boxShadow: '0 4px 14px rgba(0,0,0,0.07)', marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Log Exercise</h3>
        <form onSubmit={sAdd}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
            <input name="name" placeholder="Exercise name *" value={sForm.name}
              onChange={e => { setSForm(f => ({ ...f, name: e.target.value })); setSError(''); }}
              style={inputStyle({ flex: '3 1 200px' })} />
            <input name="sets" type="number" min="1" placeholder="Sets *" value={sForm.sets}
              onChange={e => { setSForm(f => ({ ...f, sets: e.target.value })); setSError(''); }}
              style={inputStyle({ flex: '1 1 70px' })} />
            <input name="reps" type="number" min="1" placeholder="Reps *" value={sForm.reps}
              onChange={e => { setSForm(f => ({ ...f, reps: e.target.value })); setSError(''); }}
              style={inputStyle({ flex: '1 1 70px' })} />
            <div style={{ display: 'flex', gap: 6, flex: '2 1 150px' }}>
              <input name="weight" type="number" min="0" step="0.5" placeholder="Weight" value={sForm.weight}
                onChange={e => { setSForm(f => ({ ...f, weight: e.target.value })); setSError(''); }}
                style={inputStyle({ flex: 1, minWidth: 0 })} />
              <select name="unit" value={sForm.unit} onChange={e => setSForm(f => ({ ...f, unit: e.target.value }))}
                style={{ ...inputStyle(), padding: '9px 8px', cursor: 'pointer', width: 58, flexShrink: 0 }}>
                <option value="lbs">lbs</option>
                <option value="kg">kg</option>
              </select>
            </div>
            <input name="rir" type="number" min="0" max="10" placeholder="RIR (optional)" value={sForm.rir}
              onChange={e => { setSForm(f => ({ ...f, rir: e.target.value })); setSError(''); }}
              style={inputStyle({ flex: '1 1 120px' })} />
          </div>
          {sError && <p style={{ color: '#e05c5c', margin: '0 0 10px', fontSize: 13 }}>{sError}</p>}
          <button type="submit" style={{ background: '#ff8c42', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 22px', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
            + Log Set
          </button>
        </form>
      </div>

      {/* Log table */}
      <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 4px 14px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #f0f0f0' }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Session Log ({entries.length} {entries.length === 1 ? 'entry' : 'entries'})</h3>
          {entries.length > 0 && (
            <button onClick={() => { if (window.confirm('Clear all entries?')) persistEntries([]); }} style={{ background: 'none', border: '1px solid #ddd', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12, color: '#888' }}>
              Clear All
            </button>
          )}
        </div>
        {entries.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#bbb', padding: '32px 0', margin: 0 }}>
            No exercises logged yet — add your first set above.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  {['Exercise', 'Sets', 'Reps', 'Weight', 'Volume', 'RIR', 'Time', ''].map(h => (
                    <th key={h} style={thStyle(h === 'Exercise' ? { textAlign: 'left' } : {})}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, i) => {
                  const v = vol(entry);
                  return (
                    <tr key={entry.id} style={{ borderTop: '1px solid #f0f0f0', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '10px 16px', fontWeight: 600 }}>{entry.name}</td>
                      <td style={tdStyle()}>{entry.sets}</td>
                      <td style={tdStyle()}>{entry.reps}</td>
                      <td style={tdStyle()}>
                        {entry.weight != null
                          ? <>{entry.weight} <span style={{ color: '#aaa', fontSize: 11 }}>{entry.unit}</span></>
                          : <span style={{ color: '#ddd' }}>—</span>}
                      </td>
                      <td style={tdStyle()}>
                        {v > 0 ? <span style={{ color: '#5cb85c', fontWeight: 600 }}>{v.toLocaleString()}</span> : <span style={{ color: '#ddd' }}>—</span>}
                      </td>
                      <td style={tdStyle()}>
                        {entry.rir != null
                          ? <span style={{ background: '#f0f4ff', color: '#4f8ef7', borderRadius: 4, padding: '2px 7px', fontSize: 12, fontWeight: 600 }}>{entry.rir}</span>
                          : <span style={{ color: '#ddd' }}>—</span>}
                      </td>
                      <td style={{ ...tdStyle(), color: '#aaa', fontSize: 12, whiteSpace: 'nowrap' }}>{entry.time}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <button onClick={() => deleteEntry(entry.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: 16, lineHeight: 1, padding: 4 }} title="Remove">✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid #eee', background: '#f7f7fb' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 700, color: '#555' }}>Total</td>
                  <td style={tdStyle({ fontWeight: 700, color: '#4f8ef7' })}>{totalSets}</td>
                  <td style={tdStyle()}>—</td>
                  <td style={tdStyle()}>—</td>
                  <td style={tdStyle({ fontWeight: 700, color: '#5cb85c' })}>{totalVol > 0 ? totalVol.toLocaleString() : '—'}</td>
                  <td style={tdStyle()}>—</td>
                  <td /><td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function inputStyle(extra = {}) {
  return { padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 14, outline: 'none', background: '#fafafa', minWidth: 0, ...extra };
}
function thStyle(extra = {}) {
  return { padding: '10px 16px', fontWeight: 600, fontSize: 13, color: '#555', textAlign: 'center', whiteSpace: 'nowrap', ...extra };
}
function tdStyle(extra = {}) {
  return { padding: '10px 16px', textAlign: 'center', ...extra };
}
