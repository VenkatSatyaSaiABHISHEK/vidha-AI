import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Paperclip, 
  Mic, 
  Sparkles, 
  RotateCcw, 
  BookOpen, 
  ChevronDown, 
  FileText, 
  Loader2,
  BrainCircuit,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  Volume2,
  GraduationCap,
  Briefcase,
  HelpCircle,
  Terminal,
  Circle,
  Menu
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { cn } from '../utils/utils';
import { 
  getCollections, 
  createChatSession, 
  getChatSessions, 
  streamChatMessage,
  uploadDocument,
  getDocuments,
  deleteChatSession,
  updateChatSessionTitle,
  deleteDocument,
  getDocumentChunks
} from '../services/api';

export const Chat: React.FC = () => {
  const location = useLocation();
  const [collections, setCollections] = useState<any[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<any | null>(null);
  const [showColMenu, setShowColMenu] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  
  const [chatMode, setChatMode] = useState<string>('learning');
  const [explainLevel, setExplainLevel] = useState<string>('intermediate');
  const [isSidebarVisible, setIsSidebarVisible] = useState<boolean>(true);

  useEffect(() => {
    if (location.state && (location.state.initialPrompt || location.state.initialMode)) {
      if (location.state.initialPrompt) {
        setInputValue(location.state.initialPrompt);
      }
      if (location.state.initialMode) {
        setChatMode(location.state.initialMode);
      }
      // Clear location state to prevent repeating on page re-focus
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);

  const renderMarkdown = (text: string) => {
    if (!text) return null;
    
    // Helper to format inline bold (**text**) and code (`code`)
    const formatInline = (str: string) => {
      const parts = [];
      let lastIdx = 0;
      
      // Matches **bold** or `code`
      const regex = /\*\*(.*?)\*\*|`(.*?)`/g;
      let match;
      let keyCounter = 0;
      
      while ((match = regex.exec(str)) !== null) {
        const matchIdx = match.index;
        
        // Preceding text
        if (matchIdx > lastIdx) {
          parts.push(str.substring(lastIdx, matchIdx));
        }
        
        if (match[1]) {
          // Styled bold highlight lines color
          parts.push(
            <strong 
              key={`bold-${matchIdx}-${keyCounter++}`} 
              className="font-extrabold text-indigo-700 dark:text-indigo-300 bg-indigo-500/10 dark:bg-indigo-500/20 px-1 py-0.5 rounded-md"
            >
              {match[1]}
            </strong>
          );
        } else if (match[2]) {
          // Styled code highlight complexities
          parts.push(
            <code 
              key={`code-${matchIdx}-${keyCounter++}`} 
              className="px-1.5 py-0.5 rounded-md bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-mono text-[10px] font-bold"
            >
              {match[2]}
            </code>
          );
        }
        
        lastIdx = regex.lastIndex;
      }
      
      if (lastIdx < str.length) {
        parts.push(str.substring(lastIdx));
      }
      
      return parts.length > 0 ? parts : str;
    };

    // Split text by lines
    const lines = text.split('\n');
    return (
      <div className="space-y-1.5">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          
          // Headers
          if (trimmed.startsWith('### ')) {
            return (
              <h3 key={idx} className="text-xs font-black text-slate-900 dark:text-white mt-4 mb-2 uppercase tracking-wide border-l-2 border-indigo-500 pl-2">
                {formatInline(trimmed.substring(4))}
              </h3>
            );
          }
          if (trimmed.startsWith('## ')) {
            return (
              <h2 key={idx} className="text-sm font-black text-slate-900 dark:text-white mt-5 mb-2.5 border-b border-slate-200/40 dark:border-white/5 pb-1">
                {formatInline(trimmed.substring(3))}
              </h2>
            );
          }
          if (trimmed.startsWith('# ')) {
            return (
              <h1 key={idx} className="text-base font-black text-slate-900 dark:text-white mt-6 mb-3">
                {formatInline(trimmed.substring(2))}
              </h1>
            );
          }
          
          // Bullet list items
          if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-4 text-xs text-slate-700 dark:text-slate-250 my-1">
                <span className="text-indigo-500 mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <span>{formatInline(trimmed.substring(2))}</span>
              </div>
            );
          }
          
          // Numbered lists
          const numMatch = trimmed.match(/^(\d+)\.\s(.*)/);
          if (numMatch) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-4 text-xs text-slate-700 dark:text-slate-250 my-1">
                <span className="text-indigo-500 font-black text-[10px] flex-shrink-0 mt-0.5">{numMatch[1]}.</span>
                <span>{formatInline(numMatch[2])}</span>
              </div>
            );
          }
          
          // Empty line
          if (!trimmed) {
            return <div key={idx} className="h-1.5" />;
          }
          
          // Regular text paragraph
          return (
            <p key={idx} className="leading-relaxed text-xs text-slate-750 dark:text-slate-200">
              {formatInline(line)}
            </p>
          );
        })}
      </div>
    );
  };
  const [collectionDocs, setCollectionDocs] = useState<any[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [citations, setCitations] = useState<string[]>([]);
  
  const [selectedCitationName, setSelectedCitationName] = useState<string | null>(null);
  const [isCitationLoading, setIsCitationLoading] = useState(false);
  const [citationChunks, setCitationChunks] = useState<any[]>([]);
  const [selectedText, setSelectedText] = useState("");
  
  // Selection Context Menu state
  const [floatingMenuPosition, setFloatingMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [floatingSelectedText, setFloatingSelectedText] = useState("");

  // Renaming chat state
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initialize and load chat sessions
  const loadSessionsData = async (activeId?: string, colsList?: any[]) => {
    try {
      const data = await getChatSessions();
      setSessions(data);
      if (data.length > 0) {
        const active = activeId || data[0].id;
        setSessionId(active);
        const activeSession = data.find(s => s.id === active) || data[0];
        // Map backend format to local messages state
        const mapped = activeSession.messages.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          citations: m.citations || []
        }));
        setMessages(mapped);

        // Sync active collection to the selected session
        const currentCols = colsList || collections;
        if (activeSession.collection_id && currentCols.length > 0) {
          const matchedCollection = currentCols.find(c => c.id === activeSession.collection_id);
          if (matchedCollection) {
            setSelectedCollection(matchedCollection);
          }
        }
      } else {
        const newSess = await createChatSession("New Thread");
        setSessionId(newSess.id);
        setSessions([newSess]);
        setMessages([]);
      }
    } catch (e) {
      console.error("Failed loading chat sessions:", e);
    }
  };

  const loadCollectionDocs = async () => {
    if (!selectedCollection) return;
    try {
      const data = await getDocuments(selectedCollection.id);
      setCollectionDocs(data);
    } catch (e) {
      console.error("Failed loading collection docs:", e);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const cols = await getCollections();
        setCollections(cols);
        if (cols.length > 0) {
          setSelectedCollection(cols[0]);
        }
        await loadSessionsData(undefined, cols);
      } catch (e) {
        console.error(e);
      }
    };
    init();
  }, []);



  // Scroll to bottom on updates
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  // Listen for selection changes in the document to show floating selection prompt bubble
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        setFloatingMenuPosition(null);
        setFloatingSelectedText("");
        return;
      }
      
      const text = selection.toString().trim();
      if (!text || text.length < 2) {
        setFloatingMenuPosition(null);
        setFloatingSelectedText("");
        return;
      }

      // Check if selection is within the chat container or message list
      const anchorNode = selection.anchorNode;
      if (!anchorNode) return;

      const chatContainer = document.getElementById("chat-messages-container");
      if (chatContainer && chatContainer.contains(anchorNode)) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        // Position the menu above the selection relative to the viewport (fixed)
        setFloatingMenuPosition({
          x: rect.left + rect.width / 2,
          y: rect.top - 40
        });
        setFloatingSelectedText(text);
      } else {
        setFloatingMenuPosition(null);
        setFloatingSelectedText("");
      }
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, []);

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection) {
      setSelectedText(selection.toString().trim());
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || !sessionId || isStreaming) return;

    const userPrompt = inputValue.trim();
    setInputValue('');
    setCitations([]);
    
    // Add user message to state
    setMessages(prev => [...prev, {
      id: `msg-user-${Date.now()}`,
      role: 'user',
      content: userPrompt
    }]);

    setIsStreaming(true);
    setStreamingText('');

    try {
      await streamChatMessage(
        sessionId,
        userPrompt,
        selectedCollection ? selectedCollection.id : null,
        "qwen2.5:3b",
        chatMode,
        explainLevel,
        (chunk) => {
          setStreamingText(prev => prev + chunk);
        },
        (incomingCitations) => {
          setCitations(incomingCitations);
        },
        () => {
          // Stream complete
          setMessages(prev => [...prev, {
            id: `msg-bot-${Date.now()}`,
            role: 'assistant',
            content: streamingText,
            citations: citations
          }]);
          setStreamingText('');
          setIsStreaming(false);
          // Reload sessions to refresh dynamic titles
          loadSessionsData(sessionId);
        },
        (err) => {
          console.error("Chat streaming error:", err);
          setIsStreaming(false);
        }
      );
    } catch (err) {
      console.error(err);
      setIsStreaming(false);
    }
  };

  const handleVoiceToggle = () => {
    if (voiceActive) {
      setVoiceActive(false);
    } else {
      setVoiceActive(true);
      setInputValue("Explain deep-learning attention mechanisms.");
      setTimeout(() => setVoiceActive(false), 2000);
    }
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleAttachFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedCollection) return;
    const file = files[0];
    
    setMessages(prev => [...prev, {
      id: `msg-system-${Date.now()}`,
      role: 'system',
      content: `Uploading and indexing file "${file.name}" to ${selectedCollection.name}...`
    }]);

    try {
      await uploadDocument(file, selectedCollection.id);
      setMessages(prev => [...prev, {
        id: `msg-system-success-${Date.now()}`,
        role: 'system',
        content: `Successfully uploaded and vectorized "${file.name}"!`
      }]);
      loadCollectionDocs();
    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: `msg-system-fail-${Date.now()}`,
        role: 'system',
        content: `Failed uploading "${file.name}": ${err.message || err}`
      }]);
    }
  };

  const handleNewChat = async () => {
    try {
      const newSess = await createChatSession("New Thread", selectedCollection?.id);
      setSessionId(newSess.id);
      setMessages([]);
      setStreamingText('');
      setCitations([]);
      loadSessionsData(newSess.id);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadCollectionDocs();
  }, [selectedCollection]);

  const handleCollectionSelect = async (col: any) => {
    setSelectedCollection(col);
    setShowColMenu(false);
    try {
      const newSess = await createChatSession("New Thread", col.id);
      setSessionId(newSess.id);
      setMessages([]);
      setStreamingText('');
      setCitations([]);
      loadSessionsData(newSess.id);
    } catch (e) {
      console.error(e);
    }
  };

  const playVoice = (text: string) => {
    const audioUrl = `http://localhost:8000/api/voice/tts?text=${encodeURIComponent(text)}`;
    const audio = new Audio(audioUrl);
    audio.play();
  };

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteChatSession(id);
      if (sessionId === id) {
        setMessages([]);
        setSessionId(null);
      }
      loadSessionsData();
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  };

  const handleSelectSession = (id: string) => {
    setSessionId(id);
    const active = sessions.find(s => s.id === id);
    if (active) {
      const mapped = active.messages.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        citations: m.citations || []
      }));
      setMessages(mapped);

      // Sync collection when selecting session from history
      if (active.collection_id) {
        const matchedCollection = collections.find(c => c.id === active.collection_id);
        if (matchedCollection) {
          setSelectedCollection(matchedCollection);
        }
      }
    }
  };

  const startRenameSession = (id: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(id);
    setEditingTitle(currentTitle);
  };

  const submitRenameSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editingTitle.trim()) return;
    try {
      await updateChatSessionTitle(id, editingTitle.trim());
      setEditingSessionId(null);
      loadSessionsData(sessionId || undefined);
    } catch (err) {
      console.error(err);
    }
  };

  const cancelRenameSession = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(null);
  };

  return (
    <div className="flex-grow flex gap-6 chat-container-height min-h-0 relative z-10 select-none">
      
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleAttachFile} 
        className="hidden" 
        accept=".pdf,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.txt"
      />

      {/* ChatGPT-style Left Sidebar (Thread History & Documents list) */}
      <div 
        className={cn(
          "hidden md:flex flex-col bg-white/40 dark:bg-slate-900/10 border border-slate-200/40 dark:border-white/5 rounded-3xl p-4 shadow-sm backdrop-blur-md flex-shrink-0 min-h-0 overflow-hidden text-left justify-between transition-all duration-300", 
          isSidebarVisible ? "w-72" : "w-0 p-0 border-none opacity-0"
        )}
      >
        
        {/* Top Section: Sessions list */}
        <div className="flex flex-col min-h-0 flex-grow">
          {/* New Chat Button */}
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 py-3 mb-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md shadow-indigo-500/10 active:scale-98"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Chat</span>
          </button>

          {/* Session Threads Header */}
          <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-2.5 px-2 block">
            Chat History
          </span>

          {/* History Scroll Area */}
          <div className="flex-grow overflow-y-auto space-y-1.5 pr-1">
            {sessions.map(s => {
              const isSelected = sessionId === s.id;
              const isEditing = editingSessionId === s.id;

              return (
                <div
                  key={s.id}
                  onClick={() => !isEditing && handleSelectSession(s.id)}
                  className={cn(
                    "group w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                    isSelected 
                      ? "bg-slate-100 dark:bg-slate-950 text-indigo-600 dark:text-indigo-400 border border-slate-200/50 dark:border-white/5" 
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-50/50 dark:hover:bg-slate-950/20"
                  )}
                >
                  {isEditing ? (
                    <div className="flex items-center gap-1.5 w-full mr-2">
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        className="flex-grow bg-white dark:bg-slate-900 border border-indigo-500/30 rounded-lg px-2 py-1 text-xs outline-none text-slate-800 dark:text-white"
                      />
                      <button onClick={(e) => submitRenameSession(s.id, e)} className="text-emerald-500 p-1 hover:bg-emerald-500/10 rounded-md">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={cancelRenameSession} className="text-rose-500 p-1 hover:bg-rose-500/10 rounded-md">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="truncate max-w-[150px]">{s.title}</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => startRenameSession(s.id, s.title, e)}
                          className="p-1 rounded-md text-slate-450 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-900"
                          title="Rename Thread"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteSession(s.id, e)}
                          className="p-1 rounded-md text-slate-450 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-900"
                          title="Delete Thread"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Section: Active Collection Files */}
        <div className="border-t border-slate-200/40 dark:border-white/5 pt-4 mt-4 flex flex-col min-h-0 max-h-[35%]">
          <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-2.5 px-2 block">
            Vault Files ({collectionDocs.length})
          </span>
          <div className="overflow-y-auto space-y-1.5 pr-1">
            {collectionDocs.map((doc: any) => (
              <div 
                key={doc.id}
                className="group flex items-center justify-between p-2 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200/20 dark:border-white/5 rounded-xl overflow-hidden"
              >
                <div className="flex items-center gap-2 overflow-hidden flex-grow mr-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                  <span className="text-[10px] font-bold text-slate-700 dark:text-slate-350 truncate" title={doc.name}>
                    {doc.name}
                  </span>
                </div>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (window.confirm(`Are you sure you want to delete "${doc.name}"? This will clear its vector index and database record.`)) {
                      try {
                        await deleteDocument(doc.id);
                        loadCollectionDocs();
                      } catch (err) {
                        console.error("Failed to delete document:", err);
                        alert("Failed to delete document.");
                      }
                    }
                  }}
                  className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-900 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex-shrink-0"
                  title="Delete File"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {collectionDocs.length === 0 && (
              <span className="text-[9px] text-slate-400 font-semibold px-2">No files in collection yet.</span>
            )}
          </div>
        </div>

      </div>

      {/* Main Chat Screen Area */}
      <div className="flex-grow flex flex-col min-h-0 bg-white dark:bg-slate-900/60 border border-slate-200/40 dark:border-white/5 rounded-3xl backdrop-blur-md overflow-hidden relative shadow-sm">
        
        {/* Top Control Bar (Subject drop, Reset button) */}
        <div className="px-6 py-4 border-b border-slate-200/40 dark:border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white/40 dark:bg-slate-950/20 backdrop-blur-md relative z-20">
          
          {/* Title and Sparkle icon */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarVisible(prev => !prev)}
              className="p-2 rounded-xl border border-slate-200/40 dark:border-white/5 bg-slate-50/50 dark:bg-slate-950/20 text-slate-500 hover:text-indigo-500 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900/80 transition-all flex-shrink-0"
              title={isSidebarVisible ? "Hide Sidebar" : "Show Sidebar"}
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="w-9 h-9 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-650 dark:text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-black text-slate-900 dark:text-white leading-none">
                Learning Chat Assistant
              </h1>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-1">
                Offline educational support and topic guidance
              </p>
            </div>
          </div>

          {/* Action Selector and Reset */}
          <div className="flex items-center gap-2">
            {/* Collection/Folder Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowColMenu(prev => !prev)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200/50 dark:border-white/5 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-900/80 cursor-pointer transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                <span>{selectedCollection ? selectedCollection.name : 'All Subjects'}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {showColMenu && (
                <div className="absolute top-10 right-0 w-48 bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-xl p-2 z-50">
                  {collections.map((c: any) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleCollectionSelect(c)}
                      className={cn(
                        "w-full text-left p-2.5 rounded-xl text-[10px] font-bold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors",
                        selectedCollection?.id === c.id && "bg-blue-500/5 text-blue-600 dark:text-blue-455"
                      )}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Reset Thread */}
            <button
              onClick={handleNewChat}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200/50 dark:border-white/5 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-900/80 cursor-pointer"
              title="Reset conversation thread"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-450" />
              <span>Reset</span>
            </button>
          </div>

        </div>

        {/* Message Feed & Dialog window */}
        <div id="chat-messages-container" className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && !streamingText ? (
            
            // Suggested Questions / Prompt Grid (Empty state)
            <div className="h-full flex flex-col justify-center items-center text-center max-w-lg mx-auto py-12">
              <BrainCircuit className="w-12 h-12 text-indigo-500/80 mb-4 animate-bounce" />
              <h3 className="text-sm font-black text-slate-805 dark:text-white">Start a new offline dialogue</h3>
              <p className="text-[10px] text-slate-450 dark:text-slate-400 font-semibold mt-1 max-w-xs">
                Ask questions about documents in your active collection. The vector database retrieves matching context offline.
              </p>
              
              <div className="grid grid-cols-1 gap-3 mt-6 w-full text-left max-w-sm">
                {[
                  { title: "Give overview on the source data", desc: "Summarize the documents inside the active collection" }
                ].map(item => (
                  <button
                    key={item.title}
                    onClick={() => setInputValue(item.title)}
                    className="p-3 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200/30 dark:border-white/5 rounded-2xl hover:border-indigo-500/20 transition-all text-left cursor-pointer"
                  >
                    <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200 block">{item.title}</span>
                    <span className="text-[9px] text-slate-405 dark:text-slate-500 block mt-0.5">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            
            // Message List
            <div className="space-y-4 max-w-3xl mx-auto w-full">
              {messages.map((m) => (
                <div 
                  key={m.id}
                  className={cn(
                    "flex gap-3",
                    m.role === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  {/* Bot Profile Icon */}
                  {m.role !== 'user' && (
                    <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500 flex-shrink-0 border border-indigo-500/20">
                      <Sparkles className="w-4 h-4" />
                    </div>
                  )}

                  {/* Message Bubble container */}
                  <div className="flex flex-col gap-2 max-w-[85%]">
                    <div className={cn(
                      "p-3.5 px-4.5 rounded-[1.5rem] text-xs leading-relaxed text-slate-800 dark:text-slate-100 relative group/msg",
                      m.role === 'user' 
                        ? "bg-indigo-600 text-white rounded-tr-sm" 
                        : m.role === 'system'
                        ? "bg-slate-100/50 dark:bg-slate-950/50 border border-slate-200/30 dark:border-white/5 text-slate-500 text-[10px] font-bold font-mono"
                        : "bg-slate-50/60 dark:bg-slate-950/20 border border-slate-200/30 dark:border-white/5 rounded-tl-sm"
                    )}>
                      {m.role === 'user' || m.role === 'system' ? m.content : renderMarkdown(m.content)}
                      {m.role === 'assistant' && (
                        <button
                          type="button"
                          onClick={() => playVoice(m.content)}
                          className="absolute right-2 bottom-2 p-1 bg-white/80 dark:bg-slate-900/80 rounded-full border border-slate-200/30 dark:border-white/5 text-slate-400 hover:text-indigo-500 opacity-0 group-hover/msg:opacity-100 transition-opacity cursor-pointer shadow-xs"
                          title="Speak answer (Kokoro-82M)"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Document Citation references */}
                    {m.role === 'assistant' && m.citations && m.citations.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mr-1">Sources:</span>
                        <span className="text-[8px] text-indigo-500 font-bold bg-indigo-500/10 dark:bg-indigo-500/20 px-2 py-0.5 rounded border border-indigo-500/10 dark:border-indigo-500/20 animate-pulse mr-1 scale-95">
                          Click pill to inspect source chunks
                        </span>
                        {m.citations.map((c: string, idx: number) => (
                          <button
                            key={idx}
                            onClick={async () => {
                              setSelectedCitationName(c);
                              setIsCitationLoading(true);
                              setCitationChunks([]);
                              setSelectedText("");
                              try {
                                const data = await getDocumentChunks(undefined, undefined, c);
                                setCitationChunks(data);
                              } catch (err) {
                                console.error(err);
                              } finally {
                                setIsCitationLoading(false);
                              }
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-950 border border-slate-200/40 dark:border-white/5 text-[9px] font-bold text-slate-500 dark:text-slate-400 hover:text-blue-500 hover:border-blue-500/20 transition-all cursor-pointer"
                          >
                            <FileText className="w-3 h-3 text-blue-500" />
                            <span>{c}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Streaming block helper */}
              {isStreaming && streamingText && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500 flex-shrink-0 border border-indigo-500/20">
                    <Sparkles className="w-4 h-4 animate-spin" />
                  </div>
                  <div className="p-3.5 px-4.5 rounded-[1.5rem] rounded-tl-sm text-xs leading-relaxed text-slate-800 dark:text-slate-100 bg-slate-50/60 dark:bg-slate-950/20 border border-slate-200/30 dark:border-white/5 max-w-[85%]">
                    {renderMarkdown(streamingText)}
                    <span className="inline-block w-1.5 h-3 bg-indigo-500 ml-1 animate-pulse" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* Floating Citation Preview Drawer (Next-Level Inspect Panel) */}
        {selectedCitationName && (
          <div className="fixed inset-0 bg-slate-955/20 dark:bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div 
              className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-2xl max-w-2xl w-full flex flex-col max-h-[80vh] text-left select-none relative"
              onMouseUp={handleTextSelection}
              onKeyUp={handleTextSelection}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-200/40 dark:border-white/5 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-500" />
                  <span className="text-sm font-black text-slate-850 dark:text-white truncate max-w-md">{selectedCitationName}</span>
                </div>
                <button 
                  onClick={() => { setSelectedCitationName(null); setCitationChunks([]); setSelectedText(""); }}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200/30 dark:border-white/5"
                >
                  Close
                </button>
              </div>

              {/* Chunks Content Scroll List */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-4 select-text">
                {isCitationLoading ? (
                  <div className="h-48 flex flex-col items-center justify-center text-slate-500 font-bold text-xs uppercase tracking-wider">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
                    <span>Loading Document Chunks...</span>
                  </div>
                ) : citationChunks.length === 0 ? (
                  <div className="text-center py-12 text-slate-405 font-bold text-xs">
                    No text chunks found for this document in the collection index database.
                  </div>
                ) : (
                  citationChunks.map((chunk, idx) => (
                    <div 
                      key={idx} 
                      className="bg-slate-50/50 dark:bg-slate-900/30 border border-slate-150/40 dark:border-white/5 p-4 rounded-2xl relative"
                    >
                      <span className="absolute top-3 right-3 text-[8px] font-black uppercase text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                        Page {chunk.page || 1}
                      </span>
                      <p className="font-mono text-[10px] leading-relaxed text-slate-650 dark:text-slate-350 pr-12 break-words whitespace-pre-wrap select-text">
                        {chunk.content}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {/* Action Bar (Ask about selection) */}
              <div className="border-t border-slate-200/40 dark:border-white/5 pt-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-[10px] text-slate-400 font-semibold max-w-sm">
                  {selectedText ? (
                    <span className="text-indigo-500 font-bold animate-pulse">Selected text detected ({selectedText.length} chars). Click query to ask!</span>
                  ) : (
                    <span>💡 Tip: Select any text snippet from the chunks above to ask Vedha AI about it.</span>
                  )}
                </div>
                {selectedText && (
                  <button
                    onClick={() => {
                      setInputValue(`About "${selectedText}": `);
                      setSelectedCitationName(null);
                      setCitationChunks([]);
                      setSelectedText("");
                      const inputEl = document.querySelector('input[placeholder*="Ask your local vault"]');
                      if (inputEl) (inputEl as HTMLInputElement).focus();
                    }}
                    className="flex-grow sm:flex-grow-0 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-[10px] font-black uppercase tracking-wider rounded-xl shadow-md cursor-pointer hover:opacity-95 active:scale-98 transition-all"
                  >
                    Ask About Selection
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

      {/* Floating Highlight-to-Chat Action Bubble */}
      {floatingMenuPosition && floatingSelectedText && (
        <div 
          className="fixed z-[9999] pointer-events-auto select-none"
          style={{ 
            left: `${floatingMenuPosition.x}px`, 
            top: `${floatingMenuPosition.y}px`,
            transform: 'translateX(-50%)'
          }}
        >
          <button
            onClick={() => {
              setInputValue(`About "${floatingSelectedText}": `);
              setFloatingMenuPosition(null);
              setFloatingSelectedText("");
              // Find and focus the prompt input field
              const inputEl = document.querySelector('input[placeholder*="Ask your local vault"]');
              if (inputEl) (inputEl as HTMLInputElement).focus();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-wider rounded-xl shadow-lg cursor-pointer hover:scale-105 active:scale-95 transition-all border border-slate-700 dark:border-slate-200"
          >
            <Sparkles className="w-3.5 h-3.5 text-yellow-405 dark:text-indigo-650" />
            <span>Ask Vedha</span>
          </button>
        </div>
      )}

        {/* Entry tray on the bottom */}
        <div className="px-6 py-4 border-t border-slate-200/40 dark:border-white/5 bg-slate-50/30 dark:bg-slate-950/10">
          <div className="max-w-3xl mx-auto">
            {/* Chat Mode Selection pills & Explain levels */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3 px-2 text-left select-none">
              {/* Modes */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: "learning", label: "Learn", icon: GraduationCap, iconColor: "text-emerald-500" },
                  { id: "interview", label: "Interview", icon: Briefcase, iconColor: "text-indigo-550" },
                  { id: "revision", label: "Revise", icon: FileText, iconColor: "text-blue-500" },
                  { id: "quiz", label: "Quiz", icon: HelpCircle, iconColor: "text-amber-500" },
                  { id: "coding", label: "Coding", icon: Terminal, iconColor: "text-cyan-500" }
                ].map(mode => {
                  const Icon = mode.icon;
                  const isActive = chatMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setChatMode(mode.id)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all cursor-pointer",
                        isActive 
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
                          : "bg-white dark:bg-slate-900 text-slate-655 dark:text-slate-350 border-slate-200/50 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10"
                      )}
                    >
                      <Icon className={cn("w-3.5 h-3.5", isActive ? "text-white" : mode.iconColor)} />
                      <span>{mode.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Explain Levels */}
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Depth:</span>
                {[
                  { id: "beginner", label: "Beginner", color: "fill-emerald-500 text-emerald-500" },
                  { id: "intermediate", label: "Intermediate", color: "fill-amber-500 text-amber-500" },
                  { id: "expert", label: "Expert", color: "fill-rose-500 text-rose-500" }
                ].map(level => (
                  <button
                    key={level.id}
                    type="button"
                    onClick={() => setExplainLevel(level.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[9px] font-bold border transition-all cursor-pointer",
                      explainLevel === level.id
                        ? "bg-slate-100 dark:bg-slate-800 text-slate-850 dark:text-white border-slate-300 dark:border-slate-700 shadow-xs"
                        : "bg-white/50 dark:bg-slate-955/20 text-slate-505 dark:text-slate-450 border-slate-200/30 dark:border-white/5 hover:border-slate-200 dark:hover:border-white/10"
                    )}
                  >
                    <Circle className={`w-2 h-2 ${level.color}`} />
                    <span>{level.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSend} className="flex items-center gap-2 w-full">
            {/* File attach button */}
            <button
              type="button"
              onClick={handleAttachClick}
              className="p-2.5 rounded-xl border border-slate-250/40 dark:border-white/5 text-slate-500 hover:text-indigo-500 hover:bg-slate-100/50 dark:hover:bg-slate-900/50 cursor-pointer transition-all"
              title="Ingest document to collection"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Prompt Voice recording simulator */}
            <button
              type="button"
              onClick={handleVoiceToggle}
              className={cn(
                "p-2.5 rounded-xl border cursor-pointer transition-all",
                voiceActive 
                  ? "bg-rose-500/10 border-rose-500/20 text-rose-500 animate-pulse" 
                  : "border-slate-250/40 dark:border-white/5 text-slate-500 hover:text-indigo-500 hover:bg-slate-100/50 dark:hover:bg-slate-900/50"
              )}
              title="Offline speech transcription"
            >
              <Mic className="w-4 h-4" />
            </button>

            {/* Text Input */}
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={isStreaming ? "Generating answer..." : "Ask your local vault..."}
              disabled={isStreaming}
              className="flex-grow bg-slate-100 dark:bg-slate-950/80 border border-slate-200/50 dark:border-white/5 rounded-xl px-4 py-2.5 text-xs text-slate-800 dark:text-white placeholder-slate-450 dark:placeholder-slate-500 outline-none"
            />

            {/* Submit/Send */}
            <button
              type="submit"
              disabled={!inputValue.trim() || isStreaming}
              className="p-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all shadow-md shadow-blue-500/15"
            >
              {isStreaming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>
          </div>
        </div>

      </div>

    </div>
  );
};

export default Chat;
