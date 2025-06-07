import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Coins, Star, Trophy, Sparkles, ShoppingBag, ArrowRight, Home, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatLargeNumber } from '@/lib/utils';

interface VictoryModalProps {
  isOpen: boolean;
  onContinue: () => void;
  onReturnToHub: () => void;
  onOpenAttributeModal: () => void;
  rewards: {
    xp: number;
    gold: number;
    drops: { name: string; quantity: number }[];
  };
  leveledUp: boolean;
  newLevel?: number;
  hasAttributePoints: boolean;
}

export function VictoryModal({
  isOpen,
  onContinue,
  onReturnToHub,
  onOpenAttributeModal,
  rewards,
  leveledUp,
  newLevel,
  hasAttributePoints
}: VictoryModalProps) {
  const [isMobileLandscape, setIsMobileLandscape] = useState(false);
  
  // Detectar mobile landscape com melhor precisão
  useEffect(() => {
    const checkMobileLandscape = () => {
      const isMobile = window.innerWidth <= 768;
      const isLandscape = window.innerWidth > window.innerHeight;
      const isShortHeight = window.innerHeight <= 600;
      const isVeryShortHeight = window.innerHeight <= 500;
      
      setIsMobileLandscape(isMobile && isLandscape && (isShortHeight || isVeryShortHeight));
    };

    checkMobileLandscape();
    window.addEventListener('resize', checkMobileLandscape);
    window.addEventListener('orientationchange', () => {
      // Aguardar um pouco mais para a orientação se estabilizar
      setTimeout(checkMobileLandscape, 150);
    });

    return () => {
      window.removeEventListener('resize', checkMobileLandscape);
      window.removeEventListener('orientationchange', checkMobileLandscape);
    };
  }, []);

  // Adicionar classes CSS customizadas para mobile landscape
  useEffect(() => {
    if (isMobileLandscape) {
      const style = document.createElement('style');
      style.textContent = `
        .victory-modal-landscape .scroll-area {
          max-height: calc(90vh - 140px);
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }
        .victory-modal-buttons {
          min-height: 32px !important;
          padding: 0.25rem 0.5rem !important;
          font-size: 0.75rem !important;
        }
        .victory-modal-landscape [data-radix-dialog-content] {
          max-height: 90vh !important;
        }
      `;
      document.head.appendChild(style);
      
      return () => {
        document.head.removeChild(style);
      };
    }
  }, [isMobileLandscape]);
  
  const handleContinue = () => {
    console.log('[VictoryModal] Botão Continuar clicado - chamando onContinue');
    onContinue();
  };
  
  const handleReturnToHub = () => {
    console.log('[VictoryModal] Botão Voltar ao Hub clicado - chamando onReturnToHub');
    onReturnToHub();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog open={isOpen}>
          <DialogContent className={`overflow-hidden ${
            isMobileLandscape 
              ? 'max-w-[98vw] max-h-[98vh] p-3 victory-modal-landscape w-[98vw]' 
              : 'sm:max-w-[425px]'
          }`}>
            {/* Header adaptativo */}
            <DialogHeader className={`relative ${isMobileLandscape ? 'pb-2' : ''}`}>
              {!isMobileLandscape && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", duration: 0.5 }}
                  className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 h-24 bg-yellow-500/20 rounded-full flex items-center justify-center"
                >
                  <Trophy className="h-12 w-12 text-yellow-500" />
                </motion.div>
              )}
              
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className={`flex items-center gap-3 ${
                  isMobileLandscape ? 'justify-start' : 'flex-col text-center pt-12'
                }`}
              >
                {isMobileLandscape && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", duration: 0.5 }}
                    className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center flex-shrink-0"
                  >
                    <Trophy className="h-5 w-5 text-yellow-500" />
                  </motion.div>
                )}
                
                <div className={isMobileLandscape ? 'text-left' : 'text-center'}>
                  <DialogTitle className={`font-bold ${isMobileLandscape ? 'text-base' : 'text-2xl'}`}>
                    Vitória!
                  </DialogTitle>
                  <DialogDescription className={`${isMobileLandscape ? 'text-xs' : ''}`}>
                    Você derrotou o inimigo e avançou para o próximo andar!
                  </DialogDescription>
                </div>
              </motion.div>
            </DialogHeader>

            {/* Conteúdo Principal - Layout Adaptativo */}
            <div className={isMobileLandscape ? 'scroll-area overflow-y-auto' : ''}>
              <motion.div 
                className={`${isMobileLandscape ? 'py-2' : 'space-y-4 py-4'}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                {/* Container de Recompensas */}
                <div className={`${
                  isMobileLandscape 
                    ? 'grid grid-cols-2 gap-2 mb-3' 
                    : 'space-y-4'
                }`}>
                  <motion.div 
                    className={`flex items-center gap-3 bg-primary/10 rounded-lg ${
                      isMobileLandscape ? 'p-2 text-base' : 'p-3 text-lg'
                    }`}
                    whileHover={{ scale: 1.02 }}
                  >
                    <Star className={`text-yellow-500 ${isMobileLandscape ? 'h-4 w-4' : 'h-6 w-6'}`} />
                    <div className="min-w-0 flex-1">
                      <div className={`font-semibold ${isMobileLandscape ? 'text-xs' : ''}`}>Experiência</div>
                      <div className={`font-bold text-primary ${isMobileLandscape ? 'text-sm' : 'text-2xl'}`}>
                        +{rewards.xp} XP
                      </div>
                    </div>
                  </motion.div>

                  <motion.div 
                    className={`flex items-center gap-3 bg-primary/10 rounded-lg ${
                      isMobileLandscape ? 'p-2 text-base' : 'p-3 text-lg'
                    }`}
                    whileHover={{ scale: 1.02 }}
                  >
                    <Coins className={`text-yellow-400 ${isMobileLandscape ? 'h-4 w-4' : 'h-6 w-6'}`} />
                    <div className="min-w-0 flex-1">
                      <div className={`font-semibold ${isMobileLandscape ? 'text-xs' : ''}`}>Ouro</div>
                      <div className={`font-bold text-primary ${isMobileLandscape ? 'text-sm' : 'text-2xl'}`}>
                        +{formatLargeNumber(rewards.gold)} Gold
                      </div>
                    </div>
                  </motion.div>
                </div>

                {/* Level Up Section */}
                {leveledUp && newLevel && (
                  <motion.div 
                    className={`rounded-lg bg-gradient-to-r from-primary/20 to-primary/30 text-center ${
                      isMobileLandscape ? 'p-2 mt-2' : 'p-4 mt-2'
                    }`}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.7, type: "spring" }}
                  >
                    <div className={`flex items-center gap-2 ${
                      isMobileLandscape ? 'justify-start mb-1' : 'justify-center mb-2'
                    }`}>
                      <Sparkles className={`text-primary ${isMobileLandscape ? 'h-4 w-4' : 'h-6 w-6'}`} />
                      <div className={`font-bold ${isMobileLandscape ? 'text-sm' : 'text-xl'}`}>
                        Nível {newLevel}!
                      </div>
                    </div>
                    
                    <div className={`opacity-80 ${
                      isMobileLandscape ? 'text-xs mb-1' : 'text-sm mb-2'
                    }`}>
                      Seu personagem evoluiu e ficou mais forte!
                    </div>
                    
                    <div className={`grid gap-1 ${
                      isMobileLandscape ? 'grid-cols-4 text-xs' : 'grid-cols-2 gap-2 text-sm'
                    }`}>
                      <div className={`bg-background/50 rounded ${isMobileLandscape ? 'p-1' : 'p-2'}`}>
                        HP +10
                      </div>
                      <div className={`bg-background/50 rounded ${isMobileLandscape ? 'p-1' : 'p-2'}`}>
                        Mana +5
                      </div>
                      <div className={`bg-background/50 rounded ${isMobileLandscape ? 'p-1' : 'p-2'}`}>
                        Ataque +2
                      </div>
                      <div className={`bg-background/50 rounded ${isMobileLandscape ? 'p-1' : 'p-2'}`}>
                        Defesa +1
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Drops Section */}
                {rewards.drops.length > 0 && (
                  <motion.div 
                    className={`bg-primary/10 rounded-lg ${
                      isMobileLandscape ? 'mt-2 p-2' : 'mt-4 p-4'
                    }`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.9 }}
                  >
                    <h4 className={`font-semibold flex items-center gap-2 ${
                      isMobileLandscape ? 'mb-1 text-xs' : 'mb-3'
                    }`}>
                      <ShoppingBag className={isMobileLandscape ? 'h-3 w-3' : 'h-5 w-5'} />
                      Itens Obtidos
                    </h4>
                    
                    <div className={`${
                      isMobileLandscape 
                        ? 'grid grid-cols-2 gap-1' 
                        : 'space-y-2'
                    }`}>
                      {rewards.drops.map((drop, index) => (
                        <motion.div 
                          key={index}
                          className={`flex items-center gap-2 bg-background/50 rounded ${
                            isMobileLandscape ? 'p-1 text-xs' : 'p-2'
                          }`}
                          initial={{ x: -20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: 1 + (index * 0.1) }}
                        >
                          <span className={isMobileLandscape ? 'text-xs' : 'text-xl'}>🎁</span>
                          <span className="flex-1 truncate">{drop.name}</span>
                          <span className="font-mono flex-shrink-0">x{drop.quantity}</span>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            </div>

            {/* Footer - Layout Adaptativo */}
            <DialogFooter className={`flex flex-col gap-2 ${isMobileLandscape ? 'mt-2' : 'mt-4'}`}>
              <div className={`w-full ${
                isMobileLandscape 
                  ? 'flex gap-2' 
                  : 'flex flex-col gap-2'
              }`}>
                {hasAttributePoints && (
                  <Button
                    onClick={onOpenAttributeModal}
                    className={`bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white shadow-lg ${
                      isMobileLandscape ? 'flex-1 victory-modal-buttons' : 'w-full'
                    }`}
                  >
                    <TrendingUp className={`mr-1 ${isMobileLandscape ? 'h-3 w-3' : 'h-4 w-4'}`} />
                    {isMobileLandscape ? 'Atributos' : 'Distribuir Pontos de Atributo'}
                  </Button>
                )}
                
                <Button 
                  onClick={handleReturnToHub} 
                  variant="outline"
                  className={`items-center justify-center ${
                    isMobileLandscape ? 'flex-1 victory-modal-buttons' : 'flex-1'
                  }`}
                >
                  <Home className={`mr-1 ${isMobileLandscape ? 'h-3 w-3' : 'h-4 w-4'}`} />
                  {isMobileLandscape ? 'Hub' : 'Voltar ao Hub'}
                </Button>
                
                <Button 
                  onClick={handleContinue}
                  className={`bg-emerald-500 hover:bg-emerald-600 ${
                    isMobileLandscape ? 'flex-1 victory-modal-buttons' : 'flex-1'
                  }`}
                >
                  <ArrowRight className={`mr-1 ${isMobileLandscape ? 'h-3 w-3' : 'h-4 w-4'}`} />
                  Continuar
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </AnimatePresence>
  );
} 