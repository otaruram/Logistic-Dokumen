import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Paperclip, Send, Sparkles, Clock, X, Plus, MessageSquare, FileText, Image as ImageIcon, Loader2, Trash2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ── Types ──
interface ChatMessage {
  id?: string;
  text: string;
  sender: 'user' | 'bot';
  attachment?: { name: string; type: string; preview: string; file: File } | null;
  isThinking?: boolean;
  attachment_name?: string;
  attachment_type?: string;
}

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

// ── Helper: get auth token ──
async function getAuthToken(): Promise<string | null> {
  try {
    const { supabase } = await import('@/lib/supabaseClient');
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  } catch {
    return null;
  }
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = await getAuthToken();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ── Components ──
const TypingIndicator = () => (
  <div className="flex items-center gap-1.5 py-1">
    <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
    <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
    <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
  </div>
);

const BotAvatar = () => (
  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
    <Sparkles className="w-4 h-4 text-white" />
  </div>
);

// ── Main Page Component ──
const OtaruChatPage = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [attachment, setAttachment] = useState<{ name: string; type: string; preview: string; file: File } | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Session state
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Auto-scroll ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Auto-resize textarea ──
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px';
    }
  }, [input]);

  // ── Load sessions on mount ──
  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    try {
      setSessionsLoading(true);
      const data = await apiFetch('/api/chatbot/sessions');
      setSessions(data.sessions || []);
    } catch (e) {
      console.error('Failed to load sessions:', e);
    } finally {
      setSessionsLoading(false);
    }
  }

  async function createNewSession(): Promise<string | null> {
    try {
      const data = await apiFetch('/api/chatbot/sessions', {
        method: 'POST',
        body: JSON.stringify({ title: 'New Chat' }),
      });
      const session = data.session;
      if (session) {
        setSessions((prev) => [session, ...prev]);
        setActiveSessionId(session.id);
        return session.id;
      }
      return null;
    } catch (e) {
      console.error('Failed to create session:', e);
      return null;
    }
  }

  async function loadSessionMessages(sessionId: string) {
    try {
      setIsLoading(true);
      const data = await apiFetch(`/api/chatbot/sessions/${sessionId}/messages`);
      const msgs: ChatMessage[] = (data.messages || []).map((m: any) => ({
        id: m.id,
        text: m.content,
        sender: m.role as 'user' | 'bot',
        attachment_name: m.attachment_name,
        attachment_type: m.attachment_type,
      }));
      setMessages(msgs);
      setActiveSessionId(sessionId);
      setIsHistoryOpen(false);
    } catch (e) {
      console.error('Failed to load messages:', e);
    } finally {
      setIsLoading(false);
    }
  }

  async function deleteSession(sessionId: string) {
    try {
      await apiFetch(`/api/chatbot/sessions/${sessionId}`, { method: 'DELETE' });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setMessages([]);
      }
    } catch (e) {
      console.error('Failed to delete session:', e);
    }
  }

  function handleNewChat() {
    setActiveSessionId(null);
    setMessages([]);
    setInput('');
    setAttachment(null);
    setIsHistoryOpen(false);
  }

  // ── Dropzone ──
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setAttachment({
        name: file.name,
        type: file.type,
        preview: URL.createObjectURL(file),
        file,
      });
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    noClick: true,
    noKeyboard: true,
  });

  // ── Send Message ──
  const handleSendMessage = async () => {
    if ((!input.trim() && !attachment) || isLoading) return;

    const userMessage: ChatMessage = { text: input, sender: 'user', attachment };
    setMessages((prev) => [...prev, userMessage]);

    // Create session if needed
    let sessionId = activeSessionId;
    if (!sessionId) {
      sessionId = await createNewSession();
    }

    const formData = new FormData();
    formData.append('prompt', input);
    if (sessionId) formData.append('session_id', sessionId);
    if (attachment) formData.append('file', attachment.file);

    setInput('');
    setAttachment(null);
    setIsLoading(true);

    setMessages((prev) => [...prev, { text: '', sender: 'bot', isThinking: true }]);

    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_URL}/api/chatbot/chat`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      if (!response.ok) throw new Error('API request failed');
      const data = await response.json();

      setMessages((prev) => {
        const newMsgs = [...prev];
        const idx = newMsgs.findIndex((m) => m.isThinking);
        if (idx !== -1) newMsgs[idx] = { text: data.response, sender: 'bot' };
        return newMsgs;
      });

      // Refresh sessions list to get updated title
      loadSessions();
    } catch (error) {
      console.error('Chat API error:', error);
      setMessages((prev) => {
        const newMsgs = [...prev];
        const idx = newMsgs.findIndex((m) => m.isThinking);
        if (idx !== -1) newMsgs[idx] = { text: 'Sorry, an error occurred. Please try again.', sender: 'bot' };
        return newMsgs;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // ── Group sessions by date ──
  function groupSessionsByDate(sessions: ChatSession[]) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const groups: { label: string; items: ChatSession[] }[] = [
      { label: 'Today', items: [] },
      { label: 'Yesterday', items: [] },
      { label: 'Previous 7 Days', items: [] },
      { label: 'Older', items: [] },
    ];

    sessions.forEach((s) => {
      const d = new Date(s.updated_at || s.created_at);
      if (d >= today) groups[0].items.push(s);
      else if (d >= yesterday) groups[1].items.push(s);
      else if (d >= weekAgo) groups[2].items.push(s);
      else groups[3].items.push(s);
    });

    return groups.filter((g) => g.items.length > 0);
  }

  const isEmpty = messages.length === 0;

  return (
    <div {...getRootProps()} className="flex flex-col h-full relative" style={{ background: '#131314' }}>
      <input {...getInputProps()} />

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-3">
          <BotAvatar />
          <div>
            <h1 className="text-[15px] font-semibold text-white tracking-tight">Otaru</h1>
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Document Analysis AI</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleNewChat}
            className="p-2 rounded-full transition-colors duration-200"
            style={{ color: 'rgba(255,255,255,0.5)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            aria-label="New Chat"
            title="New Chat"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button
            onClick={() => { setIsHistoryOpen(true); loadSessions(); }}
            className="p-2 rounded-full transition-colors duration-200"
            style={{ color: 'rgba(255,255,255,0.5)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            aria-label="Chat History"
            title="Chat History"
          >
            <Clock className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Chat Area ── */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full px-6 pb-8">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-xl shadow-blue-500/20">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-semibold text-white mb-2">Hi, I'm Otaru</h2>
              <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.45)', maxWidth: '360px' }}>
                Your expert logistics & financial document analyst. Upload a document or ask me anything.
              </p>
              <div className="flex flex-wrap justify-center gap-2.5 max-w-md">
                {[
                  { icon: <FileText className="w-4 h-4" />, text: 'Analyze an invoice' },
                  { icon: <ImageIcon className="w-4 h-4" />, text: 'Scan a receipt' },
                  { icon: <MessageSquare className="w-4 h-4" />, text: 'Review delivery order' },
                ].map((chip, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.1, duration: 0.3 }}
                    onClick={() => setInput(chip.text)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all duration-200"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                  >
                    {chip.icon}
                    {chip.text}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto px-4 py-5 space-y-6">
            {messages.map((msg, index) => (
              <motion.div key={index} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                {msg.sender === 'user' ? (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-3" style={{ background: '#1e3a5f' }}>
                      {(msg.attachment || msg.attachment_name) && (
                        <div className="mb-2.5">
                          {msg.attachment?.type?.startsWith('image/') ? (
                            <img src={msg.attachment.preview} alt="attachment" className="rounded-lg max-h-48 object-cover" />
                          ) : (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }}>
                              <FileText className="w-4 h-4" />
                              {msg.attachment?.name || msg.attachment_name}
                            </div>
                          )}
                        </div>
                      )}
                      <p className="text-[14px] leading-relaxed text-white whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3 items-start">
                    <BotAvatar />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Otaru</p>
                      <div className="rounded-2xl rounded-tl-md px-4 py-3" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        {msg.isThinking ? <TypingIndicator /> : (
                          <p className="text-[14px] leading-relaxed whitespace-pre-wrap" style={{ color: 'rgba(255,255,255,0.88)' }}>{msg.text}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        {isDragActive && (
          <div className="absolute inset-0 flex items-center justify-center z-40" style={{ background: 'rgba(19,19,20,0.9)', backdropFilter: 'blur(8px)' }}>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl border-2 border-dashed border-blue-400 flex items-center justify-center">
                <Paperclip className="w-7 h-7 text-blue-400" />
              </div>
              <p className="text-lg font-medium text-white">Drop file to analyze</p>
              <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>PDF, DOCX, JPG, PNG</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Input Area ── */}
      <div className="px-4 pb-4 pt-2">
        <div className="max-w-2xl mx-auto">
          <AnimatePresence>
            {attachment && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-2.5">
                <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  {attachment.type.startsWith('image/') ? (
                    <img src={attachment.preview} alt="preview" className="w-10 h-10 rounded-lg object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(96,165,250,0.15)' }}>
                      <FileText className="w-5 h-5 text-blue-400" />
                    </div>
                  )}
                  <span className="text-sm flex-1 truncate" style={{ color: 'rgba(255,255,255,0.7)' }}>{attachment.name}</span>
                  <button onClick={() => setAttachment(null)} className="p-1 rounded-full transition-colors" style={{ color: 'rgba(255,255,255,0.4)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div
            className="relative flex items-end rounded-2xl overflow-hidden transition-all duration-200"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-shrink-0 p-3.5 transition-colors duration-200"
              style={{ color: 'rgba(255,255,255,0.4)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
              title="Attach file"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <input type="file" ref={fileInputRef} onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setAttachment({ name: file.name, type: file.type, preview: URL.createObjectURL(file), file });
            }} className="hidden" accept="image/jpeg,image/png,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Otaru about your documents..."
              rows={1}
              className="flex-1 py-3.5 bg-transparent resize-none focus:outline-none text-sm"
              style={{ color: 'rgba(255,255,255,0.9)', maxHeight: '150px' }}
            />
            <button
              onClick={handleSendMessage}
              disabled={isLoading || (!input.trim() && !attachment)}
              className="flex-shrink-0 p-3 mr-1 mb-1 rounded-xl transition-all duration-200 flex items-center justify-center"
              style={{
                background: (input.trim() || attachment) && !isLoading ? 'linear-gradient(135deg, #3b82f6, #7c3aed)' : 'rgba(255,255,255,0.06)',
                color: (input.trim() || attachment) && !isLoading ? '#fff' : 'rgba(255,255,255,0.2)',
                cursor: isLoading || (!input.trim() && !attachment) ? 'not-allowed' : 'pointer',
              }}
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
          <p className="text-center mt-2.5 text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>Otaru may make mistakes. Verify important information.</p>
        </div>
      </div>

      {/* ── History Sidebar ── */}
      <AnimatePresence>
        {isHistoryOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsHistoryOpen(false)}
              className="absolute inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
            />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 350, damping: 35 }}
              className="absolute top-0 right-0 h-full w-[300px] z-50 flex flex-col"
              style={{ background: '#1a1a1c', borderLeft: '1px solid rgba(255,255,255,0.08)' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} />
                  <h2 className="text-sm font-semibold text-white">Chat History</h2>
                </div>
                <button onClick={() => setIsHistoryOpen(false)} className="p-1.5 rounded-lg transition-colors" style={{ color: 'rgba(255,255,255,0.4)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* New Chat button in sidebar */}
              <div className="px-3 py-3">
                <button
                  onClick={handleNewChat}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all duration-200"
                  style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: 'rgba(96,165,250,0.9)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(96,165,250,0.15)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(96,165,250,0.1)'; }}
                >
                  <Plus className="w-4 h-4" />
                  New Chat
                </button>
              </div>

              {/* Session list */}
              <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-4" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
                {sessionsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'rgba(255,255,255,0.3)' }} />
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2" style={{ color: 'rgba(255,255,255,0.15)' }} />
                    <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No chat history yet</p>
                  </div>
                ) : (
                  groupSessionsByDate(sessions).map((group) => (
                    <div key={group.label}>
                      <h3 className="text-[11px] font-medium uppercase tracking-wider mb-2 px-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {group.label}
                      </h3>
                      <div className="space-y-0.5">
                        {group.items.map((session) => (
                          <div
                            key={session.id}
                            className="group flex items-center rounded-xl transition-all duration-200"
                            style={{
                              background: activeSessionId === session.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                            }}
                            onMouseEnter={(e) => {
                              if (activeSessionId !== session.id) e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                            }}
                            onMouseLeave={(e) => {
                              if (activeSessionId !== session.id) e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <button
                              onClick={() => loadSessionMessages(session.id)}
                              className="flex-1 text-left px-3 py-2.5 text-sm flex items-center gap-2.5 min-w-0"
                              style={{ color: activeSessionId === session.id ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.6)' }}
                            >
                              <MessageSquare className="w-4 h-4 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.25)' }} />
                              <span className="truncate">{session.title}</span>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
                              className="flex-shrink-0 p-2 mr-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                              style={{ color: 'rgba(255,255,255,0.3)' }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}
                              title="Delete chat"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OtaruChatPage;
