import { useEffect, useRef } from "react";

const GLYPHS =
  "ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵｱｦｲﾘﾁﾄﾉﾌﾗﾙﾚﾛﾝｶｷｸｹｺ0123456789Z:=*+<>".split("");

const FONT = 24;
const FALL = 11;
const FLASH_PROB = 0.001;
const FLASH_MS_MIN = 2200;
const FLASH_MS_MAX = 3800;
const FLASH_MESSAGES = ["TENET", "NETWORK", "EXPERTS", "SEALED", "PRIVATE", "REAL"];

const asset = (p) => import.meta.env.BASE_URL + p;

export default function MatrixRain() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const hero = canvas?.closest(".hero");
    if (!canvas || !hero) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const maskImg = new Image();

    let W = 0;
    let H = 0;
    let cols = 0;
    let maskRows = 0;
    let drops = [];
    let rows = [];
    let chars = [];
    let stuck = [];
    let mask = null;
    let logoGlyphs = null;
    let raf = 0;
    let last = 0;
    let flashUntil = 0;
    let flashPattern = null;
    let maskGen = 0;

    const isLight = () => document.documentElement.dataset.theme === "light";
    const pick = () => GLYPHS[(Math.random() * GLYPHS.length) | 0];
    const logoSrc = () => asset(isLight() ? "logo/logo-black.webp" : "logo/logo-red.webp");
    const mi = (col, row) => row * cols + col;

    function resetColumns() {
      drops = Array.from({ length: cols }, () => (-Math.random() * H) / FONT);
      rows = Array(cols).fill(-9999);
      chars = Array.from({ length: cols }, pick);
      stuck = Array(cols).fill(-1);
    }

    function triggerFlash(now) {
      if (!cols || flashUntil > now) return;
      const text = FLASH_MESSAGES[(Math.random() * FLASH_MESSAGES.length) | 0];
      const colStart = Math.max(0, ((Math.random() * Math.max(1, cols - text.length - 2)) | 0));
      const row = Math.max(2, Math.min(maskRows - 3, ((maskRows * 0.38 + Math.random() * maskRows * 0.22) | 0)));
      const duration = FLASH_MS_MIN + Math.random() * (FLASH_MS_MAX - FLASH_MS_MIN);
      flashPattern = { text, colStart, row, start: now, duration };
      flashUntil = now + duration;
    }

    function flashOverlay(col, row, now) {
      if (!flashPattern || now >= flashUntil) return null;
      const { text, colStart, row: baseRow, start, duration } = flashPattern;
      const t = (now - start) / duration;
      if (t >= 1) return null;
      const fade = t < 0.12 ? t / 0.12 : t > 0.82 ? (1 - t) / 0.18 : 1;
      if (fade < 0.15) return null;
      const rel = col - colStart;
      if (rel < 0 || rel >= text.length) return null;
      if (row !== baseRow && row !== baseRow + 1) return null;
      return { char: text[rel], fade };
    }

    function collisionRow(col, fromRow, toRow) {
      if (!mask) return -1;
      const start = Math.max(0, Math.ceil(fromRow));
      const end = Math.floor(toRow);
      for (let r = start; r <= end; r++) {
        if (r >= 0 && r < maskRows && mask[mi(col, r)] > 0) return r;
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
      logoGlyphs = new Array(cols * maskRows);

      const anchor = hero.querySelector(".matrix-logo-anchor");
      if (!anchor) {
        resetColumns();
        return;
      }

      const heroRect = hero.getBoundingClientRect();
      const anchorRect = anchor.getBoundingClientRect();
      const ox = anchorRect.left - heroRect.left;
      const oy = anchorRect.top - heroRect.top;
      const aw = anchorRect.width;
      const ah = anchorRect.height;

      const off = document.createElement("canvas");
      off.width = Math.max(1, Math.floor(W));
      off.height = Math.max(1, Math.floor(H));
      const octx = off.getContext("2d");

      const applyMask = () => {
        if (gen !== maskGen) return;
        octx.clearRect(0, 0, off.width, off.height);
        octx.drawImage(maskImg, ox, oy, aw, ah);
        const img = octx.getImageData(0, 0, off.width, off.height).data;
        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < maskRows; r++) {
            const cx = Math.min(off.width - 1, Math.floor(c * FONT + FONT * 0.5));
            const cy = Math.min(off.height - 1, Math.floor(r * FONT + FONT * 0.5));
            const idx = (cy * off.width + cx) * 4;
            const alpha = img[idx + 3];
            if (alpha > 40) {
              const i = mi(c, r);
              mask[i] = alpha;
              logoGlyphs[i] = pick();
            }
          }
        }
        resetColumns();
        ctx.clearRect(0, 0, W, H);
      };

      const src = logoSrc();
      if (maskImg.src !== src) maskImg.src = src;
      if (maskImg.complete && maskImg.naturalWidth > 0) applyMask();
      else {
        maskImg.onload = applyMask;
        maskImg.onerror = () => {
          if (gen === maskGen) resetColumns();
        };
      }
    }

    function drawGlyph(x, y, ch, { head = false, logo = false, flash = 1 } = {}) {
      const light = isLight();
      const boost = logo ? 1.35 : head ? 1.15 : 1;
      const alpha = Math.min(1, flash * boost);
      if (light) {
        ctx.shadowColor = `rgba(229,53,43,${0.55 * alpha})`;
        ctx.shadowBlur = logo ? 1.5 : head ? 2 : 1;
        ctx.fillStyle = logo
          ? `rgba(20,20,20,${0.92 * alpha})`
          : `rgba(255,69,58,${(head ? 0.98 : 0.82) * alpha})`;
      } else {
        ctx.shadowColor = `rgba(229,53,43,${0.65 * alpha})`;
        ctx.shadowBlur = logo ? 2 : head ? 2.5 : 1.5;
        ctx.fillStyle = logo
          ? `rgba(255,95,85,${0.98 * alpha})`
          : `rgba(255,67,56,${(head ? 1 : 0.88) * alpha})`;
      }
      ctx.fillText(ch, x, y);
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
      ctx.fillStyle = light ? "rgba(255,255,255,0.06)" : "rgba(10,10,10,0.06)";
      ctx.fillRect(0, 0, W, H);

      ctx.font = `600 ${FONT}px "JetBrains Mono", ui-monospace, monospace`;
      ctx.textBaseline = "top";

      if (mask) {
        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < maskRows; r++) {
            const i = mi(c, r);
            if (!mask[i]) continue;
            const flash = flashOverlay(c, r, now);
            const ch = flash?.char ?? logoGlyphs[i] ?? pick();
            drawGlyph(c * FONT, r * FONT, ch, { logo: true, flash: flash?.fade ?? 1 });
          }
        }
      }

      for (let i = 0; i < cols; i++) {
        if (stuck[i] >= 0) {
          const y = stuck[i] * FONT;
          const flash = flashOverlay(i, stuck[i], now);
          drawGlyph(i * FONT, y, flash?.char ?? chars[i], { head: true, flash: flash?.fade ?? 1 });
          continue;
        }

        const prevRow = Math.floor(drops[i]);
        drops[i] += FALL * dt;
        let row = Math.floor(drops[i]);

        const hit = collisionRow(i, prevRow, row);
        if (hit >= 0) {
          stuck[i] = hit;
          row = hit;
          drops[i] = hit;
        }

        if (row !== rows[i]) {
          rows[i] = row;
          chars[i] = pick();
          if (Math.random() < FLASH_PROB) triggerFlash(now);
        }

        if (row >= 0) {
          const flash = flashOverlay(i, row, now);
          drawGlyph(i * FONT, row * FONT, flash?.char ?? chars[i], {
            head: true,
            flash: flash?.fade ?? 1,
          });
        }

        if (row * FONT > H + FONT && Math.random() > 0.98) {
          drops[i] = -Math.random() * 10;
          rows[i] = -9999;
        }
      }

      ctx.shadowBlur = 0;
      if (now >= flashUntil) flashPattern = null;
      raf = requestAnimationFrame(frame);
    }

    buildMask();
    window.addEventListener("resize", buildMask);
    const themeObs = new MutationObserver(() => buildMask());
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", buildMask);
      themeObs.disconnect();
      maskImg.onload = null;
      maskImg.onerror = null;
    };
  }, []);

  return <canvas ref={ref} className="matrix" aria-hidden="true" />;
}
