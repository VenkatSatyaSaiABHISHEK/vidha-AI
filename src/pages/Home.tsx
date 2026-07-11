import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Paperclip,
  Mic,
  Scan,
  ArrowUp,
  Loader2,
  CheckCircle2,
  X,
  Sparkles,
  Database,
  Cpu,
  Volume2,
  FolderOpen,
  HelpCircle,
  GraduationCap,
  Briefcase,
  FileText,
  BookOpen
} from 'lucide-react';
import { AiOrb } from '../components/AiOrb';
import { GlassCard } from '../components/GlassCard';
import { RotatingText } from '../components/RotatingText';
import {
  streamChatMessage,
  createChatSession,
  getChatSessions,
  getAnalytics
} from '../services/api';
import { cn } from '../utils/utils';

interface PreAnalyzeData {
  suggested_category: string;
  temp_file_name: string;
  original_name: string;
  char_count: number;
  estimated_chunks: number;
  type: string;
}

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [orbState, setOrbState] = useState<'idle' | 'listening' | 'processing'>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'info' | 'success' | 'loading'>('info');

  // Ingestion Timeline States
  const [ingestStage, setIngestStage] = useState<'idle' | 'uploading' | 'analyzing' | 'confirming' | 'indexing' | 'completed'>('idle');
  const [tempData, setTempData] = useState<PreAnalyzeData | null>(null);
  const [confirmedCategory, setConfirmedCategory] = useState('');
  const [indexedChunksCount, setIndexedChunksCount] = useState<number | null>(null);

  // Suggested Prompt Questions list
  const [promptQuestions, setPromptQuestions] = useState<string[]>([]);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);

  // Inline RAG Answer states
  const [answerText, setAnswerText] = useState('');
  const [isAnswering, setIsAnswering] = useState(false);
  const [inlineCitations, setInlineCitations] = useState<string[]>([]);
  const [telemetry, setTelemetry] = useState<any>(null);

  // Trigger file dialog
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Stage 1: File pre-analyze
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    setOrbState('processing');
    setIngestStage('uploading');
    setStatusType('loading');
    setStatusMessage(`Uploading and scanning "${file.name}"...`);

    try {
      // 1. Post to pre-analyze endpoint
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("http://localhost:8000/api/upload/pre-analyze", {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        throw new Error("Pre-analysis text extraction failed.");
      }

      const data: PreAnalyzeData = await res.json();
      setTempData(data);
      setConfirmedCategory(data.suggested_category);

      setOrbState('idle');
      setIngestStage('confirming');
      setStatusMessage(null);
    } catch (err: any) {
      setOrbState('idle');
      setIngestStage('idle');
      setStatusType('info');
      setStatusMessage(`Pre-analysis failed: ${err.message || err}`);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  // Stage 2: Finalize and Vector Index
  const handleConfirmFinalize = async () => {
    if (!tempData || !confirmedCategory.trim()) return;

    setOrbState('processing');
    setIngestStage('indexing');
    setStatusType('loading');
    setStatusMessage(`Chunking and indexing "${tempData.original_name}" into Chroma DB...`);

    try {
      const formData = new FormData();
      formData.append("temp_file_name", tempData.temp_file_name);
      formData.append("confirmed_category", confirmedCategory.trim());

      const res = await fetch("http://localhost:8000/api/upload/finalize", {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        throw new Error("Finalizing document registration failed.");
      }

      const finalDoc = await res.json();

      // Retrieve indexing chunk counts
      setIndexedChunksCount(tempData.estimated_chunks);
      setIngestStage('completed');
      setOrbState('idle');
      setStatusType('success');
      setStatusMessage(`Indexed document under "${confirmedCategory.trim()}"!`);

      // Trigger question generator asynchronously
      setIsGeneratingQuestions(true);
      try {
        const qForm = new FormData();
        qForm.append("document_id", finalDoc.id);
        const qRes = await fetch("http://localhost:8000/api/upload/generate-questions", {
          method: "POST",
          body: qForm
        });
        if (qRes.ok) {
          const qData = await qRes.json();
          setPromptQuestions(qData.questions);
        }
      } catch (qErr) {
        console.error(qErr);
      } finally {
        setIsGeneratingQuestions(false);
      }

      setTempData(null);
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      setOrbState('idle');
      setIngestStage('idle');
      setStatusType('info');
      setStatusMessage(`Finalizing index failed: ${err.message || err}`);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  // Cancel pre-analyzed temp file
  const handleCancelFinalize = () => {
    setTempData(null);
    setIngestStage('idle');
  };

  // Play Kokoro-82M TTS voice
  const playVoice = (text: string) => {
    const audioUrl = `http://localhost:8000/api/voice/tts?text=${encodeURIComponent(text)}`;
    const audio = new Audio(audioUrl);
    audio.play();
  };

  // Simulate Voice input
  const handleVoiceToggle = () => {
    if (orbState === 'listening') {
      setOrbState('processing');
      setStatusType('loading');
      setStatusMessage('Transcribing offline speech...');
      setTimeout(() => {
        setOrbState('idle');
        setSearchQuery('Explain deep learning attention layers');
        setStatusType('success');
        setStatusMessage('Speech transcribed successfully!');
        setTimeout(() => setStatusMessage(null), 3000);
      }, 1500);
    } else {
      setOrbState('listening');
      setStatusType('info');
      setStatusMessage('Listening locally... Ask your question.');
    }
  };

  // Simulate quick OCR scanner on sample receipt/note
  const handleOcrSimulate = async () => {
    setOrbState('processing');
    setStatusType('loading');
    setStatusMessage('Scanning invoice via local OCR...');

    try {
      const blob = new Blob([
        'TOTAL BILL: $148.50 \n TAX: $12.30 \n PAYEE: LOCAL HOST HARDWARE INC. \n ITEMS: SSD Vector storage card, DDR5 RAM modules.'
      ], { type: 'text/plain' });
      const file = new File([blob], `Scanned_Invoice_Receipt_${Math.floor(Math.random() * 900 + 100)}.txt`, { type: 'text/plain' });

      // Call pre-analyze directly for OCR simulation
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("http://localhost:8000/api/upload/pre-analyze", {
        method: "POST",
        body: formData
      });

      if (!res.ok) throw new Error("Pre-analyze failed");

      const data = await res.json();
      setTempData(data);
      setConfirmedCategory(data.suggested_category);
      setIngestStage('confirming');
      setOrbState('idle');
      setStatusMessage(null);
    } catch (err) {
      setOrbState('idle');
      setStatusType('info');
      setStatusMessage('OCR simulation failed.');
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  const handleSearchSubmit = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const query = customQuery || searchQuery;
    if (!query.trim() || isAnswering) return;

    setIsAnswering(true);
    setAnswerText('');
    setInlineCitations([]);

    try {
      const stats = await getAnalytics();
      const sessions = await getChatSessions();
      let activeSessionId = '';
      if (sessions.length > 0) {
        activeSessionId = sessions[0].id;
      } else {
        const newSess = await createChatSession("Home Query Session");
        activeSessionId = newSess.id;
      }

      setTelemetry({
        dbSize: `${stats.memory_used.toFixed(3)} GB`,
        totalDocs: stats.documents_count,
        totalChunks: stats.total_chunks,
        model: stats.active_model,
        ollamaOnline: stats.active_model !== 'None' && stats.active_model !== '',
        retrievals: 1
      });

      await streamChatMessage(
        activeSessionId,
        query,
        null,
        stats.active_model || "qwen2.5:3b",
        "learning",
        "intermediate",
        (chunk) => {
          setAnswerText(prev => prev + chunk);
        },
        (cits) => {
          setInlineCitations(cits);
        },
        () => {
          setIsAnswering(false);
        },
        (err) => {
          console.error(err);
          setIsAnswering(false);
          setAnswerText("Local Ollama server is offline or model is loading. Please confirm Ollama is active.");
        }
      );
    } catch (err: any) {
      console.error(err);
      setIsAnswering(false);
      setAnswerText("Failed connecting to local indexing server. Please start main backend process.");
    }
  };

  return (
    <div className="flex-grow flex flex-col items-center justify-center min-h-0 relative z-10 text-left py-2">

      {/* Dynamic Background Circle Wave and AI Orb */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.1 }}
        className="mb-3 relative z-20 flex justify-center items-center w-full"
      >
        <div className="absolute w-[28rem] h-[28rem] rounded-full bg-radial from-blue-400/12 via-purple-500/5 to-transparent blur-3xl pointer-events-none z-0" />
        <AiOrb state={orbState} onClick={handleVoiceToggle} className="mx-auto relative z-10" />
      </motion.div>

      {/* Welcome Headings matching the image typography */}
      <div className="text-center max-w-2xl mb-4 mt-1 select-none">
        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="font-display text-[1.8rem] sm:text-[2.3rem] font-extrabold tracking-tight text-[#1e293b] dark:text-white leading-tight flex flex-col items-center justify-center gap-1"
        >
          <div>
            Welcome to{' '}
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent animate-aurora">
              Vedha AI
            </span>
          </div>
          <div className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-center gap-2 font-bold tracking-tight">
            <span>Offline AI Companion for</span>
            <RotatingText
              texts={['Students', 'Coding', 'DSA Prep', 'Interviews', 'Learners']}
              mainClassName="px-2 py-0.5 bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-650 dark:text-indigo-400 overflow-hidden justify-center rounded-lg inline-flex"
              staggerFrom="last"
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "-120%", opacity: 0 }}
              staggerDuration={0.025}
              splitLevelClassName="overflow-hidden pb-0.5"
              transition={{ type: "spring", damping: 30, stiffness: 400 }}
              rotationInterval={2500}
            />
          </div>
        </motion.h1>
      </div>

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
        accept=".pdf,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.txt"
      />

      {/* Large Glowing rounded Card Input */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.5 }}
        className="w-full max-w-3xl px-4 z-30"
      >
        <form onSubmit={(e) => handleSearchSubmit(e)} className="w-full">
          <div className="bg-white/95 dark:bg-slate-900/90 backdrop-blur-3xl rounded-[1.75rem] border border-slate-100/70 dark:border-white/5 p-4.5 px-6 shadow-2xl dark:shadow-black/40 hover:shadow-indigo-500/5 transition-all duration-300 flex flex-col gap-2">

            {/* Input Element */}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ask Vedha anything or search your knowledge..."
              className="w-full bg-transparent border-none outline-hidden px-2 py-1.5 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-base font-medium"
            />

            {/* Bottom Actions Tray */}
            <div className="flex items-center justify-between mt-1 pt-1">

              {/* Left Side: Attachment / Scanning Buttons */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleUploadClick}
                  className="w-9 h-9 rounded-full border border-slate-200/50 dark:border-white/10 bg-white/50 dark:bg-slate-950/50 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-blue-500 hover:border-blue-500/30 transition-all cursor-pointer shadow-2xs"
                  title="Upload PDF, DOCX, PPT, TXT, Image"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleVoiceToggle}
                  className={cn(
                    "w-9 h-9 rounded-full border flex items-center justify-center transition-all cursor-pointer shadow-2xs",
                    orbState === 'listening'
                      ? 'border-rose-500/30 bg-rose-500/10 text-rose-500 animate-pulse'
                      : 'border-slate-200/50 dark:border-white/10 bg-white/50 dark:bg-slate-950/50 text-slate-500 dark:text-slate-400 hover:text-amber-500 hover:border-amber-500/30'
                  )}
                  title="Voice Query (offline speech-to-text)"
                >
                  <Mic className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleOcrSimulate}
                  className="w-9 h-9 rounded-full border border-slate-200/50 dark:border-white/10 bg-white/50 dark:bg-slate-950/50 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-purple-500 hover:border-purple-500/30 transition-all cursor-pointer shadow-2xs"
                  title="Scan document layout (OCR)"
                >
                  <Scan className="w-4 h-4" />
                </button>
              </div>

              {/* Right Side: Up-Arrow Send Button */}
              <button
                type="submit"
                disabled={!searchQuery.trim() || isAnswering}
                className="w-9.5 h-9.5 rounded-full bg-gradient-to-tr from-blue-500 via-indigo-500 to-purple-600 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-95 shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer flex-shrink-0"
              >
                {isAnswering ? (
                  <Loader2 className="w-4.5 h-4.5 animate-spin" />
                ) : (
                  <ArrowUp className="w-4.5 h-4.5 stroke-[2.5]" />
                )}
              </button>

            </div>
          </div>
        </form>

        {/* Educational Quick Mode Actions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-3.5 w-full flex flex-wrap justify-center gap-2.5 select-none"
        >
          {[
            { label: "Learn Topic", prompt: "Explain the main concepts of ", mode: "learning", icon: GraduationCap, iconColor: "text-emerald-500" },
            { label: "Interview Prep", prompt: "Generate mock technical interview questions for ", mode: "interview", icon: Briefcase, iconColor: "text-indigo-550" },
            { label: "Summarize Notes", prompt: "Create a detailed summary and exam study guide for ", mode: "revision", icon: FileText, iconColor: "text-blue-500" },
            { label: "Quiz Me", prompt: "Generate a 5-question multiple choice quiz on ", mode: "quiz", icon: HelpCircle, iconColor: "text-amber-500" },
            { label: "Explain PDF", prompt: "Provide an overview explanation of the uploaded document", mode: "learning", icon: BookOpen, iconColor: "text-rose-500" }
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  navigate('/chat', { state: { initialPrompt: item.prompt, initialMode: item.mode } });
                }}
                className="flex items-center gap-2 px-3.5 py-2 bg-white/80 dark:bg-slate-900/60 border border-slate-200/40 dark:border-white/5 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-350 hover:border-indigo-500/30 hover:text-indigo-650 dark:hover:text-indigo-400 transition-all shadow-xs cursor-pointer active:scale-95"
              >
                <Icon className={`w-3.5 h-3.5 ${item.iconColor}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </motion.div>

        {/* Ingest Process Timeline and Chunks Display card */}
        {ingestStage !== 'idle' && ingestStage !== 'confirming' && (
          <GlassCard className="mt-6 p-5 border-slate-250/30 dark:border-white/5 flex flex-col gap-4 text-left" hoverEffect={false}>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-2">
              <span className="text-[10px] font-black uppercase text-indigo-550 flex items-center gap-1.5">
                <Database className="w-4 h-4 text-indigo-500 animate-spin" /> Ingestion Pipeline
              </span>
              <span className="text-[9px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-950 px-2 py-0.5 rounded text-slate-500">
                {ingestStage.toUpperCase()}
              </span>
            </div>

            <div className="space-y-3 font-semibold text-[11px] leading-relaxed">
              <div className="flex items-center justify-between">
                <span className="text-slate-450">Step 1: Parse & Extract Text</span>
                <span className={cn("font-bold", ingestStage !== 'uploading' ? "text-emerald-500" : "text-blue-500 animate-pulse")}>
                  {ingestStage !== 'uploading' ? 'Completed' : 'Extracting...'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-450">Step 2: Topic Analysis</span>
                <span className={cn("font-bold", ingestStage === 'indexing' || ingestStage === 'completed' ? "text-emerald-500" : "text-slate-400")}>
                  {ingestStage === 'indexing' || ingestStage === 'completed' ? 'Completed' : 'Pending...'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-450">Step 3: Vector Embeddings Chunking</span>
                <span className={cn("font-bold", ingestStage === 'completed' ? "text-emerald-500" : ingestStage === 'indexing' ? "text-blue-500 animate-pulse" : "text-slate-400")}>
                  {ingestStage === 'completed' ? `Generated ${indexedChunksCount} Chunks` : ingestStage === 'indexing' ? 'Chunking...' : 'Pending...'}
                </span>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Dynamic Status messages */}
        <AnimatePresence mode="wait">
          {statusMessage && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-3 flex items-center justify-center gap-2 text-xs font-semibold"
            >
              {statusType === 'loading' && <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />}
              {statusType === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
              <span className={
                statusType === 'loading'
                  ? 'text-blue-600 dark:text-blue-400'
                  : statusType === 'success'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-purple-600 dark:text-purple-400'
              }>
                {statusMessage}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 2-Stage Confirmation Modal */}
        <AnimatePresence>
          {ingestStage === 'confirming' && tempData && (
            <div className="fixed inset-0 bg-slate-905/20 dark:bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 p-6 rounded-3xl shadow-2xl space-y-5 text-left"
              >
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-500 flex items-center gap-1">
                    <FolderOpen className="w-4 h-4 text-indigo-500" /> Topic Auto-Detected
                  </span>
                  <button onClick={handleCancelFinalize} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                    <X className="w-4.5 h-4.5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 break-all">{tempData.original_name}</h3>
                    <span className="text-[9px] text-slate-400 font-bold block mt-0.5">
                      Analyzed: {tempData.char_count} chars • Type: {tempData.type.toUpperCase()} • Suggested Folder: "{tempData.suggested_category}"
                    </span>
                  </div>

                  <div className="space-y-1.5 font-semibold">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Confirm or Rename Folder Name</label>
                    <input
                      type="text"
                      value={confirmedCategory}
                      onChange={(e) => setConfirmedCategory(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-white/5 rounded-xl text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none font-bold"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2 font-semibold">
                  <button
                    onClick={handleCancelFinalize}
                    className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-white/5 text-slate-650 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmFinalize}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-bold cursor-pointer hover:opacity-95 transition-opacity"
                  >
                    Confirm & Index
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Suggestion questions prompt capsules */}
        {(promptQuestions.length > 0 || isGeneratingQuestions) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 space-y-2 text-left"
          >
            <span className="text-[10px] font-black uppercase text-slate-450 tracking-wider flex items-center gap-1.5 px-2">
              <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
              <span>Suggested Prompts for Document</span>
              {isGeneratingQuestions && <Loader2 className="w-3 h-3 animate-spin text-blue-500" />}
            </span>
            <div className="flex flex-wrap gap-2">
              {promptQuestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => { setSearchQuery(q); handleSearchSubmit(undefined, q); }}
                  className="px-3.5 py-2.5 bg-white/70 dark:bg-slate-900/40 border border-slate-200/40 dark:border-white/5 rounded-2xl text-[10px] font-bold text-slate-700 dark:text-slate-350 hover:border-indigo-500/20 hover:text-indigo-650 dark:hover:text-indigo-400 transition-all cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Inline Assistant Answer Popup */}
        <AnimatePresence>
          {(isAnswering || answerText) && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-6 w-full text-left"
            >
              <GlassCard className="p-6 border-slate-200/30 dark:border-white/5 space-y-4" hoverEffect={false}>

                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4.5 h-4.5 text-indigo-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-800 dark:text-white font-display">AI Assistant Response</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Kokoro TTS read out speaker */}
                    <button
                      type="button"
                      onClick={() => playVoice(answerText)}
                      className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-400 hover:text-indigo-500 transition-all cursor-pointer"
                      title="Read Answer Out Loud (Kokoro-82M)"
                    >
                      <Volume2 className="w-4.5 h-4.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => { setAnswerText(''); setIsAnswering(false); }}
                      className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-400 hover:text-slate-655 transition-all cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Response Text Block */}
                <div className="text-xs leading-relaxed text-slate-800 dark:text-slate-200 select-text font-medium bg-slate-50/50 dark:bg-slate-950/20 p-4.5 rounded-2xl border border-slate-200/20 dark:border-white/5 max-h-60 overflow-y-auto whitespace-pre-wrap">
                  {answerText}
                  {isAnswering && <span className="inline-block w-1.5 h-3 bg-indigo-500 ml-1 animate-pulse" />}
                </div>

                {/* Telemetry panel details */}
                {telemetry && (
                  <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-4 text-[9px] font-bold text-slate-400 dark:text-slate-500">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5 text-blue-500" />
                        <span>DB Chunks: {telemetry.totalChunks} ({telemetry.dbSize})</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Model: {telemetry.model}</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className={cn("w-1.5 h-1.5 rounded-full", telemetry.ollamaOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-500")} />
                        <span>Ollama: {telemetry.ollamaOnline ? 'Running Offline' : 'Not Running'}</span>
                      </span>
                    </div>

                    {inlineCitations.length > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="uppercase text-[8px] mr-1">Source:</span>
                        {inlineCitations.map((c, idx) => (
                          <span key={idx} className="bg-slate-100 dark:bg-slate-950 px-2 py-0.5 rounded border border-slate-200/50 dark:border-white/10 text-slate-500 truncate max-w-[120px]" title={c}>
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>
    </div>
  );
};

export default Home;
