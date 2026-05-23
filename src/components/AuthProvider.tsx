"use client";

import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getFirebaseAuth } from "@/lib/firebase";

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

// Safety net — if initialization still hasn't resolved after this, give up the
// loading screen so the operator at least sees the sign-in button.
const INIT_TIMEOUT_MS = 6000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsub = () => {};

    // Fallback in case authStateReady() never resolves (e.g. network stalled
    // while determining persistence). We still want the user to be able to
    // press "Sign in with Google".
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      setLoading(prev => {
        if (!prev) return prev;
        // eslint-disable-next-line no-console
        console.warn(
          "[auth] init timed out; revealing sign-in UI without an initial state",
        );
        return false;
      });
    }, INIT_TIMEOUT_MS);

    (async () => {
      try {
        const auth = getFirebaseAuth();
        // Wait for the initial state to be determined. This is more robust
        // than `onAuthStateChanged` alone under React Strict Mode where the
        // effect double-mounts and the first listener can be torn down before
        // it receives its initial callback.
        if (typeof auth.authStateReady === "function") {
          await auth.authStateReady();
        }
        if (cancelled) return;
        setUser(auth.currentUser);
        setLoading(false);
        // Continue listening for changes (sign in / sign out events).
        unsub = onAuthStateChanged(auth, u => {
          if (cancelled) return;
          setUser(u);
        });
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      unsub();
    };
  }, []);

  const signIn = useCallback(async () => {
    setError(null);
    try {
      const auth = getFirebaseAuth();
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const signOutUser = useCallback(async () => {
    try {
      await signOut(getFirebaseAuth());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, error, signIn, signOutUser }),
    [user, loading, error, signIn, signOutUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
