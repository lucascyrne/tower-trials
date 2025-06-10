import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Trophy, Heart, Skull, TrendingUp, Coins } from 'lucide-react';
import { type RankingEntry, type RankingMode } from '@/resources/game/ranking.service';
import { formatLargeNumber } from '@/utils/number-utils';

interface RankingTableProps {
  entries: RankingEntry[];
  mode: RankingMode;
  currentUserId?: string;
}

const RankingTable: React.FC<RankingTableProps> = ({ entries, mode, currentUserId }) => {
  const getMedalColor = (position: number): string => {
    switch (position) {
      case 0:
        return 'text-yellow-500'; // Ouro
      case 1:
        return 'text-gray-400'; // Prata
      case 2:
        return 'text-amber-700'; // Bronze
      default:
        return 'text-gray-300'; // Outros
    }
  };

  const getValueForMode = (entry: RankingEntry, mode: RankingMode): string => {
    switch (mode) {
      case 'floor':
        return `Andar ${entry.floor}`;
      case 'level':
        return `Nível ${entry.character_level}`;
      case 'gold':
        return `${formatLargeNumber(entry.character_gold)} Gold`;
      default:
        return `Andar ${entry.floor}`;
    }
  };

  const getSecondaryInfo = (entry: RankingEntry, mode: RankingMode): string => {
    switch (mode) {
      case 'floor':
        return `Nível ${entry.character_level} • ${formatLargeNumber(entry.character_gold)} Gold`;
      case 'level':
        return `Andar ${entry.floor} • ${formatLargeNumber(entry.character_gold)} Gold`;
      case 'gold':
        return `Andar ${entry.floor} • Nível ${entry.character_level}`;
      default:
        return `Nível ${entry.character_level}`;
    }
  };

  const getModeIcon = (mode: RankingMode) => {
    switch (mode) {
      case 'floor':
        return Trophy;
      case 'level':
        return TrendingUp;
      case 'gold':
        return Coins;
      default:
        return Trophy;
    }
  };

  const ModeIcon = getModeIcon(mode);

  if (entries.length === 0) {
    return (
      <div className="text-center py-8">
        <ModeIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Nenhum registro encontrado para esta modalidade.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12 text-center">Pos.</TableHead>
          <TableHead>Jogador</TableHead>
          <TableHead className="text-right">Valor Principal</TableHead>
          <TableHead className="text-right hidden sm:table-cell">Detalhes</TableHead>
          <TableHead className="text-right">Data</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry, index) => (
          <TableRow
            key={entry.id}
            className={entry.user_id === currentUserId ? 'bg-primary/5' : ''}
          >
            <TableCell className="text-center font-medium">
              {index < 3 ? (
                <Trophy className={`inline h-4 w-4 ${getMedalColor(index)}`} />
              ) : (
                <span className="text-muted-foreground">{index + 1}</span>
              )}
            </TableCell>

            <TableCell>
              <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{entry.player_name}</span>
                    {entry.character_alive ? (
                      <Heart className="h-3 w-3 text-green-500" />
                    ) : (
                      <Skull className="h-3 w-3 text-red-500" />
                    )}
                    {entry.user_id === currentUserId && (
                      <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                        Você
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground sm:hidden">
                    {getSecondaryInfo(entry, mode)}
                  </div>
                </div>
              </div>
            </TableCell>

            <TableCell className="text-right font-medium">{getValueForMode(entry, mode)}</TableCell>

            <TableCell className="text-right text-muted-foreground hidden sm:table-cell">
              {getSecondaryInfo(entry, mode)}
            </TableCell>

            <TableCell className="text-right text-muted-foreground">
              {entry.created_at
                ? new Date(entry.created_at).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '-'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default RankingTable;
