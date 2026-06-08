import { useEffect, useRef } from "react";

/**
 * Instanced WebGPU matrix rain (glyph atlas + quads). Falls back to atlas blits on 2D canvas.
 * Renders at a reduced internal resolution and scales up via CSS to keep fill-rate low.
 */
const GLYPHS =
  "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン" +
  "ガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポヴ" +
  "0123456789";

const ATLAS_COLS = 16;
const CELL = 28;
const ATLAS_ROWS = Math.ceil(GLYPHS.length / ATLAS_COLS);
const ATLAS_W = ATLAS_COLS * CELL;
const ATLAS_H = ATLAS_ROWS * CELL;
const MAX_INSTANCES = 3072;

const GLYPH_WGSL = /* wgsl */ `
struct Uniforms {
  canvas: vec2f,
  atlasGrid: vec2f,
  pointer: vec2f,
  ripple: vec4f,
  flags: vec4f,
};

struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
  @location(1) alpha: f32,
  @location(2) pixelPos: vec2f,
};

@group(0) @binding(0) var<uniform> U: Uniforms;
@group(0) @binding(1) var glyphTex: texture_2d<f32>;
@group(0) @binding(2) var glyphSamp: sampler;

@vertex
fn vs_glyph(
  @location(0) corner: vec2f,
  @location(1) offset: vec2f,
  @location(2) glyphIdx: f32,
  @location(3) alpha: f32,
) -> VSOut {
  let size = vec2f(${CELL}.0, ${CELL}.0);
  let px = offset + corner * size;
  var out: VSOut;
  out.pos = vec4f((px.x / U.canvas.x) * 2.0 - 1.0, 1.0 - (px.y / U.canvas.y) * 2.0, 0.0, 1.0);
  out.pixelPos = px;
  let col = glyphIdx - floor(glyphIdx / U.atlasGrid.x) * U.atlasGrid.x;
  let row = floor(glyphIdx / U.atlasGrid.x);
  let cell = vec2f(1.0 / U.atlasGrid.x, 1.0 / U.atlasGrid.y);
  out.uv = vec2f(col, row) * cell + corner * cell;
  out.alpha = alpha;
  return out;
}

@fragment
fn fs_glyph(in: VSOut) -> @location(0) vec4f {
  let s = textureSample(glyphTex, glyphSamp, in.uv).r;
  if (s < 0.06) { discard; }

  let dx = in.pixelPos.x - U.pointer.x;
  let dy = in.pixelPos.y - U.pointer.y;
  let d2 = dx * dx + dy * dy;
  let near = exp(-d2 * (1.0 / 28800.0)) * 0.45;

  let rdx = in.pixelPos.x - U.ripple.x;
  let rdy = in.pixelPos.y - U.ripple.y;
  let rd2 = rdx * rdx + rdy * rdy;
  let ripple = exp(-rd2 / max(U.ripple.z * U.ripple.z, 1.0)) * U.ripple.w * 0.55;

  let light = U.flags.x > 0.5;
  if (light) {
    let core = smoothstep(0.28, 0.92, s);
    var rgb = mix(vec3f(0.898, 0.208, 0.165), vec3f(1.0), core);
    rgb = mix(rgb, vec3f(1.0, 0.45, 0.38), near + ripple * 0.6);
    return vec4f(rgb * s, s * in.alpha * 0.82);
  }

  var rgb = vec3f(0.898, 0.208, 0.165);
  rgb.r += near * 0.12 + ripple * 0.08;
  rgb.g += near * 0.22;
  rgb.b += near * 0.06;
  rgb = mix(rgb, vec3f(1.0, 0.55, 0.48), near + ripple);
  return vec4f(rgb * s, s * in.alpha * 0.9);
}
`;

const FADE_WGSL = /* wgsl */ `
struct Uniforms {
  canvas: vec2f,
  atlasGrid: vec2f,
  pointer: vec2f,
  ripple: vec4f,
  flags: vec4f,
};
@group(0) @binding(0) var<uniform> U: Uniforms;
@vertex fn vs_fade(@location(0) p: vec2f) -> @builtin(position) vec4f { return vec4f(p, 0.0, 1.0); }
@fragment fn fs_fade() -> @location(0) vec4f {
  if (U.flags.x > 0.5) {
    return vec4f(1.0, 1.0, 1.0, 0.09);
  }
  return vec4f(0.039, 0.039, 0.039, 0.11);
}
`;

let atlasCanvas = null;

function randGlyph() {
  return (Math.random() * GLYPHS.length) | 0;
}

function buildAtlas() {
  if (atlasCanvas) return atlasCanvas;
  const c = document.createElement("canvas");
  c.width = ATLAS_W;
  c.height = ATLAS_H;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, ATLAS_W, ATLAS_H);
  ctx.fillStyle = "#fff";
  ctx.font = `500 ${Math.floor(CELL * 0.78)}px "Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < GLYPHS.length; i++) {
    const col = i % ATLAS_COLS;
    const row = (i / ATLAS_COLS) | 0;
    ctx.fillText(GLYPHS[i], col * CELL + CELL / 2, row * CELL / 2 + 1);
  }
  atlasCanvas = c;
  return c;
}

function glyphAtlasRect(glyphIdx) {
  const i = glyphIdx | 0;
  const col = i % ATLAS_COLS;
  const row = (i / ATLAS_COLS) | 0;
  return { sx: col * CELL, sy: row * CELL };
}

function makeColumns(count, height) {
  const cols = new Array(count);
  for (let c = 0; c < count; c++) {
    const trail = 10 + ((Math.random() * 6) | 0);
    const chars = new Uint16Array(20);
    for (let k = 0; k < chars.length; k++) chars[k] = randGlyph();
    cols[c] = {
      head: Math.random() * (height + trail * CELL) - trail * CELL * 0.35,
      speed: 0.45 + Math.random() * 0.55,
      trail,
      chars,
    };
  }
  return cols;
}

function renderScale() {
  const coarse = window.matchMedia("(max-width: 820px), (pointer: coarse)").matches;
  const dpr = window.devicePixelRatio || 1;
  if (coarse) return Math.min(0.72, 1 / dpr);
  return dpr > 1.5 ? 0.82 : 0.92;
}

function maxDpr(scale) {
  return Math.min(window.devicePixelRatio || 1, scale > 0.85 ? 1.75 : 1.5);
}

async function shaderOk(module) {
  const info = await module.getCompilationInfo();
  return info.messages.filter((m) => m.type === "error");
}

function isLightTheme() {
  return document.documentElement.dataset.theme === "light";
}

function themeBg() {
  return isLightTheme() ? "#ffffff" : "#0a0a0a";
}

const UNIFORM_DATA = new Float32Array(16);

function writeUniforms(device, uniformBuf, W, H, pointer, ripple) {
  UNIFORM_DATA[0] = W;
  UNIFORM_DATA[1] = H;
  UNIFORM_DATA[2] = ATLAS_COLS;
  UNIFORM_DATA[3] = ATLAS_ROWS;
  UNIFORM_DATA[4] = pointer.x;
  UNIFORM_DATA[5] = pointer.y;
  UNIFORM_DATA[8] = ripple.x;
  UNIFORM_DATA[9] = ripple.y;
  UNIFORM_DATA[10] = ripple.z;
  UNIFORM_DATA[11] = ripple.w;
  UNIFORM_DATA[12] = isLightTheme() ? 1 : 0;
  device.queue.writeBuffer(uniformBuf, 0, UNIFORM_DATA);
}

async function initWebGPU(canvas) {
  if (!navigator.gpu) return null;
  const lowPower = window.matchMedia("(pointer: coarse)").matches;
  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: lowPower ? "low-power" : "high-performance",
  });
  if (!adapter) return null;

  const device = await adapter.requestDevice();
  const context = canvas.getContext("webgpu");
  if (!context) return null;

  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: "premultiplied" });

  const atlas = buildAtlas();
  const atlasTexture = device.createTexture({
    size: [ATLAS_W, ATLAS_H],
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  const atlasPixels = atlas.getContext("2d").getImageData(0, 0, ATLAS_W, ATLAS_H).data;
  device.queue.writeTexture(
    { texture: atlasTexture },
    atlasPixels,
    { bytesPerRow: ATLAS_W * 4, rowsPerImage: ATLAS_H },
    { width: ATLAS_W, height: ATLAS_H },
  );

  const sampler = device.createSampler({ magFilter: "nearest", minFilter: "nearest" });
  const glyphModule = device.createShaderModule({ code: GLYPH_WGSL });
  const fadeModule = device.createShaderModule({ code: FADE_WGSL });

  const [glyphErrors, fadeErrors] = await Promise.all([shaderOk(glyphModule), shaderOk(fadeModule)]);
  if (glyphErrors.length || fadeErrors.length) {
    device.destroy();
    return null;
  }

  const bindLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
    ],
  });

  const blend = {
    color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
    alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
  };

  const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindLayout] });

  const glyphPipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: {
      module: glyphModule,
      entryPoint: "vs_glyph",
      buffers: [
        { arrayStride: 8, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }] },
        {
          arrayStride: 16,
          stepMode: "instance",
          attributes: [
            { shaderLocation: 1, offset: 0, format: "float32x2" },
            { shaderLocation: 2, offset: 8, format: "float32" },
            { shaderLocation: 3, offset: 12, format: "float32" },
          ],
        },
      ],
    },
    fragment: { module: glyphModule, entryPoint: "fs_glyph", targets: [{ format, blend }] },
    primitive: { topology: "triangle-list" },
  });

  const fadePipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: {
      module: fadeModule,
      entryPoint: "vs_fade",
      buffers: [{ arrayStride: 8, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }] }],
    },
    fragment: { module: fadeModule, entryPoint: "fs_fade", targets: [{ format, blend }] },
    primitive: { topology: "triangle-list" },
  });

  const quad = device.createBuffer({
    size: 24,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
  });
  new Float32Array(quad.getMappedRange()).set([0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1]);
  quad.unmap();

  const fullscreen = device.createBuffer({
    size: 24,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
  });
  new Float32Array(fullscreen.getMappedRange()).set([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1]);
  fullscreen.unmap();

  const uniformBuf = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const instanceBuf = device.createBuffer({
    size: MAX_INSTANCES * 16,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  const bindGroup = device.createBindGroup({
    layout: bindLayout,
    entries: [
      { binding: 0, resource: { buffer: uniformBuf } },
      { binding: 1, resource: atlasTexture.createView() },
      { binding: 2, resource: sampler },
    ],
  });

  return { device, context, format, glyphPipeline, fadePipeline, quad, fullscreen, uniformBuf, instanceBuf, bindGroup };
}

function countBrightPixels(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return -1;
  const w = canvas.width;
  const h = canvas.height;
  const data = ctx.getImageData(0, 0, w, h).data;
  let bright = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] + data[i + 1] + data[i + 2] > 110) bright++;
  }
  return bright;
}

export default function MatrixRain() {
  const wrapRef = useRef(null);
  const cpuRef = useRef(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const cpuCanvas = cpuRef.current;
    if (!wrap || !cpuCanvas) return;

    const gpuCanvas = document.createElement("canvas");
    gpuCanvas.className = "matrix matrix-gpu matrix--interactive";
    wrap.insertBefore(gpuCanvas, cpuCanvas);

    const atlas = buildAtlas();
    let scale = renderScale();
    let dpr = maxDpr(scale);
    let W = 0;
    let H = 0;
    let cols = [];
    let colCount = 0;
    let raf = 0;
    let gpu = null;
    let mode = "boot";
    let disposed = false;
    let visible = !document.hidden;
    const pointer = { x: -9999, y: -9999, down: false };
    let ripple = { x: 0, y: 0, z: 0, w: 0 };
    const instances = new Float32Array(MAX_INSTANCES * 4);
    let cpuCtx = cpuCanvas.getContext("2d", { alpha: true });
    const ro = new ResizeObserver(() => resize());

    function setMode(next) {
      if (mode === next) return;
      mode = next;
      wrap.dataset.renderer = next;
      wrap.classList.toggle("matrix-wrap--cpu", next === "cpu");
    }

    function activeCanvas() {
      return mode === "webgpu" ? gpuCanvas : cpuCanvas;
    }

    function resize() {
      scale = renderScale();
      dpr = maxDpr(scale);
      const rect = wrap.getBoundingClientRect();
      W = Math.max(1, Math.floor(rect.width * dpr * scale));
      H = Math.max(1, Math.floor(rect.height * dpr * scale));
      for (const c of [gpuCanvas, cpuCanvas]) {
        c.width = W;
        c.height = H;
      }
      colCount = Math.max(1, Math.floor(W / CELL));
      cols = makeColumns(colCount, H);
      if (gpu?.context) {
        gpu.context.configure({ device: gpu.device, format: gpu.format, alphaMode: "premultiplied" });
      }
      if (mode === "cpu" && cpuCtx) {
        cpuCtx.fillStyle = themeBg();
        cpuCtx.fillRect(0, 0, W, H);
      }
    }

    function setPointer(clientX, clientY, down = pointer.down) {
      const rect = activeCanvas().getBoundingClientRect();
      const sx = W / rect.width;
      const sy = H / rect.height;
      pointer.x = (clientX - rect.left) * sx;
      pointer.y = (clientY - rect.top) * sy;
      pointer.down = down;
    }

    function disableGpu(reason) {
      if (!gpu) return;
      gpu.device.destroy?.();
      gpu = null;
      setMode("cpu");
      if (cpuCtx) {
        cpuCtx.fillStyle = themeBg();
        cpuCtx.fillRect(0, 0, W, H);
      }
      window.__matrixRainDebug = {
        ...(window.__matrixRainDebug || {}),
        renderer: "cpu",
        fallbackReason: String(reason),
      };
      if (import.meta.env.DEV) console.warn("[MatrixRain] WebGPU disabled:", reason);
    }

    const onMove = (e) => setPointer(e.clientX, e.clientY);
    const onLeave = () => {
      pointer.x = -9999;
      pointer.y = -9999;
      pointer.down = false;
    };
    const onDown = (e) => {
      setPointer(e.clientX, e.clientY, true);
      ripple = { x: pointer.x, y: pointer.y, z: 36 * dpr * scale, w: 1.3 };
    };
    const onUp = () => {
      pointer.down = false;
    };
    const onTouchStart = (e) => {
      if (!e.touches[0]) return;
      e.preventDefault();
      setPointer(e.touches[0].clientX, e.touches[0].clientY, true);
      ripple = { x: pointer.x, y: pointer.y, z: 48 * dpr * scale, w: 1.5 };
    };
    const onTouchMove = (e) => {
      if (!e.touches[0]) return;
      e.preventDefault();
      setPointer(e.touches[0].clientX, e.touches[0].clientY, true);
    };
    const onTouchEnd = () => {
      pointer.down = false;
    };
    const onVisibility = () => {
      visible = !document.hidden;
      if (visible && !raf) raf = requestAnimationFrame(tick);
    };

    for (const c of [gpuCanvas, cpuCanvas]) {
      c.addEventListener("pointermove", onMove, { passive: true });
      c.addEventListener("pointerleave", onLeave);
      c.addEventListener("pointerdown", onDown);
      c.addEventListener("touchstart", onTouchStart, { passive: false });
      c.addEventListener("touchmove", onTouchMove, { passive: false });
      c.addEventListener("touchend", onTouchEnd);
    }
    window.addEventListener("pointerup", onUp);
    document.addEventListener("visibilitychange", onVisibility);

    function simulate() {
      ripple.w *= 0.965;
      ripple.z += 1.8 * dpr * scale;
      if (ripple.w < 0.02) ripple.w = 0;

      let n = 0;
      const colStep = W / colCount;
      const reach = 140 * dpr * scale;
      const reachInv = 1 / reach;

      for (let i = 0; i < colCount; i++) {
        const col = cols[i];
        const cx = (i + 0.5) * colStep;
        const dx = pointer.x - cx;
        const dy = pointer.y - col.head;
        const dist = Math.hypot(dx, dy) || 1;
        const influence = Math.max(0, 1 - dist * reachInv);

        if (influence > 0.04) {
          if (pointer.down) {
            col.head += (dy / dist) * influence * 1.8;
            col.speed *= 0.94;
          } else {
            col.speed = Math.max(0.08, col.speed * (1 - influence * 0.03));
          }
          if (Math.random() < influence * 0.28) col.chars[0] = randGlyph();
        }

        const rippleDist = Math.hypot(ripple.x - cx, ripple.y - col.head);
        if (ripple.w > 0 && rippleDist < ripple.z) {
          col.chars[0] = randGlyph();
          col.head += (col.head < ripple.y ? -1 : 1) * ripple.w * 2.2;
        }

        col.head += col.speed * dpr * scale * 0.9;
        if (col.head > H + col.trail * CELL) {
          col.head = -Math.random() * H * 0.35 - col.trail * CELL;
          col.speed = 0.45 + Math.random() * 0.55;
        }
        if (Math.random() < 0.012) col.chars[0] = randGlyph();

        const trail = col.trail;
        const chars = col.chars;
        for (let t = 0; t < trail && n < MAX_INSTANCES; t++) {
          const y = col.head - t * CELL;
          if (y < -CELL || y > H + CELL) continue;
          const idx = n * 4;
          instances[idx] = cx - CELL / 2;
          instances[idx + 1] = y;
          instances[idx + 2] = chars[t % chars.length];
          instances[idx + 3] = Math.pow(0.84, t) * (t === 0 ? 1 : 0.5);
          n++;
        }
      }
      return n;
    }

    function drawCpu(n) {
      if (!cpuCtx) return;
      const light = isLightTheme();
      cpuCtx.globalCompositeOperation = "source-over";
      cpuCtx.globalAlpha = 1;
      cpuCtx.fillStyle = light ? "rgba(255,255,255,0.11)" : "rgba(10,10,10,0.11)";
      cpuCtx.fillRect(0, 0, W, H);

      const reach = 140 * dpr * scale;
      const reachInv = 1 / reach;

      for (let j = 0; j < n; j++) {
        const idx = j * 4;
        const g = instances[idx + 2] | 0;
        const x = instances[idx];
        const y = instances[idx + 1];
        let alpha = instances[idx + 3] * 0.88;
        const { sx, sy } = glyphAtlasRect(g);

        if (light) {
          cpuCtx.shadowColor = `rgba(229,53,43,${alpha * 0.95})`;
          cpuCtx.shadowBlur = 0;
          cpuCtx.shadowOffsetX = 0.9;
          cpuCtx.shadowOffsetY = 0.9;
          cpuCtx.globalAlpha = alpha * 0.95;
          cpuCtx.drawImage(atlas, sx, sy, CELL, CELL, x, y, CELL, CELL);
          cpuCtx.shadowColor = "transparent";
          cpuCtx.shadowOffsetX = 0;
          cpuCtx.shadowOffsetY = 0;
        } else {
          const cx = x + CELL * 0.5;
          const cy = y + CELL * 0.5;
          const near = Math.max(0, 1 - Math.hypot(pointer.x - cx, pointer.y - cy) * reachInv);
          if (near > 0.15) alpha *= 1 + near * 0.12;
          cpuCtx.globalAlpha = alpha;
          cpuCtx.drawImage(atlas, sx, sy, CELL, CELL, x, y, CELL, CELL);
          if (near > 0.2) {
            cpuCtx.globalCompositeOperation = "lighter";
            cpuCtx.globalAlpha = alpha * near * 0.35;
            cpuCtx.drawImage(atlas, sx, sy, CELL, CELL, x, y, CELL, CELL);
            cpuCtx.globalCompositeOperation = "source-over";
          }
        }
      }
      cpuCtx.globalAlpha = 1;
      cpuCtx.globalCompositeOperation = "source-over";
    }

    function drawGpu(n) {
      const { device, context, glyphPipeline, fadePipeline, quad, fullscreen, uniformBuf, instanceBuf, bindGroup } = gpu;
      writeUniforms(device, uniformBuf, W, H, pointer, ripple);
      if (n > 0) {
        device.queue.writeBuffer(instanceBuf, 0, instances, 0, n * 4);
      }

      const encoder = device.createCommandEncoder();
      const view = context.getCurrentTexture().createView();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{ view, loadOp: "load", storeOp: "store" }],
      });
      pass.setPipeline(fadePipeline);
      pass.setBindGroup(0, bindGroup);
      pass.setVertexBuffer(0, fullscreen);
      pass.draw(6);
      if (n > 0) {
        pass.setPipeline(glyphPipeline);
        pass.setBindGroup(0, bindGroup);
        pass.setVertexBuffer(0, quad);
        pass.setVertexBuffer(1, instanceBuf, 0, n * 16);
        pass.draw(6, n);
      }
      pass.end();
      device.queue.submit([encoder.finish()]);
    }

    function tick() {
      raf = 0;
      if (disposed || !visible) return;
      try {
        const n = simulate();
        if (mode === "webgpu" && gpu) drawGpu(n);
        else drawCpu(n);
        window.__matrixRainDebug = {
          renderer: mode,
          instances: n,
          W,
          H,
          scale,
          fallbackReason: null,
        };
      } catch (err) {
        if (mode === "webgpu") disableGpu(err?.message || err);
        else if (import.meta.env.DEV) console.error("[MatrixRain]", err);
      }
      if (!disposed && visible) raf = requestAnimationFrame(tick);
    }

    async function boot() {
      resize();
      window.addEventListener("resize", resize);
      ro.observe(wrap);

      try {
        gpu = await initWebGPU(gpuCanvas);
      } catch {
        gpu = null;
      }

      if (disposed) return;

      if (gpu) {
        setMode("webgpu");
        const light = isLightTheme();
        const enc = gpu.device.createCommandEncoder();
        const pass = enc.beginRenderPass({
          colorAttachments: [{
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: light
              ? { r: 1, g: 1, b: 1, a: 1 }
              : { r: 0.04, g: 0.04, b: 0.04, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          }],
        });
        pass.end();
        gpu.device.queue.submit([enc.finish()]);
      } else {
        setMode("cpu");
        cpuCtx.fillStyle = themeBg();
        cpuCtx.fillRect(0, 0, W, H);
      }

      raf = requestAnimationFrame(tick);
    }

    boot();

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointerup", onUp);
      document.removeEventListener("visibilitychange", onVisibility);
      for (const c of [gpuCanvas, cpuCanvas]) {
        c.removeEventListener("pointermove", onMove);
        c.removeEventListener("pointerleave", onLeave);
        c.removeEventListener("pointerdown", onDown);
        c.removeEventListener("touchstart", onTouchStart);
        c.removeEventListener("touchmove", onTouchMove);
        c.removeEventListener("touchend", onTouchEnd);
      }
      gpu?.device?.destroy?.();
      gpuCanvas.remove();
      delete window.__matrixRainDebug;
    };
  }, []);

  return (
    <div ref={wrapRef} className="matrix-wrap" data-testid="matrix-rain" data-renderer="boot" aria-hidden="true">
      <canvas ref={cpuRef} className="matrix matrix-cpu matrix--interactive" />
    </div>
  );
}

export { countBrightPixels };
