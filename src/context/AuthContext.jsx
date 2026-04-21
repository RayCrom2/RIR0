import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[auth]", event, session?.user?.email ?? null);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

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
    <AuthContext.Provider value={{ user, loading, modalOpen, setModalOpen, requireAuth, onAuthSuccess }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
