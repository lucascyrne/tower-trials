import { motion } from 'framer-motion';
import { type FC } from 'react';
import { ArrowLeft } from 'lucide-react';

type ReturnButtonProps = {
  onClick: () => void;
};

const ReturnButton: FC<ReturnButtonProps> = ({ onClick }) => {
  return (
    <motion.button
      className="flex items-center justify-center max-w-[72px] max-h-[48px] p-3 gap-2 text-black bg-black/5 rounded-md shadow-md"
      onClick={onClick}
      whileHover={{ backgroundColor: 'rgba(0, 0, 0, 0.1)' }} // Transição de fundo
      whileTap={{ scale: 0.95 }} // Animação de pressionado
      type="button">
      <ArrowLeft />
    </motion.button>
  );
};

export default ReturnButton;
