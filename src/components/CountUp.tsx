"use client";
import { useEffect, useRef, useState } from "react";
import { R } from "@/lib/format";

/** Valor em R$ que "conta" até o novo número quando muda (e pisca de leve). */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const [bump, setBump] = useState(0);
  const from = useRef(value);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      from.current = value;
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      from.current = value;
      return;
    }
    const a = from.current;
    const t0 = performance.now();
    const dur = 650;
    setBump((b) => b + 1);
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 4); // ease-out
      const v = a + (value - a) * e;
      setShown(v);
      from.current = v;
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <span key={bump} className={`${className ?? ""}${bump ? " is-bump" : ""}`}>
      {R(shown)}
    </span>
  );
}
