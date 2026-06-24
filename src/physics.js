export function energyFromWaveNumber(k0) {
  return (k0 * k0) / 2;
}

export function rectangularTransmission(energy, barrierHeight, barrierWidth) {
  if (barrierHeight <= 0) return 1;
  if (energy <= 0) return 0;

  const delta = barrierHeight - energy;
  if (Math.abs(delta) < 1e-7) {
    return 1 / (1 + (barrierHeight * barrierWidth * barrierWidth) / 2);
  }

  if (delta > 0) {
    const kappa = Math.sqrt(2 * delta);
    const sinh = Math.sinh(Math.min(40, kappa * barrierWidth));
    const denominator = 1 +
      (barrierHeight * barrierHeight * sinh * sinh) /
        (4 * energy * delta);
    return 1 / denominator;
  }

  const q = Math.sqrt(2 * -delta);
  const sine = Math.sin(q * barrierWidth);
  const denominator = 1 +
    (barrierHeight * barrierHeight * sine * sine) /
      (4 * energy * -delta);
  return 1 / denominator;
}

export function tunnelingKappa(energy, barrierHeight) {
  return barrierHeight > energy ? Math.sqrt(2 * (barrierHeight - energy)) : 0;
}

export function normalEnergy(totalEnergy, angleDegrees) {
  const angle = (angleDegrees * Math.PI) / 180;
  return totalEnergy * Math.cos(angle) ** 2;
}

export function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

export function formatPercent(value) {
  return `${(clamp01(value) * 100).toFixed(1)}%`;
}