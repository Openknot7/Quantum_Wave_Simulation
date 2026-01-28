import React, { useState, useEffect, useRef } from 'react';

/* ================= FFT UTILITIES ================= */

function fft(re, im) {   
    const n = re.length;
    if (n <= 1) return;
    const er = new Array(n / 2), ei = new Array(n / 2);
    const or = new Array(n / 2), oi = new Array(n / 2);
    for (let i = 0; i < n / 2; i++) {
        er[i] = re[2 * i]; ei[i] = im[2 * i];
        or[i] = re[2 * i + 1]; oi[i] = im[2 * i + 1];
    }
    fft(er, ei);
    fft(or, oi);
    for (let k = 0; k < n / 2; k++) {
        const t = -2 * Math.PI * k / n;
        const c = Math.cos(t), s = Math.sin(t);
        const tr = c * or[k] - s * oi[k];
        const ti = s * or[k] + c * oi[k];
        re[k] = er[k] + tr;
        im[k] = ei[k] + ti;
        re[k + n / 2] = er[k] - tr;
        im[k + n / 2] = ei[k] - ti;
    }
}

function ifft(re, im) {
    for (let i = 0; i < im.length; i++) im[i] *= -1;
    fft(re, im);
    const n = re.length;
    for (let i = 0; i < n; i++) {
        re[i] /= n;
        im[i] = -im[i] / n;
    }
}

/* ================= PARAMETERS ================= */

const INITIAL_PARAMS = {
    nx: 512,
    dx: 0.05,
    dt: 0.002,
    hbar: 1,
    m: 1,
    k0: 5,
    x0: -6,
    sigma: 0.7,
    barrierHeight: 40,
    barrierWidth: 1.5,
    barrierPos: 0,
    speed: 2
};

/* ================= STYLES (iOS Fixes Injected Here) ================= */

const IOS_STYLES = `
    /* 1. Prevent iOS text zoom on inputs */
    input[type="range"], input[type="number"] {
        font-size: 16px !important; 
    }

    /* 2. Hardware Acceleration for Canvas (Prevents flickering) */
    canvas {
        transform: translateZ(0);
        -webkit-transform: translateZ(0);
        touch-action: none;
    }

    /* 3. iOS Range Slider Reset - CRITICAL for visibility */
    input[type=range] {
        -webkit-appearance: none; /* Hides default slider */
        width: 100%;
        background: transparent; /* Otherwise white in Chrome */
        margin: 10px 0;
    }

    input[type=range]:focus {
        outline: none;
    }

    /* 4. The Thumb (Handle) */
    input[type=range]::-webkit-slider-thumb {
        -webkit-appearance: none;
        height: 24px;   /* Made bigger for easier touch */
        width: 24px;
        border-radius: 50%;
        background: #22d3ee;
        cursor: pointer;
        margin-top: -10px; /* You need to specify a margin in Chrome */
        box-shadow: 0 0 10px rgba(6, 182, 212, 0.5);
    }

    /* 5. The Track */
    input[type=range]::-webkit-slider-runnable-track {
        width: 100%;
        height: 5px;
        cursor: pointer;
        background: #334155;
        border-radius: 2px;
        border: 0.2px solid #010101;
    }

    /* Firefox Overrides */
    input[type=range]::-moz-range-thumb {
        height: 24px;
        width: 24px;
        border: none;
        border-radius: 50%;
        background: #22d3ee;
        cursor: pointer;
    }
    input[type=range]::-moz-range-track {
        width: 100%;
        height: 5px;
        cursor: pointer;
        background: #334155;
        border-radius: 2px;
    }
`;

/* ================= MAIN COMPONENT ================= */

const QuantumWaveSimulation = () => {
    const canvasRef = useRef(null);
    const wrapperRef = useRef(null);
    const animationRef = useRef(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [params, setParams] = useState(INITIAL_PARAMS);
    
    // Default to a safe size so it's not 0 height on load
    const [dimensions, setDimensions] = useState({ width: 300, height: 300 });

    const paramsRef = useRef(params);
    const stateRef = useRef({ psi_r: null, psi_i: null, V: null, time: 0 });

    useEffect(() => { paramsRef.current = params; }, [params]);

    // Re-initialize physics when parameters change
    useEffect(() => {
        initialize();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.k0, params.sigma, params.x0, params.barrierHeight, params.barrierWidth, params.barrierPos]);

    /* ========== RESIZE LOGIC (iOS FIX) ========== */
    useEffect(() => {
        const handleResize = () => {
            if (wrapperRef.current) {
                // Force a recalculation of width
                const width = wrapperRef.current.offsetWidth;
                // On iOS, window.innerHeight can be tricky due to address bar.
                // We limit height to 400px or 50% of screen to play safe.
                const height = Math.min(window.innerHeight * 0.5, 400); 
                setDimensions({ width, height });
            }
        };

        // Delay initial resize slightly to ensure DOM is painted (Fix for iOS "0 height" bug)
        setTimeout(handleResize, 100);
        window.addEventListener('resize', handleResize);
        
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => { draw(); }, [dimensions]);

    /* ========== PHYSICS INITIALIZATION ========== */
    function initialize() {
        const { nx, dx, k0, x0, sigma, barrierHeight, barrierWidth, barrierPos } = paramsRef.current;
        const psi_r = new Array(nx), psi_i = new Array(nx), V = new Array(nx);
        const xStart = -10;
        let norm = 0;

        for (let i = 0; i < nx; i++) {
            const x = xStart + i * dx;
            const g = Math.exp( -Math.pow(x - x0, 2) / (2 * Math.pow(sigma, 2)));

            norm += Math.pow(psi_r[i], 2) + Math.pow(psi_i[i], 2);

            psi_r[i] = g * Math.cos(k0 * x);
            psi_i[i] = g * Math.sin(k0 * x);
            norm += Math.pow(psi_r[i], 2) + Math.pow(psi_i[i], 2);

            V[i] = (x > barrierPos - barrierWidth / 2 && x < barrierPos + barrierWidth / 2) ? barrierHeight : 0;
            const w = 40, eta = 0.02;
            if (i < w) { V[i] += -eta * Math.pow(w - i, 2);}

            if (i > nx - w) { V[i] += -eta * Math.pow(i - (nx - w), 2);}

        norm = Math.sqrt(norm * dx);
        for (let i = 0; i < nx; i++) { psi_r[i] /= norm; psi_i[i] /= norm; }
        stateRef.current = { psi_r, psi_i, V, time: 0 };
        draw();
    }

    /* ========== EVOLUTION LOOP ========== */
    function evolve() {
        const { nx, dx, dt, hbar, m } = paramsRef.current;
        const { psi_r, psi_i, V } = stateRef.current;

        for (let i = 0; i < nx; i++) {
            const ph = -V[i] * dt / (2 * hbar);
            const c = Math.cos(ph), s = Math.sin(ph);
            const r = psi_r[i], im = psi_i[i];
            psi_r[i] = c * r - s * im; psi_i[i] = s * r + c * im;
        }
        fft(psi_r, psi_i);
        for (let i = 0; i < nx; i++) {
            const k = (i < nx / 2) ? (2 * Math.PI * i) / (nx * dx) : (2 * Math.PI * (i - nx)) / (nx * dx);
            const ph = -hbar * k * k * dt / (2 * m);
            const c = Math.cos(ph), s = Math.sin(ph);
            const r = psi_r[i], im = psi_i[i];
            psi_r[i] = c * r - s * im; psi_i[i] = s * r + c * im;
        }
        ifft(psi_r, psi_i);
        for (let i = 0; i < nx; i++) {
            const ph = -V[i] * dt / (2 * hbar);
            const c = Math.cos(ph), s = Math.sin(ph);
            const r = psi_r[i], im = psi_i[i];
            psi_r[i] = c * r - s * im; psi_i[i] = s * r + c * im;
        }
        stateRef.current.time += dt;
    }

    /* ========== DRAWING ========== */
    function draw() {
        const canvas = canvasRef.current;
        if (!canvas || !stateRef.current.psi_r) return;
        
         const ctx = canvas.getContext("2d");
         if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        
        // Match canvas internal resolution to screen pixels
        canvas.width = dimensions.width * dpr;
        canvas.height = dimensions.height * dpr;
        
        // Normalize coordinate system
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        
        const { width, height } = dimensions;
        const { psi_r, psi_i, V, time } = stateRef.current;
        const { nx, barrierHeight } = paramsRef.current;

        ctx.fillStyle = "#020617";
        ctx.fillRect(0, 0, width, height);

        let maxP = 0;
        const prob = new Array(nx);
        for (let i = 0; i < nx; i++) {
           prob[i] = Math.pow(psi_r[i], 2) + Math.pow(psi_i[i], 2);

            if (prob[i] > maxP) maxP = prob[i];
        }
        maxP = Math.max(maxP, 0.5);

        // Draw Barrier
        ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
        for (let i = 0; i < nx; i++) {
            if (V[i] > 0) {
                const x = (i / nx) * width;
                const h = (V[i] / (barrierHeight * 1.5 || 100)) * height;
                ctx.fillRect(x, height - h, Math.max(1, width / nx + 1), h);
            }
        }

        // Draw Wavefunction
        ctx.strokeStyle = "#22d3ee";
        ctx.lineWidth = 2.5;
        ctx.lineJoin = "round";
        ctx.beginPath();
        for (let i = 0; i < nx; i++) {
            const x = (i / nx) * width;
            const y = height - 10 - (prob[i] / maxP) * (height * 0.8);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        ctx.fillStyle = "#94a3b8";
        ctx.font = "14px monospace";
        ctx.fillText(`Time: ${time.toFixed(2)}`, 15, 25);
    }

    /* ========== ANIMATION ========== */
    const animate = () => {
        for (let i = 0; i < paramsRef.current.speed; i++) evolve();
        draw();
        animationRef.current = requestAnimationFrame(animate);
    };

    useEffect(() => {
        if (isPlaying) {
            animationRef.current = requestAnimationFrame(animate);
        } else {
            if (animationRef.current) {
              cancelAnimationFrame(animationRef.current);
             }

            draw();
        }
        return () => cancelAnimationFrame(animationRef.current);
    }, [isPlaying]);

    return (
        <div style={{ fontFamily: 'system-ui, sans-serif', background: '#0f172a', minHeight: '100vh', color: 'white', padding: '10px' }}>
            {/* INJECT STYLES HERE */}
            <style>{IOS_STYLES}</style>

            <h2 style={{ textAlign: 'center', fontSize: '1.2rem', marginBottom: '10px' }}>Quantum Tunneling</h2>

            {/* Canvas Container */}
            <div 
                ref={wrapperRef}
                style={{ 
                    border: '1px solid #334155', 
                    borderRadius: '8px', 
                    overflow: 'hidden',
                    background: '#020617',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.5)',
                    marginBottom: '20px'
                }}
            >
                {/* Canvas needs explicit style width/height for display size */}
                <canvas 
                    ref={canvasRef} 
                    style={{ width: dimensions.width, height: dimensions.height, display: 'block' }} 
                />
            </div>

            {/* Controls */}
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                    <button 
                        onClick={() => setIsPlaying(!isPlaying)}
                        style={{ flex: 1, padding: '14px', borderRadius: '8px', border: 'none', background: isPlaying ? '#ef4444' : '#22c55e', color: 'white', fontWeight: 'bold', fontSize: '16px' }}
                    >
                        {isPlaying ? "Pause" : "Start"}
                    </button>
                    <button 
                        onClick={() => { setIsPlaying(false); initialize(); }}
                        style={{ flex: 1, padding: '14px', borderRadius: '8px', border: 'none', background: '#475569', color: 'white', fontWeight: 'bold', fontSize: '16px' }}
                    >
                        Reset
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <ControlRow label="Particle Energy (k0)" val={params.k0} min={1} max={15} step={0.5} 
                        onChange={v => setParams(p => ({...p, k0: parseFloat(v)}))} />
                    
                    <ControlRow label="Barrier Height" val={params.barrierHeight} min={0} max={100} step={5} 
                        onChange={v => setParams(p => ({...p, barrierHeight: parseFloat(v)}))} />
                    
                    <ControlRow label="Barrier Width" val={params.barrierWidth} min={0.5} max={5} step={0.1} 
                        onChange={v => setParams(p => ({...p, barrierWidth: parseFloat(v)}))} />
                </div>
            </div>
        </div>
    );
};

/* Helper for Sliders */
const ControlRow = ({ label, val, min, max, step, onChange }) => (
    <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '14px', color: '#cbd5e1' }}>
            <span>{label}</span>
            <span style={{ color: '#22d3ee', fontWeight: 'bold' }}>{val}</span>
        </div>
        <input 
            type="range" 
            min={min} max={max} step={step} 
            value={val} 
            onChange={e => onChange(e.target.value)}
            // Touch action manipulation prevents page scroll while dragging slider
            style={{ touchAction: 'manipulation' }} 
        />
    </div>
);

export default QuantumWaveSimulation;
