import { useEffect, useRef } from "react";

/**
 * WebGPU matrix rain with mouse/touch interaction.
 * Pointer glow + ripple borrow from Maxime Heckel's sdf3 shader (see src/shaders/heckel/).
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

const GLYPH_WGSL = /* wgsl */ `
struct Uniforms {
  canvas: vec2f,
  atlasGrid: vec2f,
  pointer: vec2f,
  ripple: vec4f,
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
  let col = glyphIdx % U.atlasGrid.x;
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

  let d = distance(in.pixelPos, U.pointer);
  let rippleD = distance(in.pixelPos, U.ripple.xy);
  let near = exp(-d / (120.0)) * 0.45;
  let ripple = exp(-rippleD / max(U.ripple.z, 1.0)) * U.ripple.w * 0.55;

  // sdf3-style mouse colour shift (tenet red accent)
  let mouseX = (U.pointer.x / U.canvas.x) * 2.0 - 1.0;
  let mouseY = (U.pointer.y / U.canvas.y) * 2.0 - 1.0;
  var rgb = vec3f(0.9, 0.9, 0.92);
  rgb.r -= abs(mouseX) * 0.25 * near;
  rgb.b += abs(mouseY) * 0.12 * near;
  rgb = mix(rgb, vec3f(1.0, 0.35, 0.28), near + ripple);

  return vec4f(rgb * s, s * in.alpha * 0.9);
}
`;

const FADE_WGSL = /* wgsl */ `
@vertex fn vs_fade(@location(0) p: vec2f) -> @builtin(position) vec4f { return vec4f(p, 0.0, 1.0); }
@fragment fn fs_fade() -> @location(0) vec4f { return vec4f(0.039, 0.039, 0.039, 0.11); }
`;

function randGlyph() {
  return (Math.random() * GLYPHS.length) | 0;
}

function buildAtlas() {
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
    ctx.fillText(GLYPHS[i], col * CELL + CELL / 2, row * CELL + CELL / 2 + 1);
  }
  return c;
}

function makeColumns(count, height) {
  return Array.from({ length: count }, () => ({
    head: Math.random() * -height,
    speed: 0.14 + Math.random() * 0.18,
    trail: 12 + ((Math.random() * 8) | 0),
    chars: Array.from({ length: 20 }, randGlyph),
  }));
}

async function initWebGPU(canvas) {
  if (!navigator.gpu) return null;
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: "low-power" });
  if (!adapter) return null;
  const device = await adapter.requestDevice();
  const context = canvas.getContext("webgpu");
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: "premultiplied" });

  const atlasCanvas = buildAtlas();
  const atlasTexture = device.createTexture({
    size: [ATLAS_W, ATLAS_H],
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  device.queue.copyExternalImageToTexture({ source: atlasCanvas }, { texture: atlasTexture }, [ATLAS_W, ATLAS_H]);

  const sampler = device.createSampler({ magFilter: "linear", minFilter: "linear" });
  const glyphModule = device.createShaderModule({ code: GLYPH_WGSL });
  const fadeModule = device.createShaderModule({ code: FADE_WGSL });

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

  const glyphPipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [bindLayout] }),
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
    layout: "auto",
    vertex: { module: fadeModule, entryPoint: "vs_fade", buffers: [{ arrayStride: 8, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }] }] },
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

  const uniformBuf = device.createBuffer({ size: 48, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const instanceBuf = device.createBuffer({ size: 4096 * 16, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
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

export default function MatrixRain() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0;
    let H = 0;
    let cols = [];
    let colCount = 0;
    let raf = 0;
    let gpu = null;
    let disposed = false;
    const pointer = { x: -9999, y: -9999, down: false };
    let ripple = { x: 0, y: 0, z: 0, w: 0 };
    const instances = new Float32Array(4096 * 4);

    function resize() {
      const rect = canvas.getBoundingClientRect();
      W = Math.max(1, Math.floor(rect.width * dpr));
      H = Math.max(1, Math.floor(rect.height * dpr));
      canvas.width = W;
      canvas.height = H;
      colCount = Math.max(1, Math.floor(W / CELL));
      cols = makeColumns(colCount, H);
      if (gpu?.context) {
        gpu.context.configure({ device: gpu.device, format: gpu.format, alphaMode: "premultiplied" });
      }
    }

    function setPointer(clientX, clientY, down = pointer.down) {
      const rect = canvas.getBoundingClientRect();
      pointer.x = (clientX - rect.left) * dpr;
      pointer.y = (clientY - rect.top) * dpr;
      pointer.down = down;
    }

    const onMove = (e) => setPointer(e.clientX, e.clientY);
    const onLeave = () => { pointer.x = -9999; pointer.y = -9999; pointer.down = false; };
    const onDown = (e) => {
      setPointer(e.clientX, e.clientY, true);
      ripple = { x: pointer.x, y: pointer.y, z: 36 * dpr, w: 1.3 };
    };
    const onUp = () => { pointer.down = false; };
    const onTouchStart = (e) => {
      if (!e.touches[0]) return;
      e.preventDefault();
      setPointer(e.touches[0].clientX, e.touches[0].clientY, true);
      ripple = { x: pointer.x, y: pointer.y, z: 48 * dpr, w: 1.5 };
    };
    const onTouchMove = (e) => {
      if (!e.touches[0]) return;
      e.preventDefault();
      setPointer(e.touches[0].clientX, e.touches[0].clientY, true);
    };
    const onTouchEnd = () => { pointer.down = false; };

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);

    function tick() {
      if (disposed) return;
      ripple.w *= 0.965;
      ripple.z += 1.8 * dpr;
      if (ripple.w < 0.02) ripple.w = 0;

      let n = 0;
      const colStep = W / colCount;
      const reach = 140 * dpr;

      for (let i = 0; i < colCount; i++) {
        const col = cols[i];
        const cx = (i + 0.5) * colStep;
        const dx = pointer.x - cx;
        const dy = pointer.y - col.head;
        const dist = Math.hypot(dx, dy) || 1;
        const influence = Math.max(0, 1 - dist / reach);

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

        col.head += col.speed * dpr * 0.35;
        if (col.head > H + col.trail * CELL) {
          col.head = -Math.random() * H * 0.4;
          col.speed = 0.14 + Math.random() * 0.18;
        }
        if (Math.random() < 0.012) col.chars[0] = randGlyph();

        for (let t = 0; t < col.trail && n < 4096; t++) {
          const y = col.head - t * CELL;
          if (y < -CELL || y > H + CELL) continue;
          const idx = n * 4;
          instances[idx] = cx - CELL / 2;
          instances[idx + 1] = y;
          instances[idx + 2] = col.chars[t % col.chars.length];
          instances[idx + 3] = Math.pow(0.84, t) * (t === 0 ? 1 : 0.5);
          n++;
        }
      }

      if (gpu) {
        const { device, context, glyphPipeline, fadePipeline, quad, fullscreen, uniformBuf, instanceBuf, bindGroup } = gpu;
        device.queue.writeBuffer(uniformBuf, 0, new Float32Array([
          W, H, ATLAS_COLS, ATLAS_ROWS,
          pointer.x, pointer.y,
          ripple.x, ripple.y, ripple.z, ripple.w,
        ]));
        device.queue.writeBuffer(instanceBuf, 0, instances.subarray(0, n * 4));

        const encoder = device.createCommandEncoder();
        const view = context.getCurrentTexture().createView();
        const pass = encoder.beginRenderPass({
          colorAttachments: [{ view, loadOp: "load", storeOp: "store" }],
        });
        pass.setPipeline(fadePipeline);
        pass.setVertexBuffer(0, fullscreen);
        pass.draw(6);
        pass.setPipeline(glyphPipeline);
        pass.setBindGroup(0, bindGroup);
        pass.setVertexBuffer(0, quad);
        pass.setVertexBuffer(1, instanceBuf, 0, n * 16);
        pass.draw(6, n);
        pass.end();
        device.queue.submit([encoder.finish()]);
      } else {
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "rgba(10,10,10,0.11)";
        ctx.fillRect(0, 0, W, H);
        ctx.font = `${Math.floor(CELL * 0.78)}px "Hiragino Sans", "Noto Sans JP", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (let j = 0; j < n; j++) {
          const idx = j * 4;
          const g = GLYPHS[instances[idx + 2] | 0] || "ア";
          const cx = instances[idx] + CELL / 2;
          const cy = instances[idx + 1] + CELL / 2;
          const near = Math.max(0, 1 - Math.hypot(pointer.x - cx, pointer.y - cy) / reach);
          const r = 230 + near * 25;
          const b = 235 - near * 80;
          ctx.fillStyle = `rgba(${r | 0},${(230 - near * 60) | 0},${b | 0},${instances[idx + 3] * 0.88})`;
          ctx.fillText(g, cx, cy);
        }
      }
      raf = requestAnimationFrame(tick);
    }

    async function boot() {
      resize();
      window.addEventListener("resize", resize);
      gpu = await initWebGPU(canvas);
      if (disposed) return;
      if (gpu) {
        const enc = gpu.device.createCommandEncoder();
        const pass = enc.beginRenderPass({
          colorAttachments: [{
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.04, g: 0.04, b: 0.04, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          }],
        });
        pass.end();
        gpu.device.queue.submit([enc.finish()]);
      } else {
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#0a0a0a";
        ctx.fillRect(0, 0, W, H);
      }
      tick();
    }

    boot();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      gpu?.device?.destroy?.();
    };
  }, []);

  return <canvas ref={ref} className="matrix matrix--interactive" aria-hidden="true" />;
}
