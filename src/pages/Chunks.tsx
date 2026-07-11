import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Search, 
  FileText, 
  Layers,
  ArrowLeft,
  Eye
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../components/GlassCard';
import { getDocumentChunks, getCollections } from '../services/api';

export const Chunks: React.FC = () => {
  const navigate = useNavigate();
  const [chunks, setChunks] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [selectedCol, setSelectedCol] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const cols = await getCollections();
      setCollections(cols);
      
      const colParam = selectedCol === 'all' ? undefined : selectedCol;
      const chunksData = await getDocumentChunks(colParam);
      setChunks(chunksData);
    } catch (e) {
      console.error("Failed to load chunks or collections:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCol]);

  // Filter chunks based on search query
  const filteredChunks = chunks.filter(c => {
    const textMatch = c.content.toLowerCase().includes(searchQuery.toLowerCase());
    const docMatch = c.document_name.toLowerCase().includes(searchQuery.toLowerCase());
    return textMatch || docMatch;
  });

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <>
        {parts.map((part, i) => 
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-450 px-0.5 rounded font-semibold">
              {part}
            </mark>
          ) : part
        )}
      </>
    );
  };

  return (
    <div className="flex-grow flex flex-col gap-6 relative select-none text-left">
      
      {/* Title Header with Back navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button 
            onClick={() => navigate('/analytics')}
            className="flex items-center gap-1.5 text-[10px] font-black uppercase text-indigo-500 hover:text-indigo-650 cursor-pointer mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Analytics
          </button>
          <h1 className="font-display text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <Layers className="w-8 h-8 text-indigo-500 animate-pulse" />
            <span>Vector DB Chunks Registry</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">
            Browse, inspect and search individual text fragments indexed within the ChromaDB embeddings layer.
          </p>
        </div>

        {/* Subject Dropdown */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <label className="text-[10px] font-black text-slate-400 dark:text-slate-505 uppercase tracking-wider">Subject:</label>
          <select
            value={selectedCol}
            onChange={(e) => setSelectedCol(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200/50 dark:border-white/5 bg-white dark:bg-slate-950 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900"
          >
            <option value="all">All Subjects</option>
            {collections.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Search Input Card */}
      <GlassCard className="p-4 flex items-center gap-3 border-slate-200/30 dark:border-white/5" hoverEffect={false}>
        <Search className="w-4.5 h-4.5 text-slate-400 flex-shrink-0" />
        <input 
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search text contents or document name of indexed chunks..."
          className="flex-grow bg-transparent border-none outline-none text-xs text-slate-800 dark:text-white placeholder-slate-450 dark:placeholder-slate-500 font-bold"
        />
        {filteredChunks.length > 0 && (
          <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider bg-slate-100 dark:bg-slate-950/60 px-2 py-1 rounded-lg">
            {filteredChunks.length} chunks found
          </span>
        )}
      </GlassCard>

      {/* Main Grid View */}
      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center text-slate-500 font-bold text-xs uppercase tracking-wider">
          <div className="w-8 h-8 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin mb-3" />
          <span>Retrieving Chroma Chunks...</span>
        </div>
      ) : filteredChunks.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-slate-450 dark:text-slate-500 text-xs font-bold bg-white/40 dark:bg-slate-900/10 border border-slate-200/30 dark:border-white/5 rounded-[2rem] p-6 shadow-xs">
          <Database className="w-10 h-10 text-slate-400/80 mb-3" />
          <span>No vector database chunks match your filters.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[calc(100vh-22rem)] overflow-y-auto pr-1">
          {filteredChunks.map((chunk, idx) => (
            <GlassCard key={chunk.id} delay={idx * 0.03} className="border-slate-200/30 dark:border-white/5 flex flex-col justify-between" hoverEffect={true}>
              
              {/* Header Info */}
              <div>
                <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-slate-100 dark:border-white/5">
                  <div className="flex items-center gap-2 overflow-hidden mr-3">
                    <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <span className="text-[11px] font-black text-slate-800 dark:text-slate-200 truncate" title={chunk.document_name}>
                      {chunk.document_name}
                    </span>
                  </div>
                  <span className="flex-shrink-0 text-[8px] font-black uppercase text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                    Page {chunk.page}
                  </span>
                </div>

                {/* Raw Text Snippet */}
                <div className="bg-slate-50/50 dark:bg-slate-950/40 border border-slate-150/40 dark:border-white/5 p-4 rounded-2xl font-mono text-[10px] leading-relaxed text-slate-650 dark:text-slate-350 max-h-40 overflow-y-auto select-text selection:bg-indigo-500/20 break-words whitespace-pre-wrap">
                  {highlightText(chunk.content, searchQuery)}
                </div>
              </div>

              {/* Vector Metadata footer */}
              <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-2 text-[9px] font-bold text-slate-400 dark:text-slate-500">
                <div className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" />
                  <span className="font-mono">ID: {chunk.id.slice(0, 16)}...</span>
                </div>
                <span>{chunk.content.length} characters</span>
              </div>

            </GlassCard>
          ))}
        </div>
      )}

    </div>
  );
};

export default Chunks;
