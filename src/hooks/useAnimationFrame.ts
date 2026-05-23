import { useEffect, useRef } from "react";

type Cb = (dt: number, t: number) => void;

export function useAnimationFrame(cb: Cb) {
  const cbRef = useRef<Cb>(cb);

  useEffect(() => {
    cbRef.current = cb;
  }, [cb]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      cbRef.current(dt, t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
}
