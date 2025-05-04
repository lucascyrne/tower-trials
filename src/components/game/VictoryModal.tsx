import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Coins, Star, Trophy } from 'lucide-react';

interface VictoryModalProps {
  isOpen: boolean;
  onContinue: () => void;
  onReturnToHub: () => void;
  rewards: {
    xp: number;
    gold: number;
    drops: { name: string; quantity: number }[];
  };
  leveledUp: boolean;
  newLevel?: number;
}

export function VictoryModal({
  isOpen,
  onContinue,
  onReturnToHub,
  rewards,
  leveledUp,
  newLevel
}: VictoryModalProps) {
  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Trophy className="h-6 w-6 text-yellow-500" />
            Vitória!
          </DialogTitle>
          <DialogDescription>
            Você derrotou o inimigo e recebeu recompensas!
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-center gap-2 text-lg">
            <Star className="h-5 w-5 text-yellow-500" />
            <span>XP: +{rewards.xp}</span>
          </div>
          <div className="flex items-center gap-2 text-lg">
            <Coins className="h-5 w-5 text-yellow-400" />
            <span>Gold: +{rewards.gold}</span>
          </div>
          {leveledUp && newLevel && (
            <div className="mt-2 rounded-md bg-primary/20 p-2 text-center">
              🎉 Subiu para o nível {newLevel}!
            </div>
          )}
          {rewards.drops.length > 0 && (
            <div className="mt-4">
              <h4 className="mb-2 font-medium">Drops obtidos:</h4>
              <ul className="space-y-1">
                {rewards.drops.map((drop, index) => (
                  <li key={index} className="text-sm">
                    • {drop.name} x{drop.quantity}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <DialogFooter className="flex gap-2">
          <Button onClick={onReturnToHub} variant="outline">
            Voltar ao Hub
          </Button>
          <Button onClick={onContinue}>
            Continuar Aventura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 