'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GamePlayer } from '@/resources/game/game-model';
import { 
  User, 
  Star, 
  Sword, 
  Shield, 
  Crown, 
  Gem,
  Zap,
  Heart,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Axe,
  Hammer,
  Wand2,
  ShieldCheck
} from 'lucide-react';

interface CharacterInfoCardProps {
  player: GamePlayer;
}

export function CharacterInfoCard({ player }: CharacterInfoCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  
  const xpProgress = (player.xp / player.xp_next_level) * 100;
  const hpProgress = (player.hp / player.max_hp) * 100;
  const manaProgress = (player.mana / player.max_mana) * 100;

  // Habilidades com ícones e cores
  const skills = [
    {
      name: 'Espada',
      level: player.sword_mastery || 1,
      icon: Sword,
      color: 'text-slate-400',
      bgColor: 'bg-slate-900'
    },
    {
      name: 'Machado',
      level: player.axe_mastery || 1,
      icon: Axe,
      color: 'text-amber-400',
      bgColor: 'bg-amber-900'
    },
    {
      name: 'Maça',
      level: player.blunt_mastery || 1,
      icon: Hammer,
      color: 'text-stone-400',
      bgColor: 'bg-stone-900'
    },
    {
      name: 'Magia',
      level: player.magic_mastery || 1,
      icon: Wand2,
      color: 'text-purple-400',
      bgColor: 'bg-purple-900'
    },
    {
      name: 'Defesa',
      level: player.defense_mastery || 1,
      icon: ShieldCheck,
      color: 'text-blue-400',
      bgColor: 'bg-blue-900'
    }
  ];

  // Atributos primários com ícones
  const primaryAttributes = [
    {
      name: 'FOR',
      fullName: 'Força',
      value: player.strength || 10,
      icon: Sword,
      color: 'text-red-400'
    },
    {
      name: 'AGI',
      fullName: 'Agilidade',
      value: player.dexterity || 10,
      icon: Zap,
      color: 'text-green-400'
    },
    {
      name: 'INT',
      fullName: 'Inteligência',
      value: player.intelligence || 10,
      icon: Sparkles,
      color: 'text-blue-400'
    },
    {
      name: 'SAB',
      fullName: 'Sabedoria',
      value: player.wisdom || 10,
      icon: Star,
      color: 'text-purple-400'
    },
    {
      name: 'VIT',
      fullName: 'Vitalidade',
      value: player.vitality || 10,
      icon: Heart,
      color: 'text-pink-400'
    },
    {
      name: 'SOR',
      fullName: 'Sorte',
      value: player.luck || 10,
      icon: Crown,
      color: 'text-yellow-400'
    }
  ];

  const getHpColor = () => {
    if (hpProgress >= 70) return 'bg-emerald-600';
    if (hpProgress >= 30) return 'bg-yellow-600';
    return 'bg-red-600';
  };

  const getManaColor = () => {
    if (manaProgress >= 70) return 'bg-blue-600';
    if (manaProgress >= 30) return 'bg-cyan-600';
    return 'bg-indigo-600';
  };

  return (
    <Card className="w-full bg-slate-900/80 border-slate-700 shadow-xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-700 rounded-lg">
              <User className="h-5 w-5 text-slate-300" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">{player.name}</h2>
              <p className="text-sm text-slate-400">Aventureiro</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="border-amber-500 text-amber-400 bg-amber-500/10">
              <Star className="h-3 w-3 mr-1" />
              Nível {player.level}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
              className="text-slate-400 hover:text-slate-200"
            >
              {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Layout principal horizontal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lado esquerdo: Barras de status */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Status</h3>
            
            {/* HP */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-sm">
                <span className="flex items-center gap-2 font-medium text-slate-300">
                  <Heart className="h-4 w-4 text-red-400" />
                  HP
                  {player.hp < player.max_hp && (
                    <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse" />
                  )}
                </span>
                <span className="text-slate-400">{player.hp}/{player.max_hp}</span>
              </div>
              <Progress value={hpProgress} className={`h-2 ${getHpColor()}`} />
            </div>
            
            {/* Mana */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-sm">
                <span className="flex items-center gap-2 font-medium text-slate-300">
                  <Sparkles className="h-4 w-4 text-blue-400" />
                  Mana
                </span>
                <span className="text-slate-400">{player.mana}/{player.max_mana}</span>
              </div>
              <Progress value={manaProgress} className={`h-2 ${getManaColor()}`} />
            </div>
            
            {/* XP */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-sm">
                <span className="flex items-center gap-2 font-medium text-slate-300">
                  <Star className="h-4 w-4 text-yellow-400" />
                  XP
                </span>
                <span className="text-slate-400">{player.xp}/{player.xp_next_level}</span>
              </div>
              <Progress value={xpProgress} className="h-2 bg-yellow-600" />
            </div>
          </div>

          {/* Centro: Stats básicos e importantes */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Combat Stats</h3>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                <div className="flex items-center gap-2">
                  <Sword className="h-4 w-4 text-red-400" />
                  <span className="text-sm font-medium text-slate-300">ATK</span>
                </div>
                <p className="text-lg font-bold text-red-400">{player.atk}</p>
              </div>
              
              <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-blue-400" />
                  <span className="text-sm font-medium text-slate-300">DEF</span>
                </div>
                <p className="text-lg font-bold text-blue-400">{player.def}</p>
              </div>
              
              <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-green-400" />
                  <span className="text-sm font-medium text-slate-300">VEL</span>
                </div>
                <p className="text-lg font-bold text-green-400">{player.speed}</p>
              </div>
              
              <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                <div className="flex items-center gap-2">
                  <Crown className="h-4 w-4 text-purple-400" />
                  <span className="text-sm font-medium text-slate-300">Andar</span>
                </div>
                <p className="text-lg font-bold text-purple-400">{player.floor}</p>
              </div>
            </div>
            
            {/* Gold */}
            <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gem className="h-4 w-4 text-yellow-400" />
                  <span className="text-sm font-medium text-slate-300">Gold</span>
                </div>
                <p className="text-lg font-bold text-yellow-400">{player.gold}</p>
              </div>
            </div>
          </div>

          {/* Direita: Atributos compactos */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Atributos</h3>
            
            <div className="grid grid-cols-3 gap-2">
              {primaryAttributes.map((attr) => {
                const Icon = attr.icon;
                return (
                  <div 
                    key={attr.name}
                    className="bg-slate-800/50 p-2 rounded-lg border border-slate-700 hover:bg-slate-700/50 transition-colors"
                    title={attr.fullName}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <Icon className={`h-3 w-3 ${attr.color}`} />
                      <span className="text-xs font-medium text-slate-400">{attr.name}</span>
                      <span className={`text-sm font-bold ${attr.color}`}>
                        {attr.value}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Chance crítica se disponível */}
            {player.critical_chance && (
              <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-orange-400" />
                    <span className="text-sm font-medium text-slate-300">Crítico</span>
                  </div>
                  <p className="text-sm font-bold text-orange-400">{player.critical_chance.toFixed(1)}%</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Seção expansível com habilidades */}
        {showDetails && (
          <div className="border-t border-slate-700 pt-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Habilidades de Combate</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {skills.map((skill) => {
                const Icon = skill.icon;
                return (
                  <div 
                    key={skill.name}
                    className={`${skill.bgColor} p-3 rounded-lg border border-slate-600 hover:border-slate-500 transition-colors`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Icon className={`h-5 w-5 ${skill.color}`} />
                      <span className="text-xs font-medium text-slate-400 text-center">{skill.name}</span>
                      <Badge variant="outline" className={`${skill.color} border-current bg-transparent text-xs`}>
                        Nv. {skill.level}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 