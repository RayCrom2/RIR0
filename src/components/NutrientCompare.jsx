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

const COLOR_B = "#667eea";
const USDA_KEY = import.meta.env.VITE_USDA_API_KEY;

function getVal(food, num) {
  const n = food?.foodNutrients?.find((n) => n.nutrientNumber === num);
  return n != null ? Math.round(n.value * 10) / 10 : null;
}

export default function NutrientCompare({ foodA, onClose, style: styleProp = {} }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [foodB, setFoodB] = useState(null);
  const debounceRef = useRef(null);

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
    <div style={containerStyle}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: "#ff8c42", lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {foodA.description}
          </p>
          {foodB && (
            <p style={{ margin: "2px 0 0", fontWeight: 700, fontSize: 13, color: COLOR_B, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              vs {foodB.description}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer", color: "#aaa", marginLeft: 8, lineHeight: 1, padding: 0 }}
        >
          ✕
        </button>
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
        {results.length > 0 && (
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
            maxHeight: 180,
            overflowY: "auto",
          }}>
            {results.map((f) => (
              <button
                key={f.fdcId}
                type="button"
                onMouseDown={() => { setFoodB(f); setQuery(""); setResults([]); }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "7px 10px",
                  background: "none",
                  border: "none",
                  borderBottom: "1px solid #f0f0f0",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                <span style={{ fontWeight: 600 }}>{f.description}</span>
                {f.brandOwner && <span style={{ color: "#aaa", marginLeft: 6 }}>{f.brandOwner}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bars */}
      <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 8 }}>
        {NUTRIENTS.map(({ num, label, unit, color }) => {
          const valA = getVal(foodA, num);
          const valB = foodB ? getVal(foodB, num) : null;
          if (valA === null && valB === null) return null;
          const maxVal = Math.max(valA ?? 0, valB ?? 0) || 1;
          const pctA = ((valA ?? 0) / maxVal) * 100;
          const pctB = ((valB ?? 0) / maxVal) * 100;

          return (
            <div key={num} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#555", marginBottom: 2 }}>
                <span>{label}</span>
                <span style={{ color: "#aaa", fontSize: 10 }}>{unit}</span>
              </div>
              {/* Food A bar (left→right) */}
              <div style={{ position: "relative", height: 10, background: "#f0f0f0", borderRadius: 5, marginBottom: 2, overflow: "hidden" }}>
                <div style={{
                  position: "absolute", left: 0, top: 0, bottom: 0,
                  width: `${pctA}%`,
                  background: color,
                  borderRadius: 5,
                  transition: "width 0.2s",
                }} />
                {valA !== null && (
                  <span style={{
                    position: "absolute",
                    right: 4,
                    top: 0,
                    bottom: 0,
                    display: "flex",
                    alignItems: "center",
                    fontSize: 9,
                    fontWeight: 700,
                    color: "#333",
                  }}>{valA}</span>
                )}
              </div>
              {/* Food B bar (right→left) */}
              {foodB && (
                <div style={{ position: "relative", height: 10, background: "#f0f0f0", borderRadius: 5, overflow: "hidden" }}>
                  <div style={{
                    position: "absolute", right: 0, top: 0, bottom: 0,
                    width: `${pctB}%`,
                    background: COLOR_B,
                    borderRadius: 5,
                    transition: "width 0.2s",
                  }} />
                  {valB !== null && (
                    <span style={{
                      position: "absolute",
                      left: 4,
                      top: 0,
                      bottom: 0,
                      display: "flex",
                      alignItems: "center",
                      fontSize: 9,
                      fontWeight: 700,
                      color: "#333",
                    }}>{valB}</span>
                  )}
                </div>
              )}
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
