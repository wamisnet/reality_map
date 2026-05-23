import styles from "./SpeechBubble.module.css";

interface Props {
  children: React.ReactNode;
  pointer?: "left" | "right" | "bottom";
  tone?: "cream" | "pink" | "mint";
  className?: string;
}

const TONE_CLASS = {
  cream: styles.cream,
  pink: styles.pink,
  mint: styles.mint,
};

const POINTER_CLASS = {
  left: styles.pointerLeft,
  right: styles.pointerRight,
  bottom: styles.pointerBottom,
};

export default function SpeechBubble({
  children,
  pointer = "left",
  tone = "cream",
  className,
}: Props) {
  return (
    <div
      className={[
        styles.root,
        TONE_CLASS[tone],
        POINTER_CLASS[pointer],
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}
