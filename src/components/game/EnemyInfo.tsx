import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Sword, Eye, Zap, Hexagon } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Enemy } from '@/resources/game/game-model';
import { SpellEffect } from '@/resources/game/models/spell.model';
import { Button } from '@/components/ui/button';

// Interface estendida para propriedades avançadas do inimigo
interface ExtendedEnemy extends Enemy {
  critical_chance?: number;
  critical_damage?: number;
  physical_resistance?: number;
  magical_resistance?: number;
  primary_trait?: string;
  secondary_trait?: string;
}

interface EnemyInfoProps {
  currentEnemy: Enemy;
  enemyHpPercentage: number;
  getHpColor: (percentage: number) => string;
}

export function EnemyInfo({ currentEnemy, enemyHpPercentage, getHpColor }: EnemyInfoProps) {
  const [showDetails, setShowDetails] = useState(false);

  // Função para traduzir o comportamento
  const translateBehavior = (behavior: string) => {
    const translations = {
      'aggressive': 'Agressivo',
      'defensive': 'Defensivo',
      'balanced': 'Equilibrado'
    };
    return translations[behavior as keyof typeof translations] || behavior;
  };

  // Função para obter a cor do comportamento
  const getBehaviorColor = (behavior: string) => {
    switch (behavior) {
      case 'aggressive': return 'text-red-400 bg-red-900/30';
      case 'defensive': return 'text-blue-400 bg-blue-900/30';
      case 'balanced': return 'text-green-400 bg-green-900/30';
      default: return 'text-gray-400 bg-gray-900/30';
    }
  };

  // Função para traduzir traits
  const translateTrait = (trait: string) => {
    const translations = {
      'armored': 'Blindado',
      'swift': 'Veloz',
      'magical': 'Mágico',
      'brutish': 'Brutal',
      'resilient': 'Resistente',
      'berserker': 'Berserker',
      'ethereal': 'Etéreo',
      'venomous': 'Venenoso'
    };
    return translations[trait as keyof typeof translations] || trait;
  };

  // Extrair propriedades estendidas do monstro
  const extendedProps = currentEnemy as ExtendedEnemy;
  const criticalChance = extendedProps.critical_chance || 0.05;
  const criticalDamage = extendedProps.critical_damage || 1.5;
  const physicalResistance = extendedProps.physical_resistance || 0;
  const magicalResistance = extendedProps.magical_resistance || 0;
  const primaryTrait = extendedProps.primary_trait;
  const secondaryTrait = extendedProps.secondary_trait;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-card/95 pb-2">
        <CardTitle className="text-center text-lg flex items-center justify-center gap-2">
          {currentEnemy.name}
          {primaryTrait && (
            <span className={`px-2 py-1 rounded text-xs ${getBehaviorColor(currentEnemy.behavior)}`}>
              {translateTrait(primaryTrait)}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="aspect-square bg-muted flex items-center justify-center rounded-md mb-4">
          <div className="text-6xl font-bold text-muted-foreground">👾</div>
        </div>
        
        <div className="space-y-3">
          {/* HP */}
          <div>
            <div className="flex justify-between mb-1 text-sm">
              <span>HP: {currentEnemy.hp}/{currentEnemy.maxHp}</span>
              <span>{Math.round(enemyHpPercentage)}%</span>
            </div>
            <Progress 
              value={enemyHpPercentage} 
              className={`h-2 ${getHpColor(enemyHpPercentage)}`} 
            />
          </div>

          {/* Stats Básicos */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-muted p-2 rounded flex items-center gap-1">
              <Sword className="h-4 w-4" />
              <span>ATK: {currentEnemy.attack}</span>
            </div>
            <div className="bg-muted p-2 rounded flex items-center gap-1">
              <Shield className="h-4 w-4" />
              <span>DEF: {currentEnemy.defense}</span>
            </div>
            <div className="bg-muted p-2 rounded flex items-center gap-1">
              <Zap className="h-4 w-4" />
              <span>SPD: {currentEnemy.speed}</span>
            </div>
            <div className="bg-muted p-2 rounded flex items-center gap-1">
              <Eye className="h-4 w-4" />
              <span>LVL: {currentEnemy.level}</span>
            </div>
          </div>

          {/* Comportamento */}
          <div className="text-center">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getBehaviorColor(currentEnemy.behavior)}`}>
              {translateBehavior(currentEnemy.behavior)}
            </span>
          </div>

          {/* Toggle para mostrar/esconder detalhes */}
          <Button
            onClick={() => setShowDetails(!showDetails)}
            variant="outline"
            className="w-full"
            size="sm"
          >
            {showDetails ? 'Ocultar' : 'Mostrar'} Detalhes
          </Button>

          {/* Detalhes Avançados */}
          {showDetails && (
            <div className="space-y-3 pt-3 border-t">
              {/* Stats Avançados */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-center">Stats Avançados</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-yellow-400">Crítico:</span>
                    <span>{(criticalChance * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-yellow-400">Dano Crítico:</span>
                    <span>{(criticalDamage * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>

              {/* Resistências */}
              {(physicalResistance > 0 || magicalResistance > 0) && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-center">Resistências</h4>
                  <div className="space-y-1 text-xs">
                    {physicalResistance > 0 && (
                      <div className="flex justify-between">
                        <span className="text-red-400">Física:</span>
                        <span>{(physicalResistance * 100).toFixed(0)}%</span>
                      </div>
                    )}
                    {magicalResistance > 0 && (
                      <div className="flex justify-between">
                        <span className="text-blue-400">Mágica:</span>
                        <span>{(magicalResistance * 100).toFixed(0)}%</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Traits Especiais */}
              {(primaryTrait || secondaryTrait) && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-center">Características</h4>
                  <div className="space-y-1">
                    {primaryTrait && (
                      <div className="flex items-center gap-1">
                        <Hexagon className="h-3 w-3 text-purple-400" />
                        <span className="text-xs">{translateTrait(primaryTrait)}</span>
                      </div>
                    )}
                    {secondaryTrait && (
                      <div className="flex items-center gap-1">
                        <Hexagon className="h-3 w-3 text-blue-400" />
                        <span className="text-xs">{translateTrait(secondaryTrait)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Descrição do Comportamento */}
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-center">Comportamento</h4>
                <p className="text-xs text-gray-400 text-center">
                  {currentEnemy.behavior === 'aggressive' && 'Prioriza ataques fortes, mas tem defesa reduzida'}
                  {currentEnemy.behavior === 'defensive' && 'Prioriza defesa, mas tem ataque reduzido'}
                  {currentEnemy.behavior === 'balanced' && 'Mantém equilíbrio entre ataque e defesa'}
                </p>
              </div>
            </div>
          )}

          {/* Efeitos Ativos */}
          {Object.entries(currentEnemy.active_effects).map(([type, effects]) => 
            (effects as SpellEffect[]).length > 0 && (
              <div key={type} className="text-sm">
                <span className="font-medium">{type}: </span>
                {(effects as SpellEffect[]).map((e: SpellEffect) => 
                  `${e.value} (${e.duration})`
                ).join(', ')}
              </div>
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
} 