import { GameService } from '../game.service';

export function processEnemyDefeat(...args: Parameters<typeof GameService.processEnemyDefeat>): ReturnType<typeof GameService.processEnemyDefeat> {
  return GameService.processEnemyDefeat(...args);
}

export function processEnemyAction(...args: Parameters<typeof GameService.processEnemyAction>): ReturnType<typeof GameService.processEnemyAction> {
  return GameService.processEnemyAction(...args);
}

export function processEnemyActionWithDelay(...args: Parameters<typeof GameService.processEnemyActionWithDelay>): ReturnType<typeof GameService.processEnemyActionWithDelay> {
  return GameService.processEnemyActionWithDelay(...args);
}
