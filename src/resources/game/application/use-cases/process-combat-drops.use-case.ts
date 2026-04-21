import { AdminGamePort } from '../ports/admin-game.port';

export class ProcessCombatDropsUseCase {
  constructor(private readonly adminGamePort: AdminGamePort) {}

  async execute(input: {
    characterId: string;
    drops: { drop_id: string; quantity: number }[];
  }) {
    return this.adminGamePort.processCombatDrops(input);
  }
}
