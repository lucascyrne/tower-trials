import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skull } from 'lucide-react';
import { useMobileLandscape } from '@/hooks/use-media-query';

interface PermadeathWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  characterName?: string;
}

export function PermadeathWarningModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  characterName = "seu personagem" 
}: PermadeathWarningModalProps) {
  // Detectar mobile landscape
  const isMobileLandscape = useMobileLandscape();
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`overflow-hidden ${
        isMobileLandscape 
          ? 'max-w-[95vw] max-h-[95vh] w-[95vw] p-3' 
          : 'sm:max-w-md'
      }`}>
        <DialogHeader className={`${isMobileLandscape ? 'pb-2' : ''}`}>
          <DialogTitle className={`flex items-center gap-2 text-red-500 ${
            isMobileLandscape ? 'text-base' : 'text-xl'
          }`}>
            <Skull className={`${isMobileLandscape ? 'h-4 w-4' : 'h-6 w-6'}`} />
            Aviso de Permadeath
          </DialogTitle>
          <DialogDescription className={`${
            isMobileLandscape ? 'text-xs' : 'text-base'
          }`}>
            Você está prestes a entrar em uma aventura perigosa com <strong>{characterName}</strong>!
          </DialogDescription>
        </DialogHeader>
        
        <div className={`${
          isMobileLandscape 
            ? 'space-y-2 max-h-[calc(95vh-140px)] overflow-y-auto' 
            : 'space-y-4 py-4'
        }`}>
          {/* Explicação do Permadeath */}
          <div className={`bg-red-500/10 border border-red-500/20 rounded-lg space-y-2 ${
            isMobileLandscape ? 'p-2' : 'p-4'
          }`}>
            <p className={`font-medium ${
              isMobileLandscape ? 'text-xs' : 'text-sm'
            }`}>
              <strong>⚠️ O que é Permadeath?</strong>
            </p>
            <p className={`text-muted-foreground ${
              isMobileLandscape ? 'text-xs' : 'text-sm'
            }`}>
              Neste jogo, a morte é permanente. Se seu personagem morrer:
            </p>
            
            {/* Grid adaptativo para landscape */}
            <div className={`${
              isMobileLandscape 
                ? 'grid grid-cols-2 gap-1 text-xs' 
                : 'space-y-1'
            }`}>
              <div className={`text-muted-foreground flex items-center gap-1 ${
                isMobileLandscape ? 'text-xs' : 'text-sm'
              }`}>
                <span className="text-red-400">💀</span>
                <span>Deletado permanentemente</span>
              </div>
              <div className={`text-muted-foreground flex items-center gap-1 ${
                isMobileLandscape ? 'text-xs' : 'text-sm'
              }`}>
                <span className="text-red-400">📊</span>
                <span>Progresso perdido</span>
              </div>
              <div className={`text-muted-foreground flex items-center gap-1 ${
                isMobileLandscape ? 'text-xs' : 'text-sm'
              }`}>
                <span className="text-red-400">⚔️</span>
                <span>Equipamentos destruídos</span>
              </div>
              <div className={`text-muted-foreground flex items-center gap-1 ${
                isMobileLandscape ? 'text-xs' : 'text-sm'
              }`}>
                <span className="text-yellow-400">🏆</span>
                <span>Salvo no ranking</span>
              </div>
            </div>
          </div>
          
          {/* Dicas de Sobrevivência */}
          <div className={`bg-muted rounded-lg ${
            isMobileLandscape ? 'p-2' : 'p-4'
          }`}>
            <p className={`font-medium mb-2 ${
              isMobileLandscape ? 'text-xs' : 'text-sm'
            }`}>
              💡 Dicas de Sobrevivência:
            </p>
            
            {/* Grid adaptativo para dicas */}
            <div className={`${
              isMobileLandscape 
                ? 'grid grid-cols-2 gap-1 text-xs' 
                : 'space-y-1'
            }`}>
              <div className={`text-muted-foreground flex items-center gap-1 ${
                isMobileLandscape ? 'text-xs' : 'text-sm'
              }`}>
                <span className="text-blue-400">🔮</span>
                <span>Gerencie sua mana</span>
              </div>
              <div className={`text-muted-foreground flex items-center gap-1 ${
                isMobileLandscape ? 'text-xs' : 'text-sm'
              }`}>
                <span className="text-green-400">❤️</span>
                <span>Mantenha HP alto</span>
              </div>
              <div className={`text-muted-foreground flex items-center gap-1 ${
                isMobileLandscape ? 'text-xs' : 'text-sm'
              }`}>
                <span className="text-yellow-400">🏃</span>
                <span>Fuja se necessário</span>
              </div>
              <div className={`text-muted-foreground flex items-center gap-1 ${
                isMobileLandscape ? 'text-xs' : 'text-sm'
              }`}>
                <span className="text-purple-400">⚔️</span>
                <span>Compre equipamentos</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Botões responsivos */}
        <div className={`flex gap-2 ${
          isMobileLandscape ? 'pt-2' : 'pt-4'
        }`}>
          <Button
            variant="outline"
            onClick={onClose}
            className={`flex-1 ${
              isMobileLandscape ? 'text-xs h-8' : ''
            }`}
          >
            Voltar
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            className={`flex-1 ${
              isMobileLandscape ? 'text-xs h-8' : ''
            }`}
          >
            <Skull className={`mr-1 ${
              isMobileLandscape ? 'h-3 w-3' : 'h-4 w-4 mr-2'
            }`} />
            {isMobileLandscape ? 'Aceitar' : 'Aceitar e Continuar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 