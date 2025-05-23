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
        className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-gray-900 rounded-lg border border-gray-700 max-w-6xl w-full max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-700">
            <div>
              <h2 className="text-2xl font-bold text-white">Distribuir Atributos</h2>
              <p className="text-gray-400">Pontos disponíveis: <span className="text-yellow-400 font-bold">{remainingPoints}</span></p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          <div className="flex flex-col lg:flex-row">
            {/* Área principal de distribuição */}
            <div className="flex-1 p-6">
              {/* Builds sugeridas */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white mb-3">Builds Sugeridas</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {PREDEFINED_BUILDS.map((build) => (
                    <motion.button
                      key={build.name}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => applyBuildSuggestion(build)}
                      className={`p-3 rounded-lg border transition-all text-left ${
                        selectedBuild?.name === build.name
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-gray-600 hover:border-gray-500 bg-gray-800/50'
                      }`}
                    >
                      <div className="font-medium text-white text-sm">{build.name}</div>
                      <div className="text-xs text-gray-400 mt-1">{build.description}</div>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Controles de atributos */}
              <div className="space-y-4">
                {Object.values(AttributeType).map((attribute) => {
                  const IconComponent = attributeIcons[attribute];
                  const currentValue = characterStats[attribute];
                  const distributedValue = distribution[attribute];
                  const finalValue = currentValue + distributedValue;
                  
                  return (
                    <motion.div
                      key={attribute}
                      layout
                      className="flex items-center gap-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <IconComponent className={`w-6 h-6 ${attributeColors[attribute]}`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white capitalize">
                              {attribute.replace('_', ' ')}
                            </span>
                            <span className="text-sm text-gray-400">
                              {currentValue} → {finalValue}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">
                            {getAttributeDescription(attribute)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAttributeChange(attribute, -1)}
                          disabled={distributedValue === 0}
                          className="w-8 h-8 rounded-full bg-red-600/20 border border-red-500 text-red-400 
                                   disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-600/30 
                                   transition-colors flex items-center justify-center"
                        >
                          <Minus size={16} />
                        </button>
                        
                        <span className="w-8 text-center text-white font-medium">
                          {distributedValue}
                        </span>
                        
                        <button
                          onClick={() => handleAttributeChange(attribute, 1)}
                          disabled={remainingPoints === 0 || finalValue >= 50}
                          className="w-8 h-8 rounded-full bg-green-600/20 border border-green-500 text-green-400 
                                   disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-600/30 
                                   transition-colors flex items-center justify-center"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Preview dos stats */}
            <div className="lg:w-80 p-6 border-l border-gray-700 bg-gray-800/30">
              <h3 className="text-lg font-semibold text-white mb-4">Preview dos Stats</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">HP Máximo:</span>
                  <span className="text-white">
                    {characterStats.max_hp}
                    {distribution.vitality > 0 && (
                      <span className="text-green-400"> → {previewStats.hp}</span>
                    )}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-400">Mana Máxima:</span>
                  <span className="text-white">
                    {characterStats.max_mana}
                    {distribution.intelligence > 0 && (
                      <span className="text-blue-400"> → {previewStats.mana}</span>
                    )}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-400">Ataque:</span>
                  <span className="text-white">
                    {characterStats.atk}
                    {distribution.strength > 0 && (
                      <span className="text-red-400"> → {previewStats.atk}</span>
                    )}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-400">Defesa:</span>
                  <span className="text-white">
                    {characterStats.def}
                    {(distribution.vitality > 0 || distribution.wisdom > 0) && (
                      <span className="text-purple-400"> → {previewStats.def}</span>
                    )}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-400">Velocidade:</span>
                  <span className="text-white">
                    {characterStats.speed}
                    {distribution.dexterity > 0 && (
                      <span className="text-green-400"> → {previewStats.speed}</span>
                    )}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-400">Chance Crítica:</span>
                  <span className="text-white">
                    {characterStats.critical_chance.toFixed(1)}%
                    {distribution.luck > 0 && (
                      <span className="text-yellow-400"> → {previewStats.critical_chance.toFixed(1)}%</span>
                    )}
                  </span>
                </div>
              </div>

              {selectedBuild && (
                <div className="mt-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                  <h4 className="font-medium text-blue-400 mb-2">{selectedBuild.name}</h4>
                  <p className="text-sm text-gray-300">{selectedBuild.description}</p>
                  <div className="mt-2 text-xs text-blue-300">
                    Estilo: {selectedBuild.playstyle.toUpperCase()}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-700">
            <button
              onClick={resetDistribution}
              className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              <RotateCcw size={16} />
              Resetar
            </button>
            
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSubmit}
                disabled={totalPointsToDistribute === 0 || isSubmitting}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                         disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {isSubmitting ? 'Aplicando...' : `Aplicar (${totalPointsToDistribute} pontos)`}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AttributeDistributionModal; 