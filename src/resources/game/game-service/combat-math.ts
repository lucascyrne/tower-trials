import { GameService } from '../game.service';

export function calculateDamage(...args: Parameters<typeof GameService.calculateDamage>): ReturnType<typeof GameService.calculateDamage> {
  return GameService.calculateDamage(...args);
}

export function calculateInitiative(...args: Parameters<typeof GameService.calculateInitiative>): ReturnType<typeof GameService.calculateInitiative> {
  return GameService.calculateInitiative(...args);
}

export function calculateTurnOrder(...args: Parameters<typeof GameService.calculateTurnOrder>): ReturnType<typeof GameService.calculateTurnOrder> {
  return GameService.calculateTurnOrder(...args);
}

export function advanceTurnOrder(...args: Parameters<typeof GameService.advanceTurnOrder>): ReturnType<typeof GameService.advanceTurnOrder> {
  return GameService.advanceTurnOrder(...args);
}

export function compareSpeed(...args: Parameters<typeof GameService.compareSpeed>): ReturnType<typeof GameService.compareSpeed> {
  return GameService.compareSpeed(...args);
}
