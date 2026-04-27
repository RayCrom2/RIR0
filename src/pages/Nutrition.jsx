import { useState, useEffect, useRef } from "react";
import { LuCalendar } from "react-icons/lu";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import UsdaNutrientCard from "../components/UsdaNutrientCard";
import NutrientCompare from "../components/NutrientCompare";

export const monthAbbr = new Date()
  .toLocaleString("default", { month: "short" })
  .toUpperCase();

const VISIBLE_KEY = "nutrition_visible_macros";

const SERVING_UNITS = ["g", "oz", "fl oz", "ml", "lb", "cup", "tbsp", "tsp"];

const EMPTY_FORM = {
  name: "",
  calories: "",
  protein: "",
  fat: "",
  carbs: "",
  fiber: "",
  sugar: "",
  serving_amount: "",
  serving_unit: "g",
};

const USDA_KEY = import.meta.env.VITE_USDA_API_KEY;
const USDA_NUTRIENTS = {
  calories: "208",
  protein: "203",
  fat: "204",
  carbs: "205",
  fiber: "291",
  sugar: "269",
};
const USDA_UNIT_MAP = {
  G: "g",
  ML: "ml",
  OZ: "oz",
  LB: "lb",
  CUP: "cup",
  TBSP: "tbsp",
  TSP: "tsp",
  "FL OZ": "fl oz",
};

const MACROS = [
  { key: "calories", label: "Calories", unit: "kcal", color: "#ff8c42" },
  { key: "protein", label: "Protein", unit: "g", color: "#4f8ef7" },
  { key: "carbs", label: "Carbs", unit: "g", color: "#f7c948" },
  { key: "fat", label: "Fat", unit: "g", color: "#e05c5c" },
  { key: "fiber", label: "Fiber", unit: "g", color: "#5cb85c" },
  { key: "sugar", label: "Sugar", unit: "g", color: "#c87dd4" },
];

const DEFAULT_GOALS = { calories: 2000, protein: 150, fat: 65, carbs: 250, fiber: 25, sugar: 50 };

function dateStr(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayStr() {
  return dateStr(0);
}
function tomorrowStr() {
  return dateStr(1);
}

export default function Nutrition() {
  const { user, requireAuth, loading } = useAuth();
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [savedFoods, setSavedFoods] = useState([]);
  const [myFoodsOpen, setMyFoodsOpen] = useState(true);
  const [myFoodsSearch, setMyFoodsSearch] = useState("");
  const [myFoodsSort, setMyFoodsSort] = useState("name_asc");
  const [libraryAmounts, setLibraryAmounts] = useState({});
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState("");
  const [visibleMacros, setVisibleMacros] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(VISIBLE_KEY));
      if (Array.isArray(saved)) return new Set(saved);
    } catch {}
    return new Set(MACROS.map((m) => m.key));
  });
  const [goals, setGoals] = useState(DEFAULT_GOALS);
  const [menuOpen, setMenuOpen] = useState(false);
  const [usdaResults, setUsdaResults] = useState([]);
  const [usdaLoading, setUsdaLoading] = useState(false);
  const [usdaOpen, setUsdaOpen] = useState(false);
  const [hoveredFood, setHoveredFood] = useState(null);
  const [hoveredLibraryId, setHoveredLibraryId] = useState(null);
  const [pinnedFood, setPinnedFood] = useState(null);
  const [compareFood, setCompareFood] = useState(null);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 767px)").matches);
  const [selectedUsdaFood, setSelectedUsdaFood] = useState(null);
  const [servingInput, setServingInput] = useState("");
  const menuRef = useRef(null);
  const usdaRef = useRef(null);
  const usdaDebounce = useRef(null);
  const containerRef = useRef(null);

  const visibleMacroList = MACROS.filter((m) => visibleMacros.has(m.key));

  const usdaScale = selectedUsdaFood
    ? selectedUsdaFood.servingSize
      ? (Number(servingInput) || 0) / selectedUsdaFood.servingSize
      : (Number(servingInput) || 1)
    : 1;

  const filteredSortedFoods = (() => {
    const q = myFoodsSearch.trim().toLowerCase();
    let list = q ? savedFoods.filter((f) => f.name.toLowerCase().includes(q)) : [...savedFoods];
    switch (myFoodsSort) {
      case "name_asc":  list.sort((a, b) => a.name.localeCompare(b.name)); break;
      case "name_desc": list.sort((a, b) => b.name.localeCompare(a.name)); break;
      case "protein_cal": list.sort((a, b) => ((b.protein || 0) / (b.calories || 1)) - ((a.protein || 0) / (a.calories || 1))); break;
      case "calories": list.sort((a, b) => (b.calories || 0) - (a.calories || 0)); break;
      case "protein":  list.sort((a, b) => (b.protein || 0) - (a.protein || 0)); break;
      case "fat":      list.sort((a, b) => (b.fat || 0) - (a.fat || 0)); break;
      case "carbs":    list.sort((a, b) => (b.carbs || 0) - (a.carbs || 0)); break;
      case "sugar":    list.sort((a, b) => (b.sugar || 0) - (a.sugar || 0)); break;
      case "fiber":    list.sort((a, b) => (b.fiber || 0) - (a.fiber || 0)); break;
    }
    return list;
  })();

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target))
        setMenuOpen(false);
      if (usdaRef.current && !usdaRef.current.contains(e.target))
        setUsdaOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  function toggleMacro(key) {
    setVisibleMacros((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size === 1) return prev; // always keep at least one visible
        next.delete(key);
      } else {
        next.add(key);
      }
      localStorage.setItem(VISIBLE_KEY, JSON.stringify([...next]));
      saveMacroPrefs(next);
      return next;
    });
  }

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setEntries([]);
      return;
    }
    supabase
      .from("nutrition_logs")
      .select("*")
      .eq("user_id", user.id)
      .gte("logged_at", todayStr())
      .lt("logged_at", tomorrowStr())
      .order("logged_time")
      .then(({ data, error }) => {
        setEntries(data || []);
      });
  }, [user, loading]);

  useEffect(() => {
    if (!user) {
      setSavedFoods([]);
      return;
    }
    supabase
      .from("custom_foods")
      .select("*")
      .eq("user_id", user.id)
      .order("name")
      .then(({ data }) => setSavedFoods(data || []));
  }, [user]);

  // ── load nutrition goals from DB
  useEffect(() => {
    if (!user) { setGoals(DEFAULT_GOALS); return; }
    supabase
      .from("nutrition_goals")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => { if (data) setGoals(data); });
  }, [user]);

  // ── load macro preferences from DB
  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_preferences")
      .select("nutrition_visible_macros")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        if (Array.isArray(data.nutrition_visible_macros))
          setVisibleMacros(new Set(data.nutrition_visible_macros));
      });
  }, [user]);

  async function saveMacroPrefs(visible) {
    if (!user) { console.warn("saveMacroPrefs: no user"); return; }
    const { error } = await supabase.from("user_preferences").upsert(
      { user_id: user.id, nutrition_visible_macros: [...visible] },
      { onConflict: "user_id" }
    );
    if (error) console.error("saveMacroPrefs error:", error);
  }

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError("");
    if (e.target.name === "name" && !formOpen) {
      const q = e.target.value.trim();
      clearTimeout(usdaDebounce.current);
      if (q.length >= 2) {
        usdaDebounce.current = setTimeout(() => searchUSDA(q), 400);
      } else {
        setUsdaResults([]);
        setUsdaOpen(false);
      }
    }
  }

  async function searchUSDA(query) {
    setUsdaLoading(true);
    try {
      const res = await fetch(
        `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=10&api_key=${USDA_KEY}`,
      );
      const json = await res.json();
      setUsdaResults(json.foods || []);
      setUsdaOpen((json.foods || []).length > 0);
    } catch {
      setUsdaResults([]);
    } finally {
      setUsdaLoading(false);
    }
  }

  function applyUSDAFood(food) {
    setSelectedUsdaFood(food);
    setServingInput(food.servingSize ? String(food.servingSize) : "1");
    setUsdaOpen(false);
    setUsdaResults([]);
    setHoveredFood(null);
  }

  function handleAddFromUsda() {
    if (!selectedUsdaFood) return;
    const scale = selectedUsdaFood.servingSize
      ? (Number(servingInput) || 0) / selectedUsdaFood.servingSize
      : (Number(servingInput) || 1);
    const get = (num) => {
      const n = selectedUsdaFood.foodNutrients?.find((n) => n.nutrientNumber === num);
      return n ? Math.round(n.value * scale * 10) / 10 : 0;
    };
    const rawUnit = (selectedUsdaFood.servingSizeUnit || "G").toUpperCase();
    const unit = USDA_UNIT_MAP[rawUnit] || "g";
    requireAuth(async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      const now = new Date();
      const entry = {
        user_id: u.id,
        logged_at: todayStr(),
        logged_time: now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
        food_name: selectedUsdaFood.description,
        calories: Math.round(get(USDA_NUTRIENTS.calories)),
        protein: get(USDA_NUTRIENTS.protein),
        fat: get(USDA_NUTRIENTS.fat),
        carbs: get(USDA_NUTRIENTS.carbs),
        fiber: get(USDA_NUTRIENTS.fiber),
        sugar: get(USDA_NUTRIENTS.sugar),
        serving_amount: Number(servingInput) || null,
        serving_unit: selectedUsdaFood.servingSize ? unit : "×",
      };
      const { data } = await supabase.from("nutrition_logs").insert(entry).select().single();
      if (data) setEntries((prev) => [...prev, data]);
      setSelectedUsdaFood(null);
      setServingInput("");
    });
  }

  function handleAdd(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Food name is required.");
      return;
    }
    if (
      !form.calories ||
      isNaN(Number(form.calories)) ||
      Number(form.calories) < 0
    ) {
      setError("Enter a valid calorie amount.");
      return;
    }
    requireAuth(async () => {
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      const now = new Date();
      const entry = {
        user_id: u.id,
        logged_at: todayStr(),
        logged_time: now.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }),
        food_name: form.name.trim(),
        calories: Number(form.calories) || 0,
        protein: Number(form.protein) || 0,
        fat: Number(form.fat) || 0,
        carbs: Number(form.carbs) || 0,
        fiber: Number(form.fiber) || 0,
        sugar: Number(form.sugar) || 0,
        serving_amount:
          form.serving_amount !== "" ? Number(form.serving_amount) : null,
        serving_unit: form.serving_unit || "g",
      };
      const { data } = await supabase
        .from("nutrition_logs")
        .insert(entry)
        .select()
        .single();
      if (data) setEntries((prev) => [...prev, data]);
      setForm(EMPTY_FORM);
    });
  }

  function handleSaveToMyFoods() {
    if (!form.name.trim()) {
      setError("Food name is required.");
      return;
    }
    requireAuth(async () => {
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      const already = savedFoods.some(
        (f) => f.name.toLowerCase() === form.name.trim().toLowerCase(),
      );
      if (!already) {
        const food = {
          user_id: u.id,
          name: form.name.trim(),
          calories: Number(form.calories) || 0,
          protein: Number(form.protein) || 0,
          fat: Number(form.fat) || 0,
          carbs: Number(form.carbs) || 0,
          fiber: Number(form.fiber) || 0,
          sugar: Number(form.sugar) || 0,
          serving_amount:
            form.serving_amount !== "" ? Number(form.serving_amount) : null,
          serving_unit: form.serving_unit || "g",
        };
        const { data } = await supabase
          .from("custom_foods")
          .insert(food)
          .select()
          .single();
        if (data)
          setSavedFoods((prev) =>
            [...prev, data].sort((a, b) => a.name.localeCompare(b.name)),
          );
      }
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 1500);
    });
  }

  async function handleDelete(id) {
    await supabase.from("nutrition_logs").delete().eq("id", id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  async function handleClearAll() {
    if (!window.confirm("Clear all entries for today?")) return;
    if (!user) return;
    await supabase
      .from("nutrition_logs")
      .delete()
      .eq("user_id", user.id)
      .gte("logged_at", todayStr())
      .lt("logged_at", tomorrowStr());
    setEntries([]);
  }

  function handleAddFromLibrary(food) {
    requireAuth(async () => {
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      const customAmount = Number(
        libraryAmounts[food.name] ?? food.serving_amount ?? 1,
      );
      const baseAmount = Number(food.serving_amount);
      const scale = baseAmount > 0
        ? (customAmount > 0 ? customAmount / baseAmount : 1)
        : customAmount;
      const now = new Date();
      const entry = {
        user_id: u.id,
        logged_at: todayStr(),
        logged_time: now.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }),
        food_name: food.name,
        calories: Math.round(food.calories * scale),
        protein: Math.round(food.protein * scale * 10) / 10,
        fat: Math.round(food.fat * scale * 10) / 10,
        carbs: Math.round(food.carbs * scale * 10) / 10,
        fiber: Math.round(food.fiber * scale * 10) / 10,
        sugar: Math.round(food.sugar * scale * 10) / 10,
        serving_amount: customAmount || food.serving_amount,
        serving_unit: (!food.serving_amount || food.serving_unit === "×") ? "×" : food.serving_unit,
      };
      const { data } = await supabase
        .from("nutrition_logs")
        .insert(entry)
        .select()
        .single();
      if (data) setEntries((prev) => [...prev, data]);
      setLibraryAmounts((prev) => {
        const next = { ...prev };
        delete next[food.name];
        return next;
      });
    });
  }

  async function handleSaveEntryToMyFoods(entry) {
    const already = savedFoods.some(
      (f) => f.name.toLowerCase() === entry.food_name.toLowerCase(),
    );
    if (already) return;
    requireAuth(async () => {
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      const food = {
        user_id: u.id,
        name: entry.food_name,
        calories: entry.calories,
        protein: entry.protein,
        fat: entry.fat,
        carbs: entry.carbs,
        fiber: entry.fiber,
        sugar: entry.sugar,
        serving_amount: entry.serving_amount,
        serving_unit: entry.serving_unit,
      };
      const { data } = await supabase
        .from("custom_foods")
        .insert(food)
        .select()
        .single();
      if (data)
        setSavedFoods((prev) =>
          [...prev, data].sort((a, b) => a.name.localeCompare(b.name)),
        );
    });
  }

  async function handleDeleteSaved(id) {
    await supabase.from("custom_foods").delete().eq("id", id);
    setSavedFoods((prev) => prev.filter((f) => f.id !== id));
  }

  const sortedEntries = [...entries].sort((a, b) => parseLoggedTime(a.logged_time) - parseLoggedTime(b.logged_time));

  const totals = MACROS.reduce((acc, m) => {
    acc[m.key] = entries.reduce((sum, e) => sum + (e[m.key] || 0), 0);
    return acc;
  }, {});

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 8px" }}>
      <div style={{ display: "flex" }}>
        <p className="font-bold text-[2rem] mb-1">Nutrition Tracker</p>
        <button className="relative inline-flex items-center justify-center ml-auto cursor-pointer">
          <LuCalendar size={45} />
          <span className="absolute bottom-[15px] text-[11px] font-bold leading-none">
            {monthAbbr}
          </span>
        </button>
      </div>
      <p style={{ color: "#888", marginBottom: 20, fontSize: 14 }}>
        {today} — entries reset each day
      </p>

      {/* Daily Progress Bars */}
      <div
        id="nutrientBars"
        style={{
          background: "#fff",
          borderRadius: 10,
          padding: "16px 20px",
          boxShadow: "0 4px 14px rgba(0,0,0,0.07)",
          marginBottom: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#888",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Daily Progress
          </span>
          <div ref={menuRef} style={{ position: "relative" }}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 20,
                color: "#aaa",
                padding: "2px 6px",
                borderRadius: 6,
                lineHeight: 1,
              }}
              title="Show/hide macros"
            >
              ⋯
            </button>
            {menuOpen && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: "110%",
                  zIndex: 100,
                  background: "#fff",
                  borderRadius: 10,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                  padding: "8px 0",
                  minWidth: 160,
                }}
              >
                <p
                  style={{
                    margin: "0 0 4px",
                    padding: "4px 14px",
                    fontSize: 11,
                    color: "#aaa",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Show macros
                </p>
                {MACROS.map((m) => (
                  <label
                    key={m.key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "7px 14px",
                      cursor: "pointer",
                      fontSize: 14,
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "#f7f7fb")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "none")
                    }
                  >
                    <input
                      type="checkbox"
                      checked={visibleMacros.has(m.key)}
                      onChange={() => toggleMacro(m.key)}
                      style={{
                        accentColor: m.color,
                        width: 15,
                        height: 15,
                        cursor: "pointer",
                      }}
                    />
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: m.color,
                        flexShrink: 0,
                      }}
                    />
                    {m.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        {visibleMacroList.map((m) => {
          const consumed = totals[m.key];
          const limit = goals[m.key] || 1;
          const pct = Math.min(100, (consumed / limit) * 100);
          const over = consumed > limit;
          return (
            <div key={m.key} style={{ marginBottom: 14 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 5,
                  fontSize: 13,
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    color: "#333",
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: m.color,
                      display: "inline-block",
                      flexShrink: 0,
                    }}
                  />
                  {m.label}
                </span>
                <span style={{ color: over ? "#e05c5c" : "#888", fontWeight: over ? 700 : 400 }}>
                  {m.key === "calories"
                    ? consumed.toFixed(0)
                    : consumed.toFixed(1)}{" "}
                  / {limit} {m.unit}
                </span>
              </div>
              <div
                style={{
                  height: 8,
                  background: "#f0f0f0",
                  borderRadius: 99,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${pct}%`,
                    background: over ? "#e05c5c" : m.color,
                    borderRadius: 99,
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Entry Form */}
      <div
        ref={containerRef}
        style={{
          position: "relative",
          background: "#fff",
          borderRadius: 10,
          padding: "16px 20px",
          boxShadow: "0 4px 14px rgba(0,0,0,0.07)",
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div ref={usdaRef} style={{ position: "relative", flex: 1 }}>
            <input
              name="name"
              placeholder={formOpen ? "Food name…" : "Search USDA food database…"}
              value={form.name}
              onChange={handleChange}
              style={inputStyle({ width: "100%", boxSizing: "border-box" })}
              autoComplete="off"
            />
            {usdaLoading && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  zIndex: 200,
                  marginTop: 4,
                  background: "#fff",
                  borderRadius: 8,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
                  padding: "10px 14px",
                  fontSize: 13,
                  color: "#aaa",
                }}
              >
                Searching USDA…
              </div>
            )}
            {usdaOpen && usdaResults.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  zIndex: 200,
                  marginTop: 4,
                  background: "#fff",
                  borderRadius: 8,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                  maxHeight: 280,
                  overflowY: "auto",
                }}
              >
                {usdaResults.map((food) => {
                  const kcal = food.foodNutrients?.find(
                    (n) => n.nutrientNumber === "208",
                  )?.value;
                  return (
                    <button
                      key={food.fdcId}
                      type="button"
                      onMouseDown={() => applyUSDAFood(food)}
                      onMouseEnter={() => { if (!isMobile) setHoveredFood(food); }}
                      onMouseLeave={() => { if (!isMobile) setHoveredFood(null); }}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "9px 14px",
                        background: "none",
                        border: "none",
                        borderBottom: "1px solid #f0f0f0",
                        cursor: "pointer",
                        fontSize: 13,
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{food.description}</span>
                      {food.brandOwner && (
                        <span style={{ color: "#aaa", marginLeft: 8, fontSize: 12 }}>
                          {food.brandOwner}
                        </span>
                      )}
                      {kcal != null && (
                        <span style={{ color: "#ff8c42", marginLeft: 8, fontSize: 12 }}>
                          {Math.round(kcal)} kcal
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setFormOpen((o) => !o)}
            style={{
              background: "#ff8c42",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              width: 38,
              height: 38,
              fontSize: 22,
              lineHeight: 1,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
            title={formOpen ? "Close form" : "Add food manually"}
          >
            {formOpen ? "−" : "+"}
          </button>
          <button
            type="button"
            onClick={() => setMyFoodsOpen((o) => !o)}
            style={{
              background: myFoodsOpen ? "#f7f7fb" : "none",
              border: "1px solid #e0e0e0",
              borderRadius: 8,
              width: 38,
              height: 38,
              fontSize: 17,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              color: myFoodsOpen ? "#ff8c42" : "#888",
            }}
            title="My Food Library"
          >
            ☰
          </button>
        </div>

        {selectedUsdaFood && (
          <div style={{ marginTop: 14, background: "#f7f7fb", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#333" }}>{selectedUsdaFood.description}</p>
                {selectedUsdaFood.brandOwner && (
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#aaa" }}>{selectedUsdaFood.brandOwner}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => { setSelectedUsdaFood(null); setServingInput(""); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#bbb", fontSize: 18, lineHeight: 1, padding: "2px 4px" }}
              >✕</button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 13, color: "#555", flexShrink: 0 }}>Serving size</span>
              {selectedUsdaFood.servingSize ? (
                <div style={{ display: "flex" }}>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={servingInput}
                    onChange={(e) => setServingInput(e.target.value)}
                    style={{ width: 70, padding: "5px 8px", border: "1px solid #e0e0e0", borderRadius: "6px 0 0 6px", borderRight: "none", fontSize: 13, outline: "none", background: "#fff" }}
                  />
                  <span style={{ border: "1px solid #e0e0e0", borderLeft: "none", borderRadius: "0 6px 6px 0", padding: "5px 8px", fontSize: 13, color: "#888", background: "#fafafa", display: "flex", alignItems: "center" }}>
                    {(selectedUsdaFood.servingSizeUnit || "g").toLowerCase()}
                  </span>
                </div>
              ) : (
                <div style={{ display: "flex" }}>
                  <span style={{ border: "1px solid #e0e0e0", borderRadius: "6px 0 0 6px", padding: "5px 8px", fontSize: 13, color: "#888", background: "#fafafa", display: "flex", alignItems: "center" }}>
                    ×
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={servingInput}
                    onChange={(e) => setServingInput(e.target.value)}
                    style={{ width: 60, padding: "5px 8px", border: "1px solid #e0e0e0", borderRadius: "0 6px 6px 0", borderLeft: "none", fontSize: 13, outline: "none", background: "#fff" }}
                  />
                </div>
              )}
            </div>

            <UsdaNutrientCard food={selectedUsdaFood} scale={usdaScale} inline />

            <button
              type="button"
              onClick={handleAddFromUsda}
              style={{
                marginTop: 12,
                background: "#ff8c42",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "9px 22px",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              + Add to Log
            </button>
          </div>
        )}

        {formOpen && (
          <form onSubmit={handleAdd} style={{ marginTop: 16 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  border: "1px solid #e0e0e0",
                  borderRadius: 8,
                  background: "#fafafa",
                  padding: "9px 12px",
                  flex: "2 1 120px",
                }}
              >
                <input
                  name="calories"
                  type="number"
                  placeholder="Calories"
                  value={form.calories}
                  onChange={handleChange}
                  style={{ border: "none", background: "transparent", outline: "none", fontSize: 14, minWidth: 0, flex: 1 }}
                />
                <span style={{ color: "#aaa", fontSize: 13, marginLeft: 8, flexShrink: 0 }}>kcal</span>
              </div>
              {[
                { name: "protein", label: "Protein" },
                { name: "carbs", label: "Carbs" },
                { name: "fat", label: "Fat" },
                { name: "fiber", label: "Fiber" },
                { name: "sugar", label: "Sugar" },
              ].map(({ name, label }) => (
                <div
                  key={name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    border: "1px solid #e0e0e0",
                    borderRadius: 8,
                    background: "#fafafa",
                    padding: "9px 12px",
                    flex: "1 1 70px",
                  }}
                >
                  <input
                    name={name}
                    type="number"
                    min="0"
                    step="any"
                    placeholder={label}
                    value={form[name]}
                    onChange={handleChange}
                    style={{ border: "none", background: "transparent", outline: "none", fontSize: 14, minWidth: 0, flex: 1 }}
                  />
                  <span style={{ color: "#aaa", fontSize: 13, marginLeft: 8, flexShrink: 0 }}>
                    g{form[name] ? ` ${label}` : ""}
                  </span>
                </div>
              ))}
              <div style={{ display: "flex", flex: "1 1 50px", gap: 0 }}>
                <input
                  name="serving_amount"
                  type="number"
                  min="0"
                  placeholder="Serving size"
                  value={form.serving_amount}
                  onChange={handleChange}
                  style={inputStyle({ flex: 1, borderRadius: "8px 0 0 8px", borderRight: "none" })}
                />
                <select
                  name="serving_unit"
                  value={form.serving_unit}
                  onChange={handleChange}
                  style={{ ...inputStyle(), borderRadius: "0 8px 8px 0", padding: "9px 8px", cursor: "pointer" }}
                >
                  {SERVING_UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            </div>
            {error && (
              <p style={{ color: "#e05c5c", margin: "0 0 10px", fontSize: 13 }}>{error}</p>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <button
                type="submit"
                style={{
                  background: "#ff8c42",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "9px 22px",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                + Add Entry
              </button>
              {(() => {
                const alreadySaved = savedFoods.some(
                  (f) => f.name.toLowerCase() === form.name.trim().toLowerCase(),
                );
                return (
                  <button
                    type="button"
                    onClick={alreadySaved ? undefined : handleSaveToMyFoods}
                    disabled={alreadySaved}
                    style={{
                      background: savedFeedback ? "#5cb85c" : "none",
                      color: savedFeedback ? "#fff" : alreadySaved ? "#aaa" : "#888",
                      border: "1px solid",
                      borderColor: alreadySaved ? "#e0e0e0" : savedFeedback ? "#5cb85c" : "#e0e0e0",
                      borderRadius: 8,
                      padding: "8px 16px",
                      cursor: alreadySaved ? "default" : "pointer",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    {alreadySaved ? "★ Already Saved" : savedFeedback ? "★ Saved!" : "☆ Save to My Food Library"}
                  </button>
                );
              })()}
            </div>
          </form>
        )}

        {myFoodsOpen && (
          <div style={{ borderTop: "1px solid #f0f0f0", marginTop: 14, paddingTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#555" }}>
                My Food Library
                <span style={{ fontSize: 12, fontWeight: 400, color: "#aaa", marginLeft: 6 }}>
                  {savedFoods.length} saved
                </span>
              </span>
            </div>
            {savedFoods.length === 0 ? (
            <p
              style={{
                textAlign: "center",
                color: "#bbb",
                padding: "20px 0",
                margin: 0,
                fontSize: 14,
              }}
            >
              No saved foods yet — check "Save to My Food Library" when adding an
              entry.
            </p>
          ) : (
            <div style={{ padding: "0 16px 16px", flex: 1, overflowY: "auto" }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <input
                  type="text"
                  value={myFoodsSearch}
                  onChange={(e) => setMyFoodsSearch(e.target.value)}
                  placeholder="Search saved foods…"
                  style={{ flex: 1, padding: "6px 10px", fontSize: 13, border: "1px solid #e0e0e0", borderRadius: 7, outline: "none", background: "#fafafa" }}
                />
                <select
                  value={myFoodsSort}
                  onChange={(e) => setMyFoodsSort(e.target.value)}
                  style={{ padding: "6px 8px", fontSize: 12, border: "1px solid #e0e0e0", borderRadius: 7, background: "#fafafa", cursor: "pointer", outline: "none", color: "#555" }}
                >
                  <option value="name_asc">Name A→Z</option>
                  <option value="name_desc">Name Z→A</option>
                  <option value="protein_cal">Protein / Cal ratio</option>
                  <option value="calories">Highest Calories</option>
                  <option value="protein">Highest Protein</option>
                  <option value="fat">Highest Fat</option>
                  <option value="carbs">Highest Carbs</option>
                  <option value="sugar">Highest Sugar</option>
                  <option value="fiber">Highest Fiber</option>
                </select>
              </div>
              {filteredSortedFoods.length === 0 && (
                <p style={{ textAlign: "center", color: "#bbb", fontSize: 13, padding: "12px 0", margin: 0 }}>
                  No foods match your search.
                </p>
              )}
              {filteredSortedFoods.map((food) => {
                const normalizedFood = {
                  id: food.id,
                  description: food.name,
                  servingSize: food.serving_amount,
                  servingSizeUnit: food.serving_unit,
                  foodNutrients: [
                    { nutrientNumber: "208", value: food.calories },
                    { nutrientNumber: "203", value: food.protein },
                    { nutrientNumber: "205", value: food.carbs },
                    { nutrientNumber: "204", value: food.fat },
                    { nutrientNumber: "291", value: food.fiber },
                    { nutrientNumber: "269", value: food.sugar },
                  ],
                };
                return (
                <div
                  key={food.id}
                  title="Click to compare with another item"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => {
                    if (pinnedFood?.id === food.id) {
                      setPinnedFood(null);
                      setHoveredFood(null);
                    } else {
                      setPinnedFood(normalizedFood);
                    }
                  }}
                  onMouseEnter={(e) => {
                    if (isMobile) return;
                    if (e.target.closest("input, button")) return;
                    setHoveredFood(normalizedFood);
                    setHoveredLibraryId(food.id);
                  }}
                  onMouseLeave={() => { if (isMobile) return; setHoveredFood(null); setHoveredLibraryId(null); }}
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "9px 10px",
                    borderRadius: 8,
                    marginBottom: 6,
                    background: hoveredLibraryId === food.id ? "#fff0e6" : "#fafafa",
                    border: `1px solid ${hoveredLibraryId === food.id ? "#ff8c42" : "#f0f0f0"}`,
                    cursor: "pointer",
                    transition: "background 0.15s, border-color 0.15s",
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>
                      {food.name}
                    </span>
                    <span
                      style={{ fontSize: 12, color: "#aaa", marginLeft: 10 }}
                    >
                      {food.calories} kcal
                      {food.protein > 0 && ` · ${food.protein}g protein`}
                      {food.carbs > 0 && ` · ${food.carbs}g carbs`}
                      {food.fat > 0 && ` · ${food.fat}g fat`}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      flexShrink: 0,
                      alignItems: "center",
                    }}
                  >
                    {food.serving_amount && food.serving_unit !== "×" ? (
                      <div style={{ display: "flex" }}>
                        <input
                          type="number"
                          min="0"
                          value={libraryAmounts[food.name] ?? food.serving_amount}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) =>
                            setLibraryAmounts((prev) => ({
                              ...prev,
                              [food.name]: e.target.value,
                            }))
                          }
                          style={{
                            ...inputStyle(),
                            width: 60,
                            borderRadius: "6px 0 0 6px",
                            borderRight: "none",
                            padding: "4px 6px",
                            fontSize: 12,
                          }}
                        />
                        <span
                          style={{
                            border: "1px solid #e0e0e0",
                            borderLeft: "none",
                            borderRadius: "0 6px 6px 0",
                            padding: "4px 7px",
                            fontSize: 12,
                            color: "#888",
                            background: "#fafafa",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          {food.serving_unit || "g"}
                        </span>
                      </div>
                    ) : (
                      <div style={{ display: "flex" }}>
                        <span
                          style={{
                            border: "1px solid #e0e0e0",
                            borderRadius: "6px 0 0 6px",
                            padding: "4px 7px",
                            fontSize: 12,
                            color: "#888",
                            background: "#fafafa",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          ×
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={libraryAmounts[food.name] ?? 1}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) =>
                            setLibraryAmounts((prev) => ({
                              ...prev,
                              [food.name]: e.target.value,
                            }))
                          }
                          style={{
                            ...inputStyle(),
                            width: 52,
                            borderRadius: "0 6px 6px 0",
                            borderLeft: "none",
                            padding: "4px 6px",
                            fontSize: 12,
                          }}
                        />
                      </div>
                    )}
                    <button
                      onClick={() => handleAddFromLibrary(food)}
                      style={{
                        background: "#ff8c42",
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        padding: "5px 12px",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      + Add
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm("Remove from My Food Library?"))
                          handleDeleteSaved(food.id);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#ccc",
                        fontSize: 16,
                        lineHeight: 1,
                        padding: "4px 6px",
                      }}
                      title="Remove from My Food Library"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
        )}
        {!isMobile && compareFood ? (
          <NutrientCompare
            foodA={compareFood}
            onClose={() => setCompareFood(null)}
            libraryFoods={savedFoods.map((f) => ({
              id: f.id,
              description: f.name,
              servingSize: f.serving_amount,
              servingSizeUnit: f.serving_unit,
              foodNutrients: [
                { nutrientNumber: "208", value: f.calories },
                { nutrientNumber: "203", value: f.protein },
                { nutrientNumber: "205", value: f.carbs },
                { nutrientNumber: "204", value: f.fat },
                { nutrientNumber: "291", value: f.fiber },
                { nutrientNumber: "269", value: f.sugar },
              ],
            }))}
          />
        ) : !isMobile && pinnedFood ? (
          <UsdaNutrientCard
            food={pinnedFood}
            onClose={() => setPinnedFood(null)}
            onCompare={() => { setCompareFood(pinnedFood); setPinnedFood(null); }}
          />
        ) : !isMobile && hoveredFood ? (
          <UsdaNutrientCard food={hoveredFood} />
        ) : null}
      </div>

      {/* Mobile bottom sheet for pinned food */}
      {isMobile && pinnedFood && (
        <div
          onMouseDown={() => { setPinnedFood(null); setHoveredFood(null); }}
          style={{
            position: "fixed", inset: 0, zIndex: 400,
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "flex-end",
          }}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              background: "#fff",
              borderRadius: "18px 18px 0 0",
              padding: "20px 20px 32px",
              maxHeight: "80vh",
              overflowY: "auto",
              boxShadow: "0 -4px 24px rgba(0,0,0,0.15)",
            }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 99, background: "#e0e0e0", margin: "0 auto 18px" }} />
            <UsdaNutrientCard
              food={pinnedFood}
              onClose={() => { setPinnedFood(null); setHoveredFood(null); }}
              onCompare={() => { setCompareFood(pinnedFood); setPinnedFood(null); }}
              style={{ position: "static", boxShadow: "none", padding: 0, minWidth: 0 }}
            />
          </div>
        </div>
      )}

      {/* Mobile bottom sheet for compare */}
      {isMobile && compareFood && (
        <div
          onMouseDown={() => setCompareFood(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 400,
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "flex-end",
          }}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              background: "#fff",
              borderRadius: "18px 18px 0 0",
              padding: "20px 20px 32px",
              maxHeight: "85vh",
              overflowY: "auto",
              boxShadow: "0 -4px 24px rgba(0,0,0,0.15)",
            }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 99, background: "#e0e0e0", margin: "0 auto 18px" }} />
            <NutrientCompare
              foodA={compareFood}
              onClose={() => setCompareFood(null)}
              libraryFoods={savedFoods.map((f) => ({
                id: f.id,
                description: f.name,
                servingSize: f.serving_amount,
                servingSizeUnit: f.serving_unit,
                foodNutrients: [
                  { nutrientNumber: "208", value: f.calories },
                  { nutrientNumber: "203", value: f.protein },
                  { nutrientNumber: "205", value: f.carbs },
                  { nutrientNumber: "204", value: f.fat },
                  { nutrientNumber: "291", value: f.fiber },
                  { nutrientNumber: "269", value: f.sugar },
                ],
              }))}
              style={{ position: "static", boxShadow: "none", padding: 0, minWidth: 0 }}
            />
          </div>
        </div>
      )}

      {/* Log Table */}
      <div
      id="logTable"
        style={{
          background: "#fff",
          borderRadius: 10,
          boxShadow: "0 4px 14px rgba(0,0,0,0.07)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 20px",
            borderBottom: "1px solid #f0f0f0",
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16 }}>
            Today's Log ({entries.length}{" "}
            {entries.length === 1 ? "item" : "items"})
          </h3>
          {entries.length > 0 && (
            <button
              onClick={handleClearAll}
              style={{
                background: "none",
                border: "1px solid #ddd",
                borderRadius: 6,
                padding: "5px 12px",
                cursor: "pointer",
                fontSize: 12,
                color: "#888",
              }}
            >
              Clear All
            </button>
          )}
        </div>

        {entries.length === 0 ? (
          <p
            style={{
              textAlign: "center",
              color: "#bbb",
              padding: "32px 0",
              margin: 0,
            }}
          >
            No foods logged yet — add your first entry above.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 14,
              }}
            >
              <thead>
                <tr style={{ background: "#fafafa" }}>
                  <th style={thStyle({ textAlign: "left" })}>Food</th>
                  <th style={thStyle({ color: "#aaa" })}>Serving</th>
                  {visibleMacroList.map((m) => (
                    <th key={m.key} style={thStyle()}>
                      {m.label}
                      <br />
                      <span
                        style={{ fontWeight: 400, color: "#aaa", fontSize: 11 }}
                      >
                        {m.unit}
                      </span>
                    </th>
                  ))}
                  <th style={thStyle({ color: "#aaa" })}>Time</th>
                  <th style={thStyle()}></th>
                </tr>
              </thead>
              <tbody>
                {sortedEntries.map((entry, i) => (
                  <tr
                    key={entry.id}
                    style={{
                      borderTop: "1px solid #f0f0f0",
                      background: i % 2 === 0 ? "#fff" : "#fafafa",
                    }}
                  >
                    <td style={{ padding: "10px 16px", fontWeight: 500 }}>
                      {entry.food_name}
                    </td>
                    <td
                      style={{
                        padding: "10px 16px",
                        textAlign: "center",
                        color: "#aaa",
                        fontSize: 12,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {entry.serving_amount
                        ? `${entry.serving_amount} ${entry.serving_unit || ""}`
                        : "—"}
                    </td>
                    {visibleMacroList.map((m) => (
                      <td
                        key={m.key}
                        style={{
                          padding: "10px 16px",
                          textAlign: "center",
                          color: m.color,
                          fontWeight: m.key === "calories" ? 700 : 600,
                        }}
                      >
                        {entry[m.key] > 0 ? (
                          m.key === "calories" ? (
                            entry[m.key]
                          ) : (
                            entry[m.key].toFixed(1)
                          )
                        ) : (
                          <span style={{ color: "#ddd" }}>—</span>
                        )}
                      </td>
                    ))}
                    <td
                      style={{
                        padding: "10px 16px",
                        textAlign: "center",
                        color: "#aaa",
                        fontSize: 12,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {entry.logged_time || "—"}
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        textAlign: "center",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {!savedFoods.some(
                        (f) =>
                          f.name.toLowerCase() ===
                          entry.food_name.toLowerCase(),
                      ) ? (
                        <button
                          onClick={() => handleSaveEntryToMyFoods(entry)}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "#aaa",
                            fontSize: 18,
                            lineHeight: 1,
                            padding: 4,
                          }}
                          title="Save to My Food Library"
                        >
                          ☆
                        </button>
                      ) : (
                        <span style={{ display: "inline-block", width: 26 }} />
                      )}
                      <button
                        onClick={() => handleDelete(entry.id)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#ccc",
                          fontSize: 16,
                          lineHeight: 1,
                          padding: 4,
                        }}
                        title="Remove"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr
                  style={{ borderTop: "2px solid #eee", background: "#fff8f3" }}
                >
                  <td
                    style={{
                      padding: "10px 16px",
                      fontWeight: 700,
                      color: "#555",
                    }}
                  >
                    Total
                  </td>
                  <td />
                  {visibleMacroList.map((m) => (
                    <td
                      key={m.key}
                      style={{
                        padding: "10px 16px",
                        textAlign: "center",
                        fontWeight: 700,
                        color: m.color,
                      }}
                    >
                      {m.key === "calories"
                        ? totals[m.key].toFixed(0)
                        : totals[m.key].toFixed(1)}
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

function parseLoggedTime(str) {
  if (!str) return 0;
  const [time, period] = str.split(" ");
  const [h, m] = time.split(":").map(Number);
  return ((h % 12) + (period === "PM" ? 12 : 0)) * 60 + m;
}

function inputStyle(extra = {}) {
  return {
    padding: "9px 12px",
    border: "1px solid #e0e0e0",
    borderRadius: 8,
    fontSize: 14,
    outline: "none",
    background: "#fafafa",
    minWidth: 0,
    ...extra,
  };
}

function thStyle(extra = {}) {
  return {
    padding: "10px 16px",
    fontWeight: 600,
    fontSize: 13,
    color: "#555",
    textAlign: "center",
    whiteSpace: "nowrap",
    ...extra,
  };
}
