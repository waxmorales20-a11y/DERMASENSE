/**
 * Pintado procedural de la piel del abdomen.
 *
 * Todo se dibuja por código sobre un canvas: tono base con moteado, poros, vello
 * fino, venas subcutáneas y el eritema de la reacción. Es determinista (PRNG con
 * semilla fija), así que la piel se ve idéntica en cada render y en cada equipo.
 */

/** PRNG determinista: misma semilla, misma piel siempre. */
export function makeRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SkinPaintOptions {
  width: number;
  height: number;
  /** Coordenadas UV (0..1) del punto de aplicación. */
  patchU: number;
  patchV: number;
  /** 0 = sin reacción, 1 = reacción máxima. */
  erythema: number;
  severe: boolean;
  /** Radio de la roncha en píxeles de textura. */
  rashRadius: number;
}

/** Capa base: tono, moteado subcutáneo, poros, vello y venas. Se pinta una vez. */
export function paintSkinBase(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const rand = makeRandom(20260905);

  // Tono base con caída hacia los flancos, como piel iluminada de frente.
  const base = ctx.createRadialGradient(
    width * 0.5,
    height * 0.48,
    width * 0.05,
    width * 0.5,
    height * 0.5,
    width * 0.72
  );
  base.addColorStop(0.0, '#E3B695');
  base.addColorStop(0.45, '#D2A183');
  base.addColorStop(0.78, '#B98A6C');
  base.addColorStop(1.0, '#95664B');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  // Moteado dérmico: manchas amplias y suaves que rompen el tono plano.
  ctx.save();
  for (let i = 0; i < 260; i++) {
    const x = rand() * width;
    const y = rand() * height;
    const r = 40 + rand() * 150;
    const warm = rand() > 0.5;
    const blob = ctx.createRadialGradient(x, y, 0, x, y, r);
    blob.addColorStop(0, warm ? 'rgba(214, 150, 118, 0.10)' : 'rgba(150, 100, 80, 0.09)');
    blob.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = blob;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Venas subcutáneas: troncos azulados que se ramifican bajo la dermis.
  drawVeins(ctx, width, height, rand);

  // Retícula cutánea: los surcos finos que forman los rombos de la piel.
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = '#6E4632';
  ctx.lineWidth = 1;
  for (let i = 0; i < 420; i++) {
    const x = rand() * width;
    const y = rand() * height;
    const len = 8 + rand() * 22;
    const angle = rand() > 0.5 ? Math.PI / 4 : -Math.PI / 4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }
  ctx.restore();

  // Poros.
  ctx.save();
  for (let i = 0; i < 9000; i++) {
    const x = rand() * width;
    const y = rand() * height;
    const r = 0.6 + rand() * 1.7;
    ctx.globalAlpha = 0.05 + rand() * 0.08;
    ctx.fillStyle = rand() > 0.35 ? '#8A5A41' : '#F3CDB0';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Vello fino: trazos cortos y curvos, orientados hacia abajo.
  ctx.save();
  ctx.strokeStyle = '#5A3A28';
  ctx.lineCap = 'round';
  for (let i = 0; i < 900; i++) {
    const x = rand() * width;
    const y = rand() * height;
    const len = 5 + rand() * 14;
    const drift = (rand() - 0.5) * 8;
    ctx.globalAlpha = 0.05 + rand() * 0.1;
    ctx.lineWidth = 0.6 + rand() * 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + drift * 0.5, y + len * 0.5, x + drift, y + len);
    ctx.stroke();
  }
  ctx.restore();

  // Pecas y pequeñas imperfecciones.
  ctx.save();
  for (let i = 0; i < 140; i++) {
    const x = rand() * width;
    const y = rand() * height;
    const r = 1.5 + rand() * 4;
    ctx.globalAlpha = 0.08 + rand() * 0.14;
    ctx.fillStyle = '#7A4A32';
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.7 + rand() * 0.6), rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Árbol venoso: un tronco por rama, con bifurcaciones que se afinan. */
function drawVeins(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  rand: () => number
): void {
  const drawBranch = (
    x: number,
    y: number,
    angle: number,
    length: number,
    thickness: number,
    depth: number
  ) => {
    if (depth > 4 || thickness < 0.5) return;

    const endX = x + Math.cos(angle) * length;
    const endY = y + Math.sin(angle) * length;
    const ctrlX = x + Math.cos(angle + 0.4) * length * 0.55;
    const ctrlY = y + Math.sin(angle + 0.4) * length * 0.55;

    ctx.save();
    // Las venas se ven a través de la dermis: azul apagado y muy translúcido.
    ctx.globalAlpha = 0.1 + (5 - depth) * 0.022;
    ctx.strokeStyle = depth < 2 ? '#3F5F86' : '#4E6E93';
    ctx.lineWidth = thickness;
    ctx.lineCap = 'round';
    ctx.filter = 'blur(1.6px)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
    ctx.stroke();
    ctx.restore();

    const branches = depth < 2 ? 2 : rand() > 0.4 ? 2 : 1;
    for (let i = 0; i < branches; i++) {
      drawBranch(
        endX,
        endY,
        angle + (rand() - 0.5) * 1.1,
        length * (0.6 + rand() * 0.25),
        thickness * 0.62,
        depth + 1
      );
    }
  };

  for (let i = 0; i < 7; i++) {
    const startX = width * (0.1 + rand() * 0.8);
    const startY = height * (0.05 + rand() * 0.2);
    drawBranch(startX, startY, Math.PI / 2 + (rand() - 0.5) * 0.9, 90 + rand() * 70, 7, 0);
  }
}

/** Relieve: mapa de altura en escala de grises con poros y retícula cutánea. */
export function paintSkinBump(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  const rand = makeRandom(77712);

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, width, height);

  // Poros hundidos.
  for (let i = 0; i < 9000; i++) {
    const x = rand() * width;
    const y = rand() * height;
    const r = 0.8 + rand() * 2.0;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(40,40,40,0.55)');
    g.addColorStop(1, 'rgba(128,128,128,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Surcos de la retícula.
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = '#4A4A4A';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 900; i++) {
    const x = rand() * width;
    const y = rand() * height;
    const len = 10 + rand() * 26;
    const angle = rand() > 0.5 ? Math.PI / 4 : -Math.PI / 4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Convierte el mapa de alturas en un mapa de normales real (RGB), que es lo que
 * espera el material PBR. Sin esta conversión el relieve no se ilumina bien.
 */
export function heightToNormalMap(
  source: CanvasRenderingContext2D,
  target: CanvasRenderingContext2D,
  size: number,
  strength = 2.2
): void {
  const src = source.getImageData(0, 0, size, size);
  const out = target.createImageData(size, size);

  const heightAt = (x: number, y: number): number => {
    const cx = x < 0 ? 0 : x >= size ? size - 1 : x;
    const cy = y < 0 ? 0 : y >= size ? size - 1 : y;
    return src.data[(cy * size + cx) * 4] / 255;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (heightAt(x - 1, y) - heightAt(x + 1, y)) * strength;
      const dy = (heightAt(x, y - 1) - heightAt(x, y + 1)) * strength;
      const length = Math.hypot(dx, dy, 1);

      const idx = (y * size + x) * 4;
      out.data[idx] = ((dx / length) * 0.5 + 0.5) * 255;
      out.data[idx + 1] = ((dy / length) * 0.5 + 0.5) * 255;
      out.data[idx + 2] = (1 / length) * 255;
      out.data[idx + 3] = 255;
    }
  }

  target.putImageData(out, 0, 0);
}

/** Capa reactiva: eritema y marca del parche, se repinta en cada frame de tiempo. */
export function paintReaction(ctx: CanvasRenderingContext2D, opts: SkinPaintOptions): void {
  const { width, height, patchU, patchV, erythema, severe, rashRadius } = opts;
  const x = width * patchU;
  const y = height * (1 - patchV);

  if (erythema > 0 && rashRadius > 1) {
    ctx.save();
    const rash = ctx.createRadialGradient(x, y, 4, x, y, rashRadius);
    const alpha = 0.55 + erythema * 0.4;

    if (severe) {
      rash.addColorStop(0.0, `rgba(150, 20, 20, ${alpha})`);
      rash.addColorStop(0.35, `rgba(200, 34, 34, ${alpha * 0.85})`);
      rash.addColorStop(0.68, `rgba(239, 68, 68, ${alpha * 0.5})`);
      rash.addColorStop(1.0, 'rgba(239, 68, 68, 0)');
    } else {
      rash.addColorStop(0.0, `rgba(222, 78, 78, ${alpha * 0.8})`);
      rash.addColorStop(0.45, `rgba(240, 120, 120, ${alpha * 0.45})`);
      rash.addColorStop(1.0, 'rgba(248, 160, 160, 0)');
    }

    ctx.fillStyle = rash;
    ctx.beginPath();
    ctx.arc(x, y, rashRadius, 0, Math.PI * 2);
    ctx.fill();

    // Micro-pápulas: la reacción no es un disco liso.
    const rand = makeRandom(4242 + Math.floor(rashRadius));
    ctx.globalAlpha = 0.28 * erythema;
    ctx.fillStyle = severe ? '#B91C1C' : '#EF4444';
    for (let i = 0; i < 60; i++) {
      const angle = rand() * Math.PI * 2;
      const dist = rand() * rashRadius * 0.85;
      ctx.beginPath();
      ctx.arc(x + Math.cos(angle) * dist, y + Math.sin(angle) * dist, 1.5 + rand() * 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Marca del parche de aplicación.
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, 26, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.5)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}
