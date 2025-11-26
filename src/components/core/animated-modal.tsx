import { AnimatePresence, motion } from 'framer-motion';
import { type ReactNode } from 'react';
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
  size = 'md',
}: AnimatedModalProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setIsOpen(false)}
          className="bg-slate-900/20 backdrop-blur fixed inset-0 z-50 grid place-items-center overflow-y-scroll cursor-pointer"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            // initial={{ scale: 0, rotate: '12.5deg' }}
            // animate={{ scale: 1, rotate: '0deg' }}
            // exit={{ scale: 0, rotate: '0deg' }}
            onClick={e => e.stopPropagation()}
            className={`bg-slate-800 text-slate-100 my-8 p-8 rounded-lg w-full
            ${size === 'sm' ? 'max-w-xl' : size === 'md' ? 'max-w-3xl' : 'max-w-6xl'} max-h-[90vh]
            shadow-xl cursor-default relative overflow-y-auto scrollbar-thin border border-slate-700/50`}
          >
            <div className="flex flex-col relative z-10">
              <div className="flex gap-2 mb-8 items-start">
                <div className="flex flex-col gap-4">
                  {title && <h3 className="text-xl font-bold text-slate-100">{title}</h3>}
                  {subTitle && <h2 className="font-medium text-slate-400">{subTitle}</h2>}
                </div>
                <X
                  size={24}
                  className="ml-auto cursor-pointer text-slate-400 hover:text-slate-200 transition-colors"
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
