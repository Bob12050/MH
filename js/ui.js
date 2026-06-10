(() => {
  'use strict';

  window.BH = window.BH || {};

  BH.UI = class UI {
    constructor(game) {
      this.game = game;
      this.screenHost = document.getElementById('screenHost');
      this.huntView = document.getElementById('huntView');
      this.mobileControls = document.getElementById('mobileControls');
      this.title = document.getElementById('screenTitle');
      this.body = document.getElementById('screenBody');
      this.actions = document.getElementById('screenActions');
      this.pauseOverlay = document.getElementById('pauseOverlay');
      this.pauseQuestText = document.getElementById('pauseQuestText');
      document.getElementById('versionBadge').textContent = `v${BH.VERSION}`;
      this.bindActions();
    }

    bindActions() {
      document.addEventListener('click', (event) => {
        const button = event.target.closest('[data-ui]');
        if (!button) return;
        const action = button.dataset.ui;
        const { questId } = button.dataset;

        if (action === 'menu') this.game.showMenu();
        if (action === 'quest-select') this.game.showQuestSelect();
        if (action === 'forge') this.game.showForge();
        if (action === 'inventory') this.game.showInventory();
        if (action === 'start-quest') this.game.startQuest(questId);
        if (action === 'retry') this.game.startQuest(this.game.currentQuest?.id || BH.DATA.quests[0].id);
        if (action === 'upgrade') this.game.tryUpgradeWeapon();
        if (action === 'upgrade-armor') this.game.tryUpgradeArmor();
        if (action === 'reset-save') this.game.resetSave();
        if (action === 'toggle-pause') this.game.togglePause();
        if (action === 'resume') this.game.resumeQuest();
        if (action === 'abandon') this.game.abandonQuest();
      });
    }

    setActiveNav(actionName) {
      document.querySelectorAll('.main-nav [data-ui]').forEach((button) => {
        button.classList.toggle('is-active', button.dataset.ui === actionName);
      });
    }

    showScreen(title, bodyHtml, actionsHtml = '', activeNav = '') {
      document.body.dataset.mode = 'screen';
      this.screenHost.classList.remove('is-hidden');
      this.huntView.classList.add('is-hidden');
      this.mobileControls.classList.add('is-hidden');
      this.hidePauseMenu();
      this.title.textContent = title;
      this.body.innerHTML = bodyHtml;
      this.actions.innerHTML = actionsHtml;
      this.setActiveNav(activeNav);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    showHunt() {
      document.body.dataset.mode = 'hunt';
      this.screenHost.classList.add('is-hidden');
      this.huntView.classList.remove('is-hidden');
      this.mobileControls.classList.remove('is-hidden');
      this.hidePauseMenu();
      this.setActiveNav('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    monsterIcon(monster) {
      if (monster.shape === 'shell') return '🪨';
      if (monster.shape === 'lizard') return '🦎';
      return '🐺';
    }

    equipmentSummaryHtml() {
      const weapon = BH.Storage.getCurrentWeapon();
      const armor = BH.Storage.getCurrentArmor();
      return `
        <div class="equipment-summary">
          <article class="stat-card">
            <h3>武器</h3>
            <strong>攻撃 ${weapon.attackDamage}</strong>
            <p class="card-meta">${BH.escapeHtml(weapon.name)} / Lv.${weapon.level}</p>
          </article>
          <article class="stat-card">
            <h3>防具</h3>
            <strong>HP+${armor.hpBonus}</strong>
            <p class="card-meta">${BH.escapeHtml(armor.name)} / 防御 ${armor.defense} / 回復薬+${armor.potionBonus}</p>
          </article>
        </div>
      `;
    }

    homeHtml() {
      const save = BH.Storage.load();
      const totalHunts = Object.values(save.hunts).reduce((sum, count) => sum + Number(count || 0), 0);
      const ownedMaterials = Object.values(save.inventory).reduce((sum, count) => sum + Number(count || 0), 0);
      return `
        <p>左下スティックで移動、タップで攻撃、フリックで回避、長押しで回復。ロックオンは常時オートです。</p>
        ${this.equipmentSummaryHtml()}
        <div class="home-grid">
          <article class="guide-card">
            <h3>1. クエスト</h3>
            <p class="card-text">大型モンスターを選んで狩猟開始。敵HPが半分以下になると怒り状態になります。</p>
          </article>
          <article class="guide-card">
            <h3>2. 操作</h3>
            <p class="card-text">左下スティックで移動。タップ＝攻撃（連打で3段コンボ）、フリック＝回避、長押し＝回復。ロックは自動です。</p>
          </article>
          <article class="guide-card">
            <h3>3. 回避</h3>
            <p class="card-text">敵の攻撃に合わせて回避するとジャスト回避。次の攻撃が強くなります。</p>
          </article>
        </div>
        <div class="guide-grid">
          <article class="stat-card"><h3>総討伐数</h3><strong>${totalHunts}</strong><p class="card-meta">全クエスト合計</p></article>
          <article class="stat-card"><h3>所持素材数</h3><strong>${ownedMaterials}</strong><p class="card-meta">全素材合計</p></article>
        </div>
      `;
    }

    questCardsHtml() {
      return `<div class="quest-grid">${BH.DATA.quests.map((quest) => {
        const monster = BH.DATA.monsters[quest.monsterId];
        const best = BH.Storage.getBestTime(quest.id);
        const hunts = BH.Storage.getHuntCount(monster.id);
        const rewards = quest.rewardTable.slice(0, 4).map((row) => BH.materialChip(row.materialId)).join(' ');
        return `
          <article class="quest-card">
            <div class="quest-head">
              <div class="monster-icon" aria-hidden="true">${this.monsterIcon(monster)}</div>
              <div>
                <h3>${BH.escapeHtml(quest.name)}</h3>
                <p class="card-meta">${BH.escapeHtml(monster.name)} / ${BH.escapeHtml(monster.species)} / 難度★${monster.difficulty}</p>
              </div>
            </div>
            <p class="card-text">${BH.escapeHtml(quest.recommendation)}</p>
            <ul class="menu-list">
              <li>制限時間：${BH.formatTime(quest.timeLimit)}</li>
              <li>討伐数：${hunts}</li>
              <li>Best：${best ? BH.formatTime(best) : '--:--'}</li>
            </ul>
            <div class="source-list">${rewards}</div>
            <button class="primary-button" data-ui="start-quest" data-quest-id="${quest.id}" type="button">このクエストを受注</button>
          </article>
        `;
      }).join('')}</div>`;
    }

    costListHtml(cost) {
      return Object.entries(cost || {}).map(([materialId, needed]) => {
        const owned = BH.Storage.getMaterialCount(materialId);
        const cls = owned >= needed ? 'material-ok' : 'material-ng';
        return `<li class="material-row ${cls}"><span>${BH.materialChip(materialId)}</span><strong>${owned}/${needed}</strong></li>`;
      }).join('');
    }

    forgeHtml() {
      const weapon = BH.Storage.getCurrentWeapon();
      const armor = BH.Storage.getCurrentArmor();
      const nextWeapon = BH.getNextWeaponLevelData(weapon.level);
      const nextArmor = BH.getNextArmorLevelData(armor.level);
      const weaponCan = nextWeapon ? BH.Storage.canAfford(nextWeapon.upgradeCost) : false;
      const armorCan = nextArmor ? BH.Storage.canAfford(nextArmor.upgradeCost) : false;

      const weaponHtml = nextWeapon ? `
        <article class="forge-card">
          <h3>武器強化</h3>
          <p class="card-meta">現在：${BH.escapeHtml(weapon.name)} / 攻撃 ${weapon.attackDamage} / リーチ ${weapon.reach}</p>
          <p class="card-meta">次：${BH.escapeHtml(nextWeapon.name)} / 攻撃 ${nextWeapon.attackDamage} / リーチ ${nextWeapon.reach}</p>
          <ul class="cost-list">${this.costListHtml(nextWeapon.upgradeCost)}</ul>
          <button class="primary-button ${weaponCan ? '' : 'is-disabled'}" data-ui="upgrade" ${weaponCan ? '' : 'disabled'} type="button">武器を強化する</button>
        </article>
      ` : `
        <article class="forge-card">
          <h3>武器強化</h3>
          <p class="card-meta">${BH.escapeHtml(weapon.name)} / 攻撃 ${weapon.attackDamage}。現在のバージョンでは最大強化です。</p>
        </article>
      `;

      const armorHtml = nextArmor ? `
        <article class="forge-card">
          <h3>防具強化</h3>
          <p class="card-meta">現在：${BH.escapeHtml(armor.name)} / 防御 ${armor.defense} / HP+${armor.hpBonus}</p>
          <p class="card-meta">次：${BH.escapeHtml(nextArmor.name)} / 防御 ${nextArmor.defense} / HP+${nextArmor.hpBonus} / 回復薬+${nextArmor.potionBonus}</p>
          <ul class="cost-list">${this.costListHtml(nextArmor.upgradeCost)}</ul>
          <button class="primary-button ${armorCan ? '' : 'is-disabled'}" data-ui="upgrade-armor" ${armorCan ? '' : 'disabled'} type="button">防具を強化する</button>
        </article>
      ` : `
        <article class="forge-card">
          <h3>防具強化</h3>
          <p class="card-meta">${BH.escapeHtml(armor.name)} / 防御 ${armor.defense} / HP+${armor.hpBonus}。現在のバージョンでは最大強化です。</p>
        </article>
      `;

      return `
        ${this.equipmentSummaryHtml()}
        <div class="forge-grid">
          ${weaponHtml}
          ${armorHtml}
        </div>
        <div class="guide-grid">
          <article class="guide-card"><h3>武器優先の目安</h3><p class="card-text">討伐時間が長い、敵HPを削りきれない場合は武器を強化。</p></article>
          <article class="guide-card"><h3>防具優先の目安</h3><p class="card-text">毒沼や突進で倒されやすい場合は防具を強化。</p></article>
        </div>
      `;
    }

    materialSourcesHtml(materialId) {
      const quests = BH.DATA.quests
        .filter((quest) => quest.rewardTable.some((row) => row.materialId === materialId))
        .map((quest) => quest.shortName || quest.name);
      return quests.length ? quests.map((name) => BH.escapeHtml(name)).join(' / ') : '未設定';
    }

    inventoryHtml() {
      const inventory = BH.Storage.getInventory();
      const entries = Object.entries(BH.DATA.materials)
        .map(([id, material]) => ({ id, material, count: Number(inventory[id] || 0) }))
        .sort((a, b) => b.material.rarity - a.material.rarity || a.material.name.localeCompare(b.material.name, 'ja'));

      return `
        <p>素材は専用画面に分離しました。強化画面で足りない素材があったら、ここで入手先を確認してください。</p>
        <div class="material-grid">
          ${entries.map((entry) => `
            <article class="material-card">
              <h3>${BH.materialChip(entry.id, entry.count)}</h3>
              <p class="card-meta">レア度：★${entry.material.rarity || 1}</p>
              <p class="card-meta">入手先：${this.materialSourcesHtml(entry.id)}</p>
            </article>
          `).join('')}
        </div>
      `;
    }

    updatePauseInfo() {
      const quest = this.game.currentQuest;
      const monster = this.game.monster;
      if (!this.pauseQuestText) return;
      const questName = quest ? quest.name : 'クエスト中';
      const monsterName = monster ? monster.name : '大型モンスター';
      this.pauseQuestText.textContent = `${questName} / ${monsterName}`;
    }

    showPauseMenu() {
      this.updatePauseInfo();
      this.pauseOverlay?.classList.remove('is-hidden');
    }

    hidePauseMenu() {
      this.pauseOverlay?.classList.add('is-hidden');
    }

    renderHuntPanel() {
      this.updatePauseInfo();
    }
  };
})();
