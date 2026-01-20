import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Settings } from 'lucide-react';

const QuantumWaveSimulation = () => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Simulation parameters
  const [params, setParams] = useState({
    nx: 200,           // Grid points
    dx: 0.1,           // Spatial step
    dt: 0.001,         // Time step
    hbar: 1,           // Reduced Planck constant
    m: 1,              // Mass
    k0: 10,            // Initial wave number
    x0: 10,            // Initial position
    sigma: 1,          // Wave packet width
    barrierHeight: 20, // Potential barrier height
    barrierWidth: 2,   // Potential barrier width
    barrierPos: 15     // Potential barrier position
  });

  // Simulation state
  const stateRef = useRef({
    psi_r: null,  // Real part of wave function
    psi_i: null,  // Imaginary part of wave function
    V: null,      // Potential
    time: 0
  });

  // Initialize wave function and potential
  const initialize = () => {
    const { nx, dx, k0, x0, sigma, barrierHeight, barrierWidth, barrierPos } = params;
    const psi_r = new Array(nx);
    const psi_i = new Array(nx);
    const V = new Array(nx);

    // Initialize Gaussian wave packet
    let norm = 0;
    for (let i = 0; i < nx; i++) {
      const x = i * dx;
      const gauss = Math.exp(-Math.pow(x - x0, 2) / (2 * sigma * sigma));
      psi_r[i] = gauss * Math.cos(k0 * x);
      psi_i[i] = gauss * Math.sin(k0 * x);
      norm += psi_r[i] * psi_r[i] + psi_i[i] * psi_i[i];

      // Set up potential barrier
      if (x > barrierPos && x < barrierPos + barrierWidth) {
        V[i] = barrierHeight;
      } else {
        V[i] = 0;
      }
    }

    // Normalize
    norm = Math.sqrt(norm * dx);
    for (let i = 0; i < nx; i++) {
      psi_r[i] /= norm;
      psi_i[i] /= norm;
    }

    stateRef.current = { psi_r, psi_i, V, time: 0 };
  };

  // Evolve wave function using split-step method
  const evolve = () => {
    const { nx, dx, dt, hbar, m } = params;
    const { psi_r, psi_i, V } = stateRef.current;

    const psi_r_new = new Array(nx);
    const psi_i_new = new Array(nx);

    // Apply potential (half step)
    for (let i = 0; i < nx; i++) {
      const phase = -V[i] * dt / (2 * hbar);
      const cos_phase = Math.cos(phase);
      const sin_phase = Math.sin(phase);
      const temp_r = psi_r[i] * cos_phase - psi_i[i] * sin_phase;
      const temp_i = psi_r[i] * sin_phase + psi_i[i] * cos_phase;
      psi_r[i] = temp_r;
      psi_i[i] = temp_i;
    }

    // Apply kinetic energy (full step) using finite differences
    const coeff = hbar * dt / (2 * m * dx * dx);
    for (let i = 1; i < nx - 1; i++) {
      psi_r_new[i] = psi_r[i] + coeff * (psi_i[i+1] - 2*psi_i[i] + psi_i[i-1]);
      psi_i_new[i] = psi_i[i] - coeff * (psi_r[i+1] - 2*psi_r[i] + psi_r[i-1]);
    }

    // Boundary conditions
    psi_r_new[0] = psi_r_new[nx-1] = 0;
    psi_i_new[0] = psi_i_new[nx-1] = 0;

    // Apply potential (half step)
    for (let i = 0; i < nx; i++) {
      const phase = -V[i] * dt / (2 * hbar);
      const cos_phase = Math.cos(phase);
      const sin_phase = Math.sin(phase);
      const temp_r = psi_r_new[i] * cos_phase - psi_i_new[i] * sin_phase;
      const temp_i = psi_r_new[i] * sin_phase + psi_i_new[i] * cos_phase;
      psi_r_new[i] = temp_r;
      psi_i_new[i] = temp_i;
    }

    stateRef.current.psi_r = psi_r_new;
    stateRef.current.psi_i = psi_i_new;
    stateRef.current.time += dt;
  };

  // Draw on canvas
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    const { psi_r, psi_i, V } = stateRef.current;
    const { nx } = params;

    if (!psi_r) return;

    // Calculate probability density
    const prob = psi_r.map((r, i) => r * r + psi_i[i] * psi_i[i]);
    const maxProb = Math.max(...prob);
    const maxV = Math.max(...V);

    // Draw grid
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const y = (i / 4) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw potential barrier
    ctx.fillStyle = 'rgba(255, 100, 100, 0.2)';
    for (let i = 0; i < nx; i++) {
      if (V[i] > 0) {
        const x = (i / nx) * width;
        const barrierHeight = (V[i] / maxV) * height * 0.3;
        ctx.fillRect(x, height - barrierHeight, width / nx, barrierHeight);
      }
    }

    // Draw probability density
    ctx.beginPath();
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;

    for (let i = 0; i < nx; i++) {
      const x = (i / nx) * width;
      const y = height - (prob[i] / maxProb) * height * 0.6;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Fill under curve
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(0, 255, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 255, 255, 0)');
    ctx.fillStyle = gradient;

    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();

    // Draw labels
    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    ctx.fillText(`t = ${stateRef.current.time.toFixed(2)}`, 10, 20);
    ctx.fillText('Probability Density |ψ|²', 10, height - 10);
  };

  // Animation loop
  const animate = () => {
    evolve();
    draw();
    animationRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    initialize();
    draw();
  }, [params]);

  useEffect(() => {
    if (isPlaying) {
      animationRef.current = requestAnimationFrame(animate);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying]);

  const handleReset = () => {
    setIsPlaying(false);
    initialize();
    draw();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Quantum Wave Simulation</h1>
          <p className="text-gray-300">Real-time Schrödinger equation solver</p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 shadow-2xl border border-slate-700">
          <canvas
            ref={canvasRef}
            width={800}
            height={400}
            className="w-full bg-black rounded-lg mb-4"
          />

          <div className="flex justify-center gap-4 mb-6">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="flex items-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors"
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              {isPlaying ? 'Pause' : 'Play'}
            </button>

            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
            >
              <RotateCcw size={20} />
              Reset
            </button>

            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-2 px-6 py-3 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
            >
              <Settings size={20} />
              Settings
            </button>
          </div>

          {showSettings && (
            <div className="grid grid-cols-2 gap-4 bg-slate-900/50 p-4 rounded-lg">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Wave Number (k₀)</label>
                <input
                  type="range"
                  min="5"
                  max="20"
                  value={params.k0}
                  onChange={(e) => setParams({...params, k0: parseFloat(e.target.value)})}
                  className="w-full"
                />
                <span className="text-xs text-gray-400">{params.k0}</span>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-1">Wave Packet Width (σ)</label>
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.1"
                  value={params.sigma}
                  onChange={(e) => setParams({...params, sigma: parseFloat(e.target.value)})}
                  className="w-full"
                />
                <span className="text-xs text-gray-400">{params.sigma}</span>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-1">Barrier Height</label>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={params.barrierHeight}
                  onChange={(e) => setParams({...params, barrierHeight: parseFloat(e.target.value)})}
                  className="w-full"
                />
                <span className="text-xs text-gray-400">{params.barrierHeight}</span>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-1">Barrier Position</label>
                <input
                  type="range"
                  min="10"
                  max="18"
                  step="0.5"
                  value={params.barrierPos}
                  onChange={(e) => setParams({...params, barrierPos: parseFloat(e.target.value)})}
                  className="w-full"
                />
                <span className="text-xs text-gray-400">{params.barrierPos}</span>
              </div>
            </div>
          )}

          <div className="mt-6 text-sm text-gray-400 space-y-2">
            <p>• The cyan wave shows the probability density |ψ|² of finding the particle</p>
            <p>• The red barrier represents a potential energy barrier</p>
            <p>• Watch quantum tunneling as the wave packet passes through the barrier</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuantumWaveSimulation;