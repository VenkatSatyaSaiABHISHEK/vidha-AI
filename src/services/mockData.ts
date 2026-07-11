// Mock Database service for Vedha AI (Offline simulation)

export interface MockDocument {
  id: string;
  name: string;
  size: string;
  type: 'pdf' | 'docx' | 'ppt' | 'image' | 'txt';
  status: 'Indexed' | 'Processing' | 'Failed';
  uploadDate: string;
  tags: string[];
  ocrText?: string;
  summary?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  citations?: string[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  date: string;
}

export interface VaultNode {
  id: string;
  label: string;
  type: 'concept' | 'entity' | 'document' | 'term';
  relevance: number; // percentage
  connections: string[];
  description: string;
  sourceDocId?: string;
}

// Initial fallback mock documents
const initialDocuments: MockDocument[] = [
  {
    id: 'doc-1',
    name: 'Attention_Is_All_You_Need.pdf',
    size: '2.1 MB',
    type: 'pdf',
    status: 'Indexed',
    uploadDate: '2026-07-07 14:32',
    tags: ['Transformer', 'Deep Learning', 'NLP'],
    ocrText: 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks...',
    summary: 'This landmark paper introduces the Transformer architecture, replacing recurrence and convolutions with self-attention mechanisms.'
  },
  {
    id: 'doc-2',
    name: 'Q3_Financial_Projections.docx',
    size: '840 KB',
    type: 'docx',
    status: 'Indexed',
    uploadDate: '2026-07-06 09:15',
    tags: ['Finance', 'Strategy', 'Q3'],
    ocrText: 'Gross revenue forecast for Q3 targets a 15% increase quarter-over-quarter, driven by local AI integration SaaS upsell...',
    summary: 'Internal executive projection outline detailing Q3 revenue targets, expansion plans, and hardware cost allocations.'
  },
  {
    id: 'doc-3',
    name: 'Handwritten_Meeting_Notes.png',
    size: '4.2 MB',
    type: 'image',
    status: 'Indexed',
    uploadDate: '2026-07-05 16:45',
    tags: ['OCR', 'Meeting', 'Brainstorm'],
    ocrText: 'Action items: 1. Deploy local Llama server. 2. Verify RAG accuracy. 3. Connect OCR parser for scans.',
    summary: 'Digitized handwritten notes extracted using offline Tesseract OCR during the technical scoping sync.'
  },
  {
    id: 'doc-4',
    name: 'Offline_Architecture_Design.ppt',
    size: '5.6 MB',
    type: 'ppt',
    status: 'Processing',
    uploadDate: '2026-07-08 11:00',
    tags: ['System Architecture', 'Security'],
    ocrText: 'Vedha AI runs completely local. Embedding database is powered by high-speed vector index inside user memory...',
    summary: 'System architecture review explaining offline local vector pipelines and security boundary enforcements.'
  }
];

// Initial fallback chat sessions
const initialChats: ChatSession[] = [
  {
    id: 'chat-1',
    title: 'Understanding Transformers',
    date: '2026-07-07',
    messages: [
      {
        id: 'm1',
        role: 'user',
        content: 'Can you explain the main advantage of the Transformer model discussed in the attention paper?',
        timestamp: '14:35'
      },
      {
        id: 'm2',
        role: 'assistant',
        content: 'The core advantage of the **Transformer** model is its ability to process sequences in parallel, unlike older recurrent architectures (like LSTMs or GRUs) which must compute states sequentially. This parallelization allows for significantly faster training times and enables the training of much larger neural networks. It achieves this using a **Self-Attention** mechanism that calculates relationships between words regardless of their distance in a sentence.',
        timestamp: '14:36',
        citations: ['Attention_Is_All_You_Need.pdf']
      }
    ]
  },
  {
    id: 'chat-2',
    title: 'Financial Q3 Target Analysis',
    date: '2026-07-06',
    messages: [
      {
        id: 'm3',
        role: 'user',
        content: 'What is the projected revenue growth for next quarter?',
        timestamp: '09:20'
      },
      {
        id: 'm4',
        role: 'assistant',
        content: 'According to the internal spreadsheet notes, the projected growth is a **15% increase quarter-over-quarter** for Q3. This expansion is forecasted to be driven by upgrading local AI integrations and scaling hardware allocations.',
        timestamp: '09:21',
        citations: ['Q3_Financial_Projections.docx']
      }
    ]
  }
];

// Initial fallback knowledge vault nodes
const initialNodes: VaultNode[] = [
  { id: 'v1', label: 'Self-Attention', type: 'concept', relevance: 98, connections: ['v2', 'v4'], description: 'Mechanism relating different positions of a single sequence to compute a representation of the sequence.', sourceDocId: 'doc-1' },
  { id: 'v2', label: 'Transformer Model', type: 'concept', relevance: 95, connections: ['v1', 'v3'], description: 'Neural network architecture relying solely on attention mechanisms, eliminating recurrence and convolutions.', sourceDocId: 'doc-1' },
  { id: 'v3', label: 'Llama 3.1 Local', type: 'entity', relevance: 88, connections: ['v2'], description: 'State-of-the-art open-source LLM configured to run locally on consumer workstations.', sourceDocId: 'doc-4' },
  { id: 'v4', label: 'Offline RAG Pipeline', type: 'concept', relevance: 92, connections: ['v1', 'v5'], description: 'Retrieval-Augmented Generation operating inside secure system boundaries with no internet queries.', sourceDocId: 'doc-4' },
  { id: 'v5', label: 'Vector Index', type: 'term', relevance: 85, connections: ['v4'], description: 'Locally generated database storage containing dense representations of document text chunks.', sourceDocId: 'doc-4' }
];

export const getDocuments = (): MockDocument[] => {
  const data = localStorage.getItem('vedha_docs');
  if (!data) {
    localStorage.setItem('vedha_docs', JSON.stringify(initialDocuments));
    return initialDocuments;
  }
  return JSON.parse(data);
};

export const saveDocuments = (docs: MockDocument[]) => {
  localStorage.setItem('vedha_docs', JSON.stringify(docs));
};

export const getChats = (): ChatSession[] => {
  const data = localStorage.getItem('vedha_chats');
  if (!data) {
    localStorage.setItem('vedha_chats', JSON.stringify(initialChats));
    return initialChats;
  }
  return JSON.parse(data);
};

export const saveChats = (chats: ChatSession[]) => {
  localStorage.setItem('vedha_chats', JSON.stringify(chats));
};

export const getVaultNodes = (): VaultNode[] => {
  const data = localStorage.getItem('vedha_nodes');
  if (!data) {
    localStorage.setItem('vedha_nodes', JSON.stringify(initialNodes));
    return initialNodes;
  }
  return JSON.parse(data);
};

export const saveVaultNodes = (nodes: VaultNode[]) => {
  localStorage.setItem('vedha_nodes', JSON.stringify(nodes));
};
