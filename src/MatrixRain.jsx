import { useEffect, useRef } from "react";

// Half-width katakana (the film uses mirrored kana) + a few digits/symbols.
const GLYPHS =
  "ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵｱｦｲﾘﾁﾄﾉﾌﾗﾙﾚﾛﾝｶｷｸｹｺ0123456789Z:=*+<>".split("");

/**
 * Matrix rain, film-accurate scale + cadence (plain 2D canvas, crisp text).
 *   dark  — classic falling glyphs, RED instead of green (black hero)
 *   light — crisp red glyphs on the white hero
 * Big glyphs, slow time-based fall — identical speed in both themes and at any FPS.
 */
const FONT = 26;   // glyph cell size — movie scale
const FALL = 8;    // cells per second — slow, hypnotic like the film

export default function MatrixRain() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0, cols = 0, drops = [], rows = [], chars = [], raf = 0, last = 0;

    const isLight = () => document.documentElement.dataset.theme === "light";
    const pick = () => GLYPHS[(Math.random() * GLYPHS.length) | 0];

    function resize() {
      W = canvas.offsetWidth;
      H = canvas.offsetHeight;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(W / FONT);
      drops = Array.from({ length: cols }, () => (-Math.random() * H) / FONT);
      rows = Array(cols).fill(-9999);
      chars = Array.from({ length: cols }, pick);
      ctx.clearRect(0, 0, W, H);
    }
    resize();
    window.addEventListener("resize", resize);

    function frame(now) {
      if (!last) last = now;
      const dt = Math.min((now - last) / 1000, 0.05); // clamp tab-switch jumps
      last = now;
      const light = isLight();

      // fade prior frame toward the hero background -> long trailing tails
      ctx.fillStyle = light ? "rgba(255,255,255,0.05)" : "rgba(10,10,10,0.055)";
      ctx.fillRect(0, 0, W, H);

      ctx.font = `600 ${FONT}px "JetBrains Mono", ui-monospace, monospace`;
      ctx.textBaseline = "top";

      for (let i = 0; i < cols; i++) {
        drops[i] += FALL * dt;            // advance in cells/second
        const row = Math.floor(drops[i]);
        if (row !== rows[i]) {            // entered a new cell -> new glyph
          rows[i] = row;
          chars[i] = pick();
        }
        if (row >= 0) {
          const x = i * FONT;
          const y = row * FONT;
          if (light) {
            ctx.shadowColor = "rgba(229,53,43,0.9)";
            ctx.shadowBlur = 2;
            ctx.fillStyle = "#ff453a";
          } else {
            ctx.shadowColor = "rgba(229,53,43,0.7)";
            ctx.shadowBlur = 3;
            ctx.fillStyle = "#ff4338";
          }
          ctx.fillText(chars[i], x, y);   // head redrawn each frame -> stays bright
        }
        if (row * FONT > H && Math.random() > 0.985) {
          drops[i] = -Math.random() * 8;
          rows[i] = -9999;
        }
      }
      ctx.shadowBlur = 0;
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className="matrix" aria-hidden="true" />;
}
