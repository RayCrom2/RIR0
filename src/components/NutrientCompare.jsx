import { useState, useEffect, useRef } from "react";

const NUTRIENTS = [
  { num: "208", label: "Calories", unit: "kcal", color: "#ff8c42" },
  { num: "203", label: "Protein", unit: "g", color: "#4f8ef7" },
  { num: "205", label: "Carbs", unit: "g", color: "#f7c948" },
  { num: "204", label: "Fat", unit: "g", color: "#e05c5c" },
  { num: "291", label: "Fiber", unit: "g", color: "#5cb85c" },
  { num: "269", label: "Sugar", unit: "g", color: "#c87dd4" },
  { num: "307", label: "Sodium", unit: "mg", color: "#888" },
];

const COLOR_A = "#ff8c42";
const COLOR_B = "#667eea";
const USDA_KEY = import.meta.env.VITE_USDA_API_KEY;

function getVal(food, num) {
  const n = food?.foodNutrients?.find((n) => n.nutrientNumber === num);
  return n != null ? Math.round(n.value * 10) / 10 : null;
}

export default function NutrientCompare({ foodA, onClose, style: styleProp = {}, libraryFoods = [] }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [foodB, setFoodB] = useState(null);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  const libraryMatches = query.trim().length >= 1
    ? libraryFoods.filter((f) => f.description.toLowerCase().includes(query.trim().toLowerCase()))
    : [];

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${USDA_KEY}&query=${encodeURIComponent(query)}&pageSize=6`
        );
        const data = await res.json();
        setResults(data.foods || []);
      } catch { setResults([]); }
    }, 350);
  }, [query]);

  useEffect(() => {
    function handleMouseDown(e) {
      if (containerRef.current && !e.composedPath().includes(containerRef.current)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose]);

  const containerStyle = {
    position: "absolute",
    left: "calc(100% + 10px)",
    top: 0,
    zIndex: 300,
    background: "#fff",
    borderRadius: 10,
    boxShadow: "0 8px 28px rgba(0,0,0,0.16)",
    padding: "14px 18px",
    minWidth: 340,
    ...styleProp,
  };

  return (
    <div ref={containerRef} style={containerStyle}>
      {/* Header */}
      <div style={{ marginBottom: 10 }}>
        {foodB ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 12, color: "#ff8c42", lineHeight: 1.3, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>
              {foodA.description}
            </p>
            <span style={{ fontSize: 10, fontWeight: 800, color: "#aaa", flexShrink: 0, letterSpacing: "0.05em" }}>VS</span>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 12, color: COLOR_B, lineHeight: 1.3, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right" }}>
              {foodB.description}
            </p>
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer", color: "#aaa", marginLeft: 4, lineHeight: 1, padding: 0, flexShrink: 0 }}
            >
              ✕
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: "#ff8c42", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
              {foodA.description}
            </p>
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer", color: "#aaa", marginLeft: 8, lineHeight: 1, padding: 0, flexShrink: 0 }}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Search for food B */}
      <div style={{ position: "relative", marginBottom: 10 }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search food to compare…"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "7px 10px",
            border: `1.5px solid ${COLOR_B}`,
            borderRadius: 6,
            fontSize: 12,
            outline: "none",
          }}
        />
        {(libraryMatches.length > 0 || results.length > 0) && (
          <div style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "#fff",
            border: "1px solid #e0e0e0",
            borderRadius: 6,
            boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
            zIndex: 10,
            maxHeight: 220,
            overflowY: "auto",
          }}>
            {libraryMatches.length > 0 && (
              <>
                <p style={{ margin: 0, padding: "5px 10px 3px", fontSize: 10, fontWeight: 700, color: "#ff8c42", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  My Foods
                </p>
                {libraryMatches.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onMouseDown={() => { setFoodB(f); setQuery(""); setResults([]); }}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 10px", background: "none", border: "none", borderBottom: "1px solid #f0f0f0", cursor: "pointer", fontSize: 12 }}
                  >
                    <span style={{ fontWeight: 600 }}>{f.description}</span>
                    {f.servingSize && <span style={{ color: "#aaa", marginLeft: 6 }}>{f.servingSize}{(f.servingSizeUnit || "g").toLowerCase()}</span>}
                  </button>
                ))}
              </>
            )}
            {results.length > 0 && (
              <>
                <p style={{ margin: 0, padding: "5px 10px 3px", fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  USDA Database
                </p>
                {results.map((f) => (
                  <button
                    key={f.fdcId}
                    type="button"
                    onMouseDown={() => { setFoodB(f); setQuery(""); setResults([]); }}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 10px", background: "none", border: "none", borderBottom: "1px solid #f0f0f0", cursor: "pointer", fontSize: 12 }}
                  >
                    <span style={{ fontWeight: 600 }}>{f.description}</span>
                    {f.brandOwner && <span style={{ color: "#aaa", marginLeft: 6 }}>{f.brandOwner}</span>}
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Bars */}
      <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 8 }}>
        {NUTRIENTS.map(({ num, label, unit, color }) => {
          const valA = getVal(foodA, num);
          const valB = foodB ? getVal(foodB, num) : null;
          if (valA === null && valB === null) return null;
          const aVal = valA ?? 0;
          const bVal = valB ?? 0;
          const total = aVal + bVal || 1;
          const pctA = foodB ? (aVal / total) * 100 : 100;
          const pctB = foodB ? (bVal / total) * 100 : 0;

          return (
            <div key={num} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 11, marginBottom: 3 }}>
                <span style={{ color: COLOR_A, fontWeight: 700 }}>{aVal} {unit}</span>
                <span style={{ color: "#888", fontSize: 10 }}>{label}</span>
                {foodB
                  ? <span style={{ color: COLOR_B, fontWeight: 700 }}>{bVal} {unit}</span>
                  : <span style={{ color: "#aaa", fontSize: 10 }}>{unit}</span>
                }
              </div>
              <div style={{ position: "relative", height: 10, background: "#f0f0f0", borderRadius: 5, overflow: "hidden" }}>
                <div style={{
                  position: "absolute", left: 0, top: 0, bottom: 0,
                  width: `${pctA}%`,
                  background: COLOR_A,
                  transition: "width 0.3s ease",
                }} />
                <div style={{
                  position: "absolute", right: 0, top: 0, bottom: 0,
                  width: `${pctB}%`,
                  background: COLOR_B,
                  transition: "width 0.3s ease",
                }} />
              </div>
            </div>
          );
        })}
      </div>

      {!foodB && (
        <p style={{ margin: "8px 0 0", fontSize: 11, color: "#bbb", textAlign: "center" }}>
          Search a food above to compare
        </p>
      )}
    </div>
  );
}
