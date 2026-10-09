"use client";
import { useEffect } from "react";

const STEP = 90; // ms entre elementos vizinhos

/** Atraso em diagonal (linha + coluna), como numa grade que "energiza" aos poucos. */
function cascade(els: HTMLElement[]) {
  const groups = new Map<Element, HTMLElement[]>();
  els.forEach((el) => {
    const k = el.parentElement as Element;
    groups.set(k, [...(groups.get(k) ?? []), el]);
  });
  groups.forEach((list) => {
    const pos = list.map((el) => {
      const b = el.getBoundingClientRect();
      return [Math.round(b.top / 8), Math.round(b.left / 8)];
    });
    const rows = [...new Set(pos.map((p) => p[0]))].sort((a, b) => a - b);
    const cols = [...new Set(pos.map((p) => p[1]))].sort((a, b) => a - b);
    list.forEach((el, i) => {
      const d = (rows.indexOf(pos[i][0]) + cols.indexOf(pos[i][1])) * STEP;
      el.style.setProperty("--d", d + "ms");
    });
  });
}

/**
 * Efeitos globais, sem dependências:
 *  - revelação por rolagem de tudo que tem [data-anim] (inclusive elementos criados depois);
 *  - cabeçalho com sombra ao rolar, que some ao descer e volta ao subir;
 */
export function Motion() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const head = document.querySelector<HTMLElement>(".site-head");
    let lastY = window.scrollY;
    let ticking = false;

    const onScroll = () => {
      const y = window.scrollY;
      if (head) {
        head.classList.toggle("is-scrolled", y > 24);
        if (!reduce) {
          if (y > 480 && y > lastY + 4) head.classList.add("is-hidden");
          if (y < lastY - 4) head.classList.remove("is-hidden");
        }
      }
      lastY = y;
      ticking = false;
    };
    const onScrollRaf = () => {
      if (!ticking) {
        requestAnimationFrame(onScroll);
        ticking = true;
      }
    };
    window.addEventListener("scroll", onScrollRaf, { passive: true });
    onScroll();

    // depois de entrar, o atributo sai: libera hover e foco sem máscara/transformação presa
    const done = (el: HTMLElement) => {
      const delay = parseInt(el.style.getPropertyValue("--d"), 10) || 0;
      setTimeout(() => el.removeAttribute("data-anim"), delay + 1600);
    };
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).map((e) => e.target as HTMLElement);
        if (!vis.length) return;
        cascade(vis);
        vis.forEach((el) => {
          el.classList.add("is-in");
          io.unobserve(el);
          done(el);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    const seen = new WeakSet<Element>();
    const watch = (root: ParentNode) => {
      root.querySelectorAll<HTMLElement>("[data-anim]").forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        if (reduce) el.removeAttribute("data-anim");
        else io.observe(el);
      });
    };
    watch(document);
    const mo = new MutationObserver((muts) => {
      muts.forEach((m) =>
        m.addedNodes.forEach((n) => {
          if (!(n instanceof HTMLElement)) return;
          if (n.hasAttribute("data-anim") && !seen.has(n)) {
            seen.add(n);
            if (reduce) n.removeAttribute("data-anim");
            else io.observe(n);
          }
          watch(n);
        }),
      );
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener("scroll", onScrollRaf);
      io.disconnect();
      mo.disconnect();
    };
  }, []);

  return null;
}
