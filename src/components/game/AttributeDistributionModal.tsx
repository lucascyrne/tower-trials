'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AttributeType, 
  AttributeDistribution, 
  CharacterStats, 
  PREDEFINED_BUILDS,
  getAttributeDescription,
  CharacterBuild 
} from '@/resources/game/models/character.model';
import { X, Plus, Minus, Zap, Heart, Brain, Eye, Star, RotateCcw, Wand2 } from 'lucide-react';

interface AttributeDistributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  characterStats: CharacterStats;
  onDistributePoints: (distribution: AttributeDistribution) => Promise<void>;
}

const AttributeDistributionModal: React.FC<AttributeDistributionModalProps> = ({
  isOpen,
  onClose,
  characterStats,
  onDistributePoints
}) => {
  const [distribution, setDistribution] = useState<AttributeDistribution>({
    strength: 0,
    dexterity: 0,
    intelligence: 0,
    wisdom: 0,
    vitality: 0,
    luck: 0
  });

  const [selectedBuild, setSelectedBuild] = useState<CharacterBuild | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Resetar distribuição quando o modal abrir
  useEffect(() => {
    if (isOpen) {
      setDistribution({
        strength: 0,
        dexterity: 0,
        intelligence: 0,
        wisdom: 0,
        vitality: 0,
        luck: 0
      });
      setSelectedBuild(null);
    }
  }, [isOpen]);

  const totalPointsToDistribute = Object.values(distribution).reduce((sum, value) => sum + value, 0);
  const remainingPoints = characterStats.attribute_points - totalPointsToDistribute;

  // Ícones para cada atributo
  const attributeIcons = {
    [AttributeType.STRENGTH]: Zap,
    [AttributeType.DEXTERITY]: Eye,
    [AttributeType.INTELLIGENCE]: Brain,
    [AttributeType.WISDOM]: Wand2,
    [AttributeType.VITALITY]: Heart,
    [AttributeType.LUCK]: Star
  };

  // Cores para cada atributo
  const attributeColors = {
    [AttributeType.STRENGTH]: 'text-red-400',
    [AttributeType.DEXTERITY]: 'text-green-400',
    [AttributeType.INTELLIGENCE]: 'text-blue-400',
    [AttributeType.WISDOM]: 'text-purple-400',
    [AttributeType.VITALITY]: 'text-pink-400',
    [AttributeType.LUCK]: 'text-yellow-400'
  };

  const handleAttributeChange = (attribute: AttributeType, change: number) => {
    const currentValue = distribution[attribute];
    const newValue = Math.max(0, currentValue + change);
    const maxValue = Math.min(50 - characterStats[attribute], remainingPoints + currentValue);
    
    if (newValue <= maxValue) {
      setDistribution(prev => ({
        ...prev,
        [attribute]: newValue
      }));
    }
  };

  const applyBuildSuggestion = (build: CharacterBuild) => {
    // Se a build já está selecionada, desselecionar
    if (selectedBuild?.name === build.name) {
      setSelectedBuild(null);
      resetDistribution();
      return;
    }
    
    setSelectedBuild(build);
    
    // Distribuir pontos baseado na build sugerida
    const pointsPerAttribute = Math.floor(remainingPoints / build.primary_attributes.length);
    const newDistribution = { ...distribution };
    
    // Resetar distribuição atual
    Object.keys(newDistribution).forEach(key => {
      newDistribution[key as keyof AttributeDistribution] = 0;
    });
    
    // Distribuir pontos nas características primárias
    build.primary_attributes.forEach((attr, index) => {
      const points = index === 0 ? pointsPerAttribute + (remainingPoints % build.primary_attributes.length) : pointsPerAttribute;
      newDistribution[attr] = Math.min(points, 50 - characterStats[attr]);
    });
    
    setDistribution(newDistribution);
  };

  const resetDistribution = () => {
    setDistribution({
      strength: 0,
      dexterity: 0,
      intelligence: 0,
      wisdom: 0,
      vitality: 0,
      luck: 0
    });
    setSelectedBuild(null);
  };

  const handleSubmit = async () => {
    if (totalPointsToDistribute === 0) return;
    
    setIsSubmitting(true);
    try {
      await onDistributePoints(distribution);
      onClose();
    } catch (error) {
      console.error('Erro ao distribuir pontos:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calcular preview dos stats após distribuição
  const previewStats = {
    strength: characterStats.strength + distribution.strength,
    dexterity: characterStats.dexterity + distribution.dexterity,
    intelligence: characterStats.intelligence + distribution.intelligence,
    wisdom: characterStats.wisdom + distribution.wisdom,
    vitality: characterStats.vitality + distribution.vitality,
    luck: characterStats.luck + distribution.luck,
    // Stats derivados estimados
    hp: characterStats.max_hp + (distribution.vitality * 8),
    mana: characterStats.max_mana + (distribution.intelligence * 5),
    atk: characterStats.atk + (distribution.strength * 2),
    def: characterStats.def + (distribution.vitality + distribution.wisdom),
    speed: characterStats.speed + Math.floor(distribution.dexterity * 1.5),
    critical_chance: characterStats.critical_chance + (distribution.luck * 0.5)
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 sm:p-4 z-50"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-gray-900 rounded-lg border border-gray-700 w-full max-w-5xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header responsivo */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-6 border-b border-gray-700 flex-shrink-0 gap-2">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold text-white truncate">Distribuir Atributos</h2>
              <p className="text-sm sm:text-base text-gray-400">
                Pontos disponíveis: <span className="text-yellow-400 font-bold">{remainingPoints}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors self-end sm:self-center"
            >
              <X size={24} />
            </button>
          </div>

          <div className="flex flex-col lg:flex-row flex-1 overflow-hidden min-h-0">
            {/* Área principal de distribuição */}
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              {/* Builds sugeridas - com scroll horizontal em mobile */}
              <div className="p-4 sm:p-6 border-b border-gray-700 flex-shrink-0">
                <h3 className="text-base sm:text-lg font-semibold text-white mb-3">Builds Sugeridas</h3>
                <div className="overflow-x-auto">
                  <div className="flex lg:grid lg:grid-cols-3 gap-3 min-w-max lg:min-w-0">
                    {PREDEFINED_BUILDS.map((build) => (
                      <motion.button
                        key={build.name}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => applyBuildSuggestion(build)}
                        className={`p-3 rounded-lg border transition-all text-left w-48 lg:w-auto flex-shrink-0 ${
                          selectedBuild?.name === build.name
                            ? 'border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/30'
                            : 'border-gray-600 hover:border-gray-500 bg-gray-800/50'
                        }`}
                      >
                        <div className="font-medium text-white text-sm">{build.name}</div>
                        <div className="text-xs text-gray-400 mt-1 overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{build.description}</div>
                        {selectedBuild?.name === build.name && (
                          <div className="text-xs text-blue-400 mt-2 font-medium">
                            ✓ Selecionado
                          </div>
                        )}
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Controles de atributos - com scroll otimizado */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
                  {Object.values(AttributeType).map((attribute) => {
                    const IconComponent = attributeIcons[attribute];
                    const currentValue = characterStats[attribute];
                    const distributedValue = distribution[attribute];
                    const finalValue = currentValue + distributedValue;
                    
                    return (
                      <motion.div
                        key={attribute}
                        layout
                        className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-800/50 rounded-lg border border-gray-700"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <IconComponent className={`w-5 h-5 sm:w-6 sm:h-6 ${attributeColors[attribute]} flex-shrink-0`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                              <span className="font-medium text-white capitalize text-sm sm:text-base truncate">
                                {attribute.replace('_', ' ')}
                              </span>
                              <span className="text-xs sm:text-sm text-gray-400">
                                {currentValue} → {finalValue}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
                              {getAttributeDescription(attribute)}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button
                            onClick={() => handleAttributeChange(attribute, -1)}
                            disabled={distributedValue === 0}
                            className="w-8 h-8 rounded-full bg-red-600/20 border border-red-500 text-red-400 
                                     disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-600/30 
                                     transition-colors flex items-center justify-center flex-shrink-0"
                          >
                            <Minus size={14} />
                          </button>
                          
                          <span className="w-8 text-center text-white font-medium text-sm">
                            {distributedValue}
                          </span>
                          
                          <button
                            onClick={() => handleAttributeChange(attribute, 1)}
                            disabled={remainingPoints === 0 || finalValue >= 50}
                            className="w-8 h-8 rounded-full bg-green-600/20 border border-green-500 text-green-400 
                                     disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-600/30 
                                     transition-colors flex items-center justify-center flex-shrink-0"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Preview dos stats - colapsível em mobile */}
            <div className="lg:w-80 border-t lg:border-t-0 lg:border-l border-gray-700 bg-gray-800/30 flex flex-col max-h-80 lg:max-h-none overflow-hidden">
              <div className="p-4 sm:p-6 flex-shrink-0">
                <h3 className="text-base sm:text-lg font-semibold text-white mb-4">Preview dos Stats</h3>
              </div>
              
              <div className="flex-1 overflow-y-auto px-4 sm:px-6">
                <div className="space-y-2 sm:space-y-3 pb-4">
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm">HP Máximo:</span>
                    <span className="text-white text-sm">
                      {characterStats.max_hp}
                      {distribution.vitality > 0 && (
                        <span className="text-green-400"> → {previewStats.hp}</span>
                      )}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm">Mana Máxima:</span>
                    <span className="text-white text-sm">
                      {characterStats.max_mana}
                      {distribution.intelligence > 0 && (
                        <span className="text-blue-400"> → {previewStats.mana}</span>
                      )}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm">Ataque:</span>
                    <span className="text-white text-sm">
                      {characterStats.atk}
                      {distribution.strength > 0 && (
                        <span className="text-red-400"> → {previewStats.atk}</span>
                      )}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm">Defesa:</span>
                    <span className="text-white text-sm">
                      {characterStats.def}
                      {(distribution.vitality > 0 || distribution.wisdom > 0) && (
                        <span className="text-purple-400"> → {previewStats.def}</span>
                      )}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm">Velocidade:</span>
                    <span className="text-white text-sm">
                      {characterStats.speed}
                      {distribution.dexterity > 0 && (
                        <span className="text-green-400"> → {previewStats.speed}</span>
                      )}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm">Chance Crítica:</span>
                    <span className="text-white text-sm">
                      {characterStats.critical_chance.toFixed(1)}%
                      {distribution.luck > 0 && (
                        <span className="text-yellow-400"> → {previewStats.critical_chance.toFixed(1)}%</span>
                      )}
                    </span>
                  </div>

                  {selectedBuild && (
                    <div className="mt-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                      <h4 className="font-medium text-blue-400 mb-2 text-sm">{selectedBuild.name}</h4>
                      <p className="text-xs text-gray-300 overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>{selectedBuild.description}</p>
                      <div className="mt-2 text-xs text-blue-300">
                        Estilo: {selectedBuild.playstyle.toUpperCase()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer responsivo */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 sm:p-6 border-t border-gray-700 flex-shrink-0">
            <button
              onClick={resetDistribution}
              className="flex items-center justify-center sm:justify-start gap-2 px-4 py-2 text-gray-400 hover:text-white transition-colors order-2 sm:order-1"
            >
              <RotateCcw size={16} />
              <span className="text-sm">Resetar</span>
            </button>
            
            <div className="flex gap-2 sm:gap-3 order-1 sm:order-2">
              <button
                onClick={onClose}
                className="flex-1 sm:flex-none px-4 sm:px-6 py-2 text-gray-400 hover:text-white transition-colors text-sm"
              >
                Cancelar
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSubmit}
                disabled={totalPointsToDistribute === 0 || isSubmitting}
                className="flex-1 sm:flex-none px-4 sm:px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                         disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm"
              >
                {isSubmitting ? 'Aplicando...' : `Aplicar (${totalPointsToDistribute})`}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AttributeDistributionModal; 