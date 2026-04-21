import { GameService } from '../game.service';

export function getFloorData(...args: Parameters<typeof GameService.getFloorData>): ReturnType<typeof GameService.getFloorData> {
  return GameService.getFloorData(...args);
}

export function generateEnemy(...args: Parameters<typeof GameService.generateEnemy>): ReturnType<typeof GameService.generateEnemy> {
  return GameService.generateEnemy(...args);
}

export function advanceToNextFloor(...args: Parameters<typeof GameService.advanceToNextFloor>): ReturnType<typeof GameService.advanceToNextFloor> {
  return GameService.advanceToNextFloor(...args);
}

export function calculateFloorRewards(...args: Parameters<typeof GameService.calculateFloorRewards>): ReturnType<typeof GameService.calculateFloorRewards> {
  return GameService.calculateFloorRewards(...args);
}

export function clearAllCaches(): ReturnType<typeof GameService.clearAllCaches> {
  return GameService.clearAllCaches();
}
