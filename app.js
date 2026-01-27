const { useState, useEffect, useRef } = React;

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
    speed: 1
};

/* ================= MAIN COMPONENT ================= */

const QuantumWaveSimulation = () => {
    const canvasRef = useRef(null);
    const animationRef = useRef(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [params, setParams] = useState(INITIAL_PARAMS);

    const paramsRef = useRef(params);
    const stateRef = useRef({ psi_r: null, psi_i: null, V: null, time: 0 });

    useEffect(() => { paramsRef.current = params; }, [params]);
    useEffect(initialize, [params.k0, params.sigma, params.x0, params.barrierHeight, params.barrierWidth, params.barrierPos]);

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

    /* ========== SPLIT-STEP FOURIER EVOLUTION ========== */

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

        // FFT → momentum space
        fft(psi_r, psi_i);

        // Kinetic evolution
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

        // Back to x-space
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

    /* ========== OBSERVABLES ========== */

    function totalProbability() {
        const { psi_r, psi_i } = stateRef.current;
        const { nx, dx } = paramsRef.current;
        let sum = 0;
        for (let i = 0; i < nx; i++) sum += psi_r[i] ** 2 + psi_i[i] ** 2;
        return sum * dx;
    }

    /* ========== RENDERING ========== */

    function draw() {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        const { psi_r, psi_i, time } = stateRef.current;
        const { nx } = paramsRef.current;

        ctx.fillStyle = "#020617";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        let maxP = 0;
        const prob = new Array(nx);
        for (let i = 0; i < nx; i++) {
            prob[i] = psi_r[i] ** 2 + psi_i[i] ** 2;
            if (prob[i] > maxP) maxP = prob[i];
        }

        ctx.strokeStyle = "#22d3ee";
        ctx.lineWidth = 3;
        ctx.beginPath();

        for (let i = 0; i < nx; i++) {
            const x = (i / nx) * canvas.width;
            const y = canvas.height - 30 - (prob[i] / maxP) * (canvas.height - 60);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }

        ctx.stroke();

        ctx.fillStyle = "#e5e7eb";
        ctx.font = "14px monospace";
        ctx.fillText(`Time: ${time.toFixed(2)}`, 20, 25);
        ctx.fillText(`∫|ψ|² dx = ${totalProbability().toFixed(5)}`, 20, 45);
    }

    /* ========== ANIMATION LOOP ========== */

    function animate() {
        for (let i = 0; i < paramsRef.current.speed; i++) evolve();
        draw();
        animationRef.current = requestAnimationFrame(animate);
    }

    useEffect(() => {
        if (isPlaying) animationRef.current = requestAnimationFrame(animate);
        else cancelAnimationFrame(animationRef.current);
    }, [isPlaying]);

    return (
        <div>
            <canvas ref={canvasRef} width={1000} height={400}></canvas>
            <button onClick={() => setIsPlaying(!isPlaying)}>
                {isPlaying ? "Pause" : "Start"}
            </button>
            <button onClick={() => { setIsPlaying(false); setParams(INITIAL_PARAMS); }}>
                Reset
            </button>
        </div>
    );
};

/* ================= RENDER ================= */

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <QuantumWaveSimulation />
    </React.StrictMode>
);
