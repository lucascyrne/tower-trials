'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GamePlayer } from '@/resources/game/game-model';
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
  Hammer
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
  accentGlow: string;
  accentIcon: string;
  isPrimary?: boolean;
}

function ActionCard({ 
  title, 
  description, 
  icon: Icon, 
  onClick, 
  badge,
  badgeColor = 'secondary',
  accentGlow,
  accentIcon,
  isPrimary = false
}: ActionCardProps) {
  return (
    <Card
      className={`group relative overflow-hidden border-slate-700/80 bg-slate-900/75 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-500/80 hover:bg-slate-800/80 ${
        isPrimary ? 'ring-1 ring-red-500/30' : ''
      }`}
    >
      <div
        className={`pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 ${accentGlow}`}
        aria-hidden="true"
      />
      <Button
        variant="ghost"
        className="relative h-full min-h-[136px] w-full items-start justify-start gap-3 p-4 text-left hover:bg-transparent"
        onClick={onClick}
      >
        <div className="relative flex w-full items-start justify-between">
          <div className={`rounded-xl border border-slate-700/80 bg-slate-800/70 p-2.5 transition-colors duration-300 group-hover:bg-slate-700/80 ${accentIcon}`}>
            <Icon className="h-5 w-5 text-slate-200 transition-colors duration-300 group-hover:text-white" />
          </div>
          {badge && (
            <Badge
              variant={badgeColor}
              className="h-6 min-w-6 rounded-full border border-red-500/60 bg-red-600/90 px-1.5 text-[11px] font-bold text-white"
            >
              {badge}
            </Badge>
          )}
        </div>

        <div className="space-y-1">
          <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-slate-100 transition-colors duration-300 group-hover:text-white">
            {title}
          </h3>
          <p className="line-clamp-2 text-xs leading-relaxed text-slate-400 transition-colors duration-300 group-hover:text-slate-300">
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
  onReturnToSelection 
}: ActionMenuGridProps) {
  const actions = [
    {
      title: 'Entrar na Torre',
      description: 'Nova aventura',
      icon: Swords,
      onClick: onStartAdventure,
      accentGlow: 'bg-[radial-gradient(circle_at_12%_0%,rgba(239,68,68,0.18),transparent_55%)]',
      accentIcon: 'group-hover:border-red-500/50',
      isPrimary: true
    },
    {
      title: 'Mapa da Torre',
      description: 'Usar checkpoint',
      icon: Map,
      onClick: onOpenMap,
      accentGlow: 'bg-[radial-gradient(circle_at_12%_0%,rgba(59,130,246,0.18),transparent_55%)]',
      accentIcon: 'group-hover:border-blue-500/50'
    },
    {
      title: 'Atributos',
      description: 'Evoluir personagem',
      icon: TrendingUp,
      onClick: onOpenCharacterStats,
      badge: player.attribute_points && player.attribute_points > 0 ? player.attribute_points : undefined,
      badgeColor: 'destructive' as const,
      accentGlow: 'bg-[radial-gradient(circle_at_12%_0%,rgba(168,85,247,0.18),transparent_55%)]',
      accentIcon: 'group-hover:border-purple-500/50'
    },
    {
      title: 'Grimório',
      description: 'Gerenciar magias',
      icon: Sparkles,
      onClick: onOpenSpells,
      accentGlow: 'bg-[radial-gradient(circle_at_12%_0%,rgba(139,92,246,0.18),transparent_55%)]',
      accentIcon: 'group-hover:border-violet-500/50'
    },
    {
      title: 'Loja',
      description: 'Comprar itens',
      icon: ShoppingBag,
      onClick: onOpenShop,
      accentGlow: 'bg-[radial-gradient(circle_at_12%_0%,rgba(34,197,94,0.18),transparent_55%)]',
      accentIcon: 'group-hover:border-green-500/50'
    },
    {
      title: 'Inventário',
      description: 'Consumíveis',
      icon: Backpack,
      onClick: onOpenInventory,
      accentGlow: 'bg-[radial-gradient(circle_at_12%_0%,rgba(249,115,22,0.18),transparent_55%)]',
      accentIcon: 'group-hover:border-orange-500/50'
    },
    {
      title: 'Equipamentos',
      description: 'Armas e armaduras',
      icon: Shield,
      onClick: onOpenEquipment,
      accentGlow: 'bg-[radial-gradient(circle_at_12%_0%,rgba(245,158,11,0.18),transparent_55%)]',
      accentIcon: 'group-hover:border-amber-500/50'
    },
    {
      title: 'Forja',
      description: 'Crafting de itens',
      icon: Hammer,
      onClick: onOpenCrafting,
      accentGlow: 'bg-[radial-gradient(circle_at_12%_0%,rgba(6,182,212,0.18),transparent_55%)]',
      accentIcon: 'group-hover:border-cyan-500/50'
    },
    {
      title: 'Cemitério',
      description: 'Personagens mortos',
      icon: Skull,
      onClick: onOpenCemetery,
      accentGlow: 'bg-[radial-gradient(circle_at_12%_0%,rgba(244,63,94,0.18),transparent_55%)]',
      accentIcon: 'group-hover:border-rose-500/50'
    },
    {
      title: 'Trocar',
      description: 'Outro personagem',
      icon: ArrowLeft,
      onClick: onReturnToSelection,
      accentGlow: 'bg-[radial-gradient(circle_at_12%_0%,rgba(148,163,184,0.18),transparent_55%)]',
      accentIcon: 'group-hover:border-slate-400/50'
    }
  ];

  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/55 p-4 shadow-2xl shadow-black/20 sm:p-5">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(148,29,29,0.14),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(30,64,175,0.14),transparent_50%)]"
        aria-hidden="true"
      />

      <div className="relative mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">Ações do Hub</h2>
          <p className="mt-1 text-xs text-slate-400">Escolha seu próximo passo na jornada.</p>
        </div>
      </div>

      <div className="relative grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {actions.map(action => (
          <ActionCard
            key={action.title}
            title={action.title}
            description={action.description}
            icon={action.icon}
            onClick={action.onClick}
            badge={action.badge}
            badgeColor={action.badgeColor}
            accentGlow={action.accentGlow}
            accentIcon={action.accentIcon}
            isPrimary={action.isPrimary}
          />
        ))}
      </div>
    </section>
  );
} 