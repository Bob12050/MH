(() => {
  'use strict';

  window.BH = window.BH || {};

  BH.VERSION = '0.7.2';
  BH.SAVE_VERSION = 4;
  BH.STORAGE_KEY = 'beast_hunt_mini_save_v2';

  BH.CONFIG = {
    canvas: {
      width: 390,
      height: 844,
      safeMargin: 24,
    },
    player: {
      x: 195,
      y: 650,
      radius: 17,
      maxHp: 120,
      maxStamina: 100,
      moveSpeed: 184,
      rollSpeed: 420,
      rollDuration: 0.28,
      rollCost: 28,
      invulnerableAfterHit: 0.9,
      potionHeal: 48,
      potionCount: 3,
      staminaRegen: 34,
    },
    tuning: {
      hitStop: 0.045,
      comboResetTime: 0.58,
      justEvadeWindow: 0.22,
      justEvadeStaminaBonus: 16,
      justEvadeAttackBonus: 1.22,
      justEvadeBonusDuration: 2.1,
      enragedHpRatio: 0.5,
      enragedSpeedBonus: 1.14,
      enragedTelegraphMultiplier: 0.78,
      enragedCooldownMultiplier: 0.78,
      enragedDamageMultiplier: 1.10,
      cameraShakeDecay: 6.8,
      screenFlashDecay: 5.5,
      recoveryDamageBonus: 1.35,
      poisonTickInterval: 0.6,
    },
  };
})();
