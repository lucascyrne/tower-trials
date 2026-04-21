export interface SecureGrantXpInput {
  characterId: string;
  xpAmount: number;
  source?: string;
}

export interface SecureGrantGoldInput {
  characterId: string;
  goldAmount: number;
  source?: string;
}

export interface SecureAdvanceFloorInput {
  characterId: string;
  newFloor: number;
}

export interface ProcessCombatDropsInput {
  characterId: string;
  drops: { drop_id: string; quantity: number }[];
}

export interface ConsumePotionSlotInput {
  characterId: string;
  slotPosition: number;
}

export interface AdminGamePort {
  secureGrantXp(input: SecureGrantXpInput): Promise<unknown>;
  secureGrantGold(input: SecureGrantGoldInput): Promise<number>;
  secureAdvanceFloor(input: SecureAdvanceFloorInput): Promise<void>;
  processCombatDrops(input: ProcessCombatDropsInput): Promise<number>;
  consumePotionFromSlot(input: ConsumePotionSlotInput): Promise<unknown>;
}
