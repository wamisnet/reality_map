import styles from "./Frame.module.css";

export default function Frame() {
  return (
    <div className={styles.frame}>
      <div className={`${styles.corner} ${styles.tl}`} />
      <div className={`${styles.corner} ${styles.tr}`} />
      <div className={`${styles.corner} ${styles.bl}`} />
      <div className={`${styles.corner} ${styles.br}`} />
    </div>
  );
}
