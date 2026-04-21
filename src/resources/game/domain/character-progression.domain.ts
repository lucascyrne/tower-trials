import { Character } from '../models/character.model';

export interface CharacterDerivedStats {
  hp: number;
  max_hp: number;
  mana: number;
  max_mana: number;
  atk: number;
  magic_attack: number;
  def: number;
  speed: number;
  critical_chance: number;
  critical_damage: number;
  magic_damage_bonus: number;
  double_attack_chance: number;
}

export interface EquipmentDerivedBonus {
  hp: number;
  mana: number;
  atk: number;
  def: number;
  speed: number;
  critical_chance: number;
  critical_damage: number;
  magic_damage: number;
  double_attack_chance: number;
}

interface CoreAttributes {
  strength: number;
  dexterity: number;
  intelligence: number;
  wisdom: number;
  vitality: number;
  luck: number;
}

interface DerivedScalings {
  strScaling: number;
  dexScaling: number;
  intScaling: number;
  wisScaling: number;
  vitScaling: number;
  luckScaling: number;
  weaponMasteryBonus: number;
  defMasteryBonus: number;
  magicMasteryBonus: number;
}

function getCoreAttributes(character: Character): CoreAttributes {
  return {
    strength: character.strength || 10,
    dexterity: character.dexterity || 10,
    intelligence: character.intelligence || 10,
    wisdom: character.wisdom || 10,
    vitality: character.vitality || 10,
    luck: character.luck || 10,
  };
}

function calculateScalings(character: Character): DerivedScalings {
  const core = getCoreAttributes(character);

  const strScaling = Math.pow(core.strength, 1.2);
  const dexScaling = Math.pow(core.dexterity, 1.15);
  const intScaling = Math.pow(core.intelligence, 1.25);
  const wisScaling = Math.pow(core.wisdom, 1.1);
  const vitScaling = Math.pow(core.vitality, 1.3);
  const luckScaling = core.luck;

  const swordMastery = character.sword_mastery || 1;
  const axeMastery = character.axe_mastery || 1;
  const bluntMastery = character.blunt_mastery || 1;
  const defenseMastery = character.defense_mastery || 1;
  const magicMastery = character.magic_mastery || 1;

  return {
    strScaling,
    dexScaling,
    intScaling,
    wisScaling,
    vitScaling,
    luckScaling,
    weaponMasteryBonus: Math.pow(Math.max(swordMastery, axeMastery, bluntMastery), 1.1),
    defMasteryBonus: Math.pow(defenseMastery, 1.2),
    magicMasteryBonus: Math.pow(magicMastery, 1.15),
  };
}

/** Estimativa local para UI / ferramentas; combate usa stats persistidos (Postgres). */
export function calculateCharacterDerivedStats(
  character: Character,
  equipmentBonus: EquipmentDerivedBonus
): CharacterDerivedStats {
  const level = character.level;
  const scalings = calculateScalings(character);

  const baseHp = 50 + level * 2;
  const baseMana = 20 + level;
  const baseAtk = 2 + level;
  const baseDef = 1 + level;
  const baseSpeed = 3 + level;

  const hp = Math.floor(baseHp + scalings.vitScaling * 3.5 + equipmentBonus.hp);
  const mana = Math.floor(
    baseMana + (scalings.intScaling + scalings.wisScaling) * 1.5 + equipmentBonus.mana
  );
  const atk = Math.floor(
    baseAtk + scalings.strScaling * 2.2 + scalings.weaponMasteryBonus + equipmentBonus.atk
  );
  const magic_attack = Math.floor(
    scalings.intScaling * 1.8 + scalings.magicMasteryBonus + equipmentBonus.magic_damage
  );
  const def = Math.floor(
    baseDef + scalings.dexScaling * 1.5 + scalings.defMasteryBonus + equipmentBonus.def
  );
  const speed = Math.floor(baseSpeed + scalings.dexScaling * 1.8 + equipmentBonus.speed);
  const critical_chance = Math.min(
    95,
    Math.floor(
      5 +
        scalings.dexScaling * 0.3 +
        scalings.luckScaling * 0.5 +
        scalings.weaponMasteryBonus * 0.2 +
        equipmentBonus.critical_chance
    )
  );
  const critical_damage = Math.floor(
    150 +
      scalings.strScaling * 0.8 +
      scalings.weaponMasteryBonus * 1.2 +
      equipmentBonus.critical_damage
  );
  const magic_damage_bonus = Math.floor(
    scalings.intScaling * 1.2 +
      scalings.magicMasteryBonus * 1.5 +
      equipmentBonus.magic_damage
  );
  const double_attack_chance = Math.min(
    25,
    Math.floor(
      scalings.dexScaling * 0.2 +
        scalings.luckScaling * 0.3 +
        equipmentBonus.double_attack_chance
    )
  );

  return {
    hp,
    max_hp: hp,
    mana,
    max_mana: mana,
    atk,
    magic_attack,
    def,
    speed,
    critical_chance,
    critical_damage,
    magic_damage_bonus,
    double_attack_chance,
  };
}
