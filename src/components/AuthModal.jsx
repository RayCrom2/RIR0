import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export default function AuthModal() {
  const { modalOpen, setModalOpen, onAuthSuccess } = useAuth();
  const [tab, setTab] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!modalOpen) return null;

  function reset() {
    setEmail("");
    setPassword("");
    setError("");
    setLoading(false);
  }

  function close() {
    reset();
    setModalOpen(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (tab === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setError(error.message); setLoading(false); return; }
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) { setError(error.message); setLoading(false); return; }
      if (!data.session) {
        setError("Check your email to confirm your account, then log in.");
        setLoading(false);
        return;
      }
    }

    reset();
    onAuthSuccess();
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40"
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-7 relative">
        <button
          onClick={close}
          className="absolute top-4 right-4 bg-transparent border-0 text-[#bbb] text-xl cursor-pointer leading-none"
        >
          ✕
        </button>

        <h2 className="mb-1 text-[1.4rem]">
          {tab === "login" ? "Welcome back" : "Create account"}
        </h2>
        <p className="text-sm text-[#888] mb-5">
          {tab === "login"
            ? "Log in to save your progress."
            : "Sign up to save your workouts and nutrition."}
        </p>

        {/* Tabs */}
        <div className="flex gap-0 mb-5 border border-[#e0e0e0] rounded-lg overflow-hidden">
          <button
            onClick={() => { setTab("login"); setError(""); }}
            className={`flex-1 py-2 text-sm font-semibold border-0 cursor-pointer ${
              tab === "login" ? "bg-[#ff8c42] text-white" : "bg-white text-[#555]"
            }`}
          >
            Log In
          </button>
          <button
            onClick={() => { setTab("signup"); setError(""); }}
            className={`flex-1 py-2 text-sm font-semibold border-0 cursor-pointer ${
              tab === "signup" ? "bg-[#ff8c42] text-white" : "bg-white text-[#555]"
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="py-2.5 px-3 border border-[#e0e0e0] rounded-lg text-sm outline-none bg-[#fafafa]"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="py-2.5 px-3 border border-[#e0e0e0] rounded-lg text-sm outline-none bg-[#fafafa]"
          />
          {error && <p className="text-[#e05c5c] text-[13px] m-0">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-[#ff8c42] text-white border-0 rounded-lg py-2.5 font-semibold text-sm cursor-pointer disabled:opacity-60 mt-1"
          >
            {loading ? "Please wait…" : tab === "login" ? "Log In" : "Sign Up"}
          </button>
        </form>

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-[#e0e0e0]" />
          <span className="text-xs text-[#bbb]">or</span>
          <div className="flex-1 h-px bg-[#e0e0e0]" />
        </div>

        <button
          onClick={() => supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } })}
          className="w-full flex items-center justify-center gap-2.5 border border-[#e0e0e0] rounded-lg py-2.5 bg-white cursor-pointer text-sm font-semibold text-[#333] hover:bg-[#f7f7fb]"
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.14 0 5.95 1.08 8.17 2.84l6.1-6.1C34.46 3.05 29.53 1 24 1 14.82 1 7.07 6.48 3.64 14.22l7.14 5.54C12.53 13.61 17.82 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.52 24.5c0-1.64-.15-3.22-.42-4.75H24v9h12.68c-.55 2.96-2.2 5.47-4.68 7.16l7.18 5.57C43.34 37.17 46.52 31.32 46.52 24.5z"/>
            <path fill="#FBBC05" d="M10.78 28.24A14.6 14.6 0 0 1 9.5 24c0-1.48.26-2.91.72-4.24l-7.14-5.54A23.93 23.93 0 0 0 0 24c0 3.86.92 7.51 2.56 10.74l8.22-6.5z"/>
            <path fill="#34A853" d="M24 47c5.53 0 10.17-1.83 13.56-4.97l-7.18-5.57C28.6 37.8 26.42 38.5 24 38.5c-6.18 0-11.47-4.11-13.22-9.76l-8.22 6.5C6.07 43.52 14.45 47 24 47z"/>
          </svg>
          Continue with Google
        </button>
      </div>
    </div>
  );
}
