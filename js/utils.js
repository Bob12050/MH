(() => {
  'use strict';

  window.BH = window.BH || {};

  BH.clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  BH.lerp = (a, b, t) => a + (b - a) * t;
  BH.rand = (min, max) => min + Math.random() * (max - min);
  BH.randInt = (min, max) => Math.floor(BH.rand(min, max + 1));
  BH.dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  BH.angleTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);

  BH.normalize = (x, y) => {
    const len = Math.hypot(x, y);
    if (len < 0.0001) return { x: 0, y: 0 };
    return { x: x / len, y: y / len };
  };

  BH.circleHit = (a, ar, b, br) => Math.hypot(a.x - b.x, a.y - b.y) <= ar + br;

  BH.pointLineDistance = (p, a, b) => {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const apx = p.x - a.x;
    const apy = p.y - a.y;
    const ab2 = abx * abx + aby * aby;
    const t = ab2 <= 0 ? 0 : BH.clamp((apx * abx + apy * aby) / ab2, 0, 1);
    const x = a.x + abx * t;
    const y = a.y + aby * t;
    return Math.hypot(p.x - x, p.y - y);
  };

  BH.formatTime = (seconds) => {
    const s = Math.max(0, seconds);
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  BH.escapeHtml = (value) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  BH.materialName = (materialId) => BH.DATA.materials[materialId]?.name || materialId;

  BH.materialIcon = (materialId) => BH.DATA.materials[materialId]?.icon || '◆';

  BH.materialChip = (materialId, count = null) => {
    const material = BH.DATA.materials[materialId] || { name: materialId, rarity: 1, icon: '◆' };
    const suffix = count === null ? '' : ` ×${count}`;
    return `<span class="material-chip rarity-${material.rarity || 1}"><span class="material-icon">${BH.escapeHtml(material.icon || '◆')}</span>${BH.escapeHtml(material.name)}${suffix}</span>`;
  };

  BH.getQuestById = (questId) => BH.DATA.quests.find((quest) => quest.id === questId) || BH.DATA.quests[0];

  BH.getWeaponLevelData = (level) => {
    const levels = BH.DATA.weapon.levels;
    return levels.find((item) => item.level === level) || levels[0];
  };

  BH.getNextWeaponLevelData = (level) => BH.DATA.weapon.levels.find((item) => item.level === level + 1) || null;

  BH.getArmorLevelData = (level) => {
    const levels = BH.DATA.armor.levels;
    return levels.find((item) => item.level === level) || levels[0];
  };

  BH.getNextArmorLevelData = (level) => BH.DATA.armor.levels.find((item) => item.level === level + 1) || null;
})();
