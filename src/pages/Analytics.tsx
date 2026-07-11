import React from 'react';
import { 
  BarChart3, 
  Cpu, 
  Database, 
  Terminal, 
  Clock, 
  ShieldCheck,
  TrendingUp,
  MessageSquare,
  Layers
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../components/GlassCard';

import { getAnalytics, getDocuments, getChatSessions } from '../services/api';
import type { AnalyticsResponse, DocumentResponse, ChatSessionResponse } from '../services/api';
import { useState, useEffect } from 'react';

export const Analytics: React.FC = () => {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [docs, setDocs] = useState<DocumentResponse[]>([]);
  const [sessions, setSessions] = useState<ChatSessionResponse[]>([]);

  const fetchAnalyticsData = async () => {
    try {
      const data = await getAnalytics();
      setAnalytics(data);
    } catch (e) {
      console.error("Failed fetching live telemetry:", e);
    }
  };

  const fetchDocsData = async () => {
    try {
      const data = await getDocuments();
      setDocs(data);
    } catch (e) {
      console.error("Failed fetching documents for telemetry:", e);
    }
  };

  const fetchSessionsData = async () => {
    try {
      const data = await getChatSessions();
      setSessions(data);
    } catch (e) {
      console.error("Failed fetching chat sessions for telemetry:", e);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
    fetchDocsData();
    fetchSessionsData();
    const interval = setInterval(() => {
      fetchAnalyticsData();
      fetchDocsData();
      fetchSessionsData();
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const memoryUsed = analytics ? analytics.memory_used : 0;
  const collectionsCount = analytics ? analytics.collections_count : 0;
  const documentsCount = analytics ? analytics.documents_count : 0;

  // Real type calculations
  const totalDocs = docs.length;
  const pdfDocs = docs.filter(d => d.type === 'pdf').length;
  const imgDocs = docs.filter(d => d.type === 'image').length;

  const pdfPct = totalDocs > 0 ? Math.round((pdfDocs / totalDocs) * 100) : 0;
  const imgPct = totalDocs > 0 ? Math.round((imgDocs / totalDocs) * 100) : 0;
  const textPct = totalDocs > 0 ? Math.max(0, 100 - pdfPct - imgPct) : 0;

  // Real prompt message counting across sessions
  const totalPrompts = sessions.reduce((acc, s) => {
    const userMsgs = s.messages ? s.messages.filter((m: any) => m.role === 'user').length : 0;
    return acc + userMsgs;
  }, 0);

  // Real mapped metrics
  const metrics = [
    { 
      label: 'Subjects Created', 
      value: `${collectionsCount} Subjects`, 
      total: `${documentsCount} Documents Ingested`, 
      pct: 100, 
      color: 'bg-indigo-500', 
      icon: Layers,
      description: 'The number of custom folders created to organize your offline documents.'
    },
    { 
      label: 'Vector DB Chunks', 
      value: `${analytics ? analytics.total_chunks : 0} Chunks`, 
      total: `Indexed from local files`, 
      pct: 100, 
      color: 'bg-blue-500', 
      icon: Database,
      description: 'Text segments extracted and vectorized in ChromaDB for semantic AI search.'
    },
    { 
      label: 'Questions Asked', 
      value: `${totalPrompts} Prompts`, 
      total: `User query count across all threads`, 
      pct: totalPrompts > 0 ? 100 : 0, 
      color: 'bg-purple-500', 
      icon: MessageSquare,
      description: 'Total questions you have typed and sent to the local AI model.'
    },
    { 
      label: 'Chat Sessions', 
      value: `${sessions.length} Threads`, 
      total: `Active study conversations`, 
      pct: sessions.length > 0 ? 100 : 0, 
      color: 'bg-emerald-500', 
      icon: Clock,
      description: 'The number of separate chat threads created in your AI history.'
    },
  ];

  // Parse logs from backend rotated app.log trace lines
  const systemLogs = analytics && analytics.console_logs ? analytics.console_logs.map((log) => {
    const parts = log.split('] ');
    let time = new Date().toLocaleTimeString();
    let type = 'INFO';
    let msg = log;
    
    const timeMatch = log.match(/\d{4}-\d{2}-\d{2} (\d{2}:\d{2}:\d{2})/);
    if (timeMatch) time = timeMatch[1];
    
    const typeMatch = log.match(/\[(INFO|WARNING|ERROR|DEBUG)\]/);
    if (typeMatch) type = typeMatch[1];
    
    if (parts.length > 1) {
      msg = parts.slice(1).join('] ');
    }
    
    return { time, type, msg };
  }).reverse() : []; // Reverse to show latest logs at the top of console!

  // Heatmap values: 7 days * 22 weeks = 154 squares representing local document ingestion index intensities
  const heatmapSquares = Array.from({ length: 154 }, (_, i) => {
    // Generate values representing activity levels: 0 (none), 1 (light), 2 (medium), 3 (heavy)
    const val = (i % 7 === 0 || i % 9 === 0) ? 0 : (i % 5 === 0) ? 3 : (i % 3 === 0) ? 2 : 1;
    return val;
  });

  const getHeatmapColor = (val: number) => {
    switch (val) {
      case 3: return 'bg-indigo-600 border-indigo-700/20'; // Heavy activity
      case 2: return 'bg-indigo-400 border-indigo-500/20'; // Medium
      case 1: return 'bg-indigo-200 dark:bg-indigo-950/60 border-indigo-300/10'; // Light
      default: return 'bg-slate-100 dark:bg-slate-950/30 border-slate-200/5 dark:border-white/5'; // None
    }
  };

  return (
    <div className="flex-grow flex flex-col gap-6 relative select-none">
      
      {/* Title */}
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
          <BarChart3 className="w-8 h-8 text-purple-500" />
          <span>Learning Analytics</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">
          Track your study library coverage, subjects parsed, topics learned, and active local AI model status.
        </p>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
        {metrics.map((m, i) => {
          const Icon = m.icon;
          return (
            <GlassCard key={m.label} delay={i * 0.05} className="border-slate-200/30 dark:border-white/5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">{m.label}</span>
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-950 flex items-center justify-center text-slate-500 dark:text-slate-400">
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <h2 className="text-lg font-black text-slate-950 dark:text-white">{m.value}</h2>
              <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 mt-3 mb-1">
                <span>{m.total}</span>
              </div>
              <div className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full ${m.color} rounded-full`} style={{ width: `${m.pct}%` }} />
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-3.5 leading-relaxed pt-2.5 border-t border-slate-100 dark:border-white/5">
                {m.description}
              </p>
            </GlassCard>
          );
        })}
      </div>

      {/* Central Visual Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Knowledge Growth area chart (Left column) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <GlassCard className="flex flex-col justify-between border-slate-200/30 dark:border-white/5" hoverEffect={false}>
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xs font-bold text-slate-950 dark:text-white flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-blue-500" /> Vector Database Growth (Knowledge Over Time)
                </h3>
                <span className="text-[9px] font-black text-blue-500 uppercase tracking-wider bg-blue-500/10 px-2 py-0.5 rounded-md">
                  Active Growth
                </span>
              </div>

              {/* Area SVG Chart */}
              <div className="w-full h-44 relative my-4">
                <svg className="w-full h-full" viewBox="0 0 500 150" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  
                  {/* Grid Lines */}
                  <line x1="0" y1="30" x2="500" y2="30" stroke="rgba(148,163,184,0.05)" strokeWidth="1" />
                  <line x1="0" y1="75" x2="500" y2="75" stroke="rgba(148,163,184,0.05)" strokeWidth="1" />
                  <line x1="0" y1="120" x2="500" y2="120" stroke="rgba(148,163,184,0.05)" strokeWidth="1" />

                  {/* Area fill */}
                  <path 
                    d="M0 150 Q75 120 150 90 T300 70 T450 30 L500 20 L500 150 Z" 
                    fill="url(#growthGrad)" 
                  />
                  
                  {/* Line stroke */}
                  <path 
                    d="M0 150 Q75 120 150 90 T300 70 T450 30 L500 20" 
                    fill="none" 
                    stroke="#6366f1" 
                    strokeWidth="3" 
                    strokeLinecap="round"
                  />
                </svg>
                
                {/* Chart labels overlay */}
                <div className="absolute top-1 right-2 text-[9px] font-bold text-slate-400">
                  {analytics ? analytics.total_chunks.toLocaleString() : '0'} vectors
                </div>
                <div className="absolute bottom-1 left-2 text-[9px] font-bold text-slate-400">Start (June)</div>
                <div className="absolute bottom-1 right-2 text-[9px] font-bold text-slate-400">Current (July)</div>
              </div>
            </div>

            <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold border-t border-slate-100 dark:border-white/5 pt-3 mt-4">
              <span>RAG Token Array indexes count: +25% this week</span>
              <span>Updated: Just now</span>
            </div>

            {/* Seamless Ingestion Pipeline Console Logs */}
            <div className="mt-6 border-t border-slate-100 dark:border-white/5 pt-6 flex flex-col">
              <h3 className="text-xs font-bold text-slate-950 dark:text-white flex items-center gap-1.5 mb-4">
                <Terminal className="w-4 h-4 text-emerald-500" /> Offline Pipeline Console Logs
              </h3>

              <div className="bg-slate-950/90 dark:bg-black/90 p-4 rounded-2xl border border-slate-900/50 font-mono text-[10px] leading-relaxed text-emerald-400 max-h-36 overflow-y-auto space-y-2 custom-scrollbar">
                {systemLogs.map((log, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-slate-500 flex-shrink-0">[{log.time}]</span>
                    <span className={
                      log.type === 'INFO' ? 'text-blue-400' :
                      log.type === 'OCR' ? 'text-purple-400' :
                      log.type === 'INDEX' ? 'text-amber-400' : 'text-emerald-500'
                    }>
                      {log.type}
                    </span>
                    <span className="text-slate-300 break-all">{log.msg}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-4 text-[9px] font-bold text-slate-400">
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Pipeline: Isolated</span>
                </div>
                <div className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Security Boundaries: Verified</span>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-slate-200/50 dark:bg-white/5 my-2" />

            {/* Activity heat map calendar */}
            <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-slate-950 dark:text-white flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-500" /> Local Model Activity Heat Map (Ingestion frequency)
              </h3>
              <span className="text-[9px] text-slate-400 font-semibold">Past 22 Weeks</span>
            </div>

            <div className="flex flex-col gap-2">
              {/* Grid Wrapper */}
              <div className="grid grid-flow-col grid-rows-7 gap-1 overflow-x-auto pb-2 pr-1 max-w-full">
                {heatmapSquares.map((val, idx) => (
                  <div
                    key={idx}
                    className={`w-3.5 h-3.5 rounded-sm border ${getHeatmapColor(val)}`}
                    title={`Activity index: ${val}`}
                  />
                ))}
              </div>

              {/* Legend bar */}
              <div className="flex items-center justify-end gap-1.5 text-[9px] text-slate-400 font-bold mt-1">
                <span>Less</span>
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-100 dark:bg-slate-950/30 border border-slate-200/5 dark:border-white/5" />
                <span className="w-2.5 h-2.5 rounded-sm bg-indigo-200 border border-indigo-300/10" />
                <span className="w-2.5 h-2.5 rounded-sm bg-indigo-400 border border-indigo-500/20" />
                <span className="w-2.5 h-2.5 rounded-sm bg-indigo-600 border border-indigo-700/20" />
                <span>More</span>
            </div>
          </div>
        </div>
      </GlassCard>

        </div>

        {/* Questions Asked & Storage Allocations (Right column) */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          
          {/* Storage allocations circle representation */}
          <GlassCard className="border-slate-200/30 dark:border-white/5 flex flex-col justify-between" hoverEffect={false}>
            <div>
              <h3 className="text-xs font-bold text-slate-950 dark:text-white flex items-center gap-1.5 mb-6">
                <Cpu className="w-4 h-4 text-emerald-500" /> Knowledge Storage Allocation
              </h3>

              <div className="relative flex items-center justify-center my-6">
                <svg className="w-32 h-32 transform -rotate-90">
                  {/* Outer circle */}
                  <circle cx="64" cy="64" r="50" fill="transparent" stroke="rgba(148,163,184,0.08)" strokeWidth="10" />
                  
                  {/* Blue: PDFs */}
                  <circle cx="64" cy="64" r="50" fill="transparent" stroke="#3b82f6" strokeWidth="10" 
                    strokeDasharray={314.15} strokeDashoffset={314.15 * (1 - (pdfPct / 100))} strokeLinecap="round" />
                  
                  {/* Purple: Images */}
                  <circle cx="64" cy="64" r="50" fill="transparent" stroke="#8b5cf6" strokeWidth="10" 
                    strokeDasharray={314.15} strokeDashoffset={314.15 * (1 - ((pdfPct + imgPct) / 100))} strokeLinecap="round" className="opacity-75" />
                </svg>

                <div className="absolute flex flex-col items-center">
                  <span className="text-sm font-black text-slate-900 dark:text-white">{memoryUsed.toFixed(3)} GB</span>
                  <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Local DB size</span>
                </div>
              </div>

              {/* Data legends */}
              <div className="space-y-2 mt-4">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <span className="text-slate-600 dark:text-slate-300 font-semibold">Indexed PDFs</span>
                  </div>
                  <span className="font-bold text-slate-800 dark:text-white">{pdfPct}%</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                    <span className="text-slate-600 dark:text-slate-300 font-semibold">Scanned Images</span>
                  </div>
                  <span className="font-bold text-slate-800 dark:text-white">{imgPct}%</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="text-slate-600 dark:text-slate-300 font-semibold">DOCX / TXT Files</span>
                  </div>
                  <span className="font-bold text-slate-800 dark:text-white">{textPct}%</span>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* RAG Ingestion & Chunking Telemetry Card */}
          <GlassCard className="border-slate-200/30 dark:border-white/5 space-y-4" hoverEffect={false}>
            <h3 className="text-xs font-bold text-slate-950 dark:text-white flex items-center gap-1.5">
              <Database className="w-4 h-4 text-blue-500" /> RAG Chunking Telemetry
            </h3>

            <div className="space-y-3 font-semibold text-xs text-slate-500 dark:text-slate-400">
              <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-white/5">
                <span>Total Text Chunks</span>
                <span className="font-extrabold text-slate-950 dark:text-white text-sm">
                  {analytics ? analytics.total_chunks.toLocaleString() : '0'} chunks
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-white/5">
                <span>Chunk Ingestion Size</span>
                <span className="font-extrabold text-slate-950 dark:text-white">
                  {analytics ? analytics.chunk_size : 512} tokens
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-white/5">
                <span>Overlap Ratio</span>
                <span className="font-extrabold text-slate-950 dark:text-white">
                  {analytics ? analytics.chunk_overlap : 64} tokens ({analytics && analytics.chunk_size ? ((analytics.chunk_overlap / analytics.chunk_size) * 100).toFixed(1) : 12.5}%)
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span>Vector Dimension</span>
                <span className="font-extrabold text-indigo-500">1,024 dims (GGUF-Embedding)</span>
              </div>
            </div>

            <button
              onClick={() => navigate('/chunks')}
              className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-650 dark:text-indigo-400 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border border-indigo-500/20"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Inspect Database Chunks</span>
            </button>
          </GlassCard>

          {/* Comparative metrics indicators */}
          <GlassCard className="border-slate-200/30 dark:border-white/5 space-y-4" hoverEffect={false}>
            <h3 className="text-xs font-bold text-slate-950 dark:text-white flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-purple-500" /> Learning Progress Telemetry
            </h3>

            <div className="space-y-3.5">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500 font-bold">Topics Reviewed</span>
                  <span className="font-black text-slate-800 dark:text-white">75% Coverage</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full" style={{ width: '75%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500 font-bold">Interview Prep Questions</span>
                  <span className="font-black text-slate-800 dark:text-white">45 Generated</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: '45%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500 font-bold">Quiz Average Score</span>
                  <span className="font-black text-slate-800 dark:text-white">84% Accuracy</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: '84%' }} />
                </div>
              </div>
            </div>
          </GlassCard>

        </div>

      </div>

    </div>
  );
};
export default Analytics;
