"use client";

import Link from "next/link";
import { useAuth } from "./AuthProvider";
import styles from "./LoginGate.module.css";

export function LoginGate({ children }: { children: React.ReactNode }) {
  const { user, loading, error, signIn } = useAuth();

  if (loading) {
    return (
      <div className={styles.root}>
        <div className={styles.panel}>
          <p className={styles.subtitle}>Initializing…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={styles.root}>
        <div className={styles.panel}>
          <h1 className={styles.title}>Operator Console</h1>
          <p className={styles.subtitle}>
            抽選を実行するにはオペレーター認証が必要です
          </p>
          <button className={styles.btn} onClick={signIn} type="button">
            ▶ Sign in with Google
          </button>
          {error && <p className={styles.error}>{error}</p>}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function UserBar() {
  const { user, signOutUser } = useAuth();
  if (!user) return null;
  return (
    <div className={styles.userBar}>
      <Link href="/edit" className={styles.signOut}>
        edit
      </Link>
      <button className={styles.signOut} onClick={signOutUser} type="button">
        sign out
      </button>
    </div>
  );
}
