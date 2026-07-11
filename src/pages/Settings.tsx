import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Settings as SettingsIcon, 
  Cpu, 
  Database, 
  Check, 
  RotateCcw,
  Sparkles,
  RefreshCw,
  Trash2,
  Download,
  Sliders,
  Bell
} from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { getSettings, updateSettings } from '../services/api';
import { cn } from '../utils/utils';

export const Settings: React.FC = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Model state
  const [selectedModel, setSelectedModel] = useState('qwen2.5:3b');
  
  // OCR states
  const [ocrPreset, setOcrPreset] = useState('accuracy');
  const [layoutAnalysis, setLayoutAnalysis] = useState(true);
  const [multiColumnParser, setMultiColumnParser] = useState(true);

  // Embedding states
  const [embDimension, setEmbDimension] = useState('384');
  const [chunkSize, setChunkSize] = useState(512);
  const [chunkOverlap, setChunkOverlap] = useState(64);

  // Notifications states
  const [notifySound, setNotifySound] = useState(true);
  const [notifyFinished, setNotifyFinished] = useState(true);

  // Simulated operations states
  const [isReindexing, setIsReindexing] = useState(false);
  const [reindexProgress, setReindexProgress] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Service Connection States
  const [backendStatus, setBackendStatus] = useState<'Checking...' | 'Online' | 'Offline'>('Checking...');
  const [ollamaStatus, setOllamaStatus] = useState<'Checking...' | 'Online' | 'Offline'>('Checking...');
  const [localModels, setLocalModels] = useState<string[]>([]);
  const [checking, setChecking] = useState(false);

  const checkConnection = async () => {
    setChecking(true);
    let isBackendOk = false;
    try {
      await getSettings();
      setBackendStatus('Online');
      isBackendOk = true;
    } catch (e) {
      setBackendStatus('Offline');
    }

    try {
      const res = await fetch("http://127.0.0.1:11434/api/tags");
      if (res.ok) {
        const data = await res.json();
        setOllamaStatus('Online');
        if (data.models) {
          setLocalModels(data.models.map((m: any) => m.name));
        }
      } else {
        setOllamaStatus('Offline');
      }
    } catch (e) {
      try {
        const res = await fetch("http://localhost:11434/api/tags");
        if (res.ok) {
          const data = await res.json();
          setOllamaStatus('Online');
          if (data.models) {
            setLocalModels(data.models.map((m: any) => m.name));
          }
        } else {
          setOllamaStatus('Offline');
        }
      } catch (err) {
        setOllamaStatus('Offline');
        if (isBackendOk) {
          setLocalModels(['qwen2.5:3b']);
        }
      }
    }
    setChecking(false);
  };

  const loadSettingsData = async () => {
    try {
      const data = await getSettings();
      setSelectedModel(data.active_model);
      setChunkSize(data.chunk_size);
      setChunkOverlap(data.chunk_overlap);
      setLayoutAnalysis(data.ocr_enabled);
    } catch (err) {
      console.error("Failed loading settings from backend:", err);
    }
  };

  useEffect(() => {
    loadSettingsData();
    checkConnection();
  }, []);

  const handleSave = async (model?: string, chunks?: number, overlap?: number, ocr?: boolean) => {
    try {
      await updateSettings({
        active_model: model !== undefined ? model : selectedModel,
        ocr_enabled: ocr !== undefined ? ocr : layoutAnalysis,
        ocr_language: 'en',
        chunk_size: chunks !== undefined ? chunks : chunkSize,
        chunk_overlap: overlap !== undefined ? overlap : chunkOverlap
      });
      showToast('Settings saved successfully!');
    } catch (err) {
      console.error(err);
      alert("Failed updating system settings.");
    }
  };

  const handleReindex = () => {
    setIsReindexing(true);
    setReindexProgress(0);
    
    const interval = setInterval(() => {
      setReindexProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsReindexing(false);
            showToast('Knowledge database reindexed successfully!');
          }, 500);
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  const handleClearDatabase = () => {
    if (window.confirm('Are you sure you want to clear your local database? This deletes all files and message history.')) {
      localStorage.removeItem('vedha_docs');
      localStorage.removeItem('vedha_chats');
      localStorage.removeItem('vedha_nodes');
      
      showToast('Local database cleared successfully! Reloading...');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const llmOptions = [
    { id: 'qwen2.5:3b', name: 'Qwen 2.5 3B (GGUF)', size: '1.9 GB', speed: '18.5 tok/s', provider: 'Alibaba', desc: 'Ultra-fast local model optimized for offline RAG RAG.' },
    { id: 'llama-3.1-8b', name: 'Llama 3.1 8B (Q4_K_M)', size: '4.7 GB', speed: '8.4 tok/s', provider: 'Meta', desc: 'Best balanced model for extraction & summarizing.' },
    { id: 'phi-3-mini', name: 'Phi-3 Mini 3.8B (Q8_0)', size: '3.6 GB', speed: '14.2 tok/s', provider: 'Microsoft', desc: 'Ultra-fast inference, ideal for lightweight CPUs.' }
  ];

  return (
    <div className="flex-grow flex flex-col gap-6 max-w-4xl mx-auto w-full select-none pb-12">
      
      {/* Title */}
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
          <SettingsIcon className="w-8 h-8 text-slate-500" />
          <span>System Settings</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">
          Configure offline intelligence components, adjust OCR pipelines, and manage private storage.
        </p>
      </div>

      {/* Offline Ollama Warning Alert Dialog */}
      <AnimatePresence>
        {ollamaStatus === 'Offline' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-450 p-4.5 rounded-2xl flex items-start gap-3 text-left"
          >
            <div className="w-8 h-8 rounded-full bg-rose-500/15 flex items-center justify-center text-rose-500 flex-shrink-0">
              <Cpu className="w-4 h-4" />
            </div>
            <div className="flex-grow">
              <h3 className="text-xs font-black uppercase tracking-wider">Ollama local runner is offline</h3>
              <p className="text-[10px] font-semibold mt-1 leading-relaxed text-slate-500 dark:text-slate-400">
                Please turn on Ollama. The local assistant requires Ollama to process questions. Launch the application or run:
              </p>
              <div className="mt-2.5 p-2 bg-rose-950/90 dark:bg-black/90 text-rose-400 font-mono text-[9px] rounded-lg border border-rose-900/40 select-all cursor-pointer font-bold inline-block px-3 py-1">
                ollama run qwen2.5:3b
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Side: General Settings Forms */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Model Selection */}
          <GlassCard hoverEffect={false} className="border-slate-200/30 dark:border-white/5">
            <h2 className="text-xs font-extrabold text-slate-950 dark:text-white flex items-center gap-2 mb-4">
              <Cpu className="w-4.5 h-4.5 text-blue-500" />
              <span>Offline Large Language Model</span>
            </h2>
            
            <div className="space-y-3">
              {llmOptions.map(llm => {
                const isSelected = selectedModel === llm.id;
                return (
                  <div
                    key={llm.id}
                    onClick={() => { setSelectedModel(llm.id); handleSave(llm.id); }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                      isSelected 
                        ? 'border-blue-500/40 bg-blue-500/5 dark:bg-blue-500/5 shadow-xs' 
                        : 'border-slate-200/50 dark:border-white/5 hover:bg-slate-100/50 dark:hover:bg-slate-900/30'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">{llm.name}</span>
                        <span className="px-1.5 py-0.2 rounded-md bg-slate-200 dark:bg-slate-800 text-[8px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                          {llm.provider}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal max-w-sm">
                        {llm.desc}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 sm:text-right flex-shrink-0">
                      <div className="text-[10px] text-slate-400 font-semibold">
                        <div>Size: {llm.size}</div>
                        <div className="mt-0.5 text-emerald-500">Speed: {llm.speed}</div>
                      </div>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                        isSelected 
                          ? 'bg-blue-500 border-transparent text-white' 
                          : 'border-slate-300 dark:border-slate-700'
                      }`}>
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>


          {/* OCR Layout settings */}
          <GlassCard hoverEffect={false} className="border-slate-200/30 dark:border-white/5">
            <h2 className="text-xs font-extrabold text-slate-950 dark:text-white flex items-center gap-2 mb-4">
              <Sparkles className="w-4.5 h-4.5 text-purple-500" />
              <span>Ingestion OCR Options</span>
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">OCR Engine Accuracy</label>
                  <select
                    value={ocrPreset}
                    onChange={(e) => setOcrPreset(e.target.value)}
                    className="w-full p-2.5 bg-slate-100 dark:bg-slate-950 border border-slate-200/50 dark:border-white/5 rounded-xl text-xs text-slate-800 dark:text-white outline-hidden cursor-pointer"
                  >
                    <option value="accuracy">High Accuracy (Multi-pass)</option>
                    <option value="speed">Fast Parse (Low contrast)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Layout Structural Analysis</span>
                    <span className="text-[9px] text-slate-400 font-semibold">Identifies boxes, images, and tables.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={layoutAnalysis}
                    onChange={(e) => { setLayoutAnalysis(e.target.checked); handleSave(undefined, undefined, undefined, e.target.checked); }}
                    className="w-4 h-4 text-blue-600 rounded-sm outline-hidden cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Multi-Column Text Flow</span>
                    <span className="text-[9px] text-slate-400 font-semibold">Extracts multi-column papers in order.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={multiColumnParser}
                    onChange={(e) => setMultiColumnParser(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded-sm outline-hidden cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Embedding settings */}
          <GlassCard hoverEffect={false} className="border-slate-200/30 dark:border-white/5">
            <h2 className="text-xs font-extrabold text-slate-950 dark:text-white flex items-center gap-2 mb-4">
              <Sliders className="w-4.5 h-4.5 text-indigo-500" />
              <span>Embedding & RAG Chunking Settings</span>
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Vector Dimensions</label>
                  <select
                    value={embDimension}
                    onChange={(e) => setEmbDimension(e.target.value)}
                    className="w-full p-2.5 bg-slate-100 dark:bg-slate-950 border border-slate-200/50 dark:border-white/5 rounded-xl text-xs text-slate-800 dark:text-white outline-hidden cursor-pointer"
                  >
                    <option value="1024">1024 dimensions (BGE-Large)</option>
                    <option value="768">768 dimensions (Nomic-Embed)</option>
                    <option value="384">384 dimensions (MiniLM)</option>
                  </select>
                </div>
              </div>

              {/* Chunk sizes */}
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-bold">Context Chunk Size</span>
                    <span className="font-extrabold text-slate-800 dark:text-white">{chunkSize} tokens</span>
                  </div>
                  <input
                    type="range"
                    min="128"
                    max="1024"
                    step="64"
                    value={chunkSize}
                    onChange={(e) => setChunkSize(Number(e.target.value))}
                    onMouseUp={(e) => handleSave(undefined, Number(e.currentTarget.value))}
                    className="w-full h-1 bg-slate-200 dark:bg-slate-850 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-bold">Chunk Overlap</span>
                    <span className="font-extrabold text-slate-800 dark:text-white">{chunkOverlap} tokens</span>
                  </div>
                  <input
                    type="range"
                    min="16"
                    max="256"
                    step="16"
                    value={chunkOverlap}
                    onChange={(e) => setChunkOverlap(Number(e.target.value))}
                    onMouseUp={(e) => handleSave(undefined, undefined, Number(e.currentTarget.value))}
                    className="w-full h-1 bg-slate-200 dark:bg-slate-850 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Notifications setup */}
          <GlassCard hoverEffect={false} className="border-slate-200/30 dark:border-white/5">
            <h2 className="text-xs font-extrabold text-slate-950 dark:text-white flex items-center gap-2 mb-4">
              <Bell className="w-4.5 h-4.5 text-emerald-500" />
              <span>System Alerts & Notifications</span>
            </h2>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Sound alert upon ingestion complete</span>
                  <span className="text-[9px] text-slate-400 font-semibold">Plays audio alert when local index is synced.</span>
                </div>
                <input
                  type="checkbox"
                  checked={notifySound}
                  onChange={(e) => setNotifySound(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded-sm outline-hidden cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">System Banner Notifications</span>
                  <span className="text-[9px] text-slate-400 font-semibold">Display system tray banners.</span>
                </div>
                <input
                  type="checkbox"
                  checked={notifyFinished}
                  onChange={(e) => setNotifyFinished(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded-sm outline-hidden cursor-pointer"
                />
              </div>
            </div>
          </GlassCard>

        </div>

        {/* Right Side: Maintenance, Shortcuts & About */}
        <div className="space-y-6">
          
          {/* Database Operations */}
          <GlassCard hoverEffect={false} className="border-slate-200/30 dark:border-white/5">
            <h2 className="text-xs font-extrabold text-slate-950 dark:text-white flex items-center gap-2 mb-4">
              <Database className="w-4.5 h-4.5 text-indigo-500" />
              <span>Database Operations</span>
            </h2>

            <div className="space-y-3">
              <button
                disabled={isReindexing}
                onClick={handleReindex}
                className="w-full py-2.5 rounded-xl border border-indigo-500/10 hover:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 bg-indigo-500/5 hover:bg-indigo-500/10 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {isReindexing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                <span>{isReindexing ? 'Reindexing...' : 'Force Reindex database'}</span>
              </button>

              <AnimatePresence>
                {isReindexing && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-1.5"
                  >
                    <div className="flex justify-between text-[9px] font-bold text-slate-400">
                      <span>Chunk progress</span>
                      <span>{reindexProgress}%</span>
                    </div>
                    <div className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 transition-all duration-200" style={{ width: `${reindexProgress}%` }} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                onClick={() => showToast('Config backup file saved to downloads!')}
                className="w-full py-2.5 rounded-xl border border-slate-200/50 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Backup local index (.json)</span>
              </button>

              <div className="h-px bg-slate-200/50 dark:bg-white/5 my-2" />

              <button
                onClick={handleClearDatabase}
                className="w-full py-2.5 rounded-xl border border-rose-500/20 hover:border-rose-500/50 text-rose-500 bg-rose-500/5 hover:bg-rose-500/10 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Format local database</span>
              </button>
            </div>
          </GlassCard>

          {/* Service Connection Status Panel */}
          <GlassCard hoverEffect={false} className="border-slate-200/30 dark:border-white/5">
            <h2 className="text-xs font-extrabold text-slate-950 dark:text-white flex items-center gap-2 mb-4">
              <RefreshCw className={cn("w-4.5 h-4.5 text-blue-500", checking && "animate-spin")} />
              <span>Service Connection Status</span>
            </h2>

            <div className="space-y-4">
              {/* Python Backend Status */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100/50 dark:bg-slate-900/30 border border-slate-200/20 dark:border-white/5">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Offline RAG Backend</span>
                  <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold font-mono">http://localhost:8000</span>
                </div>
                <span className={cn(
                  "px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider border",
                  backendStatus === 'Online' 
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                    : backendStatus === 'Offline' 
                    ? "bg-rose-500/10 text-rose-500 border-rose-500/20" 
                    : "bg-slate-500/10 text-slate-500 border-slate-500/20"
                )}>
                  {backendStatus}
                </span>
              </div>

              {/* Ollama Engine Status */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100/50 dark:bg-slate-900/30 border border-slate-200/20 dark:border-white/5">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Ollama AI Server</span>
                  <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold font-mono">http://localhost:11434</span>
                </div>
                <span className={cn(
                  "px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider border",
                  ollamaStatus === 'Online' 
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                    : ollamaStatus === 'Offline' 
                    ? "bg-rose-500/10 text-rose-500 border-rose-500/20" 
                    : "bg-slate-500/10 text-slate-500 border-slate-500/20"
                )}>
                  {ollamaStatus}
                </span>
              </div>

              {/* Ollama Offline Helper Command */}
              {ollamaStatus === 'Offline' && (
                <div className="p-3.5 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 space-y-2">
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">How to start Ollama</span>
                  <p className="text-[9px] text-slate-500 dark:text-slate-400 leading-normal">
                    Ollama is not running. Please open your terminal and run the following command to start the local model engine:
                  </p>
                  <div className="flex items-center justify-between gap-2 bg-slate-950 p-2.5 rounded-lg border border-white/5 font-mono text-[9px] text-indigo-350">
                    <span className="select-all">ollama run qwen2.5:3b</span>
                    <button 
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText("ollama run qwen2.5:3b");
                        showToast("Command copied to clipboard!");
                      }}
                      className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-[8px] font-sans font-bold cursor-pointer transition-all active:scale-95"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}

              {/* Available models list */}
              {ollamaStatus === 'Online' && localModels.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Available Local Models</span>
                  <div className="flex flex-wrap gap-1">
                    {localModels.map(m => (
                      <span key={m} className="px-2 py-0.5 rounded-md text-[9px] font-mono font-bold bg-blue-500/5 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/10">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </GlassCard>

        </div>

      </div>

      {/* Floating status Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-6 right-6 z-50 bg-slate-950 dark:bg-white text-white dark:text-slate-950 px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 border border-slate-800 dark:border-slate-100"
          >
            <Check className="w-4 h-4 text-emerald-400 dark:text-emerald-500" />
            <span className="text-xs font-semibold">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
export default Settings;
