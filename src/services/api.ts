export const API_BASE = "http://127.0.0.1:8000/api";

export interface DocumentResponse {
  id: string;
  name: string;
  size: string;
  type: 'pdf' | 'docx' | 'ppt' | 'image' | 'txt';
  status: 'Processing' | 'Indexed' | 'Failed';
  upload_date: string;
  tags: string[];
  summary?: string;
  ocr_text?: string;
  collection_id?: string;
}

export interface CollectionResponse {
  id: string;
  name: string;
  description?: string;
  icon_type: string;
  created_at: string;
  updated_at: string;
  documents_count: number;
  progress: number;
}

export interface MessageResponse {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  citations: string[];
}

export interface ChatSessionResponse {
  id: string;
  title: string;
  date: string;
  messages: MessageResponse[];
  collection_id?: string;
}

export interface SystemSettingsResponse {
  active_model: string;
  ocr_enabled: boolean;
  ocr_language: string;
  chunk_size: number;
  chunk_overlap: number;
}

export interface RecentOCRActivity {
  timestamp: string;
  document_name: string;
  status: string;
}

export interface AnalyticsResponse {
  memory_used: number;
  memory_max: number;
  collections_count: number;
  documents_count: number;
  active_model: string;
  ocr_status: string;
  recent_uploads: DocumentResponse[];
  recent_ocr: RecentOCRActivity[];
  console_logs: string[];
  total_chunks: number;
  chunk_size: number;
  chunk_overlap: number;
}

// ----------------------------------------------------
// Collections API
// ----------------------------------------------------
export async function getCollections(): Promise<CollectionResponse[]> {
  const res = await fetch(`${API_BASE}/collections`);
  if (!res.ok) throw new Error("Failed fetching collections");
  return res.json();
}

export async function createCollection(name: string, description?: string, iconType?: string): Promise<CollectionResponse> {
  const res = await fetch(`${API_BASE}/collections`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description, icon_type: iconType || "BookOpen" })
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.detail || "Failed creating collection");
  }
  return res.json();
}

export async function deleteCollection(id: string): Promise<any> {
  const res = await fetch(`${API_BASE}/collections/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed deleting collection");
  return res.json();
}

export async function renameCollection(id: string, name: string, description?: string): Promise<CollectionResponse> {
  const res = await fetch(`${API_BASE}/collections/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description })
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.detail || "Failed renaming collection");
  }
  return res.json();
}

// ----------------------------------------------------
// Documents API
// ----------------------------------------------------
export async function getDocuments(collectionId?: string): Promise<DocumentResponse[]> {
  const url = collectionId 
    ? `${API_BASE}/documents?collection_id=${collectionId}`
    : `${API_BASE}/documents`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed fetching documents");
  return res.json();
}

export async function deleteDocument(id: string): Promise<any> {
  const res = await fetch(`${API_BASE}/documents/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed deleting document");
  return res.json();
}

export async function uploadDocument(file: File, collectionId: string, onProgress?: (pct: number) => void): Promise<DocumentResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("collection_id", collectionId);

  // Simulating progress since native fetch does not support upload progress tracking natively without XMLHttpRequest
  if (onProgress) {
    onProgress(20);
    setTimeout(() => onProgress(60), 300);
  }

  const res = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    body: formData
  });

  if (onProgress) onProgress(100);

  if (!res.ok) {
    const errData = await res.json();
    throw new Error(errData.detail || "Failed uploading file");
  }
  return res.json();
}

// ----------------------------------------------------
// Settings API
// ----------------------------------------------------
export async function getSettings(): Promise<SystemSettingsResponse> {
  const res = await fetch(`${API_BASE}/settings`);
  if (!res.ok) throw new Error("Failed fetching settings");
  return res.json();
}

export async function updateSettings(settings: SystemSettingsResponse): Promise<any> {
  const res = await fetch(`${API_BASE}/settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings)
  });
  if (!res.ok) throw new Error("Failed updating settings");
  return res.json();
}

// ----------------------------------------------------
// Analytics API
// ----------------------------------------------------
export async function getAnalytics(): Promise<AnalyticsResponse> {
  const res = await fetch(`${API_BASE}/analytics`);
  if (!res.ok) throw new Error("Failed fetching analytics");
  return res.json();
}

// ----------------------------------------------------
// Chat API
// ----------------------------------------------------
export async function getChatSessions(): Promise<ChatSessionResponse[]> {
  const res = await fetch(`${API_BASE}/chat/sessions`);
  if (!res.ok) throw new Error("Failed fetching chat sessions");
  return res.json();
}

export async function createChatSession(title?: string, collectionId?: string): Promise<ChatSessionResponse> {
  const res = await fetch(`${API_BASE}/chat/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, collection_id: collectionId })
  });
  if (!res.ok) throw new Error("Failed creating session");
  return res.json();
}

export async function deleteChatSession(id: string): Promise<any> {
  const res = await fetch(`${API_BASE}/chat/sessions/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed deleting session");
  return res.json();
}

export async function streamChatMessage(
  sessionId: string,
  prompt: string,
  collectionId: string | null,
  activeModel: string,
  mode: string,
  explainLevel: string,
  onChunk: (token: string) => void,
  onCitations: (citations: string[]) => void,
  onComplete: () => void,
  onError: (err: any) => void
) {
  try {
    const res = await fetch(`${API_BASE}/chat/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        prompt: prompt,
        collection_id: collectionId,
        model: activeModel,
        mode: mode,
        explain_level: explainLevel
      })
    });

    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}`);
    }

    const reader = res.body?.getReader();
    if (!reader) {
      throw new Error("No readable stream response body");
    }

    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const cleaned = line.trim();
        if (cleaned.startsWith("data: ")) {
          try {
            const dataStr = cleaned.slice(6);
            if (!dataStr) continue;
            const data = JSON.parse(dataStr);
            if (data.token) {
              onChunk(data.token);
            }
            if (data.citations && data.citations.length > 0) {
              onCitations(data.citations);
            }
          } catch (e) {
            console.error("Failed parsing stream chunk line:", e);
          }
        }
      }
    }
    onComplete();
  } catch (err) {
    onError(err);
  }
}

// ----------------------------------------------------
// Chunks API
// ----------------------------------------------------
export async function getDocumentChunks(collectionId?: string, documentId?: string, documentName?: string): Promise<any[]> {
  let url = `${API_BASE}/documents/chunks`;
  const params = [];
  if (collectionId) params.push(`collection_id=${encodeURIComponent(collectionId)}`);
  if (documentId) params.push(`document_id=${encodeURIComponent(documentId)}`);
  if (documentName) params.push(`document_name=${encodeURIComponent(documentName)}`);
  if (params.length > 0) url += `?${params.join("&")}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed fetching document chunks");
  return res.json();
}

export async function updateChatSessionTitle(id: string, title: string): Promise<any> {
  const res = await fetch(`${API_BASE}/chat/sessions/${id}?title=${encodeURIComponent(title)}`, {
    method: "PUT"
  });
  if (!res.ok) throw new Error("Failed updating session title");
  return res.json();
}
