(() => {
  'use strict';

  window.BH = window.BH || {};

  BH.Monster = class Monster {
    constructor(monsterId) {
      this.template = BH.DATA.monsters[monsterId];
      this.reset();
    }

    reset() {
      const cfg = this.template;
      this.id = cfg.id;
      this.name = cfg.name;
      this.species = cfg.species;
      this.x = cfg.x;
      this.y = cfg.y;
      this.radius = cfg.radius;
      this.maxHp = cfg.maxHp;
      this.hp = this.maxHp;
      this.state = 'chase';
      this.timer = 0;
      this.attackCooldown = 0.9;
      this.attackIndex = 0;
      this.currentAttack = null;
      this.attackTarget = null;
      this.attackDir = { x: -1, y: 0 };
      this.didDamage = false;
      this.flash = 0;
      this.recoveryPulse = 0;
      this.facing = Math.PI;
      this.poisonPools = [];
      this.enraged = false;
      this.roarTimer = 0;
      this.justEvadeHits = new Set();
    }

    update(dt, game) {
      this.flash = Math.max(0, this.flash - dt);
      this.recoveryPulse = Math.max(0, this.recoveryPulse - dt * 5);
      this.roarTimer = Math.max(0, this.roarTimer - dt);
      this.checkEnrage(game);
      this.updatePoisonPools(dt, game);
      if (this.isDead()) return;

      if (this.state === 'chase') this.updateChase(dt, game);
      else if (this.state === 'telegraph') this.updateTelegraph(dt);
      else if (this.state === 'active') this.updateActive(dt, game);
      else if (this.state === 'recovery') this.updateRecovery(dt);

      this.keepInsideArena();
    }

    updatePoisonPools(dt, game) {
      for (const pool of this.poisonPools) {
        pool.life -= dt;
        pool.tick -= dt;
        if (pool.life > 0 && pool.tick <= 0) {
          pool.tick = BH.CONFIG.tuning.poisonTickInterval;
          if (BH.circleHit(pool, pool.radius, game.player, game.player.radius)) {
            game.player.takeDamage(pool.damage, game, `毒 -${pool.damage}`);
          }
        }
      }
      this.poisonPools = this.poisonPools.filter((pool) => pool.life > 0);
    }

    updateChase(dt, game) {
      const player = game.player;
      this.facing = BH.angleTo(this, player);
      const distance = BH.dist(this, player);
      const preferred = this.template.shape === 'shell' ? 186 : 156;

      if (distance > preferred) {
        const dir = BH.normalize(player.x - this.x, player.y - this.y);
        const speedBonus = this.enraged ? BH.CONFIG.tuning.enragedSpeedBonus : 1;
        this.x += dir.x * this.template.moveSpeed * speedBonus * dt;
        this.y += dir.y * this.template.moveSpeed * speedBonus * dt;
      } else if (distance < 104) {
        const dir = BH.normalize(this.x - player.x, this.y - player.y);
        const speedBonus = this.enraged ? BH.CONFIG.tuning.enragedSpeedBonus : 1;
        this.x += dir.x * this.template.moveSpeed * speedBonus * 0.36 * dt;
        this.y += dir.y * this.template.moveSpeed * speedBonus * 0.36 * dt;
      }

      this.attackCooldown -= dt;
      if (this.attackCooldown <= 0) this.beginAttack(game);

      if (BH.circleHit(this, this.radius * 0.78, player, player.radius) && player.invulnerable <= 0) {
        player.takeDamage(this.template.contactDamage, game);
      }
    }

    beginAttack(game) {
      const pattern = this.template.attackPattern;
      const attackId = pattern[this.attackIndex % pattern.length];
      this.attackIndex += 1;
      this.currentAttack = this.template.attacks[attackId];
      this.state = 'telegraph';
      this.timer = this.currentAttack.telegraph * (this.enraged ? BH.CONFIG.tuning.enragedTelegraphMultiplier : 1);
      this.didDamage = false;
      this.facing = BH.angleTo(this, game.player);
      this.attackDir = BH.normalize(game.player.x - this.x, game.player.y - this.y);
      if (!this.attackDir.x && !this.attackDir.y) this.attackDir = { x: Math.cos(this.facing), y: Math.sin(this.facing) };

      if (this.currentAttack.type === 'slam') {
        this.attackTarget = {
          x: this.x + this.attackDir.x * 58,
          y: this.y + this.attackDir.y * 58,
        };
      } else if (this.currentAttack.type === 'poison') {
        this.attackTarget = {
          x: BH.clamp(game.player.x, 80, BH.CONFIG.canvas.width - 80),
          y: BH.clamp(game.player.y, 96, BH.CONFIG.canvas.height - 80),
        };
      } else {
        this.attackTarget = {
          x: this.x + this.attackDir.x * this.currentAttack.range,
          y: this.y + this.attackDir.y * this.currentAttack.range,
        };
      }
    }

    updateTelegraph(dt) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.state = 'active';
        this.timer = this.currentAttack.active;
        this.didDamage = false;
        this.justEvadeHits.clear();
        this.recoveryPulse = 1;
        if (this.currentAttack.type === 'poison') this.spawnPoisonPool();
      }
    }

    updateActive(dt, game) {
      this.timer -= dt;
      if (this.currentAttack.type === 'charge') {
        const speedBonus = this.enraged ? 1.12 : 1;
        this.x += this.attackDir.x * this.currentAttack.speed * speedBonus * dt;
        this.y += this.attackDir.y * this.currentAttack.speed * speedBonus * dt;
        if (!this.didDamage && BH.circleHit(this, this.radius * 0.78 + this.currentAttack.width * 0.18, game.player, game.player.radius)) {
          this.didDamage = true;
          this.tryDamagePlayer(game, this.currentAttack.damage);
        }
      } else if (this.currentAttack.type === 'slam') {
        if (!this.didDamage && BH.circleHit(this.attackTarget, this.currentAttack.radius, game.player, game.player.radius)) {
          this.didDamage = true;
          this.tryDamagePlayer(game, this.currentAttack.damage);
        }
      } else if (this.currentAttack.type === 'poison') {
        if (!this.didDamage && BH.circleHit(this.attackTarget, this.currentAttack.radius, game.player, game.player.radius)) {
          this.didDamage = true;
          this.tryDamagePlayer(game, this.currentAttack.damage, `毒 -${this.currentAttack.damage}`);
        }
      }

      if (this.timer <= 0) {
        this.state = 'recovery';
        this.timer = this.currentAttack.recovery;
      }
    }

    spawnPoisonPool() {
      this.poisonPools.push({
        x: this.attackTarget.x,
        y: this.attackTarget.y,
        radius: this.currentAttack.radius,
        damage: Math.max(4, Math.floor(this.currentAttack.damage * 0.55)),
        life: this.currentAttack.poolDuration,
        maxLife: this.currentAttack.poolDuration,
        tick: 0.05,
      });
    }

    updateRecovery(dt) {
      this.timer -= dt;
      this.recoveryPulse = Math.max(this.recoveryPulse, 0.2 + Math.sin(performance.now() * 0.018) * 0.08);
      if (this.timer <= 0) {
        this.state = 'chase';
        this.attackCooldown = this.currentAttack.cooldown * (this.enraged ? BH.CONFIG.tuning.enragedCooldownMultiplier : 1);
        this.currentAttack = null;
        this.attackTarget = null;
      }
    }

    checkEnrage(game) {
      if (this.enraged || this.hp <= 0) return;
      if (this.hp / this.maxHp > BH.CONFIG.tuning.enragedHpRatio) return;
      this.enraged = true;
      this.roarTimer = 1.2;
      this.attackCooldown = Math.min(this.attackCooldown, 0.3);
      game.effects.addMessage(this.x, this.y - this.radius - 30, '怒り状態！', '#ff6b6b');
      game.effects.burst(this.x, this.y, 28, '#ff6b6b');
      game.effects.shakeCamera(1.2);
      game.effects.flash(0.55);
    }

    tryDamagePlayer(game, amount, label = null) {
      const player = game.player;
      const damage = Math.round(amount * (this.enraged ? BH.CONFIG.tuning.enragedDamageMultiplier : 1));
      if (player.invulnerable > 0) {
        if (player.rollTimer > 0 && !this.justEvadeHits.has(this.currentAttack?.name || 'contact')) {
          this.justEvadeHits.add(this.currentAttack?.name || 'contact');
          player.triggerJustEvade(game);
        }
        return false;
      }
      return player.takeDamage(damage, game, label);
    }

    takeDamage(amount, angle, game, options = {}) {
      const isWeak = this.state === 'recovery';
      const comboBonus = options.comboStep === 3 ? 1.08 : 1;
      const finalDamage = Math.max(1, Math.round(amount * comboBonus * (isWeak ? BH.CONFIG.tuning.recoveryDamageBonus : 1)));
      this.hp = Math.max(0, this.hp - finalDamage);
      this.flash = 0.13;
      const color = options.justBonus ? '#a8ecff' : isWeak ? '#a8ecff' : options.comboStep === 3 ? '#ffd166' : '#fff2a8';
      const suffix = options.justBonus ? '★' : isWeak || options.comboStep === 3 ? '!' : '';
      game.effects.addDamageText(this.x, this.y - this.radius - 14, `${finalDamage}${suffix}`, color);
      game.effects.burst(this.x + Math.cos(angle) * this.radius * 0.4, this.y + Math.sin(angle) * this.radius * 0.4, 12, color);
      game.effects.shakeCamera(options.comboStep === 3 ? 0.9 : isWeak ? 0.72 : 0.48);
      const knockback = options.knockback || game.player.weapon.knockback;
      this.x += Math.cos(angle) * knockback;
      this.y += Math.sin(angle) * knockback;
    }

    keepInsideArena() {
      const safe = BH.CONFIG.canvas.safeMargin + this.radius * 0.35;
      this.x = BH.clamp(this.x, safe, BH.CONFIG.canvas.width - safe);
      this.y = BH.clamp(this.y, safe + 16, BH.CONFIG.canvas.height - safe);
    }

    isDead() {
      return this.hp <= 0;
    }

    drawTelegraph(ctx) {
      this.drawPoisonPools(ctx);
      if (this.roarTimer > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(0.55, this.roarTimer * 0.55);
        ctx.strokeStyle = '#ff6b6b';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + 26 + Math.sin(performance.now() * 0.02) * 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      if (this.state !== 'telegraph' || !this.currentAttack) return;
      const pulse = 0.48 + Math.sin(performance.now() * 0.02) * 0.16;
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#ff4f64';
      ctx.strokeStyle = '#ffb3bd';
      ctx.lineWidth = 3;

      if (this.currentAttack.type === 'charge') {
        const start = { x: this.x, y: this.y };
        const end = this.attackTarget;
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const length = Math.hypot(end.x - start.x, end.y - start.y);
        ctx.translate(start.x, start.y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.roundRect?.(0, -this.currentAttack.width / 2, length, this.currentAttack.width, this.currentAttack.width / 2);
        if (!ctx.roundRect) ctx.rect(0, -this.currentAttack.width / 2, length, this.currentAttack.width);
        ctx.fill();
        ctx.stroke();
      } else {
        const radius = this.currentAttack.radius;
        ctx.beginPath();
        ctx.arc(this.attackTarget.x, this.attackTarget.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    drawPoisonPools(ctx) {
      for (const pool of this.poisonPools) {
        const alpha = BH.clamp(pool.life / pool.maxLife, 0, 1);
        ctx.save();
        ctx.globalAlpha = Math.min(0.48, 0.2 + alpha * 0.28);
        ctx.fillStyle = '#8b3ad6';
        ctx.strokeStyle = '#b8ff6b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(pool.x, pool.y, pool.radius, pool.radius * 0.68, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = Math.min(0.75, 0.3 + alpha * 0.45);
        ctx.stroke();
        ctx.restore();
      }
    }

    draw(ctx) {
      ctx.save();
      if (this.enraged) {
        ctx.save();
        ctx.globalAlpha = 0.18 + Math.sin(performance.now() * 0.014) * 0.05;
        ctx.fillStyle = '#ff4f64';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.ellipse(this.x, this.y + this.radius * 0.42, this.radius * 1.16, this.radius * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.facing);
      if (this.enraged) {
        ctx.scale(1.04, 1.04);
      }
      if (this.state === 'telegraph') {
        ctx.translate(Math.sin(performance.now() * 0.05) * 3, 0);
      }
      if (this.state === 'recovery') {
        ctx.globalAlpha = 0.86 + this.recoveryPulse * 0.12;
      }

      if (this.template.shape === 'shell') this.drawShellBody(ctx);
      else if (this.template.shape === 'lizard') this.drawLizardBody(ctx);
      else this.drawBeastBody(ctx);

      ctx.restore();
    }

    commonStyles(ctx) {
      const colors = this.template.colors;
      ctx.lineWidth = 5;
      ctx.strokeStyle = colors.outline;
      ctx.fillStyle = this.flash > 0 ? '#ffffff' : colors.body;
    }

    drawBeastBody(ctx) {
      const colors = this.template.colors;
      this.commonStyles(ctx);
      ctx.beginPath();
      ctx.ellipse(0, 0, this.radius * 1.05, this.radius * 0.82, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = this.flash > 0 ? '#ffffff' : colors.belly;
      ctx.beginPath();
      ctx.ellipse(10, 8, this.radius * 0.46, this.radius * 0.36, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = this.flash > 0 ? '#ffffff' : colors.accent;
      ctx.beginPath();
      ctx.moveTo(this.radius * 0.42, -10);
      ctx.lineTo(this.radius * 1.1, -26);
      ctx.lineTo(this.radius * 0.8, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#10151f';
      ctx.beginPath();
      ctx.arc(this.radius * 0.42, -12, 5, 0, Math.PI * 2);
      ctx.arc(this.radius * 0.42, 12, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = colors.outline;
      for (let i = -1; i <= 1; i += 1) {
        ctx.beginPath();
        ctx.arc(-this.radius * 0.48, i * 20, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    drawShellBody(ctx) {
      const colors = this.template.colors;
      this.commonStyles(ctx);
      ctx.beginPath();
      ctx.ellipse(0, 0, this.radius * 1.18, this.radius * 0.88, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = this.flash > 0 ? '#ffffff' : colors.belly;
      for (let i = -2; i <= 2; i += 1) {
        ctx.beginPath();
        ctx.arc(i * 18, -6 + Math.abs(i) * 5, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      ctx.fillStyle = this.flash > 0 ? '#ffffff' : colors.accent;
      for (let i = -1; i <= 1; i += 1) {
        ctx.beginPath();
        ctx.moveTo(10, i * 21);
        ctx.lineTo(this.radius * 1.18, i * 28);
        ctx.lineTo(22, i * 13);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      ctx.fillStyle = '#10151f';
      ctx.beginPath();
      ctx.arc(this.radius * 0.34, -16, 5, 0, Math.PI * 2);
      ctx.arc(this.radius * 0.34, 16, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    drawLizardBody(ctx) {
      const colors = this.template.colors;
      this.commonStyles(ctx);
      ctx.beginPath();
      ctx.ellipse(0, 0, this.radius * 1.36, this.radius * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = this.flash > 0 ? '#ffffff' : colors.belly;
      ctx.beginPath();
      ctx.ellipse(14, 0, this.radius * 0.5, this.radius * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = colors.outline;
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-this.radius * 0.9, 0);
      ctx.quadraticCurveTo(-this.radius * 1.4, -18, -this.radius * 1.72, -6);
      ctx.stroke();
      ctx.strokeStyle = this.flash > 0 ? '#ffffff' : colors.body;
      ctx.lineWidth = 5;
      ctx.stroke();

      ctx.fillStyle = this.flash > 0 ? '#ffffff' : colors.accent;
      for (let i = -2; i <= 2; i += 1) {
        ctx.beginPath();
        ctx.moveTo(i * 18 - 8, -this.radius * 0.42);
        ctx.lineTo(i * 18 + 4, -this.radius * 0.75);
        ctx.lineTo(i * 18 + 16, -this.radius * 0.42);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      ctx.fillStyle = '#10151f';
      ctx.beginPath();
      ctx.arc(this.radius * 0.58, -10, 5, 0, Math.PI * 2);
      ctx.arc(this.radius * 0.58, 10, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  };
})();
