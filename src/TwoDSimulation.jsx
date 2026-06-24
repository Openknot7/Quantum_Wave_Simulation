import { useEffect, useRef, useState } from 'react';
import {
  energyFromWaveNumber,
  normalEnergy,
  rectangularTransmission,
  tunnelingKappa,
} from './physics.js';

function modelStats(params, time) {
  const energy = energyFromWaveNumber(params.k0);
  const perpendicularEnergy = params.geometry === 'ring'
    ? energy
    : normalEnergy(energy, params.angle);
  const transmission = rectangularTransmission(
    perpendicularEnergy,
    params.barrierHeight,
    params.barrierWidth,
  );
  return {
    time,
    energy,
    perpendicularEnergy,
    transmission,
    reflection: 1 - transmission,
    kappa: tunnelingKappa(perpendicularEnergy, params.barrierHeight),
    angle: params.angle,
  };
}

export default function TwoDSimulation({ isPlaying, params, resetToken, onStats }) {
  const canvasRef = useRef(null);
  const viewportRef = useRef(null);
  const animationRef = useRef(null);
  const timeRef = useRef(0);
  const paramsRef = useRef(params);
  const [dimensions, setDimensions] = useState({ width: 900, height: 520 });

  paramsRef.current = params;

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = dimensions;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const background = ctx.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, '#090d13');
    background.addColorStop(0.55, '#0e1519');
    background.addColorStop(1, '#15120f');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    const resolutionX = Math.max(150, Math.min(300, Math.floor(width / 3)));
    const resolutionY = Math.max(90, Math.floor((resolutionX * height) / width));
    const image = ctx.createImageData(resolutionX, resolutionY);
    const stats = modelStats(paramsRef.current, timeRef.current);
    const transmissionAmplitude = Math.sqrt(stats.transmission);
    const reflectionAmplitude = Math.sqrt(stats.reflection);
    const angle = (paramsRef.current.angle * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const omega = stats.energy;
    const phaseTime = omega * timeRef.current * 0.65;
    const left = -paramsRef.current.barrierWidth / 2;
    const right = paramsRef.current.barrierWidth / 2;
    const ringRadius = 2.25;

    for (let py = 0; py < resolutionY; py += 1) {
      const y = 5 - (py / (resolutionY - 1)) * 10;
      for (let px = 0; px < resolutionX; px += 1) {
        const x = -8 + (px / (resolutionX - 1)) * 16;
        const longitudinal = x * cos + y * sin;
        const transverse = -x * sin + y * cos - paramsRef.current.impact;
        const envelope = Math.exp(-(transverse * transverse) / (2 * paramsRef.current.sigma ** 2));
        let amplitude = 0;
        let barrierAmount = 0;

        if (paramsRef.current.geometry === 'ring') {
          const radius = Math.sqrt(x * x + y * y);
          const inner = ringRadius - paramsRef.current.barrierWidth / 2;
          const outer = ringRadius + paramsRef.current.barrierWidth / 2;
          const incident = Math.sin(paramsRef.current.k0 * longitudinal - phaseTime);
          const scattered = reflectionAmplitude * Math.sin(
            paramsRef.current.k0 * radius + phaseTime + 0.8,
          ) / Math.sqrt(Math.max(1, radius));
          if (radius >= inner && radius <= outer) {
            const depth = radius - inner;
            barrierAmount = 1;
            amplitude = envelope * Math.exp(-stats.kappa * depth) * incident;
          } else if (radius > outer) {
            amplitude = envelope * (incident + scattered);
          } else {
            amplitude = envelope * transmissionAmplitude * incident;
          }
        } else {
          const incident = Math.sin(paramsRef.current.k0 * longitudinal - phaseTime);
          const reflected = reflectionAmplitude * Math.sin(
            paramsRef.current.k0 * (-x * cos + y * sin) - phaseTime + 0.75,
          );
          if (x < left) {
            amplitude = envelope * (incident + reflected);
          } else if (x <= right) {
            barrierAmount = 1;
            amplitude = envelope * (1 + reflectionAmplitude) *
              Math.exp(-stats.kappa * (x - left)) *
              Math.sin(paramsRef.current.k0 * y * sin - phaseTime);
          } else {
            amplitude = envelope * transmissionAmplitude * incident;
          }
        }

        const density = Math.min(1, amplitude * amplitude * 0.72);
        const signed = Math.tanh(amplitude * 0.85);
        const index = (py * resolutionX + px) * 4;
        const cyan = density * 205;
        const phaseRose = Math.max(0, signed) * 55;
        const phaseGreen = Math.max(0, -signed) * 45;
        image.data[index] = Math.round(8 + cyan * 0.32 + phaseRose + barrierAmount * 38);
        image.data[index + 1] = Math.round(13 + cyan * 0.86 + phaseGreen + barrierAmount * 26);
        image.data[index + 2] = Math.round(19 + cyan + phaseRose * 0.65 + barrierAmount * 6);
        image.data[index + 3] = 255;
      }
    }

    const fieldCanvas = document.createElement('canvas');
    fieldCanvas.width = resolutionX;
    fieldCanvas.height = resolutionY;
    fieldCanvas.getContext('2d').putImageData(image, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(fieldCanvas, 0, 0, width, height);

    ctx.strokeStyle = 'rgba(233, 239, 244, 0.09)';
    ctx.lineWidth = 1;
    const gridStep = Math.max(48, width / 12);
    for (let x = 0; x <= width; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += gridStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.save();
    ctx.strokeStyle = 'rgba(242, 184, 75, 0.9)';
    ctx.fillStyle = 'rgba(242, 184, 75, 0.13)';
    ctx.lineWidth = 1.4;
    if (paramsRef.current.geometry === 'ring') {
      const scaleX = width / 16;
      const scaleY = height / 10;
      const radiusX = ringRadius * scaleX;
      const radiusY = ringRadius * scaleY;
      ctx.beginPath();
      ctx.ellipse(width / 2, height / 2, radiusX, radiusY, 0, 0, Math.PI * 2);
      ctx.lineWidth = Math.max(5, paramsRef.current.barrierWidth * Math.min(scaleX, scaleY));
      ctx.globalAlpha = 0.48;
      ctx.stroke();
    } else {
      const barrierX = ((left + 8) / 16) * width;
      const barrierW = (paramsRef.current.barrierWidth / 16) * width;
      ctx.fillRect(barrierX, 0, barrierW, height);
      ctx.strokeRect(barrierX, 0, barrierW, height);
    }
    ctx.restore();

    const originX = width * 0.12;
    const originY = height * 0.78;
    const arrowLength = Math.min(105, width * 0.16);
    ctx.strokeStyle = 'rgba(244, 247, 251, 0.82)';
    ctx.fillStyle = 'rgba(244, 247, 251, 0.82)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(originX + arrowLength * cos, originY - arrowLength * sin);
    ctx.stroke();
    const arrowX = originX + arrowLength * cos;
    const arrowY = originY - arrowLength * sin;
    ctx.beginPath();
    ctx.arc(arrowX, arrowY, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = '12px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(244, 247, 251, 0.88)';
    ctx.fillText(`theta=${paramsRef.current.angle.toFixed(0)} deg`, 18, 25);
    ctx.fillText(`T=${(stats.transmission * 100).toFixed(1)}%`, 18, 44);
    ctx.fillStyle = 'rgba(174, 184, 196, 0.86)';
    ctx.fillText('probability-density field', Math.max(18, width - 205), height - 18);
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
    timeRef.current = 0;
    const stats = modelStats(params, 0);
    onStats(stats);
    draw();
  }, [params.k0, params.sigma, params.barrierHeight, params.barrierWidth, params.angle, params.impact, params.geometry, resetToken]);

  useEffect(() => {
    draw();
  }, [dimensions]);

  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(animationRef.current);
      return undefined;
    }

    let previous = performance.now();
    let lastStatsUpdate = 0;
    const animate = (timestamp) => {
      const delta = Math.min(0.05, (timestamp - previous) / 1000);
      previous = timestamp;
      timeRef.current += delta * paramsRef.current.speed;
      draw();
      if (timestamp - lastStatsUpdate > 120) {
        onStats(modelStats(paramsRef.current, timeRef.current));
        lastStatsUpdate = timestamp;
      }
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationRef.current);
  }, [isPlaying, dimensions, onStats]);

  return (
    <div className="canvas-frame" ref={viewportRef}>
      <canvas ref={canvasRef} aria-label="Two-dimensional angular tunneling field" />
    </div>
  );
}