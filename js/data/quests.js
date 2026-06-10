(() => {
  'use strict';

  window.BH = window.BH || {};
  BH.DATA = BH.DATA || {};

  BH.DATA.quests = [
    {
      id: 'forest_fang_hunt',
      name: '森の暴れ牙',
      shortName: '森の牙獣',
      monsterId: 'garfang',
      biome: 'forest',
      timeLimit: 180,
      recommendation: 'まずはここ。突進の予兆を見て横に回避。',
      rewardTable: [
        { materialId: 'forest_fang', chance: 0.95, min: 1, max: 2 },
        { materialId: 'supple_hide', chance: 0.82, min: 1, max: 2 },
        { materialId: 'beast_claw', chance: 0.42, min: 1, max: 1 },
        { materialId: 'green_core', chance: 0.12, min: 1, max: 1 },
      ],
    },
    {
      id: 'rock_shell_hunt',
      name: '岩場の重甲殻',
      shortName: '岩の甲殻竜',
      monsterId: 'rockbald',
      biome: 'rock',
      timeLimit: 210,
      recommendation: '硬くて遅い。大技後のスキを狙う。',
      rewardTable: [
        { materialId: 'stone_shell', chance: 0.95, min: 1, max: 2 },
        { materialId: 'heavy_bone', chance: 0.75, min: 1, max: 2 },
        { materialId: 'crystal_horn', chance: 0.36, min: 1, max: 1 },
        { materialId: 'earth_core', chance: 0.10, min: 1, max: 1 },
      ],
    },
    {
      id: 'swamp_venom_hunt',
      name: '毒沼に潜む影',
      shortName: '毒沼トカゲ',
      monsterId: 'venomia',
      biome: 'swamp',
      timeLimit: 210,
      recommendation: '毒沼を踏み続けると危険。位置取り重視。',
      rewardTable: [
        { materialId: 'venom_sac', chance: 0.92, min: 1, max: 2 },
        { materialId: 'slick_scale', chance: 0.82, min: 1, max: 2 },
        { materialId: 'swamp_claw', chance: 0.34, min: 1, max: 1 },
        { materialId: 'toxic_gem', chance: 0.09, min: 1, max: 1 },
      ],
    },
  ];
})();
