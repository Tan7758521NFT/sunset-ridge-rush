// sprites.js — every picture in the game is drawn here, on offscreen canvases.
// No image files, no external art: vector shapes only.

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// A race car seen from behind, slightly from above. color is the livery.
export function carSprite(color, opts = {}) {
  const w = 200;
  const h = 130;
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const stripe = opts.stripe || '#ffffff';
  const number = opts.number || '';

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(w / 2, h - 12, 92, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // wheels
  ctx.fillStyle = '#14141c';
  roundRect(ctx, 12, 78, 26, 40, 6); ctx.fill();
  roundRect(ctx, 162, 78, 26, 40, 6); ctx.fill();

  // body
  const bodyGrad = ctx.createLinearGradient(0, 30, 0, 118);
  bodyGrad.addColorStop(0, shade(color, 40));
  bodyGrad.addColorStop(0.55, color);
  bodyGrad.addColorStop(1, shade(color, -45));
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(28, 118);
  ctx.lineTo(26, 72);
  ctx.quadraticCurveTo(28, 52, 52, 48);
  ctx.lineTo(148, 48);
  ctx.quadraticCurveTo(172, 52, 174, 72);
  ctx.lineTo(172, 118);
  ctx.closePath();
  ctx.fill();

  // centre stripe
  ctx.fillStyle = stripe;
  ctx.fillRect(88, 48, 24, 70);

  // rear window / cabin
  ctx.fillStyle = '#1b2b3a';
  ctx.beginPath();
  ctx.moveTo(62, 50);
  ctx.lineTo(70, 22);
  ctx.lineTo(130, 22);
  ctx.lineTo(138, 50);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(160,210,235,0.55)';
  ctx.beginPath();
  ctx.moveTo(70, 46);
  ctx.lineTo(76, 26);
  ctx.lineTo(124, 26);
  ctx.lineTo(130, 46);
  ctx.closePath();
  ctx.fill();

  // spoiler
  ctx.fillStyle = shade(color, -60);
  roundRect(ctx, 14, 26, 172, 12, 5); ctx.fill();
  ctx.fillStyle = shade(color, -30);
  ctx.fillRect(24, 38, 10, 12);
  ctx.fillRect(166, 38, 10, 12);

  // tail lights
  ctx.fillStyle = '#ff2e2e';
  roundRect(ctx, 30, 84, 34, 12, 5); ctx.fill();
  roundRect(ctx, 136, 84, 34, 12, 5); ctx.fill();
  ctx.fillStyle = 'rgba(255,120,120,0.9)';
  roundRect(ctx, 33, 87, 28, 6, 3); ctx.fill();
  roundRect(ctx, 139, 87, 28, 6, 3); ctx.fill();

  // exhausts
  ctx.fillStyle = '#888';
  ctx.beginPath(); ctx.arc(82, 116, 5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(118, 116, 5, 0, Math.PI * 2); ctx.fill();

  // number roundel
  if (number) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(100, 66, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(number, 100, 67);
  }

  return { image: c, width: w, height: h, worldWidth: 980 };
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return `rgb(${r},${g},${b})`;
}

// Roadside props. Each returns { image, width, height, worldWidth }.
export function propSprite(kind, text = '') {
  if (kind === 'cactus') {
    const c = canvas(90, 170);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#2f7d4f';
    roundRect(ctx, 34, 20, 22, 140, 10); ctx.fill();
    roundRect(ctx, 8, 60, 20, 46, 9); ctx.fill();
    roundRect(ctx, 8, 60, 40, 16, 8); ctx.fill();
    roundRect(ctx, 64, 40, 20, 46, 9); ctx.fill();
    roundRect(ctx, 52, 40, 34, 16, 8); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(40, 26, 5, 128);
    return { image: c, width: 90, height: 170, worldWidth: 900 };
  }
  if (kind === 'rock') {
    const c = canvas(140, 80);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#6b5560';
    ctx.beginPath();
    ctx.moveTo(6, 76); ctx.lineTo(34, 22); ctx.lineTo(78, 8);
    ctx.lineTo(120, 30); ctx.lineTo(136, 76); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath();
    ctx.moveTo(34, 22); ctx.lineTo(78, 8); ctx.lineTo(96, 34); ctx.lineTo(58, 44);
    ctx.closePath(); ctx.fill();
    return { image: c, width: 140, height: 80, worldWidth: 1300 };
  }
  if (kind === 'palm') {
    const c = canvas(160, 200);
    const ctx = c.getContext('2d');
    ctx.strokeStyle = '#7a5230';
    ctx.lineWidth = 12;
    ctx.beginPath(); ctx.moveTo(80, 196); ctx.quadraticCurveTo(74, 110, 88, 52); ctx.stroke();
    ctx.fillStyle = '#2e8b57';
    for (let i = 0; i < 7; i++) {
      const a = (-Math.PI * 0.15) - (i * Math.PI * 0.28);
      ctx.beginPath();
      ctx.moveTo(88, 52);
      ctx.quadraticCurveTo(88 + Math.cos(a) * 55, 52 + Math.sin(a) * 40 - 18, 88 + Math.cos(a) * 78, 52 + Math.sin(a) * 62 + 26);
      ctx.quadraticCurveTo(88 + Math.cos(a) * 40, 52 + Math.sin(a) * 30 + 6, 88, 52);
      ctx.fill();
    }
    ctx.fillStyle = '#8a5a2b';
    ctx.beginPath(); ctx.arc(82, 56, 7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(96, 58, 7, 0, Math.PI * 2); ctx.fill();
    return { image: c, width: 160, height: 200, worldWidth: 1400 };
  }
  if (kind === 'flag') {
    const c = canvas(70, 190);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#d8d8d8';
    ctx.fillRect(30, 8, 6, 178);
    for (let r = 0; r < 3; r++) {
      for (let col = 0; col < 2; col++) {
        ctx.fillStyle = (r + col) % 2 === 0 ? '#111' : '#fff';
        ctx.fillRect(36 + col * 16, 12 + r * 16, 16, 16);
      }
    }
    return { image: c, width: 70, height: 190, worldWidth: 700 };
  }
  if (kind === 'billboard') {
    const c = canvas(340, 190);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#3a2b3f';
    ctx.fillRect(150, 120, 14, 66);
    ctx.fillRect(176, 120, 14, 66);
    const g = ctx.createLinearGradient(0, 10, 0, 120);
    g.addColorStop(0, '#ff9a3d');
    g.addColorStop(1, '#e2483d');
    ctx.fillStyle = g;
    roundRect(ctx, 8, 10, 324, 112, 10); ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 5;
    roundRect(ctx, 8, 10, 324, 112, 10); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = (text || 'SUNSET RIDGE').slice(0, 14);
    ctx.fillText(label, 170, 66);
    return { image: c, width: 340, height: 190, worldWidth: 2600 };
  }
  if (kind === 'gantry') {
    const c = canvas(900, 190);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#2c2c38';
    ctx.fillRect(20, 0, 26, 190);
    ctx.fillRect(854, 0, 26, 190);
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(46, 0, 808, 64);
    for (let r = 0; r < 2; r++) {
      for (let col = 0; col < 25; col++) {
        ctx.fillStyle = (r + col) % 2 === 0 ? '#111' : '#fff';
        ctx.fillRect(46 + col * 32.3, 64 + r * 16, 32.3, 16);
      }
    }
    ctx.fillStyle = '#111';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('START', 450, 33);
    return { image: c, width: 900, height: 190, worldWidth: 5200 };
  }
  return null;
}
