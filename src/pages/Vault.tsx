import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Database, 
  Search, 
  Plus, 
  LayoutGrid, 
  List, 
  FileText, 
  BookOpen, 
  Cpu, 
  Clock, 
  CheckCircle2, 
  Loader2, 
  X,
  FileCheck,
  FolderKanban,
  Zap,
  TrendingUp,
  ChevronRight,
  ShieldCheck,
  FolderPlus,
  Trash2,
  Edit2
} from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { cn } from '../utils/utils';
import { 
  getCollections, 
  getDocuments, 
  uploadDocument, 
  createCollection, 
  deleteCollection, 
  getAnalytics,
  deleteDocument,
  renameCollection,
  getDocumentChunks
} from '../services/api';
import type { AnalyticsResponse } from '../services/api';

const getIconComponent = (type: string) => {
  if (type === "FolderKanban") return FolderKanban;
  if (type === "FileCheck") return FileCheck;
  if (type === "Database") return Database;
  return BookOpen;
};

// Interfaces
interface MockDocument {
  id: string;
  name: string;
  size: string;
  type: 'pdf' | 'docx' | 'ppt' | 'image' | 'txt';
  status: 'Indexed' | 'Processing' | 'Failed';
  uploadDate: string;
  tags: string[];
  summary?: string;
  ocrText?: string;
  collection_id: string;
}

interface VaultCollection {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  notesCount: number;
  filesCount: number;
  progress: number;
  lastUpdated: string;
  description: string;
}

export const Vault: React.FC = () => {
  React.useEffect(() => {
    window.scrollTo(0, 0);
    const params = new URLSearchParams(window.location.search);
    const searchVal = params.get('search');
    if (searchVal) {
      setSearchQuery(searchVal);
    }
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [collections, setCollections] = useState<VaultCollection[]>([]);
  const [documents, setDocuments] = useState<MockDocument[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Modal / Detail Inspector States
  const [selectedCollection, setSelectedCollection] = useState<VaultCollection | null>(null);
  const [previewDoc, setPreviewDoc] = useState<MockDocument | null>(null);
  
  // Upload Status
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadName, setUploadName] = useState('');

  // Create Collection Form Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColDesc, setNewColDesc] = useState('');

  // Rename & Chunk Counts state for active collection drawer
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState('');
  const [collectionChunksCount, setCollectionChunksCount] = useState<number>(0);

  // OCR Activity Log State (will be mapped from analytics)
  const [ocrLogs, setOcrLogs] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const loadData = async () => {
    try {
      const colsData = await getCollections();
      const docsData = await getDocuments();
      const analyticsData = await getAnalytics();
      
      const mappedCols = colsData.map(c => ({
        id: c.id,
        name: c.name,
        icon: getIconComponent(c.icon_type),
        notesCount: 0,
        filesCount: c.documents_count,
        progress: c.progress,
        lastUpdated: c.updated_at,
        description: c.description || ''
      }));
      
      setCollections(mappedCols);
      setDocuments(docsData as any);
      setAnalytics(analyticsData);
      
      if (analyticsData.recent_ocr) {
        setOcrLogs(analyticsData.recent_ocr.map(item => 
          `Scanned & indexed "${item.document_name}" locally.`
        ));
      }
    } catch (err) {
      console.error("Failed loading local vault telemetry:", err);
    }
  };

  const loadCollectionChunks = async (colId: string) => {
    try {
      const chunks = await getDocumentChunks(colId);
      setCollectionChunksCount(chunks.length);
    } catch (e) {
      console.error("Failed fetching collection chunks:", e);
      setCollectionChunksCount(0);
    }
  };

  useEffect(() => {
    loadData();
    // Poll analytics every 4 seconds to check if background OCR finishes or documents update!
    const interval = setInterval(loadData, 4000);
    return () => clearInterval(interval);
  }, []);

  // Reset rename form when a different collection is selected
  useEffect(() => {
    if (selectedCollection) {
      setRenameVal(selectedCollection.name);
      setIsRenaming(false);
    }
  }, [selectedCollection?.id]);

  // Update telemetry chunks count when collection or documents update
  useEffect(() => {
    if (selectedCollection) {
      loadCollectionChunks(selectedCollection.id);
    } else {
      setCollectionChunksCount(0);
    }
  }, [selectedCollection?.id, documents]);

  // Search filter
  const filteredCollections = collections.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // File picker handler
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    
    // Choose target collection
    let targetColId = '';
    if (selectedCollection) {
      targetColId = selectedCollection.id;
    } else if (collections.length > 0) {
      targetColId = collections[0].id;
    } else {
      setUploadName(file.name);
      setUploadProgress(10);
      try {
        const defaultCol = await createCollection("General Knowledge", "Default auto-created collection for fast file ingest.", "Database");
        targetColId = defaultCol.id;
        const colsData = await getCollections();
        const mappedCols = colsData.map(c => ({
          id: c.id,
          name: c.name,
          icon: getIconComponent(c.icon_type),
          notesCount: 0,
          filesCount: c.documents_count,
          progress: c.progress,
          lastUpdated: c.updated_at,
          description: c.description || ''
        }));
        setCollections(mappedCols);
      } catch (colErr) {
        alert("Please create a Knowledge Collection folder first before uploading files.");
        setUploadProgress(null);
        return;
      }
    }
    
    setUploadName(file.name);
    setUploadProgress(10);
    
    try {
      await uploadDocument(file, targetColId, (pct) => {
        setUploadProgress(pct);
      });
      setUploadProgress(null);
      loadData();
    } catch (err: any) {
      console.error(err);
      alert(`Upload failed: ${err.message || err}`);
      setUploadProgress(null);
    }
  };
  const handleRenameSubmit = async () => {
    if (!renameVal.trim() || !selectedCollection) return;
    try {
      const updated = await renameCollection(selectedCollection.id, renameVal.trim(), selectedCollection.description);
      setSelectedCollection({
        ...selectedCollection,
        name: updated.name
      });
      setIsRenaming(false);
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to rename collection");
    }
  };
  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim()) return;
    try {
      await createCollection(newColName.trim(), newColDesc.trim(), 'BookOpen');
      setNewColName('');
      setNewColDesc('');
      setIsCreateModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(`Failed to create collection: ${err.message || err}`);
    }
  };

  const handleAnalyzeDistribute = async () => {
    setIsAnalyzing(true);
    try {
      const res = await fetch("http://localhost:8000/api/documents/analyze-distribute", {
        method: "POST"
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Ollama auto-sorting finished!\nRedistributed documents: ${data.redistributed_count}\nCreated collections: ${data.created_collections.join(", ") || 'None'}`);
        loadData();
      } else {
        const errData = await res.json();
        alert(`Analysis failed: ${errData.detail || 'Ollama connection error'}`);
      }
    } catch (err) {
      console.error(err);
      alert("Failed connecting to auto-distribution API. Ensure Ollama is active.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Memory gauge calculations
  const totalDBSize = analytics ? analytics.memory_used : 0; // GB
  const maxDBSize = analytics ? analytics.memory_max : 10.0; // GB
  const percentageUsed = (totalDBSize / maxDBSize) * 100;
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentageUsed / 100) * circumference;

  return (
    <div className="flex-grow flex flex-col lg:flex-row gap-6 relative select-none">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        className="hidden" 
      />

      {/* Left Workspace Panel: Knowledge Collections & Documents */}
      <div className="flex-grow flex flex-col gap-6 lg:w-3/4">
        
        {/* Controls and Stats Header */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="text-left">
            <h1 className="font-display text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
              <Database className="w-8 h-8 text-indigo-500 animate-pulse" />
              <span>Study Library</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">
              Organize, search and retrieve study materials by Subject fully offline.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggles */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1.5 rounded-xl border border-slate-200/50 dark:border-white/5">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  "p-1.5 rounded-lg cursor-pointer transition-all",
                  viewMode === 'grid' ? "bg-white dark:bg-slate-900 text-blue-500 shadow-2xs" : "text-slate-400"
                )}
              >
                <LayoutGrid className="w-4.5 h-4.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  "p-1.5 rounded-lg cursor-pointer transition-all",
                  viewMode === 'list' ? "bg-white dark:bg-slate-900 text-blue-500 shadow-2xs" : "text-slate-400"
                )}
              >
                <List className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Analyze & Distribute Action */}
            <button
              onClick={handleAnalyzeDistribute}
              disabled={isAnalyzing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-950/20 bg-indigo-500/10 hover:bg-indigo-500/20 disabled:opacity-40 disabled:cursor-not-allowed text-indigo-650 dark:text-indigo-400 font-semibold text-xs shadow-xs cursor-pointer active:scale-98 transition-all flex-shrink-0"
              title="Classify and sort files into study subjects using local Ollama model"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <Cpu className="w-4 h-4 text-indigo-500" />
                  <span>Analyze & Distribute</span>
                </>
              )}
            </button>

            {/* New Subject Action */}
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900 text-slate-800 dark:text-white font-semibold text-xs shadow-xs cursor-pointer active:scale-98 transition-all hover:bg-slate-50 dark:hover:bg-slate-800 flex-shrink-0"
            >
              <FolderPlus className="w-4 h-4 text-indigo-500" />
              <span>New Subject</span>
            </button>

            {/* Upload Action */}
            <button
              onClick={handleUploadClick}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-95 text-white font-semibold text-xs shadow-md shadow-blue-500/10 cursor-pointer active:scale-98 transition-all flex-shrink-0"
            >
              <Plus className="w-4.5 h-4.5" />
              <span>Upload Document</span>
            </button>
          </div>
        </div>

        {/* Global Search and Telemetry */}
        <div className="glass-panel rounded-2xl p-4 border border-slate-200/40 dark:border-white/5 flex items-center justify-between gap-4">
          <div className="relative flex-grow max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search subjects by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-950 border border-slate-200/50 dark:border-white/5 rounded-xl text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-hidden font-bold"
            />
          </div>

          {uploadProgress !== null && (
            <div className="flex items-center gap-3 bg-blue-500/5 px-4 py-2 rounded-xl border border-blue-500/15 max-w-xs w-full text-left">
              <Loader2 className="w-4.5 h-4.5 text-blue-500 animate-spin" />
              <div className="flex-grow space-y-1 min-w-0">
                <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200 truncate block leading-none">{uploadName}</span>
                <div className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
              <span className="text-[10px] font-extrabold text-blue-500">{uploadProgress}%</span>
            </div>
          )}
        </div>

        {/* Collections Viewer grid / list */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
            {filteredCollections.map((c, i) => {
              const CollectionIcon = c.icon;
              return (
                <GlassCard
                  key={c.id}
                  onClick={() => setSelectedCollection(c)}
                  delay={i * 0.05}
                  className="cursor-pointer group relative overflow-hidden transition-all duration-300 hover:shadow-lg border-slate-200/30 dark:border-white/5"
                >
                  <div className="flex items-start justify-between">
                    <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-500 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-all duration-300">
                      <CollectionIcon className="w-5.5 h-5.5" />
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{c.lastUpdated}</span>
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-4 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {c.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2 leading-relaxed font-semibold">
                    {c.description}
                  </p>

                  <div className="h-px bg-slate-200/50 dark:bg-white/5 my-4" />

                  {/* Collections Stats Row */}
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    <div className="flex gap-4">
                      <span>{c.notesCount} notes</span>
                      <span>•</span>
                      <span>{c.filesCount} files</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "w-2 h-2 rounded-full",
                        c.progress === 100 ? "bg-emerald-500" : "bg-blue-500 animate-pulse"
                      )} />
                      <span className="text-[10px] font-extrabold uppercase">{c.progress === 100 ? 'Synced' : `${c.progress}% Syncing`}</span>
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        ) : (
          /* List View */
          <div className="space-y-3 text-left">
            {filteredCollections.map((c) => {
              const CollectionIcon = c.icon;
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedCollection(c)}
                  className="glass-panel rounded-2xl p-4 border border-slate-200/40 dark:border-white/5 hover:border-indigo-500/30 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-500 flex items-center justify-center flex-shrink-0">
                      <CollectionIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white">{c.name}</h3>
                      <span className="text-[10px] text-slate-400 font-semibold">{c.description}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    <span>{c.notesCount} notes</span>
                    <span>{c.filesCount} files</span>
                    <span>Updated {c.lastUpdated}</span>
                    <span className={cn(
                      "px-2 py-0.5 rounded-md text-[8px] uppercase tracking-wider",
                      c.progress === 100 ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" : "bg-blue-500/10 text-blue-600 border border-blue-500/20 animate-pulse"
                    )}>
                      {c.progress === 100 ? 'Synced' : 'Indexing'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Combined Documents Table View */}
        <div className="glass-panel rounded-3xl p-5 border border-slate-200/40 dark:border-white/5 mt-4 text-left">
          <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-4">Ingested Vault Documents ({documents.length})</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-white/5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="pb-3 pl-2">Document Name</th>
                  <th className="pb-3">Type</th>
                  <th className="pb-3">Size</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 pr-2">Date Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs font-bold">
                {documents.map((doc) => (
                  <tr 
                    key={doc.id}
                    onClick={() => setPreviewDoc(doc)}
                    className="hover:bg-slate-100/30 dark:hover:bg-slate-950/20 transition-all cursor-pointer group"
                  >
                    <td className="py-3 pl-2 font-bold text-slate-900 dark:text-white flex items-center gap-2 group-hover:text-indigo-500">
                      <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <span className="truncate max-w-xs">{doc.name}</span>
                    </td>
                    <td className="py-3 uppercase text-slate-400 font-extrabold text-[9px]">{doc.type}</td>
                    <td className="py-3 text-slate-500">{doc.size}</td>
                    <td className="py-3">
                      <span className={cn(
                        "inline-flex items-center gap-1 text-[9px] font-extrabold uppercase",
                        doc.status === 'Indexed' ? "text-emerald-500" : doc.status === 'Failed' ? "text-rose-500" : "text-blue-550"
                      )}>
                        {doc.status === 'Indexed' ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Indexed</span>
                          </>
                        ) : doc.status === 'Failed' ? (
                          <span>Failed</span>
                        ) : (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Indexing</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-3 text-slate-400 font-semibold">{doc.uploadDate}</td>
                  </tr>
                ))}
                {documents.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 text-xs font-semibold">No documents indexed in the database yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Right Workspace Sidebar: Storage & Ingestion Telemetry */}
      <div className="lg:w-1/4 flex flex-col gap-6 text-left">
        
        {/* Memory Usage Circle Widget */}
        <div className="glass-panel rounded-3xl p-5 border border-slate-200/40 dark:border-white/5 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-4">Local Vector Memory</span>
          
          <div className="relative w-36 h-36 flex items-center justify-center">
            {/* SVG circle dial */}
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="72"
                cy="72"
                r={radius}
                className="stroke-slate-100 dark:stroke-slate-950"
                strokeWidth="10"
                fill="transparent"
              />
              <circle
                cx="72"
                cy="72"
                r={radius}
                className="stroke-blue-500"
                strokeWidth="10"
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>
            
            {/* Core textual parameters */}
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-sm font-black text-slate-900 dark:text-white">{totalDBSize} GB</span>
              <span className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">of {maxDBSize} GB max</span>
            </div>
          </div>

          <div className="w-full grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-slate-200/40 dark:border-white/5 text-center">
            <div>
              <span className="text-[9px] text-slate-400 font-bold uppercase block">Subjects</span>
              <span className="text-sm font-black text-slate-800 dark:text-white">{collections.length}</span>
            </div>
            <div>
              <span className="text-[9px] text-slate-400 font-bold uppercase block">Indexed Files</span>
              <span className="text-sm font-black text-slate-800 dark:text-white">{documents.length}</span>
            </div>
          </div>
        </div>

        {/* AI System Status Panel */}
        <div className="glass-panel rounded-3xl p-5 border border-slate-200/40 dark:border-white/5 space-y-4">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block font-display">AI Ingest Parameters</span>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 font-bold flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5 text-blue-500" /> Active Model</span>
              <span className="font-extrabold text-slate-800 dark:text-slate-200">{analytics ? analytics.active_model : 'qwen2.5:3b'}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 font-bold flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-amber-500" /> Ingestion OCR</span>
              <span className="font-extrabold text-slate-800 dark:text-slate-200">{analytics ? (analytics.ocr_status === 'Online' ? 'PaddleOCR' : 'Metadata Only') : 'Checking...'}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 font-bold flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-purple-500" /> Embeddings</span>
              <span className="font-extrabold text-slate-800 dark:text-slate-200">all-MiniLM-L6-v2</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 font-bold flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Vector Database</span>
              <span className="font-extrabold text-slate-800 dark:text-slate-200">ChromaDB</span>
            </div>
          </div>
        </div>

        {/* Recent Ingestion/OCR Activity Logs */}
        <div className="glass-panel rounded-3xl p-5 border border-slate-200/40 dark:border-white/5 space-y-4 flex-grow">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block font-display">Recent OCR Logs</span>
          
          <div className="space-y-3 overflow-y-auto max-h-[22vh]">
            {ocrLogs.map((log, index) => (
              <div 
                key={index}
                className="p-2.5 bg-slate-100/50 dark:bg-slate-950/40 border border-slate-200/30 dark:border-white/5 rounded-xl space-y-1 text-[10px] leading-relaxed text-slate-655 dark:text-slate-400 text-left font-semibold"
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="text-indigo-500">INGEST #{ocrLogs.length - index}</span>
                  <span className="text-slate-400 text-[8px]">SUCCESS</span>
                </div>
                <p className="font-semibold text-slate-700 dark:text-slate-350">{log}</p>
              </div>
            ))}
          </div>
        </div>

      </div>      {/* Collection Details Drawer Overlay */}
      <AnimatePresence>
        {selectedCollection && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/10 dark:bg-black/30 backdrop-blur-xs z-50 flex items-center justify-end"
            onClick={() => setSelectedCollection(null)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="w-full max-w-md h-full bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-white/10 p-6 flex flex-col justify-between shadow-2xl relative text-left"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-6 flex-grow overflow-y-auto pr-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black tracking-wider uppercase text-slate-400">Collection details</span>
                  <button 
                    onClick={() => setSelectedCollection(null)}
                    className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-500 cursor-pointer"
                  >
                    <X className="w-4.5 h-4.5" />
                  </button>
                </div>
 
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-500 flex items-center justify-center">
                      <FolderKanban className="w-6 h-6" />
                    </div>
                    
                    {!isRenaming ? (
                      <button
                        onClick={() => setIsRenaming(true)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-500 hover:text-slate-800 dark:hover:text-white text-[10px] font-bold cursor-pointer transition-all"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Rename Subject</span>
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={handleRenameSubmit}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold cursor-pointer transition-all"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setIsRenaming(false);
                            setRenameVal(selectedCollection.name);
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/5 text-slate-500 hover:bg-slate-50 text-[10px] font-bold cursor-pointer transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>

                  {!isRenaming ? (
                    <h2 className="text-base font-black text-slate-900 dark:text-white">{selectedCollection.name}</h2>
                  ) : (
                    <input
                      type="text"
                      value={renameVal}
                      onChange={(e) => setRenameVal(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSubmit(); }}
                      className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-white/5 rounded-xl text-xs text-slate-800 dark:text-white outline-hidden font-bold"
                    />
                  )}

                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-100/50 dark:bg-slate-900/50 p-3.5 rounded-xl border border-slate-200/30 dark:border-white/5 font-semibold">
                    {selectedCollection.description}
                  </p>
                </div>
 
                <div className="h-px bg-slate-200/50 dark:bg-white/5" />

                {/* Subject Statistics Row */}
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="bg-slate-100/50 dark:bg-slate-900/55 p-3 rounded-xl border border-slate-200/30 dark:border-white/5 flex flex-col items-center justify-center">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block">Total Files</span>
                    <span className="text-base font-black text-slate-800 dark:text-white mt-1">
                      {documents.filter(doc => doc.collection_id === selectedCollection.id).length}
                    </span>
                  </div>
                  <div className="bg-slate-100/50 dark:bg-slate-900/55 p-3 rounded-xl border border-slate-200/30 dark:border-white/5 flex flex-col items-center justify-center">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block">Total Chunks</span>
                    <span className="text-base font-black text-slate-800 dark:text-white mt-1">
                      {collectionChunksCount}
                    </span>
                  </div>
                </div>

                <div className="h-px bg-slate-200/50 dark:bg-white/5" />
 
                {/* List of files in collection */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block font-display">
                      Ingested Files ({documents.filter(doc => doc.collection_id === selectedCollection.id).length})
                    </span>
                    <button
                      onClick={handleUploadClick}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-650 dark:text-indigo-400 font-bold text-[9px] cursor-pointer transition-all"
                    >
                      <Plus className="w-3 h-3 text-indigo-500" />
                      <span>Upload File</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {documents.filter(doc => doc.collection_id === selectedCollection.id).map((doc) => (
                      <div
                        key={doc.id}
                        onClick={() => setPreviewDoc(doc)}
                        className="flex items-center justify-between p-3 rounded-xl border border-slate-200/40 dark:border-white/5 hover:border-indigo-500/30 hover:bg-slate-100/30 dark:hover:bg-slate-900/30 transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <FileText className="w-4.5 h-4.5 text-blue-500 flex-shrink-0" />
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-500 transition-colors">{doc.name}</span>
                        </div>
                        
                        <div className="flex items-center gap-1.5">
                          {/* File Delete Quick Action */}
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (window.confirm(`Are you sure you want to delete "${doc.name}"?`)) {
                                try {
                                  await deleteDocument(doc.id);
                                  loadData();
                                } catch (err) {
                                  alert("Failed to delete document.");
                                }
                              }
                            }}
                            className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/5 cursor-pointer active:scale-95 transition-all opacity-0 group-hover:opacity-100"
                            title="Delete file"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </div>
                      </div>
                    ))}
                    {documents.filter(doc => doc.collection_id === selectedCollection.id).length === 0 && (
                      <span className="text-[10px] text-slate-400 font-bold block py-4 text-center">No files indexed in this collection yet.</span>
                    )}
                  </div>
                </div>
              </div>
 
              <div className="pt-4 border-t border-slate-200/40 dark:border-white/5 flex gap-3">
                <button 
                  onClick={async () => {
                    if (window.confirm("Are you sure you want to delete this collection? This deletes all files and vector indexes inside it.")) {
                      try {
                        await deleteCollection(selectedCollection.id);
                        setSelectedCollection(null);
                        loadData();
                      } catch (err) {
                        alert("Failed deleting collection.");
                      }
                    }
                  }}
                  className="w-full py-2.5 rounded-xl border border-red-500/35 text-red-500 text-xs font-bold hover:bg-red-500/5 cursor-pointer active:scale-98 transition-all"
                >
                  Delete Collection
                </button>
                <button 
                  onClick={() => setSelectedCollection(null)}
                  className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer"
                >
                  Close panel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Document Inspector Modal Overlay */}
      <AnimatePresence>
        {previewDoc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/20 dark:bg-black/40 backdrop-blur-xs z-[20000] flex items-center justify-center p-4"
            onClick={() => setPreviewDoc(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="w-full max-w-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 p-6 rounded-3xl shadow-2xl space-y-6 max-h-[85vh] overflow-y-auto text-left"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400">Document Inspector</span>
                <button 
                  onClick={() => setPreviewDoc(null)}
                  className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-500 cursor-pointer"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center text-blue-500 flex-shrink-0">
                      <FileText className="w-6.5 h-6.5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white break-all">{previewDoc.name}</h3>
                      <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">Size: {previewDoc.size} • Type: {previewDoc.type.toUpperCase()}</span>
                    </div>
                  </div>
                  
                  {/* Delete Document Button */}
                  <button
                    onClick={async () => {
                      if (window.confirm("Are you sure you want to delete this document and clear its vector index?")) {
                        try {
                          await deleteDocument(previewDoc.id);
                          setPreviewDoc(null);
                          setSelectedCollection(null); // Close sidebar to refresh count
                          loadData();
                        } catch (err) {
                          alert("Failed to delete document.");
                        }
                      }
                    }}
                    className="p-2.5 rounded-xl border border-red-500/20 text-red-500 hover:bg-red-500/5 cursor-pointer active:scale-95 transition-all"
                    title="Delete document index"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="h-px bg-slate-100 dark:bg-white/5" />

                <div className="space-y-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block font-display">Auto-Generated Summary</span>
                  <p className="text-xs text-slate-600 dark:text-slate-350 leading-relaxed bg-slate-100/40 dark:bg-slate-900/40 p-3.5 rounded-xl border border-slate-200/30 dark:border-white/5 font-semibold">
                    {previewDoc.summary || 'Summary generation processing in background...'}
                  </p>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block font-display">Extracted OCR / Metadata Contents</span>
                  <pre className="text-[10px] leading-relaxed text-emerald-500 bg-slate-950 p-4 rounded-xl max-h-48 overflow-y-auto whitespace-pre-wrap font-mono select-text font-bold">
                    {previewDoc.ocrText || 'Extraction in progress...'}
                  </pre>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-black uppercase tracking-wider cursor-pointer"
                >
                  Close inspector
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Collection Creation Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/20 dark:bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4"
            onClick={() => setIsCreateModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="w-full max-w-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 p-6 rounded-3xl shadow-2xl space-y-4 text-left"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400 font-display">New Collection</span>
                <button 
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              <form onSubmit={handleCreateCollection} className="space-y-4">
                <div className="space-y-1 font-semibold">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Collection Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Machine Learning Systems"
                    value={newColName}
                    onChange={(e) => setNewColName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-white/5 rounded-xl text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-hidden font-semibold"
                  />
                </div>
                
                <div className="space-y-1 font-semibold font-display">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Description</label>
                  <textarea
                    placeholder="Short description of files content..."
                    value={newColDesc}
                    onChange={(e) => setNewColDesc(e.target.value)}
                    rows={3}
                    className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-white/5 rounded-xl text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-hidden font-semibold resize-none font-sans"
                  />
                </div>

                <div className="flex gap-2 pt-2 font-semibold">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-bold cursor-pointer hover:opacity-95 transition-opacity"
                  >
                    Create
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default Vault;
