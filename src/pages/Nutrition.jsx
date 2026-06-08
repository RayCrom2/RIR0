import { useState, useEffect, useRef } from "react";
import { LuCalendar, LuScanLine } from "react-icons/lu";
import { MdEdit, MdKeyboardArrowUp, MdKeyboardArrowDown, MdDeleteOutline } from "react-icons/md";
import BarcodeScanner from "../components/BarcodeScanner";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import UsdaNutrientCard from "../components/UsdaNutrientCard";
import NutrientCompare from "../components/NutrientCompare";
import NutritionCalendar from "../components/NutritionCalendar";

export const monthAbbr = new Date()
  .toLocaleString("default", { month: "short" })
  .toUpperCase();

const VISIBLE_KEY = "nutrition_visible_macros";
const GUEST_LOG_KEY = "rir0_guest_logs";
const GUEST_GOALS_KEY = "rir0_guest_goals";

function loadGuestEntries() {
  try {
    const raw = localStorage.getItem(GUEST_LOG_KEY);
    if (!raw) return [];
    const { date, entries } = JSON.parse(raw);
    if (date !== todayStr()) { localStorage.removeItem(GUEST_LOG_KEY); return []; }
    return entries || [];
  } catch { return []; }
}

function saveGuestEntries(entries) {
  localStorage.setItem(GUEST_LOG_KEY, JSON.stringify({ date: todayStr(), entries }));
}

function clearGuestEntries() {
  localStorage.removeItem(GUEST_LOG_KEY);
}

const GUEST_PLAN_KEY = "rir0_guest_plan";
function loadGuestPlan() {
  try {
    const raw = localStorage.getItem(GUEST_PLAN_KEY);
    if (!raw) return [];
    const { date, items } = JSON.parse(raw);
    if (date !== todayStr()) { localStorage.removeItem(GUEST_PLAN_KEY); return []; }
    return items || [];
  } catch { return []; }
}
function saveGuestPlan(items) {
  localStorage.setItem(GUEST_PLAN_KEY, JSON.stringify({ date: todayStr(), items }));
}

const SERVING_UNITS = ["g", "oz", "fl oz", "ml", "lb", "cup", "tbsp", "tsp"];
const UNIT_TO_G  = { g: 1, oz: 28.3495, lb: 453.592, kg: 1000 };
const UNIT_TO_ML = { ml: 1, "fl oz": 29.5735, l: 1000 };
const unitFactor = (u) => UNIT_TO_G[u] ?? UNIT_TO_ML[u] ?? null;
const LAST_UNIT_KEY = "rir0_last_serving_unit";
const getLastUnit = () => localStorage.getItem(LAST_UNIT_KEY) || "g";

const WEIGH_FREQ_OPTIONS = [
  { value: "daily",    days: 1  },
  { value: "3x_week", days: 3  },
  { value: "weekly",  days: 7  },
  { value: "biweekly",days: 14 },
];
function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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
  { key: "calories", minKey: "calories_min", dirKey: "calories_dir", label: "Calories", unit: "kcal", color: "#ff8c42", defaultDir: "below" },
  { key: "protein",  minKey: "protein_min",  dirKey: "protein_dir",  label: "Protein",  unit: "g",    color: "#4f8ef7", defaultDir: "above" },
  { key: "carbs",    minKey: "carbs_min",    dirKey: "carbs_dir",    label: "Carbs",    unit: "g",    color: "#f7c948", defaultDir: "below" },
  { key: "fat",      minKey: "fat_min",      dirKey: "fat_dir",      label: "Fat",      unit: "g",    color: "#e05c5c", defaultDir: "below" },
  { key: "fiber",    minKey: "fiber_min",    dirKey: "fiber_dir",    label: "Fiber",    unit: "g",    color: "#5cb85c", defaultDir: "above" },
  { key: "sugar",    minKey: "sugar_min",    dirKey: "sugar_dir",    label: "Sugar",    unit: "g",    color: "#c87dd4", defaultDir: "below" },
];

const DEFAULT_GOALS = {
  calories: 2000, protein: 150, fat: 65, carbs: 250, fiber: 25, sugar: 50,
  calories_dir: "below", protein_dir: "above", carbs_dir: "below",
  fat_dir: "below", fiber_dir: "above", sugar_dir: "below",
};

function checkGoalsMet(totals, goals) {
  function check(m) {
    const target = goals[m.key];
    const min = goals[m.minKey];
    if (!target && !min) return true; // null or 0 = not tracked
    const dir = goals[m.dirKey] ?? m.defaultDir;
    const val = totals[m.key];
    if (min != null) return val >= min && val <= (target ?? Infinity);
    return dir === "above" ? val >= target : val <= target;
  }
  return MACROS.every(check);
}

async function upsertDailyStatus(date, dayEntries, currentGoals, userId) {
  const totals = MACROS.reduce((acc, m) => {
    acc[m.key] = dayEntries.reduce((s, e) => s + (e[m.key] || 0), 0);
    return acc;
  }, {});
  const met = checkGoalsMet(totals, currentGoals);
  const snapshot = MACROS.reduce((acc, m) => {
    acc[m.key]       = currentGoals[m.key]    ?? null;
    acc[m.minKey]    = currentGoals[m.minKey] ?? null;
    acc[m.dirKey]    = currentGoals[m.dirKey] ?? m.defaultDir;
    return acc;
  }, {});
  await supabase.from("daily_goal_status").upsert(
    { user_id: userId, date, met, goals_snapshot: snapshot },
    { onConflict: "user_id,date" }
  );
}

function dateStr(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayStr() {
  return dateStr(0);
}

function fmtServing(amount, unit) {
  if (!amount) return unit === "×" || !unit ? "1 serving" : "—";
  if (unit === "×") return `${amount} ${amount === 1 ? "serving" : "servings"}`;
  return `${amount} ${unit || ""}`.trim();
}
function tomorrowStr() {
  return dateStr(1);
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
    fontSize: 16,
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

export default function Nutrition() {
  const { user, requireAuth, loading } = useAuth();
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState(() => ({ ...EMPTY_FORM, serving_unit: getLastUnit() }));
  const [savedFoods, setSavedFoods] = useState([]);
  const [myFoodsOpen, setMyFoodsOpen] = useState(true);
  const [myFoodsSearch, setMyFoodsSearch] = useState("");
  const [myFoodsSort, setMyFoodsSort] = useState("name_asc");
  const [libraryAmounts, setLibraryAmounts] = useState({});
  const [libraryUnits, setLibraryUnits] = useState({});
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
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [usdaResults, setUsdaResults] = useState([]);
  const [usdaLoading, setUsdaLoading] = useState(false);
  const [usdaOpen, setUsdaOpen] = useState(false);
  const [hoveredFood, setHoveredFood] = useState(null);
  const [hoveredLibraryId, setHoveredLibraryId] = useState(null);
  const [pinnedFood, setPinnedFood] = useState(null);
  const [pinnedLibraryFood, setPinnedLibraryFood] = useState(null);
  const [editingLibraryFood, setEditingLibraryFood] = useState(null);
  const [editingPlanItem, setEditingPlanItem] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [compareFood, setCompareFood] = useState(null);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 767px)").matches);
  const [selectedUsdaFood, setSelectedUsdaFood] = useState(null);
  const [servingInput, setServingInput] = useState("");
  const [toast, setToast] = useState({ visible: false, color: "#22c55e", message: "" });
  const [scannerOpen, setScannerOpen] = useState(false);
  const [isFromBarcode, setIsFromBarcode] = useState(false);
  const [barcodeUnit, setBarcodeUnit] = useState("g");
  const [logEntryMenu, setLogEntryMenu] = useState(null);
  const [expandedLogIds, setExpandedLogIds] = useState(new Set());
  const [planMode, setPlanMode] = useState(false);
  const [plannedEntries, setPlannedEntries] = useState([]);
  const [planExitOpen, setPlanExitOpen] = useState(false);
  const [dayPlanItems, setDayPlanItems] = useState([]);
  const [entriesLoaded, setEntriesLoaded] = useState(false);
  const [entriesError, setEntriesError] = useState(false);
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const [libraryError, setLibraryError] = useState(false);
  const [weightDismissed, setWeightDismissed] = useState(() => localStorage.getItem("rir0_weight_dismissed") === todayStr());
  const [weightInput, setWeightInput] = useState("");
  const [guestGoalsOpen, setGuestGoalsOpen] = useState(false);
  const [guestGoalsForm, setGuestGoalsForm] = useState({});
  const WEIGHT_DISMISS_KEY = "rir0_weight_dismissed";
  const toastTimer = useRef(null);
  const menuRef = useRef(null);
  const usdaRef = useRef(null);
  const libraryRef = useRef(null);
  const pinnedSheetRef = useRef(null);
  const pinnedDragStart = useRef(null);

  function showToast(message, color = "#22c55e") {
    clearTimeout(toastTimer.current);
    setToast({ visible: true, color, message });
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2500);
  }

  function openGuestGoals() {
    setGuestGoalsForm({ ...goals });
    setGuestGoalsOpen(true);
  }
  function saveGuestGoals() {
    const updated = { ...DEFAULT_GOALS, ...guestGoalsForm };
    localStorage.setItem(GUEST_GOALS_KEY, JSON.stringify(guestGoalsForm));
    setGoals(updated);
    setGuestGoalsOpen(false);
  }
  const usdaDebounce = useRef(null);
  const containerRef = useRef(null);

  const visibleMacroList = MACROS.filter((m) => visibleMacros.has(m.key));

  const usdaScale = (() => {
    if (!selectedUsdaFood) return 1;
    if (!selectedUsdaFood.servingSize) return Number(servingInput) || 1;
    if (isFromBarcode && unitFactor(barcodeUnit) != null) {
      const origFactor = unitFactor((selectedUsdaFood.servingSizeUnit || "g").toLowerCase()) ?? 1;
      return (Number(servingInput) || 0) * unitFactor(barcodeUnit) / (selectedUsdaFood.servingSize * origFactor);
    }
    return (Number(servingInput) || 0) / selectedUsdaFood.servingSize;
  })();

  const filteredSortedFoods = (() => {
    const q = myFoodsSearch.trim().toLowerCase();
    if (q) {
      const matches = savedFoods.filter((f) => f.name.toLowerCase().includes(q));
      return matches.sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(q);
        const bStarts = b.name.toLowerCase().startsWith(q);
        if (aStarts !== bStarts) return aStarts ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    }
    let list = [...savedFoods];
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
      setEntries(loadGuestEntries());
      setDayPlanItems(loadGuestPlan());
      setEntriesLoaded(true);
      return;
    }
    // Sync any guest entries to DB before loading
    const guestEntries = loadGuestEntries();
    clearGuestEntries();
    const syncPromises = guestEntries.map(({ id: _id, ...rest }) =>
      supabase.from("nutrition_logs").insert({ ...rest, user_id: user.id, is_planned: false })
    );
    Promise.all(syncPromises).then(() => {
      supabase
        .from("nutrition_logs")
        .select("*")
        .eq("user_id", user.id)
        .gte("logged_at", todayStr())
        .lt("logged_at", tomorrowStr())
        .order("logged_time")
        .then(({ data, error }) => {
          if (error) {
            console.error("Unable to fetch nutrition logs:", error);
            setEntriesError(true);
          } else {
            const all = data || [];
            setEntries(all.filter(e => !e.is_planned));
            setDayPlanItems(all.filter(e => e.is_planned));
          }
          setEntriesLoaded(true);
        });
    }).catch((err) => {
      console.error("Unable to fetch nutrition logs:", err);
      setEntriesError(true);
      setEntriesLoaded(true);
    });
  }, [user, loading]);


  useEffect(() => {
    if (!user) {
      setSavedFoods([]);
      setLibraryLoaded(true);
      return;
    }
    supabase
      .from("custom_foods")
      .select("*")
      .eq("user_id", user.id)
      .order("name")
      .then(({ data, error }) => {
        if (error) {
          console.error("Unable to fetch food library:", error);
          setLibraryError(true);
        } else {
          setSavedFoods(data || []);
        }
        setLibraryLoaded(true);
      });
  }, [user]);

  useEffect(() => {
    if (planExitOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [planExitOpen]);

  // ── load nutrition goals from DB (or localStorage for guests)
  useEffect(() => {
    if (!user) {
      try {
        const saved = JSON.parse(localStorage.getItem(GUEST_GOALS_KEY));
        setGoals(saved ? { ...DEFAULT_GOALS, ...saved } : DEFAULT_GOALS);
      } catch {
        setGoals(DEFAULT_GOALS);
      }
      return;
    }
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
        if (Array.isArray(data.nutrition_visible_macros)) {
          setVisibleMacros(new Set(data.nutrition_visible_macros));
          localStorage.setItem(VISIBLE_KEY, JSON.stringify(data.nutrition_visible_macros));
        }
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
    if (e.target.name === "serving_unit") {
      localStorage.setItem(LAST_UNIT_KEY, e.target.value);
    }
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

  async function handleBarcodeScan(barcode) {
    setScannerOpen(false);
    showToast("Looking up product…", "#888");
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      const json = await res.json();
      if (json.status !== 1 || !json.product) {
        showToast("Product not found — try searching manually", "#e05c5c");
        return;
      }
      const p = json.product;
      const n = p.nutriments || {};
      const qty = Number(p.serving_quantity) || 0;
      const suffix = qty > 0 ? "_serving" : "_100g";
      const servingUnit = (() => {
        if (p.serving_quantity_unit) return p.serving_quantity_unit.toLowerCase();
        if (!p.serving_size) return "g";
        const pairs = [...p.serving_size.matchAll(/([\d.]+)\s*([a-zA-Z]+)/g)];
        // Prefer the pair whose number matches serving_quantity (e.g. "25 g" in "1 tbsp (25 g)")
        const match = pairs.find(([, num]) => qty > 0 && Math.abs(Number(num) - qty) < 0.5);
        return (match ? match[2] : pairs[0]?.[2] || "g").toLowerCase();
      })();
      let displaySize = qty > 0 ? qty : 100;
      let displayUnit = qty > 0 ? servingUnit : "g";
      // Open Food Facts often converts fl oz → g (1 fl oz = 28.3495g).
      // Detect that by checking if the gram value is within 2% of a whole fl oz count,
      // and snap back so beverages show a clean unit instead of e.g. "340.194 g".
      if (displayUnit === "g" && displaySize > 0) {
        const flOzEquiv = displaySize / 28.3495;
        if (flOzEquiv >= 0.5 && Math.abs(flOzEquiv - Math.round(flOzEquiv)) < 0.02) {
          displaySize = Math.round(flOzEquiv);
          displayUnit = "fl oz";
        } else {
          displaySize = Math.round(displaySize * 10) / 10;
        }
      }
      const food = {
        description: p.product_name || p.abbreviated_product_name || "Unknown product",
        brandOwner: p.brands || null,
        servingSize: displaySize,
        servingSizeUnit: displayUnit,
        foodNutrients: [
          { nutrientNumber: "208", value: n[`energy-kcal${suffix}`] ?? n["energy-kcal_100g"] ?? 0 },
          { nutrientNumber: "203", value: n[`proteins${suffix}`] ?? n["proteins_100g"] ?? 0 },
          { nutrientNumber: "204", value: n[`fat${suffix}`] ?? n["fat_100g"] ?? 0 },
          { nutrientNumber: "205", value: n[`carbohydrates${suffix}`] ?? n["carbohydrates_100g"] ?? 0 },
          { nutrientNumber: "291", value: n[`fiber${suffix}`] ?? n["fiber_100g"] ?? 0 },
          { nutrientNumber: "269", value: n[`sugars${suffix}`] ?? n["sugars_100g"] ?? 0 },
        ],
      };
      const origUnit = food.servingSizeUnit.toLowerCase();
      setSelectedUsdaFood(food);
      setServingInput(String(food.servingSize));
      setIsFromBarcode(true);
      setBarcodeUnit(unitFactor(origUnit) != null ? origUnit : "g");
    } catch {
      showToast("Failed to look up product", "#e05c5c");
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
    setIsFromBarcode(false);
    setUsdaOpen(false);
    setUsdaResults([]);
    setHoveredFood(null);
  }

  function handleAddFromUsda() {
    if (!selectedUsdaFood) return;
    showToast("Logging food...", "#e0ba21");
    let scale, unit;
    if (isFromBarcode && unitFactor(barcodeUnit) != null && selectedUsdaFood.servingSize) {
      const origFactor = unitFactor((selectedUsdaFood.servingSizeUnit || "g").toLowerCase()) ?? 1;
      scale = (Number(servingInput) || 0) * unitFactor(barcodeUnit) / (selectedUsdaFood.servingSize * origFactor);
      unit = barcodeUnit;
    } else {
      scale = selectedUsdaFood.servingSize
        ? (Number(servingInput) || 0) / selectedUsdaFood.servingSize
        : (Number(servingInput) || 1);
      const rawUnit = (selectedUsdaFood.servingSizeUnit || "G").toUpperCase();
      unit = USDA_UNIT_MAP[rawUnit] || "g";
    }
    const get = (num) => {
      const n = selectedUsdaFood.foodNutrients?.find((n) => n.nutrientNumber === num);
      return n ? Math.round(n.value * scale * 10) / 10 : 0;
    };

    if (!user) {
      const now = new Date();
      const entry = {
        id: "guest_" + Date.now(),
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
      const next = [...entries, entry];
      setEntries(next);
      saveGuestEntries(next);
      showToast("Logged! Sign in to save permanently");
      setSelectedUsdaFood(null);
      setServingInput("");
      return;
    }

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
      if (data) {
        const next = [...entries, data];
        setEntries(next);
        upsertDailyStatus(todayStr(), next, goals, u.id);
        showToast("Food logged successfully");
      }
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
    if (planMode) {
      const now = new Date();
      const entry = {
        id: "plan_" + Date.now(),
        planned: true,
        logged_at: todayStr(),
        logged_time: now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
        food_name: form.name.trim(),
        calories: Number(form.calories) || 0,
        protein: Number(form.protein) || 0,
        fat: Number(form.fat) || 0,
        carbs: Number(form.carbs) || 0,
        fiber: Number(form.fiber) || 0,
        sugar: Number(form.sugar) || 0,
        serving_amount: form.serving_amount !== "" ? Number(form.serving_amount) : null,
        serving_unit: form.serving_unit || "g",
      };
      setPlannedEntries((prev) => [...prev, entry]);
      setForm({ ...EMPTY_FORM, serving_unit: getLastUnit() });
      showToast("Added to plan", "#4f8ef7");
      return;
    }

    showToast("Logging food...", "#e0ba21");

    if (!user) {
      const now = new Date();
      const entry = {
        id: "guest_" + Date.now(),
        logged_at: todayStr(),
        logged_time: now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
        food_name: form.name.trim(),
        calories: Number(form.calories) || 0,
        protein: Number(form.protein) || 0,
        fat: Number(form.fat) || 0,
        carbs: Number(form.carbs) || 0,
        fiber: Number(form.fiber) || 0,
        sugar: Number(form.sugar) || 0,
        serving_amount: form.serving_amount !== "" ? Number(form.serving_amount) : null,
        serving_unit: form.serving_unit || "g",
      };
      const next = [...entries, entry];
      setEntries(next);
      saveGuestEntries(next);
      showToast("Logged! Sign in to save permanently");
      setForm({ ...EMPTY_FORM, serving_unit: getLastUnit() });
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
      if (data) {
        const next = [...entries, data];
        setEntries(next);
        upsertDailyStatus(todayStr(), next, goals, u.id);
        showToast("Food logged successfully");
      }
      setForm({ ...EMPTY_FORM, serving_unit: getLastUnit() });
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
          serving_weight_g: (() => {
            const g = UNIT_TO_G[form.serving_unit];
            return g && form.serving_amount !== "" ? Number(form.serving_amount) * g : null;
          })(),
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
    if (String(id).startsWith("plan_")) {
      setPlannedEntries((prev) => prev.filter((e) => e.id !== id));
      return;
    }
    if (String(id).startsWith("guest_")) {
      const next = entries.filter((e) => e.id !== id);
      setEntries(next);
      saveGuestEntries(next);
      showToast("Food removed", "#ef4444");
      return;
    }
    await supabase.from("nutrition_logs").delete().eq("id", id);
    const next = entries.filter((e) => e.id !== id);
    setEntries(next);
    if (user) upsertDailyStatus(todayStr(), next, goals, user.id);
    showToast("Food removed", "#ef4444");
  }

  async function handleClearAll() {
    if (!window.confirm("Clear all entries for today?")) return;
    if (!user) {
      clearGuestEntries();
      setEntries([]);
      return;
    }
    await supabase
      .from("nutrition_logs")
      .delete()
      .eq("user_id", user.id)
      .gte("logged_at", todayStr())
      .lt("logged_at", tomorrowStr());
    setEntries([]);
    upsertDailyStatus(todayStr(), [], goals, user.id);
  }

  function handleAddFromLibrary(food) {
    if (planMode) {
      const customAmount = Number(libraryAmounts[food.name] ?? food.serving_amount ?? 1);
      const selectedUnit = libraryUnits[food.name] ?? food.serving_unit;
      let scale;
      if (food.serving_weight_g && UNIT_TO_G[selectedUnit]) {
        scale = (customAmount * UNIT_TO_G[selectedUnit]) / food.serving_weight_g;
      } else {
        const baseAmount = Number(food.serving_amount);
        scale = baseAmount > 0 ? (customAmount > 0 ? customAmount / baseAmount : 1) : customAmount;
      }
      const now = new Date();
      const entry = {
        id: "plan_" + Date.now(),
        planned: true,
        logged_at: todayStr(),
        logged_time: now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
        food_name: food.name,
        calories: Math.round(food.calories * scale),
        protein: Math.round(food.protein * scale * 10) / 10,
        fat: Math.round(food.fat * scale * 10) / 10,
        carbs: Math.round(food.carbs * scale * 10) / 10,
        fiber: Math.round(food.fiber * scale * 10) / 10,
        sugar: Math.round(food.sugar * scale * 10) / 10,
        serving_amount: customAmount || food.serving_amount,
        serving_unit: (!food.serving_amount || food.serving_unit === "×") ? "×" : selectedUnit,
      };
      setPlannedEntries((prev) => [...prev, entry]);
      setLibraryAmounts((prev) => { const n = { ...prev }; delete n[food.name]; return n; });
      setLibraryUnits((prev) => { const n = { ...prev }; delete n[food.name]; return n; });
      showToast("Added to plan", "#4f8ef7");
      return;
    }

    showToast("Logging food...", "#e0ba21");

    requireAuth(async () => {
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      const customAmount = Number(
        libraryAmounts[food.name] ?? food.serving_amount ?? 1,
      );
      const selectedUnit = libraryUnits[food.name] ?? food.serving_unit;
      let scale;
      if (food.serving_weight_g && UNIT_TO_G[selectedUnit]) {
        scale = (customAmount * UNIT_TO_G[selectedUnit]) / food.serving_weight_g;
      } else {
        const baseAmount = Number(food.serving_amount);
        scale = baseAmount > 0 ? (customAmount > 0 ? customAmount / baseAmount : 1) : customAmount;
      }
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
        serving_unit: (!food.serving_amount || food.serving_unit === "×") ? "×" : selectedUnit,
      };
      const { data } = await supabase
        .from("nutrition_logs")
        .insert(entry)
        .select()
        .single();
      if (data) {
        const nextEntries = [...entries, data];
        setEntries(nextEntries);
        upsertDailyStatus(todayStr(), nextEntries, goals, u.id);
        showToast("Food logged successfully");
      }
      setLibraryAmounts((prev) => {
        const next = { ...prev };
        delete next[food.name];
        return next;
      });
      setLibraryUnits((prev) => {
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
        serving_weight_g: (() => {
          const g = UNIT_TO_G[entry.serving_unit];
          return g && entry.serving_amount ? entry.serving_amount * g : null;
        })(),
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

  async function handleLogWeight() {
    if (!user || !weightInput) return;
    const prefUnit = goals.preferred_weight_unit || "kg";
    const kg = prefUnit === "lbs"
      ? Math.round(Number(weightInput) / 2.20462 * 10) / 10
      : Number(weightInput);
    const freqDays = WEIGH_FREQ_OPTIONS.find(f => f.value === (goals.weigh_in_frequency || "weekly"))?.days ?? 7;
    const nextWeighInDate = addDays(todayStr(), freqDays);
    await Promise.all([
      supabase.from("weight_logs").upsert(
        { user_id: user.id, date: todayStr(), weight_kg: kg },
        { onConflict: "user_id,date" }
      ),
      supabase.from("nutrition_goals").upsert(
        { user_id: user.id, weight_kg: kg, next_weigh_in_date: nextWeighInDate },
        { onConflict: "user_id" }
      ),
    ]);
    setGoals(g => ({ ...g, weight_kg: kg, next_weigh_in_date: nextWeighInDate }));
    setWeightInput("");
  }

  function openEditFromPinned() {
    if (!pinnedLibraryFood) return;
    setEditForm({
      name: pinnedLibraryFood.name || "",
      calories: String(pinnedLibraryFood.calories ?? ""),
      protein: String(pinnedLibraryFood.protein ?? ""),
      carbs: String(pinnedLibraryFood.carbs ?? ""),
      fat: String(pinnedLibraryFood.fat ?? ""),
      fiber: String(pinnedLibraryFood.fiber ?? ""),
      sugar: String(pinnedLibraryFood.sugar ?? ""),
      serving_amount: String(pinnedLibraryFood.serving_amount ?? ""),
      serving_unit: pinnedLibraryFood.serving_unit || "g",
    });
    setEditingLibraryFood(pinnedLibraryFood);
    setPinnedFood(null);
    setPinnedLibraryFood(null);
  }

  async function handleEditSave() {
    if (!editingLibraryFood || !user) return;
    const updated = {
      name: editForm.name.trim(),
      calories: Number(editForm.calories) || 0,
      protein: Number(editForm.protein) || 0,
      carbs: Number(editForm.carbs) || 0,
      fat: Number(editForm.fat) || 0,
      fiber: Number(editForm.fiber) || 0,
      sugar: Number(editForm.sugar) || 0,
      serving_amount: editForm.serving_amount ? Number(editForm.serving_amount) : null,
      serving_unit: editForm.serving_unit || "g",
    };
    await supabase.from("custom_foods").update(updated).eq("id", editingLibraryFood.id);
    setSavedFoods((prev) => prev.map((f) => f.id === editingLibraryFood.id ? { ...f, ...updated } : f));
    setEditingLibraryFood(null);
  }

  function planEditScale() {
    if (!editingPlanItem) return 1;
    const origAmount = Number(editingPlanItem.serving_amount) || 1;
    const newAmount = Number(editForm.serving_amount) || 0;
    const origUnit = editingPlanItem.serving_unit || "g";
    const newUnit = editForm.serving_unit || "g";
    if (UNIT_TO_G[origUnit] && UNIT_TO_G[newUnit]) {
      return (newAmount * UNIT_TO_G[newUnit]) / (origAmount * UNIT_TO_G[origUnit]);
    }
    return origAmount > 0 ? newAmount / origAmount : newAmount;
  }

  async function handleEditPlanItemSave() {
    if (!editingPlanItem) return;
    const scale = planEditScale();
    const updated = {
      food_name: editingPlanItem.food_name,
      calories: Math.round(editingPlanItem.calories * scale),
      protein: Math.round(editingPlanItem.protein * scale * 10) / 10,
      carbs: Math.round(editingPlanItem.carbs * scale * 10) / 10,
      fat: Math.round(editingPlanItem.fat * scale * 10) / 10,
      fiber: Math.round(editingPlanItem.fiber * scale * 10) / 10,
      sugar: Math.round(editingPlanItem.sugar * scale * 10) / 10,
      serving_amount: Number(editForm.serving_amount) || null,
      serving_unit: editForm.serving_unit || "g",
    };
    setDayPlanItems(prev => prev.map(i => i.id === editingPlanItem.id ? { ...i, ...updated } : i));
    if (user) {
      await supabase.from("nutrition_logs").update(updated).eq("id", editingPlanItem.id);
    } else {
      saveGuestPlan(dayPlanItems.map(i => i.id === editingPlanItem.id ? { ...i, ...updated } : i));
    }
    setEditingPlanItem(null);
  }

  async function markPlanItemComplete(item) {
    showToast("Logging…", "#888");
    const now = new Date();
    const loggedTime = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    const next = dayPlanItems.filter(i => i.id !== item.id);
    setDayPlanItems(next);
    if (user) {
      const { data } = await supabase.from("nutrition_logs")
        .update({ is_planned: false, logged_at: todayStr(), logged_time: loggedTime })
        .eq("id", item.id)
        .select()
        .single();
      if (data) {
        const nextEntries = [...entries, data];
        setEntries(nextEntries);
        upsertDailyStatus(todayStr(), nextEntries, goals, user.id);
      }
    } else {
      const nextEntries = [...entries, { ...item, id: "guest_" + Date.now() + Math.random(), logged_time: loggedTime }];
      setEntries(nextEntries);
      saveGuestEntries(nextEntries);
      saveGuestPlan(next);
    }
    showToast("Marked as complete!", "#5cb85c");
  }

  async function editPlanItem(id) {
    const item = dayPlanItems.find(i => i.id === id);
    if (!item) return;
    setEditForm({
      serving_amount: String(item.serving_amount ?? ""),
      serving_unit: item.serving_unit || "g",
    });
    setEditingPlanItem(item);
  }

  async function removePlanItem(id) {
    const next = dayPlanItems.filter(i => i.id !== id);
    setDayPlanItems(next);
    if (user) {
      await supabase.from("nutrition_logs").delete().eq("id", id);
    } else {
      saveGuestPlan(next);
    }
  }

  const sortedEntries = [...entries].sort((a, b) => parseLoggedTime(a.logged_time) - parseLoggedTime(b.logged_time));

  const actualTotals = MACROS.reduce((acc, m) => {
    acc[m.key] = entries.reduce((sum, e) => sum + (e[m.key] || 0), 0);
    return acc;
  }, {});

  const totals = MACROS.reduce((acc, m) => {
    const planned = planMode ? plannedEntries.reduce((sum, e) => sum + (e[m.key] || 0), 0) : 0;
    acc[m.key] = actualTotals[m.key] + planned;
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
        <button className="relative inline-flex items-center justify-center ml-auto cursor-pointer" onClick={() => setCalendarOpen(true)}>
          <LuCalendar size={45} />
          <span className="absolute bottom-[15px] text-[11px] font-bold leading-none">
            {monthAbbr}
          </span>
        </button>
      </div>
      <p style={{ color: "#888", marginBottom: 20, fontSize: 14 }}>
        {today} — entries reset each day
      </p>

      {!user && (
        <div style={{
          background: "#fff8f0",
          border: "1px solid #ffd8a8",
          borderRadius: 8,
          padding: "10px 16px",
          marginBottom: 20,
          fontSize: 13,
          color: "#a05a00",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}>
          <span style={{ flex: 1 }}>
            You're browsing as a guest — food entries are saved locally for today only.
          </span>
          <button
            onClick={() => requireAuth(() => {})}
            style={{ background: "#ff8c42", color: "#fff", border: "none", borderRadius: 6, padding: "5px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600, flexShrink: 0 }}
          >
            Sign in to save
          </button>
        </div>
      )}

      {/* Daily Progress Bars */}
      <div
        id="nutrientBars"
        style={{
          background: "#fff",
          borderRadius: 10,
          padding: "16px 20px",
          boxShadow: "0 4px 14px rgba(0,0,0,0.07)",
          marginBottom: 24,
          border: planMode ? "1.5px solid #93c5fd" : "1.5px solid transparent",
          transition: "border-color 0.2s",
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
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#888",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {planMode && <span style={{ color: "#4f8ef7", marginRight: 6 }}>Planning ·</span>}
              Daily Progress
            </span>
            {!user && (
              <button
                onClick={openGuestGoals}
                style={{ fontSize: 11, color: "#888", background: "#f0f0f0", border: "none", borderRadius: 6, padding: "3px 9px", cursor: "pointer", fontWeight: 600 }}
              >
                Set goals
              </button>
            )}
          </div>
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
        {!entriesLoaded ? (
          visibleMacroList.map((m) => (
            <div key={m.key} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <div className="skeleton-shimmer" style={{ width: 72, height: 13, borderRadius: 4 }} />
                <div className="skeleton-shimmer" style={{ width: 60, height: 13, borderRadius: 4 }} />
              </div>
              <div className="skeleton-shimmer" style={{ height: 8, borderRadius: 99 }} />
            </div>
          ))
        ) : entriesError ? (
          <p style={{ color: "#e05c5c", fontSize: 13, margin: 0, padding: "4px 0" }}>
            Unable to fetch — check your connection and try again.
          </p>
        ) : visibleMacroList.map((m) => {
          const consumed = totals[m.key];
          const rawMax = goals[m.key];
          const minVal = goals[m.minKey] ?? null;
          const isTracked = !!(rawMax || minVal);
          const maxVal = rawMax || 1;
          const pct = isTracked ? Math.min(100, (consumed / maxVal) * 100) : 0;
          const minPct = (isTracked && minVal != null) ? Math.min(100, (minVal / maxVal) * 100) : null;
          const over = isTracked && consumed > maxVal;
          const under = isTracked && minVal != null && consumed < minVal;

          const dir = goals[m.dirKey] ?? m.defaultDir;
          let statusColor;
          if (!isTracked) {
            statusColor = "#aaa";
          } else if (minVal != null) {
            statusColor = over ? "#e05c5c" : under ? "#f0a500" : "#5cb85c";
          } else {
            const met = dir === "above" ? consumed >= maxVal : consumed <= maxVal;
            statusColor = met ? "#5cb85c" : "#e05c5c";
          }

          return (
            <div key={m.key} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5, fontSize: 13 }}>
                <span style={{ fontWeight: 600, color: "#333", display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: m.color, display: "inline-block", flexShrink: 0 }} />
                  {m.label}
                </span>
                <span style={{ color: statusColor, fontWeight: isTracked ? 600 : 400 }}>
                  {m.key === "calories" ? consumed.toFixed(0) : consumed.toFixed(1)}{" "}
                  {isTracked
                    ? `/ ${minVal != null ? `${minVal}–${maxVal}` : maxVal} ${m.unit}`
                    : m.unit}
                </span>
              </div>
              <div style={{ height: 8, background: "#f0f0f0", borderRadius: 99, position: "relative", overflow: "hidden" }}>
                {isTracked && (() => {
                  const actualPct = Math.min(100, (actualTotals[m.key] / maxVal) * 100);
                  const plannedPct = planMode ? Math.min(100 - actualPct, pct - actualPct) : 0;
                  return (
                    <>
                      <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${actualPct}%`, background: m.color, transition: "width 0.3s ease" }} />
                      {plannedPct > 0 && (
                        <div style={{ position: "absolute", left: `${actualPct}%`, top: 0, height: "100%", width: `${plannedPct}%`, background: "#93c5fd", transition: "width 0.3s ease" }} />
                      )}
                    </>
                  );
                })()}
                {minPct != null && (
                  <div style={{ position: "absolute", left: `${minPct}%`, top: -1, bottom: -1, width: 2, background: "rgba(0,0,0,0.25)", borderRadius: 1, zIndex: 1 }} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Daily weigh-in prompt */}
      {user && entriesLoaded && entries.length === 0
        && !weightDismissed
        && (!goals.next_weigh_in_date || todayStr() >= goals.next_weigh_in_date)
        && !goals.hide_weight_prompt && (
        <div style={{ background: "#fff", borderRadius: 10, padding: "16px 20px", boxShadow: "0 4px 14px rgba(0,0,0,0.07)", marginBottom: 24 }}>
          <p style={{ fontWeight: 700, fontSize: 15, margin: "0 0 2px", color: "#333" }}>How much do you weigh today?</p>
          <p style={{ fontSize: 13, color: "#aaa", margin: "0 0 14px" }}>Tracking your weight helps monitor progress over time.</p>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="number"
              step="0.1"
              min="0"
              value={weightInput}
              onChange={e => setWeightInput(e.target.value)}
              placeholder={goals.preferred_weight_unit === "lbs" ? "e.g. 170" : "e.g. 77"}
              style={{ ...inputStyle(), flex: 1 }}
            />
            <span style={{ color: "#888", fontSize: 14, flexShrink: 0 }}>{goals.preferred_weight_unit || "kg"}</span>
            <button
              type="button"
              onClick={handleLogWeight}
              style={{ background: "#ff8c42", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontWeight: 700, cursor: "pointer", fontSize: 14, flexShrink: 0 }}
            >
              Log
            </button>
          </div>
          <div style={{ display: "flex", gap: 20, marginTop: 10 }}>
            <button
              type="button"
              onClick={async () => {
                setWeightDismissed(true);
                localStorage.setItem(WEIGHT_DISMISS_KEY, todayStr());
                if (user) {
                  const nextDate = tomorrowStr();
                  await supabase.from("nutrition_goals").upsert(
                    { user_id: user.id, next_weigh_in_date: nextDate },
                    { onConflict: "user_id" }
                  );
                  setGoals(g => ({ ...g, next_weigh_in_date: nextDate }));
                }
              }}
              style={{ background: "none", border: "none", color: "#bbb", fontSize: 12, cursor: "pointer", padding: 0 }}
            >
              Skip today
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!user) return;
                await supabase.from("nutrition_goals").upsert({ user_id: user.id, hide_weight_prompt: true }, { onConflict: "user_id" });
                setGoals(g => ({ ...g, hide_weight_prompt: true }));
              }}
              style={{ background: "none", border: "none", color: "#bbb", fontSize: 12, cursor: "pointer", padding: 0 }}
            >
              Turn off reminders
            </button>
          </div>
        </div>
      )}

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
                    <div
                      key={food.fdcId}
                      onMouseEnter={() => { if (!isMobile) setHoveredFood(food); }}
                      onMouseLeave={() => { if (!isMobile) setHoveredFood(null); }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        borderBottom: "1px solid #f0f0f0",
                      }}
                    >
                      <button
                        type="button"
                        onMouseDown={() => applyUSDAFood(food)}
                        style={{
                          flex: 1,
                          textAlign: "left",
                          padding: "9px 14px",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: 13,
                          minWidth: 0,
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
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setCompareFood(food);
                          setUsdaOpen(false);
                          setUsdaResults([]);
                          setHoveredFood(null);
                        }}
                        style={{
                          flexShrink: 0,
                          margin: "0 10px",
                          padding: "4px 10px",
                          background: "#667eea",
                          color: "#fff",
                          border: "none",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Compare
                      </button>
                    </div>
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
            onClick={() => {
              if (planMode) {
                if (plannedEntries.length > 0) setPlanExitOpen(true);
                else setPlanMode(false);
              } else {
                setPlanMode(true);
              }
            }}
            style={{
              background: planMode ? "#eff6ff" : "none",
              color: planMode ? "#4f8ef7" : "#888",
              border: planMode ? "1.5px solid #93c5fd" : "1px solid #e0e0e0",
              borderRadius: 8,
              height: 38,
              padding: "0 12px",
              fontSize: 13,
              fontWeight: planMode ? 700 : 500,
              cursor: "pointer",
              flexShrink: 0,
            }}
            title={planMode ? "Exit plan mode" : "Plan your meals"}
          >
            {planMode ? "Planning…" : "Plan"}
          </button>
          {isMobile && (
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              style={{
                background: "none",
                border: "1px solid #e0e0e0",
                borderRadius: 8,
                width: 38,
                height: 38,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                color: "#888",
              }}
              title="Scan barcode"
            >
              <LuScanLine size={20} />
            </button>
          )}
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
            {myFoodsOpen ? <MdKeyboardArrowUp size={20} /> : <MdKeyboardArrowDown size={20} />}
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
                    style={{ width: 70, padding: "5px 8px", border: "1px solid #e0e0e0", borderRadius: "6px 0 0 6px", borderRight: "none", fontSize: 16, outline: "none", background: "#fff" }}
                  />
                  {isFromBarcode && unitFactor((selectedUsdaFood.servingSizeUnit || "g").toLowerCase()) != null ? (
                    <select
                      value={barcodeUnit}
                      onChange={(e) => setBarcodeUnit(e.target.value)}
                      style={{ border: "1px solid #e0e0e0", borderLeft: "none", borderRadius: "0 6px 6px 0", padding: "5px 8px", fontSize: 13, color: "#555", background: "#fafafa", cursor: "pointer", appearance: "none", minWidth: 42 }}
                    >
                      {(UNIT_TO_ML[(selectedUsdaFood.servingSizeUnit || "g").toLowerCase()]
                        ? Object.keys(UNIT_TO_ML)
                        : Object.keys(UNIT_TO_G)
                      ).map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  ) : (
                    <span style={{ border: "1px solid #e0e0e0", borderLeft: "none", borderRadius: "0 6px 6px 0", padding: "5px 8px", fontSize: 13, color: "#888", background: "#fafafa", display: "flex", alignItems: "center" }}>
                      {(selectedUsdaFood.servingSizeUnit || "g").toLowerCase()}
                    </span>
                  )}
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
                    style={{ width: 60, padding: "5px 8px", border: "1px solid #e0e0e0", borderRadius: "0 6px 6px 0", borderLeft: "none", fontSize: 16, outline: "none", background: "#fff" }}
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
                  style={{ border: "none", background: "transparent", outline: "none", fontSize: 16, minWidth: 0, flex: 1 }}
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
                    style={{ border: "none", background: "transparent", outline: "none", fontSize: 16, minWidth: 0, flex: 1 }}
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
          <div ref={libraryRef} style={{ background: "#f0f4ff", borderRadius: 10, marginTop: 14, padding: "14px 16px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#555" }}>
                My Food Library
                <span style={{ fontSize: 12, fontWeight: 400, color: "#aaa", marginLeft: 6 }}>
                  {savedFoods.length} saved
                </span>
              </span>
            </div>
            {!libraryLoaded ? (
              <div style={{ padding: "6px 0 16px" }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="skeleton-shimmer" style={{ height: 44, borderRadius: 8, marginBottom: 8 }} />
                ))}
              </div>
            ) : libraryError ? (
              <p style={{ color: "#e05c5c", fontSize: 13, padding: "12px 0 16px", margin: 0, textAlign: "center" }}>
                Unable to fetch food library — check your connection and try again.
              </p>
            ) : savedFoods.length === 0 ? (
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
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 10, minWidth: 0 }}>
                <input
                  type="text"
                  value={myFoodsSearch}
                  onChange={(e) => setMyFoodsSearch(e.target.value)}
                  placeholder="Search saved foods…"
                  style={{ flex: 1, minWidth: 0, padding: "6px 10px", fontSize: 16, border: "1px solid #c8d8ff", borderRadius: 7, outline: "none", background: "#fff" }}
                />
                <select
                  value={myFoodsSort}
                  onChange={(e) => setMyFoodsSort(e.target.value)}
                  disabled={!!myFoodsSearch.trim()}
                  title={myFoodsSearch.trim() ? "Sort disabled while searching" : undefined}
                  style={{ maxWidth: 130, padding: "6px 8px", fontSize: 16, border: "1px solid #c8d8ff", borderRadius: 7, background: "#fff", cursor: myFoodsSearch.trim() ? "default" : "pointer", outline: "none", color: myFoodsSearch.trim() ? "#bbb" : "#555", opacity: myFoodsSearch.trim() ? 0.5 : 1 }}
                >
                  <option value="name_asc">Name A→Z</option>
                  <option value="name_desc">Name Z→A</option>
                  <option value="protein_cal">Protein / Cal ratio</option>
                  <option value="calories">Highest Calories</option>
                  <option value="protein">Highest Protein</option>
                  <option value="fat">Highest Fat</option>
                  <option value="fiber">Highest Fiber</option>
                  <option value="carbs">Highest Carbs</option>
                  <option value="sugar">Highest Sugar</option>
                </select>
              </div>
            <div style={{ padding: "0 0 16px", maxHeight: 340, overflowY: "auto", overflowX: "hidden" }}>
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
                  onClick={(e) => {
                    if (e.target.closest("input, button, select")) return;
                    if (pinnedFood?.id === food.id) {
                      setPinnedFood(null);
                      setHoveredFood(null);
                      setPinnedLibraryFood(null);
                    } else {
                      setPinnedFood(normalizedFood);
                      setPinnedLibraryFood(food);
                    }
                  }}
                  onMouseEnter={(e) => {
                    if (isMobile) return;
                    if (e.target.closest("input, button, select")) return;
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
                    background: hoveredLibraryId === food.id ? "#dce8ff" : "#fff",
                    border: `1px solid ${hoveredLibraryId === food.id ? "#4f8ef7" : "#d0dcff"}`,
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
                            fontSize: 16,
                          }}
                        />
                        {food.serving_weight_g && UNIT_TO_G[food.serving_unit] ? (
                          <select
                            value={libraryUnits[food.name] ?? food.serving_unit}
                            onChange={(e) => setLibraryUnits((prev) => ({ ...prev, [food.name]: e.target.value }))}
                            style={{
                              border: "1px solid #e0e0e0",
                              borderLeft: "none",
                              borderRadius: "0 6px 6px 0",
                              padding: "4px 6px",
                              fontSize: 12,
                              color: "#555",
                              background: "#fafafa",
                              cursor: "pointer",
                              appearance: "none",
                              minWidth: 38,
                            }}
                          >
                            {Object.keys(UNIT_TO_G).map((u) => <option key={u} value={u}>{u}</option>)}
                          </select>
                        ) : (
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
                        )}
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
                            fontSize: 16,
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
                        lineHeight: 1,
                        padding: "4px 6px",
                        display: "flex",
                        alignItems: "center",
                      }}
                      title="Remove from My Food Library"
                    >
                      <MdDeleteOutline size={18} />
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
            </>
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
            onClose={() => { setPinnedFood(null); setPinnedLibraryFood(null); }}
            onCompare={() => { setCompareFood(pinnedFood); setPinnedFood(null); }}
            onEdit={pinnedLibraryFood ? openEditFromPinned : undefined}
            style={libraryRef.current && containerRef.current
              ? { top: libraryRef.current.getBoundingClientRect().top - containerRef.current.getBoundingClientRect().top }
              : undefined}
          />
        ) : !isMobile && hoveredFood ? (
          <UsdaNutrientCard
            food={hoveredFood}
            style={hoveredLibraryId != null && libraryRef.current && containerRef.current
              ? { top: libraryRef.current.getBoundingClientRect().top - containerRef.current.getBoundingClientRect().top }
              : undefined}
          />
        ) : null}
      </div>

      {/* Mobile bottom sheet for pinned food */}
      {isMobile && pinnedFood && (
        <div
          onMouseDown={() => { setPinnedFood(null); setHoveredFood(null); setPinnedLibraryFood(null); }}
          style={{
            position: "fixed", inset: 0, zIndex: 400,
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "flex-end",
          }}
        >
          <div
            ref={pinnedSheetRef}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => {
              if (e.target.closest("button, input, select, a")) return;
              pinnedDragStart.current = e.touches[0].clientY;
              pinnedSheetRef.current.style.transition = "none";
            }}
            onTouchMove={(e) => {
              if (pinnedDragStart.current === null) return;
              const dy = e.touches[0].clientY - pinnedDragStart.current;
              if (dy > 0) pinnedSheetRef.current.style.transform = `translateY(${dy}px)`;
            }}
            onTouchEnd={(e) => {
              if (pinnedDragStart.current === null) return;
              const dy = e.changedTouches[0].clientY - pinnedDragStart.current;
              pinnedDragStart.current = null;
              if (dy > 80) {
                setPinnedFood(null); setHoveredFood(null); setPinnedLibraryFood(null);
              } else {
                pinnedSheetRef.current.style.transition = "transform 0.2s";
                pinnedSheetRef.current.style.transform = "";
              }
            }}
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
            <div style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
              <div style={{ flex: 1 }} />
              <div style={{ width: 36, height: 4, borderRadius: 99, background: "#e0e0e0" }} />
              <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
                {pinnedLibraryFood && (
                  <button
                    onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); openEditFromPinned(); }}
                    onClick={openEditFromPinned}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa", padding: "8px 4px", lineHeight: 1 }}
                  >
                    <MdEdit size={22} />
                  </button>
                )}
              </div>
            </div>
            <UsdaNutrientCard
              food={pinnedFood}
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

      {/* Edit library food modal */}
      {editingLibraryFood && (
        <div
          onMouseDown={() => setEditingLibraryFood(null)}
          style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 16, padding: "22px 20px 24px", width: "100%", maxWidth: 380, maxHeight: "90vh", overflowY: "auto" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>Edit Food</span>
              <button onClick={() => setEditingLibraryFood(null)} style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer", color: "#aaa" }}>✕</button>
            </div>
            {[
              { key: "name", label: "Name", type: "text" },
              { key: "calories", label: "Calories (kcal)", type: "number" },
              { key: "protein", label: "Protein (g)", type: "number" },
              { key: "carbs", label: "Carbs (g)", type: "number" },
              { key: "fat", label: "Fat (g)", type: "number" },
              { key: "fiber", label: "Fiber (g)", type: "number" },
              { key: "sugar", label: "Sugar (g)", type: "number" },
            ].map(({ key, label, type }) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>{label}</label>
                <input
                  type={type}
                  value={editForm[key]}
                  onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #e0e0e0", borderRadius: 8, fontSize: 16, outline: "none", boxSizing: "border-box" }}
                />
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Serving amount</label>
                <input
                  type="number"
                  value={editForm.serving_amount}
                  onChange={(e) => setEditForm((f) => ({ ...f, serving_amount: e.target.value }))}
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #e0e0e0", borderRadius: 8, fontSize: 16, outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Unit</label>
                <select
                  value={editForm.serving_unit}
                  onChange={(e) => setEditForm((f) => ({ ...f, serving_unit: e.target.value }))}
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #e0e0e0", borderRadius: 8, fontSize: 16, outline: "none", background: "#fafafa" }}
                >
                  {SERVING_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button
                onClick={() => setEditingLibraryFood(null)}
                style={{ flex: 1, padding: "10px 0", border: "1px solid #e0e0e0", borderRadius: 8, background: "none", fontSize: 14, cursor: "pointer", color: "#555" }}
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                style={{ flex: 2, padding: "10px 0", border: "none", borderRadius: 8, background: "#4f8ef7", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit plan item modal */}
      {editingPlanItem && (
        <div
          onMouseDown={() => setEditingPlanItem(null)}
          style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 16, padding: "22px 20px 24px", width: "100%", maxWidth: 380, maxHeight: "90vh", overflowY: "auto" }}
          >
            <div style={{ marginBottom: 18 }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: "#4f8ef7" }}>{editingPlanItem?.food_name}</span>
            </div>

            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 6 }}>
              {editingPlanItem?.serving_unit === "×" ? "Servings" : "Serving size"}
            </label>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              <input
                type="number"
                min="0"
                step="any"
                value={editForm.serving_amount ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, serving_amount: e.target.value }))}
                onFocus={(e) => setTimeout(() => e.target.select(), 0)}
                style={{ flex: 1, padding: "8px 10px", border: "1px solid #e0e0e0", borderRadius: 8, fontSize: 16, outline: "none" }}
              />
              {editingPlanItem?.serving_unit === "×" ? (
                <span style={{ display: "flex", alignItems: "center", padding: "8px 12px", border: "1px solid #e0e0e0", borderRadius: 8, fontSize: 14, color: "#888", background: "#fafafa" }}>
                  servings
                </span>
              ) : (
                <select
                  value={editForm.serving_unit ?? "g"}
                  onChange={(e) => {
                    const newUnit = e.target.value;
                    const oldUnit = editForm.serving_unit || "g";
                    const current = Number(editForm.serving_amount) || 0;
                    let converted = current;
                    if (UNIT_TO_G[oldUnit] && UNIT_TO_G[newUnit]) {
                      converted = Math.round(current * UNIT_TO_G[oldUnit] / UNIT_TO_G[newUnit] * 100) / 100;
                    } else if (UNIT_TO_ML[oldUnit] && UNIT_TO_ML[newUnit]) {
                      converted = Math.round(current * UNIT_TO_ML[oldUnit] / UNIT_TO_ML[newUnit] * 100) / 100;
                    }
                    setEditForm((f) => ({ ...f, serving_unit: newUnit, serving_amount: String(converted) }));
                  }}
                  style={{ padding: "8px 10px", border: "1px solid #e0e0e0", borderRadius: 8, fontSize: 14, outline: "none", background: "#fafafa", cursor: "pointer" }}
                >
                  {SERVING_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              )}
            </div>

            <div style={{ background: "#f7f7fb", borderRadius: 10, padding: "12px 14px", marginBottom: 20 }}>
              <div style={{ display: "flex", gap: 16 }}>
                {visibleMacroList.map((m) => {
                  const scaled = editingPlanItem
                    ? Math.round((editingPlanItem[m.key] || 0) * planEditScale() * (m.key === "calories" ? 1 : 10)) / (m.key === "calories" ? 1 : 10)
                    : 0;
                  return (
                    <div key={m.key} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <span style={{ fontSize: 10, color: "#bbb", fontWeight: 600, marginBottom: 2, whiteSpace: "nowrap" }}>{m.label}</span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: m.color }}>{scaled}</span>
                      <span style={{ fontSize: 10, color: "#bbb" }}>{m.unit}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button
                onClick={() => setEditingPlanItem(null)}
                style={{ flex: 1, padding: "10px 0", border: "1px solid #e0e0e0", borderRadius: 8, background: "none", fontSize: 14, cursor: "pointer", color: "#555" }}
              >
                Cancel
              </button>
              <button
                onClick={handleEditPlanItemSave}
                style={{ flex: 2, padding: "10px 0", border: "none", borderRadius: 8, background: "#4f8ef7", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
              >
                Save
              </button>
            </div>
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
            {dayPlanItems.length > 0 && (
              <span style={{ fontSize: 13, fontWeight: 500, color: "#4f8ef7", marginLeft: 8 }}>
                · {dayPlanItems.length} planned
              </span>
            )}
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

        {!entriesLoaded ? (
          <div style={{ padding: "16px 20px" }}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton-shimmer" style={{ height: 48, borderRadius: 8, marginBottom: 10 }} />
            ))}
          </div>
        ) : entriesError ? (
          <p style={{ textAlign: "center", color: "#e05c5c", padding: "32px 0", margin: 0, fontSize: 13 }}>
            Unable to fetch — check your connection and try again.
          </p>
        ) : entries.length === 0 && plannedEntries.length === 0 && dayPlanItems.length === 0 ? (
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
        ) : isMobile ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {sortedEntries.map((entry) => {
                const isExpanded = expandedLogIds.has(entry.id);
                return (
                  <div key={entry.id}
                    onClick={() => setExpandedLogIds(prev => {
                      const next = new Set(prev);
                      next.has(entry.id) ? next.delete(entry.id) : next.add(entry.id);
                      return next;
                    })}
                    style={{ background: "#fafafa", border: "1px solid #f0f0f0", borderRadius: 10, padding: "12px 14px", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                    {/* Collapsed: food name top-left, time top-right; serving bottom-left, calories bottom-right */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: "#333", flex: 1, minWidth: 0, marginRight: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.food_name}</span>
                      {entry.logged_time && <span style={{ fontSize: 11, color: "#bbb", flexShrink: 0 }}>{entry.logged_time}</span>}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 3 }}>
                      <span style={{ fontSize: 12, color: "#aaa" }}>{entry.serving_amount ? fmtServing(entry.serving_amount, entry.serving_unit) : ""}</span>
                      <span style={{ fontSize: 13, color: "#ff8c42", fontWeight: 700, flexShrink: 0 }}>{entry.calories} kcal</span>
                    </div>
                    {isExpanded && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #f0f0f0" }}>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
                          {visibleMacroList.map((m) => (
                            <div key={m.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 44 }}>
                              <span style={{ fontSize: 10, color: "#bbb", fontWeight: 500, marginBottom: 1 }}>
                                {{ calories: "Calories", protein: "Protein", carbs: "Carbs", fat: "Fat", fiber: "Fiber", sugar: "Sugar" }[m.key]}
                              </span>
                              <span style={{ fontSize: 13, color: m.color, fontWeight: 600 }}>
                                {entry[m.key] > 0 ? (m.key === "calories" ? entry[m.key] : entry[m.key].toFixed(1)) : "—"}
                              </span>
                            </div>
                          ))}
                          <button
                            onClick={e => { e.stopPropagation(); setLogEntryMenu(entry); }}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#bbb", fontSize: 20, lineHeight: 1, padding: "0 2px", marginLeft: "auto", alignSelf: "flex-start" }}
                          >⋮</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {planMode && plannedEntries.map((entry) => (
                <div key={entry.id}
                  style={{ background: "#eff6ff", border: "1.5px solid #93c5fd", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: "#1d4ed8", flex: 1, marginRight: 8 }}>{entry.food_name}</span>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                      {entry.serving_amount ? (
                        <span style={{ fontSize: 12, color: "#93c5fd", whiteSpace: "nowrap" }}>
                          {fmtServing(entry.serving_amount, entry.serving_unit)}
                        </span>
                      ) : null}
                      <button onClick={() => handleDelete(entry.id)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#93c5fd", fontSize: 15, lineHeight: 1, padding: "2px 4px" }}
                        title="Remove from plan">✕</button>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {visibleMacroList.map((m) => (
                      <div key={m.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 36 }}>
                        <span style={{ fontSize: 10, color: "#93c5fd", fontWeight: 500, marginBottom: 1 }}>
                          {{ calories: "Cal", protein: "Pro", carbs: "Carb", fat: "Fat", fiber: "Fib", sugar: "Sug" }[m.key]}
                        </span>
                        <span style={{ fontSize: 13, color: "#4f8ef7", fontWeight: 600 }}>
                          {entry[m.key] > 0 ? (m.key === "calories" ? entry[m.key] : entry[m.key].toFixed(1)) : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {dayPlanItems.length > 0 && (
                <div style={{ borderTop: "2px dashed #93c5fd", paddingTop: 8 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#4f8ef7", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px 2px" }}>
                    Planned — tap ✓ when complete
                  </p>
                  {dayPlanItems.map(item => (
                    <div key={item.id} style={{ background: "#eff6ff", border: "1.5px solid #93c5fd", borderRadius: 10, padding: "10px 12px", marginBottom: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <span style={{ fontWeight: 600, fontSize: 14, color: "#1d4ed8", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 8 }}>{item.food_name}</span>
                        <span style={{ fontSize: 13, color: "#4f8ef7", fontWeight: 700, flexShrink: 0 }}>{item.calories} kcal</span>
                      </div>
                      {item.serving_amount && (
                        <div style={{ fontSize: 12, color: "#93c5fd", marginTop: 2 }}>{fmtServing(item.serving_amount, item.serving_unit)}</div>
                      )}
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button
                          onClick={() => markPlanItemComplete(item)}
                          style={{ flex: 1, padding: "7px 0", background: "#4f8ef7", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                        >✓ Mark as Complete</button>
                        <button
                          onClick={() => editPlanItem(item.id)}
                          style={{ padding: "7px 10px", background: "none", border: "1px solid #93c5fd", borderRadius: 8, color: "#93c5fd", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center" }}
                        ><MdEdit size={16} /></button>
                        <button
                          onClick={() => removePlanItem(item.id)}
                          style={{ padding: "7px 10px", background: "none", border: "1px solid #93c5fd", borderRadius: 8, color: "#93c5fd", fontSize: 13, cursor: "pointer" }}
                        >✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ background: "#fff8f3", border: "1px solid #ffe8d0", borderRadius: 10, padding: "12px 14px" }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#555", margin: "0 0 8px" }}>Total</p>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {visibleMacroList.map((m) => (
                    <div key={m.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 36 }}>
                      <span style={{ fontSize: 10, color: "#bbb", fontWeight: 500, marginBottom: 1 }}>
                        {{ calories: "Cal", protein: "Pro", carbs: "Carb", fat: "Fat", fiber: "Fib", sugar: "Sug" }[m.key]}
                      </span>
                      <span style={{ fontSize: 13, color: m.color, fontWeight: 700 }}>
                        {m.key === "calories" ? totals[m.key].toFixed(0) : totals[m.key].toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
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
                      <span style={{ fontWeight: 400, color: "#aaa", fontSize: 11 }}>{m.unit}</span>
                    </th>
                  ))}
                  <th style={thStyle({ color: "#aaa" })}>Time</th>
                  <th style={thStyle()}></th>
                </tr>
              </thead>
              <tbody>
                {sortedEntries.map((entry, i) => (
                  <tr key={entry.id} style={{ borderTop: "1px solid #f0f0f0", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                    <td style={{ padding: "10px 16px", fontWeight: 500 }}>{entry.food_name}</td>
                    <td style={{ padding: "10px 16px", textAlign: "center", color: "#aaa", fontSize: 12, whiteSpace: "nowrap" }}>
                      {fmtServing(entry.serving_amount, entry.serving_unit)}
                    </td>
                    {visibleMacroList.map((m) => (
                      <td key={m.key} style={{ padding: "10px 16px", textAlign: "center", color: m.color, fontWeight: m.key === "calories" ? 700 : 600 }}>
                        {entry[m.key] > 0 ? (m.key === "calories" ? entry[m.key] : entry[m.key].toFixed(1)) : <span style={{ color: "#ddd" }}>—</span>}
                      </td>
                    ))}
                    <td style={{ padding: "10px 16px", textAlign: "center", color: "#aaa", fontSize: 12, whiteSpace: "nowrap" }}>{entry.logged_time || "—"}</td>
                    <td style={{ padding: "6px 12px", textAlign: "center", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {!savedFoods.some((f) => f.name.toLowerCase() === entry.food_name.toLowerCase()) ? (
                          <button
                            onClick={() => handleSaveEntryToMyFoods(entry)}
                            style={{ background: "#f0f7ff", border: "1px solid #c8e0ff", borderRadius: 6, cursor: "pointer", color: "#4f8ef7", fontSize: 14, lineHeight: 1, padding: "5px 8px", minWidth: 32 }}
                            title="Save to My Food Library"
                          >☆</button>
                        ) : (
                          <div style={{ minWidth: 32, height: 26 }} />
                        )}
                        <button
                          onClick={() => { if (window.confirm(`Remove "${entry.food_name}" from today's log?`)) handleDelete(entry.id); }}
                          style={{ background: "#fff0f0", border: "1px solid #ffc8c8", borderRadius: 6, cursor: "pointer", color: "#e05c5c", fontSize: 14, lineHeight: 1, padding: "5px 8px", minWidth: 32 }}
                          title="Remove"
                        >✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {planMode && plannedEntries.map((entry) => (
                  <tr key={entry.id} style={{ borderTop: "1px solid #dbeafe", background: "#eff6ff" }}>
                    <td style={{ padding: "10px 16px", fontWeight: 500, color: "#1d4ed8" }}>{entry.food_name}</td>
                    <td style={{ padding: "10px 16px", textAlign: "center", color: "#93c5fd", fontSize: 12, whiteSpace: "nowrap" }}>
                      {fmtServing(entry.serving_amount, entry.serving_unit)}
                    </td>
                    {visibleMacroList.map((m) => (
                      <td key={m.key} style={{ padding: "10px 16px", textAlign: "center", color: "#4f8ef7", fontWeight: m.key === "calories" ? 700 : 600 }}>
                        {entry[m.key] > 0 ? (m.key === "calories" ? entry[m.key] : entry[m.key].toFixed(1)) : <span style={{ color: "#ddd" }}>—</span>}
                      </td>
                    ))}
                    <td style={{ padding: "10px 16px", textAlign: "center", color: "#93c5fd", fontSize: 12, whiteSpace: "nowrap" }}>{entry.logged_time || "—"}</td>
                    <td style={{ padding: "6px 12px", textAlign: "center" }}>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        style={{ background: "#dbeafe", border: "1px solid #93c5fd", borderRadius: 6, cursor: "pointer", color: "#4f8ef7", fontSize: 14, lineHeight: 1, padding: "5px 8px", minWidth: 32 }}
                        title="Remove from plan"
                      >✕</button>
                    </td>
                  </tr>
                ))}
                {dayPlanItems.length > 0 && (
                  <tr style={{ background: "#dbeafe" }}>
                    <td colSpan={3 + visibleMacroList.length} style={{ padding: "6px 16px", fontSize: 11, fontWeight: 700, color: "#4f8ef7", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Planned — click ✓ when complete
                    </td>
                    <td />
                  </tr>
                )}
                {dayPlanItems.map(item => (
                  <tr key={item.id} style={{ borderTop: "1px solid #dbeafe", background: "#f0f7ff" }}>
                    <td style={{ padding: "10px 16px", fontWeight: 500, color: "#1d4ed8" }}>{item.food_name}</td>
                    <td style={{ padding: "10px 16px", textAlign: "center", color: "#93c5fd", fontSize: 12, whiteSpace: "nowrap" }}>
                      {fmtServing(item.serving_amount, item.serving_unit)}
                    </td>
                    {visibleMacroList.map((m) => (
                      <td key={m.key} style={{ padding: "10px 16px", textAlign: "center", color: "#4f8ef7", fontWeight: m.key === "calories" ? 700 : 600 }}>
                        {item[m.key] > 0 ? (m.key === "calories" ? item[m.key] : item[m.key].toFixed(1)) : <span style={{ color: "#ddd" }}>—</span>}
                      </td>
                    ))}
                    <td style={{ padding: "10px 16px", textAlign: "center", color: "#93c5fd", fontSize: 12, whiteSpace: "nowrap" }}>{item.logged_time || "—"}</td>
                    <td style={{ padding: "6px 12px", textAlign: "center", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <button
                          onClick={() => markPlanItemComplete(item)}
                          style={{ background: "#4f8ef7", border: "none", borderRadius: 6, cursor: "pointer", color: "#fff", fontSize: 13, fontWeight: 700, padding: "5px 10px" }}
                          title="Mark as Complete"
                        >✓</button>
                        <button
                          onClick={() => removePlanItem(item.id)}
                          style={{ background: "#dbeafe", border: "1px solid #93c5fd", borderRadius: 6, cursor: "pointer", color: "#4f8ef7", fontSize: 14, lineHeight: 1, padding: "5px 8px" }}
                          title="Remove from plan"
                        >✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid #eee", background: "#fff8f3" }}>
                  <td style={{ padding: "10px 16px", fontWeight: 700, color: "#555" }}>Total</td>
                  <td />
                  {visibleMacroList.map((m) => (
                    <td key={m.key} style={{ padding: "10px 16px", textAlign: "center", fontWeight: 700, color: m.color }}>
                      {m.key === "calories" ? totals[m.key].toFixed(0) : totals[m.key].toFixed(1)}
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

      {planExitOpen && (() => {
        const logAll = async () => {
          if (user) {
            const { data: { user: u } } = await supabase.auth.getUser();
            const toInsert = plannedEntries.map((e) => ({
              user_id: u.id, logged_at: e.logged_at, logged_time: e.logged_time,
              food_name: e.food_name, calories: e.calories, protein: e.protein,
              fat: e.fat, carbs: e.carbs, fiber: e.fiber, sugar: e.sugar,
              serving_amount: e.serving_amount, serving_unit: e.serving_unit,
            }));
            const { data } = await supabase.from("nutrition_logs").insert(toInsert).select();
            if (data) {
              const next = [...entries, ...data];
              setEntries(next);
              upsertDailyStatus(todayStr(), next, goals, u.id);
            }
          } else {
            const next = [...entries, ...plannedEntries.map((e) => ({ ...e, id: "guest_" + Date.now() + Math.random() }))];
            setEntries(next);
            saveGuestEntries(next);
          }
          setPlannedEntries([]);
          setPlanMode(false);
          setPlanExitOpen(false);
          showToast("Plan logged!", "#4f8ef7");
        };
        const discard = () => { setPlannedEntries([]); setPlanMode(false); setPlanExitOpen(false); };
        const setPlan = async () => {
          setPlannedEntries([]);
          setPlanMode(false);
          setPlanExitOpen(false);
          if (user) {
            const toInsert = plannedEntries.map(e => ({
              user_id: user.id, logged_at: todayStr(), logged_time: e.logged_time,
              food_name: e.food_name, calories: e.calories, protein: e.protein,
              fat: e.fat, carbs: e.carbs, fiber: e.fiber, sugar: e.sugar,
              serving_amount: e.serving_amount, serving_unit: e.serving_unit,
              is_planned: true,
            }));
            const { data } = await supabase.from("nutrition_logs").insert(toInsert).select();
            if (data) setDayPlanItems(prev => [...prev, ...data]);
          } else {
            const items = plannedEntries.map(e => ({ ...e, id: "guest_plan_" + Date.now() + Math.random() }));
            const merged = [...dayPlanItems, ...items];
            setDayPlanItems(merged);
            saveGuestPlan(merged);
          }
          showToast("Plan set for today!", "#4f8ef7");
        };
        const n = plannedEntries.length;
        const logLabel = `Log ${n} ${n === 1 ? "item" : "items"}`;

        if (isMobile) {
          return (
            <div onClick={() => setPlanExitOpen(false)}
              style={{ position: "fixed", inset: 0, zIndex: 600, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end" }}>
              <div onClick={(e) => e.stopPropagation()}
                style={{ width: "100%", background: "#fff", borderRadius: "18px 18px 0 0", padding: "24px 20px calc(24px + env(safe-area-inset-bottom, 0px))", boxShadow: "0 -4px 24px rgba(0,0,0,0.15)" }}>
                <div style={{ width: 36, height: 4, borderRadius: 99, background: "#e0e0e0", margin: "0 auto 20px" }} />
                <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 16, color: "#333" }}>Exit Plan Mode</p>
                <p style={{ margin: "0 0 20px", fontSize: 13, color: "#888" }}>
                  You have {n} planned {n === 1 ? "item" : "items"}. Log them or discard?
                </p>
                <button onClick={logAll}
                  style={{ width: "100%", padding: "13px 0", background: "#4f8ef7", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: "pointer", marginBottom: 10 }}>
                  {logLabel}
                </button>
                <button onClick={setPlan}
                  style={{ width: "100%", padding: "13px 0", background: "#eff6ff", border: "1.5px solid #93c5fd", borderRadius: 10, color: "#4f8ef7", fontWeight: 700, fontSize: 15, cursor: "pointer", marginBottom: 10 }}>
                  Set as Today's Plan
                </button>
                <button onClick={discard}
                  style={{ width: "100%", padding: "13px 0", background: "#f7f7fb", border: "none", borderRadius: 10, color: "#888", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                  Discard
                </button>
              </div>
            </div>
          );
        }

        const plannedTotals = MACROS.reduce((acc, m) => {
          acc[m.key] = plannedEntries.reduce((s, e) => s + (e[m.key] || 0), 0);
          return acc;
        }, {});

        return (
          <div onClick={() => setPlanExitOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 600, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div onClick={(e) => e.stopPropagation()}
              style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 560, boxShadow: "0 8px 40px rgba(0,0,0,0.18)", overflow: "hidden" }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", padding: "18px 22px 14px", borderBottom: "1px solid #f0f0f0" }}>
                <span style={{ fontWeight: 700, fontSize: 16, color: "#333", flex: 1 }}>Log Plan?</span>
                <button onClick={() => setPlanExitOpen(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#bbb", fontSize: 18, lineHeight: 1, padding: "2px 4px" }}>✕</button>
              </div>
              {/* Planned items list */}
              <div style={{ maxHeight: 220, overflowY: "auto", overscrollBehavior: "contain", padding: "0 22px" }}>
                {/* Column headers */}
                <div style={{ display: "flex", alignItems: "center", padding: "8px 0 4px", borderBottom: "1px solid #f0f0f0" }}>
                  <span style={{ flex: 1, marginRight: 12 }} />
                  <span style={{ fontSize: 10, color: "#bbb", fontWeight: 600, marginRight: 14, minWidth: 60 }}>Serving</span>
                  <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
                    {visibleMacroList.map((m) => (
                      <span key={m.key} style={{ fontSize: 10, color: "#bbb", fontWeight: 600, minWidth: 34, textAlign: "center" }}>{m.label}</span>
                    ))}
                  </div>
                </div>
                {plannedEntries.map((e) => (
                  <div key={e.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #f7f7f7" }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: "#333", flex: 1, marginRight: 12 }}>{e.food_name}</span>
                    <span style={{ fontSize: 12, color: "#93c5fd", marginRight: 14, whiteSpace: "nowrap", minWidth: 60 }}>
                      {fmtServing(e.serving_amount, e.serving_unit)}
                    </span>
                    <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
                      {visibleMacroList.map((m) => (
                        <span key={m.key} style={{ fontSize: 12, color: m.color, fontWeight: 600, minWidth: 34, textAlign: "center" }}>
                          {m.key === "calories" ? e[m.key] : e[m.key]?.toFixed(1)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {/* Macro additions summary */}
              <div style={{ background: "#eff6ff", margin: "14px 22px 8px", borderRadius: 8, padding: "10px 14px" }}>
                <span style={{ fontSize: 11, color: "#4f8ef7", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Adding</span>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 6 }}>
                  {visibleMacroList.map((m) => (
                    <div key={m.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 40 }}>
                      <span style={{ fontSize: 10, color: "#93c5fd", fontWeight: 600, marginBottom: 1 }}>{m.label}</span>
                      <span style={{ fontSize: 13, color: "#4f8ef7", fontWeight: 700, whiteSpace: "nowrap" }}>
                        +{m.key === "calories" ? plannedTotals[m.key].toFixed(0) : plannedTotals[m.key].toFixed(1)}
                        <span style={{ fontWeight: 400, fontSize: 10, color: "#93c5fd" }}> {m.unit}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Projected day totals */}
              <div style={{ background: "#f7f7fb", margin: "0 22px 14px", borderRadius: 8, padding: "10px 14px" }}>
                <span style={{ fontSize: 11, color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Updated Daily Progress</span>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 6 }}>
                  {visibleMacroList.map((m) => (
                    <div key={m.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 40 }}>
                      <span style={{ fontSize: 10, color: "#bbb", fontWeight: 600, marginBottom: 1 }}>{m.label}</span>
                      <span style={{ fontSize: 13, color: "#555", fontWeight: 700, whiteSpace: "nowrap" }}>
                        {m.key === "calories" ? totals[m.key].toFixed(0) : totals[m.key].toFixed(1)}
                        <span style={{ fontWeight: 400, fontSize: 10, color: "#bbb" }}> {m.unit}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Buttons */}
              <div style={{ display: "flex", gap: 10, padding: "0 22px 20px" }}>
                <button onClick={discard}
                  style={{ flex: 1, padding: "10px 0", border: "1px solid #e0e0e0", borderRadius: 8, background: "none", fontSize: 14, cursor: "pointer", color: "#555", fontWeight: 600 }}>
                  Discard
                </button>
                <button onClick={setPlan}
                  style={{ flex: 2, padding: "10px 0", border: "1.5px solid #93c5fd", borderRadius: 8, background: "#eff6ff", color: "#4f8ef7", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                  Set as Today's Plan
                </button>
                <button onClick={logAll}
                  style={{ flex: 2, padding: "10px 0", border: "none", borderRadius: 8, background: "#4f8ef7", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                  {logLabel}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {scannerOpen && (
        <BarcodeScanner
          onScan={handleBarcodeScan}
          onClose={() => setScannerOpen(false)}
        />
      )}

      {logEntryMenu && (
        <div
          onClick={() => setLogEntryMenu(null)}
          style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end" }}
        >
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", background: "#fff", borderRadius: "18px 18px 0 0", padding: "20px 20px calc(20px + env(safe-area-inset-bottom, 0px))", boxShadow: "0 -4px 24px rgba(0,0,0,0.15)" }}>
            <div style={{ width: 36, height: 4, borderRadius: 99, background: "#e0e0e0", margin: "0 auto 18px" }} />
            <p style={{ fontWeight: 700, fontSize: 15, color: "#333", margin: "0 0 4px" }}>{logEntryMenu.food_name}</p>
            {logEntryMenu.serving_amount && (
              <p style={{ fontSize: 12, color: "#aaa", margin: "0 0 18px" }}>
                {fmtServing(logEntryMenu.serving_amount, logEntryMenu.serving_unit)}
              </p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {!savedFoods.some((f) => f.name.toLowerCase() === logEntryMenu.food_name.toLowerCase()) && (
                <button
                  onClick={() => { handleSaveEntryToMyFoods(logEntryMenu); setLogEntryMenu(null); }}
                  style={{ width: "100%", padding: "13px 0", background: "#f0f7ff", border: "1px solid #c8e0ff", borderRadius: 10, color: "#4f8ef7", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
                >
                  ☆ Save to My Food Library
                </button>
              )}
              <button
                onClick={() => { if (window.confirm(`Remove "${logEntryMenu.food_name}" from today's log?`)) { handleDelete(logEntryMenu.id); setLogEntryMenu(null); } }}
                style={{ width: "100%", padding: "13px 0", background: "#fff0f0", border: "1px solid #ffc8c8", borderRadius: 10, color: "#e05c5c", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
              >
                Remove from log
              </button>
              <button
                onClick={() => setLogEntryMenu(null)}
                style={{ width: "100%", padding: "13px 0", background: "#f7f7fb", border: "none", borderRadius: 10, color: "#888", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {calendarOpen && (
        <NutritionCalendar
          userId={user?.id}
          onClose={() => setCalendarOpen(false)}
        />
      )}

      {/* Guest macro goals modal */}
      {guestGoalsOpen && (
        <div
          onMouseDown={(e) => { if (e.target === e.currentTarget) setGuestGoalsOpen(false); }}
          style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 16, padding: "24px 20px", width: "100%", maxWidth: 380, maxHeight: "90vh", overflowY: "auto" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>Daily Macro Goals</span>
              <button onClick={() => setGuestGoalsOpen(false)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#aaa" }}>✕</button>
            </div>
            <p style={{ fontSize: 12, color: "#aaa", margin: "0 0 18px" }}>Sign in to sync goals across devices.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {MACROS.map(m => {
                const dir = guestGoalsForm[m.dirKey] ?? m.defaultDir;
                return (
                  <div key={m.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: m.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#333" }}>{m.label}</span>
                    <div style={{ display: "flex", gap: 3 }}>
                      {["above", "below"].map(d => (
                        <button key={d} type="button"
                          onClick={() => setGuestGoalsForm(f => ({ ...f, [m.dirKey]: d }))}
                          style={{ border: "none", borderRadius: 6, padding: "3px 7px", fontSize: 11, cursor: "pointer", fontWeight: 600, background: dir === d ? "#555" : "#f0f0f0", color: dir === d ? "#fff" : "#aaa" }}>
                          {d === "above" ? "≥" : "≤"}
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={guestGoalsForm[m.key] ?? ""}
                      onChange={e => setGuestGoalsForm(f => ({ ...f, [m.key]: e.target.value === "" ? null : Number(e.target.value) }))}
                      style={{ padding: "7px 10px", border: "1px solid #e0e0e0", borderRadius: 8, fontSize: 16, outline: "none", textAlign: "right", background: "#fafafa", width: 80 }}
                    />
                    <span style={{ fontSize: 12, color: "#aaa", width: 28 }}>{m.unit}</span>
                  </div>
                );
              })}
            </div>
            <button
              onClick={saveGuestGoals}
              style={{ marginTop: 22, width: "100%", padding: "11px 0", background: "#ff8c42", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer" }}
            >
              Save Goals
            </button>
          </div>
        </div>
      )}

      {/* Logged toast */}
      <div style={{
        position: "fixed",
        bottom: isMobile ? 90 : "auto",
        top: isMobile ? "auto" : 20,
        left: isMobile ? "50%" : "auto",
        right: isMobile ? "auto" : 20,
        transform: isMobile ? `translateX(-50%) translateY(${toast.visible ? 0 : 20}px)` : `translateY(${toast.visible ? 0 : -10}px)`,
        opacity: toast.visible ? 1 : 0,
        pointerEvents: "none",
        transition: "opacity 0.25s, transform 0.25s",
        background: toast.color,
        color: "#fff",
        borderRadius: 999,
        padding: "10px 20px",
        fontSize: 14,
        fontWeight: 600,
        whiteSpace: "nowrap",
        boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
        zIndex: 600,
      }}>
        {toast.message}
      </div>
    </div>
  );
}

