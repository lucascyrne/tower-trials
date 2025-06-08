import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AuthCardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
}

export function AuthCard({ children, className, ...props }: AuthCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-card p-8 shadow-xl',
        'before:absolute before:-left-80 before:-top-80 before:h-[500px] before:w-[500px] before:rounded-full before:bg-primary/20 before:blur-3xl before:content-[""]',
        'after:absolute after:-right-80 after:-top-80 after:h-[500px] after:w-[500px] after:rounded-full after:bg-secondary/20 after:blur-3xl after:content-[""]',
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
} 