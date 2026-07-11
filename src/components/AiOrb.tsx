import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AiOrbProps {
  state?: 'idle' | 'listening' | 'processing';
  onClick?: () => void;
  className?: string;
}

export const AiOrb: React.FC<AiOrbProps> = ({ state = 'idle', onClick, className = '' }) => {
  // Define ambient glows based on states
  const glowColors = {
    idle: 'bg-gradient-to-tr from-blue-500/30 to-purple-600/30 dark:from-blue-500/40 dark:to-purple-600/40',
    listening: 'bg-gradient-to-tr from-rose-500/40 to-amber-500/40 dark:from-rose-500/50 dark:to-amber-500/50',
    processing: 'bg-gradient-to-tr from-cyan-500/30 to-indigo-600/30 dark:from-cyan-400/40 dark:to-indigo-500/40',
  };

  const orbColors = {
    idle: 'from-blue-500 via-indigo-500 to-purple-600',
    listening: 'from-rose-500 via-pink-500 to-amber-500',
    processing: 'from-cyan-500 via-blue-500 to-indigo-600',
  };

  return (
    <div 
      onClick={onClick}
      className={`relative flex items-center justify-center cursor-pointer ${className}`}
    >
      
      {/* Concentric ambient wave rings exactly matching the image */}
      <div className="absolute w-[24rem] h-[24rem] rounded-full border border-blue-500/5 dark:border-white/2 pointer-events-none flex items-center justify-center animate-pulse duration-[6000ms]">
        <div className="w-[18rem] h-[18rem] rounded-full border border-blue-500/10 dark:border-white/5 flex items-center justify-center">
          <div className="w-[12rem] h-[12rem] rounded-full border border-blue-500/15 dark:border-white/8" />
        </div>
      </div>

      {/* Outer ambient glowing blobs */}
      <AnimatePresence mode="wait">
        <motion.div
          key={state}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ 
            opacity: [0.5, 0.8, 0.5], 
            scale: state === 'listening' ? [1, 1.2, 1] : [1, 1.08, 1],
          }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ 
            duration: state === 'listening' ? 1.5 : 4, 
            repeat: Infinity, 
            ease: "easeInOut" 
          }}
          className={`absolute w-64 h-64 rounded-full blur-3xl pointer-events-none transition-all duration-1000 ${glowColors[state]}`}
        />
      </AnimatePresence>

      {/* Main Core Orb (Vibrant Circle) */}
      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        animate={
          state === 'listening' 
            ? { scale: [1, 1.1, 1.02, 1.1, 1] } 
            : state === 'processing'
            ? { rotate: 360 }
            : { scale: [1, 1.04, 1] }
        }
        transition={
          state === 'listening'
            ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
            : state === 'processing'
            ? { duration: 12, repeat: Infinity, ease: "linear" }
            : { duration: 6, repeat: Infinity, ease: "easeInOut" }
        }
        className={`relative z-10 w-32 h-32 rounded-full bg-gradient-to-tr ${orbColors[state]} p-[1.5px] shadow-[0_12px_40px_rgba(99,102,241,0.25)] flex items-center justify-center overflow-hidden`}
      >
        {/* Core Glass Overlay */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-500 via-indigo-500 to-purple-600 flex items-center justify-center overflow-hidden">
          
          {/* Sparkles inside the Orb matching the branding logo */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {/* Center large sparkle */}
            <svg className="w-12 h-12 text-white drop-shadow-[0_2px_8px_rgba(255,255,255,0.4)]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C12 7.5 16.5 12 22 12C16.5 12 12 16.5 12 22C12 16.5 7.5 12 2 12C7.5 12 12 7.5 12 2Z" />
            </svg>
            
            {/* Top-left small sparkle */}
            <svg className="w-3.5 h-3.5 text-white/70 absolute top-7 left-7 drop-shadow-[0_1px_4px_rgba(255,255,255,0.3)]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C12 7.5 16.5 12 22 12C16.5 12 12 16.5 12 22C12 16.5 7.5 12 2 12C7.5 12 12 7.5 12 2Z" />
            </svg>

            {/* Bottom-right small sparkle */}
            <svg className="w-3.5 h-3.5 text-white/70 absolute bottom-7 right-7 drop-shadow-[0_1px_4px_rgba(255,255,255,0.3)]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C12 7.5 16.5 12 22 12C16.5 12 12 16.5 12 22C12 16.5 7.5 12 2 12C7.5 12 12 7.5 12 2Z" />
            </svg>
          </div>

          {/* Internal rotating fluid SVGs */}
          <div className="absolute inset-0 opacity-20">
            <motion.svg 
              viewBox="0 0 100 100" 
              className="w-full h-full text-white"
              animate={{ rotate: 360 }}
              transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            >
              <path d="M 10,50 Q 25,30 50,50 T 90,50" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="5 10" />
            </motion.svg>
          </div>

          {/* Center glowing dot (visible slightly on active states) */}
          <motion.div 
            animate={{ 
              scale: state === 'listening' ? [1, 1.3, 1] : 1,
              opacity: state === 'listening' ? 0.6 : 0
            }}
            transition={{ duration: 0.8, repeat: Infinity }}
            className="w-4 h-4 rounded-full bg-rose-300 blur-[3px]"
          />

          {/* Orbiting particles (only when processing) */}
          {state === 'processing' && (
            <div className="absolute inset-2 border border-white/20 rounded-full animate-spin duration-300">
              <div className="absolute top-0 left-1/2 w-1.5 h-1.5 -ml-0.75 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,1)]" />
            </div>
          )}
        </div>
      </motion.div>

      {/* Wave Ring Indicator when listening */}
      {state === 'listening' && (
        <>
          <motion.div
            initial={{ scale: 1, opacity: 0.8 }}
            animate={{ scale: 1.8, opacity: 0 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
            className="absolute w-32 h-32 rounded-full border-2 border-rose-500/40 pointer-events-none"
          />
          <motion.div
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{ scale: 2.2, opacity: 0 }}
            transition={{ duration: 1.5, delay: 0.5, repeat: Infinity, ease: "easeOut" }}
            className="absolute w-32 h-32 rounded-full border border-amber-500/30 pointer-events-none"
          />
        </>
      )}
    </div>
  );
};
export default AiOrb;
