(() => {
  'use strict';

  window.BH = window.BH || {};

  class Game {
    constructor() {
      this.canvas = document.getElementById('gameCanvas');
      this.ctx = this.canvas.getContext('2d');
      this.input = new BH.Input();
      this.effects = new BH.Effects();
      this.ui = new BH.UI(this);
      this.player = new BH.Player();
      this.monster = new BH.Monster(BH.DATA.quests[0].monsterId);
      this.currentQuest = null;
      this.state = 'menu';
      this.lastTime = 0;
      this.questTime = 0;
      this.result = null;
      this.hitStop = 0;
      this.rewards = [];
      this.pixelRatio = 1;
      this.resizeRaf = 0;
      this.lockOn = true;

      this.resizeCanvas(true);
      window.addEventListener('resize', () => this.scheduleResize());
      window.addEventListener('orientationchange', () => this.scheduleResize());

      window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && (this.state === 'playing' || this.state === 'paused')) {
          event.preventDefault();
          this.togglePause();
        }
      });

      this.showMenu();
      requestAnimationFrame((time) => this.loop(time));
    }

    scheduleResize() {
      cancelAnimationFrame(this.resizeRaf);
      this.resizeRaf = requestAnimationFrame(() => this.resizeCanvas(false));
    }

    resizeCanvas(initial = false) {
      const oldWidth = BH.CONFIG.canvas.width || 390;
      const oldHeight = BH.CONFIG.canvas.height || 844;
      const huntMode = document.body.dataset.mode === 'hunt';
      const rect = this.canvas.getBoundingClientRect();
      const cssWidth = huntMode
        ? Math.max(320, Math.round(window.innerWidth || 390))
        : Math.max(320, Math.round(rect.width || 390));
      const cssHeight = huntMode
        ? Math.max(560, Math.round(window.innerHeight || 844))
        : Math.max(560, Math.round(rect.height || 844));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      if (this.canvas.width !== Math.round(cssWidth * dpr) || this.canvas.height !== Math.round(cssHeight * dpr)) {
        this.canvas.width = Math.round(cssWidth * dpr);
        this.canvas.height = Math.round(cssHeight * dpr);
      }
      this.canvas.style.width = `${cssWidth}px`;
      this.canvas.style.height = `${cssHeight}px`;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.pixelRatio = dpr;
      BH.CONFIG.canvas.width = cssWidth;
      BH.CONFIG.canvas.height = cssHeight;
      BH.CONFIG.canvas.safeMargin = huntMode ? 24 : 34;

      if (!initial && (this.state === 'playing' || this.state === 'paused')) {
        const sx = cssWidth / oldWidth;
        const sy = cssHeight / oldHeight;
        this.player.x *= sx;
        this.player.y *= sy;
        this.monster.x *= sx;
        this.monster.y *= sy;
        this.player.keepInsideArena();
        this.monster.keepInsideArena();
      }
    }

    placeActorsForPortraitHunt() {
      const w = BH.CONFIG.canvas.width;
      const h = BH.CONFIG.canvas.height;
      this.player.x = w * 0.5;
      this.player.y = h * 0.76;
      this.player.facing = -Math.PI / 2;
      this.monster.x = w * 0.5;
      this.monster.y = h * 0.28;
      this.monster.facing = Math.PI / 2;
      this.player.keepInsideArena();
      this.monster.keepInsideArena();
    }

    showMenu() {
      this.state = 'menu';
      this.input.clear();
      this.ui.showScreen(
        'ホーム',
        this.ui.homeHtml(),
        `
          <button class="primary-button" data-ui="quest-select" type="button">クエストへ</button>
          <button class="secondary-button" data-ui="forge" type="button">工房へ</button>
          <button class="secondary-button" data-ui="inventory" type="button">素材を見る</button>
        `,
        'menu',
      );
    }

    showQuestSelect() {
      this.state = 'questSelect';
      this.input.clear();
      this.ui.showScreen(
        'クエスト選択',
        `<p>受注するクエストを選んでください。最初は「森の暴れ牙」がおすすめです。</p>${this.ui.questCardsHtml()}`,
        `
          <button class="secondary-button" data-ui="menu" type="button">ホームへ</button>
          <button class="secondary-button" data-ui="forge" type="button">工房へ</button>
        `,
        'quest-select',
      );
    }

    showForge() {
      this.state = 'forge';
      this.input.clear();
      this.ui.showScreen(
        '工房 / 装備強化',
        `<p>装備強化は専用画面に分離しました。素材が足りない場合は「素材」画面で入手先を確認できます。</p>${this.ui.forgeHtml()}`,
        `
          <button class="primary-button" data-ui="quest-select" type="button">クエストへ</button>
          <button class="secondary-button" data-ui="inventory" type="button">素材を見る</button>
          <button class="danger-button" data-ui="reset-save" type="button">セーブ初期化</button>
        `,
        'forge',
      );
    }

    showInventory() {
      this.state = 'inventory';
      this.input.clear();
      this.ui.showScreen(
        '所持素材',
        this.ui.inventoryHtml(),
        `
          <button class="primary-button" data-ui="quest-select" type="button">素材を集めに行く</button>
          <button class="secondary-button" data-ui="forge" type="button">工房へ</button>
          <button class="secondary-button" data-ui="menu" type="button">ホームへ</button>
        `,
        'inventory',
      );
    }

    tryUpgradeWeapon() {
      const current = BH.Storage.getCurrentWeapon();
      const next = BH.getNextWeaponLevelData(current.level);
      if (!next || !BH.Storage.canAfford(next.upgradeCost)) {
        this.showForge();
        return;
      }
      BH.Storage.spendMaterials(next.upgradeCost);
      BH.Storage.setWeaponLevel(next.level);
      this.effects.addMessage(480, 210, `${next.name} に強化！`, '#95ffcb');
      this.showForge();
    }

    tryUpgradeArmor() {
      const current = BH.Storage.getCurrentArmor();
      const next = BH.getNextArmorLevelData(current.level);
      if (!next || !BH.Storage.canAfford(next.upgradeCost)) {
        this.showForge();
        return;
      }
      BH.Storage.spendMaterials(next.upgradeCost);
      BH.Storage.setArmorLevel(next.level);
      this.player.reset();
      this.effects.addMessage(480, 236, `${next.name} に強化！`, '#a8ecff');
      this.showForge();
    }

    resetSave() {
      BH.Storage.reset();
      this.player.reset();
      this.effects.reset();
      this.showMenu();
    }

    startQuest(questId) {
      this.currentQuest = BH.getQuestById(questId);
      this.player.reset();
      this.monster = new BH.Monster(this.currentQuest.monsterId);
      this.effects.reset();
      this.state = 'playing';
      this.questTime = 0;
      this.result = null;
      this.rewards = [];
      this.hitStop = 0;
      this.lockOn = true;
      this.updateLockButton();
      this.input.clear();
      this.ui.renderHuntPanel();
      this.ui.showHunt();
      this.resizeCanvas(false);
      this.placeActorsForPortraitHunt();
    }

    togglePause() {
      if (this.state === 'playing') {
        this.pauseQuest();
      } else if (this.state === 'paused') {
        this.resumeQuest();
      }
    }

    pauseQuest() {
      if (this.state !== 'playing') return;
      this.state = 'paused';
      this.input.clear();
      this.ui.showPauseMenu();
    }

    resumeQuest() {
      if (this.state !== 'paused') return;
      this.state = 'playing';
      this.input.clear();
      this.ui.hidePauseMenu();
    }

    abandonQuest() {
      if (this.state === 'playing' || this.state === 'paused') {
        this.state = 'questSelect';
        this.input.clear();
        this.ui.hidePauseMenu();
        this.showQuestSelect();
      }
    }

    endQuest(kind) {
      if (this.state !== 'playing') return;
      this.state = kind;
      const clearTime = this.questTime;
      let bestUpdated = false;
      let huntCount = 0;
      if (kind === 'win') {
        bestUpdated = BH.Storage.setBestTimeIfBetter(this.currentQuest.id, clearTime);
        huntCount = BH.Storage.incrementHunt(this.monster.id);
        this.rewards = this.rollRewards(this.currentQuest);
        BH.Storage.addMaterials(this.rewards);
      }
      this.result = { kind, clearTime, bestUpdated, huntCount };
      this.input.clear();
      this.showResult();
    }

    showResult() {
      const win = this.result.kind === 'win';
      const rewardHtml = this.rewards.length
        ? `<div class="reward-grid">${this.rewards.map((reward) => `
            <article class="reward-card">
              <h3>${BH.materialChip(reward.materialId, reward.count)}</h3>
              <p class="card-meta">入手しました</p>
            </article>
          `).join('')}</div>`
        : '<p>報酬はありません。</p>';

      this.ui.showScreen(
        win ? 'リザルト / 討伐成功' : 'リザルト / クエスト失敗',
        win
          ? `
            <p>${BH.escapeHtml(this.monster.name)}を討伐しました。クリアタイム ${BH.formatTime(this.result.clearTime)}。${this.result.bestUpdated ? 'ベスト更新！' : '素材を集めてさらに強化しましょう。'}</p>
            ${rewardHtml}
          `
          : '<p>HPか制限時間が尽きました。赤い予兆を見て回避し、攻撃後のスキを狙いましょう。</p>',
        `
          <button class="primary-button" data-ui="retry" type="button">同じクエストへ</button>
          <button class="secondary-button" data-ui="quest-select" type="button">クエスト選択</button>
          <button class="secondary-button" data-ui="forge" type="button">工房へ</button>
          <button class="secondary-button" data-ui="inventory" type="button">素材を見る</button>
        `,
        '',
      );
    }

    rollRewards(quest) {
      const rewards = [];
      for (const row of quest.rewardTable) {
        if (Math.random() <= row.chance) {
          rewards.push({
            materialId: row.materialId,
            count: BH.randInt(row.min, row.max),
          });
        }
      }
      if (!rewards.length && quest.rewardTable[0]) {
        const fallback = quest.rewardTable[0];
        rewards.push({ materialId: fallback.materialId, count: fallback.min });
      }
      return rewards;
    }

    loop(time) {
      const dt = Math.min(0.033, (time - this.lastTime) / 1000 || 0);
      this.lastTime = time;
      this.update(dt);
      this.draw();
      this.input.endFrame();
      requestAnimationFrame((nextTime) => this.loop(nextTime));
    }

    update(dt) {
      if (this.state === 'paused') {
        return;
      }

      if (this.state !== 'playing') {
        this.effects.update(dt);
        return;
      }

      this.lockOn = true; // auto-lock is always on

      if (this.hitStop > 0) {
        this.hitStop = Math.max(0, this.hitStop - dt);
        this.effects.update(dt);
        return;
      }

      this.questTime += dt;
      this.player.update(dt, this);
      this.monster.update(dt, this);
      this.effects.update(dt);

      this.updateLockButton();

      if (this.monster.isDead()) this.endQuest('win');
      else if (this.player.isDead() || this.questTime >= this.currentQuest.timeLimit) this.endQuest('lose');
    }

    draw() {
      const ctx = this.ctx;
      const w = BH.CONFIG.canvas.width;
      const h = BH.CONFIG.canvas.height;
      ctx.clearRect(0, 0, w, h);

      const offset = this.effects.getCameraOffset();
      ctx.save();
      ctx.translate(offset.x, offset.y);
      this.drawBackground(ctx);
      if (this.monster) this.monster.drawTelegraph(ctx);
      this.effects.drawWorld(ctx);
      if (this.player) this.player.draw(ctx);
      if (this.monster) this.monster.draw(ctx);
      if (this.lockOn && this.monster && !this.monster.isDead()) this.drawLockMarker(ctx);
      ctx.restore();

      this.effects.drawScreen(ctx);
      this.drawHud(ctx);
      if (!['playing', 'paused'].includes(this.state)) this.drawMenuBackdropText(ctx);
      if (this.state === 'paused') this.drawPausedText(ctx);
    }

    drawBackground(ctx) {
      const w = BH.CONFIG.canvas.width;
      const h = BH.CONFIG.canvas.height;
      const biome = this.currentQuest?.biome || 'forest';
      const gradients = {
        forest: ['#223247', '#1c3a2c', '#17221d'],
        rock: ['#2f3442', '#3a3028', '#1d1b1a'],
        swamp: ['#202846', '#2c3340', '#18251f'],
      };
      const colors = gradients[biome] || gradients.forest;
      const gradient = ctx.createLinearGradient(0, 0, 0, h);
      gradient.addColorStop(0, colors[0]);
      gradient.addColorStop(0.62, colors[1]);
      gradient.addColorStop(1, colors[2]);
      ctx.fillStyle = gradient;
      ctx.fillRect(-20, -20, w + 40, h + 40);

      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 48) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x - 44, h);
        ctx.stroke();
      }

      ctx.fillStyle = biome === 'rock' ? 'rgba(210,180,130,0.12)' : biome === 'swamp' ? 'rgba(180,255,120,0.08)' : 'rgba(255,255,255,0.06)';
      for (let i = 0; i < 22; i += 1) {
        const x = (i * 149) % w;
        const y = 104 + ((i * 71) % (h - 160));
        ctx.beginPath();
        ctx.ellipse(x, y, 30 + (i % 5) * 6, 10 + (i % 3) * 5, (i % 7) * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle = 'rgba(201, 161, 74, 0.30)';
      ctx.lineWidth = 4;
      ctx.strokeRect(20, 20, w - 40, h - 40);
      ctx.strokeStyle = 'rgba(255, 242, 184, 0.12)';
      ctx.lineWidth = 1;
      ctx.strokeRect(25, 25, w - 50, h - 50);

      const vignette = ctx.createRadialGradient(w / 2, h * 0.48, Math.min(w, h) * 0.2, w / 2, h * 0.48, Math.max(w, h) * 0.72);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.32)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);
    }

    toggleLockOn() {
      this.lockOn = !this.lockOn;
      this.updateLockButton();
      if (this.player && this.monster && !this.monster.isDead()) {
        this.effects.addMessage(this.player.x, this.player.y - 42, this.lockOn ? 'LOCK ON' : 'LOCK OFF', this.lockOn ? '#a8ecff' : '#aebbd0');
      }
    }

    updateLockButton() {
      document.querySelectorAll('[data-action="lock"]').forEach((button) => {
        button.classList.toggle('is-active', this.lockOn);
        button.textContent = this.lockOn ? 'ロックON' : 'ロック';
      });
    }

    drawLockMarker(ctx) {
      const monster = this.monster;
      const t = performance.now() * 0.006;
      const r = monster.radius + 18 + Math.sin(t * 3) * 3;
      ctx.save();
      ctx.translate(monster.x, monster.y);
      ctx.strokeStyle = monster.enraged ? '#ff6b6b' : '#a8ecff';
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.78;
      for (let i = 0; i < 4; i += 1) {
        ctx.save();
        ctx.rotate(t + i * Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(r, -8);
        ctx.lineTo(r + 12, -8);
        ctx.lineTo(r + 12, 8);
        ctx.lineTo(r, 8);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }

    drawHud(ctx) {
      const w = BH.CONFIG.canvas.width;
      const h = BH.CONFIG.canvas.height;
      const margin = Math.max(12, Math.min(18, w * 0.035));
      const top = Math.max(10, Math.min(18, h * 0.018));
      const timerWidth = w < 360 ? 78 : 88;
      const playerPanelWidth = Math.max(210, w - margin * 3 - timerWidth);
      const playerPanelHeight = 74;
      const timerX = w - margin - timerWidth;

      this.drawGuildPanel(ctx, margin, top, playerPanelWidth, playerPanelHeight, 13, 'rgba(35, 24, 14, 0.78)');
      ctx.save();
      ctx.textAlign = 'left';
      ctx.font = '900 10px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(231, 200, 120, 0.92)';
      ctx.fillText('HUNTER', margin + 12, top + 16);
      ctx.font = '800 10px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(241, 231, 207, 0.76)';
      const weapon = BH.Storage.getCurrentWeapon();
      ctx.fillText(`Lv.${weapon.level} ${weapon.name}`, margin + 72, top + 16);
      ctx.restore();
      this.drawGuildBar(ctx, margin + 12, top + 24, playerPanelWidth - 24, 15, this.player.hp / this.player.maxHp, {
        label: 'HP',
        fillA: '#b93f31',
        fillB: '#ff846c',
      });
      this.drawGuildBar(ctx, margin + 12, top + 47, playerPanelWidth - 24, 11, this.player.stamina / this.player.maxStamina, {
        label: 'ST',
        fillA: '#b98925',
        fillB: '#f1c34a',
      });

      this.drawGuildPanel(ctx, timerX, top, timerWidth, playerPanelHeight, 13, 'rgba(28, 20, 12, 0.82)');
      const limit = this.currentQuest?.timeLimit || 180;
      const remain = Math.max(0, limit - this.questTime);
      const best = this.currentQuest ? BH.Storage.getBestTime(this.currentQuest.id) : 0;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = '900 9px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(231, 200, 120, 0.86)';
      ctx.fillText('TIME', timerX + timerWidth / 2, top + 16);
      ctx.font = '1000 18px system-ui, sans-serif';
      ctx.fillStyle = '#f1e7cf';
      ctx.shadowColor = 'rgba(0,0,0,0.65)';
      ctx.shadowBlur = 4;
      ctx.fillText(BH.formatTime(remain), timerX + timerWidth / 2, top + 39);
      ctx.shadowBlur = 0;
      ctx.font = '800 9px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(182, 163, 130, 0.9)';
      ctx.fillText(`Best ${best ? BH.formatTime(best) : '--:--'}`, timerX + timerWidth / 2, top + 58);
      ctx.restore();

      const monsterY = top + playerPanelHeight + 10;
      const monsterPanelHeight = 56;
      const monsterLabel = this.monster?.name || '大型モンスター';
      const monsterRatio = BH.clamp(this.monster.hp / this.monster.maxHp, 0, 1);
      const monsterColorA = monsterRatio <= 0.2 ? '#a92929' : monsterRatio <= 0.5 ? '#b86f29' : '#6f4ab5';
      const monsterColorB = monsterRatio <= 0.2 ? '#ff6464' : monsterRatio <= 0.5 ? '#ffb454' : '#d7b0ff';
      ctx.save();
      if (monsterRatio <= 0.2 && monsterRatio > 0) {
        ctx.globalAlpha = 0.80 + Math.sin(performance.now() * 0.012) * 0.20;
      }
      this.drawGuildPanel(ctx, margin, monsterY, w - margin * 2, monsterPanelHeight, 13, 'rgba(35, 24, 14, 0.72)');
      ctx.restore();
      ctx.save();
      ctx.textAlign = 'left';
      ctx.font = '900 10px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(231, 200, 120, 0.92)';
      ctx.fillText('TARGET', margin + 12, monsterY + 16);
      ctx.font = '900 12px system-ui, sans-serif';
      ctx.fillStyle = '#f1e7cf';
      ctx.fillText(monsterLabel, margin + 67, monsterY + 16);
      ctx.textAlign = 'right';
      ctx.fillStyle = monsterRatio <= 0.2 ? '#fff0e8' : '#f1e7cf';
      ctx.fillText(`${Math.max(0, Math.ceil(monsterRatio * 100))}%`, w - margin - 13, monsterY + 16);
      ctx.restore();
      this.drawGuildBar(ctx, margin + 12, monsterY + 27, w - margin * 2 - 24, 15, monsterRatio, {
        label: '',
        fillA: monsterColorA,
        fillB: monsterColorB,
      });

      const chipY = monsterY + monsterPanelHeight + 8;
      this.drawHudChip(ctx, margin, chipY, `薬 ×${this.player.potions}`, '#75e6a2');
      if (this.player.justAttackBonus > 0) {
        this.drawHudChip(ctx, margin + 72, chipY, 'JUST BONUS', '#a8ecff');
      }
      if (this.monster?.enraged) {
        this.drawHudChip(ctx, w - margin - 64, chipY, '怒り', '#ff6b6b', 64);
      }

      if (this.monster.state === 'recovery') {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = '900 17px system-ui, sans-serif';
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(18, 11, 6, 0.75)';
        ctx.fillStyle = '#e7c878';
        ctx.strokeText('攻撃後のスキ！', w / 2, chipY + 46);
        ctx.fillText('攻撃後のスキ！', w / 2, chipY + 46);
        ctx.restore();
      }
    }

    drawGuildPanel(ctx, x, y, width, height, radius = 12, fill = 'rgba(35, 24, 14, 0.76)') {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.42)';
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 6;
      ctx.fillStyle = fill;
      ctx.strokeStyle = 'rgba(201, 161, 74, 0.54)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect?.(x, y, width, height, radius);
      if (!ctx.roundRect) ctx.rect(x, y, width, height);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255, 242, 184, 0.16)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect?.(x + 3, y + 3, width - 6, height - 6, Math.max(4, radius - 3));
      if (!ctx.roundRect) ctx.rect(x + 3, y + 3, width - 6, height - 6);
      ctx.stroke();
      ctx.restore();
    }

    drawGuildBar(ctx, x, y, width, height, ratio, options) {
      const fillRatio = BH.clamp(ratio, 0, 1);
      const label = options.label || '';
      ctx.save();
      ctx.fillStyle = 'rgba(12, 8, 5, 0.82)';
      ctx.strokeStyle = 'rgba(201, 161, 74, 0.42)';
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.roundRect?.(x, y, width, height, height / 2);
      if (!ctx.roundRect) ctx.rect(x, y, width, height);
      ctx.fill();
      ctx.stroke();

      const fillWidth = Math.max(0, width * fillRatio);
      if (fillWidth > 0.5) {
        const gradient = ctx.createLinearGradient(x, y, x + width, y);
        gradient.addColorStop(0, options.fillA || '#b98925');
        gradient.addColorStop(1, options.fillB || '#f1c34a');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect?.(x + 1.5, y + 1.5, Math.max(0, fillWidth - 3), Math.max(1, height - 3), Math.max(1, (height - 3) / 2));
        if (!ctx.roundRect) ctx.rect(x + 1.5, y + 1.5, Math.max(0, fillWidth - 3), Math.max(1, height - 3));
        ctx.fill();

        ctx.fillStyle = 'rgba(255,255,255,0.20)';
        ctx.beginPath();
        ctx.roundRect?.(x + 3, y + 2, Math.max(0, fillWidth - 8), Math.max(1, height * 0.28), height / 4);
        if (!ctx.roundRect) ctx.rect(x + 3, y + 2, Math.max(0, fillWidth - 8), Math.max(1, height * 0.28));
        ctx.fill();
      }

      if (label) {
        ctx.font = '900 9px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(241, 231, 207, 0.95)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x + 7, y + height / 2 + 0.5);
      }
      ctx.restore();
    }

    drawHudChip(ctx, x, y, text, color, width = 64) {
      ctx.save();
      ctx.fillStyle = 'rgba(35, 24, 14, 0.72)';
      ctx.strokeStyle = 'rgba(201, 161, 74, 0.42)';
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.roundRect?.(x, y, width, 24, 12);
      if (!ctx.roundRect) ctx.rect(x, y, width, 24);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '900 10px system-ui, sans-serif';
      ctx.fillStyle = color;
      ctx.fillText(text, x + width / 2, y + 12.5);
      ctx.restore();
    }

    drawBar(ctx, x, y, width, height, ratio, color, label) {
      this.drawGuildBar(ctx, x, y, width, height, ratio, {
        label,
        fillA: color,
        fillB: color,
      });
    }

    drawPausedText(ctx) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = '900 18px system-ui, sans-serif';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      const w = BH.CONFIG.canvas.width;
      const h = BH.CONFIG.canvas.height;
      ctx.strokeText('PAUSE', w / 2, h * 0.22);
      ctx.fillText('PAUSE', w / 2, h * 0.22);
      ctx.restore();
    }

    drawMenuBackdropText(ctx) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = '900 18px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText('クエストを選んで狩猟開始', BH.CONFIG.canvas.width / 2, BH.CONFIG.canvas.height - 34);
      ctx.restore();
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    window.BH_GAME = new Game();
  });
})();
