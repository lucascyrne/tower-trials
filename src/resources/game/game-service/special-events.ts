import { GameService } from '../game.service';

export function processSpecialEventInteraction(
  ...args: Parameters<typeof GameService.processSpecialEventInteraction>
): ReturnType<typeof GameService.processSpecialEventInteraction> {
  return GameService.processSpecialEventInteraction(...args);
}
