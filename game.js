const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const streakEl = document.querySelector("#streak");
const stormEl = document.querySelector("#storm");
const chargeEl = document.querySelector("#charge");
const statusEl = document.querySelector("#status");
const startBtn = document.querySelector("#start");
const leftBtn = document.querySelector("#left");
const rightBtn = document.querySelector("#right");
const pulseBtn = document.querySelector("#pulse");

const state = {
  running: false,
  score: 0,
  streak: 0,
  bestStreak: 0,
  misses: 0,
  charge: 100,
  beamAngle: -Math.PI / 2,
  beamWidth: 0.34,
  beamReach: 360,
  turnInput: 0,
  pulse: 0,
  lastSpawn: 0,
  spawnEvery: 2500,
  time: 0,
  boats: [],
  sparks: [],
  floaters: [],
  rain: [],
  foam: [],
  swells: [],
  clouds: [],
  shake: 0,
  flash: 0,
  flashColor: "#ffd36a",
};

const harbor = { x: 0, y: 0, r: 34 };
const lighthouse = { x: 0, y: 0, r: 22 };
const texture = { grain: null, stipple: null };
const LAMP_OFFSET_Y = -22;
const BEAM_MIN_ANGLE = -Math.PI + 0.18;
const BEAM_MAX_ANGLE = -0.18;

function lampPoint() {
  return { x: lighthouse.x, y: lighthouse.y + LAMP_OFFSET_Y };
}

function clampBeamAngle(angle) {
  const normalized = Math.atan2(Math.sin(angle), Math.cos(angle));
  if (normalized > 0) return normalized > Math.PI / 2 ? BEAM_MIN_ANGLE : BEAM_MAX_ANGLE;
  return Math.max(BEAM_MIN_ANGLE, Math.min(BEAM_MAX_ANGLE, normalized));
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  lighthouse.x = rect.width / 2;
  lighthouse.y = rect.height * 0.7;
  harbor.x = rect.width / 2;
  harbor.y = lighthouse.y - 48;
  seedRain(rect.width, rect.height);
  seedFoam(rect.width, rect.height);
  seedSwells();
  seedClouds(rect.width, rect.height);
  createTextures();
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function angleTo(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function angleDelta(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

function spawnBoat() {
  const w = canvas.clientWidth;
  const side = Math.random() < 0.5 ? -24 : w + 24;
  const y = rand(64, canvas.clientHeight * 0.56);
  const drift = rand(-0.12, 0.12);
  state.boats.push({
    x: side,
    y,
    vx: side < 0 ? rand(10, 18) : rand(-18, -10),
    vy: rand(6, 12),
    speed: rand(18, 27),
    lit: 0,
    guidance: 0,
    panic: 0,
    alert: 0,
    drift,
    size: rand(9, 13),
    bob: rand(0, Math.PI * 2),
    roll: rand(-0.16, 0.16),
    hullHue: Math.random() < 0.55 ? "paint" : "wood",
    canopy: Math.random() < 0.62,
    mast: Math.random() < 0.72,
    wake: [],
  });
}

function seedRain(w, h) {
  const count = Math.max(70, Math.floor((w * h) / 4200));
  state.rain = Array.from({ length: count }, () => ({
    x: rand(0, w),
    y: rand(0, h),
    length: rand(7, 18),
    speed: rand(210, 380),
    alpha: rand(0.1, 0.34),
  }));
}

function seedFoam(w, h) {
  const count = Math.max(58, Math.floor(w / 7));
  state.foam = Array.from({ length: count }, () => ({
    x: rand(0, w),
    y: rand(h * 0.5, h * 0.98),
    width: rand(8, 86),
    speed: rand(6, 28),
    alpha: rand(0.035, 0.24),
    thickness: rand(0.45, 1.8),
    bend: rand(-7, 8),
    phase: rand(0, Math.PI * 2),
  }));
}

function seedSwells() {
  state.swells = [
    { amp: 13, length: 245, speed: 0.42, phase: rand(0, Math.PI * 2), slope: 0.24 },
    { amp: 8, length: 155, speed: 0.68, phase: rand(0, Math.PI * 2), slope: -0.18 },
    { amp: 4.5, length: 74, speed: 1.15, phase: rand(0, Math.PI * 2), slope: 0.36 },
    { amp: 2.8, length: 43, speed: 1.85, phase: rand(0, Math.PI * 2), slope: -0.42 },
    { amp: 1.6, length: 27, speed: 2.6, phase: rand(0, Math.PI * 2), slope: 0.58 },
  ];
}

function seedClouds(w, h) {
  state.clouds = [
    makeCloudBank(w * 0.1, h * 0.06, w * 0.68, h * 0.11, 0.1, 0.15, 9),
    makeCloudBank(w * 0.56, h * 0.1, w * 0.78, h * 0.13, -0.08, 0.11, 10),
    makeCloudBank(w * 0.24, h * 0.19, w * 0.84, h * 0.1, 0.04, 0.08, 8),
    makeCloudBank(w * 0.72, h * 0.015, w * 0.48, h * 0.08, -0.16, 0.18, 6),
  ];
}

function makeCloudBank(x, y, width, height, tilt, speed, count) {
  return {
    x,
    y,
    width,
    height,
    tilt,
    speed,
    lobes: Array.from({ length: count }, (_, i) => {
      const t = count === 1 ? 0.5 : i / (count - 1);
      return {
        x: (t - 0.5) * width + rand(-width * 0.07, width * 0.07),
        y: rand(-height * 0.22, height * 0.26),
        rx: rand(width * 0.12, width * 0.24),
        ry: rand(height * 0.28, height * 0.62),
        alpha: rand(0.35, 0.72),
      };
    }),
  };
}

function createTextures() {
  texture.grain = makePattern(96, (patternCtx, size) => {
    const data = patternCtx.createImageData(size, size);
    for (let i = 0; i < data.data.length; i += 4) {
      const v = Math.random() * 255;
      data.data[i] = v;
      data.data[i + 1] = v;
      data.data[i + 2] = v;
      data.data[i + 3] = Math.random() * 24;
    }
    patternCtx.putImageData(data, 0, 0);
  });

  texture.stipple = makePattern(64, (patternCtx, size) => {
    patternCtx.fillStyle = "rgba(255, 255, 255, 0.04)";
    for (let i = 0; i < 90; i++) {
      patternCtx.beginPath();
      patternCtx.arc(rand(0, size), rand(0, size), rand(0.35, 1.2), 0, Math.PI * 2);
      patternCtx.fill();
    }
  });
}

function makePattern(size, drawPattern) {
  const patternCanvas = document.createElement("canvas");
  patternCanvas.width = size;
  patternCanvas.height = size;
  const patternCtx = patternCanvas.getContext("2d");
  drawPattern(patternCtx, size);
  return ctx.createPattern(patternCanvas, "repeat");
}

function boatInBeam(boat) {
  const lamp = lampPoint();
  const dx = boat.x - lamp.x;
  const dy = boat.y - lamp.y;
  const distance = Math.hypot(dx, dy);
  const width = state.beamWidth + state.pulse * 0.35;
  return distance < state.beamReach + state.pulse * 110 && Math.abs(angleDelta(Math.atan2(dy, dx), state.beamAngle)) < width;
}

function getRocks(w, h) {
  return [
    { x: w * 0.1, y: h * 0.77, rw: 34, rh: 18 },
    { x: w * 0.9, y: h * 0.73, rw: 42, rh: 22 },
    { x: w * 0.18, y: h * 0.88, rw: 58, rh: 28 },
    { x: w * 0.82, y: h * 0.9, rw: 64, rh: 30 },
  ];
}

function rockPoints(rock) {
  const { x, y, rw, rh } = rock;
  return [
    { x: x - rw, y: y + rh * 0.5 },
    { x: x - rw * 0.45, y: y - rh * 0.5 },
    { x: x + rw * 0.12, y: y - rh },
    { x: x + rw * 0.72, y: y - rh * 0.28 },
    { x: x + rw, y: y + rh * 0.54 },
  ];
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i];
    const pj = polygon[j];
    const crosses = pi.y > point.y !== pj.y > point.y;
    if (crosses && point.x < ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y) + pi.x) {
      inside = !inside;
    }
  }
  return inside;
}

function boatHitsRock(boat) {
  const angle = Math.atan2(boat.vy, boat.vx);
  const samples = [
    { x: boat.x, y: boat.y },
    { x: boat.x + Math.cos(angle) * boat.size * 1.15, y: boat.y + Math.sin(angle) * boat.size * 1.15 },
    { x: boat.x - Math.cos(angle) * boat.size * 0.85, y: boat.y - Math.sin(angle) * boat.size * 0.85 },
    { x: boat.x + Math.cos(angle + Math.PI / 2) * boat.size * 0.55, y: boat.y + Math.sin(angle + Math.PI / 2) * boat.size * 0.55 },
    { x: boat.x + Math.cos(angle - Math.PI / 2) * boat.size * 0.55, y: boat.y + Math.sin(angle - Math.PI / 2) * boat.size * 0.55 },
  ];
  return getRocks(canvas.clientWidth, canvas.clientHeight).some((rock) => {
    const polygon = rockPoints(rock);
    return samples.some((sample) => pointInPolygon(sample, polygon));
  });
}

function coastY(x, w, h) {
  const nx = x / w;
  const headland = Math.exp(-((nx - 0.5) ** 2) / 0.035);
  const leftShelf = Math.exp(-((nx - 0.18) ** 2) / 0.018);
  const rightShelf = Math.exp(-((nx - 0.84) ** 2) / 0.022);
  const roughness = Math.sin(nx * Math.PI * 5.4) * 0.018 + Math.sin(nx * Math.PI * 12.2) * 0.007;
  return h * (0.92 - headland * 0.135 - leftShelf * 0.038 - rightShelf * 0.032 + roughness);
}

function getCoastPoints(w, h) {
  const points = [];
  for (let x = -24; x <= w + 24; x += 28) {
    points.push({ x, y: coastY(x, w, h) });
  }
  return points;
}

function boatHitsCoast(boat) {
  if (Math.hypot(boat.x - harbor.x, boat.y - harbor.y) < harbor.r * 2.2) return false;

  const angle = Math.atan2(boat.vy, boat.vx);
  const samples = [
    { x: boat.x, y: boat.y },
    { x: boat.x + Math.cos(angle) * boat.size * 1.1, y: boat.y + Math.sin(angle) * boat.size * 1.1 },
    { x: boat.x - Math.cos(angle) * boat.size * 0.8, y: boat.y - Math.sin(angle) * boat.size * 0.8 },
  ];

  return samples.some((sample) => sample.y > coastY(sample.x, canvas.clientWidth, canvas.clientHeight) - boat.size * 0.15);
}

function update(dt) {
  state.time += dt;
  updateAtmosphere(dt);
  updateFeedback(dt);

  if (!state.running) return;

  state.beamAngle = clampBeamAngle(state.beamAngle + state.turnInput * dt * 2.45);
  state.pulse = Math.max(0, state.pulse - dt * 1.9);
  state.charge = Math.min(100, state.charge + dt * 5.5);

  const stormLevel = Math.min(4, Math.floor((state.score + state.misses) / 4));
  state.spawnEvery = Math.max(920, 2500 - stormLevel * 330);
  if (state.time - state.lastSpawn > state.spawnEvery / 1000) {
    spawnBoat();
    state.lastSpawn = state.time;
  }

  for (const boat of state.boats) {
    const lit = boatInBeam(boat);
    boat.lit = Math.max(0, Math.min(1, boat.lit + (lit ? dt * 1.8 : -dt * 1.25)));
    boat.guidance = Math.max(0, Math.min(1, boat.guidance + (lit ? dt * 1.15 : -dt * 0.72)));
    boat.panic = Math.max(0, Math.min(1, boat.panic + (lit ? -dt * 1.3 : dt * 0.28)));
    boat.alert = Math.max(0, boat.alert - dt);
    if (boat.panic > 0.74 && boat.alert === 0) {
      boat.alert = 1.1;
      addFloater(boat.x, boat.y - 18, "!", "#ff6a5f", 0.72);
    }

    const targetAngle = angleTo(boat, harbor);
    const currentAngle = Math.atan2(boat.vy, boat.vx);
    const steerPower = boat.guidance * boat.guidance;
    const stormPull = Math.PI / 2 + Math.sin(state.time * 0.8 + boat.bob) * 0.34;
    const aimAngle = steerPower > 0.04 ? targetAngle : stormPull;
    const steer = angleDelta(aimAngle, currentAngle) * (0.012 + steerPower * 0.12);
    const nextAngle = currentAngle + steer + boat.drift * dt * (1.2 + boat.panic);
    const speed = boat.speed * (0.56 + steerPower * 0.95 + boat.panic * 0.1);
    boat.vx = Math.cos(nextAngle) * speed;
    boat.vy = Math.sin(nextAngle) * speed;
    boat.x += boat.vx * dt;
    boat.y += boat.vy * dt;

    if (boat.wake.length === 0 || Math.hypot(boat.x - boat.wake[0].x, boat.y - boat.wake[0].y) > 10) {
      boat.wake.unshift({ x: boat.x, y: boat.y, a: Math.atan2(boat.vy, boat.vx), size: boat.size, life: 1 });
      if (boat.wake.length > 10) boat.wake.pop();
    }
    for (const wake of boat.wake) wake.life -= dt * 0.95;
  }

  for (let i = state.boats.length - 1; i >= 0; i--) {
    const boat = state.boats[i];
    const arrived = Math.hypot(boat.x - harbor.x, boat.y - harbor.y) < harbor.r && boat.guidance > 0.38;
    const wrecked = boatHitsRock(boat);
    const beached = boatHitsCoast(boat);
    const lost = wrecked || beached || boat.y > canvas.clientHeight + 40 || boat.x < -70 || boat.x > canvas.clientWidth + 70;
    if (arrived) {
      state.score += 1;
      state.streak += 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      state.charge = Math.min(100, state.charge + Math.min(18, 6 + state.streak * 2));
      state.flash = 0.35;
      state.flashColor = "#ffd36a";
      burst(boat.x, boat.y, "#ffd36a", 22 + Math.min(12, state.streak * 2));
      addFloater(boat.x, boat.y - 18, state.streak > 1 ? `x${state.streak}` : "+1", "#ffd36a");
      state.boats.splice(i, 1);
      statusEl.textContent = state.streak > 2 ? `Streak ${state.streak}. The dock lights flare brighter.` : "Another lantern answers from the dock.";
    } else if (lost) {
      state.misses += 1;
      state.streak = 0;
      state.shake = 0.32;
      state.flash = 0.42;
      state.flashColor = "#ff6a5f";
      burst(boat.x, Math.min(boat.y, canvas.clientHeight - 24), "#ff6a5f", 26);
      addFloater(Math.max(28, Math.min(canvas.clientWidth - 28, boat.x)), Math.min(boat.y, canvas.clientHeight - 44), wrecked ? "rocks" : beached ? "shore" : "lost", "#ff6a5f");
      state.boats.splice(i, 1);
      statusEl.textContent = wrecked
        ? "A boat broke against the rocks. Sweep them clear."
        : beached
          ? "A boat ran aground on the coast. Guide them into the cove."
          : "A boat slipped past the rocks. Hold the beam steady.";
    }
  }

  for (let i = state.sparks.length - 1; i >= 0; i--) {
    const spark = state.sparks[i];
    spark.life -= dt;
    spark.x += spark.vx * dt;
    spark.y += spark.vy * dt;
    if (spark.life <= 0) state.sparks.splice(i, 1);
  }

  scoreEl.textContent = state.score;
  streakEl.textContent = state.streak;
  chargeEl.textContent = `${Math.round(state.charge)}%`;
  stormEl.textContent = ["Calm", "Mist", "Rain", "Gale", "Wild"][stormLevel];
}

function updateAtmosphere(dt) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  for (const drop of state.rain) {
    drop.x -= dt * drop.speed * 0.24;
    drop.y += dt * drop.speed;
    if (drop.y > h + drop.length) {
      drop.y = -drop.length;
      drop.x = rand(0, w + 80);
    }
    if (drop.x < -40) drop.x = w + 40;
  }
  for (const streak of state.foam) {
    streak.x += dt * streak.speed;
    if (streak.x > w + streak.width) {
      streak.x = -streak.width;
      streak.y = rand(h * 0.5, h * 0.98);
    }
  }
}

function updateFeedback(dt) {
  state.shake = Math.max(0, state.shake - dt);
  state.flash = Math.max(0, state.flash - dt);
  for (let i = state.floaters.length - 1; i >= 0; i--) {
    const floater = state.floaters[i];
    floater.life -= dt;
    floater.y -= dt * floater.speed;
    floater.x += Math.sin(state.time * 3 + floater.wobble) * dt * 10;
    if (floater.life <= 0) state.floaters.splice(i, 1);
  }
}

function addFloater(x, y, text, color, life = 0.95) {
  state.floaters.push({ x, y, text, color, life, maxLife: life, speed: rand(18, 32), wobble: rand(0, Math.PI * 2) });
}

function burst(x, y, color, count = 18) {
  for (let i = 0; i < count; i++) {
    const a = rand(0, Math.PI * 2);
    const s = rand(18, 70);
    state.sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.35, 0.75), color });
  }
}

function drawSea(w, h) {
  const horizon = h * 0.18;
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, "#173b44");
  gradient.addColorStop(0.18, "#113843");
  gradient.addColorStop(0.46, "#072b38");
  gradient.addColorStop(0.78, "#041c27");
  gradient.addColorStop(1, "#020e13");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  drawClouds(w, h);

  const moon = ctx.createRadialGradient(w * 0.76, h * 0.12, 3, w * 0.76, h * 0.12, 110);
  moon.addColorStop(0, "rgba(232, 255, 247, 0.28)");
  moon.addColorStop(0.2, "rgba(210, 245, 238, 0.18)");
  moon.addColorStop(1, "rgba(210, 245, 238, 0)");
  ctx.fillStyle = moon;
  ctx.fillRect(0, 0, w, h * 0.48);

  drawDistantShore(w, h, horizon);
  drawPerspectiveWater(w, h, horizon);
  drawWaterTexture(w, h, horizon);

  if (texture.grain) {
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = texture.grain;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  drawFoam(w, h);
  drawRockWash(w, h);
  drawRain(w, h);
  drawRocks(w, h);
}

function drawClouds(w, h) {
  ctx.save();
  drawSkyHaze(w, h);
  for (const cloud of state.clouds) drawCloudBank(cloud, w, h);
  ctx.restore();
}

function drawSkyHaze(w, h) {
  const mist = ctx.createLinearGradient(0, 0, 0, h * 0.36);
  mist.addColorStop(0, "rgba(195, 226, 222, 0.08)");
  mist.addColorStop(0.5, "rgba(61, 105, 111, 0.07)");
  mist.addColorStop(1, "rgba(2, 12, 17, 0)");
  ctx.fillStyle = mist;
  ctx.fillRect(0, 0, w, h * 0.36);

  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = "rgba(198, 231, 228, 0.12)";
  ctx.lineWidth = 1;
  for (let y = h * 0.12; y < h * 0.34; y += 22) {
    ctx.beginPath();
    for (let x = -20; x <= w + 20; x += 36) {
      const drift = Math.sin(x * 0.016 + y * 0.05 + state.time * 0.18) * 6;
      if (x === -20) ctx.moveTo(x, y + drift);
      else ctx.lineTo(x, y + drift);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawCloudBank(cloud, w, h) {
  const wrappedX = ((cloud.x + state.time * cloud.speed * 10 + cloud.width * 0.75) % (w + cloud.width * 1.5)) - cloud.width * 0.75;
  const moonX = w * 0.76;
  const moonY = h * 0.12;

  ctx.save();
  ctx.translate(wrappedX, cloud.y);
  ctx.rotate(cloud.tilt);

  const body = ctx.createLinearGradient(0, -cloud.height, 0, cloud.height * 1.2);
  body.addColorStop(0, "rgba(88, 125, 128, 0.32)");
  body.addColorStop(0.38, "rgba(24, 52, 58, 0.5)");
  body.addColorStop(1, "rgba(2, 12, 17, 0.74)");

  ctx.filter = "blur(10px)";
  for (const lobe of cloud.lobes) {
    ctx.globalAlpha = lobe.alpha;
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(lobe.x, lobe.y, lobe.rx, lobe.ry, lobe.x * 0.001, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.filter = "none";

  ctx.globalAlpha = 0.42;
  ctx.fillStyle = "rgba(1, 9, 13, 0.72)";
  ctx.beginPath();
  ctx.ellipse(0, cloud.height * 0.36, cloud.width * 0.54, cloud.height * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.18;
  ctx.globalCompositeOperation = "lighter";
  const dx = moonX - wrappedX;
  const dy = moonY - cloud.y;
  for (const lobe of cloud.lobes) {
    if (lobe.x < dx + cloud.width * 0.2 && lobe.y < dy + cloud.height * 0.8) {
      ctx.fillStyle = "rgba(221, 247, 241, 0.5)";
      ctx.beginPath();
      ctx.ellipse(lobe.x - lobe.rx * 0.12, lobe.y - lobe.ry * 0.34, lobe.rx * 0.72, lobe.ry * 0.2, -0.08, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawDistantShore(w, h, horizon) {
  ctx.save();
  ctx.fillStyle = "rgba(4, 20, 25, 0.6)";
  ctx.beginPath();
  ctx.moveTo(0, horizon + 38);
  for (let x = 0; x <= w + 48; x += 48) {
    const ridge = Math.sin(x * 0.028 + state.time * 0.04) * 8 + Math.cos(x * 0.017) * 12;
    ctx.lineTo(x, horizon + 28 + ridge);
  }
  ctx.lineTo(w, horizon + 92);
  ctx.lineTo(0, horizon + 92);
  ctx.closePath();
  ctx.fill();

  const haze = ctx.createLinearGradient(0, horizon - 16, 0, horizon + 120);
  haze.addColorStop(0, "rgba(180, 230, 225, 0.12)");
  haze.addColorStop(1, "rgba(180, 230, 225, 0)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, horizon - 16, w, 140);
  ctx.restore();
}

function drawPerspectiveWater(w, h, horizon) {
  ctx.save();
  ctx.lineCap = "round";

  for (let y = horizon + 28; y < h + 30; y += Math.max(24, (y - horizon) * 0.16)) {
    const depth = (y - horizon) / (h - horizon);
    const band = ctx.createLinearGradient(0, y - 24, 0, y + 34);
    band.addColorStop(0, `rgba(215, 246, 239, ${0.018 + depth * 0.025})`);
    band.addColorStop(0.55, `rgba(47, 105, 112, ${0.04 + depth * 0.09})`);
    band.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = band;
    ctx.beginPath();
    for (let x = -40; x <= w + 40; x += 14 + depth * 18) {
      const sy = swellY(x, y, depth);
      if (x === -40) ctx.moveTo(x, sy);
      else ctx.lineTo(x, sy);
    }
    ctx.lineTo(w + 40, y + 38 + depth * 22);
    ctx.lineTo(-40, y + 38 + depth * 22);
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = 0.16 + depth * 0.24;
    ctx.strokeStyle = "#c7efe8";
    ctx.lineWidth = 0.7 + depth * 1.1;
    ctx.beginPath();
    for (let x = -40; x <= w + 40; x += 14 + depth * 18) {
      const sy = swellY(x, y, depth);
      if (x === -40) ctx.moveTo(x, sy);
      else ctx.lineTo(x, sy);
    }
    ctx.stroke();
  }

  drawWindChop(w, h, horizon);
  drawMoonGlints(w, h, horizon);
  ctx.restore();
}

function drawWaterTexture(w, h, horizon) {
  drawDeepTroughs(w, h, horizon);
  drawMicroRipples(w, h, horizon);
  drawRainDimples(w, h, horizon);
  drawShoreTurbulence(w, h);
}

function swellY(x, y, depth) {
  let offset = 0;
  for (const swell of state.swells) {
    const frequency = (Math.PI * 2) / swell.length;
    offset += Math.sin(x * frequency + y * 0.015 * swell.slope + state.time * swell.speed + swell.phase) * swell.amp * depth;
  }
  return y + offset;
}

function drawDeepTroughs(w, h, horizon) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(1, 12, 18, 0.2)";
  for (let y = horizon + 58; y < h + 36; y += 38) {
    const depth = (y - horizon) / (h - horizon);
    ctx.globalAlpha = 0.12 + depth * 0.16;
    ctx.lineWidth = 7 + depth * 13;
    for (let x = -80; x < w + 100; x += 170 - depth * 72) {
      const length = 58 + depth * 118;
      const phase = state.time * (0.22 + depth * 0.18) + x * 0.012;
      const sy = swellY(x, y + Math.sin(phase) * 6, depth);
      ctx.beginPath();
      ctx.moveTo(x, sy);
      ctx.bezierCurveTo(x + length * 0.28, sy + depth * 8, x + length * 0.7, sy - depth * 7, x + length, sy + depth * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawMicroRipples(w, h, horizon) {
  ctx.save();
  ctx.lineCap = "round";
  for (let y = horizon + 18; y < h; y += 11) {
    const depth = (y - horizon) / (h - horizon);
    const step = Math.max(18, 44 - depth * 24);
    ctx.lineWidth = 0.45 + depth * 0.9;
    for (let x = -20; x < w + 40; x += step) {
      const shimmer = Math.sin(x * 0.055 + y * 0.08 + state.time * 2.3);
      const broken = Math.sin(x * 0.17 + state.time * 4.2) > -0.48;
      if (!broken) continue;
      const length = 5 + depth * 24 + shimmer * 4;
      const sy = swellY(x, y, depth) + Math.sin(x * 0.23 + state.time * 2.9) * depth * 3;
      ctx.globalAlpha = (0.035 + depth * 0.13) * (0.55 + shimmer * 0.45);
      ctx.strokeStyle = shimmer > 0.35 ? "#d8fbef" : "rgba(84, 139, 148, 0.74)";
      ctx.beginPath();
      ctx.moveTo(x, sy);
      ctx.quadraticCurveTo(x + length * 0.48, sy - depth * 1.5, x + length, sy + depth * 1.2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawRainDimples(w, h, horizon) {
  ctx.save();
  ctx.strokeStyle = "rgba(216, 251, 239, 0.16)";
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 46; i++) {
    const x = (i * 73 + Math.sin(i * 11.7) * 31 + state.time * 17) % (w + 80) - 40;
    const baseY = horizon + 34 + ((i * 47) % Math.max(1, h - horizon - 54));
    const depth = (baseY - horizon) / (h - horizon);
    const y = swellY(x, baseY, depth);
    const pulse = (Math.sin(state.time * 5.2 + i * 1.93) + 1) * 0.5;
    ctx.globalAlpha = (0.025 + depth * 0.08) * pulse;
    ctx.beginPath();
    ctx.ellipse(x, y, 2 + depth * 6 + pulse * 3, 0.7 + depth * 1.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawShoreTurbulence(w, h) {
  const coast = getCoastPoints(w, h);
  ctx.save();
  ctx.lineCap = "round";
  for (let layer = 0; layer < 3; layer++) {
    ctx.globalAlpha = 0.14 - layer * 0.032;
    ctx.strokeStyle = layer === 0 ? "#d8fbef" : "rgba(161, 222, 216, 0.72)";
    ctx.lineWidth = 1.5 + layer * 1.4;
    ctx.setLineDash([10 + layer * 6, 18 + layer * 9]);
    ctx.lineDashOffset = -state.time * (14 + layer * 7);
    ctx.beginPath();
    for (const [index, point] of coast.entries()) {
      const wash = Math.sin(point.x * 0.035 + state.time * 2.2 + layer) * (3 + layer * 2);
      const y = point.y - 12 - layer * 10 + wash;
      if (index === 0) ctx.moveTo(point.x, y);
      else ctx.lineTo(point.x, y);
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
}

function drawWindChop(w, h, horizon) {
  ctx.save();
  ctx.strokeStyle = "rgba(226, 250, 244, 0.12)";
  for (let y = horizon + 22; y < h; y += 15) {
    const depth = (y - horizon) / (h - horizon);
    ctx.globalAlpha = 0.08 + depth * 0.2;
    ctx.lineWidth = 0.6 + depth * 0.7;
    for (let x = -20; x < w + 20; x += 54 - depth * 22) {
      const length = 8 + depth * 26 + Math.sin(x * 0.08 + state.time * 2) * 4;
      const sy = swellY(x, y, depth) + Math.sin(x * 0.21 + state.time * 2.8) * depth * 3;
      ctx.beginPath();
      ctx.moveTo(x, sy);
      ctx.quadraticCurveTo(x + length * 0.5, sy - depth * 2, x + length, sy + depth * 1.4);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawMoonGlints(w, h, horizon) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const center = w * 0.54 + Math.sin(state.time * 0.18) * w * 0.035;
  for (let i = 0; i < 28; i++) {
    const depth = i / 27;
    const y = horizon + 28 + depth * (h - horizon) * 0.78;
    const width = (18 + depth * 92) * (0.56 + Math.sin(i * 2.8) * 0.12);
    const x = center + Math.sin(i * 1.7 + state.time * 0.8) * (12 + depth * 48);
    ctx.globalAlpha = (0.035 + depth * 0.06) * (0.75 + Math.sin(state.time * 2.1 + i) * 0.25);
    ctx.strokeStyle = "#ffe8a5";
    ctx.lineWidth = 0.7 + depth * 1.1;
    ctx.beginPath();
    ctx.moveTo(x - width * 0.5, swellY(x, y, depth));
    ctx.lineTo(x + width * 0.5, swellY(x + width, y, depth));
    ctx.stroke();
  }
  ctx.restore();
}

function drawFoam(w, h) {
  ctx.save();
  ctx.lineCap = "round";
  for (const streak of state.foam) {
    const horizon = h * 0.18;
    const depth = Math.max(0, (streak.y - horizon) / (h - horizon));
    const y = swellY(streak.x, streak.y, depth) + Math.sin(state.time * 1.7 + streak.phase) * depth * 5;
    ctx.globalAlpha = streak.alpha * Math.max(0.18, depth);
    ctx.strokeStyle = "#d8fbef";
    ctx.lineWidth = streak.thickness + depth * 1.6;
    ctx.beginPath();
    ctx.moveTo(streak.x, y);
    ctx.quadraticCurveTo(streak.x + streak.width * 0.5, y + streak.bend + Math.sin(state.time + streak.phase) * 4, streak.x + streak.width, y + depth * 1.6);
    ctx.stroke();

    if (depth > 0.46 && streak.width > 30) {
      ctx.globalAlpha *= 0.42;
      ctx.lineWidth = Math.max(0.5, streak.thickness * 0.55);
      ctx.beginPath();
      ctx.moveTo(streak.x + streak.width * 0.12, y + 5 + depth * 2);
      ctx.quadraticCurveTo(streak.x + streak.width * 0.48, y + 2 + streak.bend * 0.45, streak.x + streak.width * 0.84, y + 5 + depth * 3);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawRockWash(w, h) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(216, 251, 239, 0.23)";
  for (const rock of getRocks(w, h)) {
    const { x, y, rw, rh } = rock;
    const pulse = Math.sin(state.time * 2.6 + x * 0.04) * 0.5 + 0.5;
    ctx.globalAlpha = 0.2 + pulse * 0.18;
    ctx.lineWidth = 1.2 + pulse * 1.2;
    ctx.beginPath();
    ctx.ellipse(x, y + rh * 0.62, rw * (1.15 + pulse * 0.12), rh * (0.3 + pulse * 0.08), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.08 + pulse * 0.12;
    ctx.beginPath();
    ctx.ellipse(x - rw * 0.1, y + rh * 0.86, rw * (1.6 + pulse * 0.18), rh * 0.22, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCoastline(w, h) {
  const coast = getCoastPoints(w, h);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(coast[0].x, coast[0].y);
  for (const point of coast.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.lineTo(w + 24, h + 24);
  ctx.lineTo(-24, h + 24);
  ctx.closePath();

  const land = ctx.createLinearGradient(0, h * 0.68, 0, h);
  land.addColorStop(0, "#53605a");
  land.addColorStop(0.34, "#2f4544");
  land.addColorStop(0.7, "#172a2b");
  land.addColorStop(1, "#0c1719");
  ctx.fillStyle = land;
  ctx.fill();

  if (texture.stipple) {
    ctx.globalAlpha = 0.35;
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = texture.stipple;
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }

  ctx.strokeStyle = "rgba(225, 249, 242, 0.22)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(coast[0].x, coast[0].y);
  for (const point of coast.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.stroke();

  ctx.strokeStyle = "rgba(216, 251, 239, 0.2)";
  ctx.lineWidth = 1.4;
  ctx.setLineDash([16, 18]);
  ctx.beginPath();
  ctx.moveTo(coast[0].x, coast[0].y + 8);
  for (const point of coast.slice(1)) {
    const wash = Math.sin(point.x * 0.04 + state.time * 2.2) * 3;
    ctx.lineTo(point.x, point.y + 8 + wash);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  drawCove(w, h);
  drawHeadlandStones(w, h);
  ctx.restore();
}

function drawCove(w, h) {
  const shoreY = coastY(harbor.x, w, h);
  const basinY = (harbor.y + shoreY) * 0.5;
  const water = ctx.createRadialGradient(harbor.x, harbor.y, 8, harbor.x, basinY, 118);
  water.addColorStop(0, "rgba(10, 47, 59, 0.78)");
  water.addColorStop(0.48, "rgba(6, 31, 39, 0.66)");
  water.addColorStop(1, "rgba(6, 31, 39, 0)");
  ctx.fillStyle = water;
  ctx.beginPath();
  ctx.ellipse(harbor.x, basinY, 86, Math.max(46, (shoreY - harbor.y) * 0.6), 0, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(216, 251, 239, 0.2)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(harbor.x, harbor.y + 8, 62, 26, 0, Math.PI * 0.08, Math.PI * 0.92);
  ctx.stroke();

  drawBreakwater(harbor.x - 54, harbor.y + 12, harbor.x - 34, shoreY + 10, -1);
  drawBreakwater(harbor.x + 54, harbor.y + 12, harbor.x + 34, shoreY + 10, 1);
}

function drawBreakwater(x1, y1, x2, y2, side) {
  ctx.save();
  ctx.strokeStyle = "rgba(16, 27, 29, 0.9)";
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo((x1 + x2) * 0.5 + side * 14, (y1 + y2) * 0.5, x2, y2);
  ctx.stroke();

  ctx.strokeStyle = "rgba(114, 126, 119, 0.72)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x1, y1 - 2);
  ctx.quadraticCurveTo((x1 + x2) * 0.5 + side * 14, (y1 + y2) * 0.5 - 2, x2, y2 - 2);
  ctx.stroke();
  ctx.restore();
}

function drawHeadlandStones(w, h) {
  const startY = lighthouse.y + 58;
  const endY = h + 18;
  const rows = 8;
  ctx.save();
  for (let i = 0; i < rows; i++) {
    const t = i / (rows - 1);
    const y = startY + (endY - startY) * t;
    const half = 12 + t * 18;
    const wobble = Math.sin(i * 1.7) * 3;
    const stone = ctx.createLinearGradient(lighthouse.x, y - 5, lighthouse.x, y + 9);
    stone.addColorStop(0, "rgba(93, 101, 96, 0.48)");
    stone.addColorStop(1, "rgba(24, 38, 40, 0.82)");
    ctx.fillStyle = stone;
    ctx.beginPath();
    ctx.roundRect(lighthouse.x - half + wobble, y, half * 2, 8 + t * 3, 3);
    ctx.fill();
  }
  ctx.restore();
}


function drawRain() {
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
  ctx.lineWidth = 1;
  for (const drop of state.rain) {
    ctx.globalAlpha = drop.alpha;
    ctx.beginPath();
    ctx.moveTo(drop.x, drop.y);
    ctx.lineTo(drop.x - drop.length * 0.38, drop.y + drop.length);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRocks(w, h) {
  ctx.save();
  for (const rock of getRocks(w, h)) {
    const { x, y, rw, rh } = rock;
    const grad = ctx.createLinearGradient(x, y - rh, x, y + rh);
    grad.addColorStop(0, "#6c7a78");
    grad.addColorStop(0.42, "#33484d");
    grad.addColorStop(1, "#13252b");
    ctx.fillStyle = grad;
    ctx.beginPath();
    for (const [index, point] of rockPoints(rock).entries()) {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.beginPath();
    ctx.moveTo(x - rw * 0.45, y - rh * 0.5);
    ctx.lineTo(x + rw * 0.12, y - rh);
    ctx.lineTo(x - rw * 0.05, y + rh * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(223, 247, 242, 0.12)";
    ctx.stroke();
    ctx.strokeStyle = "rgba(216, 251, 239, 0.1)";
    ctx.beginPath();
    ctx.ellipse(x, y + rh * 0.65, rw * 1.15, rh * 0.32, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBeam() {
  const lamp = lampPoint();
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const horizon = h * 0.18 + 18;
  const reach = state.beamReach + state.pulse * 110;
  const width = state.beamWidth + state.pulse * 0.35;
  const left = state.beamAngle - width;
  const right = state.beamAngle + width;
  const beam = ctx.createRadialGradient(lamp.x, lamp.y, 8, lamp.x, lamp.y, reach);
  beam.addColorStop(0, `rgba(255, 226, 134, ${0.42 + state.pulse * 0.18})`);
  beam.addColorStop(0.42, "rgba(255, 218, 112, 0.17)");
  beam.addColorStop(1, "rgba(255, 218, 112, 0)");
  const dir = { x: Math.cos(state.beamAngle), y: Math.sin(state.beamAngle) };
  const tangent = { x: -dir.y, y: dir.x };

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  ctx.lineTo(w, horizon);
  const coast = getCoastPoints(w, h);
  for (const point of coast.slice().reverse()) ctx.lineTo(point.x, point.y - 6);
  ctx.closePath();
  ctx.clip();

  ctx.beginPath();
  ctx.moveTo(lamp.x, lamp.y);
  ctx.arc(lamp.x, lamp.y, reach, left, right);
  ctx.closePath();
  ctx.fillStyle = beam;
  ctx.globalCompositeOperation = "lighter";
  ctx.fill();

  for (let i = 0; i < 8; i++) {
    const t = (i + 1) / 9;
    const dist = reach * t;
    const cx = lamp.x + dir.x * dist;
    const cy = lamp.y + dir.y * dist;
    const radius = dist * Math.tan(width) * (0.68 + t * 0.24);
    ctx.globalAlpha = (0.1 - t * 0.065 + state.pulse * 0.035) * (0.72 + Math.sin(state.time * 2.3 + i) * 0.28);
    ctx.fillStyle = "rgba(255, 232, 165, 0.48)";
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(state.beamAngle + Math.PI / 2);
    ctx.beginPath();
    ctx.ellipse(0, 0, radius, 2.5 + t * 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.lineCap = "round";
  for (let i = 0; i < 18; i++) {
    const t = (i + 1) / 19;
    const dist = reach * (0.16 + t * 0.78);
    const cx = lamp.x + dir.x * dist + Math.sin(state.time * 1.9 + i * 1.7) * 7;
    const cy = lamp.y + dir.y * dist + Math.sin(state.time * 2.4 + i) * 2.5;
    if (cy < horizon + 4) continue;
    const half = dist * Math.tan(width) * (0.18 + t * 0.36);
    ctx.globalAlpha = 0.08 + (1 - t) * 0.08 + state.pulse * 0.05;
    ctx.strokeStyle = "#ffe8a5";
    ctx.lineWidth = 0.9 + t * 1.2;
    ctx.beginPath();
    ctx.moveTo(cx - tangent.x * half, cy - tangent.y * half);
    ctx.quadraticCurveTo(cx, cy + Math.sin(state.time * 2 + i) * 4, cx + tangent.x * half, cy + tangent.y * half);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  ctx.strokeStyle = `rgba(255, 238, 168, ${0.18 + state.pulse * 0.14})`;
  ctx.lineWidth = 1.3;
  for (const edge of [left, right]) {
    ctx.beginPath();
    ctx.moveTo(lamp.x, lamp.y);
    ctx.lineTo(lamp.x + Math.cos(edge) * reach, lamp.y + Math.sin(edge) * reach);
    ctx.stroke();
  }

  ctx.globalAlpha = 0.32 + state.pulse * 0.16;
  ctx.fillStyle = "#ffd36a";
  ctx.beginPath();
  ctx.arc(lamp.x, lamp.y, 10 + state.pulse * 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBoat(boat) {
  const a = Math.atan2(boat.vy, boat.vx);
  const s = boat.size;
  ctx.save();
  if (boat.panic > 0.48) {
    const warning = (boat.panic - 0.48) / 0.52;
    ctx.globalAlpha = (0.12 + warning * 0.34) * (0.65 + Math.sin(state.time * 8 + boat.bob) * 0.35);
    ctx.strokeStyle = "#ff6a5f";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(boat.x, boat.y, boat.size * (1.9 + warning * 1.5), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  for (let i = boat.wake.length - 1; i >= 0; i--) {
    const wake = boat.wake[i];
    if (wake.life <= 0) continue;
    const wakeAngle = wake.a ?? a;
    const wakeSize = wake.size ?? s;
    const backX = Math.cos(wakeAngle + Math.PI);
    const backY = Math.sin(wakeAngle + Math.PI);
    const sideX = Math.cos(wakeAngle + Math.PI / 2);
    const sideY = Math.sin(wakeAngle + Math.PI / 2);
    const spread = wakeSize * (1.2 + i * 0.28);
    const tail = wakeSize * (2.0 + i * 0.34);
    ctx.globalAlpha = wake.life * 0.2;
    ctx.strokeStyle = "#d8fbef";
    ctx.lineWidth = 1.1 + wake.life * 0.9;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(wake.x - sideX * spread * 0.25, wake.y - sideY * spread * 0.25);
    ctx.quadraticCurveTo(wake.x + backX * tail * 0.45 - sideX * spread, wake.y + backY * tail * 0.45 - sideY * spread, wake.x + backX * tail - sideX * spread * 1.35, wake.y + backY * tail - sideY * spread * 1.35);
    ctx.moveTo(wake.x + sideX * spread * 0.25, wake.y + sideY * spread * 0.25);
    ctx.quadraticCurveTo(wake.x + backX * tail * 0.45 + sideX * spread, wake.y + backY * tail * 0.45 + sideY * spread, wake.x + backX * tail + sideX * spread * 1.35, wake.y + backY * tail + sideY * spread * 1.35);
    ctx.stroke();

    ctx.globalAlpha = wake.life * 0.08;
    ctx.beginPath();
    ctx.ellipse(wake.x + backX * tail * 0.55, wake.y + backY * tail * 0.55, wakeSize * (1.2 + i * 0.12), wakeSize * 0.32, wakeAngle, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
  ctx.beginPath();
  ctx.ellipse(boat.x - boat.vx * 0.08, boat.y + s * 0.9, s * 2.05, s * 0.68, a, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(boat.x, boat.y);
  ctx.rotate(a);
  const bob = Math.sin(state.time * 4.2 + boat.bob) * 1.5;
  const roll = Math.sin(state.time * 3.2 + boat.bob) * 0.05 + boat.roll * 0.25;
  ctx.translate(0, bob);
  ctx.rotate(roll);

  const litHull = boat.lit > 0.1;
  const paintTop = boat.hullHue === "wood" ? (litHull ? "#d4b98e" : "#8f7458") : (litHull ? "#e8f3ee" : "#9fb5b7");
  const paintMid = boat.hullHue === "wood" ? "#6f5038" : "#5e7f87";
  const paintDark = boat.hullHue === "wood" ? "#2f2119" : "#1d3a43";
  const hull = ctx.createLinearGradient(0, -s * 0.9, 0, s * 0.95);
  hull.addColorStop(0, paintTop);
  hull.addColorStop(0.48, paintMid);
  hull.addColorStop(1, paintDark);

  ctx.fillStyle = hull;
  ctx.beginPath();
  ctx.moveTo(s * 1.75, 0);
  ctx.bezierCurveTo(s * 0.95, -s * 0.86, -s * 0.45, -s * 0.84, -s * 1.18, -s * 0.48);
  ctx.lineTo(-s * 1.34, s * 0.44);
  ctx.bezierCurveTo(-s * 0.42, s * 0.84, s * 0.96, s * 0.76, s * 1.75, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(2, 13, 16, 0.55)";
  ctx.lineWidth = 1.1;
  ctx.stroke();

  const side = ctx.createLinearGradient(0, 0, 0, s);
  side.addColorStop(0, "rgba(255, 255, 255, 0.05)");
  side.addColorStop(1, "rgba(2, 13, 16, 0.32)");
  ctx.fillStyle = side;
  ctx.beginPath();
  ctx.moveTo(s * 1.54, s * 0.08);
  ctx.bezierCurveTo(s * 0.75, s * 0.53, -s * 0.5, s * 0.62, -s * 1.25, s * 0.38);
  ctx.lineTo(-s * 1.34, s * 0.44);
  ctx.bezierCurveTo(-s * 0.42, s * 0.84, s * 0.96, s * 0.76, s * 1.75, 0);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
  ctx.beginPath();
  ctx.moveTo(s * 1.0, -s * 0.13);
  ctx.lineTo(-s * 0.66, -s * 0.38);
  ctx.lineTo(-s * 0.86, -s * 0.1);
  ctx.lineTo(s * 0.54, s * 0.06);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(235, 250, 247, 0.22)";
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(s * 1.28, -s * 0.06);
  ctx.quadraticCurveTo(s * 0.32, -s * 0.58, -s * 1.0, -s * 0.38);
  ctx.moveTo(s * 1.28, s * 0.08);
  ctx.quadraticCurveTo(s * 0.26, s * 0.54, -s * 1.08, s * 0.34);
  ctx.stroke();

  if (boat.canopy) {
    const cabin = ctx.createLinearGradient(-s * 0.38, -s * 0.4, s * 0.42, s * 0.4);
    cabin.addColorStop(0, litHull ? "#fff2c2" : "#bed4d3");
    cabin.addColorStop(0.55, litHull ? "#e6d28f" : "#789da2");
    cabin.addColorStop(1, "#25444a");
    ctx.fillStyle = cabin;
    ctx.beginPath();
    ctx.roundRect(-s * 0.48, -s * 0.32, s * 0.86, s * 0.64, s * 0.16);
    ctx.fill();
    ctx.strokeStyle = "rgba(3, 17, 20, 0.48)";
    ctx.stroke();
    ctx.fillStyle = litHull ? "rgba(255, 226, 151, 0.68)" : "rgba(160, 225, 222, 0.34)";
    for (const y of [-0.17, 0.17]) {
      ctx.beginPath();
      ctx.roundRect(-s * 0.2, s * y - s * 0.07, s * 0.36, s * 0.14, s * 0.05);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = "rgba(28, 52, 58, 0.72)";
    ctx.beginPath();
    ctx.roundRect(-s * 0.52, -s * 0.26, s * 0.76, s * 0.52, s * 0.15);
    ctx.fill();
  }

  if (boat.mast) {
    ctx.strokeStyle = "rgba(30, 34, 32, 0.68)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-s * 0.08, -s * 0.92);
    ctx.lineTo(-s * 0.08, s * 0.48);
    ctx.stroke();
    ctx.fillStyle = litHull ? "rgba(255, 248, 220, 0.72)" : "rgba(222, 232, 226, 0.52)";
    ctx.beginPath();
    ctx.moveTo(-s * 0.04, -s * 0.82);
    ctx.lineTo(s * 0.72, -s * 0.12);
    ctx.lineTo(-s * 0.03, s * 0.04);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(2, 13, 16, 0.24)";
    ctx.stroke();
  }

  ctx.fillStyle = boat.panic > 0.65 ? "#ff6a5f" : boat.guidance > 0.25 ? "#ffd36a" : "#6f8487";
  ctx.beginPath();
  ctx.arc(s * 1.38, 0, s * 0.18, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = litHull ? 0.8 : 0.42;
  ctx.fillStyle = "#ffd36a";
  ctx.beginPath();
  ctx.arc(-s * 1.06, -s * 0.26, s * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = boat.panic > 0.62 ? "#ff6a5f" : "#81f0d9";
  ctx.beginPath();
  ctx.arc(-s * 1.06, s * 0.26, s * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawVignette(w, h) {
  ctx.save();
  const vignette = ctx.createRadialGradient(w * 0.5, h * 0.45, h * 0.18, w * 0.5, h * 0.5, h * 0.72);
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(0.72, "rgba(0, 0, 0, 0.18)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.52)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawLighthouse() {
  ctx.save();
  ctx.translate(lighthouse.x, lighthouse.y);
  ctx.shadowColor = "rgba(0, 0, 0, 0.42)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 10;

  ctx.fillStyle = "rgba(4, 16, 18, 0.56)";
  ctx.beginPath();
  ctx.ellipse(4, 60, 42, 13, -0.03, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  const towerHalf = (y) => 12 + ((y + 18) / 70) * 8;
  const drawTowerBand = (y, height, topColor, bottomColor) => {
    const topHalf = towerHalf(y);
    const bottomHalf = towerHalf(y + height);
    const band = ctx.createLinearGradient(-bottomHalf, y, bottomHalf, y);
    band.addColorStop(0, topColor);
    band.addColorStop(0.52, bottomColor);
    band.addColorStop(1, "#6e2d2f");
    ctx.fillStyle = band;
    ctx.beginPath();
    ctx.moveTo(-topHalf, y);
    ctx.lineTo(topHalf, y);
    ctx.lineTo(bottomHalf, y + height);
    ctx.lineTo(-bottomHalf, y + height);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(73, 32, 34, 0.38)";
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.ellipse(0, y + height, bottomHalf, 2.7, 0, 0, Math.PI);
    ctx.stroke();
  };

  const plinth = ctx.createLinearGradient(-36, 42, 36, 62);
  plinth.addColorStop(0, "#798079");
  plinth.addColorStop(0.45, "#4f5d59");
  plinth.addColorStop(1, "#253739");
  ctx.fillStyle = plinth;
  ctx.beginPath();
  ctx.moveTo(-28, 42);
  ctx.lineTo(25, 42);
  ctx.lineTo(34, 56);
  ctx.lineTo(-35, 58);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(225, 249, 242, 0.14)";
  ctx.stroke();

  ctx.fillStyle = "rgba(10, 23, 26, 0.36)";
  for (const x of [-20, -7, 8, 22]) {
    ctx.beginPath();
    ctx.ellipse(x, 51 + Math.sin(x) * 1.4, 7, 3, -0.12, 0, Math.PI * 2);
    ctx.fill();
  }

  const tower = ctx.createLinearGradient(-22, -18, 22, 52);
  tower.addColorStop(0, "#f1f6ef");
  tower.addColorStop(0.35, "#dce9e3");
  tower.addColorStop(0.68, "#b7c8c6");
  tower.addColorStop(1, "#6b7f82");
  ctx.fillStyle = tower;
  ctx.beginPath();
  ctx.moveTo(-18, 52);
  ctx.lineTo(-11, -18);
  ctx.lineTo(11, -18);
  ctx.lineTo(18, 52);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(7, 22, 27, 0.26)";
  ctx.beginPath();
  ctx.moveTo(5, -18);
  ctx.lineTo(11, -18);
  ctx.lineTo(18, 52);
  ctx.lineTo(3, 52);
  ctx.lineTo(1, -18);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.24)";
  ctx.beginPath();
  ctx.moveTo(-13, -15);
  ctx.lineTo(-6, -18);
  ctx.lineTo(-10, 50);
  ctx.lineTo(-17, 52);
  ctx.closePath();
  ctx.fill();

  for (const y of [-8, 14, 37]) {
    ctx.strokeStyle = "rgba(17, 42, 47, 0.16)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, y, towerHalf(y), 2.2, 0, 0, Math.PI);
    ctx.stroke();
  }

  drawTowerBand(5, 10, "#c9625a", "#a63f3f");
  drawTowerBand(27, 11, "#c9625a", "#a63f3f");

  const door = ctx.createLinearGradient(-7, 34, 7, 52);
  door.addColorStop(0, "#25464e");
  door.addColorStop(1, "#10272e");
  ctx.fillStyle = door;
  ctx.beginPath();
  ctx.roundRect(-6, 34, 12, 18, 5);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 211, 106, 0.72)";
  ctx.beginPath();
  ctx.arc(3.5, 43, 1.3, 0, Math.PI * 2);
  ctx.fill();

  const windowGlow = 0.46 + Math.sin(state.time * 2.4) * 0.08;
  ctx.fillStyle = `rgba(255, 221, 139, ${windowGlow})`;
  ctx.strokeStyle = "rgba(15, 35, 39, 0.54)";
  ctx.lineWidth = 1.2;
  for (const y of [-9, 18]) {
    ctx.beginPath();
    ctx.roundRect(-5, y, 10, 8, 3);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, y + 1);
    ctx.lineTo(0, y + 7);
    ctx.stroke();
  }

  ctx.fillStyle = "#1b3339";
  ctx.beginPath();
  ctx.ellipse(0, -17, 22, 5, 0, Math.PI, 0);
  ctx.lineTo(18, -12);
  ctx.lineTo(-18, -12);
  ctx.closePath();
  ctx.fill();

  const balcony = ctx.createLinearGradient(-26, -25, 26, -16);
  balcony.addColorStop(0, "#5f716d");
  balcony.addColorStop(0.45, "#9aa39a");
  balcony.addColorStop(1, "#2c4142");
  ctx.fillStyle = balcony;
  ctx.beginPath();
  ctx.roundRect(-24, -24, 48, 7, 3);
  ctx.fill();
  ctx.strokeStyle = "rgba(8, 21, 24, 0.65)";
  ctx.lineWidth = 1;
  for (let x = -18; x <= 18; x += 9) {
    ctx.beginPath();
    ctx.moveTo(x, -24);
    ctx.lineTo(x + 1, -14);
    ctx.stroke();
  }

  const lantern = ctx.createLinearGradient(-16, -41, 16, -20);
  lantern.addColorStop(0, "rgba(198, 244, 236, 0.5)");
  lantern.addColorStop(0.44, "rgba(255, 233, 157, 0.76)");
  lantern.addColorStop(1, "rgba(35, 64, 70, 0.66)");
  ctx.fillStyle = lantern;
  ctx.beginPath();
  ctx.moveTo(-13, -38);
  ctx.lineTo(13, -38);
  ctx.lineTo(15, -22);
  ctx.lineTo(-15, -22);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(14, 31, 35, 0.72)";
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-5, -38);
  ctx.lineTo(-5, -22);
  ctx.moveTo(5, -38);
  ctx.lineTo(5, -22);
  ctx.stroke();

  ctx.fillStyle = "#1b2e33";
  ctx.beginPath();
  ctx.moveTo(-18, -39);
  ctx.lineTo(0, -51);
  ctx.lineTo(18, -39);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#31474b";
  ctx.beginPath();
  ctx.moveTo(-11, -41);
  ctx.lineTo(0, -49);
  ctx.lineTo(12, -41);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#0e1d22";
  ctx.fillRect(-3, -56, 6, 7);

  ctx.globalCompositeOperation = "lighter";
  const lanternGlow = ctx.createRadialGradient(0, LAMP_OFFSET_Y, 2, 0, LAMP_OFFSET_Y, 30 + state.pulse * 10);
  lanternGlow.addColorStop(0, `rgba(255, 220, 128, ${0.42 + state.pulse * 0.18})`);
  lanternGlow.addColorStop(0.45, "rgba(255, 220, 128, 0.13)");
  lanternGlow.addColorStop(1, "rgba(255, 220, 128, 0)");
  ctx.fillStyle = lanternGlow;
  ctx.beginPath();
  ctx.arc(0, LAMP_OFFSET_Y, 30 + state.pulse * 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  ctx.fillStyle = "#ffd36a";
  ctx.beginPath();
  ctx.arc(0, LAMP_OFFSET_Y, 8 + state.pulse * 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 238, 168, 0.56)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, LAMP_OFFSET_Y, 13 + state.pulse * 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawHarbor() {
  ctx.save();
  const harborGlow = ctx.createRadialGradient(harbor.x, harbor.y, 4, harbor.x, harbor.y, harbor.r * 1.9);
  harborGlow.addColorStop(0, "rgba(216, 251, 239, 0.13)");
  harborGlow.addColorStop(0.52, "rgba(216, 251, 239, 0.06)");
  harborGlow.addColorStop(1, "rgba(216, 251, 239, 0)");
  ctx.fillStyle = harborGlow;
  ctx.beginPath();
  ctx.arc(harbor.x, harbor.y, harbor.r * 1.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(216, 251, 239, 0.42)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 7]);
  ctx.beginPath();
  ctx.arc(harbor.x, harbor.y, harbor.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#533f2d";
  ctx.fillRect(harbor.x - 48, harbor.y + 25, 96, 9);
  ctx.fillStyle = "#ffd36a";
  for (const x of [-34, 0, 34]) {
    const glow = 2.4 + Math.min(5, state.streak) * 0.45 + Math.sin(state.time * 4 + x) * 0.35;
    ctx.beginPath();
    ctx.arc(harbor.x + x, harbor.y + 21, glow, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function draw() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.save();
  if (state.shake > 0) {
    const strength = state.shake * 9;
    ctx.translate(Math.sin(state.time * 74) * strength, Math.cos(state.time * 61) * strength);
  }
  drawSea(w, h);
  drawCoastline(w, h);
  drawHarbor();
  drawBeam();
  for (const boat of state.boats) drawBoat(boat);
  drawLighthouse();

  for (const spark of state.sparks) {
    ctx.globalAlpha = Math.max(0, spark.life * 1.8);
    ctx.fillStyle = spark.color;
    ctx.beginPath();
    ctx.arc(spark.x, spark.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  drawFloaters();
  drawVignette(w, h);

  if (state.flash > 0) {
    ctx.globalAlpha = state.flash * 0.22;
    ctx.fillStyle = state.flashColor;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  if (!state.running) {
    ctx.fillStyle = "rgba(3, 12, 16, 0.38)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#f3f7f5";
    ctx.textAlign = "center";
    ctx.font = "800 28px system-ui, sans-serif";
    ctx.fillText("Pocket Lighthouse", w / 2, h * 0.38);
    ctx.font = "500 15px system-ui, sans-serif";
    ctx.fillStyle = "#c6d7d3";
    ctx.fillText("Sweep the beam. Bring them home.", w / 2, h * 0.38 + 30);
  }
}

function drawFloaters() {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "800 18px system-ui, sans-serif";
  for (const floater of state.floaters) {
    const alpha = Math.max(0, floater.life / floater.maxLife);
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(4, 16, 20, 0.72)";
    ctx.strokeText(floater.text, floater.x, floater.y);
    ctx.fillStyle = floater.color;
    ctx.fillText(floater.text, floater.x, floater.y);
  }
  ctx.restore();
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function setTurn(value) {
  state.turnInput = value;
}

function doPulse() {
  if (!state.running || state.charge < 28) return;
  state.charge -= 28;
  state.pulse = 1;
  let helped = 0;
  for (const boat of state.boats) {
    if (boatInBeam(boat)) {
      boat.guidance = Math.min(1, boat.guidance + 0.28);
      boat.panic = Math.max(0, boat.panic - 0.36);
      helped += 1;
      addFloater(boat.x, boat.y - 20, "steady", "#d8fbef", 0.7);
    }
  }
  if (helped > 0) {
    state.flash = 0.25;
    state.flashColor = "#d8fbef";
    statusEl.textContent = helped === 1 ? "The pulse steadied a boat in the storm." : `The pulse steadied ${helped} boats at once.`;
  }
  const lamp = lampPoint();
  burst(lamp.x, lamp.y, "#ffd36a", 28);
}

function startGame() {
  state.running = true;
  state.score = 0;
  state.streak = 0;
  state.bestStreak = 0;
  state.misses = 0;
  state.charge = 100;
  state.boats = [];
  state.sparks = [];
  state.floaters = [];
  state.shake = 0;
  state.flash = 0;
  state.time = 0;
  state.lastSpawn = -1;
  scoreEl.textContent = "0";
  streakEl.textContent = "0";
  stormEl.textContent = "Calm";
  chargeEl.textContent = "100%";
  startBtn.textContent = "Restart";
  statusEl.textContent = "The first boats are looking for your light.";
}

for (const [button, value] of [[leftBtn, -1], [rightBtn, 1]]) {
  button.addEventListener("pointerdown", () => setTurn(value));
  button.addEventListener("pointerup", () => setTurn(0));
  button.addEventListener("pointercancel", () => setTurn(0));
  button.addEventListener("pointerleave", () => setTurn(0));
}

canvas.addEventListener("pointermove", (event) => {
  if (!state.running || event.pointerType === "mouse" && event.buttons === 0) return;
  const rect = canvas.getBoundingClientRect();
  const lamp = lampPoint();
  state.beamAngle = clampBeamAngle(Math.atan2(event.clientY - rect.top - lamp.y, event.clientX - rect.left - lamp.x));
});

canvas.addEventListener("pointerdown", (event) => {
  if (!state.running) startGame();
  const rect = canvas.getBoundingClientRect();
  const lamp = lampPoint();
  state.beamAngle = clampBeamAngle(Math.atan2(event.clientY - rect.top - lamp.y, event.clientX - rect.left - lamp.x));
});

startBtn.addEventListener("click", startGame);
pulseBtn.addEventListener("click", doPulse);
window.addEventListener("resize", resize);

resize();
requestAnimationFrame(loop);
