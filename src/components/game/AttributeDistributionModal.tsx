import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Star, TrendingUp, Plus, Minus, Save, RotateCcw, Heart, Zap, Sparkles, Eye, Target } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { type GamePlayer } from '@/resources/game/game-model';
import { CharacterService } from '@/resources/game/character.service';
import { toast } from 'sonner';
import { useMobileLandscape } from '@/hooks/use-media-query';

interface AttributeDistributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  character: GamePlayer;
  onAttributesUpdated?: (updatedCharacter: GamePlayer) => void;
}

interface AttributeDistribution {
  strength: number;
  dexterity: number;
  intelligence: number;
  wisdom: number;
  vitality: number;
  luck: number;
}

const AttributeDistributionModal: React.FC<AttributeDistributionModalProps> = ({
  isOpen,
  onClose,
  character,
  onAttributesUpdated
}) => {
  const [distribution, setDistribution] = useState<AttributeDistribution>({
    strength: 0,
    dexterity: 0,
    intelligence: 0,
    wisdom: 0,
    vitality: 0,
    luck: 0
  });
  const [isDistributing, setIsDistributing] = useState(false);
  
  // Usar hook para detectar mobile landscape
  const isMobileLandscape = useMobileLandscape();

  const totalPointsToDistribute = Object.values(distribution).reduce((sum, value) => sum + value, 0);
  const availablePoints = (character.attribute_points || 0) - totalPointsToDistribute;

  const handleIncrement = (attribute: keyof AttributeDistribution) => {
    if (availablePoints > 0) {
      setDistribution(prev => ({
        ...prev,
        [attribute]: prev[attribute] + 1
      }));
    }
  };

  const handleDecrement = (attribute: keyof AttributeDistribution) => {
    if (distribution[attribute] > 0) {
      setDistribution(prev => ({
        ...prev,
        [attribute]: prev[attribute] - 1
      }));
    }
  };

  const handleReset = () => {
    setDistribution({
      strength: 0,
      dexterity: 0,
      intelligence: 0,
      wisdom: 0,
      vitality: 0,
      luck: 0
    });
  };

  const handleSubmit = async () => {
    if (totalPointsToDistribute === 0) return;
    
    setIsDistributing(true);
    try {
      const response = await CharacterService.distributeAttributePoints(character.id, distribution);
      
      if (response.success && response.data?.new_stats) {
        toast.success('Pontos distribuídos com sucesso!');
        
        // Atualizar o personagem com os novos stats
        if (onAttributesUpdated) {
          const updatedCharacter: GamePlayer = {
            ...character,
            ...response.data.new_stats,
            attribute_points: response.data.new_stats.attribute_points
          };
          onAttributesUpdated(updatedCharacter);
        }
        
        handleReset();
        onClose();
      } else {
        toast.error('Erro ao distribuir pontos', {
          description: response.error || response.data?.message
        });
      }
    } catch (error) {
      console.error('Erro ao distribuir pontos:', error);
      toast.error('Erro ao distribuir pontos');
    } finally {
      setIsDistributing(false);
    }
  };

  // Configuração dos atributos
  const attributeConfig = {
    strength: {
      label: 'Força',
      icon: TrendingUp,
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/20',
      benefit: '+2 Ataque + 0.5% Dano Crítico'
    },
    dexterity: {
      label: 'Destreza', 
      icon: Zap,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/20',
      benefit: '+1.5 Velocidade + 0.3% Crítico'
    },
    intelligence: {
      label: 'Inteligência',
      icon: Sparkles,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/20',
      benefit: '+5 Mana + 10% Dano Mágico'
    },
    wisdom: {
      label: 'Sabedoria',
      icon: Eye,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20',
      benefit: '+1 Def + 5% Magia + 12% Cura'
    },
    vitality: {
      label: 'Vitalidade',
      icon: Heart,
      color: 'text-pink-400',
      bgColor: 'bg-pink-500/10',
      borderColor: 'border-pink-500/20',
      benefit: '+8 HP + 1 Defesa'
    },
    luck: {
      label: 'Sorte',
      icon: Star,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/20',
      benefit: '+0.5% Crítico + 1% Dano Crítico'
    }
  };

  if (!isOpen || !character.attribute_points || character.attribute_points === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`overflow-hidden ${
        isMobileLandscape 
          ? 'max-w-[95vw] max-h-[95vh] w-[95vw] p-3' 
          : 'sm:max-w-2xl max-h-[90vh] overflow-y-auto'
      }`}>
        <DialogHeader className={`${isMobileLandscape ? 'pb-2' : 'text-center'}`}>
          {!isMobileLandscape && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="mx-auto w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mb-4"
            >
              <Star className="h-8 w-8 text-yellow-500" />
            </motion.div>
          )}
          
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className={`flex items-center gap-3 ${
              isMobileLandscape ? 'justify-start' : 'flex-col text-center'
            }`}
          >
            {isMobileLandscape && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", duration: 0.5 }}
                className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center flex-shrink-0"
              >
                <Star className="h-5 w-5 text-yellow-500" />
              </motion.div>
            )}
            
            <div className={isMobileLandscape ? 'text-left flex-1' : 'text-center'}>
              <DialogTitle className={`font-bold ${isMobileLandscape ? 'text-lg' : 'text-xl'}`}>
                Distribuir Pontos de Atributo
              </DialogTitle>
              
              <DialogDescription asChild>
                <div className={`${isMobileLandscape ? 'flex items-center justify-between mt-1' : 'text-center space-y-3'}`}>
                  <Badge variant="outline" className={`bg-yellow-500/10 border-yellow-500/30 text-yellow-400 ${
                    isMobileLandscape ? 'px-2 py-1 text-xs' : 'px-3 py-1'
                  }`}>
                    <Star className={`mr-2 ${isMobileLandscape ? 'h-3 w-3' : 'h-4 w-4'}`} />
                    {availablePoints} pontos
                  </Badge>
                  
                  {!isMobileLandscape && (
                    <p className="text-sm text-muted-foreground">
                      Distribua seus pontos estrategicamente para fortalecer seu personagem na torre.
                    </p>
                  )}
                </div>
              </DialogDescription>
            </div>
          </motion.div>
        </DialogHeader>

        {/* Conteúdo Principal - Layout Adaptativo */}
        <div className={`${isMobileLandscape ? 'overflow-y-auto max-h-[calc(95vh-120px)]' : ''}`}>
          <motion.div 
            className={`${isMobileLandscape ? 'py-2' : 'space-y-4 py-4'}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            {/* Atributos com Controles - Layout Adaptativo */}
            <div className={`${
              isMobileLandscape 
                ? 'grid grid-cols-2 gap-2 mb-3' 
                : 'space-y-3'
            }`}>
              {Object.entries(attributeConfig).map(([key, config]) => {
                const attribute = key as keyof AttributeDistribution;
                const currentValue = character[attribute] || 0;
                const Icon = config.icon;
                
                return (
                  <motion.div
                    key={attribute}
                    className={`flex items-center gap-2 rounded-lg border ${config.bgColor} ${config.borderColor} ${
                      isMobileLandscape ? 'p-2 text-xs' : 'gap-3 p-3'
                    }`}
                    whileHover={{ scale: 1.01 }}
                  >
                    {/* Ícone e Info */}
                    <div className={`flex items-center gap-2 flex-1 ${
                      isMobileLandscape ? 'min-w-0' : 'gap-3'
                    }`}>
                      <Icon className={`flex-shrink-0 ${config.color} ${
                        isMobileLandscape ? 'h-4 w-4' : 'h-5 w-5'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className={`font-semibold ${
                          isMobileLandscape ? 'text-xs truncate' : 'text-sm'
                        }`}>
                          {config.label}
                        </div>
                        {!isMobileLandscape && (
                          <div className="text-xs text-muted-foreground">
                            {config.benefit}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Valor Atual */}
                    <div className={`text-center ${
                      isMobileLandscape ? 'min-w-[40px]' : 'min-w-[60px]'
                    }`}>
                      <div className={`font-bold ${
                        isMobileLandscape ? 'text-xs' : 'text-sm'
                      }`}>
                        {currentValue}
                        {distribution[attribute] > 0 && (
                          <span className="text-green-400 ml-1">
                            +{distribution[attribute]}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Controles */}
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className={`rounded-full ${
                          isMobileLandscape ? 'h-6 w-6' : 'h-8 w-8'
                        }`}
                        onClick={() => handleDecrement(attribute)}
                        disabled={distribution[attribute] === 0}
                      >
                        <Minus className={isMobileLandscape ? 'h-3 w-3' : 'h-4 w-4'} />
                      </Button>
                      
                      <div className={`text-center font-mono ${
                        isMobileLandscape ? 'w-6 text-xs' : 'w-8 text-sm'
                      }`}>
                        {distribution[attribute]}
                      </div>
                      
                      <Button
                        size="icon"
                        variant="ghost"
                        className={`rounded-full ${
                          isMobileLandscape ? 'h-6 w-6' : 'h-8 w-8'
                        }`}
                        onClick={() => handleIncrement(attribute)}
                        disabled={availablePoints === 0}
                      >
                        <Plus className={isMobileLandscape ? 'h-3 w-3' : 'h-4 w-4'} />
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Preview dos Melhoramentos */}
            {totalPointsToDistribute > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className={`bg-primary/5 border border-primary/20 rounded-lg ${
                  isMobileLandscape ? 'p-2 mt-2' : 'p-3'
                }`}
              >
                <div className={`font-medium mb-2 flex items-center gap-2 ${
                  isMobileLandscape ? 'text-xs' : 'text-sm'
                }`}>
                  <Target className={`text-primary ${
                    isMobileLandscape ? 'h-3 w-3' : 'h-4 w-4'
                  }`} />
                  Preview dos Melhoramentos
                </div>
                <div className={`grid gap-1 ${
                  isMobileLandscape ? 'grid-cols-4 text-xs' : 'grid-cols-2 gap-2 text-xs'
                }`}>
                  {distribution.vitality > 0 && (
                    <div className="flex justify-between">
                      <span>HP:</span>
                      <span className="text-green-400">+{distribution.vitality * 8}</span>
                    </div>
                  )}
                  {distribution.intelligence > 0 && (
                    <div className="flex justify-between">
                      <span>Mana:</span>
                      <span className="text-blue-400">+{distribution.intelligence * 5}</span>
                    </div>
                  )}
                  {distribution.strength > 0 && (
                    <div className="flex justify-between">
                      <span>Ataque:</span>
                      <span className="text-red-400">+{distribution.strength * 2}</span>
                    </div>
                  )}
                  {distribution.dexterity > 0 && (
                    <div className="flex justify-between">
                      <span>Velocidade:</span>
                      <span className="text-green-400">+{Math.floor(distribution.dexterity * 1.5)}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* Botões de Ação - Layout Adaptativo */}
        <div className={`flex gap-2 ${isMobileLandscape ? 'pt-2' : 'pt-2'}`}>
          <Button
            variant="outline"
            onClick={onClose}
            className={`flex-1 ${
              isMobileLandscape ? 'text-xs h-8' : ''
            }`}
          >
            Cancelar
          </Button>
          
          {totalPointsToDistribute > 0 && (
            <Button
              variant="outline"
              onClick={handleReset}
              className={`flex-1 ${
                isMobileLandscape ? 'text-xs h-8' : ''
              }`}
            >
              <RotateCcw className={`mr-1 ${
                isMobileLandscape ? 'h-3 w-3' : 'h-4 w-4 mr-2'
              }`} />
              {isMobileLandscape ? 'Reset' : 'Resetar'}
            </Button>
          )}
          
          <Button
            onClick={handleSubmit}
            disabled={isDistributing || totalPointsToDistribute === 0}
            className={`flex-1 bg-emerald-500 hover:bg-emerald-600 ${
              isMobileLandscape ? 'text-xs h-8' : ''
            }`}
          >
            {isDistributing ? (
              <div className={`animate-spin rounded-full border-2 border-white border-t-transparent mr-1 ${
                isMobileLandscape ? 'h-3 w-3' : 'h-4 w-4 mr-2'
              }`} />
            ) : (
              <Save className={`mr-1 ${
                isMobileLandscape ? 'h-3 w-3' : 'h-4 w-4 mr-2'
              }`} />
            )}
            {isMobileLandscape ? `OK (${totalPointsToDistribute})` : `Confirmar (${totalPointsToDistribute})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AttributeDistributionModal; 