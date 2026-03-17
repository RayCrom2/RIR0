import { useState, useEffect, useRef } from 'react';
import { LuCalendar } from 'react-icons/lu'

const monthAbbr = new Date().toLocaleString('default', { month: 'short' }).toUpperCase()

const STORAGE_KEY = 'nutrition_log';
const DATE_KEY = 'nutrition_date';
const CARD_ORDER_KEY = 'nutrition_card_order';
const VISIBLE_KEY = 'nutrition_visible_macros';
const MY_FOODS_KEY = 'nutrition_my_foods';

const EMPTY_FORM = { name: '', calories: '', protein: '', fat: '', carbs: '', fiber: '', sugar: '' };

const MACROS = [
  { key: 'calories', label: 'Calories', unit: 'kcal', color: '#ff8c42' },
  { key: 'protein', label: 'Protein', unit: 'g', color: '#4f8ef7' },
  { key: 'carbs', label: 'Carbs', unit: 'g', color: '#f7c948' },
  { key: 'fat', label: 'Fat', unit: 'g', color: '#e05c5c' },
  { key: 'fiber', label: 'Fiber', unit: 'g', color: '#5cb85c' },
  { key: 'sugar', label: 'Sugar', unit: 'g', color: '#c87dd4' },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function Nutrition() {
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saveToMyFoods, setSaveToMyFoods] = useState(false);
  const [savedFoods, setSavedFoods] = useState(() => {
    try { return JSON.parse(localStorage.getItem(MY_FOODS_KEY) || '[]'); } catch { return []; }
  });
  const [myFoodsOpen, setMyFoodsOpen] = useState(false);
  const [error, setError] = useState('');
  const [cardOrder, setCardOrder] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CARD_ORDER_KEY));
      if (Array.isArray(saved) && saved.length === MACROS.length) return saved;
    } catch { }
    return MACROS.map(m => m.key);
  });
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [visibleMacros, setVisibleMacros] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(VISIBLE_KEY));
      if (Array.isArray(saved)) return new Set(saved);
    } catch { }
    return new Set(MACROS.map(m => m.key));
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const orderedMacros = cardOrder.map(key => MACROS.find(m => m.key === key));
  const visibleOrderedMacros = orderedMacros.filter(m => visibleMacros.has(m.key));
  const visibleMacroList = MACROS.filter(m => visibleMacros.has(m.key));

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function toggleMacro(key) {
    setVisibleMacros(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size === 1) return prev; // always keep at least one visible
        next.delete(key);
      } else {
        next.add(key);
      }
      localStorage.setItem(VISIBLE_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  function handleDragStart(i) {
    setDragIndex(i);
  }

  function handleDragOver(e, i) {
    e.preventDefault();
    if (i !== dragOverIndex) setDragOverIndex(i);
  }

  function handleDrop(i) {
    if (dragIndex === null || dragIndex === i) return;
    const next = [...cardOrder];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(i, 0, moved);
    setCardOrder(next);
    localStorage.setItem(CARD_ORDER_KEY, JSON.stringify(next));
    setDragIndex(null);
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    setDragIndex(null);
    setDragOverIndex(null);
  }

  // Load entries, reset if it's a new day
  useEffect(() => {
    const savedDate = localStorage.getItem(DATE_KEY);
    const today = todayStr();
    if (savedDate !== today) {
      localStorage.setItem(DATE_KEY, today);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      setEntries([]);
    } else {
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        setEntries(saved);
      } catch {
        setEntries([]);
      }
    }
  }, []);

  function persist(next) {
    setEntries(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  }

  function handleAdd(e) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Food name is required.'); return; }
    if (!form.calories || isNaN(Number(form.calories)) || Number(form.calories) < 0) {
      setError('Enter a valid calorie amount.'); return;
    }
    const now = new Date();
    const entry = {
      id: Date.now(),
      time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
      name: form.name.trim(),
      calories: Number(form.calories) || 0,
      protein: Number(form.protein) || 0,
      fat: Number(form.fat) || 0,
      carbs: Number(form.carbs) || 0,
      fiber: Number(form.fiber) || 0,
      sugar: Number(form.sugar) || 0,
    };
    persist([...entries, entry]);
    if (saveToMyFoods) {
      const { id: _id, ...food } = entry;
      const already = savedFoods.some(f => f.name.toLowerCase() === food.name.toLowerCase());
      if (!already) {
        const next = [...savedFoods, food];
        setSavedFoods(next);
        localStorage.setItem(MY_FOODS_KEY, JSON.stringify(next));
      }
    }
    setSaveToMyFoods(false);
    setForm(EMPTY_FORM);
  }

  function handleDelete(id) {
    persist(entries.filter(e => e.id !== id));
  }

  function handleClearAll() {
    if (window.confirm('Clear all entries for today?')) persist([]);
  }

  function handleAddFromLibrary(food) {
    const now = new Date();
    const entry = {
      ...food,
      id: Date.now(),
      time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
    };
    persist([...entries, entry]);
  }

  function handleDeleteSaved(name) {
    const next = savedFoods.filter(f => f.name !== name);
    setSavedFoods(next);
    localStorage.setItem(MY_FOODS_KEY, JSON.stringify(next));
  }

  const totals = MACROS.reduce((acc, m) => {
    acc[m.key] = entries.reduce((sum, e) => sum + (e[m.key] || 0), 0);
    return acc;
  }, {});

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 8px' }}>
      <div style={{ display: 'flex' }}>
        <p className="font-bold text-[2rem] mb-1">Nutrition Tracker</p>
        <button className="relative inline-flex items-center justify-center ml-auto cursor-pointer">
          <LuCalendar size={45} />
          <span className="absolute bottom-[15px] text-[11px] font-bold leading-none">
            {monthAbbr}
          </span>
        </button>
      </div>
      <p style={{ color: '#888', marginBottom: 20, fontSize: 14 }}>{today} — entries reset each day</p>

      {/* Daily Summary Cards */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Daily Totals</span>
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#aaa', padding: '2px 6px', borderRadius: 6, lineHeight: 1 }}
              title="Show/hide macros"
            >⋯</button>
            {menuOpen && (
              <div style={{
                position: 'absolute', right: 0, top: '110%', zIndex: 100,
                background: '#fff', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                padding: '8px 0', minWidth: 160,
              }}>
                <p style={{ margin: '0 0 4px', padding: '4px 14px', fontSize: 11, color: '#aaa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Show macros</p>
                {MACROS.map(m => (
                  <label key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', cursor: 'pointer', fontSize: 14 }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f7f7fb'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <input
                      type="checkbox"
                      checked={visibleMacros.has(m.key)}
                      onChange={() => toggleMacro(m.key)}
                      style={{ accentColor: m.color, width: 15, height: 15, cursor: 'pointer' }}
                    />
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
                    {m.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${visibleOrderedMacros.length}, 1fr)`, gap: 12 }}>
          {visibleOrderedMacros.map((m, i) => (
            <div
              key={m.key}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={e => handleDragOver(e, i)}
              onDrop={() => handleDrop(i)}
              onDragEnd={handleDragEnd}
              style={{
                background: '#fff',
                borderRadius: 10,
                padding: '14px 18px',
                boxShadow: dragOverIndex === i && dragIndex !== i
                  ? `0 0 0 2px ${m.color}`
                  : '0 4px 14px rgba(0,0,0,0.07)',
                borderTop: `4px solid ${m.color}`,
                textAlign: 'center',
                cursor: 'grab',
                opacity: dragIndex === i ? 0.4 : 1,
                transition: 'opacity 0.15s, box-shadow 0.15s',
                userSelect: 'none',
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 700, color: m.color }}>
                {totals[m.key].toFixed(m.key === 'calories' ? 0 : 1)}
              </div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{m.unit}</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Entry Form */}
      <div style={{ background: '#fff', borderRadius: 10, padding: '20px 24px', boxShadow: '0 4px 14px rgba(0,0,0,0.07)', marginBottom: 24 }}>
        <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 16 }}>Add Food</h3>
        <form onSubmit={handleAdd}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
            <input
              name="name"
              placeholder="Food name *"
              value={form.name}
              onChange={handleChange}
              style={inputStyle({ flex: '2 1 180px' })}
            />
            <input
              name="calories"
              type="number"
              min="0"
              placeholder="Calories *"
              value={form.calories}
              onChange={handleChange}
              style={inputStyle({ flex: '1 1 100px' })}
            />
            <input
              name="protein"
              type="number"
              min="0"
              placeholder="Protein (g)"
              value={form.protein}
              onChange={handleChange}
              style={inputStyle({ flex: '1 1 100px' })}
            />
            <input
              name="carbs"
              type="number"
              min="0"
              placeholder="Carbs (g)"
              value={form.carbs}
              onChange={handleChange}
              style={inputStyle({ flex: '1 1 100px' })}
            />
            <input
              name="fat"
              type="number"
              min="0"
              placeholder="Fat (g)"
              value={form.fat}
              onChange={handleChange}
              style={inputStyle({ flex: '1 1 100px' })}
            />
            <input
              name="fiber"
              type="number"
              min="0"
              placeholder="Fiber (g)"
              value={form.fiber}
              onChange={handleChange}
              style={inputStyle({ flex: '1 1 90px' })}
            />
            <input
              name="sugar"
              type="number"
              min="0"
              placeholder="Sugar (g)"
              value={form.sugar}
              onChange={handleChange}
              style={inputStyle({ flex: '1 1 90px' })}
            />
          </div>
          {error && <p style={{ color: '#e05c5c', margin: '0 0 10px', fontSize: 13 }}>{error}</p>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <button type="submit" style={{
              background: '#ff8c42', color: '#fff', border: 'none',
              borderRadius: 8, padding: '9px 22px', fontWeight: 600,
              cursor: 'pointer', fontSize: 14,
            }}>
              + Add Entry
            </button>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#666', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={saveToMyFoods}
                onChange={e => setSaveToMyFoods(e.target.checked)}
                style={{ accentColor: '#ff8c42', width: 15, height: 15, cursor: 'pointer' }}
              />
              Save to My Foods
            </label>
          </div>
        </form>
      </div>

      {/* My Foods Library */}
      <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 4px 14px rgba(0,0,0,0.07)', marginBottom: 24, overflow: 'hidden' }}>
        <button
          onClick={() => setMyFoodsOpen(o => !o)}
          style={{
            width: '100%', background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 20px', fontSize: 15, fontWeight: 600, color: '#333',
          }}
        >
          <span>My Foods <span style={{ fontSize: 12, fontWeight: 400, color: '#aaa', marginLeft: 6 }}>{savedFoods.length} saved</span></span>
          <span style={{ fontSize: 12, color: '#aaa' }}>{myFoodsOpen ? '▲' : '▼'}</span>
        </button>
        {myFoodsOpen && (
          savedFoods.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#bbb', padding: '20px 0', margin: 0, fontSize: 14 }}>
              No saved foods yet — check "Save to My Foods" when adding an entry.
            </p>
          ) : (
            <div style={{ padding: '0 16px 16px' }}>
              {savedFoods.map(food => (
                <div key={food.name} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '9px 10px', borderRadius: 8, marginBottom: 6,
                  background: '#fafafa', border: '1px solid #f0f0f0',
                }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{food.name}</span>
                    <span style={{ fontSize: 12, color: '#aaa', marginLeft: 10 }}>
                      {food.calories} kcal
                      {food.protein > 0 && ` · ${food.protein}g protein`}
                      {food.carbs > 0 && ` · ${food.carbs}g carbs`}
                      {food.fat > 0 && ` · ${food.fat}g fat`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => handleAddFromLibrary(food)}
                      style={{
                        background: '#ff8c42', color: '#fff', border: 'none',
                        borderRadius: 6, padding: '5px 12px', cursor: 'pointer',
                        fontSize: 12, fontWeight: 600,
                      }}
                    >+ Add</button>
                    <button
                      onClick={() => handleDeleteSaved(food.name)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#ccc', fontSize: 16, lineHeight: 1, padding: '4px 6px',
                      }}
                      title="Remove from My Foods"
                    >✕</button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Log Table */}
      <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 4px 14px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #f0f0f0' }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Today's Log ({entries.length} {entries.length === 1 ? 'item' : 'items'})</h3>
          {entries.length > 0 && (
            <button onClick={handleClearAll} style={{
              background: 'none', border: '1px solid #ddd', borderRadius: 6,
              padding: '5px 12px', cursor: 'pointer', fontSize: 12, color: '#888',
            }}>
              Clear All
            </button>
          )}
        </div>

        {entries.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#bbb', padding: '32px 0', margin: 0 }}>
            No foods logged yet — add your first entry above.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  <th style={thStyle({ textAlign: 'left' })}>Food</th>
                  {visibleMacroList.map(m => (
                    <th key={m.key} style={thStyle()}>{m.label}<br /><span style={{ fontWeight: 400, color: '#aaa', fontSize: 11 }}>{m.unit}</span></th>
                  ))}
                  <th style={thStyle({ color: '#aaa' })}>Time</th>
                  <th style={thStyle()}></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, i) => (
                  <tr key={entry.id} style={{ borderTop: '1px solid #f0f0f0', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 500 }}>{entry.name}</td>
                    {visibleMacroList.map(m => (
                      <td key={m.key} style={{ padding: '10px 16px', textAlign: 'center', color: m.key === 'calories' ? '#ff8c42' : '#333', fontWeight: m.key === 'calories' ? 600 : 400 }}>
                        {entry[m.key] > 0 ? (m.key === 'calories' ? entry[m.key] : entry[m.key].toFixed(1)) : <span style={{ color: '#ddd' }}>—</span>}
                      </td>
                    ))}
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#aaa', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {entry.time || '—'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <button onClick={() => handleDelete(entry.id)} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#ccc', fontSize: 16, lineHeight: 1, padding: 4,
                      }} title="Remove">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid #eee', background: '#fff8f3' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 700, color: '#555' }}>Total</td>
                  {visibleMacroList.map(m => (
                    <td key={m.key} style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 700, color: m.color }}>
                      {m.key === 'calories' ? totals[m.key].toFixed(0) : totals[m.key].toFixed(1)}
                    </td>
                  ))}
                  <td />
                  <td />
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
  return {
    padding: '9px 12px',
    border: '1px solid #e0e0e0',
    borderRadius: 8,
    fontSize: 14,
    outline: 'none',
    background: '#fafafa',
    minWidth: 0,
    ...extra,
  };
}

function thStyle(extra = {}) {
  return {
    padding: '10px 16px',
    fontWeight: 600,
    fontSize: 13,
    color: '#555',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    ...extra,
  };
}
