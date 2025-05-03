import AnimatedModal from '@/components/core/animated-modal';
import { Button } from '../ui/button';
import { useState } from 'react';

interface Props {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onConfirmation: () => Promise<void>;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
}

const ConfirmationModal: React.FC<Props> = ({
  isOpen,
  setIsOpen,
  onConfirmation,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'default',
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    try {
      setIsLoading(true);
      await onConfirmation();
      setIsOpen(false);
    } catch (error) {
      console.error('Erro na confirmação:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatedModal
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      size="sm"
      title={title}
      subTitle={description}
    >
      <div className="flex flex-col gap-4">
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isLoading}>
            {cancelText}
          </Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            onClick={handleConfirm}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </AnimatedModal>
  );
};

export default ConfirmationModal;
