import React from 'react';
import { Card } from '@/components/ui/card';
import { Coins } from 'lucide-react';

interface GoldDisplayProps {
  gold: number;
}

export const GoldDisplay: React.FC<GoldDisplayProps> = ({ gold }) => {
  return (
    <Card className="p-4 bg-gradient-to-r from-yellow-500/10 to-yellow-600/10 border-yellow-500/30">
      <div className="flex items-center justify-center gap-2">
        <Coins className="h-5 w-5 text-yellow-400" />
        <span className="text-lg font-bold text-yellow-400">{gold.toLocaleString()}</span>
        <span className="text-sm text-yellow-400/70">Gold</span>
      </div>
    </Card>
  );
};
