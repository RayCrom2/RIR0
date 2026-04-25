import { useRef, useEffect } from "react";

const NUTRIENTS = [
  { num: "208", label: "Calories", unit: "kcal", color: "#ff8c42" },
  { num: "203", label: "Protein", unit: "g", color: "#4f8ef7" },
  { num: "205", label: "Carbs", unit: "g", color: "#f7c948" },
  { num: "204", label: "Fat", unit: "g", color: "#e05c5c" },
  { num: "291", label: "Fiber", unit: "g", color: "#5cb85c" },
  { num: "269", label: "Sugar", unit: "g", color: "#c87dd4" },
  { num: "307", label: "Sodium", unit: "mg", color: "#888" },
];

export default function UsdaNutrientCard({ food, scale = 1, inline = false, style: styleProp = {}, onCompare, onClose }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!onClose) return;
    function handleMouseDown(e) {
      if (containerRef.current && !e.composedPath().includes(containerRef.current)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose]);

  const get = (num) => {
    const n = food.foodNutrients?.find((n) => n.nutrientNumber === num);
    return n != null ? Math.round(n.value * scale * 10) / 10 : null;
  };

  const containerStyle = inline
    ? { background: "#f7f7fb", borderRadius: 8, padding: "10px 14px" }
    : {
        position: "absolute",
        left: "calc(100% + 10px)",
        top: 0,
        zIndex: 300,
        background: "#fff",
        borderRadius: 10,
        boxShadow: "0 8px 28px rgba(0,0,0,0.16)",
        padding: "14px 18px",
        minWidth: 210,
        pointerEvents: onClose ? "auto" : "none",
        ...styleProp,
      };

  return (
    <div ref={containerRef} style={containerStyle}>
      {!inline && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: "#333", lineHeight: 1.3, flex: 1, minWidth: 0 }}>
              {food.description}
            </p>
            {onClose && (
              <button
                onClick={onClose}
                style={{ background: "none", border: "none", fontSize: 14, cursor: "pointer", color: "#aaa", marginLeft: 8, lineHeight: 1, padding: 0, flexShrink: 0 }}
              >
                ✕
              </button>
            )}
          </div>
          {food.brandOwner && (
            <p style={{ margin: "0 0 8px", fontSize: 11, color: "#aaa" }}>{food.brandOwner}</p>
          )}
          <div style={{ borderBottom: "1px solid #f0f0f0", paddingBottom: 8, marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#555" }}>Serving size</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#333" }}>
                {food.servingSize
                  ? `${food.servingSize} ${(food.servingSizeUnit || "g").toLowerCase()}`
                  : "—"}
              </span>
            </div>
          </div>
        </>
      )}
      {NUTRIENTS.map(({ num, label, unit, color }) => {
        const val = get(num);
        if (val === null) return null;
        return (
          <div
            key={num}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}
          >
            <span style={{ fontSize: 12, color: "#555" }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color }}>
              {val} {unit}
            </span>
          </div>
        );
      })}
      {onCompare && !inline && (
        <button
          onClick={onCompare}
          style={{
            marginTop: 10,
            width: "100%",
            padding: "6px 0",
            background: "#ff8c42",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            pointerEvents: "auto",
          }}
        >
          Compare
        </button>
      )}
    </div>
  );
}
