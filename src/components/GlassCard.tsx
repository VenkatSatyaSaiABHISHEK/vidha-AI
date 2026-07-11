import React from 'react';
import { motion } from 'framer-motion';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
  onClick?: () => void;
  delay?: number;
}

export const GlassCard: React.FC<GlassCardProps> = ({ 
  children, 
  className = '', 
  hoverEffect = true,
  onClick,
  delay = 0
}) => {
  const cardContent = (
    <div 
      onClick={onClick}
      className={`glass-panel rounded-3xl p-6 border transition-all duration-300 ${
        onClick ? 'cursor-pointer active:scale-98' : ''
      } ${className}`}
    >
      {children}
    </div>
  );

  if (hoverEffect) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay, ease: 'easeOut' }}
        whileHover={{ 
          y: -4, 
          boxShadow: '0 20px 30px -10px rgba(0,0,0,0.06)' 
        }}
        className="w-full"
      >
        {cardContent}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="w-full"
    >
      {cardContent}
    </motion.div>
  );
};
export default GlassCard;
