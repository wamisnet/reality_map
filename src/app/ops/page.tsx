import CrosshairScanApp from "@/components/CrosshairScanApp";
import { LoginGate, UserBar } from "@/components/LoginGate";
import styles from "./page.module.css";

export default function OpsPage() {
  return (
    <div className={styles.root}>
      <LoginGate>
        <UserBar />
        <CrosshairScanApp />
      </LoginGate>
    </div>
  );
}
