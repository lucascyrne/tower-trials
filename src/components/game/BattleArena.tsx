'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { 
  Sword, 
  Shield, 
  Zap, 
  Star, 
  Heart,
  Eye,
  Sparkles,
  Crown,
  Skull,
  ChevronDown,
  ChevronUp,
  Target,
  Activity,
  Flame,
  Snowflake,
  Hexagon,
  TrendingUp,
  TrendingDown,
  Crosshair,
  ShieldCheck
} from 'lucide-react';
import { GamePlayer, Enemy } from '@/resources/game/game-model';

interface BattleArenaProps {
  player: GamePlayer;
  currentEnemy: Enemy;
  playerHpPercentage: number;
  playerManaPercentage: number;
  enemyHpPercentage: number;
  isPlayerTurn: boolean;
}

export function BattleArena({ 
  player, 
  currentEnemy, 
  playerHpPercentage, 
  playerManaPercentage, 
  enemyHpPercentage, 
  isPlayerTurn 
}: BattleArenaProps) {
  const [showPlayerDetails, setShowPlayerDetails] = useState(false);
  const [showEnemyDetails, setShowEnemyDetails] = useState(false);

  const translateBehavior = (behavior: string) => {
    const translations = {
      'aggressive': 'Agressivo',
      'defensive': 'Defensivo', 
      'balanced': 'Equilibrado'
    };
    return translations[behavior as keyof typeof translations] || behavior;
  };

  const getBehaviorColor = (behavior: string) => {
    switch (behavior) {
      case 'aggressive': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'defensive': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'balanced': return 'bg-green-500/20 text-green-400 border-green-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

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

  const getTraitIcon = (trait: string) => {
    switch (trait) {
      case 'armored': return <Shield className="h-3 w-3" />;
      case 'swift': return <Zap className="h-3 w-3" />;
      case 'magical': return <Sparkles className="h-3 w-3" />;
      case 'brutish': return <Sword className="h-3 w-3" />;
      case 'resilient': return <ShieldCheck className="h-3 w-3" />;
      case 'berserker': return <Target className="h-3 w-3" />;
      case 'ethereal': return <Eye className="h-3 w-3" />;
      case 'venomous': return <Flame className="h-3 w-3" />;
      default: return <Hexagon className="h-3 w-3" />;
    }
  };

  return (
    <div className="relative">
      {/* Arena Background with Battle Atmosphere */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/30 via-transparent to-slate-900/30 rounded-xl"></div>
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-red-500/5 rounded-xl"></div>
      
      <Card className="relative border-2 border-border/50 bg-card/40 backdrop-blur-sm overflow-hidden">
        <CardContent className="p-6">
          {/* Battle Header */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-3 mb-2">
              <Badge variant="outline" className="px-3 py-1 bg-background/50">
                <Sword className="h-3 w-3 mr-1" />
                Andar {player.floor}
              </Badge>
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse"></div>
              <Badge variant={isPlayerTurn ? "default" : "secondary"} className="px-3 py-1 bg-background/50">
                {isPlayerTurn ? "Seu Turno" : "Turno do Inimigo"}
              </Badge>
            </div>
          </div>

          {/* Main Battle Display */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            
            {/* Player Side */}
            <div className="space-y-4">
              {/* Player Avatar & Basic Info */}
              <div className="text-center">
                <div className="relative inline-block mb-4">
                  <div className={`w-24 h-24 lg:w-28 lg:h-28 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border-3 flex items-center justify-center text-4xl lg:text-5xl transition-all duration-500 ${
                    isPlayerTurn 
                      ? 'border-blue-500 shadow-2xl shadow-blue-500/40 scale-110' 
                      : 'border-blue-500/30 scale-100'
                  }`}>
                    🧙‍♂️
                  </div>
                  {isPlayerTurn && (
                    <div className="absolute -top-2 -right-2">
                      <div className="w-5 h-5 bg-blue-500 rounded-full animate-ping"></div>
                      <div className="absolute top-0 right-0 w-5 h-5 bg-blue-500 rounded-full"></div>
                    </div>
                  )}
                  {player.isDefending && (
                    <div className="absolute -bottom-2 -left-2">
                      <div className="w-8 h-8 bg-blue-600/90 rounded-full flex items-center justify-center border-2 border-background">
                        <Shield className="h-4 w-4 text-white" />
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <h3 className="font-bold text-lg lg:text-xl flex items-center justify-center gap-2">
                    <Crown className="h-5 w-5 text-yellow-500" />
                    {player.name}
                  </h3>
                  <div className="flex items-center justify-center gap-2">
                    <Badge variant="outline" className="bg-background/50">
                      <Star className="h-3 w-3 mr-1" />
                      Nível {player.level}
                    </Badge>
                    <Badge variant="outline" className="bg-background/50 text-yellow-400">
                      {player.gold} Gold
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Player Health & Mana */}
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <Heart className="h-4 w-4 text-red-500" />
                      <span className="font-medium">Vida</span>
                    </div>
                    <span className="text-sm font-bold">{player.hp}/{player.max_hp}</span>
                  </div>
                  <Progress 
                    value={playerHpPercentage} 
                    className="h-3"
                    style={{
                      background: 'rgba(0,0,0,0.2)'
                    }}
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">Mana</span>
                    </div>
                    <span className="text-sm font-bold">{player.mana}/{player.max_mana}</span>
                  </div>
                  <Progress 
                    value={playerManaPercentage} 
                    className="h-3"
                    style={{
                      background: 'rgba(0,0,0,0.2)'
                    }}
                  />
                </div>
              </div>

              {/* Player Combat Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
                  <Sword className="h-4 w-4 mx-auto mb-1 text-red-400" />
                  <div className="text-xs text-muted-foreground">Ataque</div>
                  <div className="font-bold text-red-400">{player.atk}</div>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-center">
                  <Shield className="h-4 w-4 mx-auto mb-1 text-blue-400" />
                  <div className="text-xs text-muted-foreground">Defesa</div>
                  <div className="font-bold text-blue-400">{player.def}</div>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-center">
                  <Zap className="h-4 w-4 mx-auto mb-1 text-yellow-400" />
                  <div className="text-xs text-muted-foreground">Velocidade</div>
                  <div className="font-bold text-yellow-400">{player.speed}</div>
                </div>
              </div>

              {/* Player Extended Stats Toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPlayerDetails(!showPlayerDetails)}
                className="w-full h-8 text-xs bg-background/30 hover:bg-background/50"
              >
                {showPlayerDetails ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                {showPlayerDetails ? 'Menos' : 'Mais'} Detalhes
              </Button>

              {/* Extended Player Details */}
              {showPlayerDetails && (
                <div className="space-y-3 pt-2 border-t border-border/50 animate-in slide-in-from-top-2 duration-300">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-background/20 rounded p-2">
                      <div className="text-muted-foreground">XP Atual</div>
                      <div className="font-medium">{player.xp}</div>
                    </div>
                    <div className="bg-background/20 rounded p-2">
                      <div className="text-muted-foreground">Próximo Nível</div>
                      <div className="font-medium">{player.xp_next_level}</div>
                    </div>
                  </div>
                  
                  {/* Atributos Primários do Jogador */}
                  {(player.strength || player.dexterity || player.intelligence || player.wisdom || player.vitality || player.luck) && (
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Atributos Primários:</div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        {player.strength && (
                          <div className="bg-red-500/10 rounded p-1 text-center">
                            <TrendingUp className="h-3 w-3 mx-auto mb-1 text-red-400" />
                            <div className="text-muted-foreground">FOR</div>
                            <div className="font-medium">{player.strength}</div>
                          </div>
                        )}
                        {player.dexterity && (
                          <div className="bg-green-500/10 rounded p-1 text-center">
                            <Zap className="h-3 w-3 mx-auto mb-1 text-green-400" />
                            <div className="text-muted-foreground">DES</div>
                            <div className="font-medium">{player.dexterity}</div>
                          </div>
                        )}
                        {player.intelligence && (
                          <div className="bg-purple-500/10 rounded p-1 text-center">
                            <Sparkles className="h-3 w-3 mx-auto mb-1 text-purple-400" />
                            <div className="text-muted-foreground">INT</div>
                            <div className="font-medium">{player.intelligence}</div>
                          </div>
                        )}
                        {player.wisdom && (
                          <div className="bg-blue-500/10 rounded p-1 text-center">
                            <Eye className="h-3 w-3 mx-auto mb-1 text-blue-400" />
                            <div className="text-muted-foreground">SAB</div>
                            <div className="font-medium">{player.wisdom}</div>
                          </div>
                        )}
                        {player.vitality && (
                          <div className="bg-pink-500/10 rounded p-1 text-center">
                            <Heart className="h-3 w-3 mx-auto mb-1 text-pink-400" />
                            <div className="text-muted-foreground">VIT</div>
                            <div className="font-medium">{player.vitality}</div>
                          </div>
                        )}
                        {player.luck && (
                          <div className="bg-yellow-500/10 rounded p-1 text-center">
                            <Star className="h-3 w-3 mx-auto mb-1 text-yellow-400" />
                            <div className="text-muted-foreground">SOR</div>
                            <div className="font-medium">{player.luck}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Stats Derivados do Jogador */}
                  {(player.critical_chance || player.critical_damage) && (
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Combate Avançado:</div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {player.critical_chance && (
                          <div className="bg-background/20 rounded p-2">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Crosshair className="h-3 w-3" />
                              <span>Crítico</span>
                            </div>
                            <div className="font-medium text-yellow-400">
                              {(player.critical_chance * 100).toFixed(1)}%
                            </div>
                          </div>
                        )}
                        {player.critical_damage && (
                          <div className="bg-background/20 rounded p-2">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Target className="h-3 w-3" />
                              <span>Dano Crit</span>
                            </div>
                            <div className="font-medium text-orange-400">
                              {(player.critical_damage * 100).toFixed(0)}%
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Pontos de Atributo Disponíveis */}
                  {player.attribute_points != null && player.attribute_points > 0 && (
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded p-2">
                      <div className="flex items-center gap-2 text-yellow-400">
                        <Star className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          {player.attribute_points} pontos de atributo disponíveis
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {player.isDefending && (
                    <div className="flex items-center gap-2 text-blue-400 bg-blue-500/10 rounded p-2">
                      <Shield className="h-4 w-4" />
                      <span className="text-sm font-medium">Postura Defensiva Ativa</span>
                    </div>
                  )}
                  
                  {player.defenseCooldown > 0 && (
                    <div className="flex items-center gap-2 text-orange-400 bg-orange-500/10 rounded p-2">
                      <Activity className="h-4 w-4" />
                      <span className="text-sm">Defesa em Cooldown: {player.defenseCooldown} turnos</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Enemy Side */}
            <div className="space-y-4">
              {/* Enemy Avatar & Basic Info */}
              <div className="text-center">
                <div className="relative inline-block mb-4">
                  <div className={`w-24 h-24 lg:w-28 lg:h-28 rounded-full bg-gradient-to-br from-red-500/20 to-orange-500/20 border-3 flex items-center justify-center text-4xl lg:text-5xl transition-all duration-500 ${
                    !isPlayerTurn 
                      ? 'border-red-500 shadow-2xl shadow-red-500/40 scale-110' 
                      : 'border-red-500/30 scale-100'
                  }`}>
                    {currentEnemy.image || '👾'}
                  </div>
                  {!isPlayerTurn && (
                    <div className="absolute -top-2 -right-2">
                      <div className="w-5 h-5 bg-red-500 rounded-full animate-ping"></div>
                      <div className="absolute top-0 right-0 w-5 h-5 bg-red-500 rounded-full"></div>
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <h3 className="font-bold text-lg lg:text-xl flex items-center justify-center gap-2">
                    <Skull className="h-5 w-5 text-red-500" />
                    {currentEnemy.name}
                  </h3>
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    <Badge variant="outline" className="bg-background/50">
                      <Eye className="h-3 w-3 mr-1" />
                      Nível {currentEnemy.level}
                    </Badge>
                    <Badge className={`text-xs border ${getBehaviorColor(currentEnemy.behavior)}`}>
                      {translateBehavior(currentEnemy.behavior)}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Enemy Health */}
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <Heart className="h-4 w-4 text-red-500" />
                      <span className="font-medium">Vida</span>
                    </div>
                    <span className="text-sm font-bold">{currentEnemy.hp}/{currentEnemy.maxHp}</span>
                  </div>
                  <Progress 
                    value={enemyHpPercentage} 
                    className="h-3"
                    style={{
                      background: 'rgba(0,0,0,0.2)'
                    }}
                  />
                </div>

                {currentEnemy.mana > 0 && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-purple-500" />
                        <span className="font-medium">Mana</span>
                      </div>
                      <span className="text-sm font-bold">{currentEnemy.mana}</span>
                    </div>
                    <div className="h-3 bg-black/20 rounded-full">
                      <div 
                        className="h-full bg-purple-500 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, (currentEnemy.mana / Math.max(currentEnemy.mana, 100)) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Enemy Combat Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
                  <Sword className="h-4 w-4 mx-auto mb-1 text-red-400" />
                  <div className="text-xs text-muted-foreground">Ataque</div>
                  <div className="font-bold text-red-400">{currentEnemy.attack}</div>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-center">
                  <Shield className="h-4 w-4 mx-auto mb-1 text-blue-400" />
                  <div className="text-xs text-muted-foreground">Defesa</div>
                  <div className="font-bold text-blue-400">{currentEnemy.defense}</div>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-center">
                  <Zap className="h-4 w-4 mx-auto mb-1 text-yellow-400" />
                  <div className="text-xs text-muted-foreground">Velocidade</div>
                  <div className="font-bold text-yellow-400">{currentEnemy.speed}</div>
                </div>
              </div>

              {/* Enemy Extended Stats Toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowEnemyDetails(!showEnemyDetails)}
                className="w-full h-8 text-xs bg-background/30 hover:bg-background/50"
              >
                {showEnemyDetails ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                {showEnemyDetails ? 'Menos' : 'Mais'} Detalhes
              </Button>

              {/* Extended Enemy Details */}
              {showEnemyDetails && (
                <div className="space-y-3 pt-2 border-t border-border/50 animate-in slide-in-from-top-2 duration-300">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-background/20 rounded p-2">
                      <div className="text-muted-foreground">Recompensa XP</div>
                      <div className="font-medium text-blue-400">{currentEnemy.reward_xp}</div>
                    </div>
                    <div className="bg-background/20 rounded p-2">
                      <div className="text-muted-foreground">Recompensa Gold</div>
                      <div className="font-medium text-yellow-400">{currentEnemy.reward_gold}</div>
                    </div>
                  </div>
                  
                  {/* Atributos Primários do Inimigo */}
                  {(currentEnemy.strength || currentEnemy.dexterity || currentEnemy.intelligence) && (
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Atributos Primários:</div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        {currentEnemy.strength && (
                          <div className="bg-red-500/10 rounded p-1 text-center">
                            <TrendingUp className="h-3 w-3 mx-auto mb-1 text-red-400" />
                            <div className="text-muted-foreground">FOR</div>
                            <div className="font-medium">{currentEnemy.strength}</div>
                          </div>
                        )}
                        {currentEnemy.dexterity && (
                          <div className="bg-green-500/10 rounded p-1 text-center">
                            <Zap className="h-3 w-3 mx-auto mb-1 text-green-400" />
                            <div className="text-muted-foreground">DES</div>
                            <div className="font-medium">{currentEnemy.dexterity}</div>
                          </div>
                        )}
                        {currentEnemy.intelligence && (
                          <div className="bg-purple-500/10 rounded p-1 text-center">
                            <Sparkles className="h-3 w-3 mx-auto mb-1 text-purple-400" />
                            <div className="text-muted-foreground">INT</div>
                            <div className="font-medium">{currentEnemy.intelligence}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Propriedades de Combate Avançadas */}
                  {(currentEnemy.critical_chance || currentEnemy.critical_damage) && (
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Combate Avançado:</div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {currentEnemy.critical_chance && (
                          <div className="bg-background/20 rounded p-2">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Crosshair className="h-3 w-3" />
                              <span>Crítico</span>
                            </div>
                            <div className="font-medium text-yellow-400">
                              {(currentEnemy.critical_chance * 100).toFixed(1)}%
                            </div>
                          </div>
                        )}
                        {currentEnemy.critical_damage && (
                          <div className="bg-background/20 rounded p-2">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Target className="h-3 w-3" />
                              <span>Dano Crit</span>
                            </div>
                            <div className="font-medium text-orange-400">
                              {(currentEnemy.critical_damage * 100).toFixed(0)}%
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Resistências */}
                  {(currentEnemy.physical_resistance || currentEnemy.magical_resistance || currentEnemy.debuff_resistance) && (
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Resistências:</div>
                      <div className="space-y-1">
                        {currentEnemy.physical_resistance && currentEnemy.physical_resistance > 0 && (
                          <div className="flex justify-between items-center text-xs">
                            <div className="flex items-center gap-1">
                              <Shield className="h-3 w-3 text-red-400" />
                              <span>Física</span>
                            </div>
                            <span className="text-red-400">{(currentEnemy.physical_resistance * 100).toFixed(0)}%</span>
                          </div>
                        )}
                        {currentEnemy.magical_resistance && currentEnemy.magical_resistance > 0 && (
                          <div className="flex justify-between items-center text-xs">
                            <div className="flex items-center gap-1">
                              <Sparkles className="h-3 w-3 text-blue-400" />
                              <span>Mágica</span>
                            </div>
                            <span className="text-blue-400">{(currentEnemy.magical_resistance * 100).toFixed(0)}%</span>
                          </div>
                        )}
                        {currentEnemy.debuff_resistance && currentEnemy.debuff_resistance > 0 && (
                          <div className="flex justify-between items-center text-xs">
                            <div className="flex items-center gap-1">
                              <ShieldCheck className="h-3 w-3 text-green-400" />
                              <span>Debuffs</span>
                            </div>
                            <span className="text-green-400">{(currentEnemy.debuff_resistance * 100).toFixed(0)}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Vulnerabilidades */}
                  {(currentEnemy.physical_vulnerability && currentEnemy.physical_vulnerability > 1) || 
                   (currentEnemy.magical_vulnerability && currentEnemy.magical_vulnerability > 1) && (
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Vulnerabilidades:</div>
                      <div className="space-y-1">
                        {currentEnemy.physical_vulnerability && currentEnemy.physical_vulnerability > 1 && (
                          <div className="flex justify-between items-center text-xs">
                            <div className="flex items-center gap-1">
                              <TrendingDown className="h-3 w-3 text-red-400" />
                              <span>Física</span>
                            </div>
                            <span className="text-red-400">+{((currentEnemy.physical_vulnerability - 1) * 100).toFixed(0)}%</span>
                          </div>
                        )}
                        {currentEnemy.magical_vulnerability && currentEnemy.magical_vulnerability > 1 && (
                          <div className="flex justify-between items-center text-xs">
                            <div className="flex items-center gap-1">
                              <TrendingDown className="h-3 w-3 text-blue-400" />
                              <span>Mágica</span>
                            </div>
                            <span className="text-blue-400">+{((currentEnemy.magical_vulnerability - 1) * 100).toFixed(0)}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Características Especiais */}
                  {(currentEnemy.primary_trait || currentEnemy.secondary_trait) && (
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Características:</div>
                      <div className="space-y-1">
                        {currentEnemy.primary_trait && (
                          <div className="flex items-center gap-2 text-xs">
                            {getTraitIcon(currentEnemy.primary_trait)}
                            <span className="text-purple-400">{translateTrait(currentEnemy.primary_trait)}</span>
                          </div>
                        )}
                        {currentEnemy.secondary_trait && (
                          <div className="flex items-center gap-2 text-xs">
                            {getTraitIcon(currentEnemy.secondary_trait)}
                            <span className="text-blue-400">{translateTrait(currentEnemy.secondary_trait)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Enemy Active Effects */}
                  {(currentEnemy.active_effects?.buffs?.length > 0 || 
                    currentEnemy.active_effects?.debuffs?.length > 0 ||
                    currentEnemy.active_effects?.dots?.length > 0) && (
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Efeitos Ativos:</div>
                      <div className="flex flex-wrap gap-1">
                        {currentEnemy.active_effects.buffs?.map((buff, index) => (
                          <Badge key={index} variant="outline" className="text-xs bg-green-500/10 text-green-400">
                            <Flame className="h-2 w-2 mr-1" />
                            Buff {buff.duration}t
                          </Badge>
                        ))}
                        {currentEnemy.active_effects.debuffs?.map((debuff, index) => (
                          <Badge key={index} variant="outline" className="text-xs bg-red-500/10 text-red-400">
                            <Snowflake className="h-2 w-2 mr-1" />
                            Debuff {debuff.duration}t
                          </Badge>
                        ))}
                        {currentEnemy.active_effects.dots?.map((dot, index) => (
                          <Badge key={index} variant="outline" className="text-xs bg-orange-500/10 text-orange-400">
                            <Target className="h-2 w-2 mr-1" />
                            DoT {dot.duration}t
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 