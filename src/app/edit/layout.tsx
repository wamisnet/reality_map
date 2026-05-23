import EditNav from "@/components/edit/EditNav";
import { LoginGate } from "@/components/LoginGate";
import styles from "./layout.module.css";

export default function EditLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LoginGate>
      <div className={styles.shell}>
        <EditNav />
        {children}
      </div>
    </LoginGate>
  );
}
