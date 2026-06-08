import { useEffect, useRef } from "react";

const GLYPHS =
  "ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵｱｦｲﾘﾁﾄﾉﾌﾗﾙﾚﾛﾝｶｷｸｹｺ0123456789Z:=*+<>".split("");

/**
 * Matrix rain behind the halftone hero wordmark.
 * Glyphs stop before the logo silhouette so they never paint over it.
 */
const FONT = 26;
const FALL = 8;

export default function MatrixRain() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const hero = canvas?.closest(".hero");
    if (!canvas || !hero) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let W = 0;
    let H = 0;
    let cols = 0;
    let maskRows = 0;
    let drops = [];
    let rows = [];
    let chars = [];
    let stuck = [];
    let mask = null;
    let raf = 0;
    let last = 0;
    let maskGen = 0;

    const isLight = () => document.documentElement.dataset.theme === "light";
    const pick = () => GLYPHS[(Math.random() * GLYPHS.length) | 0];
    const mi = (col, row) => row * cols + col;
    const logoEl = () => hero.querySelector('[data-testid="tenet-logo-hero"]');

    function resetColumns() {
      drops = Array.from({ length: cols }, () => (-Math.random() * H) / FONT);
      rows = Array(cols).fill(-9999);
      chars = Array.from({ length: cols }, pick);
      stuck = Array(cols).fill(-1);
    }

    function masked(col, row) {
      return mask && row >= 0 && row < maskRows && mask[mi(col, row)] > 0;
    }

    function collisionRow(col, fromRow, toRow) {
      if (!mask) return -1;
      const start = Math.max(0, Math.ceil(fromRow));
      const end = Math.floor(toRow);
      for (let r = start; r <= end; r++) {
        if (r < maskRows && mask[mi(col, r)] > 0) return r;
      }
      return -1;
    }

    function buildMask() {
      const gen = ++maskGen;
      W = canvas.offsetWidth;
      H = canvas.offsetHeight;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      cols = Math.max(1, Math.ceil(W / FONT));
      maskRows = Math.max(1, Math.ceil(H / FONT) + 1);
      mask = new Uint8Array(cols * maskRows);

      const img = logoEl();
      if (!img || !img.complete || img.naturalWidth === 0) {
        resetColumns();
        return;
      }

      const heroRect = hero.getBoundingClientRect();
      const logoRect = img.getBoundingClientRect();
      const ox = logoRect.left - heroRect.left;
      const oy = logoRect.top - heroRect.top;
      const aw = logoRect.width;
      const ah = logoRect.height;

      const off = document.createElement("canvas");
      off.width = Math.max(1, Math.floor(W));
      off.height = Math.max(1, Math.floor(H));
      const octx = off.getContext("2d");
      octx.clearRect(0, 0, off.width, off.height);
      octx.drawImage(img, ox, oy, aw, ah);

      const data = octx.getImageData(0, 0, off.width, off.height).data;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < maskRows; r++) {
          const cx = Math.min(off.width - 1, Math.floor(c * FONT + FONT * 0.5));
          const cy = Math.min(off.height - 1, Math.floor(r * FONT + FONT * 0.5));
          const idx = (cy * off.width + cx) * 4;
          const alpha = data[idx + 3];
          if (alpha > 40) mask[mi(c, r)] = alpha;
        }
      }

      if (gen === maskGen) {
        resetColumns();
        ctx.clearRect(0, 0, W, H);
      }
    }

    function drawGlyph(x, y, ch, head = false) {
      const light = isLight();
      if (light) {
        ctx.shadowColor = "rgba(229,53,43,0.9)";
        ctx.shadowBlur = head ? 2 : 1;
        ctx.fillStyle = "#ff453a";
      } else {
        ctx.shadowColor = "rgba(229,53,43,0.7)";
        ctx.shadowBlur = head ? 3 : 1.5;
        ctx.fillStyle = "#ff4338";
      }
      ctx.fillText(ch, x, y);
    }

    function scheduleMask() {
      const img = logoEl();
      if (!img) {
        buildMask();
        return;
      }
      if (img.complete && img.naturalWidth > 0) buildMask();
      else img.addEventListener("load", buildMask, { once: true });
    }

    function frame(now) {
      if (!last) last = now;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      if (!cols) {
        raf = requestAnimationFrame(frame);
        return;
      }

      const light = isLight();
      ctx.fillStyle = light ? "rgba(255,255,255,0.05)" : "rgba(10,10,10,0.055)";
      ctx.fillRect(0, 0, W, H);

      ctx.font = `600 ${FONT}px "JetBrains Mono", ui-monospace, monospace`;
      ctx.textBaseline = "top";

      for (let i = 0; i < cols; i++) {
        if (stuck[i] >= 0) {
          if (!masked(i, stuck[i])) {
            drawGlyph(i * FONT, stuck[i] * FONT, chars[i], true);
          }
          continue;
        }

        const prevRow = Math.floor(drops[i]);
        drops[i] += FALL * dt;
        let row = Math.floor(drops[i]);

        const hit = collisionRow(i, prevRow, row);
        if (hit >= 0) {
          const stopRow = hit - 1;
          if (stopRow >= 0 && !masked(i, stopRow)) {
            stuck[i] = stopRow;
            row = stopRow;
            drops[i] = stopRow;
          } else {
            drops[i] = -Math.random() * 10;
            rows[i] = -9999;
            continue;
          }
        }

        if (row !== rows[i]) {
          rows[i] = row;
          chars[i] = pick();
        }

        if (row >= 0 && !masked(i, row)) {
          drawGlyph(i * FONT, row * FONT, chars[i], true);
        }

        if (row * FONT > H + FONT && Math.random() > 0.985) {
          drops[i] = -Math.random() * 8;
          rows[i] = -9999;
        }
      }

      ctx.shadowBlur = 0;
      raf = requestAnimationFrame(frame);
    }

    scheduleMask();
    window.addEventListener("resize", scheduleMask);
    const themeObs = new MutationObserver(scheduleMask);
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", scheduleMask);
      themeObs.disconnect();
      const img = logoEl();
      if (img) img.removeEventListener("load", buildMask);
    };
  }, []);

  return <canvas ref={ref} className="matrix" aria-hidden="true" />;
}
