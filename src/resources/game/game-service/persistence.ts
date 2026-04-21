import { GameService } from '../game.service';

export function saveGameProgress(...args: Parameters<typeof GameService.saveGameProgress>): ReturnType<typeof GameService.saveGameProgress> {
  return GameService.saveGameProgress(...args);
}

export function loadGameProgress(...args: Parameters<typeof GameService.loadGameProgress>): ReturnType<typeof GameService.loadGameProgress> {
  return GameService.loadGameProgress(...args);
}

export function loadPlayerForGame(...args: Parameters<typeof GameService.loadPlayerForGame>): ReturnType<typeof GameService.loadPlayerForGame> {
  return GameService.loadPlayerForGame(...args);
}
