'use client';

import React, { useState, useEffect } from 'react';
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
  Hexagon,
  TrendingUp,
  TrendingDown,
  Crosshair,
  ShieldCheck
} from 'lucide-react';
import { GamePlayer, Enemy } from '@/resources/game/game-model';
import { formatLargeNumber } from '@/lib/utils';
import { ThiefIdleAnimation } from './ThiefIdleAnimation';
import { StatDisplay } from '@/components/ui/stat-display';

interface BattleArenaProps {
  player: GamePlayer;
  currentEnemy: Enemy;
  playerHpPercentage: number;
  playerManaPercentage: number;
  enemyHpPercentage: number;
  isPlayerTurn: boolean;
  onDamageDealt?: (damage: number, isPlayer: boolean, isCritical?: boolean, damageType?: string) => void;
}

interface FloatingDamage {
  id: string;
  damage: number;
  isPlayer: boolean;
  isCritical: boolean;
  damageType: string;
  timestamp: number;
}

export function BattleArena({ 
  player, 
  currentEnemy, 
  playerHpPercentage, 
  playerManaPercentage, 
  enemyHpPercentage, 
  isPlayerTurn,
}: BattleArenaProps) {
  // Log para debug das props recebidas
  useEffect(() => {
    console.log('[BattleArena] Props recebidas:');
    console.log('- player:', player?.name, `(andar: ${player?.floor})`);
    console.log('- currentEnemy:', currentEnemy?.name, `(HP: ${currentEnemy?.hp}/${currentEnemy?.maxHp})`);
    console.log('- playerHpPercentage:', playerHpPercentage);
    console.log('- enemyHpPercentage:', enemyHpPercentage);
    console.log('- isPlayerTurn:', isPlayerTurn);
  }, [player, currentEnemy, playerHpPercentage, enemyHpPercentage, isPlayerTurn]);

  const [showPlayerDetails, setShowPlayerDetails] = useState(false);
  const [showEnemyDetails, setShowEnemyDetails] = useState(false);
  const [floatingDamages, setFloatingDamages] = useState<FloatingDamage[]>([]);

  // OTIMIZADO: Sistema mais confiável para detectar mudanças de HP
  const [lastBattleState, setLastBattleState] = useState<{
    playerHp: number;
    enemyHp: number;
    battleId: string;
  }>({
    playerHp: player.hp,
    enemyHp: currentEnemy.hp,
    battleId: `${player.floor}-${currentEnemy.name}-${Date.now()}`
  });

  // OTIMIZADO: Detectar mudanças de HP de forma mais precisa
  useEffect(() => {
    // Gerar ID único para esta batalha
    const currentBattleId = `${player.floor}-${currentEnemy.name}`;
    
    // Se mudou o inimigo ou andar, resetar estado
    if (!lastBattleState.battleId.includes(currentBattleId)) {
      setLastBattleState({
        playerHp: player.hp,
        enemyHp: currentEnemy.hp,
        battleId: currentBattleId
      });
      return;
    }

    let hasChanges = false;

    // Detectar dano no jogador (apenas se HP diminuiu significativamente)
    if (player.hp < lastBattleState.playerHp && (lastBattleState.playerHp - player.hp) >= 1) {
      const damage = lastBattleState.playerHp - player.hp;
      console.log(`[BattleArena] Jogador recebeu ${damage} de dano`);
      showFloatingDamage(damage, true, false, 'physical');
      hasChanges = true;
    }

    // Detectar dano no inimigo (apenas se HP diminuiu significativamente)
    if (currentEnemy.hp < lastBattleState.enemyHp && (lastBattleState.enemyHp - currentEnemy.hp) >= 1) {
      const damage = lastBattleState.enemyHp - currentEnemy.hp;
      const isCritical = damage > (player.atk * 1.5);
      console.log(`[BattleArena] Inimigo recebeu ${damage} de dano ${isCritical ? '(CRÍTICO)' : ''}`);
      showFloatingDamage(damage, false, isCritical, 'physical');
      hasChanges = true;
    }

    // Atualizar estado apenas se houve mudanças
    if (hasChanges) {
      setLastBattleState({
        playerHp: player.hp,
        enemyHp: currentEnemy.hp,
        battleId: currentBattleId
      });
    }
  }, [player.hp, currentEnemy.hp, player.atk, player.floor, currentEnemy.name]);

  const showFloatingDamage = (damage: number, isPlayer: boolean, isCritical: boolean, damageType: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    const newDamage: FloatingDamage = {
      id,
      damage,
      isPlayer,
      isCritical,
      damageType,
      timestamp: Date.now()
    };

    setFloatingDamages(prev => [...prev, newDamage]);

    // Remover após animação
    setTimeout(() => {
      setFloatingDamages(prev => prev.filter(d => d.id !== id));
    }, 2000);
  };

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
        <CardContent className="p-3 md:p-6">
          {/* Battle Header - Compacto */}
          <div className="text-center mb-3 md:mb-6">
            <div className="flex items-center justify-center gap-2 md:gap-3 mb-2">
              <Badge variant="outline" className="px-2 py-1 text-xs bg-background/50">
                <Sword className="h-3 w-3 mr-1" />
                Andar {player.floor}
              </Badge>
              <div className="h-1.5 w-1.5 md:h-2 md:w-2 rounded-full bg-primary animate-pulse"></div>
              <Badge variant={isPlayerTurn ? "default" : "secondary"} className="px-2 py-1 text-xs bg-background/50">
                {isPlayerTurn ? "Seu Turno" : "Turno do Inimigo"}
              </Badge>
            </div>
          </div>

          {/* Main Battle Display - Layout Responsivo */}
          <div className="grid grid-cols-2 gap-3 md:gap-8 items-start">
            
            {/* Player Side */}
            <div className="space-y-2 md:space-y-4">
              {/* Player Avatar & Basic Info - Compacto */}
              <div className="text-center relative">
                <div className="relative inline-block mb-2 md:mb-4">
                  <div className={`w-16 h-16 md:w-24 md:h-24 lg:w-28 lg:h-28 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border-2 md:border-3 flex items-center justify-center transition-all duration-500 overflow-hidden ${
                    isPlayerTurn 
                      ? 'border-blue-500 shadow-xl md:shadow-2xl shadow-blue-500/40 scale-105 md:scale-110' 
                      : 'border-blue-500/30 scale-100'
                  }`}>
                    <ThiefIdleAnimation 
                      size={64} 
                      className="scale-75 md:scale-100 lg:scale-110" 
                    />
                  </div>
                  {isPlayerTurn && (
                    <div className="absolute -top-1 -right-1 md:-top-2 md:-right-2">
                      <div className="w-3 h-3 md:w-5 md:h-5 bg-blue-500 rounded-full animate-ping"></div>
                      <div className="absolute top-0 right-0 w-3 h-3 md:w-5 md:h-5 bg-blue-500 rounded-full"></div>
                    </div>
                  )}
                  {player.isDefending && (
                    <div className="absolute -bottom-1 -left-1 md:-bottom-2 md:-left-2">
                      <div className="w-6 h-6 md:w-8 md:h-8 bg-blue-600/90 rounded-full flex items-center justify-center border-2 border-background">
                        <Shield className="h-3 w-3 md:h-4 md:w-4 text-white" />
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="space-y-1 md:space-y-2">
                  <h3 className="font-bold text-sm md:text-lg lg:text-xl flex items-center justify-center gap-1 md:gap-2">
                    <Crown className="h-3 w-3 md:h-5 md:w-5 text-yellow-500" />
                    <span className="truncate">{player.name}</span>
                  </h3>
                  <div className="flex items-center justify-center gap-1 md:gap-2 flex-wrap">
                    <Badge variant="outline" className="bg-background/50 text-xs px-1 md:px-2">
                      <Star className="h-2 w-2 md:h-3 md:w-3 mr-1" />
                      Nv {player.level}
                    </Badge>
                    <Badge variant="outline" className="bg-background/50 text-yellow-400 text-xs px-1 md:px-2">
                      {player.gold.toLocaleString('pt-BR')}G
                    </Badge>
                  </div>
                </div>

                {/* Floating Damage for Player */}
                {floatingDamages
                  .filter(d => d.isPlayer)
                  .map(damage => (
                    <div
                      key={damage.id}
                      className={`absolute pointer-events-none z-20 font-bold text-lg animate-damage-float ${
                        damage.isCritical
                          ? 'text-red-400 text-2xl animate-damage-critical'
                          : 'text-red-300'
                      }`}
                      style={{
                        left: '50%',
                        top: '20%',
                        transform: 'translateX(-50%)',
                        textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                      }}
                    >
                      -{damage.damage}
                      {damage.isCritical && (
                        <span className="ml-1 text-yellow-400 text-sm">CRÍTICO!</span>
                      )}
                    </div>
                  ))}
              </div>

              {/* Player Health & Mana - Compacto */}
              <div className="space-y-2 md:space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-1">
                      <Heart className="h-3 w-3 md:h-4 md:w-4 text-red-500" />
                      <span className="font-medium text-xs md:text-sm">HP</span>
                    </div>
                    <span className="text-xs md:text-sm font-bold">{player.hp}/{player.max_hp}</span>
                  </div>
                  <div className="relative">
                    <Progress 
                      value={playerHpPercentage} 
                      className="h-2 md:h-3"
                      style={{
                        background: 'rgba(0,0,0,0.2)'
                      }}
                    />
                    <div 
                      className={`absolute top-0 left-0 h-2 md:h-3 rounded-full transition-all duration-300 ${
                        playerHpPercentage >= 70 ? 'bg-green-500' :
                        playerHpPercentage >= 40 ? 'bg-yellow-500' :
                        playerHpPercentage >= 20 ? 'bg-orange-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${playerHpPercentage}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-1">
                      <Sparkles className="h-3 w-3 md:h-4 md:w-4 text-blue-500" />
                      <span className="font-medium text-xs md:text-sm">MP</span>
                    </div>
                    <span className="text-xs md:text-sm font-bold">{player.mana}/{player.max_mana}</span>
                  </div>
                  <div className="relative">
                    <Progress 
                      value={playerManaPercentage} 
                      className="h-2 md:h-3"
                      style={{
                        background: 'rgba(0,0,0,0.2)'
                      }}
                    />
                    <div 
                      className={`absolute top-0 left-0 h-2 md:h-3 rounded-full transition-all duration-300 ${
                        playerManaPercentage >= 70 ? 'bg-blue-500' :
                        playerManaPercentage >= 40 ? 'bg-cyan-500' :
                        playerManaPercentage >= 20 ? 'bg-indigo-500' : 'bg-purple-500'
                      }`}
                      style={{ width: `${playerManaPercentage}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Player Combat Stats - Grid Adaptativo */}
              <div className={`grid gap-1 md:gap-2 ${player.magic_attack && player.magic_attack > 0 ? 'grid-cols-4' : 'grid-cols-3'}`}>
                <div className="bg-red-500/10 border border-red-500/20 rounded p-1 md:p-2 text-center">
                  <Sword className="h-3 w-3 md:h-4 md:w-4 mx-auto mb-1 text-red-400" />
                  <div className="text-xs text-red-300 mb-1">ATK</div>
                  <div className="text-xs font-bold text-red-400">
                    <StatDisplay 
                      value={player.atk}
                      baseValue={player.base_atk}
                      equipmentBonus={player.equipment_atk_bonus}
                      size="sm"
                      showTooltip={true}
                    />
                  </div>
                </div>
                
                {/* Magic Attack - Novo sistema */}
                {player.magic_attack && player.magic_attack > 0 && (
                  <div className="bg-purple-500/10 border border-purple-500/20 rounded p-1 md:p-2 text-center">
                    <Sparkles className="h-3 w-3 md:h-4 md:w-4 mx-auto mb-1 text-purple-400" />
                    <div className="text-xs text-purple-300 mb-1">MAG</div>
                    <div className="text-xs font-bold text-purple-400">
                      {player.magic_attack}
                    </div>
                  </div>
                )}
                
                <div className="bg-blue-500/10 border border-blue-500/20 rounded p-1 md:p-2 text-center">
                  <Shield className="h-3 w-3 md:h-4 md:w-4 mx-auto mb-1 text-blue-400" />
                  <div className="text-xs text-blue-300 mb-1">DEF</div>
                  <div className="text-xs font-bold text-blue-400">
                    <StatDisplay 
                      value={player.def}
                      baseValue={player.base_def}
                      equipmentBonus={player.equipment_def_bonus}
                      size="sm"
                      showTooltip={true}
                    />
                  </div>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded p-1 md:p-2 text-center">
                  <Zap className="h-3 w-3 md:h-4 md:w-4 mx-auto mb-1 text-yellow-400" />
                  <div className="text-xs text-yellow-300 mb-1">SPD</div>
                  <div className="text-xs font-bold text-yellow-400">
                    <StatDisplay 
                      value={player.speed}
                      baseValue={player.base_speed}
                      equipmentBonus={player.equipment_speed_bonus}
                      size="sm"
                      showTooltip={true}
                    />
                  </div>
                </div>
              </div>

              {/* Player Extended Stats Toggle - Apenas Desktop */}
              <div className="hidden md:block">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPlayerDetails(!showPlayerDetails)}
                  className="w-full h-8 text-xs bg-background/30 hover:bg-background/50"
                >
                  {showPlayerDetails ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                  {showPlayerDetails ? 'Menos' : 'Mais'} Detalhes
                </Button>

                {/* Extended Player Details - Apenas Desktop */}
                {showPlayerDetails && (
                  <div className="space-y-3 pt-2 border-t border-border/50 animate-in slide-in-from-top-2 duration-300">
                    {/* XP Progress Bar */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 text-yellow-500" />
                          <span className="font-medium text-xs text-muted-foreground">Experiência</span>
                        </div>
                        <div className="text-xs font-bold">
                          <span className="text-yellow-400">{formatLargeNumber(player.xp)}</span>
                          <span className="text-muted-foreground mx-1">/</span>
                          <span className="text-muted-foreground">{formatLargeNumber(player.xp_next_level)}</span>
                        </div>
                      </div>
                      <div className="relative">
                        <div className="relative">
                          <Progress 
                            value={(player.xp / player.xp_next_level) * 100} 
                            className="h-2"
                            style={{
                              background: 'rgba(0,0,0,0.2)'
                            }}
                          />
                          <div 
                            className="absolute top-0 left-0 h-2 bg-gradient-to-r from-amber-400 via-yellow-500 to-orange-400 rounded-full transition-all duration-300"
                            style={{ width: `${(player.xp / player.xp_next_level) * 100}%` }}
                          />
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 via-yellow-500/5 to-yellow-500/10 rounded-full pointer-events-none"></div>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Nível {player.level}</span>
                        <span className="text-yellow-400 font-medium">
                          -{formatLargeNumber(player.xp_next_level - player.xp)} para nv {player.level + 1}
                        </span>
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
                                {player.critical_chance.toFixed(1)}%
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
                                {(player.critical_damage || 0).toFixed(0)}%
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* DEBUG: Skills do Personagem */}
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Habilidades:</div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {(player.sword_mastery || 0) > 1 && (
                          <div className="bg-red-500/10 rounded p-1 text-center">
                            <Sword className="h-3 w-3 mx-auto mb-1 text-red-400" />
                            <div className="text-muted-foreground">Espada</div>
                            <div className="font-medium">Lv {player.sword_mastery}</div>
                            <div className="text-xs text-muted-foreground">{player.sword_mastery_xp || 0} XP</div>
                          </div>
                        )}
                        {(player.axe_mastery || 0) > 1 && (
                          <div className="bg-orange-500/10 rounded p-1 text-center">
                            <Target className="h-3 w-3 mx-auto mb-1 text-orange-400" />
                            <div className="text-muted-foreground">Machado</div>
                            <div className="font-medium">Lv {player.axe_mastery}</div>
                            <div className="text-xs text-muted-foreground">{player.axe_mastery_xp || 0} XP</div>
                          </div>
                        )}
                        {(player.blunt_mastery || 0) > 1 && (
                          <div className="bg-brown-500/10 rounded p-1 text-center">
                            <Activity className="h-3 w-3 mx-auto mb-1 text-brown-400" />
                            <div className="text-muted-foreground">Concussão</div>
                            <div className="font-medium">Lv {player.blunt_mastery}</div>
                            <div className="text-xs text-muted-foreground">{player.blunt_mastery_xp || 0} XP</div>
                          </div>
                        )}
                        {(player.defense_mastery || 0) > 1 && (
                          <div className="bg-blue-500/10 rounded p-1 text-center">
                            <Shield className="h-3 w-3 mx-auto mb-1 text-blue-400" />
                            <div className="text-muted-foreground">Defesa</div>
                            <div className="font-medium">Lv {player.defense_mastery}</div>
                            <div className="text-xs text-muted-foreground">{player.defense_mastery_xp || 0} XP</div>
                          </div>
                        )}
                        {(player.magic_mastery || 0) > 1 && (
                          <div className="bg-purple-500/10 rounded p-1 text-center">
                            <Sparkles className="h-3 w-3 mx-auto mb-1 text-purple-400" />
                            <div className="text-muted-foreground">Magia</div>
                            <div className="font-medium">Lv {player.magic_mastery}</div>
                            <div className="text-xs text-muted-foreground">{player.magic_mastery_xp || 0} XP</div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Pontos de Atributo Disponíveis */}
                    {Boolean(player.attribute_points && player.attribute_points > 0) && (
                      <button 
                        onClick={() => {
                          // Disparar evento customizado para abrir o modal
                          window.dispatchEvent(new CustomEvent('openAttributeModal'));
                        }}
                        className="w-full bg-yellow-500/10 border border-yellow-500/20 rounded p-2 hover:bg-yellow-500/20 hover:border-yellow-500/40 transition-all duration-200 cursor-pointer relative overflow-hidden"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/5 via-yellow-500/10 to-yellow-500/5 animate-pulse"></div>
                        <div className="relative flex items-center gap-2 text-yellow-400">
                          <Star className="h-4 w-4 animate-pulse" />
                          <span className="text-sm font-medium">
                            {player.attribute_points} pontos de atributo disponíveis
                          </span>
                        </div>
                      </button>
                    )}
                    
                    {Boolean(player.isDefending) && (
                      <div className="flex items-center gap-2 text-blue-400 bg-blue-500/10 rounded p-2">
                        <Shield className="h-4 w-4" />
                        <span className="text-sm font-medium">Postura Defensiva Ativa</span>
                      </div>
                    )}
                    
                    {Boolean(player.defenseCooldown > 0) && (
                      <div className="flex items-center gap-2 text-orange-400 bg-orange-500/10 rounded p-2">
                        <Activity className="h-4 w-4" />
                        <span className="text-sm">Defesa em Cooldown: {player.defenseCooldown} turnos</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Enemy Side */}
            <div className="space-y-2 md:space-y-4">
              {/* Enemy Avatar & Basic Info - Compacto */}
              <div className="text-center relative">
                <div className="relative inline-block mb-2 md:mb-4">
                  <div className={`w-16 h-16 md:w-24 md:h-24 lg:w-28 lg:h-28 rounded-full bg-gradient-to-br from-red-500/20 to-orange-500/20 border-2 md:border-3 flex items-center justify-center text-2xl md:text-4xl lg:text-5xl transition-all duration-500 ${
                    !isPlayerTurn 
                      ? 'border-red-500 shadow-xl md:shadow-2xl shadow-red-500/40 scale-105 md:scale-110' 
                      : 'border-red-500/30 scale-100'
                  }`}>
                    {currentEnemy.image || '👾'}
                  </div>
                  {!isPlayerTurn && (
                    <div className="absolute -top-1 -right-1 md:-top-2 md:-right-2">
                      <div className="w-3 h-3 md:w-5 md:h-5 bg-red-500 rounded-full animate-ping"></div>
                      <div className="absolute top-0 right-0 w-3 h-3 md:w-5 md:h-5 bg-red-500 rounded-full"></div>
                    </div>
                  )}
                </div>
                
                <div className="space-y-1 md:space-y-2">
                  <h3 className="font-bold text-sm md:text-lg lg:text-xl flex items-center justify-center gap-1 md:gap-2">
                    <Skull className="h-3 w-3 md:h-5 md:w-5 text-red-500" />
                    <span className="truncate">{currentEnemy.name}</span>
                  </h3>
                  <div className="flex items-center justify-center gap-1 md:gap-2 flex-wrap">
                    <Badge variant="outline" className="bg-background/50 text-xs px-1 md:px-2">
                      <Eye className="h-2 w-2 md:h-3 md:w-3 mr-1" />
                      Nv {currentEnemy.level}
                    </Badge>
                    {currentEnemy.tier && currentEnemy.tier > 1 && (
                      <Badge variant="outline" className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs px-1 md:px-2">
                        <Star className="h-2 w-2 md:h-3 md:w-3 mr-1" />
                        Tier {currentEnemy.tier}
                      </Badge>
                    )}
                    {currentEnemy.is_boss && (
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs px-1 md:px-2">
                        <Crown className="h-2 w-2 md:h-3 md:w-3 mr-1" />
                        BOSS
                      </Badge>
                    )}
                    <Badge className={`text-xs border px-1 md:px-2 ${getBehaviorColor(currentEnemy.behavior)}`}>
                      {translateBehavior(currentEnemy.behavior)}
                    </Badge>
                  </div>
                </div>

                {/* Floating Damage for Enemy */}
                {floatingDamages
                  .filter(d => !d.isPlayer)
                  .map(damage => (
                    <div
                      key={damage.id}
                      className={`absolute pointer-events-none z-20 font-bold text-lg animate-damage-float ${
                        damage.isCritical
                          ? 'text-orange-400 text-2xl animate-damage-critical'
                          : 'text-orange-300'
                      }`}
                      style={{
                        left: '50%',
                        top: '20%',
                        transform: 'translateX(-50%)',
                        textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                      }}
                    >
                      -{damage.damage}
                      {damage.isCritical && (
                        <span className="ml-1 text-yellow-400 text-sm">CRÍTICO!</span>
                      )}
                    </div>
                  ))}
              </div>

              {/* Enemy Health - Compacto */}
              <div className="space-y-2 md:space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-1">
                      <Heart className="h-3 w-3 md:h-4 md:w-4 text-red-500" />
                      <span className="font-medium text-xs md:text-sm">HP</span>
                    </div>
                    <span className="text-xs md:text-sm font-bold">{currentEnemy.hp}/{currentEnemy.maxHp}</span>
                  </div>
                  <div className="relative">
                    <Progress 
                      value={enemyHpPercentage} 
                      className="h-2 md:h-3"
                      style={{
                        background: 'rgba(0,0,0,0.2)'
                      }}
                    />
                    <div 
                      className={`absolute top-0 left-0 h-2 md:h-3 rounded-full transition-all duration-300 ${
                        enemyHpPercentage >= 70 ? 'bg-green-500' :
                        enemyHpPercentage >= 40 ? 'bg-yellow-500' :
                        enemyHpPercentage >= 20 ? 'bg-orange-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${enemyHpPercentage}%` }}
                    />
                  </div>
                </div>

                {Boolean(currentEnemy.mana > 0) && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-1">
                        <Sparkles className="h-3 w-3 md:h-4 md:w-4 text-purple-500" />
                        <span className="font-medium text-xs md:text-sm">MP</span>
                      </div>
                      <span className="text-xs md:text-sm font-bold">{currentEnemy.mana}</span>
                    </div>
                    <div className="relative">
                      <div className="h-2 md:h-3 bg-black/20 rounded-full"></div>
                      <div 
                        className="absolute top-0 left-0 h-2 md:h-3 bg-gradient-to-r from-blue-500 via-cyan-500 to-purple-500 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, (currentEnemy.mana / Math.max(currentEnemy.mana, 100)) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Enemy Combat Stats - Grid Compacto */}
              <div className="grid grid-cols-3 gap-1 md:gap-2">
                <div className="bg-red-500/10 border border-red-500/20 rounded p-1 md:p-2 text-center">
                  <Sword className="h-3 w-3 md:h-4 md:w-4 mx-auto mb-1 text-red-400" />
                  <div className="text-xs font-bold text-red-400">{currentEnemy.attack}</div>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded p-1 md:p-2 text-center">
                  <Shield className="h-3 w-3 md:h-4 md:w-4 mx-auto mb-1 text-blue-400" />
                  <div className="text-xs font-bold text-blue-400">{currentEnemy.defense}</div>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded p-1 md:p-2 text-center">
                  <Zap className="h-3 w-3 md:h-4 md:w-4 mx-auto mb-1 text-yellow-400" />
                  <div className="text-xs font-bold text-yellow-400">{currentEnemy.speed}</div>
                </div>
              </div>

              {/* Enemy Extended Stats Toggle - Apenas Desktop */}
              <div className="hidden md:block">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowEnemyDetails(!showEnemyDetails)}
                  className="w-full h-8 text-xs bg-background/30 hover:bg-background/50"
                >
                  {showEnemyDetails ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                  {showEnemyDetails ? 'Menos' : 'Mais'} Detalhes
                </Button>

                {/* Extended Enemy Details - Apenas Desktop */}
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
                    {Boolean(currentEnemy.strength || currentEnemy.dexterity || currentEnemy.intelligence) && (
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">Atributos Primários:</div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          {Boolean(currentEnemy.strength) && (
                            <div className="bg-red-500/10 rounded p-1 text-center">
                              <TrendingUp className="h-3 w-3 mx-auto mb-1 text-red-400" />
                              <div className="text-muted-foreground">FOR</div>
                              <div className="font-medium">{currentEnemy.strength}</div>
                            </div>
                          )}
                          {Boolean(currentEnemy.dexterity) && (
                            <div className="bg-green-500/10 rounded p-1 text-center">
                              <Zap className="h-3 w-3 mx-auto mb-1 text-green-400" />
                              <div className="text-muted-foreground">DES</div>
                              <div className="font-medium">{currentEnemy.dexterity}</div>
                            </div>
                          )}
                          {Boolean(currentEnemy.intelligence) && (
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
                    {Boolean(currentEnemy.critical_chance || currentEnemy.critical_damage) && (
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">Combate Avançado:</div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {Boolean(currentEnemy.critical_chance) && (
                            <div className="bg-background/20 rounded p-2">
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Crosshair className="h-3 w-3" />
                                <span>Crítico</span>
                              </div>
                              <div className="font-medium text-yellow-400">
                                {(currentEnemy.critical_chance || 0).toFixed(1)}%
                              </div>
                            </div>
                          )}
                          {Boolean(currentEnemy.critical_damage) && (
                            <div className="bg-background/20 rounded p-2">
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Target className="h-3 w-3" />
                                <span>Dano Crit</span>
                              </div>
                              <div className="font-medium text-orange-400">
                                {(currentEnemy.critical_damage || 0).toFixed(0)}%
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Resistências */}
                    {Boolean(currentEnemy.physical_resistance || currentEnemy.magical_resistance || currentEnemy.debuff_resistance) && (
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">Resistências:</div>
                        <div className="space-y-1">
                          {Boolean(currentEnemy.physical_resistance && currentEnemy.physical_resistance > 0) && (
                            <div className="flex justify-between items-center text-xs">
                              <div className="flex items-center gap-1">
                                <Shield className="h-3 w-3 text-red-400" />
                                <span>Física</span>
                              </div>
                              <span className="text-red-400">{((currentEnemy.physical_resistance || 0) * 100).toFixed(0)}%</span>
                            </div>
                          )}
                          {Boolean(currentEnemy.magical_resistance && currentEnemy.magical_resistance > 0) && (
                            <div className="flex justify-between items-center text-xs">
                              <div className="flex items-center gap-1">
                                <Sparkles className="h-3 w-3 text-blue-400" />
                                <span>Mágica</span>
                              </div>
                              <span className="text-blue-400">{((currentEnemy.magical_resistance || 0) * 100).toFixed(0)}%</span>
                            </div>
                          )}
                          {Boolean(currentEnemy.debuff_resistance && currentEnemy.debuff_resistance > 0) && (
                            <div className="flex justify-between items-center text-xs">
                              <div className="flex items-center gap-1">
                                <ShieldCheck className="h-3 w-3 text-green-400" />
                                <span>Debuffs</span>
                              </div>
                              <span className="text-green-400">{((currentEnemy.debuff_resistance || 0) * 100).toFixed(0)}%</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Vulnerabilidades */}
                    {Boolean((currentEnemy.physical_vulnerability && currentEnemy.physical_vulnerability > 1) ||
                     (currentEnemy.magical_vulnerability && currentEnemy.magical_vulnerability > 1)) && (
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">Vulnerabilidades:</div>
                        <div className="space-y-1">
                          {Boolean(currentEnemy.physical_vulnerability && currentEnemy.physical_vulnerability > 1) && (
                            <div className="flex justify-between items-center text-xs">
                              <div className="flex items-center gap-1">
                                <TrendingDown className="h-3 w-3 text-red-400" />
                                <span>Física</span>
                              </div>
                              <span className="text-red-400">+{(((currentEnemy.physical_vulnerability || 1) - 1) * 100).toFixed(0)}%</span>
                            </div>
                          )}
                          {Boolean(currentEnemy.magical_vulnerability && currentEnemy.magical_vulnerability > 1) && (
                            <div className="flex justify-between items-center text-xs">
                              <div className="flex items-center gap-1">
                                <TrendingDown className="h-3 w-3 text-blue-400" />
                                <span>Mágica</span>
                              </div>
                              <span className="text-blue-400">+{(((currentEnemy.magical_vulnerability || 1) - 1) * 100).toFixed(0)}%</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Características Especiais */}
                    {Boolean(currentEnemy.primary_trait || currentEnemy.secondary_trait) && (
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">Características:</div>
                        <div className="space-y-1">
                          {Boolean(currentEnemy.primary_trait) && (
                                                          <div className="flex items-center gap-2 text-xs">
                                {getTraitIcon(currentEnemy.primary_trait!)}
                                <span className="text-purple-400">{translateTrait(currentEnemy.primary_trait!)}</span>
                              </div>
                          )}
                          {Boolean(currentEnemy.secondary_trait) && (
                                                          <div className="flex items-center gap-2 text-xs">
                                {getTraitIcon(currentEnemy.secondary_trait!)}
                                <span className="text-blue-400">{translateTrait(currentEnemy.secondary_trait!)}</span>
                              </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 