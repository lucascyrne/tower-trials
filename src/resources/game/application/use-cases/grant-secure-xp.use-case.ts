import { AdminGamePort } from '../ports/admin-game.port';

export class GrantSecureXpUseCase {
  constructor(private readonly adminGamePort: AdminGamePort) {}

  async execute(input: {
    characterId: string;
    xpAmount: number;
    source?: string;
  }) {
    return this.adminGamePort.secureGrantXp(input);
  }
}
