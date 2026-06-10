(() => {
  'use strict';

  window.BH = window.BH || {};
  BH.DATA = BH.DATA || {};

  BH.DATA.armor = {
    id: 'hunter_armor',
    baseName: '狩人防具',
    levels: [
      {
        level: 1,
        name: '布の狩衣 I',
        defense: 0,
        hpBonus: 0,
        potionBonus: 0,
        upgradeCost: null,
      },
      {
        level: 2,
        name: '革の狩衣 II',
        defense: 2,
        hpBonus: 12,
        potionBonus: 0,
        upgradeCost: { supple_hide: 3, forest_fang: 2 },
      },
      {
        level: 3,
        name: '岩革の鎧 I',
        defense: 4,
        hpBonus: 24,
        potionBonus: 1,
        upgradeCost: { stone_shell: 3, heavy_bone: 2, beast_claw: 1 },
      },
      {
        level: 4,
        name: '毒沼耐性の鎧 II',
        defense: 6,
        hpBonus: 36,
        potionBonus: 1,
        upgradeCost: { venom_sac: 3, slick_scale: 3, crystal_horn: 1 },
      },
      {
        level: 5,
        name: '討伐装束・暁',
        defense: 9,
        hpBonus: 50,
        potionBonus: 2,
        upgradeCost: { green_core: 1, earth_core: 1, toxic_gem: 1, swamp_claw: 2 },
      },
    ],
  };
})();
