import { GameService } from '../game.service';

export function processPlayerAction(...args: Parameters<typeof GameService.processPlayerAction>): ReturnType<typeof GameService.processPlayerAction> {
  return GameService.processPlayerAction(...args);
}
