import { useEffect, useRef } from "react";

// Katakana + a few latin/symbol glyphs, Matrix-style.
const GLYPHS =
  "アァカサタナハマヤラワガザダバパヒフヘホミ0123456789=+*<>/\\|$€".split("");

/**
 * Matrix rain, theme-aware, plain 2D canvas (crisp text, no WebGPU).
 *   dark  — classic falling glyphs, RED instead of green (black hero)
 *   light — WHITE glyphs with a RED glow on the white hero
 * Identical fall speed in both themes.
 */
export default function MatrixRain() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const FONT = 16;
    const SPEED = 0.45; // identical in both themes
    let W = 0, H = 0, cols = 0, drops = [], raf = 0;

    const isLight = () => document.documentElement.dataset.theme === "light";

    function resize() {
      W = canvas.offsetWidth;
      H = canvas.offsetHeight;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(W / FONT);
      drops = Array.from({ length: cols }, () => (Math.random() * -H) / FONT);
      ctx.clearRect(0, 0, W, H);
    }
    resize();
    window.addEventListener("resize", resize);

    function draw() {
      const light = isLight();
      // fade the prior frame toward the hero background -> long trailing tails
      ctx.fillStyle = light ? "rgba(255,255,255,0.055)" : "rgba(10,10,10,0.06)";
      ctx.fillRect(0, 0, W, H);

      ctx.font = `600 ${FONT}px "JetBrains Mono", ui-monospace, monospace`;
      ctx.textBaseline = "top";

      for (let i = 0; i < cols; i++) {
        const ch = GLYPHS[(Math.random() * GLYPHS.length) | 0];
        const x = i * FONT;
        const y = drops[i] * FONT;

        if (light) {
          // white glyphs + red glow -> red ghost glyphs on the white hero
          ctx.shadowColor = "rgba(229,53,43,0.95)";
          ctx.shadowBlur = 8;
          ctx.fillStyle = "rgba(255,255,255,0.95)";
        } else {
          // classic matrix, red shade: white-hot head + red trail + red glow on black
          ctx.shadowColor = "rgba(229,53,43,0.9)";
          ctx.shadowBlur = 7;
          ctx.fillStyle = Math.random() > 0.94 ? "#ffd9d5" : "#ff4b40";
        }
        ctx.fillText(ch, x, y);

        if (y > H && Math.random() > 0.975) drops[i] = (Math.random() * -22) | 0;
        drops[i] += SPEED;
      }
      ctx.shadowBlur = 0;
      raf = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className="matrix" aria-hidden="true" />;
}
