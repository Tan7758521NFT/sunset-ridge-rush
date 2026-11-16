// render.js — the pseudo-3D road renderer.
// Projects track segments onto the canvas, draws sky, ridge, road, sprites
// and cars back to front, then the player's car. Original implementation.

import { SEG_LEN, ROAD_WIDTH, DRAW_DISTANCE, FOG_DENSITY, CAMERA_DEPTH, CAMERA_HEIGHT } from './track.js';

const FOG_COLOR = [176, 92, 120];

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function css(rgb) {
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

const PALETTE = {
  skyTop: '#241040',
  skyMid: '#7b2d8b',
  skyLow: '#ff7e5f',
  horizon: '#feb47b',
  sun: '#ffd76a',
  ridgeFar: '#5b2a63',
  ridgeNear: '#3c1c46',
  ground: ['#4a2b3d', '#43304a'],
  road: ['#3d3a4a', '#38354a'],
  rumble: ['#ff8c42', '#f5f0e6'],
  lane: '#ffe9a8',
  fog: FOG_COLOR,
};

function fogFactor(n) {
  const t = n / DRAW_DISTANCE;
  return 1 - Math.exp(-FOG_DENSITY * t * t);
}

function project(p, camX, camY, camZ, width, height) {
  p.camera.x = p.world.x - camX;
  p.camera.y = p.world.y - camY;
  p.camera.z = p.world.z - camZ;
  p.screen.scale = CAMERA_DEPTH / Math.max(1, p.camera.z);
  p.screen.x = Math.round(width / 2 + p.screen.scale * p.camera.x * (width / 2));
  p.screen.y = Math.round(height / 2 - p.screen.scale * p.camera.y * (height / 2));
  p.screen.w = Math.max(0, Math.round(p.screen.scale * ROAD_WIDTH * (width / 2)));
}

function polygon(ctx, x1, y1, x2, y2, x3, y3, x4, y4, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.lineTo(x4, y4);
  ctx.closePath();
  ctx.fill();
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;
    this.ridges = null;
  }

  setRidges(far, near) {
    this.ridges = { far, near };
  }

  drawSky(timeSec) {
    const { ctx, width, height } = this;
    const g = ctx.createLinearGradient(0, 0, 0, height * 0.62);
    g.addColorStop(0, PALETTE.skyTop);
    g.addColorStop(0.55, PALETTE.skyMid);
    g.addColorStop(0.85, PALETTE.skyLow);
    g.addColorStop(1, PALETTE.horizon);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height * 0.62 + 2);

    // low sun with a slow pulse
    const sunX = width * 0.68;
    const sunY = height * 0.47;
    const sunR = height * 0.085 * (1 + 0.02 * Math.sin(timeSec * 0.7));
    const glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.2, sunX, sunY, sunR * 3.2);
    glow.addColorStop(0, 'rgba(255, 214, 106, 0.55)');
    glow.addColorStop(1, 'rgba(255, 214, 106, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - sunR * 3.2, sunY - sunR * 3.2, sunR * 6.4, sunR * 6.4);
    ctx.fillStyle = PALETTE.sun;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fill();

    // mountain ridges
    if (this.ridges) {
      this.drawRidge(this.ridges.far, height * 0.47, PALETTE.ridgeFar);
      this.drawRidge(this.ridges.near, height * 0.55, PALETTE.ridgeNear);
    }
  }

  drawRidge(points, baseY, color) {
    const { ctx, width, height } = this;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.62);
    for (const p of points) {
      ctx.lineTo(p.x * width, baseY - p.y * height * 0.12);
    }
    ctx.lineTo(width, height * 0.62);
    ctx.closePath();
    ctx.fill();
  }

  // Draw one road segment (ground band + asphalt + rumble + lane line).
  drawSegment(x1, y1, w1, x2, y2, w2, band, fog) {
    const { ctx, width } = this;
    const ground = mix(
      band === 0 ? [74, 43, 61] : [67, 48, 74],
      PALETTE.fog, fog,
    );
    ctx.fillStyle = css(ground);
    ctx.fillRect(0, y2, width, y1 - y2);

    const r1 = w1 / 5.4;
    const r2 = w2 / 5.4;
    const l1 = w1 / 40;
    const l2 = w2 / 40;

    const road = mix(band === 0 ? [61, 58, 74] : [56, 53, 74], PALETTE.fog, fog);
    const rumble = mix(band === 0 ? [255, 140, 66] : [245, 240, 230], PALETTE.fog, fog);
    const lane = mix([255, 233, 168], PALETTE.fog, fog);

    polygon(ctx, x1 - w1 - r1, y1, x1 - w1, y1, x2 - w2, y2, x2 - w2 - r2, y2, css(rumble));
    polygon(ctx, x1 + w1 + r1, y1, x1 + w1, y1, x2 + w2, y2, x2 + w2 + r2, y2, css(rumble));
    polygon(ctx, x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2, css(road));
    if (band === 0) {
      polygon(ctx, x1 - l1, y1, x1 + l1, y1, x2 + l2, y2, x2 - l2, y2, css(lane));
    }
  }

  drawSprite(sprite, destX, destY, destW, fog, alpha = 1) {
    const { ctx } = this;
    const destH = (destW * sprite.height) / sprite.width;
    ctx.globalAlpha = alpha * (1 - fog * 0.85);
    ctx.drawImage(sprite.image, destX - destW / 2, destY - destH, destW, destH);
    ctx.globalAlpha = 1;
  }

  drawPlayerCar(sprite, steer, boosting, speedPercent, timeSec) {
    const { ctx, width, height } = this;
    const w = width * 0.30;
    const h = (w * sprite.height) / sprite.width;
    const x = width / 2 + steer * width * 0.045;
    const y = height - 6;
    const bounce = Math.sin(timeSec * 31) * speedPercent * 1.6;
    ctx.save();
    ctx.translate(x, y + bounce);
    ctx.rotate(steer * 0.045);
    ctx.drawImage(sprite.image, -w / 2, -h, w, h);
    ctx.restore();
    if (boosting) {
      // nitro flame
      const flick = 0.7 + 0.3 * Math.sin(timeSec * 47);
      ctx.save();
      ctx.globalAlpha = 0.85 * flick;
      ctx.fillStyle = '#ff9a3d';
      ctx.beginPath();
      ctx.moveTo(x - 26, y - 4);
      ctx.lineTo(x, y + 34 * flick);
      ctx.lineTo(x + 26, y - 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.moveTo(x - 12, y - 4);
      ctx.lineTo(x, y + 20 * flick);
      ctx.lineTo(x + 12, y - 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // speed streaks at the edges
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const sx = (i % 2 === 0 ? 20 : width - 20) + ((i * 53) % 40) - 20;
        const sy = height * 0.25 + ((i * 137 + timeSec * 900) % (height * 0.6));
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx, sy + 46);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // Full frame. state carries everything the scene needs.
  render(state) {
    const { ctx, width, height } = this;
    const { track, position, playerX, playerY, cars, playerSprite, steer, boosting, speedPercent, timeSec } = state;
    this.drawSky(timeSec);

    const baseSegment = track.segments[Math.floor(position / SEG_LEN) % track.segments.length];
    const basePercent = (position % SEG_LEN) / SEG_LEN;
    let maxY = height;
    let x = 0;
    let dx = -(baseSegment.curve * basePercent);

    for (let n = 0; n < DRAW_DISTANCE; n++) {
      const segment = track.segments[(baseSegment.index + n) % track.segments.length];
      segment.looped = segment.index < baseSegment.index;
      segment.fog = fogFactor(n);
      segment.clip = maxY;
      const zOff = segment.looped ? track.length : 0;
      project(segment.p1, playerX * ROAD_WIDTH - x, playerY + CAMERA_HEIGHT, position - zOff, width, height);
      project(segment.p2, playerX * ROAD_WIDTH - x - dx, playerY + CAMERA_HEIGHT, position - zOff, width, height);
      x += dx;
      dx += segment.curve;
      if (
        segment.p1.camera.z <= CAMERA_DEPTH ||
        segment.p2.screen.y >= segment.p1.screen.y ||
        segment.p2.screen.y >= maxY
      ) {
        continue;
      }
      this.drawSegment(
        segment.p1.screen.x, segment.p1.screen.y, segment.p1.screen.w,
        segment.p2.screen.x, segment.p2.screen.y, segment.p2.screen.w,
        segment.band, segment.fog,
      );
      maxY = segment.p1.screen.y;
    }

    // Sprites and cars, far to near; the player's car draws last, on top.
    for (let n = DRAW_DISTANCE - 1; n >= 0; n--) {
      const segment = track.segments[(baseSegment.index + n) % track.segments.length];
      for (const spr of segment.sprites) {
        if (segment.p1.screen.y > segment.clip) continue;
        const scale = segment.p1.screen.scale;
        const destW = scale * spr.sprite.worldWidth * (width / 2);
        const destX = segment.p1.screen.x + scale * spr.offset * ROAD_WIDTH * (width / 2);
        this.drawSprite(spr.sprite, destX, segment.p1.screen.y, destW, segment.fog);
      }
      for (const car of segment.cars) {
        if (segment.p1.screen.y > segment.clip) continue;
        const scale = segment.p1.screen.scale;
        const destW = scale * car.sprite.worldWidth * (width / 2);
        const destX = segment.p1.screen.x + scale * car.offset * ROAD_WIDTH * (width / 2);
        this.drawSprite(car.sprite, destX, segment.p1.screen.y, destW, segment.fog);
      }
    }
    this.drawPlayerCar(playerSprite, steer, boosting, speedPercent, timeSec);
  }
}
