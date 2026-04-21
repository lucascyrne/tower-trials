'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ReactNode } from 'react';
import { X } from 'lucide-react';

interface AnimatedModalProps {
  title?: string;
  subTitle?: string;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  children: ReactNode;
  onBack?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

const AnimatedModal = ({
  title,
  subTitle,
  isOpen,
  setIsOpen,
  children,
  onBack,
  size = 'md'
}: AnimatedModalProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-50 grid cursor-pointer place-items-center overflow-y-scroll bg-background/80 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            // initial={{ scale: 0, rotate: '12.5deg' }}
            // animate={{ scale: 1, rotate: '0deg' }}
            // exit={{ scale: 0, rotate: '0deg' }}
            onClick={e => e.stopPropagation()}
            className={`my-8 w-full rounded-lg border border-border/80 bg-card text-card-foreground p-8
            ${size === 'sm' ? 'max-w-xl' : size === 'md' ? 'max-w-3xl' : 'max-w-6xl'} max-h-[90vh]
            shadow-xl cursor-default relative overflow-y-auto scrollbar-thin`}>
            <div className="flex flex-col relative z-10">
              <div className="flex gap-2 mb-8 items-start">
                <div className="flex flex-col gap-4">
                  {title && <h3 className="text-xl font-bold">{title}</h3>}
                  {subTitle && <h2 className="font-medium text-muted-foreground">{subTitle}</h2>}
                </div>
                <X
                  size={24}
                  className="ml-auto cursor-pointer"
                  onClick={() => {
                    onBack?.();
                    setIsOpen(false);
                  }}
                />
              </div>
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AnimatedModal;
