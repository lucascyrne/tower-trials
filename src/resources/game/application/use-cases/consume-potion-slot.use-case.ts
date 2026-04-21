import { AdminGamePort } from '../ports/admin-game.port';

export class ConsumePotionSlotUseCase {
  constructor(private readonly adminGamePort: AdminGamePort) {}

  async execute(input: { characterId: string; slotPosition: number }) {
    return this.adminGamePort.consumePotionFromSlot(input);
  }
}
