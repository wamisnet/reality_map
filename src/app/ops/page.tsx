import type { Metadata } from "next";
import CrosshairScanApp from "@/components/CrosshairScanApp";
import { LoginGate, UserBar } from "@/components/LoginGate";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Ops Console · 咲月わみの旅ガチャ",
};

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
