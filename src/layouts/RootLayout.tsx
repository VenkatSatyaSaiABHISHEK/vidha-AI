import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { 
  Home, 
  Database, 
  BarChart3,
  Settings,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useClock } from '../hooks/useClock';
import { useAuth } from '../context/AuthContext';

export const RootLayout: React.FC = () => {
  const location = useLocation();
  const isChatPage = location.pathname === '/chat';
  const timeString = useClock();
  const [isLoadingRoute, setIsLoadingRoute] = useState(true);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { user, logout } = useAuth();

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  useEffect(() => {
    setIsLoadingRoute(true);
    window.scrollTo(0, 0);
    const timer = setTimeout(() => {
      setIsLoadingRoute(false);
      window.scrollTo(0, 0);
    }, 300);
    return () => clearTimeout(timer);
  }, [location.pathname]);
  
  // Theme management: Default to light mode as shown in the mockup image
  const [theme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (isHeaderCollapsed) {
      root.classList.add('header-collapsed');
    } else {
      root.classList.remove('header-collapsed');
    }
  }, [isHeaderCollapsed]);



  const navItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/vault', label: 'Study Library', icon: Database },
    { path: '/chat', label: 'AI Chat', icon: MessageSquare },
    { path: '/analytics', label: 'Learning Analytics', icon: BarChart3 },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-transparent text-slate-800 dark:text-slate-200 transition-colors duration-500 relative flex flex-col">
      
      {/* Collapsible Header Pull-tab */}
      <div className="fixed top-0 left-1/2 transform -translate-x-1/2 z-[10000] pointer-events-auto">
        <button
          onClick={() => setIsHeaderCollapsed(prev => !prev)}
          className="flex items-center justify-center w-12 h-6 rounded-b-2xl bg-white/70 dark:bg-slate-900/60 border-b border-x border-slate-200/40 dark:border-white/5 shadow-lg backdrop-blur-md text-slate-500 hover:text-indigo-500 hover:h-7 transition-all cursor-pointer"
          title={isHeaderCollapsed ? "Show Navigation" : "Hide Navigation"}
        >
          {isHeaderCollapsed ? (
            <ChevronDown className="w-3.5 h-3.5 animate-pulse" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Floating Animated Ambient Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <motion.div
          animate={{
            x: [0, 30, -30, 0],
            y: [0, -40, 40, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute bottom-[-10%] left-[-10%] w-[35rem] h-[35rem] rounded-full bg-glow-blue blur-[140px] opacity-80"
        />
        <motion.div
          animate={{
            x: [0, -40, 20, 0],
            y: [0, 30, -30, 0],
          }}
          transition={{
            duration: 30,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute top-[40%] right-[-10%] w-[35rem] h-[35rem] rounded-full bg-glow-purple blur-[140px] opacity-80"
        />
      </div>
      {/* Frosted Glass Viewport Blur Banner for Top Section */}
      <div 
        className="fixed top-0 left-0 right-0 h-22 bg-white/45 dark:bg-slate-950/35 backdrop-blur-lg border-b border-slate-200/15 dark:border-white/5 z-[9990] transition-all duration-300 pointer-events-none"
        style={{
          transform: isHeaderCollapsed ? 'translateY(-100%)' : 'translateY(0)',
          opacity: isHeaderCollapsed ? 0 : 1
        }}
      />

      {/* Floating Header Container */}
      <header 
        className="fixed left-0 right-0 px-6 max-w-7xl mx-auto w-full flex items-center justify-between pointer-events-none select-none transition-all duration-300"
        style={{ 
          zIndex: 9999,
          top: isHeaderCollapsed ? '-100px' : '24px',
          opacity: isHeaderCollapsed ? 0 : 1
        }}
      >
        
        {/* Left Side: Branding Pill (Icon & Name) */}
        <div className="pointer-events-auto">
          <Link to="/" className="flex items-center gap-2.5 px-4.5 py-2.5 bg-white/70 dark:bg-slate-900/60 rounded-full border border-slate-200/40 dark:border-white/5 shadow-xl backdrop-blur-md hover:scale-[1.02] transition-all flex-shrink-0">
            {/* Custom SVG Sparkle Icon to match the image */}
            <div className="w-5 h-5 flex items-center justify-center">
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                <defs>
                  <linearGradient id="logo-sparkle-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="50%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
                <path d="M12 2C12 7.5 16.5 12 22 12C16.5 12 12 16.5 12 22C12 16.5 7.5 12 2 12C7.5 12 12 7.5 12 2Z" fill="url(#logo-sparkle-grad)" />
              </svg>
            </div>
            <span className="text-xs font-black tracking-wider bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent uppercase select-none animate-aurora">
              Vedha AI
            </span>
          </Link>
        </div>

        {/* Center: Navigation Pill */}
        <div className="pointer-events-auto">
          <nav className="glass-navbar flex items-center gap-0.5 p-1 rounded-full shadow-lg border border-slate-200/40 dark:border-white/5 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`relative flex items-center gap-1.5 px-4.5 py-2.5 rounded-full text-xs font-semibold transition-all duration-300 ${
                    isActive 
                      ? 'text-indigo-600 dark:text-indigo-400' 
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="nav-bg"
                      className="absolute inset-0 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-full border border-indigo-500/10"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <Icon className="w-3.5 h-3.5 relative z-10" />
                  <span className="relative z-10">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Side: Clock & Profile Avatar */}
        <div className="flex items-center gap-4 pointer-events-auto relative">
          {/* Digital clock displaying HH:MM:SS AM/PM */}
          <div className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-400 select-none">
            {timeString}
          </div>

          {/* Profile Container */}
          <div className="relative">
            {/* User Profile Avatar with small green online indicator */}
            <button
              onClick={() => setIsDropdownOpen(prev => !prev)}
              className="relative w-9 h-9 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 p-[1.5px] shadow-sm hover:scale-105 transition-transform cursor-pointer focus:outline-none flex items-center justify-center"
            >
              <img 
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80" 
                alt="Avatar"
                className="w-full h-full rounded-full object-cover"
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-950" />
            </button>

            {/* Dropdown Menu */}
            <AnimatePresence>
              {isDropdownOpen && (
                <>
                  {/* Invisible backdrop to capture clicks outside */}
                  <div 
                    className="fixed inset-0 z-40 cursor-default" 
                    onClick={() => setIsDropdownOpen(false)} 
                  />
                  
                  {/* Dropdown Card */}
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-52 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-white/10 p-2.5 shadow-2xl z-50 flex flex-col gap-1.5"
                  >
                    <div className="px-3 py-1.5 text-left select-none">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">Signed In As</p>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate mt-0.5">{user?.email || 'vedha_student@local.ai'}</p>
                    </div>
                    
                    <hr className="border-slate-100 dark:border-white/5 my-0.5" />
                    
                    <button
                      onClick={async () => {
                        setIsDropdownOpen(false);
                        await logout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-500/10 dark:hover:bg-rose-500/15 cursor-pointer text-left transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Main Page Area */}
      <main 
        className={`flex-grow max-w-7xl mx-auto w-full px-6 relative flex flex-col justify-start transition-all duration-300 ${isChatPage ? 'pb-2' : 'pb-12'}`}
        style={{ paddingTop: isHeaderCollapsed ? '24px' : '110px' }}
      >
        <AnimatePresence mode="wait">
          {isLoadingRoute ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full space-y-6 animate-pulse mt-4 min-h-[calc(100vh-16.5rem)]"
            >
              {/* Header Skeleton */}
              <div className="space-y-2">
                <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-2xl w-48" />
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-xl w-96" />
              </div>
              
              {/* Grid content Skeleton */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                  <div className="h-28 bg-slate-200 dark:bg-slate-800 rounded-3xl w-full" />
                  <div className="h-40 bg-slate-200 dark:bg-slate-800 rounded-3xl w-full" />
                </div>
                <div className="lg:col-span-1">
                  <div className="h-72 bg-slate-200 dark:bg-slate-800 rounded-3xl w-full" />
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="flex-grow flex flex-col w-full"
            >
              <Outlet />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      {!isChatPage && (
        <footer className="text-center py-6 text-xs text-slate-400 dark:text-slate-600 border-t border-slate-200/10 relative z-10">
          &copy; {new Date().getFullYear()} Vedha AI. Processed locally with end-to-end privacy.
        </footer>
      )}
      
      {/* Mobile Nav Drawer Button */}
      <div className="md:hidden fixed bottom-6 left-0 right-0 z-50 flex justify-center">
        <nav className="glass-navbar flex items-center gap-1 p-1 rounded-2xl shadow-xl">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`p-3 rounded-xl transition-all ${
                  isActive ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-900/50'
                }`}
                title={item.label}
              >
                <Icon className="w-5 h-5" />
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
export default RootLayout;
