import { useState, useEffect, useRef } from 'react';
import '../pages-css/Nutrition.css';

const STORAGE_KEY = 'nutrition_log';
const DATE_KEY = 'nutrition_date';
const CARD_ORDER_KEY = 'nutrition_card_order';
const VISIBLE_KEY = 'nutrition_visible_macros';
const MY_FOODS_KEY = 'nutrition_my_foods';

const EMPTY_FORM = { name: '', calories: '', protein: '', fat: '', carbs: '', fiber: '', sugar: '' };

const MACROS = [
  { key: 'calories', label: 'Calories',  unit: 'kcal', color: '#ff8c42' },
  { key: 'protein',  label: 'Protein',   unit: 'g',    color: '#4f8ef7' },
  { key: 'carbs',    label: 'Carbs',     unit: 'g',    color: '#f7c948' },
  { key: 'fat',      label: 'Fat',       unit: 'g',    color: '#e05c5c' },
  { key: 'fiber',    label: 'Fiber',     unit: 'g',    color: '#5cb85c' },
  { key: 'sugar',    label: 'Sugar',     unit: 'g',    color: '#c87dd4' },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function Nutrition() {
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [savedFoods, setSavedFoods] = useState(() => {
    try { return JSON.parse(localStorage.getItem(MY_FOODS_KEY) || '[]'); } catch { return []; }
  });
  const [myFoodsOpen, setMyFoodsOpen] = useState(false);
  const [myFoodsServings, setMyFoodsServings] = useState({});
  const [error, setError] = useState('');
  const [cardOrder, setCardOrder] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CARD_ORDER_KEY));
      if (Array.isArray(saved) && saved.length === MACROS.length) return saved;
    } catch {}
    return MACROS.map(m => m.key);
  });
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [visibleMacros, setVisibleMacros] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(VISIBLE_KEY));
      if (Array.isArray(saved)) return new Set(saved);
    } catch {}
    return new Set(MACROS.map(m => m.key));
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [servingSize, setServingSize] = useState('');
  const [servingUnit, setServingUnit] = useState('g');
  const [baseNutrients, setBaseNutrients] = useState(null);
  const searchTimeout = useRef(null);
  const searchRef = useRef(null);

  const orderedMacros = cardOrder.map(key => MACROS.find(m => m.key === key));
  const visibleOrderedMacros = orderedMacros.filter(m => visibleMacros.has(m.key));
  const visibleMacroList = MACROS.filter(m => visibleMacros.has(m.key));

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowDropdown(false);
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

  function searchFood(query) {
    clearTimeout(searchTimeout.current);
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const key = import.meta.env.VITE_USDA_API_KEY;
        const res = await fetch(
          `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=8&api_key=${key}`
        );
        const data = await res.json();
        const results = (data.foods || []).map(food => {
          const n = id => food.foodNutrients?.find(x => x.nutrientId === id)?.value ?? 0;
          return {
            fdcId: food.fdcId,
            name: food.description,
            brand: food.brandOwner || '',
            calories: Math.round(n(1008)),
            protein:  Math.round(n(1003) * 10) / 10,
            carbs:    Math.round(n(1005) * 10) / 10,
            fat:      Math.round(n(1004) * 10) / 10,
            fiber:    Math.round(n(1079) * 10) / 10,
            sugar:    Math.round(n(2000) * 10) / 10,
          };
        });
        setSearchResults(results);
        setShowDropdown(results.length > 0);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
  }

  function handleSelectFood(food) {
    const base = {
      calories: food.calories,
      protein:  food.protein,
      carbs:    food.carbs,
      fat:      food.fat,
      fiber:    food.fiber,
      sugar:    food.sugar,
    };
    setBaseNutrients(base);
    setServingSize('100');
    setForm({
      name:     food.name,
      calories: base.calories || '',
      protein:  base.protein  || '',
      carbs:    base.carbs    || '',
      fat:      base.fat      || '',
      fiber:    base.fiber    || '',
      sugar:    base.sugar    || '',
    });
    setShowDropdown(false);
    setSearchResults([]);
  }

  function applyServing(size, unit, base) {
    if (!base || !size || isNaN(size)) return;
    const grams = unit === 'oz' ? Number(size) * 28.3495 : Number(size);
    const ratio = grams / 100;
    const scale = (val) => Math.round(val * ratio * 10) / 10 || '';
    setForm(f => ({
      ...f,
      calories: Math.round(base.calories * ratio) || '',
      protein:  scale(base.protein),
      carbs:    scale(base.carbs),
      fat:      scale(base.fat),
      fiber:    scale(base.fiber),
      sugar:    scale(base.sugar),
    }));
  }

  function handleServingChange(e) {
    const size = e.target.value;
    setServingSize(size);
    applyServing(size, servingUnit, baseNutrients);
  }

  function handleUnitToggle() {
    const nextUnit = servingUnit === 'g' ? 'oz' : 'g';
    setServingUnit(nextUnit);
    applyServing(servingSize, nextUnit, baseNutrients);
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
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    setError('');
    if (name === 'name') {
      searchFood(value);
      setBaseNutrients(null);
    }
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
      servingSize: servingSize || '',
      servingUnit: servingUnit,
      calories: Number(form.calories) || 0,
      protein:  Number(form.protein)  || 0,
      fat:      Number(form.fat)      || 0,
      carbs:    Number(form.carbs)    || 0,
      fiber:    Number(form.fiber)    || 0,
      sugar:    Number(form.sugar)    || 0,
    };
    persist([...entries, entry]);
    setBaseNutrients(null);
    setServingSize('');
    setServingUnit('g');
    setForm(EMPTY_FORM);
  }

  function handleSaveToMyFoods() {
    if (!form.name.trim()) return;
    const already = savedFoods.some(f => f.name.toLowerCase() === form.name.trim().toLowerCase());
    if (already) return;
    const food = {
      name:     form.name.trim(),
      calories: Number(form.calories) || 0,
      protein:  Number(form.protein)  || 0,
      fat:      Number(form.fat)      || 0,
      carbs:    Number(form.carbs)    || 0,
      fiber:    Number(form.fiber)    || 0,
      sugar:    Number(form.sugar)    || 0,
      refServingSize: servingSize,
      refServingUnit: servingUnit,
    };
    const next = [...savedFoods, food];
    setSavedFoods(next);
    localStorage.setItem(MY_FOODS_KEY, JSON.stringify(next));
  }

  function handleDelete(id) {
    persist(entries.filter(e => e.id !== id));
  }

  function handleClearAll() {
    if (window.confirm('Clear all entries for today?')) persist([]);
  }

  function toGrams(size, unit) {
    return unit === 'oz' ? Number(size) * 28.3495 : Number(size);
  }

  function handleAddFromLibrary(food) {
    const serving = myFoodsServings[food.name];
    const currentSize = serving?.size;
    const currentUnit = serving?.unit ?? food.refServingUnit ?? 'g';
    const refSize = food.refServingSize;
    const refUnit = food.refServingUnit ?? 'g';

    let scaledFood = { ...food };
    if (currentSize && refSize && Number(currentSize) > 0 && Number(refSize) > 0) {
      const ratio = toGrams(currentSize, currentUnit) / toGrams(refSize, refUnit);
      const scale = (val) => Math.round((val || 0) * ratio * 10) / 10;
      scaledFood = {
        ...food,
        calories: Math.round((food.calories || 0) * ratio),
        protein:  scale(food.protein),
        carbs:    scale(food.carbs),
        fat:      scale(food.fat),
        fiber:    scale(food.fiber),
        sugar:    scale(food.sugar),
      };
    }

    const now = new Date();
    persist([...entries, {
      ...scaledFood,
      id: Date.now(),
      time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
    }]);
  }

  function handleSaveEntryToMyFoods(entry) {
    const already = savedFoods.some(f => f.name.toLowerCase() === entry.name.toLowerCase());
    if (already) return;
    const { id: _id, time: _time, servingSize: ss, servingUnit: su, ...macros } = entry;
    const next = [...savedFoods, { ...macros, refServingSize: ss || '', refServingUnit: su || 'g' }];
    setSavedFoods(next);
    localStorage.setItem(MY_FOODS_KEY, JSON.stringify(next));
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
    <div className="nutrition-page">
      <h2 style={{ marginBottom: 4 }}>Nutrition Tracker</h2>
      <p className="nutrition-subtitle">{today} — entries reset each day</p>

      {/* Daily Summary Cards */}
      <div className="summary-section">
        <div className="summary-top">
          <span className="summary-section-label">Daily Totals</span>
          <div ref={menuRef} className="macro-menu-wrapper">
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="macro-menu-btn"
              title="Show/hide macros"
            >⋯</button>
            {menuOpen && (
              <div className="macro-menu-dropdown">
                <p className="macro-menu-title">Show macros</p>
                {MACROS.map(m => (
                  <label key={m.key} className="macro-menu-item">
                    <input
                      type="checkbox"
                      checked={visibleMacros.has(m.key)}
                      onChange={() => toggleMacro(m.key)}
                      className="nutrition-input macro-checkbox"
                      style={{ accentColor: m.color }}
                    />
                    <span className="macro-color-dot" style={{ background: m.color }} />
                    {m.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        <div
          className="macro-cards-grid"
          style={{ gridTemplateColumns: `repeat(${visibleOrderedMacros.length}, 1fr)` }}
        >
          {visibleOrderedMacros.map((m, i) => (
            <div
              key={m.key}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={e => handleDragOver(e, i)}
              onDrop={() => handleDrop(i)}
              onDragEnd={handleDragEnd}
              className={`macro-card${dragIndex === i ? ' dragging' : ''}`}
              style={{
                borderTop: `4px solid ${m.color}`,
                boxShadow: dragOverIndex === i && dragIndex !== i
                  ? `0 0 0 2px ${m.color}`
                  : '0 4px 14px rgba(0,0,0,0.07)',
              }}
            >
              <div className="macro-card-value" style={{ color: m.color }}>
                {totals[m.key].toFixed(m.key === 'calories' ? 0 : 1)}
              </div>
              <div className="macro-card-unit">{m.unit}</div>
              <div className="macro-card-label">{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Entry Form */}
      <div className="entry-form-card">
        <h3>Add Food</h3>
        <form onSubmit={handleAdd}>
          <div className="form-inputs-row">
            <div ref={searchRef} className="food-search-wrapper">
              <input
                name="name"
                placeholder="Food name *"
                value={form.name}
                onChange={handleChange}
                onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                className="nutrition-input full-width"
                autoComplete="off"
              />
              {searchLoading && (
                <span className="search-loading-indicator">searching…</span>
              )}
              {showDropdown && (
                <div className="food-search-dropdown">
                  {searchResults.map(food => (
                    <button
                      key={food.fdcId}
                      type="button"
                      onClick={() => handleSelectFood(food)}
                      className="food-search-result"
                    >
                      <div className="food-result-name">{food.name}</div>
                      <div className="food-result-meta">
                        {food.calories} kcal · {food.protein}g protein · {food.carbs}g carbs · {food.fat}g fat
                        {food.brand && <span> · {food.brand}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="serving-input-group">
              <input
                type="number"
                min="0.1"
                step="any"
                placeholder="Serving size"
                value={servingSize}
                onChange={handleServingChange}
                className="nutrition-input serving-size"
              />
              <button
                type="button"
                onClick={handleUnitToggle}
                className="unit-toggle-btn"
              >{servingUnit}</button>
            </div>
            <input
              name="calories"
              type="number"
              min="0"
              step="any"
              placeholder="Calories *"
              value={form.calories}
              onChange={handleChange}
              className="nutrition-input macro-lg"
            />
            <input
              name="protein"
              type="number"
              min="0"
              step="any"
              placeholder="Protein (g)"
              value={form.protein}
              onChange={handleChange}
              className="nutrition-input macro-lg"
            />
            <input
              name="carbs"
              type="number"
              min="0"
              step="any"
              placeholder="Carbs (g)"
              value={form.carbs}
              onChange={handleChange}
              className="nutrition-input macro-lg"
            />
            <input
              name="fat"
              type="number"
              min="0"
              step="any"
              placeholder="Fat (g)"
              value={form.fat}
              onChange={handleChange}
              className="nutrition-input macro-lg"
            />
            <input
              name="fiber"
              type="number"
              min="0"
              step="any"
              placeholder="Fiber (g)"
              value={form.fiber}
              onChange={handleChange}
              className="nutrition-input macro-sm"
            />
            <input
              name="sugar"
              type="number"
              min="0"
              step="any"
              placeholder="Sugar (g)"
              value={form.sugar}
              onChange={handleChange}
              className="nutrition-input macro-sm"
            />
          </div>
          {error && <p className="nutrition-error">{error}</p>}
          <div className="form-actions">
            <button type="submit" className="btn-add-entry">
              + Add Entry
            </button>
            <button
              type="button"
              onClick={handleSaveToMyFoods}
              disabled={!form.name.trim() || savedFoods.some(f => f.name.toLowerCase() === form.name.trim().toLowerCase())}
              className="btn-save-to-my-foods"
            >
              {savedFoods.some(f => f.name.toLowerCase() === form.name.trim().toLowerCase()) ? 'Already in My Foods' : 'Save to My Foods'}
            </button>
          </div>
        </form>
      </div>

      {/* My Foods Library */}
      <div className="my-foods-section">
        <button onClick={() => setMyFoodsOpen(o => !o)} className="my-foods-toggle-btn">
          <span>My Foods <span className="my-foods-count">{savedFoods.length} saved</span></span>
          <span className="my-foods-chevron">{myFoodsOpen ? '▲' : '▼'}</span>
        </button>
        {myFoodsOpen && (
          savedFoods.length === 0 ? (
            <p className="my-foods-empty">
              No saved foods yet — check "Save to My Foods" when adding an entry.
            </p>
          ) : (
            <div className="my-foods-list">
              {savedFoods.map(food => {
                const serving = myFoodsServings[food.name];
                const currentSize = serving?.size ?? food.refServingSize ?? '';
                const currentUnit = serving?.unit ?? food.refServingUnit ?? 'g';
                const refSize = food.refServingSize;
                const refUnit = food.refServingUnit ?? 'g';

                let preview = { calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat };
                if (currentSize && refSize && Number(currentSize) > 0 && Number(refSize) > 0) {
                  const ratio = toGrams(currentSize, currentUnit) / toGrams(refSize, refUnit);
                  preview = {
                    calories: Math.round((food.calories || 0) * ratio),
                    protein:  Math.round((food.protein  || 0) * ratio * 10) / 10,
                    carbs:    Math.round((food.carbs    || 0) * ratio * 10) / 10,
                    fat:      Math.round((food.fat      || 0) * ratio * 10) / 10,
                  };
                }

                return (
                  <div key={food.name} className="my-food-item">
                    <div className="my-food-item-header">
                      <div>
                        <span className="my-food-name">{food.name}</span>
                        {refSize && (
                          <span className="my-food-ref">ref: {refSize}{refUnit}</span>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteSaved(food.name)}
                        className="btn-remove-food"
                        title="Remove from My Foods"
                      >✕</button>
                    </div>
                    <div className="my-food-actions">
                      <input
                        type="number"
                        min="0.1"
                        step="any"
                        placeholder={`Amount (${currentUnit})`}
                        value={currentSize}
                        onChange={e => setMyFoodsServings(prev => ({
                          ...prev,
                          [food.name]: { size: e.target.value, unit: currentUnit },
                        }))}
                        className="nutrition-input my-food-size"
                      />
                      <button
                        type="button"
                        onClick={() => setMyFoodsServings(prev => ({
                          ...prev,
                          [food.name]: { size: currentSize, unit: currentUnit === 'g' ? 'oz' : 'g' },
                        }))}
                        className="unit-toggle-btn"
                      >{currentUnit}</button>
                      <span className="my-food-preview">
                        {preview.calories} kcal
                        {preview.protein > 0 && ` · ${preview.protein}g protein`}
                        {preview.carbs > 0 && ` · ${preview.carbs}g carbs`}
                        {preview.fat > 0 && ` · ${preview.fat}g fat`}
                      </span>
                      <button
                        onClick={() => handleAddFromLibrary(food)}
                        className="btn-add-from-library"
                      >+ Add</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* Log Table */}
      <div className="log-section">
        <div className="log-header">
          <h3>Today&apos;s Log ({entries.length} {entries.length === 1 ? 'item' : 'items'})</h3>
          {entries.length > 0 && (
            <button onClick={handleClearAll} className="btn-clear-all">
              Clear All
            </button>
          )}
        </div>

        {entries.length === 0 ? (
          <p className="log-empty">
            No foods logged yet — add your first entry above.
          </p>
        ) : (
          <div className="log-table-wrapper">
            <table className="log-table">
              <thead>
                <tr>
                  <th className="text-left">Food</th>
                  {visibleMacroList.map(m => (
                    <th key={m.key}>{m.label}<br /><span className="th-unit">{m.unit}</span></th>
                  ))}
                  <th className="col-muted">Time</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, i) => (
                  <tr key={entry.id} className={i % 2 === 0 ? 'row-even' : 'row-odd'}>
                    <td className="td-food">
                      {entry.name}
                      {entry.servingSize && (
                        <div className="td-serving-size">
                          {entry.servingSize}{entry.servingUnit}
                        </div>
                      )}
                    </td>
                    {visibleMacroList.map(m => (
                      <td key={m.key} className={`td-macro ${m.key === 'calories' ? 'calories' : 'default'}`}>
                        {entry[m.key] > 0 ? (m.key === 'calories' ? entry[m.key] : entry[m.key].toFixed(1)) : <span className="td-dash">—</span>}
                      </td>
                    ))}
                    <td className="td-time">{entry.time || '—'}</td>
                    <td className="td-actions">
                      <button
                        onClick={() => handleSaveEntryToMyFoods(entry)}
                        className={`btn-save-entry${savedFoods.some(f => f.name.toLowerCase() === entry.name.toLowerCase()) ? ' hidden' : ''}`}
                        title="Save to My Foods"
                      >
                        <svg width="13" height="15" viewBox="0 0 13 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
                          <path d="M1.5 1.5h10v12l-5-3-5 3V1.5z" />
                        </svg>
                      </button>
                      <button onClick={() => handleDelete(entry.id)} className="btn-delete-entry" title="Remove">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="td-total-label">Total</td>
                  {visibleMacroList.map(m => (
                    <td key={m.key} className="td-total-value" style={{ color: m.color }}>
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
