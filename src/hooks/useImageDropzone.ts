import { useCallback, useRef, useState } from "react";

function extractImageFiles(dt: DataTransfer | null): File[] {
  if (!dt) return [];
  const out: File[] = [];
  if (dt.files && dt.files.length > 0) {
    for (const f of Array.from(dt.files)) {
      if (f.type.startsWith("image/")) out.push(f);
    }
    if (out.length > 0) return out;
    // 拡張子が空のケース等のフォールバック (1枚だけ採用)
    if (dt.files[0]) return [dt.files[0]];
    return [];
  }
  if (dt.items && dt.items.length > 0) {
    for (const it of Array.from(dt.items)) {
      if (it.kind === "file") {
        const f = it.getAsFile();
        if (f && f.type.startsWith("image/")) out.push(f);
      }
    }
  }
  return out;
}

interface Options {
  enabled?: boolean;
  /**
   * ドロップされた各画像に対して順番に呼ばれる。
   * uploadCandidateImage を直列で await したい場合は、呼び出し側で
   * Promise を await するなどして直列化する。
   */
  onFile: (file: File) => void | Promise<void>;
  /**
   * true なら複数の画像ファイルが落とされた場合に全てに対して onFile を呼ぶ。
   * false (default) なら最初の 1 枚だけ。
   */
  multi?: boolean;
}

export interface DropzoneHandlers {
  onDragEnter: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

export function useImageDropzone({
  enabled = true,
  onFile,
  multi = false,
}: Options): {
  isOver: boolean;
  handlers: DropzoneHandlers;
} {
  const [isOver, setIsOver] = useState(false);
  const depthRef = useRef(0);

  const reset = useCallback(() => {
    depthRef.current = 0;
    setIsOver(false);
  }, []);

  const onDragEnter = useCallback(
    (e: React.DragEvent) => {
      if (!enabled) return;
      e.preventDefault();
      e.stopPropagation();
      depthRef.current += 1;
      setIsOver(true);
    },
    [enabled],
  );

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!enabled) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    },
    [enabled],
  );

  const onDragLeave = useCallback(
    (e: React.DragEvent) => {
      if (!enabled) return;
      e.preventDefault();
      e.stopPropagation();
      depthRef.current = Math.max(0, depthRef.current - 1);
      if (depthRef.current === 0) setIsOver(false);
    },
    [enabled],
  );

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      if (!enabled) {
        reset();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      reset();
      const files = extractImageFiles(e.dataTransfer);
      if (files.length === 0) return;
      if (multi) {
        // 直列で順番に処理 (form state が前のアップロードを取り込んでから次へ)
        for (const f of files) {
          await onFile(f);
        }
      } else {
        await onFile(files[0]);
      }
    },
    [enabled, onFile, multi, reset],
  );

  return { isOver, handlers: { onDragEnter, onDragOver, onDragLeave, onDrop } };
}
