(() => {
  'use strict';

  window.BH = window.BH || {};

  BH.Effects = class Effects {
    constructor() {
      this.texts = [];
      this.particles = [];
      this.slashes = [];
      this.shake = 0;
      this.screenFlash = 0;
    }

    reset() {
      this.texts.length = 0;
      this.particles.length = 0;
      this.slashes.length = 0;
      this.shake = 0;
      this.screenFlash = 0;
    }

    addDamageText(x, y, text, color = '#fff2a8') {
      this.texts.push({ x, y, text, color, life: 0.72, maxLife: 0.72, vy: -56, size: 22 });
    }

    addMessage(x, y, text, color = '#78d7ff') {
      this.texts.push({ x, y, text, color, life: 1.0, maxLife: 1.0, vy: -34, size: 18 });
    }

    burst(x, y, count = 10, color = '#ffd166') {
      for (let i = 0; i < count; i += 1) {
        const angle = BH.rand(0, Math.PI * 2);
        const speed = BH.rand(60, 180);
        this.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          r: BH.rand(2, 5),
          life: BH.rand(0.25, 0.56),
          maxLife: 0.56,
          color,
        });
      }
    }

    addSlash(x, y, angle, radius) {
      this.slashes.push({ x, y, angle, radius, life: 0.18, maxLife: 0.18 });
    }

    shakeCamera(amount) {
      this.shake = Math.max(this.shake, amount);
    }

    flash(amount) {
      this.screenFlash = Math.max(this.screenFlash, amount);
    }

    update(dt) {
      this.shake = Math.max(0, this.shake - dt * BH.CONFIG.tuning.cameraShakeDecay);
      this.screenFlash = Math.max(0, this.screenFlash - dt * BH.CONFIG.tuning.screenFlashDecay);

      for (const text of this.texts) {
        text.life -= dt;
        text.y += text.vy * dt;
      }
      this.texts = this.texts.filter((text) => text.life > 0);

      for (const p of this.particles) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 1 - dt * 3.2;
        p.vy *= 1 - dt * 3.2;
      }
      this.particles = this.particles.filter((p) => p.life > 0);

      for (const slash of this.slashes) slash.life -= dt;
      this.slashes = this.slashes.filter((slash) => slash.life > 0);
    }

    getCameraOffset() {
      if (this.shake <= 0) return { x: 0, y: 0 };
      const power = this.shake * 12;
      return { x: BH.rand(-power, power), y: BH.rand(-power, power) };
    }

    drawWorld(ctx) {
      for (const p of this.particles) {
        const alpha = BH.clamp(p.life / p.maxLife, 0, 1);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      for (const slash of this.slashes) {
        const alpha = BH.clamp(slash.life / slash.maxLife, 0, 1);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = '#f8fbff';
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(slash.x, slash.y, slash.radius, slash.angle - 0.8, slash.angle + 0.8);
        ctx.stroke();
        ctx.strokeStyle = '#78d7ff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(slash.x, slash.y, slash.radius + 5, slash.angle - 0.62, slash.angle + 0.62);
        ctx.stroke();
        ctx.restore();
      }
    }

    drawScreen(ctx) {
      for (const text of this.texts) {
        const alpha = BH.clamp(text.life / text.maxLife, 0, 1);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = `900 ${text.size || 22}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.58)';
        ctx.strokeText(text.text, text.x, text.y);
        ctx.fillStyle = text.color;
        ctx.fillText(text.text, text.x, text.y);
        ctx.restore();
      }

      if (this.screenFlash > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(0.22, this.screenFlash * 0.22);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, BH.CONFIG.canvas.width, BH.CONFIG.canvas.height);
        ctx.restore();
      }
    }
  };
})();
