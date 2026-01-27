const { useState, useEffect, useRef, useMemo } = React;

/* ================= OPTIMIZED MATH UTILITIES ================= */

// Precompute bit reversal table to save time in loop
const bitReverse = (n, bits) => {
    let reversed = 0;
    for (let i = 0; i < bits; i++) {
        reversed = (reversed << 1) | (n & 1);
        n >>= 1;
    }
    return reversed;
};

const getBitRevTable = (n) => {
    const bits = Math.log2(n);
    const table = new Uint32Array(n);
    for (let i = 0; i < n; i++) table[i] = bitReverse(i, bits);
    return table;
};

// Iterative In-Place Cooley-Tukey FFT
function fft(re, im, inverse = false) {
    const n = re.length;
    const bits = Math.log2(n);
    
    // Bit Reversal Permutation
    for (let i = 0; i < n; i++) {
        let rev = 0;
        let k = i;
        for(let j=0; j<bits; j++) {
            rev = (rev << 1) | (k & 1);
            k >>= 1;
        }
        if (i < rev) {
            [re[i], re[rev]] = [re[rev], re[i]];
            [im[i], im[rev]] = [im[rev], im[i]];
        }
    }

    // Butterfly Operations
    for (let len = 2; len <= n; len <<= 1) {
        const halfLen = len >> 1;
        const angle = (2 * Math.PI) / len * (inverse ? -1 : 1);
        const wLenR = Math.cos(angle);
        const wLenI = Math.sin(angle);

        for (let i = 0; i < n; i += len) {
            let wR = 1;
            let wI = 0;
            for (let j = 0; j < halfLen; j++) {
                const uR = re[i + j];
                const uI = im[i + j];
                const vR = re[i + j + halfLen] * wR - im[i + j + halfLen] * wI;
                const vI = re[i + j + halfLen] * wI + im[i + j + halfLen] * wR;

                re[i + j] = uR + vR;
                im[i + j] = uI + vI;
                re[i + j + halfLen] = uR - vR;
                im[i + j + halfLen] = uI - vI;

                const wTemp = wR;
                wR = wR * wLenR - wI * wLenI;
                wI = wTemp * wLenI + wI * wLenR;
            }
        }
    }

    // Scaling for Inverse
    if (inverse) {
        for (let i = 0; i < n; i++) {
            re[i] /= n;
            im[i] /= n;
        }
    }
}

/* ================= COMPONENTS ================= */

const ControlGroup = ({ label, value, min, max, step, onChange }) => (
    <div className="flex flex-col gap-2 mb-4">
        <div className="flex justify-between items-center text-xs font-mono text-cyan-100/70">
            <span>{label}</span>
            <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-cyan-400">
                {value.toFixed(2)}
            </span>
        </div>
        <input 
            type="range" 
            min={min} 
            max={max} 
            step={step} 
            value={value} 
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="range-slider"
        />
    </div>
);

const QuantumWaveSimulation = () => {
    const canvasRef = useRef(null);
    const animationRef = useRef(null);
    const containerRef = useRef(null);

    const [isPlaying, setIsPlaying] = useState(false);
    
    // Simulation Parameters
    const [simParams, setSimParams] = useState({
        nx: 512,
        dx: 0.1,
        dt: 0.05,
        hbar: 1,
        m: 1,
        speed: 2
    });

    // Wave Packet Parameters (Changing these resets the wave)
    const [waveParams, setWaveParams] = useState({
        k0: 3.5,
        x0: -15,
        sigma: 2.0,
    });

    // Potential Parameters (Changing these updates V without full reset)
    const [barrierParams, setBarrierParams] = useState({
        height: 25,
        width: 3.0,
        pos: 5.0
    });

    // Refs to avoid closure staleness in animation loop
    const stateRef = useRef({ psi_r: null, psi_i: null, V: null, time: 0 });
    const paramsRef = useRef({ ...simParams, ...waveParams, ...barrierParams });

    // Update refs when React state changes
    useEffect(() => {
        paramsRef.current = { ...simParams, ...waveParams, ...barrierParams };
        updatePotential(); // Update V immediately if barrier moves
    }, [simParams, waveParams, barrierParams]);

    // Initialize Wave Function (Only when Wave/Sim params change)
    useEffect(() => {
        initialize();
    }, [simParams.nx, waveParams.k0, waveParams.x0, waveParams.sigma]);

    /* ========== PHYSICS CORE ========== */

    function updatePotential() {
        const { nx, dx, height, width, pos } = paramsRef.current;
        const V = new Float32Array(nx); // Use TypedArrays for speed

        const xStart = -25;
        
        for (let i = 0; i < nx; i++) {
            const x = xStart + i * dx;
            
            // Rectangular Barrier
            let val = (x > pos - width / 2 && x < pos + width / 2) ? height : 0;
            
            // Absorbing Boundaries (Complex Absorbing Potential approximation for stability)
            // Visualizing the barrier part only in V array, absorption handled in evolution
            if (i < 20 || i > nx - 20) val += 100; 

            V[i] = val;
        }
        
        // Update state ref without destroying wave function
        if (stateRef.current) {
            stateRef.current.V = V;
        }
    }

    function initialize() {
        const { nx, dx, k0, x0, sigma } = paramsRef.current;

        const psi_r = new Float32Array(nx);
        const psi_i = new Float32Array(nx);
        const xStart = -25;
        
        let norm = 0;

        for (let i = 0; i < nx; i++) {
            const x = xStart + i * dx;
            const g = Math.exp(-Math.pow(x - x0, 2) / (2 * Math.pow(sigma, 2)));
            
            psi_r[i] = g * Math.cos(k0 * x);
            psi_i[i] = g * Math.sin(k0 * x);
            
            norm += psi_r[i]**2 + psi_i[i]**2;
        }

        norm = Math.sqrt(norm * dx);
        for(let i=0; i<nx; i++) {
            psi_r[i] /= norm;
            psi_i[i] /= norm;
        }

        stateRef.current.psi_r = psi_r;
        stateRef.current.psi_i = psi_i;
        stateRef.current.time = 0;
        
        updatePotential();
        draw();
    }

    function evolve() {
        const { nx, dx, dt, hbar, m } = paramsRef.current;
        const { psi_r, psi_i, V } = stateRef.current;

        // Half-step Potential (Real Space)
        for (let i = 0; i < nx; i++) {
            const ph = -V[i] * dt / (2 * hbar);
            const c = Math.cos(ph);
            const s = Math.sin(ph);
            const r = psi_r[i]; 
            const im = psi_i[i];
            psi_r[i] = c * r - s * im;
            psi_i[i] = s * r + c * im;
        }

        // Kinetic Step (Momentum Space)
        fft(psi_r, psi_i, false);

        const dk = 2 * Math.PI / (nx * dx);
        
        for (let i = 0; i < nx; i++) {
            // Correct k ordering for FFT output: 0 to N/2 is positive, N/2 to N is negative
            let k = (i < nx / 2) ? i * dk : (i - nx) * dk;
            
            const ph = -hbar * k * k * dt / (2 * m); // e^(-i H_k dt / hbar)
            const c = Math.cos(ph);
            const s = Math.sin(ph);
            
            const r = psi_r[i];
            const im = psi_i[i];
            
            psi_r[i] = c * r - s * im;
            psi_i[i] = s * r + c * im;
        }

        fft(psi_r, psi_i, true); // Inverse FFT

        // Half-step Potential (Real Space)
        for (let i = 0; i < nx; i++) {
            const ph = -V[i] * dt / (2 * hbar);
            const c = Math.cos(ph);
            const s = Math.sin(ph);
            const r = psi_r[i]; 
            const im = psi_i[i];
            psi_r[i] = c * r - s * im;
            psi_i[i] = s * r + c * im;
        }

        stateRef.current.time += dt;
    }

    /* ========== VISUALIZATION ========== */

    function draw() {
        const canvas = canvasRef.current;
        if (!canvas || !stateRef.current.psi_r) return;
        
        const ctx = canvas.getContext("2d");
        const { width, height } = canvas;
        const { psi_r, psi_i, V, time } = stateRef.current;
        const { nx } = paramsRef.current;

        // Clear Canvas
        ctx.fillStyle = "#0f172a"; // Slate-900
        ctx.fillRect(0, 0, width, height);

        // Pre-calc visual constants
        const plotHeight = height - 40;
        const bottomY = height - 20;

        // 1. Draw Potential Barrier Area
        ctx.beginPath();
        ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
        ctx.moveTo(0, bottomY);
        
        let maxV = 50; // visual scaling cap
        for (let i = 0; i < nx; i++) {
            const x = (i / nx) * width;
            const vHeight = (V[i] / maxV) * (plotHeight / 2);
            ctx.lineTo(x, bottomY - vHeight);
        }
        ctx.lineTo(width, bottomY);
        ctx.fill();

        // 2. Draw Probability Density |psi|^2
        ctx.beginPath();
        ctx.strokeStyle = "#22d3ee"; // Cyan-400
        ctx.lineWidth = 3;
        ctx.shadowBlur = 15;
        ctx.shadowColor = "#06b6d4";

        let maxProb = 0;
        for(let i=0; i<nx; i++) maxProb = Math.max(maxProb, psi_r[i]**2 + psi_i[i]**2);
        
        // Dynamic scaling to keep wave visible
        const scale = 0.8 * plotHeight / (maxProb || 1);

        for (let i = 0; i < nx; i++) {
            const prob = psi_r[i]**2 + psi_i[i]**2;
            const x = (i / nx) * width;
            const y = bottomY - prob * scale;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        
        // Reset shadow for text
        ctx.shadowBlur = 0;

        // 3. Stats Overlay
        ctx.font = "12px JetBrains Mono";
        ctx.fillStyle = "#94a3b8";
        ctx.fillText(`T = ${time.toFixed(2)}`, 20, 30);
        ctx.fillText(`P = ${(totalProbability() || 0).toFixed(4)}`, 20, 50);
    }

    function totalProbability() {
        if(!stateRef.current.psi_r) return 0;
        const { psi_r, psi_i } = stateRef.current;
        let sum = 0;
        for(let i=0; i<psi_r.length; i++) sum += psi_r[i]**2 + psi_i[i]**2;
        return sum * paramsRef.current.dx;
    }

    function animate() {
        if(stateRef.current.psi_r) {
            for (let i = 0; i < paramsRef.current.speed; i++) evolve();
            draw();
        }
        animationRef.current = requestAnimationFrame(animate);
    }

    useEffect(() => {
        if (isPlaying) {
            animationRef.current = requestAnimationFrame(animate);
        } else {
            cancelAnimationFrame(animationRef.current);
            draw(); // Ensure frame is drawn when paused
        }
        return () => cancelAnimationFrame(animationRef.current);
    }, [isPlaying]);

    // Handle container resize
    useEffect(() => {
        const resize = () => {
            if(containerRef.current && canvasRef.current) {
                canvasRef.current.width = containerRef.current.clientWidth;
                canvasRef.current.height = 300;
                draw();
            }
        };
        window.addEventListener('resize', resize);
        resize();
        return () => window.removeEventListener('resize', resize);
    }, []);

    return (
        <div className="min-h-screen bg-slate-900 text-slate-200 p-8 flex flex-col items-center">
            
            <div className="w-full max-w-4xl space-y-8">
                {/* Header */}
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500 glow">
                        Quantum Tunneling Simulation
                    </h1>
                    <p className="text-slate-400 font-mono text-sm">Split-Step Fourier Method</p>
                </div>

                {/* Canvas Container */}
                <div ref={containerRef} className="w-full bg-slate-950 rounded-xl border border-slate-800 shadow-2xl overflow-hidden relative">
                    <canvas ref={canvasRef} className="w-full h-[300px] block" />
                    
                    {/* Floating Controls */}
                    <div className="absolute top-4 right-4 flex gap-2">
                        <button 
                            className={`btn px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                                isPlaying 
                                ? 'border-purple-500/50 text-purple-300 bg-purple-500/10 hover:bg-purple-500/20' 
                                : 'border-cyan-500/50 text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20'
                            }`}
                            onClick={() => setIsPlaying(!isPlaying)}
                        >
                            {isPlaying ? "PAUSE" : "EVOLVE"}
                        </button>
                        <button 
                            className="btn px-4 py-1.5 rounded-full text-sm font-medium border border-slate-600 text-slate-400 bg-slate-800/50 hover:bg-slate-700 hover:text-white transition-all"
                            onClick={() => { setIsPlaying(false); initialize(); }}
                        >
                            RESET
                        </button>
                    </div>
                </div>

                {/* Parameters Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-slate-900/50 p-6 rounded-xl border border-slate-800/50">
                    
                    {/* Column 1: Wave Packet */}
                    <div>
                        <h3 className="text-purple-400 font-semibold mb-4 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-purple-500 glow"></span>
                            Particle Properties
                        </h3>
                        <ControlGroup 
                            label="Initial Momentum (k₀)" 
                            value={waveParams.k0} min={1} max={10} step={0.1}
                            onChange={(v) => setWaveParams(p => ({...p, k0: v}))}
                        />
                        <ControlGroup 
                            label="Position (x₀)" 
                            value={waveParams.x0} min={-20} max={0} step={0.5}
                            onChange={(v) => setWaveParams(p => ({...p, x0: v}))}
                        />
                         <ControlGroup 
                            label="Width (σ)" 
                            value={waveParams.sigma} min={0.2} max={3} step={0.1}
                            onChange={(v) => setWaveParams(p => ({...p, sigma: v}))}
                        />
                    </div>

                    {/* Column 2: Potential Barrier */}
                    <div>
                        <h3 className="text-cyan-400 font-semibold mb-4 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-cyan-500 glow"></span>
                            Barrier Config
                        </h3>
                        <ControlGroup 
                            label="Barrier Height (V₀)" 
                            value={barrierParams.height} min={0} max={60} step={1}
                            onChange={(v) => setBarrierParams(p => ({...p, height: v}))}
                        />
                        <ControlGroup 
                            label="Barrier Width" 
                            value={barrierParams.width} min={0.2} max={10} step={0.1}
                            onChange={(v) => setBarrierParams(p => ({...p, width: v}))}
                        />
                        <ControlGroup 
                            label="Barrier Position" 
                            value={barrierParams.pos} min={-5} max={10} step={0.5}
                            onChange={(v) => setBarrierParams(p => ({...p, pos: v}))}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ================= RENDER ================= */

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
    <React.StrictMode>
        <QuantumWaveSimulation />
    </React.StrictMode>
);
