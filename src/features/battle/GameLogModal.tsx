import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { GameLog } from './GameLog';

interface GameLogEntry {
  text: string;
  type:
    | 'system'
    | 'battle'
    | 'lore'
    | 'skill_xp'
    | 'level_up'
    | 'equipment'
    | 'enemy_action'
    | 'player_action'
    | 'damage'
    | 'healing';
}

interface GameLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameLogs: GameLogEntry[];
}

export function GameLogModal({ isOpen, onClose, gameLogs }: GameLogModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            💬 Log de Batalha
            <span className="text-sm text-muted-foreground">
              ({gameLogs.length} evento{gameLogs.length !== 1 ? 's' : ''})
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto min-h-0">
          <GameLog gameLog={gameLogs} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
