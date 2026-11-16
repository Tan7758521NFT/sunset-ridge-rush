// track.js — the Sunset Ridge circuit.
// Geometry only: segments, curves, hills and roadside scenery placement.
// Original code, written for this game.

export const SEG_LEN = 200;
export const ROAD_WIDTH = 2200;
export const RUMBLE_LEN = 3;
export const DRAW_DISTANCE = 200;
export const FOG_DENSITY = 6;
export const CAMERA_HEIGHT = 1100;
export const CAMERA_DEPTH = 0.84;

function easeInOut(t) {
  return t * t * (3 - 2 * t);
}

// A ridge silhouette for the background, precomputed once per layer.
export function makeRidge(seed, points, baseY, amp) {
  let s = seed;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const out = [];
  for (let i = 0; i <= points; i++) {
    const t = i / points;
    const y = baseY - (rand() * amp + Math.sin(t * Math.PI * 3 + seed) * amp * 0.35);
    out.push({ x: t, y });
  }
  return out;
}

export function buildTrack() {
  const segments = [];

  function addSegment(curve, y) {
    const n = segments.length;
    const prevY = n === 0 ? 0 : segments[n - 1].p2.world.y;
    segments.push({
      index: n,
      curve,
      p1: { world: { x: 0, y: prevY, z: n * SEG_LEN }, camera: {}, screen: {} },
      p2: { world: { x: 0, y, z: (n + 1) * SEG_LEN }, camera: {}, screen: {} },
      sprites: [],
      cars: [],
      band: Math.floor(n / RUMBLE_LEN) % 2 === 0 ? 0 : 1,
      fog: 0,
      clip: 0,
      looped: false,
    });
  }

  // length in segments, curve in bend units, yFrom/yTo in world height units.
  function addSection(length, curve, yFrom, yTo) {
    for (let i = 0; i < length; i++) {
      const t = (i + 1) / length;
      addSegment(curve, yFrom + (yTo - yFrom) * easeInOut(t));
    }
  }

  // The lap: start straight, climb, sweeper down, S-curves, big climb,
  // downhill, hairpin, final straight. 595 segments, ~119,000 units.
  addSection(40, 0, 0, 0); // start straight
  addSection(70, 2, 0, 1200); // right climb
  addSection(30, 0, 1200, 1200); // ridge straight
  addSection(80, -3, 1200, 400); // long left sweeper down
  addSection(35, 3, 400, 600); // S right
  addSection(35, -3, 600, 500); // S left
  addSection(35, 3, 500, 800); // S right
  addSection(30, 0, 800, 800); // breather
  addSection(60, 1, 800, 2000); // big climb
  addSection(60, -1, 2000, 0); // downhill
  addSection(80, 5, 0, 0); // hairpin
  addSection(40, 0, 0, 0); // final straight

  const total = segments.length;

  // Roadside scenery. offset is in road-width units from the road centre:
  // |offset| > 1 sits off the asphalt.
  const scenery = [
    { kind: 'cactus', gap: 7 },
    { kind: 'rock', gap: 9 },
    { kind: 'palm', gap: 13 },
    { kind: 'billboard', gap: 47 },
  ];
  const billboards = ['SUNSET RIDGE', 'NITRO COLA', 'TURBO TIRES', 'RIDGE RUN', 'DUSK FUEL'];
  let board = 0;
  for (let n = 6; n < total - 4; n++) {
    for (const s of scenery) {
      if (n % s.gap !== 0) continue;
      const side = n % 2 === 0 ? -1 : 1;
      const spread = 1.5 + ((n * 7) % 10) / 12;
      const kind = s.kind === 'billboard'
        ? { kind: 'billboard', text: billboards[board++ % billboards.length] }
        : { kind: s.kind };
      segments[n].sprites.push({ ...kind, offset: side * spread });
    }
  }
  // Start gantry and chequered flags at the start/finish line.
  segments[2].sprites.push({ kind: 'gantry', offset: 0 });
  segments[2].sprites.push({ kind: 'flag', offset: -1.6 });
  segments[2].sprites.push({ kind: 'flag', offset: 1.6 });
  // Flags marking the hairpin entry.
  segments[475].sprites.push({ kind: 'flag', offset: -1.7 });
  segments[475].sprites.push({ kind: 'flag', offset: 1.7 });

  return { segments, length: total * SEG_LEN, total };
}

export function segmentAt(track, z) {
  const n = Math.floor(z / SEG_LEN) % track.segments.length;
  return track.segments[(n + track.segments.length) % track.segments.length];
}

export function segmentPercent(z) {
  return (z % SEG_LEN) / SEG_LEN;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}
