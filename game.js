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
  beamReach: 300,
  beamSpeed: 2.45,
  turnInput: 0,
  pulse: 0,
  lastSpawn: 0,
  spawnEvery: 3200,
  time: 0,
  weatherLevel: 0,
  weatherTimer: 0,
  wildDuration: 0,
  boats: [],
  monsters: [],
  sparks: [],
  floaters: [],
  rain: [],
  foam: [],
  swells: [],
  clouds: [],
  shake: 0,
  flash: 0,
  flashColor: "#ffd36a",
  upgradeLevel: 0,
  upgradeFlash: 0,
  upgradeText: "",
};

const UPGRADES = [
  { score: 12, type: "speed", label: "Faster sweep!" },
  { score: 28, type: "reach", label: "Longer beam!" },
  { score: 55, type: "width", label: "Wider beam!" },
];

const ISLAND_R = 34;
const harbor = { x: 0, y: 0, r: 58 };
const lighthouse = { x: 0, y: 0, r: 15 };
const texture = { grain: null, stipple: null };
const LAMP_OFFSET_Y = 0;

const LA = {
  seaDeep: "#0d4a9a",
  seaMid: "#1868c8",
  seaShallow: "#2878d8",
  seaFoam: "#88cef8",
  land: "#389808",
  landLight: "#50b818",
  landDark: "#286000",
  sand: "#c8a828",
  sandLight: "#e0c040",
  sandDark: "#a88020",
  rock: "#706040",
  rockLight: "#988858",
  rockDark: "#403018",
  wood: "#906028",
  woodDark: "#60380c",
  outline: "#201008",
  gold: "#f0cc30",
  white: "#e8e8d8",
  red: "#c82020",
};
function lampPoint() {
  return { x: lighthouse.x, y: lighthouse.y + LAMP_OFFSET_Y };
}

function clampBeamAngle(angle) {
  return angle; // full 360° rotation
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  lighthouse.x = rect.width / 2;
  lighthouse.y = rect.height / 2;
  harbor.x = rect.width / 2;
  harbor.y = rect.height / 2;
  seedRain(rect.width, rect.height);
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
  const h = canvas.clientHeight;
  const side = Math.floor(Math.random() * 4); // 0=top 1=right 2=bottom 3=left
  let x, y, vx, vy;
  const margin = 28;
  if (side === 0)      { x = rand(margin, w - margin); y = -margin; vx = rand(-8, 8); vy = rand(10, 18); }
  else if (side === 1) { x = w + margin; y = rand(margin, h - margin); vx = rand(-18, -10); vy = rand(-8, 8); }
  else if (side === 2) { x = rand(margin, w - margin); y = h + margin; vx = rand(-8, 8); vy = rand(-18, -10); }
  else                 { x = -margin; y = rand(margin, h - margin); vx = rand(10, 18); vy = rand(-8, 8); }

  // Variable boat size → point value
  const tier = Math.random();
  const size = tier < 0.55 ? rand(9, 12) : tier < 0.85 ? rand(14, 18) : rand(20, 26);
  const value = size < 13 ? 1 : size < 19 ? 2 : 3;

  state.boats.push({
    x, y, vx, vy,
    speed: rand(16, 26) * (1 - (value - 1) * 0.12), // bigger = slightly slower
    lit: 0, guidance: 0, panic: 0, alert: 0,
    drift: rand(-0.10, 0.10),
    size, value,
    bob: rand(0, Math.PI * 2),
    roll: rand(-0.16, 0.16),
    hullHue: Math.random() < 0.55 ? "paint" : "wood",
    canopy: Math.random() < 0.62,
    mast: Math.random() < 0.72,
    wake: [],
  });
}

function spawnMonster(big) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const cx = lighthouse.x;
  const cy = lighthouse.y;
  let x, y;
  do {
    x = rand(40, w - 40);
    y = rand(40, h - 40);
  } while (Math.hypot(x - cx, y - cy) < 160);
  state.monsters.push({ x, y, vx: 0, vy: 0, lit: 0, visible: 0, phase: rand(0, Math.PI * 2), big: !!big, size: big ? 28 : 14 });
}

function seedRain(w, h) {
  const count = 28;
  state.rain = Array.from({ length: count }, () => ({
    x: rand(20, w - 20),
    y: rand(20, h * 0.72),
    length: rand(10, 22),
    speed: rand(0.25, 0.7),
    alpha: rand(0.07, 0.18),
  }));
}

function seedFoam(w, h) {
  state.foam = [];
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
  state.clouds = [];
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
  const cx = w / 2, cy = h / 2;
  const d = Math.min(w, h) * 0.26;
  return [
    { x: cx - d * 0.95, y: cy - d * 0.55, rw: 22, rh: 14 },
    { x: cx + d * 0.90, y: cy - d * 0.70, rw: 26, rh: 16 },
    { x: cx - d * 0.60, y: cy + d * 1.00, rw: 24, rh: 15 },
    { x: cx + d * 0.75, y: cy + d * 0.85, rw: 28, rh: 17 },
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
  const roughness = Math.sin(nx * Math.PI * 5.4) * 4 + Math.sin(nx * Math.PI * 12.2) * 2;
  return h * 0.76 + roughness;
}

function getCoastPoints(w, h) {
  const points = [];
  for (let x = -24; x <= w + 24; x += 28) {
    points.push({ x, y: coastY(x, w, h) });
  }
  return points;
}

function boatHitsIsland(boat) {
  return Math.hypot(boat.x - lighthouse.x, boat.y - lighthouse.y) < ISLAND_R + boat.size * 0.7;
}

function monsterInBeam(m) {
  const lamp = lampPoint();
  const dx = m.x - lamp.x;
  const dy = m.y - lamp.y;
  const dist = Math.hypot(dx, dy);
  const reach = state.beamReach + state.pulse * 110;
  const width = state.beamWidth + state.pulse * 0.35;
  return dist < reach && Math.abs(angleDelta(Math.atan2(dy, dx), state.beamAngle)) < width;
}

// Returns a "rock avoidance" steering offset for guided boats
function rockAvoidance(boat) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  let ax = 0, ay = 0;
  for (const rock of getRocks(w, h)) {
    const dx = boat.x - rock.x;
    const dy = boat.y - rock.y;
    const dist = Math.hypot(dx, dy);
    const danger = rock.rw * 1.8;
    if (dist < danger && dist > 0) {
      const strength = (1 - dist / danger) * 0.9;
      ax += (dx / dist) * strength;
      ay += (dy / dist) * strength;
    }
  }
  return { ax, ay };
}

function update(dt) {
  state.time += dt;
  updateFeedback(dt);

  if (!state.running) return;

  state.beamAngle = clampBeamAngle(state.beamAngle + state.turnInput * dt * state.beamSpeed);
  state.pulse = Math.max(0, state.pulse - dt * 1.9);
  state.charge = Math.min(100, state.charge + dt * 5.5);
  state.upgradeFlash = Math.max(0, state.upgradeFlash - dt);

  // Weather evolution: escalates then breaks and cycles
  state.weatherTimer += dt;
  if (state.weatherLevel < 4) {
    const weatherInterval = 38 - state.weatherLevel * 5;
    if (state.weatherTimer > weatherInterval) {
      state.weatherLevel++;
      state.weatherTimer = 0;
      if (state.weatherLevel === 4) state.wildDuration = rand(25, 42);
      statusEl.textContent = ["", "Mist rolling in. Keep the light steady.", "Rain! Boats lose their way faster.", "Gale force winds — boats panic without light.", "Wild storm! Every second in the dark is dangerous."][state.weatherLevel];
    }
  } else if (state.weatherTimer > state.wildDuration) {
    // Storm breaks — drop back to Mist and let it climb again
    state.weatherLevel = 1;
    state.weatherTimer = 0;
    statusEl.textContent = "Storm breaking. A brief calm…";
  }

  // Lighthouse upgrades at score milestones
  for (const up of UPGRADES) {
    if (state.score >= up.score && state.upgradeLevel === UPGRADES.indexOf(up)) {
      state.upgradeLevel += 1;
      if (up.type === "speed") state.beamSpeed *= 1.3;
      if (up.type === "reach") state.beamReach = Math.round(state.beamReach * 1.4);
      if (up.type === "width") state.beamWidth *= 1.22;
      state.upgradeFlash = 1.8;
      state.upgradeText = up.label;
      burst(lighthouse.x, lighthouse.y, "#ffd36a", 40);
      statusEl.textContent = `✦ ${up.label}`;
    }
  }

  // Spawn boats
  const stormLevel = state.weatherLevel;
  state.spawnEvery = Math.max(1100, 3200 - stormLevel * 350 - state.score * 18);
  if (state.time - state.lastSpawn > state.spawnEvery / 1000) {
    spawnBoat();
    state.lastSpawn = state.time;
  }

  // Spawn sea monsters when stormy
  if (stormLevel >= 2 && Math.random() < dt * 0.04 * (stormLevel - 1) && state.monsters.length < stormLevel) {
    spawnMonster();
  }
  // Spawn a leviathan under wild weather — only one at a time
  if (stormLevel >= 4 && Math.random() < dt * 0.008 && !state.monsters.some(m => m.big)) {
    spawnMonster(true);
  }

  // Guidance decay rate scales with weather
  const guidanceLoss = 0.55 + stormLevel * 0.18;

  for (const boat of state.boats) {
    const lit = boatInBeam(boat);
    boat.lit = Math.max(0, Math.min(1, boat.lit + (lit ? dt * 1.8 : -dt * 1.4)));
    boat.guidance = Math.max(0, Math.min(1, boat.guidance + (lit ? dt * 1.1 : -dt * guidanceLoss)));
    boat.panic = Math.max(0, Math.min(1, boat.panic + (lit ? -dt * 1.4 : dt * (0.22 + stormLevel * 0.08))));
    boat.alert = Math.max(0, boat.alert - dt);
    if (boat.panic > 0.74 && boat.alert === 0) {
      boat.alert = 1.1;
      addFloater(boat.x, boat.y - 18, "!", "#ff6a5f", 0.72);
    }

    const targetAngle = angleTo(boat, harbor);
    const currentAngle = Math.atan2(boat.vy, boat.vx);
    const steerPower = boat.guidance * boat.guidance;

    // Storm drift: random wandering direction, stronger in worse weather
    const wanderAng = boat.bob + state.time * (0.4 + stormLevel * 0.15);
    const stormPull = Math.atan2(Math.sin(wanderAng), Math.cos(wanderAng));
    const aimAngle = steerPower > 0.04 ? targetAngle : stormPull;

    // Rock avoidance when lit (guided)
    let avoidSteer = 0;
    if (steerPower > 0.1) {
      const { ax, ay } = rockAvoidance(boat);
      const avoidAngle = Math.atan2(ay, ax);
      const avoidStrength = Math.hypot(ax, ay);
      if (avoidStrength > 0.05) {
        avoidSteer = angleDelta(avoidAngle, currentAngle) * avoidStrength * 0.28 * steerPower;
      }
    }

    const steer = angleDelta(aimAngle, currentAngle) * (0.012 + steerPower * 0.12);
    const nextAngle = currentAngle + steer + avoidSteer + boat.drift * dt * (1.2 + boat.panic + stormLevel * 0.2);
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

  // Resolve boats
  for (let i = state.boats.length - 1; i >= 0; i--) {
    const boat = state.boats[i];
    const bowAngle = Math.atan2(boat.vy, boat.vx);
    const bowX = boat.x + Math.cos(bowAngle) * boat.size * 1.15;
    const bowY = boat.y + Math.sin(bowAngle) * boat.size * 1.15;
    const distToIsland = Math.hypot(bowX - harbor.x, bowY - harbor.y);
    const arrived = distToIsland < harbor.r;
    const wrecked = boatHitsRock(boat);
    const hitIsland = boatHitsIsland(boat);
    const w = canvas.clientWidth; const h = canvas.clientHeight;
    const offscreen = boat.y > h + 50 || boat.y < -50 || boat.x < -80 || boat.x > w + 80;
    // Monster attack
    const eaten = state.monsters.some(m => !monsterInBeam(m) && Math.hypot(boat.x - m.x, boat.y - m.y) < m.size * 2.5 + boat.size);
    const lost = wrecked || hitIsland || offscreen || eaten;

    if (arrived) {
      const pts = boat.value ?? 1;
      state.score += pts;
      state.streak += 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      state.charge = Math.min(100, state.charge + Math.min(18, 5 + state.streak * 2));
      state.flash = 0.35;
      state.flashColor = "#ffd36a";
      burst(boat.x, boat.y, "#ffd36a", 18 + pts * 8 + Math.min(10, state.streak * 2));
      addFloater(boat.x, boat.y - 18, state.streak > 1 ? `×${state.streak}` : `+${pts}`, "#ffd36a");
      state.boats.splice(i, 1);
      statusEl.textContent = state.streak > 2 ? `Streak ${state.streak}! Keep that beam steady.` : "Safe harbor. Another boat makes it.";
    } else if (lost) {
      state.misses += 1;
      state.streak = 0;
      state.shake = 0.32;
      state.flash = 0.42;
      state.flashColor = "#ff6a5f";
      const bx = Math.max(28, Math.min(w - 28, boat.x));
      const by = Math.max(28, Math.min(h - 28, boat.y));
      burst(bx, by, "#ff6a5f", 26);
      const reason = eaten ? "monster!" : wrecked ? "rocks!" : hitIsland ? "island!" : "lost";
      addFloater(bx, by - 20, reason, "#ff6a5f");
      state.boats.splice(i, 1);
      statusEl.textContent = eaten ? "A sea monster took a boat. Light the dark!" : wrecked ? "A boat hit the rocks. Watch the shadows." : hitIsland ? "A boat ran aground. Guide them wide." : "A boat vanished into the storm.";
    }
  }

  // Update monsters
  for (let i = state.monsters.length - 1; i >= 0; i--) {
    const m = state.monsters[i];
    const litRate = m.big ? 1.1 : 2.5;
    const litDecay = m.big ? 0.5 : 1.2;
    m.lit = monsterInBeam(m) ? Math.min(1, m.lit + dt * litRate) : Math.max(0, m.lit - dt * litDecay);
    m.visible = Math.min(1, m.visible + dt * 0.8);
    m.size = m.size ?? 14;

    const fleeForce = m.big ? 35 : 60;
    const huntForce = m.big ? 16 : 28;
    if (m.lit > 0.4) {
      // Flee from beam
      const lamp = lampPoint();
      const dx = m.x - lamp.x; const dy = m.y - lamp.y;
      const dist = Math.hypot(dx, dy);
      m.vx += (dx / dist) * dt * fleeForce;
      m.vy += (dy / dist) * dt * fleeForce;
    } else {
      // Hunt nearest unlit boat
      let target = null; let bestDist = Infinity;
      for (const boat of state.boats) {
        if (boatInBeam(boat)) continue;
        const d = Math.hypot(boat.x - m.x, boat.y - m.y);
        if (d < bestDist) { bestDist = d; target = boat; }
      }
      if (target) {
        const dx = target.x - m.x; const dy = target.y - m.y;
        const dist = Math.hypot(dx, dy);
        m.vx += (dx / dist) * dt * huntForce;
        m.vy += (dy / dist) * dt * huntForce;
      }
    }
    const drag = m.big ? 0.94 : 0.92;
    m.vx *= drag; m.vy *= drag;
    m.x += m.vx * dt; m.y += m.vy * dt;

    const w = canvas.clientWidth; const h = canvas.clientHeight;
    const banishThreshold = m.big ? 0.92 : 0.85;
    if (m.lit > banishThreshold || m.x < -80 || m.x > w + 80 || m.y < -80 || m.y > h + 80) {
      if (m.lit > banishThreshold) burst(m.x, m.y, m.big ? "#ff88ff" : "#5588ff", m.big ? 24 : 14);
      state.monsters.splice(i, 1);
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
  // Full-screen sea
  const seaGrad = ctx.createLinearGradient(0, 0, 0, h);
  seaGrad.addColorStop(0, LA.seaDeep);
  seaGrad.addColorStop(0.5, LA.seaMid);
  seaGrad.addColorStop(1, LA.seaDeep);
  ctx.fillStyle = seaGrad;
  ctx.fillRect(0, 0, w, h);

  drawWaterWaves(w, h);
  drawWaterShimmer(w, h);
  drawRockWash(w, h);

  if (texture.grain) {
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = texture.grain;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

function drawWaterWaves(w, h) {
  ctx.save();
  ctx.lineCap = "round";
  const waveLen = 26;
  const waveGap = 16;
  const period = waveLen + waveGap;
  const rows = Math.ceil(h / 22);
  for (let row = 0; row < rows; row++) {
    const y = 12 + row * 22;
    const scroll = state.time * 20 + row * 7;
    const bright = 0.5 + 0.5 * Math.sin(state.time * 1.0 + row * 0.3);
    ctx.lineWidth = 1.3 + bright * 0.5;
    ctx.globalAlpha = 0.12 + bright * 0.09;
    ctx.strokeStyle = LA.seaFoam;
    for (let xBase = -(period); xBase < w + period; xBase += period) {
      const x = xBase - (scroll % period);
      if (x + waveLen < 0 || x > w) continue;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + waveLen * 0.4, y - 5, x + waveLen, y + 1);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawWaterShimmer(w, h) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 14; i++) {
    const t = (state.time * 0.38 + i * 0.29) % 1;
    const x = (i * 137 + 42) % w;
    const y = (i * 89 + 18) % h;
    ctx.globalAlpha = (1 - t) * 0.055;
    ctx.fillStyle = LA.seaFoam;
    ctx.beginPath();
    ctx.ellipse(x, y, 16 + t * 22, 5 + t * 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawRockWash(w, h) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = LA.seaFoam;
  for (const rock of getRocks(w, h)) {
    const { x, y, rw, rh } = rock;
    const pulse = Math.sin(state.time * 2.4 + x * 0.05) * 0.5 + 0.5;
    ctx.globalAlpha = 0.28 + pulse * 0.18;
    ctx.lineWidth = 1.5 + pulse * 1.2;
    ctx.beginPath();
    ctx.ellipse(x, y, rw * (1.5 + pulse * 0.18), rh * (1.5 + pulse * 0.18), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.12 + pulse * 0.10;
    ctx.beginPath();
    ctx.ellipse(x, y, rw * (2.1 + pulse * 0.22), rh * (2.1 + pulse * 0.22), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRocks(w, h) {
  ctx.save();
  for (const rock of getRocks(w, h)) {
    const { x, y, rw, rh } = rock;
    const pts = rockPoints(rock);
    const n = pts.length;
    ctx.save();
    ctx.translate(4, 5);
    ctx.fillStyle = "rgba(0, 10, 30, 0.28)";
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < n; i++) {
      const nx = (pts[i].x + pts[(i + 1) % n].x) / 2;
      const ny = (pts[i].y + pts[(i + 1) % n].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, nx, ny);
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = LA.rock;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < n; i++) {
      const nx = (pts[i].x + pts[(i + 1) % n].x) / 2;
      const ny = (pts[i].y + pts[(i + 1) % n].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, nx, ny);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = LA.rockLight;
    ctx.beginPath();
    ctx.ellipse(x - rw * 0.22, y - rh * 0.22, rw * 0.38, rh * 0.38, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = LA.rockDark; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < n; i++) {
      const nx = (pts[i].x + pts[(i + 1) % n].x) / 2;
      const ny = (pts[i].y + pts[(i + 1) % n].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, nx, ny);
    }
    ctx.closePath(); ctx.stroke();
  }
  ctx.restore();
}

function drawMonsters() {
  ctx.save();
  for (const m of state.monsters) {
    if (m.visible < 0.05) continue;
    const inBeam = monsterInBeam(m);
    ctx.globalAlpha = m.visible * (inBeam ? 0.7 : 0.55);
    const t = state.time * 1.2 + m.phase;
    const tentacleColor = m.big
      ? (inBeam ? "rgba(120, 0, 80, 0.95)" : "rgba(5, 0, 25, 0.92)")
      : (inBeam ? "rgba(80, 30, 120, 0.9)" : "rgba(10, 10, 40, 0.85)");
    m.size = m.size ?? 14;
    const numTentacles = m.big ? 8 : 6;

    // Tentacles
    ctx.strokeStyle = tentacleColor;
    ctx.lineCap = "round";
    for (let i = 0; i < numTentacles; i++) {
      const baseAngle = (i / numTentacles) * Math.PI * 2 + t * (m.big ? 0.18 : 0.3);
      const len = m.size * (1.4 + Math.sin(t + i) * 0.4);
      const curl = Math.sin(t * 1.5 + i * 1.1) * 0.6;
      ctx.lineWidth = m.big ? 5 - i * 0.2 : 3 - i * 0.2;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      const mx1 = m.x + Math.cos(baseAngle + curl * 0.5) * len * 0.5;
      const my1 = m.y + Math.sin(baseAngle + curl * 0.5) * len * 0.5;
      const ex = m.x + Math.cos(baseAngle + curl) * len;
      const ey = m.y + Math.sin(baseAngle + curl) * len;
      ctx.quadraticCurveTo(mx1, my1, ex, ey);
      ctx.stroke();
    }
    // Body
    if (m.big) {
      ctx.fillStyle = inBeam ? "rgba(160, 0, 100, 0.85)" : "rgba(8, 0, 30, 0.92)";
    } else {
      ctx.fillStyle = inBeam ? "rgba(100, 40, 160, 0.8)" : "rgba(15, 10, 50, 0.8)";
    }
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.size * 0.75, 0, Math.PI * 2);
    ctx.fill();
    // Eyes
    if (m.big) {
      // Three eyes for the leviathan
      ctx.fillStyle = inBeam ? "rgba(255, 160, 255, 0.95)" : "rgba(255, 20, 20, 0.95)";
      for (const ex of [-m.size * 0.28, 0, m.size * 0.28]) {
        ctx.beginPath();
        ctx.arc(m.x + ex, m.y - m.size * 0.1, m.size * 0.13, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = inBeam ? "rgba(200, 100, 255, 0.9)" : "rgba(255, 40, 40, 0.85)";
      for (const ex of [-m.size * 0.22, m.size * 0.22]) {
        ctx.beginPath();
        ctx.arc(m.x + ex, m.y - m.size * 0.08, m.size * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

function drawIsland() {
  const cx = lighthouse.x;
  const cy = lighthouse.y;
  ctx.save();

  const sandR = ISLAND_R + 14;
  const STEPS = 64;

  // Build irregular coastline: layered sines give natural bumpiness
  function buildCoast(baseR, a1, a2, a3) {
    const pts = [];
    for (let i = 0; i < STEPS; i++) {
      const a = (i / STEPS) * Math.PI * 2;
      const r = baseR
        + Math.sin(a * 3 + 1.1) * a1
        + Math.sin(a * 5 + 2.3) * a2
        + Math.sin(a * 7 + 0.7) * a3;
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    return pts;
  }

  function tracePts(pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
  }

  function traceInflated(pts, amount) {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const dx = pts[i].x - cx, dy = pts[i].y - cy;
      const d = Math.hypot(dx, dy);
      const s = (d + amount) / d;
      if (i === 0) ctx.moveTo(cx + dx * s, cy + dy * s);
      else ctx.lineTo(cx + dx * s, cy + dy * s);
    }
    ctx.closePath();
  }

  function traceOffset(pts, ox, oy) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x + ox, pts[0].y + oy);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x + ox, pts[i].y + oy);
    ctx.closePath();
  }

  const sandPts = buildCoast(sandR, 6, 3.5, 2);
  const rockPts = buildCoast(ISLAND_R + 4, 4, 2, 1.5);

  // Island shadow: uniform dark halo around the irregular contour
  ctx.fillStyle = "rgba(0, 10, 40, 0.32)";
  traceInflated(sandPts, 7);
  ctx.fill();

  // Sand coast
  const sandGrad = ctx.createRadialGradient(cx, cy, ISLAND_R - 2, cx, cy, sandR + 6);
  sandGrad.addColorStop(0, LA.sandLight);
  sandGrad.addColorStop(0.55, LA.sand);
  sandGrad.addColorStop(1, LA.sandDark);
  ctx.fillStyle = sandGrad;
  ctx.strokeStyle = LA.outline;
  ctx.lineWidth = 1.5;
  tracePts(sandPts);
  ctx.fill();
  ctx.stroke();

  // Island green land
  const islandGrad = ctx.createRadialGradient(cx - 4, cy - 4, 3, cx, cy, ISLAND_R + 6);
  islandGrad.addColorStop(0, LA.landLight);
  islandGrad.addColorStop(0.5, LA.land);
  islandGrad.addColorStop(1, LA.landDark);
  ctx.fillStyle = islandGrad;
  ctx.strokeStyle = LA.outline;
  ctx.lineWidth = 2;
  tracePts(rockPts);
  ctx.fill();
  ctx.stroke();

  // Surf/foam ring traces the irregular sand edge
  ctx.strokeStyle = LA.seaFoam;
  ctx.lineWidth = 2.5;
  const surf = Math.sin(state.time * 2.2) * 0.5 + 0.5;
  ctx.globalAlpha = 0.35 + surf * 0.25;
  ctx.setLineDash([8, 6]);
  ctx.lineDashOffset = -state.time * 15;
  traceInflated(sandPts, 3);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // Small grass tufts on island
  ctx.fillStyle = LA.land;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = ISLAND_R * 0.55;
    const gx = cx + Math.cos(a) * r;
    const gy = cy + Math.sin(a) * r;
    ctx.beginPath();
    ctx.arc(gx, gy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBeam() {
  const lamp = lampPoint();
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const reach = state.beamReach + state.pulse * 110;
  const width = state.beamWidth + state.pulse * 0.35;
  const left = state.beamAngle - width;
  const right = state.beamAngle + width;
  const dir = { x: Math.cos(state.beamAngle), y: Math.sin(state.beamAngle) };
  const tangent = { x: -dir.y, y: dir.x };

  const beam = ctx.createRadialGradient(lamp.x, lamp.y, 6, lamp.x, lamp.y, reach);
  beam.addColorStop(0, `rgba(255, 230, 140, ${0.54 + state.pulse * 0.18})`);
  beam.addColorStop(0.38, "rgba(255, 218, 112, 0.20)");
  beam.addColorStop(1, "rgba(255, 218, 112, 0)");

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(lamp.x, lamp.y);
  ctx.arc(lamp.x, lamp.y, reach, left, right);
  ctx.closePath();
  ctx.fillStyle = beam;
  ctx.globalCompositeOperation = "lighter";
  ctx.fill();

  ctx.lineCap = "round";
  for (let i = 0; i < 14; i++) {
    const t = (i + 1) / 15;
    const dist = reach * (0.14 + t * 0.78);
    const cx = lamp.x + dir.x * dist + Math.sin(state.time * 1.8 + i * 1.9) * 5;
    const cy = lamp.y + dir.y * dist + Math.sin(state.time * 2.3 + i) * 2;
    const half = dist * Math.tan(width) * (0.2 + t * 0.32);
    ctx.globalAlpha = 0.09 + (1 - t) * 0.07 + state.pulse * 0.04;
    ctx.strokeStyle = "#ffe8a5";
    ctx.lineWidth = 0.9 + t * 1.1;
    ctx.beginPath();
    ctx.moveTo(cx - tangent.x * half, cy - tangent.y * half);
    ctx.quadraticCurveTo(cx, cy + Math.sin(state.time * 2.1 + i) * 3, cx + tangent.x * half, cy + tangent.y * half);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = `rgba(255, 238, 168, ${0.22 + state.pulse * 0.12})`;
  ctx.lineWidth = 1.4;
  for (const edge of [left, right]) {
    ctx.beginPath();
    ctx.moveTo(lamp.x, lamp.y);
    ctx.lineTo(lamp.x + Math.cos(edge) * reach, lamp.y + Math.sin(edge) * reach);
    ctx.stroke();
  }

  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.55 + state.pulse * 0.22;
  ctx.fillStyle = "#ffd36a";
  ctx.beginPath();
  ctx.arc(lamp.x, lamp.y, 16 + state.pulse * 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBoat(boat) {
  const a = Math.atan2(boat.vy, boat.vx);
  const s = boat.size;
  ctx.save();

  const cw = canvas.clientWidth, ch = canvas.clientHeight;
  if (boat.panic > 0.48 && boat.x >= 0 && boat.x <= cw && boat.y >= 0 && boat.y <= ch) {
    const warning = (boat.panic - 0.48) / 0.52;
    ctx.globalAlpha = (0.16 + warning * 0.38) * (0.65 + Math.sin(state.time * 8 + boat.bob) * 0.35);
    ctx.strokeStyle = "#ff3820";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(boat.x, boat.y, boat.size * (2.1 + warning * 1.6), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  for (let i = boat.wake.length - 1; i >= 0; i--) {
    const wake = boat.wake[i];
    if (wake.life <= 0) continue;
    const wa = wake.a ?? a;
    const ws = wake.size ?? s;
    const backX = Math.cos(wa + Math.PI);
    const backY = Math.sin(wa + Math.PI);
    const sideX = Math.cos(wa + Math.PI / 2);
    const sideY = Math.sin(wa + Math.PI / 2);
    const spread = ws * (0.9 + i * 0.20);
    const tail = ws * (1.5 + i * 0.26);
    ctx.globalAlpha = wake.life * 0.38;
    ctx.strokeStyle = LA.seaFoam;
    ctx.lineWidth = 1.1;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(wake.x, wake.y);
    ctx.lineTo(wake.x + backX * tail - sideX * spread, wake.y + backY * tail - sideY * spread);
    ctx.moveTo(wake.x, wake.y);
    ctx.lineTo(wake.x + backX * tail + sideX * spread, wake.y + backY * tail + sideY * spread);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = "rgba(0, 20, 60, 0.28)";
  ctx.beginPath();
  ctx.ellipse(boat.x + 3, boat.y + 4, s * 1.85, s * 0.88, a, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(boat.x, boat.y);
  ctx.rotate(a);

  const litHull = boat.lit > 0.1;
  const hullColor = boat.hullHue === "wood"
    ? (litHull ? "#d4a860" : "#8c6038")
    : (litHull ? "#cce0d8" : "#5a8898");

  ctx.fillStyle = hullColor;
  ctx.strokeStyle = LA.outline;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 1.75, s * 0.82, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = litHull ? "#e8dab0" : "#6a8090";
  ctx.beginPath();
  ctx.moveTo(s * 1.65, 0);
  ctx.lineTo(s * 0.85, -s * 0.38);
  ctx.lineTo(s * 0.85, s * 0.38);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = LA.outline; ctx.lineWidth = 1;
  ctx.stroke();

  if (boat.canopy) {
    ctx.fillStyle = litHull ? "rgba(255,222,130,0.82)" : "rgba(90,130,148,0.72)";
    ctx.beginPath();
    ctx.roundRect(-s * 0.42, -s * 0.33, s * 0.78, s * 0.66, s * 0.15);
    ctx.fill();
    ctx.strokeStyle = LA.outline; ctx.lineWidth = 1; ctx.stroke();
  }

  // Size indicator bands on hull
  const v = boat.value ?? 1;
  if (v > 1) {
    ctx.strokeStyle = v === 3 ? "#f0cc30" : "#c8e8d0";
    ctx.lineWidth = 1.5;
    for (let b = 0; b < v - 1; b++) {
      ctx.beginPath();
      ctx.ellipse(-(b * s * 0.28), 0, s * 0.3, s * 0.78, 0, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.stroke();
    }
  }

  ctx.fillStyle = boat.panic > 0.65 ? "#ff3820" : boat.guidance > 0.25 ? LA.gold : "#708898";
  ctx.beginPath();
  ctx.arc(s * 1.38, 0, s * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = LA.outline; ctx.lineWidth = 0.8; ctx.stroke();

  ctx.restore();
}

function drawVignette(w, h) {
  ctx.save();
  const vignette = ctx.createRadialGradient(w * 0.5, h * 0.5, h * 0.18, w * 0.5, h * 0.5, h * 0.78);
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(0.65, "rgba(0, 0, 0, 0.10)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.52)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawLighthouse() {
  ctx.save();
  ctx.translate(lighthouse.x, lighthouse.y);
  const r = lighthouse.r;


  ctx.fillStyle = "#c0b090";
  ctx.strokeStyle = LA.outline; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r + 5, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();

  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 === 0 ? LA.red : LA.white;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, (i / 8) * Math.PI * 2, ((i + 1) / 8) * Math.PI * 2);
    ctx.closePath();
    ctx.fill();
  }

  ctx.strokeStyle = LA.outline; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 0.3; ctx.lineWidth = 0.7;
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const lampY = LAMP_OFFSET_Y;
  ctx.globalCompositeOperation = "lighter";
  const lanternGlow = ctx.createRadialGradient(0, lampY, 2, 0, lampY, 24 + state.pulse * 12);
  lanternGlow.addColorStop(0, `rgba(255, 220, 128, ${0.52 + state.pulse * 0.22})`);
  lanternGlow.addColorStop(0.4, "rgba(255, 220, 128, 0.14)");
  lanternGlow.addColorStop(1, "rgba(255, 220, 128, 0)");
  ctx.fillStyle = lanternGlow;
  ctx.beginPath(); ctx.arc(0, lampY, 24 + state.pulse * 12, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  ctx.fillStyle = "#ffd36a";
  ctx.beginPath(); ctx.arc(0, lampY, 6 + state.pulse * 3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(255, 238, 168, 0.65)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, lampY, 10 + state.pulse * 5, 0, Math.PI * 2); ctx.stroke();

  // Upgrade level pips
  if (state.upgradeLevel > 0) {
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = LA.gold;
    for (let u = 0; u < state.upgradeLevel; u++) {
      const ua = (u / 3) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.arc(Math.cos(ua) * (r + 10), Math.sin(ua) * (r + 10), 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawHarbor() {
  ctx.save();
  const harborGlow = ctx.createRadialGradient(harbor.x, harbor.y, 10, harbor.x, harbor.y, harbor.r * 1.8);
  harborGlow.addColorStop(0, "rgba(240, 200, 60, 0.18)");
  harborGlow.addColorStop(0.6, "rgba(240, 200, 60, 0.07)");
  harborGlow.addColorStop(1, "rgba(240, 200, 60, 0)");
  ctx.fillStyle = harborGlow;
  ctx.beginPath();
  ctx.arc(harbor.x, harbor.y, harbor.r * 1.8, 0, Math.PI * 2);
  ctx.fill();

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
  drawMonsters();
  drawRocks(w, h);
  drawHarbor();
  drawIsland();
  for (const boat of state.boats) drawBoat(boat);
  drawLighthouse();
  drawBeam();

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
