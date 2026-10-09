"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Ícones preenchidos (sólidos) e controles compartilhados. */
const PATHS = {
  edit: "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z",
  copy: "M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z",
  trash: "M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z",
  close: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z",
  plus: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z",
  check: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z",
  dot: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z",
  left: "M15 5.5v13a1 1 0 0 1-1.6.8l-8.7-6.5a1 1 0 0 1 0-1.6l8.7-6.5A1 1 0 0 1 15 5.5z",
  up: "M5.5 15h13a1 1 0 0 0 .8-1.6l-6.5-8.7a1 1 0 0 0-1.6 0l-6.5 8.7A1 1 0 0 0 5.5 15z",
  warn: "M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z",
  info: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z",
  down: "M5.5 9h13a1 1 0 0 1 .8 1.6l-6.5 8.7a1 1 0 0 1-1.6 0l-6.5-8.7A1 1 0 0 1 5.5 9z",
  clock: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z",
  draft: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z",
  bolt: "M7 2v11h3v9l7-12h-4l4-8z",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, className = "" }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={`ico ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Controle segmentado: um indicador vermelho desliza até a opção escolhida. */
export function SegControl<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { v: T; t: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  const idx = Math.max(0, options.findIndex((o) => o.v === value));
  return (
    <div className="seg" role="radiogroup" aria-label={label} style={{ "--n": options.length, "--i": idx } as React.CSSProperties}>
      <span className="seg-thumb" aria-hidden />
      {options.map((o) => (
        <button key={o.v} type="button" role="radio" aria-checked={value === o.v} className={value === o.v ? "on" : ""} onClick={() => onChange(o.v)}>
          {o.t}
        </button>
      ))}
    </div>
  );
}

export interface Opt {
  value: string;
  label: string;
  dot?: string; // cor do marcador (opcional)
  icon?: IconName; // ícone preenchido (opcional)
  tone?: "warn" | "good" | "bad" | "muted"; // cor semântica
}

export const STATUS_OPTS: Opt[] = [
  { value: "Em análise", label: "Em análise", icon: "clock", tone: "warn" },
  { value: "Aprovado", label: "Aprovado", icon: "check", tone: "good" },
  { value: "Reprovado", label: "Reprovado", icon: "close", tone: "bad" },
  { value: "Rascunho", label: "Rascunho", icon: "draft", tone: "muted" },
];

/**
 * Seletor próprio (no lugar do <select> do navegador, que não aceita estilo).
 * Teclado: ↑ ↓ Home End Enter Espaço Esc. A lista abre num portal, sem ser cortada por painéis.
 */
export function Select({
  value,
  options,
  onChange,
  label,
  variant = "field",
}: {
  value: string;
  options: Opt[];
  onChange: (v: string) => void;
  label: string;
  variant?: "field" | "pill";
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [box, setBox] = useState<{ left: number; top: number; width: number; up: boolean } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLUListElement>(null);
  const id = useId();
  const sel = options.find((o) => o.value === value);

  const abrir = useCallback(() => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const h = Math.min(280, options.length * 40 + 12);
    const up = window.innerHeight - r.bottom < h + 12 && r.top > h + 12;
    setBox({ left: r.left, top: up ? r.top - 6 : r.bottom + 6, width: Math.max(r.width, 180), up });
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  }, [options, value]);
  const fechar = useCallback(() => setOpen(false), []);
  const escolher = (v: string) => {
    onChange(v);
    setOpen(false);
    btn.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const fora = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btn.current?.contains(t) && !pop.current?.contains(t)) setOpen(false);
    };
    const sai = (e: Event) => {
      if (pop.current && e.target instanceof Node && pop.current.contains(e.target)) return; // rolagem da própria lista
      setOpen(false);
    };
    document.addEventListener("mousedown", fora);
    window.addEventListener("resize", sai);
    window.addEventListener("scroll", sai, true);
    return () => {
      document.removeEventListener("mousedown", fora);
      window.removeEventListener("resize", sai);
      window.removeEventListener("scroll", sai, true);
    };
  }, [open]);

  useEffect(() => {
    if (open) pop.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const onKey = (e: React.KeyboardEvent) => {
    const k = e.key;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(k)) {
        e.preventDefault();
        abrir();
      }
      return;
    }
    if (k === "Escape" || k === "Tab") {
      if (k === "Escape") e.preventDefault(); // não fecha o painel de edição junto
      fechar();
    } else if (k === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(options.length - 1, a + 1));
    } else if (k === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (k === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (k === "End") {
      e.preventDefault();
      setActive(options.length - 1);
    } else if (k === "Enter" || k === " ") {
      e.preventDefault();
      escolher(options[active].value);
    }
  };

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={`sel ${variant}`}
        data-tone={sel?.tone}
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => (open ? fechar() : abrir())}
        onKeyDown={onKey}
      >
        {sel?.icon && <Icon key={sel.value} name={sel.icon} size={variant === "pill" ? 18 : 17} className="sel-i" />}
        {sel?.dot && <span className="sdot" style={{ background: sel.dot }} />}
        <span className="sel-v">{sel?.label ?? ""}</span>
        <Icon name="down" size={13} className="caret" />
      </button>
      {open &&
        box &&
        createPortal(
          <ul
            ref={pop}
            id={id}
            role="listbox"
            aria-label={label}
            className={`sel-pop${box.up ? " up" : ""}`}
            style={{ left: box.left, minWidth: box.width, ...(box.up ? { bottom: window.innerHeight - box.top } : { top: box.top }) }}
          >
            {options.map((o, i) => (
              <li
                key={o.value || "_"}
                role="option"
                aria-selected={o.value === value}
                data-active={i === active}
                className={`sel-opt${i === active ? " active" : ""}`}
                data-tone={o.tone}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => escolher(o.value)}
              >
                {o.icon && <Icon name={o.icon} size={18} className="sel-i" />}
                {o.dot && <span className="sdot" style={{ background: o.dot }} />}
                <span className="sel-v">{o.label}</span>
                {o.value === value && <Icon name="check" size={18} className="ok" />}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </>
  );
}
