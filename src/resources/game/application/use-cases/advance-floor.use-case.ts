import { AdminGamePort } from '../ports/admin-game.port';

export class AdvanceFloorUseCase {
  constructor(private readonly adminGamePort: AdminGamePort) {}

  async execute(input: { characterId: string; newFloor: number }) {
    await this.adminGamePort.secureAdvanceFloor(input);
  }
}
