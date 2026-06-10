(() => {
  'use strict';

  window.BH = window.BH || {};

  const COMBO_DATA = [
    null,
    { name: '一段斬り', damage: 1.0, cost: 1.0, duration: 0.84, reach: 0.94, radius: 0.95, lunge: 0.98, knockback: 0.9, activeStart: 0.92, activeEnd: 0.92, cooldown: 0.7, slash: 0.82 },
    { name: '二段横斬り', damage: 1.16, cost: 1.05, duration: 0.96, reach: 1.0, radius: 1.0, lunge: 1.08, knockback: 1.0, activeStart: 0.95, activeEnd: 1.03, cooldown: 0.75, slash: 0.95 },
    { name: '三段叩きつけ', damage: 1.58, cost: 1.22, duration: 1.2, reach: 1.12, radius: 1.16, lunge: 1.22, knockback: 1.35, activeStart: 1.06, activeEnd: 1.2, cooldown: 1.08, slash: 1.22 },
  ];

  BH.Player = class Player {
    constructor() {
      this.reset();
    }

    reset() {
      const cfg = BH.CONFIG.player;
      this.weapon = BH.Storage.getCurrentWeapon();
      this.armor = BH.Storage.getCurrentArmor();
      this.x = cfg.x;
      this.y = cfg.y;
      this.radius = cfg.radius;
      this.maxHp = cfg.maxHp + this.armor.hpBonus;
      this.hp = this.maxHp;
      this.maxStamina = cfg.maxStamina;
      this.stamina = cfg.maxStamina;
      this.potions = cfg.potionCount + this.armor.potionBonus;
      this.facing = 0;
      this.rollTimer = 0;
      this.attackTimer = 0;
      this.attackDuration = 0;
      this.attackCooldown = 0;
      this.attackHitDone = false;
      this.invulnerable = 0;
      this.hurtFlash = 0;
      this.lungeTimer = 0;
      this.comboStep = 0;
      this.comboQueued = false;
      this.comboWindow = 0;
      this.comboFlash = 0;
      this.justEvadeReady = false;
      this.justEvadeCooldown = 0;
      this.justAttackBonus = 0;
    }

    update(dt, game) {
      const cfg = BH.CONFIG.player;
      const input = game.input;
      const axis = input.axis();

      this.invulnerable = Math.max(0, this.invulnerable - dt);
      this.hurtFlash = Math.max(0, this.hurtFlash - dt);
      this.attackCooldown = Math.max(0, this.attackCooldown - dt);
      this.lungeTimer = Math.max(0, this.lungeTimer - dt);
      this.comboWindow = Math.max(0, this.comboWindow - dt);
      this.comboFlash = Math.max(0, this.comboFlash - dt);
      this.justEvadeCooldown = Math.max(0, this.justEvadeCooldown - dt);
      this.justAttackBonus = Math.max(0, this.justAttackBonus - dt);

      if (axis.x || axis.y) this.facing = Math.atan2(axis.y, axis.x);
      else if (game.lockOn && game.monster && !game.monster.isDead()) this.facing = BH.angleTo(this, game.monster);

      if (input.consume('potion')) this.usePotion(game);
      if (input.consume('roll')) this.tryRoll(game, input.takeRollAxis());
      if (input.consume('attack')) this.handleAttackInput(game);

      if (this.attackTimer > 0) this.updateAttack(dt, game);

      let speed = cfg.moveSpeed;
      if (this.rollTimer > 0) {
        this.rollTimer = Math.max(0, this.rollTimer - dt);
        speed = cfg.rollSpeed;
        if (this.rollTimer <= 0) this.justEvadeReady = false;
      }

      const canMove = this.attackTimer <= 0 || this.lungeTimer > 0;
      if (canMove && (axis.x || axis.y)) {
        this.x += axis.x * speed * dt;
        this.y += axis.y * speed * dt;
      }

      if (this.lungeTimer > 0) {
        this.x += Math.cos(this.facing) * this.currentCombo().lungePower * dt;
        this.y += Math.sin(this.facing) * this.currentCombo().lungePower * dt;
      }

      if (this.rollTimer <= 0 && this.attackTimer <= 0) {
        this.stamina = Math.min(this.maxStamina, this.stamina + cfg.staminaRegen * dt);
      } else {
        this.stamina = Math.min(this.maxStamina, this.stamina + cfg.staminaRegen * 0.25 * dt);
      }

      if (this.comboWindow <= 0 && this.attackTimer <= 0) {
        this.comboStep = 0;
        this.comboQueued = false;
      }

      this.keepInsideArena();
    }

    currentCombo() {
      return this.combo || this.makeCombo(1);
    }

    makeCombo(step) {
      const c = COMBO_DATA[step] || COMBO_DATA[1];
      return {
        step,
        name: c.name,
        attackDuration: this.weapon.attackDuration * c.duration,
        activeStart: this.weapon.activeStart * c.activeStart,
        activeEnd: this.weapon.activeEnd * c.activeEnd,
        cooldown: this.weapon.cooldown * c.cooldown,
        reach: this.weapon.reach * c.reach,
        hitRadius: this.weapon.hitRadius * c.radius,
        lungePower: this.weapon.lungePower * c.lunge,
        knockback: this.weapon.knockback * c.knockback,
        damage: this.weapon.attackDamage * c.damage,
        staminaCost: Math.round(this.weapon.attackCost * c.cost),
        slash: c.slash,
      };
    }

    handleAttackInput(game) {
      if (this.attackTimer > 0) {
        const elapsed = this.attackDuration - this.attackTimer;
        if (elapsed >= this.attackDuration * 0.42 && this.comboStep < 3) {
          this.comboQueued = true;
          this.comboFlash = 0.18;
          game.effects.addMessage(this.x, this.y - 48, 'NEXT', '#a8ecff');
        }
        return;
      }
      this.tryAttack(game, this.comboWindow > 0 && this.comboStep > 0 ? this.comboStep + 1 : 1);
    }

    tryAttack(game, step = 1) {
      if (this.attackTimer > 0 || this.attackCooldown > 0 || this.rollTimer > 0) return;
      if (game.lockOn && game.monster && !game.monster.isDead()) this.facing = BH.angleTo(this, game.monster);
      const nextStep = BH.clamp(step, 1, 3);
      const combo = this.makeCombo(nextStep);
      if (this.stamina < combo.staminaCost) {
        game.effects.addMessage(this.x, this.y - 32, 'スタミナ不足', '#ffd166');
        this.comboWindow = 0;
        this.comboStep = 0;
        return;
      }
      this.startAttack(game, nextStep, combo);
    }

    startAttack(game, step, combo = this.makeCombo(step)) {
      this.combo = combo;
      this.comboStep = step;
      this.comboQueued = false;
      this.comboWindow = BH.CONFIG.tuning.comboResetTime;
      this.stamina -= combo.staminaCost;
      this.attackTimer = combo.attackDuration;
      this.attackDuration = combo.attackDuration;
      this.attackCooldown = combo.attackDuration + combo.cooldown;
      this.attackHitDone = false;
      this.lungeTimer = step === 3 ? 0.18 : 0.12;
      if (step === 3) game.effects.addMessage(this.x, this.y - 50, 'FINISH!', '#ffd166');
      game.effects.addSlash(
        this.x + Math.cos(this.facing) * combo.reach * 0.55,
        this.y + Math.sin(this.facing) * combo.reach * 0.55,
        this.facing,
        combo.reach * 0.72 * combo.slash,
      );
    }

    updateAttack(dt, game) {
      const combo = this.currentCombo();
      const elapsed = this.attackDuration - this.attackTimer;
      const isActive = elapsed >= combo.activeStart && elapsed <= combo.activeEnd;
      this.attackTimer = Math.max(0, this.attackTimer - dt);

      if (isActive && !this.attackHitDone && game.monster && !game.monster.isDead()) {
        const hitbox = this.getAttackHitbox();
        if (BH.circleHit(hitbox, hitbox.radius, game.monster, game.monster.radius)) {
          this.attackHitDone = true;
          const justBonus = this.justAttackBonus > 0 ? BH.CONFIG.tuning.justEvadeAttackBonus : 1;
          const baseDamage = combo.damage * justBonus + Math.floor(Math.random() * 5);
          const hitAngle = BH.angleTo(this, game.monster);
          game.monster.takeDamage(baseDamage, hitAngle, game, { comboStep: this.comboStep, justBonus: this.justAttackBonus > 0, knockback: combo.knockback });
          game.hitStop = Math.max(game.hitStop, this.comboStep === 3 ? BH.CONFIG.tuning.hitStop * 1.7 : BH.CONFIG.tuning.hitStop);
          if (this.comboStep === 3) game.effects.flash(0.45);
          if (this.justAttackBonus > 0) this.justAttackBonus = 0;
        }
      }

      if (this.attackTimer <= 0) {
        if (this.comboQueued && this.comboStep < 3) {
          this.attackCooldown = 0;
          this.tryAttack(game, this.comboStep + 1);
        } else {
          this.comboQueued = false;
          if (this.comboStep >= 3) this.comboWindow = 0;
        }
      }
    }

    getAttackHitbox() {
      const combo = this.currentCombo();
      return {
        x: this.x + Math.cos(this.facing) * combo.reach,
        y: this.y + Math.sin(this.facing) * combo.reach,
        radius: combo.hitRadius,
      };
    }

    tryRoll(game, axis) {
      if (this.rollTimer > 0 || this.attackTimer > 0) return;
      if (this.stamina < BH.CONFIG.player.rollCost) {
        game.effects.addMessage(this.x, this.y - 32, 'スタミナ不足', '#ffd166');
        return;
      }
      if (axis.x || axis.y) this.facing = Math.atan2(axis.y, axis.x);
      else if (game.lockOn && game.monster && !game.monster.isDead()) this.facing = BH.angleTo(game.monster, this);
      this.stamina -= BH.CONFIG.player.rollCost;
      this.rollTimer = BH.CONFIG.player.rollDuration;
      this.justEvadeReady = true;
      this.invulnerable = Math.max(this.invulnerable, BH.CONFIG.player.rollDuration + 0.08);
      game.effects.burst(this.x, this.y + 14, 6, '#9de7ff');
    }

    triggerJustEvade(game) {
      if (!this.justEvadeReady || this.justEvadeCooldown > 0) return false;
      this.justEvadeReady = false;
      this.justEvadeCooldown = BH.CONFIG.tuning.justEvadeWindow;
      this.justAttackBonus = BH.CONFIG.tuning.justEvadeBonusDuration;
      this.stamina = Math.min(this.maxStamina, this.stamina + BH.CONFIG.tuning.justEvadeStaminaBonus);
      game.effects.addMessage(this.x, this.y - 54, 'JUST EVADE', '#a8ecff');
      game.effects.burst(this.x, this.y, 18, '#a8ecff');
      game.effects.shakeCamera(0.42);
      return true;
    }

    usePotion(game) {
      if (this.potions <= 0 || this.hp >= this.maxHp || this.attackTimer > 0) return;
      this.potions -= 1;
      this.hp = Math.min(this.maxHp, this.hp + BH.CONFIG.player.potionHeal);
      this.invulnerable = Math.max(this.invulnerable, 0.26);
      game.effects.addMessage(this.x, this.y - 34, `+${BH.CONFIG.player.potionHeal}`, '#75e6a2');
      game.effects.burst(this.x, this.y, 12, '#75e6a2');
    }

    takeDamage(amount, game, label = null) {
      if (this.invulnerable > 0 || this.hp <= 0) return false;
      const finalAmount = Math.max(1, Math.round(amount - this.armor.defense));
      const displayLabel = label ? label.replace(/-\d+/, `-${finalAmount}`) : `-${finalAmount}`;
      this.hp = Math.max(0, this.hp - finalAmount);
      this.invulnerable = BH.CONFIG.player.invulnerableAfterHit;
      this.hurtFlash = 0.24;
      this.comboWindow = 0;
      this.comboStep = 0;
      this.comboQueued = false;
      game.effects.addDamageText(this.x, this.y - 28, displayLabel, '#ffb3b3');
      if (this.armor.defense > 0) game.effects.addMessage(this.x, this.y - 48, `防御 -${this.armor.defense}`, '#a8ecff');
      game.effects.burst(this.x, this.y, 12, '#ff6b6b');
      game.effects.shakeCamera(0.8);
      game.effects.flash(0.6);
      return true;
    }

    keepInsideArena() {
      const safe = BH.CONFIG.canvas.safeMargin;
      this.x = BH.clamp(this.x, safe, BH.CONFIG.canvas.width - safe);
      this.y = BH.clamp(this.y, safe + 16, BH.CONFIG.canvas.height - safe);
    }

    isDead() {
      return this.hp <= 0;
    }

    draw(ctx) {
      const invAlpha = this.invulnerable > 0 && Math.floor(this.invulnerable * 16) % 2 === 0 ? 0.58 : 1;
      ctx.save();
      ctx.globalAlpha = invAlpha;

      ctx.fillStyle = 'rgba(0,0,0,0.26)';
      ctx.beginPath();
      ctx.ellipse(this.x, this.y + 18, this.radius * 1.15, this.radius * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();

      if (this.justAttackBonus > 0) {
        ctx.save();
        ctx.globalAlpha = 0.26 + Math.sin(performance.now() * 0.022) * 0.08;
        ctx.strokeStyle = '#a8ecff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      ctx.translate(this.x, this.y);
      ctx.rotate(this.facing);

      ctx.fillStyle = this.hurtFlash > 0 ? '#fff' : '#6bd3ff';
      ctx.strokeStyle = '#102030';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f6f0d6';
      ctx.beginPath();
      ctx.arc(8, -5, 5, 0, Math.PI * 2);
      ctx.arc(8, 5, 5, 0, Math.PI * 2);
      ctx.fill();

      const combo = this.currentCombo();
      const bladeReach = 50 + this.weapon.level * 2 + this.comboStep * 5;
      ctx.strokeStyle = this.comboStep === 3 ? '#ffd166' : '#f8fbff';
      ctx.lineWidth = this.comboStep === 3 ? 8 : 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(bladeReach + combo.reach * 0.04, 0);
      ctx.stroke();
      ctx.strokeStyle = '#40576d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(bladeReach + combo.reach * 0.04, 0);
      ctx.stroke();

      ctx.restore();

      if (this.attackTimer > 0) {
        const box = this.getAttackHitbox();
        ctx.save();
        ctx.globalAlpha = this.comboStep === 3 ? 0.18 : 0.12;
        ctx.fillStyle = this.comboStep === 3 ? '#ffd166' : '#ffffff';
        ctx.beginPath();
        ctx.arc(box.x, box.y, box.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (this.comboStep > 0 && (this.attackTimer > 0 || this.comboWindow > 0)) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = '900 13px system-ui, sans-serif';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.56)';
        ctx.fillStyle = this.comboQueued || this.comboFlash > 0 ? '#a8ecff' : '#edf4ff';
        const label = this.comboQueued ? `COMBO ${this.comboStep} →` : `COMBO ${this.comboStep}`;
        ctx.strokeText(label, this.x, this.y - this.radius - 18);
        ctx.fillText(label, this.x, this.y - this.radius - 18);
        ctx.restore();
      }
    }
  };
})();
