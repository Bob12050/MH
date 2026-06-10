(() => {
  'use strict';

  window.BH = window.BH || {};

  const defaultSave = () => ({
    version: BH.SAVE_VERSION,
    weaponLevel: 1,
    armorLevel: 1,
    inventory: {},
    bestTimes: {},
    hunts: {},
  });

  const normalizeSave = (save) => {
    const normalized = defaultSave();
    if (!save || typeof save !== 'object') return normalized;
    normalized.version = BH.SAVE_VERSION;
    normalized.weaponLevel = BH.clamp(Number(save.weaponLevel || 1), 1, BH.DATA.weapon.levels.length);
    normalized.armorLevel = BH.clamp(Number(save.armorLevel || 1), 1, BH.DATA.armor.levels.length);
    normalized.inventory = save.inventory && typeof save.inventory === 'object' ? { ...save.inventory } : {};
    normalized.bestTimes = save.bestTimes && typeof save.bestTimes === 'object' ? { ...save.bestTimes } : {};
    normalized.hunts = save.hunts && typeof save.hunts === 'object' ? { ...save.hunts } : {};
    return normalized;
  };

  BH.Storage = {
    load() {
      try {
        const raw = localStorage.getItem(BH.STORAGE_KEY);
        return normalizeSave(raw ? JSON.parse(raw) : null);
      } catch (_error) {
        return defaultSave();
      }
    },

    save(data) {
      try {
        localStorage.setItem(BH.STORAGE_KEY, JSON.stringify(normalizeSave(data)));
        return true;
      } catch (_error) {
        return false;
      }
    },

    reset() {
      const save = defaultSave();
      this.save(save);
      return save;
    },

    getWeaponLevel() {
      return this.load().weaponLevel;
    },

    setWeaponLevel(level) {
      const save = this.load();
      save.weaponLevel = BH.clamp(level, 1, BH.DATA.weapon.levels.length);
      this.save(save);
      return save.weaponLevel;
    },

    getCurrentWeapon() {
      return BH.getWeaponLevelData(this.getWeaponLevel());
    },

    getArmorLevel() {
      return this.load().armorLevel;
    },

    setArmorLevel(level) {
      const save = this.load();
      save.armorLevel = BH.clamp(level, 1, BH.DATA.armor.levels.length);
      this.save(save);
      return save.armorLevel;
    },

    getCurrentArmor() {
      return BH.getArmorLevelData(this.getArmorLevel());
    },

    getInventory() {
      return this.load().inventory;
    },

    getMaterialCount(materialId) {
      const value = this.load().inventory[materialId] || 0;
      return Number.isFinite(Number(value)) ? Number(value) : 0;
    },

    addMaterials(rewards) {
      const save = this.load();
      for (const reward of rewards) {
        save.inventory[reward.materialId] = (save.inventory[reward.materialId] || 0) + reward.count;
      }
      this.save(save);
      return save;
    },

    canAfford(cost) {
      if (!cost) return true;
      const inventory = this.getInventory();
      return Object.entries(cost).every(([materialId, needed]) => (inventory[materialId] || 0) >= needed);
    },

    spendMaterials(cost) {
      if (!this.canAfford(cost)) return false;
      const save = this.load();
      for (const [materialId, needed] of Object.entries(cost || {})) {
        save.inventory[materialId] = Math.max(0, (save.inventory[materialId] || 0) - needed);
      }
      this.save(save);
      return true;
    },

    setBestTimeIfBetter(questId, seconds) {
      const save = this.load();
      const current = Number(save.bestTimes[questId] || 0);
      if (!current || seconds < current) {
        save.bestTimes[questId] = seconds;
        this.save(save);
        return true;
      }
      return false;
    },

    getBestTime(questId) {
      const value = Number(this.load().bestTimes[questId] || 0);
      return Number.isFinite(value) ? value : 0;
    },

    incrementHunt(monsterId) {
      const save = this.load();
      save.hunts[monsterId] = (save.hunts[monsterId] || 0) + 1;
      this.save(save);
      return save.hunts[monsterId];
    },

    getHuntCount(monsterId) {
      const value = Number(this.load().hunts[monsterId] || 0);
      return Number.isFinite(value) ? value : 0;
    },
  };
})();
