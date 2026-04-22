import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) { setNeedsOnboarding(false); return; }
    supabase
      .from("nutrition_goals")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => { if (!data) setNeedsOnboarding(true); });
  }, [user]);

  // Call this instead of saving directly. If not logged in, opens the modal
  // and re-runs the action after login.
  function requireAuth(action) {
    if (user) {
      action();
    } else {
      setPendingAction(() => action);
      setModalOpen(true);
    }
  }

  function onAuthSuccess() {
    setModalOpen(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, modalOpen, setModalOpen, requireAuth, onAuthSuccess, needsOnboarding, setNeedsOnboarding }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
