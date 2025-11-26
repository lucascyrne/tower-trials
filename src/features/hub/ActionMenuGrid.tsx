import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { type GamePlayer } from '@/resources/game/game.model';
import {
  Swords,
  ShoppingBag,
  Backpack,
  ArrowLeft,
  Map,
  TrendingUp,
  Shield,
  Skull,
  Sparkles,
  Hammer,
} from 'lucide-react';

interface ActionMenuGridProps {
  player: GamePlayer;
  onStartAdventure: () => void;
  onOpenMap: () => void;
  onOpenCharacterStats: () => void;
  onOpenShop: () => void;
  onOpenInventory: () => void;
  onOpenEquipment: () => void;
  onOpenSpells: () => void;
  onOpenCrafting: () => void;
  onOpenCemetery: () => void;
  onReturnToSelection: () => void;
}

interface ActionCardProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  badge?: string | number;
  badgeColor?: 'default' | 'destructive' | 'outline' | 'secondary';
  accent: string;
  isPrimary?: boolean;
}

function ActionCard({
  title,
  description,
  icon: Icon,
  onClick,
  badge,
  badgeColor = 'secondary',
  accent,
  isPrimary = false,
}: ActionCardProps) {
  return (
    <Card
      className={`group relative overflow-hidden border-slate-700 bg-slate-900/80 hover:bg-slate-800/80 transition-all duration-300 hover:border-slate-600 cursor-pointer ${isPrimary ? 'ring-2 ring-red-600/30' : ''}`}
    >
      <Button
        variant="ghost"
        className="w-full h-full p-3 flex flex-col items-center justify-center space-y-2 hover:bg-transparent min-h-[120px] cursor-pointer"
        onClick={onClick}
      >
        <div className="relative">
          <div
            className={`p-3 rounded-lg bg-slate-800 group-hover:bg-slate-700 transition-colors duration-300 ${accent}`}
          >
            <Icon className="h-5 w-5 text-slate-300 group-hover:text-white transition-colors duration-300" />
          </div>
          {badge && (
            <Badge
              variant={badgeColor}
              className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs font-bold bg-red-600 text-white border-red-500"
            >
              {badge}
            </Badge>
          )}
        </div>

        <div className="text-center space-y-1 max-w-full">
          <h3 className="font-semibold text-sm text-slate-200 group-hover:text-white transition-colors duration-300 leading-tight">
            {title}
          </h3>
          <p className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors duration-300 leading-tight px-1 break-words">
            {description}
          </p>
        </div>
      </Button>
    </Card>
  );
}

export function ActionMenuGrid({
  player,
  onStartAdventure,
  onOpenMap,
  onOpenCharacterStats,
  onOpenShop,
  onOpenInventory,
  onOpenEquipment,
  onOpenSpells,
  onOpenCrafting,
  onOpenCemetery,
  onReturnToSelection,
}: ActionMenuGridProps) {
  const actions = [
    {
      title: 'Entrar na Torre',
      description: 'Nova aventura',
      icon: Swords,
      onClick: onStartAdventure,
      accent: 'border-red-600/30',
      isPrimary: true,
    },
    {
      title: 'Mapa da Torre',
      description: 'Usar checkpoint',
      icon: Map,
      onClick: onOpenMap,
      accent: 'border-blue-600/30',
    },
    {
      title: 'Atributos',
      description: 'Evoluir personagem',
      icon: TrendingUp,
      onClick: onOpenCharacterStats,
      badge:
        player.attribute_points && player.attribute_points > 0
          ? player.attribute_points
          : undefined,
      badgeColor: 'destructive' as const,
      accent: 'border-purple-600/30',
    },
    {
      title: 'Grimório',
      description: 'Gerenciar magias',
      icon: Sparkles,
      onClick: onOpenSpells,
      accent: 'border-violet-600/30',
    },
    {
      title: 'Loja',
      description: 'Comprar itens',
      icon: ShoppingBag,
      onClick: onOpenShop,
      accent: 'border-green-600/30',
    },
    {
      title: 'Inventário',
      description: 'Consumíveis',
      icon: Backpack,
      onClick: onOpenInventory,
      accent: 'border-orange-600/30',
    },
    {
      title: 'Equipamentos',
      description: 'Armas e armaduras',
      icon: Shield,
      onClick: onOpenEquipment,
      accent: 'border-amber-600/30',
    },
    {
      title: 'Forja',
      description: 'Crafting de itens',
      icon: Hammer,
      onClick: onOpenCrafting,
      accent: 'border-cyan-600/30',
    },
    {
      title: 'Cemitério',
      description: 'Personagens mortos',
      icon: Skull,
      onClick: onOpenCemetery,
      accent: 'border-red-600/30',
    },
    {
      title: 'Trocar',
      description: 'Outro personagem',
      icon: ArrowLeft,
      onClick: onReturnToSelection,
      accent: 'border-slate-600/30',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-10 gap-3">
      {actions.map((action, index) => (
        <ActionCard
          key={index}
          title={action.title}
          description={action.description}
          icon={action.icon}
          onClick={action.onClick}
          badge={action.badge}
          badgeColor={action.badgeColor}
          accent={action.accent}
          isPrimary={action.isPrimary}
        />
      ))}
    </div>
  );
}
