import React, { useEffect, useRef, useState } from "react";
import {
  capturePwaPrompt,
  triggerPwaInstall,
  isPwaStandalone,
  isPwaIOS,
  PWA_PROMPT_KEY,
} from "./lib/pwaInstall";
import {
  Routes,
  Route,
  NavLink,
  Navigate,
  useNavigate,
} from "react-router-dom";
import {
  MdRestaurant,
  MdFitnessCenter,
  MdAccessibility,
  MdPerson,
} from "react-icons/md";
import DiagramPage from "./pages/DiagramPage";
import Videos from "./pages/Videos";
import Nutrition from "./pages/Nutrition";
import ExerciseLogger from "./pages/ExerciseLogger";
import Profile from "./pages/Profile";
import { AuthProvider, useAuth } from "./context/AuthContext";
import AuthModal from "./components/AuthModal";
import OnboardingModal from "./components/OnboardingModal";
import { supabase } from "./lib/supabase";

function NavAuth() {
  const { user, setModalOpen } = useAuth();
  const navigate = useNavigate();
  if (user) {
    const avatarUrl = user.user_metadata?.avatar_url;
    const initial = (user.user_metadata?.full_name ||
      user.email ||
      "?")[0].toUpperCase();
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginLeft: "auto",
        }}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="avatar"
            title="Profile & Goals"
            onClick={() => navigate("/profile")}
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              objectFit: "cover",
              flexShrink: 0,
              cursor: "pointer",
            }}
          />
        ) : (
          <div
            title="Profile & Goals"
            onClick={() => navigate("/profile")}
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "#ff8c42",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 700,
              flexShrink: 0,
              cursor: "pointer",
            }}
          >
            {initial}
          </div>
        )}
        <button
          onClick={() => supabase.auth.signOut()}
          style={{
            background: "none",
            border: "1px solid #e0e0e0",
            borderRadius: 6,
            padding: "4px 12px",
            cursor: "pointer",
            fontSize: 13,
            color: "#555",
          }}
        >
          Sign Out
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={() => setModalOpen(true)}
      style={{
        marginLeft: "auto",
        background: "#ff8c42",
        color: "#fff",
        border: "none",
        borderRadius: 6,
        padding: "5px 14px",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      Sign In
    </button>
  );
}

const STORAGE_KEY = "rir0_active_workout";

function ActiveWorkoutRedirect() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (window.location.pathname === "/exerciselogger") return;
    if (user) {
      supabase
        .from("active_workouts")
        .select("exercises")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.exercises?.length > 0)
            navigate("/exerciselogger", { replace: true });
        });
    } else {
      try {
        const { sessionExs } = JSON.parse(
          localStorage.getItem(STORAGE_KEY) || "{}",
        );
        if (sessionExs?.length > 0)
          navigate("/exerciselogger", { replace: true });
      } catch {}
    }
  }, [user]);

  return null;
}

function BottomNav() {
  const { user, setModalOpen } = useAuth();
  const avatarUrl = user?.user_metadata?.avatar_url;
  const initial = (user?.user_metadata?.full_name ||
    user?.email ||
    "?")[0]?.toUpperCase();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const check = () => setKeyboardOpen(vv.height < window.innerHeight * 0.75);
    vv.addEventListener("resize", check);
    return () => vv.removeEventListener("resize", check);
  }, []);
  return (
    <nav
      className="bottom-nav"
      style={keyboardOpen ? { display: "none" } : undefined}
    >
      <NavLink
        to="/nutrition"
        className={({ isActive }) =>
          "bottom-nav-item" + (isActive ? " active" : "")
        }
      >
        <MdRestaurant size={24} />
        <span>Nutrition</span>
      </NavLink>
      <NavLink
        to="/exerciselogger"
        className={({ isActive }) =>
          "bottom-nav-item" + (isActive ? " active" : "")
        }
      >
        <MdFitnessCenter size={24} />
        <span>Exercise</span>
      </NavLink>
      {user ? (
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            "bottom-nav-item" + (isActive ? " active" : "")
          }
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="avatar"
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                objectFit: "cover",
              }}
            />
          ) : (
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: "#ff8c42",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {initial}
            </div>
          )}
          <span>Profile</span>
        </NavLink>
      ) : (
        <button
          className="bottom-nav-item"
          onClick={() => setModalOpen(true)}
          style={{ border: "none", background: "none", cursor: "pointer" }}
        >
          <MdPerson size={24} />
          <span>Sign In</span>
        </button>
      )}
    </nav>
  );
}

function PwaInstallPrompt() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);
  const prevUser = useRef(null);

  useEffect(() => {
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (isPwaStandalone() || !isMobile) return;
    setIos(isPwaIOS());
    window.addEventListener("beforeinstallprompt", capturePwaPrompt);
    return () =>
      window.removeEventListener("beforeinstallprompt", capturePwaPrompt);
  }, []);

  useEffect(() => {
    if (user && !prevUser.current) {
      const isMobile = window.matchMedia("(max-width: 767px)").matches;
      if (
        !isPwaStandalone() &&
        isMobile &&
        !localStorage.getItem(PWA_PROMPT_KEY)
      )
        setShow(true);
    }
    prevUser.current = user;
  }, [user]);

  function dismiss() {
    localStorage.setItem(PWA_PROMPT_KEY, "1");
    setShow(false);
  }

  if (!show) return null;
  return (
    <PwaSheet
      ios={ios}
      onInstall={async () => {
        await triggerPwaInstall();
        dismiss();
      }}
      onDismiss={dismiss}
    />
  );
}

export function PwaSheet({ ios, onInstall, onDismiss }) {
  return (
    <div
      onClick={onDismiss}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 700,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          background: "#fff",
          borderRadius: "18px 18px 0 0",
          padding: "24px 20px calc(24px + env(safe-area-inset-bottom, 0px))",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.15)",
        }}
      >
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 99,
            background: "#e0e0e0",
            margin: "0 auto 22px",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 16,
          }}
        >
          <img
            src="/pwa-192x192.png"
            alt="app icon"
            style={{ width: 52, height: 52, borderRadius: 12, flexShrink: 0 }}
          />
          <div>
            <p
              style={{
                margin: 0,
                fontWeight: 700,
                fontSize: 16,
                color: "#333",
              }}
            >
              Add to Home Screen
            </p>
            <p style={{ margin: "3px 0 0", fontSize: 13, color: "#888" }}>
              Install for a faster, full-screen experience
            </p>
          </div>
        </div>
        {ios ? (
          <p
            style={{
              fontSize: 13,
              color: "#666",
              lineHeight: 1.7,
              background: "#f7f7fb",
              borderRadius: 10,
              padding: "12px 14px",
              margin: "0 0 12px",
            }}
          >
            Tap the <strong>...</strong> button at the bottom of Safari, then
            choose <strong>Share</strong>{" "}
            <span style={{ fontSize: 17, verticalAlign: "middle" }}>⎙</span>{" "}
            <strong>View More</strong>{" "}
            <span style={{ fontSize: 17, verticalAlign: "middle" }}>⋁</span>,{" "}
            <strong>Add to Home Screen</strong>.
          </p>
        ) : (
          <button
            onClick={onInstall}
            style={{
              width: "100%",
              padding: "13px 0",
              background: "#ff8c42",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 15,
              cursor: "pointer",
              marginBottom: 10,
            }}
          >
            Install App
          </button>
        )}
        <button
          onClick={onDismiss}
          style={{
            width: "100%",
            padding: "13px 0",
            background: "#f7f7fb",
            border: "none",
            borderRadius: 10,
            color: "#888",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          {ios ? "Got it" : "Not now"}
        </button>
      </div>
    </div>
  );
}

function AppShell() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        position: "fixed", inset: 0,
        background: "var(--bg)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 16, zIndex: 9999,
      }}>
        <div className="auth-spinner" />
        <p style={{ margin: 0, fontSize: 14, color: "#aaa", fontWeight: 500 }}>
          Signing you in…
        </p>
      </div>
    );
  }

  return (
    <>
      <nav className="top-nav">
        <NavLink to="/nutrition">Nutrition</NavLink>
        <NavLink to="/exerciselogger">Exercise Logger</NavLink>
        <NavLink to="/diagram">Muscle Diagram</NavLink>
        <NavAuth />
      </nav>

      <ActiveWorkoutRedirect />
      <Routes>
        <Route path="/" element={<Navigate to="/nutrition" replace />} />
        <Route path="/nutrition" element={<Nutrition />} />
        <Route path="/exerciselogger" element={<ExerciseLogger />} />
        <Route path="/diagram" element={<DiagramPage />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>

      <AuthModal />
      <OnboardingModal />
      <PwaInstallPrompt />
      <BottomNav />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <div className="app">
        <AppShell />
      </div>
    </AuthProvider>
  );
}
