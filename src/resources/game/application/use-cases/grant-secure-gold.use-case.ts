import { AdminGamePort } from '../ports/admin-game.port';

export class GrantSecureGoldUseCase {
  constructor(private readonly adminGamePort: AdminGamePort) {}

  async execute(input: {
    characterId: string;
    goldAmount: number;
    source?: string;
  }) {
    return this.adminGamePort.secureGrantGold(input);
  }
}
