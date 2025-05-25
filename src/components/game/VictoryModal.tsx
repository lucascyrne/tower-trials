import React from 'react';
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
          <DialogContent className="sm:max-w-[425px] overflow-hidden">
            <DialogHeader className="relative">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", duration: 0.5 }}
                className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 h-24 bg-yellow-500/20 rounded-full flex items-center justify-center"
              >
                <Trophy className="h-12 w-12 text-yellow-500" />
              </motion.div>
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <DialogTitle className="text-center pt-12 text-2xl font-bold">
                  Vitória!
                </DialogTitle>
                <DialogDescription className="text-center">
                  Você derrotou o inimigo e avançou para o próximo andar!
                </DialogDescription>
              </motion.div>
            </DialogHeader>

            <motion.div 
              className="space-y-4 py-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <motion.div 
                className="flex items-center gap-3 text-lg bg-primary/10 p-3 rounded-lg"
                whileHover={{ scale: 1.02 }}
              >
                <Star className="h-6 w-6 text-yellow-500" />
                <div>
                  <div className="font-semibold">Experiência</div>
                  <div className="text-2xl font-bold text-primary">+{rewards.xp} XP</div>
                </div>
              </motion.div>

              <motion.div 
                className="flex items-center gap-3 text-lg bg-primary/10 p-3 rounded-lg"
                whileHover={{ scale: 1.02 }}
              >
                <Coins className="h-6 w-6 text-yellow-400" />
                <div>
                  <div className="font-semibold">Ouro</div>
                  <div className="text-2xl font-bold text-primary">+{formatLargeNumber(rewards.gold)} Gold</div>
                </div>
              </motion.div>

              {leveledUp && newLevel && (
                <motion.div 
                  className="mt-2 rounded-lg bg-gradient-to-r from-primary/20 to-primary/30 p-4 text-center"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.7, type: "spring" }}
                >
                  <Sparkles className="h-6 w-6 mx-auto mb-2 text-primary" />
                  <div className="text-xl font-bold">Nível {newLevel}!</div>
                  <div className="text-sm opacity-80">Seu personagem evoluiu e ficou mais forte!</div>
                  
                  <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                    <div className="bg-background/50 p-2 rounded">HP +10</div>
                    <div className="bg-background/50 p-2 rounded">Mana +5</div>
                    <div className="bg-background/50 p-2 rounded">Ataque +2</div>
                    <div className="bg-background/50 p-2 rounded">Defesa +1</div>
                  </div>
                </motion.div>
              )}

              {rewards.drops.length > 0 && (
                <motion.div 
                  className="mt-4 bg-primary/10 p-4 rounded-lg"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9 }}
                >
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <ShoppingBag className="h-5 w-5" />
                    Itens Obtidos
                  </h4>
                  <ul className="space-y-2">
                    {rewards.drops.map((drop, index) => (
                      <motion.li 
                        key={index}
                        className="flex items-center gap-2 bg-background/50 p-2 rounded"
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 1 + (index * 0.1) }}
                      >
                        <span className="text-xl">🎁</span>
                        <span className="flex-1">{drop.name}</span>
                        <span className="font-mono">x{drop.quantity}</span>
                      </motion.li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </motion.div>

            <DialogFooter className="flex flex-col gap-2 mt-4">
              <div className="flex flex-col gap-2 w-full">
                {hasAttributePoints && (
                  <Button
                    onClick={onOpenAttributeModal}
                    className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white shadow-lg"
                  >
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Distribuir Pontos de Atributo
                  </Button>
                )}
                <Button 
                  onClick={handleReturnToHub} 
                  variant="outline"
                  className="flex-1 items-center justify-center"
                >
                  <Home className="h-4 w-4 mr-2" />
                  Voltar ao Hub
                </Button>
                <Button 
                  onClick={handleContinue}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600"
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
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