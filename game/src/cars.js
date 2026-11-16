// cars.js — the other cars on the road: AI rivals and slower traffic.
// Each car lives on a segment; the renderer draws them from segment.cars.

import { SEG_LEN, segmentAt } from './track.js';
import { carSprite } from './sprites.js';

export const MAX_SPEED = SEG_LEN * 60;
const CAR_LENGTH = SEG_LEN * 0.9;

const RIVALS = [
  { name: 'VEX', color: '#2e6bff', number: '7', skill: 0.86 },
  { name: 'NOVA', color: '#22b573', number: '12', skill: 0.82 },
  { name: 'EMBER', color: '#ffd23d', number: '21', skill: 0.79 },
  { name: 'ORBIT', color: '#9b59d0', number: '33', skill: 0.76 },
  { name: 'FLINT', color: '#14b8c4', number: '5', skill: 0.72 },
];

const TRAFFIC_COLORS = ['#8a8f98', '#b0a89a', '#5f6b7a', '#9a7b4f'];

export function makeRacers(track) {
  const racers = RIVALS.map((r, i) => ({
    kind: 'rival',
    name: r.name,
    sprite: carSprite(r.color, { number: r.number }),
    z: (i + 1) * SEG_LEN * 6,
    offset: [-0.5, 0.4, -0.2, 0.55, -0.6][i],
    speed: 0,
    topSpeed: MAX_SPEED * r.skill,
    lap: 0,
    progress: 0,
    wobble: Math.random() * Math.PI * 2,
  }));
  const traffic = [];
  for (let i = 0; i < 7; i++) {
    traffic.push({
      kind: 'traffic',
      sprite: carSprite(TRAFFIC_COLORS[i % TRAFFIC_COLORS.length], {}),
      z: 8000 + i * 11000 + ((i * 3700) % 5000),
      offset: [-0.55, 0.5, -0.15, 0.6, 0.1, -0.45, 0.35][i],
      speed: MAX_SPEED * (0.3 + (i % 4) * 0.045),
      topSpeed: MAX_SPEED * (0.3 + (i % 4) * 0.045),
      lap: 0,
      progress: 0,
    });
  }
  return { racers, traffic };
}

// Move every car one step. player is the shared player state (read-only here
// except for the bump flag the caller applies). Returns events for the game.
export function updateCars(dt, track, racers, traffic, player) {
  const events = [];
  const all = [...racers, ...traffic];

  // clear segment membership, then re-place cars
  for (const seg of track.segments) seg.cars.length = 0;

  for (const car of all) {
    if (car.kind === 'rival') {
      // chase a racing line that follows the road bend, ease off in traffic
      const seg = segmentAt(track, car.z + SEG_LEN * 4);
      let target = -seg.curve * 0.22;
      target = Math.max(-0.65, Math.min(0.65, target));
      const ahead = carAhead(track, car, 4);
      if (ahead && Math.abs(ahead.offset - car.offset) < 0.4) {
        target = ahead.offset > 0 ? ahead.offset - 0.55 : ahead.offset + 0.55;
        target = Math.max(-0.7, Math.min(0.7, target));
      }
      car.offset += (target - car.offset) * Math.min(1, dt * 1.4);
      // gentle rubber-banding: keep the pack in touch with the player
      const gap = player.progress - car.progress;
      const band = gap > 9000 ? 1.06 : gap < -9000 ? 0.94 : 1;
      const want = car.topSpeed * band;
      car.speed += (want - car.speed) * Math.min(1, dt * 0.8);
      // wobble so rivals do not look glued to a rail
      car.offset += Math.sin(player.timeSec * 0.9 + car.wobble) * 0.02 * dt;
    }
    car.z += car.speed * dt;
    if (car.z >= track.length) {
      car.z -= track.length;
      car.lap += 1;
    }
    car.progress = car.lap * track.length + car.z;
    segmentAt(track, car.z).cars.push(car);
  }

  // player vs car contact: same neighbourhood, overlapping lane
  for (const car of all) {
    const dz = Math.abs(car.z - player.position);
    const near = dz < CAR_LENGTH || dz > track.length - CAR_LENGTH;
    if (near && Math.abs(car.offset - player.playerX) < 0.42) {
      if (player.invuln <= 0) {
        events.push({ type: 'bump', car });
        player.invuln = 0.9;
      }
    }
  }
  return events;
}

function carAhead(track, car, segmentsAhead) {
  let best = null;
  let bestDz = Infinity;
  for (let n = 1; n <= segmentsAhead; n++) {
    const seg = track.segments[(Math.floor(car.z / SEG_LEN) + n) % track.segments.length];
    for (const other of seg.cars) {
      if (other === car) continue;
      const dz = (other.z - car.z + track.length) % track.length;
      if (dz < bestDz) {
        bestDz = dz;
        best = other;
      }
    }
  }
  return best;
}

// Rank by total progress: 1 is first.
export function rankOf(playerProgress, racers) {
  let rank = 1;
  for (const r of racers) {
    if (r.progress > playerProgress) rank++;
  }
  return rank;
}
