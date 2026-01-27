import React, { useState, useEffect, useRef } from 'react';

/* ================= FFT UTILITIES (Unchanged) ================= */

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
    nx: 512, // Reduced slightly for older phones, increase to 1024 if smooth
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
    speed: 2 // Slightly faster for mobile visual feedback
};

/* ================= MAIN COMPONENT ================= */

const QuantumWaveSimulation = () => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null); // Ref for the parent div
    const animationRef = useRef(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [params, setParams] = useState(INITIAL_PARAMS);
    const [dimensions, setDimensions] = useState({ width: 300, height: 300 });

    const paramsRef = useRef(params);
    const stateRef = useRef({ psi_r: null, psi_i: null, V: null, time: 0 });

    // Sync refs
    useEffect(() => { paramsRef.current = params; }, [params]);

    // Initialize on parameter change
    useEffect(() => {
        initialize();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.k0, params.sigma, params.x0, params.barrierHeight, params.barrierWidth, params.barrierPos]);

    /* ========== RESPONSIVE LOGIC ========== */
    
    useEffect(() => {
        const handleResize = () => {
            if (containerRef.current) {
                // Get width of container, limited by max width
                const width = containerRef.current.clientWidth;
                // Height based on aspect ratio or screen space
                const height = Math.min(window.innerHeight * 0.5, 400); 
                setDimensions({ width, height });
            }
        };

        window.addEventListener('resize', handleResize);
        handleResize(); // Initial call

        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Re-draw when dimensions change
    useEffect(() => {
        draw();
    }, [dimensions]);


    /* ========== INITIALIZATION ========== */

    function initialize() {
        const { nx, dx, k0, x0, sigma, barrierHeight, barrierWidth, barrierPos } = paramsRef.current;

        const psi_r = new Array(nx);
        const psi_i = new Array(nx);
        const V = new Array(nx);

        const xStart = -10;
        let norm = 0;

        for (let i = 0; i < nx; i++) {
            const x = xStart + i * dx;
            const g = Math.exp(-(x - x0) ** 2 / (2 * sigma ** 2));

            psi_r[i] = g * Math.cos(k0 * x);
            psi_i[i] = g * Math.sin(k0 * x);
            norm += psi_r[i] ** 2 + psi_i[i] ** 2;

            // Barrier
            V[i] = (x > barrierPos - barrierWidth / 2 && x < barrierPos + barrierWidth / 2)
                ? barrierHeight : 0;

            // Absorbing boundaries (CAP)
            const w = 40, eta = 0.02;
            if (i < w) V[i] += -eta * (w - i) ** 2;
            if (i > nx - w) V[i] += -eta * (i - (nx - w)) ** 2;
        }

        norm = Math.sqrt(norm * dx);
        for (let i = 0; i < nx; i++) {
            psi_r[i] /= norm;
            psi_i[i] /= norm;
        }

        stateRef.current = { psi_r, psi_i, V, time: 0 };
        draw();
    }

    /* ========== PHYSICS LOOP (Unchanged logic) ========== */

    function evolve() {
        const { nx, dx, dt, hbar, m } = paramsRef.current;
        const { psi_r, psi_i, V } = stateRef.current;

        // V/2
        for (let i = 0; i < nx; i++) {
            const ph = -V[i] * dt / (2 * hbar);
            const c = Math.cos(ph), s = Math.sin(ph);
            const r = psi_r[i], im = psi_i[i];
            psi_r[i] = c * r - s * im;
            psi_i[i] = s * r + c * im;
        }

        // FFT
        fft(psi_r, psi_i);

        // Kinetic
        for (let i = 0; i < nx; i++) {
            const k = (i < nx / 2)
                ? (2 * Math.PI * i) / (nx * dx)
                : (2 * Math.PI * (i - nx)) / (nx * dx);

            const ph = -hbar * k * k * dt / (2 * m);
            const c = Math.cos(ph), s = Math.sin(ph);
            const r = psi_r[i], im = psi_i[i];
            psi_r[i] = c * r - s * im;
            psi_i[i] = s * r + c * im;
        }

        // IFFT
        ifft(psi_r, psi_i);

        // V/2
        for (let i = 0; i < nx; i++) {
            const ph = -V[i] * dt / (2 * hbar);
            const c = Math.cos(ph), s = Math.sin(ph);
            const r = psi_r[i], im = psi_i[i];
            psi_r[i] = c * r - s * im;
            psi_i[i] = s * r + c * im;
        }

        stateRef.current.time += dt;
    }

    /* ========== RENDERING ========== */

   // Add this inside your QuantumWaveSimulation component
function draw() {
    const canvas = canvasRef.current;
    if (!canvas || !stateRef.current.psi_r) return;
    
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    
    // Pro-Tip: Ensure logical vs physical pixel alignment
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    
    // ... (rest of your drawing code) ...
    // Note: When using dpr, you must scale the context once at the start of draw:
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); 
    
    // Now use 'width' and 'height' instead of canvas.width
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);
    
    // ... drawing logic ...
}

// Updated Resize Observer for iOS stability
useEffect(() => {
    const resize = () => {
        if(containerRef.current && canvasRef.current) {
            const dpr = window.devicePixelRatio || 1;
            const rect = containerRef.current.getBoundingClientRect();
            
            // Set physical pixels
            canvasRef.current.width = rect.width * dpr;
            canvasRef.current.height = 300 * dpr;
            
            // Set CSS display pixels
            canvasRef.current.style.width = `${rect.width}px`;
            canvasRef.current.style.height = `300px`;
            
            draw();
        }
    };
    window.addEventListener('resize', resize);
    resize();
    return () => window.removeEventListener('resize', resize);
}, []);

    return (
        <div 
            ref={containerRef} 
            style={{ 
                width: '100%', 
                maxWidth: '600px', 
                margin: '0 auto', 
                padding: '10px', 
                boxSizing: 'border-box',
                fontFamily: 'system-ui, sans-serif',
                color: '#e2e8f0',
                background: '#020617',
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            <h2 style={{ fontSize: '1.2rem', textAlign: 'center', margin: '0 0 10px 0' }}>
                Quantum Tunneling
            </h2>

            {/* Canvas Container */}
            <div style={{ 
                borderRadius: '8px', 
                overflow: 'hidden', 
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)',
                marginBottom: '15px',
                border: '1px solid #1e293b'
            }}>
                <canvas 
                    ref={canvasRef} 
                    style={{ 
                        width: '100%', 
                        height: `${dimensions.height}px`, 
                        display: 'block' 
                    }} 
                />
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <button 
                    onClick={togglePlay}
                    style={{
                        flex: 1,
                        padding: '12px',
                        background: isPlaying ? '#ef4444' : '#22c55e',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                    }}
                >
                    {isPlaying ? "Pause" : "Start"}
                </button>
                <button 
                    onClick={reset}
                    style={{
                        flex: 1,
                        padding: '12px',
                        background: '#334155',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                    }}
                >
                    Reset
                </button>
            </div>

            {/* Sliders */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <ControlRow 
                    label="Momentum (k0)" 
                    value={params.k0} 
                    min={1} max={15} step={0.5} 
                    onChange={(v) => setParams(p => ({...p, k0: parseFloat(v)}))} 
                />
                <ControlRow 
                    label="Barrier Height" 
                    value={params.barrierHeight} 
                    min={0} max={100} step={5} 
                    onChange={(v) => setParams(p => ({...p, barrierHeight: parseFloat(v)}))} 
                />
                 <ControlRow 
                    label="Barrier Width" 
                    value={params.barrierWidth} 
                    min={0.5} max={5} step={0.1} 
                    onChange={(v) => setParams(p => ({...p, barrierWidth: parseFloat(v)}))} 
                />
            </div>
            
            <p style={{textAlign: 'center', fontSize: '0.8rem', color: '#64748b', marginTop: '20px'}}>
                Adjust parameters and press Reset to apply.
            </p>
        </div>
    );
};

// Helper component for mobile-friendly sliders
const ControlRow = ({ label, value, min, max, step, onChange }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
            <span>{label}</span>
            <span style={{ color: '#38bdf8' }}>{value}</span>
        </div>
        <input 
            type="range" 
            min={min} max={max} step={step} 
            value={value} 
            onChange={(e) => onChange(e.target.value)}
            style={{ width: '100%', accentColor: '#38bdf8', height: '20px' }}
        />
    </div>
);

export default QuantumWaveSimulation;
