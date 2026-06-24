import { useEffect, useRef, useState } from 'react';
import { energyFromWaveNumber } from './physics.js';

const DOMAIN = {
  nx: 512,
  dx: 0.05,
  dt: 0.002,
  hbar: 1,
  mass: 1,
  xStart: -12,
};

function fft(re, im) {
  const n = re.length;
  if (n <= 1) return;

  const er = new Array(n / 2);
  const ei = new Array(n / 2);
  const or = new Array(n / 2);
  const oi = new Array(n / 2);

  for (let i = 0; i < n / 2; i += 1) {
    er[i] = re[2 * i];
    ei[i] = im[2 * i];
    or[i] = re[2 * i + 1];
    oi[i] = im[2 * i + 1];
  }

  fft(er, ei);
  fft(or, oi);

  for (let k = 0; k < n / 2; k += 1) {
    const phase = (-2 * Math.PI * k) / n;
    const c = Math.cos(phase);
    const s = Math.sin(phase);
    const tr = c * or[k] - s * oi[k];
    const ti = s * or[k] + c * oi[k];
    re[k] = er[k] + tr;
    im[k] = ei[k] + ti;
    re[k + n / 2] = er[k] - tr;
    im[k + n / 2] = ei[k] - ti;
  }
}

function ifft(re, im) {
  for (let i = 0; i < im.length; i += 1) im[i] *= -1;
  fft(re, im);
  const n = re.length;
  for (let i = 0; i < n; i += 1) {
    re[i] /= n;
    im[i] = -im[i] / n;
  }
}

function smoothBarrier(x, left, right) {
  const softness = 0.075;
  const rise = 1 / (1 + Math.exp(-(x - left) / softness));
  const fall = 1 / (1 + Math.exp((x - right) / softness));
  return rise * fall;
}

function buildState(params) {
  const { nx, dx, xStart } = DOMAIN;
  const psiR = new Array(nx);
  const psiI = new Array(nx);
  const potential = new Array(nx);
  const absorber = new Array(nx).fill(1);
  const left = params.barrierPos - params.barrierWidth / 2;
  const right = params.barrierPos + params.barrierWidth / 2;
  let norm = 0;

  for (let i = 0; i < nx; i += 1) {
    const x = xStart + i * dx;
    const envelope = Math.exp(-((x - params.x0) ** 2) / (2 * params.sigma ** 2));
    psiR[i] = envelope * Math.cos(params.k0 * x);
    psiI[i] = envelope * Math.sin(params.k0 * x);
    potential[i] = params.barrierHeight * smoothBarrier(x, left, right);
    norm += (psiR[i] ** 2 + psiI[i] ** 2) * dx;
  }

  const scale = 1 / Math.sqrt(norm);
  for (let i = 0; i < nx; i += 1) {
    psiR[i] *= scale;
    psiI[i] *= scale;
  }

  const edgeWidth = 54;
  for (let i = 0; i < edgeWidth; i += 1) {
    const q = (edgeWidth - i) / edgeWidth;
    const damping = Math.exp(-0.016 * q ** 4);
    absorber[i] = damping;
    absorber[nx - i - 1] = damping;
  }

  return { psiR, psiI, potential, absorber, time: 0 };
}

function evolve(state) {
  const { nx, dx, dt, hbar, mass } = DOMAIN;
  const { psiR, psiI, potential, absorber } = state;

  for (let i = 0; i < nx; i += 1) {
    const phase = (-potential[i] * dt) / (2 * hbar);
    const c = Math.cos(phase);
    const s = Math.sin(phase);
    const r = psiR[i];
    const im = psiI[i];
    psiR[i] = c * r - s * im;
    psiI[i] = s * r + c * im;
  }

  fft(psiR, psiI);
  for (let i = 0; i < nx; i += 1) {
    const k = i < nx / 2
      ? (2 * Math.PI * i) / (nx * dx)
      : (2 * Math.PI * (i - nx)) / (nx * dx);
    const phase = (-(hbar * k * k) * dt) / (2 * mass);
    const c = Math.cos(phase);
    const s = Math.sin(phase);
    const r = psiR[i];
    const im = psiI[i];
    psiR[i] = c * r - s * im;
    psiI[i] = s * r + c * im;
  }

  ifft(psiR, psiI);
  for (let i = 0; i < nx; i += 1) {
    const phase = (-potential[i] * dt) / (2 * hbar);
    const c = Math.cos(phase);
    const s = Math.sin(phase);
    const r = psiR[i];
    const im = psiI[i];
    psiR[i] = (c * r - s * im) * absorber[i];
    psiI[i] = (s * r + c * im) * absorber[i];
  }

  state.time += dt;
}

function calculateStats(state, params) {
  const left = params.barrierPos - params.barrierWidth / 2;
  const right = params.barrierPos + params.barrierWidth / 2;
  let norm = 0;
  let center = 0;
  let leftRegion = 0;
  let rightRegion = 0;

  for (let i = 0; i < DOMAIN.nx; i += 1) {
    const x = DOMAIN.xStart + i * DOMAIN.dx;
    const probability = (state.psiR[i] ** 2 + state.psiI[i] ** 2) * DOMAIN.dx;
    norm += probability;
    center += x * probability;
    if (x < left) leftRegion += probability;
    if (x > right) rightRegion += probability;
  }

  return {
    time: state.time,
    norm,
    center: norm > 0 ? center / norm : 0,
    leftRegion,
    rightRegion,
    energy: energyFromWaveNumber(params.k0),
  };
}

export default function OneDSimulation({ isPlaying, params, resetToken, onStats }) {
  const canvasRef = useRef(null);
  const viewportRef = useRef(null);
  const animationRef = useRef(null);
  const stateRef = useRef(null);
  const paramsRef = useRef(params);
  const [dimensions, setDimensions] = useState({ width: 900, height: 520 });

  paramsRef.current = params;

  function draw(state = stateRef.current, drawParams = paramsRef.current) {
    const canvas = canvasRef.current;
    if (!canvas || !state) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = dimensions;
    const xEnd = DOMAIN.xStart + (DOMAIN.nx - 1) * DOMAIN.dx;
    const padding = { top: 34, right: 26, bottom: 46, left: 54 };
    const plotW = Math.max(10, width - padding.left - padding.right);
    const plotH = Math.max(10, height - padding.top - padding.bottom);
    const baseline = padding.top + plotH;
    const midline = padding.top + plotH * 0.58;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const background = ctx.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, '#0d1016');
    background.addColorStop(0.55, '#11171b');
    background.addColorStop(1, '#17130f');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    const toX = (x) => padding.left + ((x - DOMAIN.xStart) / (xEnd - DOMAIN.xStart)) * plotW;
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(226, 232, 240, 0.48)';
    ctx.strokeStyle = 'rgba(230, 236, 242, 0.07)';
    ctx.lineWidth = 1;

    for (let x = -10; x <= 12; x += 2) {
      const px = toX(x);
      ctx.beginPath();
      ctx.moveTo(px, padding.top);
      ctx.lineTo(px, baseline);
      ctx.stroke();
      ctx.fillText(String(x), px - 6, baseline + 22);
    }

    for (let i = 0; i <= 4; i += 1) {
      const y = padding.top + (plotH * i) / 4;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + plotW, y);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(230, 236, 242, 0.18)';
    ctx.beginPath();
    ctx.moveTo(padding.left, midline);
    ctx.lineTo(padding.left + plotW, midline);
    ctx.stroke();

    const maxPotential = Math.max(80, drawParams.barrierHeight * 1.2);
    const potentialGradient = ctx.createLinearGradient(0, padding.top, 0, baseline);
    potentialGradient.addColorStop(0, 'rgba(242, 184, 75, 0.48)');
    potentialGradient.addColorStop(1, 'rgba(242, 92, 84, 0.08)');
    ctx.beginPath();
    ctx.moveTo(padding.left, baseline);
    for (let i = 0; i < DOMAIN.nx; i += 1) {
      const x = DOMAIN.xStart + i * DOMAIN.dx;
      ctx.lineTo(toX(x), baseline - (state.potential[i] / maxPotential) * plotH * 0.78);
    }
    ctx.lineTo(padding.left + plotW, baseline);
    ctx.closePath();
    ctx.fillStyle = potentialGradient;
    ctx.fill();
    ctx.strokeStyle = 'rgba(242, 184, 75, 0.8)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    const probability = new Array(DOMAIN.nx);
    let maxProbability = 0;
    let maxAmplitude = 0;
    for (let i = 0; i < DOMAIN.nx; i += 1) {
      probability[i] = state.psiR[i] ** 2 + state.psiI[i] ** 2;
      maxProbability = Math.max(maxProbability, probability[i]);
      maxAmplitude = Math.max(maxAmplitude, Math.abs(state.psiR[i]), Math.abs(state.psiI[i]));
    }

    const probScale = Math.max(maxProbability * 1.16, 0.18);
    const waveScale = maxAmplitude > 0 ? (plotH * 0.16) / maxAmplitude : 1;
    const densityGradient = ctx.createLinearGradient(0, padding.top, 0, baseline);
    densityGradient.addColorStop(0, 'rgba(36, 198, 220, 0.42)');
    densityGradient.addColorStop(0.75, 'rgba(36, 198, 220, 0.12)');
    densityGradient.addColorStop(1, 'rgba(36, 198, 220, 0)');
    ctx.beginPath();
    ctx.moveTo(padding.left, baseline);
    for (let i = 0; i < DOMAIN.nx; i += 1) {
      const x = DOMAIN.xStart + i * DOMAIN.dx;
      ctx.lineTo(toX(x), baseline - (probability[i] / probScale) * plotH * 0.82);
    }
    ctx.lineTo(padding.left + plotW, baseline);
    ctx.closePath();
    ctx.fillStyle = densityGradient;
    ctx.fill();
    ctx.strokeStyle = '#24c6dc';
    ctx.lineWidth = 2.4;
    ctx.shadowColor = 'rgba(36, 198, 220, 0.45)';
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;

    const drawWavePart = (values, color) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < DOMAIN.nx; i += 1) {
        const x = DOMAIN.xStart + i * DOMAIN.dx;
        const px = toX(x);
        const py = midline - values[i] * waveScale;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    };
    drawWavePart(state.psiR, 'rgba(255, 93, 143, 0.82)');
    drawWavePart(state.psiI, 'rgba(111, 219, 169, 0.72)');

    const currentStats = calculateStats(state, drawParams);
    const centerX = toX(currentStats.center);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.36)';
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(centerX, padding.top);
    ctx.lineTo(centerX, baseline);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = '12px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(246, 248, 251, 0.84)';
    ctx.fillText(`t=${state.time.toFixed(3)}`, padding.left, 22);
    ctx.fillText(
      `x=${currentStats.center.toFixed(2)}`,
      Math.min(centerX + 8, width - 84),
      width < 520 ? padding.top + 42 : padding.top + 16,
    );

    const compact = width < 520;
    const legend = compact
      ? [['P', '#24c6dc'], ['Re', '#ff5d8f'], ['Im', '#6fdba9'], ['V', '#f2b84b']]
      : [['|psi|^2', '#24c6dc'], ['Re(psi)', '#ff5d8f'], ['Im(psi)', '#6fdba9'], ['V(x)', '#f2b84b']];
    const step = compact ? 52 : 72;
    const legendWidth = step * legend.length + 8;
    const legendX = Math.max(padding.left + 8, width - legendWidth - 18);
    const legendY = padding.top + 8;
    ctx.fillStyle = 'rgba(13, 16, 22, 0.72)';
    ctx.fillRect(legendX - 10, legendY - 15, legendWidth, 30);
    legend.forEach(([label, color], index) => {
      const x = legendX + index * step;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, legendY, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(230, 236, 242, 0.78)';
      ctx.fillText(label, x + 8, legendY + 4);
    });
  }

  useEffect(() => {
    const updateSize = () => {
      if (!viewportRef.current) return;
      const width = viewportRef.current.clientWidth;
      setDimensions({ width, height: Math.min(560, Math.max(360, width * 0.54)) });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const state = buildState(params);
    stateRef.current = state;
    const nextStats = calculateStats(state, params);
    onStats(nextStats);
    draw(state, params);
  }, [params.k0, params.x0, params.sigma, params.barrierHeight, params.barrierWidth, params.barrierPos, resetToken]);

  useEffect(() => {
    draw();
  }, [dimensions]);

  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(animationRef.current);
      return undefined;
    }

    let lastStatsUpdate = 0;
    const animate = (timestamp) => {
      const state = stateRef.current;
      if (!state) return;
      for (let i = 0; i < paramsRef.current.speed; i += 1) evolve(state);
      draw(state, paramsRef.current);
      if (timestamp - lastStatsUpdate > 120) {
        onStats(calculateStats(state, paramsRef.current));
        lastStatsUpdate = timestamp;
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationRef.current);
  }, [isPlaying, dimensions, onStats]);

  return (
    <div className="canvas-frame" ref={viewportRef}>
      <canvas ref={canvasRef} aria-label="One-dimensional quantum wave packet" />
    </div>
  );
}