import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Upload, FileText, Send, Bot, User as UserIcon, RefreshCw } from "lucide-react";
import { decryptData } from "@/lib/secure-storage";
import { useToast } from "@/hooks/use-toast";
import { triggerCreditUsage } from "@/lib/credit-utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const Gaskeun = () => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfText, setPdfText] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Halo! Saya OKi, asisten AI kamu. Upload PDF dulu ya, nanti saya bantu analisis! 🤖" }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [usingBYOK, setUsingBYOK] = useState(false);
  const [encryptedApiKey, setEncryptedApiKey] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  // API URL configuration
  const baseURL = import.meta.env.VITE_API_URL || "http://localhost:8000";
  const API_URL = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;

  // Get JWT token
  const getAuthToken = () => {
    const user = JSON.parse(sessionStorage.getItem('user') || '{}');
    return user.credential || '';
  };

  // Auto scroll to bottom when new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast({
        title: "❌ ERROR",
        description: "File harus PDF!",
        variant: "destructive",
      });
      return;
    }

    setPdfFile(file);
    setIsProcessing(true);

    try {
      // Call backend API to extract PDF text
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_URL}/api/extract-pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: formData
      });

      const data = await response.json();

      if (data.status === 'success') {
        setPdfText(data.text);
        setMessages(prev => [
          ...prev,
          { role: "assistant", content: `✅ PDF "${file.name}" berhasil diupload! (${data.pages} halaman)\n\nSekarang kamu bisa tanya apa aja tentang dokumen ini. Contoh:\n- "Rangkum isi dokumen ini"\n- "Siapa penerima dokumen?"\n- "Apa nomor dokumen?"` }
        ]);
        
        // 🔥 WAJIB: Trigger credit update event
        window.dispatchEvent(new Event('creditUpdated'));
      } else {
        throw new Error(data.message || 'Gagal ekstraksi PDF');
      }
      
      setIsProcessing(false);
    } catch (error) {
      toast({
        title: "❌ ERROR",
        description: error instanceof Error ? error.message : "Gagal membaca PDF",
        variant: "destructive",
      });
      setIsProcessing(false);
      setPdfFile(null);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    // Add user message
    const userMessage: Message = { role: "user", content: inputMessage };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsProcessing(true);

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      };

      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          messages: [...messages, userMessage],
          pdfText: pdfText
        })
      });

      const data = await response.json();

      if (data.status === 'success') {
        const aiResponse: Message = {
          role: "assistant",
          content: data.message
        };
        setMessages(prev => [...prev, aiResponse]);
        
        // 🔥 WAJIB: Trigger credit update event untuk refresh saldo
        window.dispatchEvent(new Event('creditUpdated'));
        
        // Trigger credit usage for OKi chatbot
        triggerCreditUsage('chatbot_oki', `Chat message: ${userMessage.content.substring(0, 30)}...`);
      } else {
        throw new Error(data.detail || 'Gagal mendapat response AI');
      }
      
      setIsProcessing(false);
    } catch (error) {
      toast({
        title: "❌ ERROR",
        description: error instanceof Error ? error.message : "Gagal mengirim pesan",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        <div className="brutal-border bg-background p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                onClick={() => navigate("/")}
                variant="outline"
                size="sm"
                className="brutal-btn"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="text-xl font-bold uppercase">GASKEUN - OKi AI</h1>
                <p className="text-xs text-muted-foreground">PDF Analyzer & Chatbot</p>
              </div>
              {usingBYOK && (
                <div className="brutal-border-thin bg-green-500 text-white px-2 py-1 text-xs font-bold">
                  🔑 BYOK ACTIVE
                </div>
              )}
            </div>
            <Bot className="w-8 h-8 text-primary" />
          </div>
        </div>

        {/* PDF Upload Section */}
        {!pdfFile && (
          <div className="brutal-border bg-background p-6 mb-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-foreground/20 rounded-none p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <Upload className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
              <p className="font-bold uppercase mb-1">UPLOAD PDF DISINI</p>
              <p className="text-xs text-muted-foreground">Klik atau drag & drop file PDF kamu</p>
            </div>
          </div>
        )}

        {/* PDF Info */}
        {pdfFile && (
          <div className="brutal-border bg-success/10 p-3 mb-4 flex items-center gap-3">
            <FileText className="w-5 h-5 text-success" />
            <div className="flex-1">
              <p className="font-bold text-sm">{pdfFile.name}</p>
              <p className="text-xs text-muted-foreground">{(pdfFile.size / 1024).toFixed(2)} KB</p>
            </div>
            <Button
              onClick={() => {
                setPdfFile(null);
                setPdfText("");
                setMessages([{ role: "assistant", content: "Upload PDF baru untuk analisis lagi! 🤖" }]);
              }}
              variant="outline"
              size="sm"
              className="brutal-btn"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Chat Messages */}
        <div className="brutal-border bg-background p-4 mb-4 h-[500px] overflow-y-auto space-y-3">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {message.role === "assistant" && (
                <div className="brutal-border w-8 h-8 flex items-center justify-center bg-primary text-primary-foreground flex-shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
              )}
              <div
                className={`brutal-border p-3 max-w-[80%] ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
              {message.role === "user" && (
                <div className="brutal-border w-8 h-8 flex items-center justify-center bg-secondary flex-shrink-0">
                  <UserIcon className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}
          {isProcessing && (
            <div className="flex gap-3 justify-start">
              <div className="brutal-border w-8 h-8 flex items-center justify-center bg-primary text-primary-foreground">
                <Bot className="w-4 h-4 animate-pulse" />
              </div>
              <div className="brutal-border p-3 bg-muted">
                <p className="text-sm">OKi sedang berpikir...</p>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Chat Input */}
        <div className="brutal-border bg-background p-3 flex gap-2">
          <Textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Tanya OKi tentang PDF kamu..."
            className="brutal-input resize-none"
            rows={2}
            disabled={isProcessing}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isProcessing}
            className="brutal-btn brutal-press self-end"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>

        {/* Info Note */}
        <div className="mt-4 text-center text-xs text-muted-foreground">
          <p>💡 Tips: Tanya "Rangkum isi dokumen" atau "Apa poin penting dalam PDF?"</p>
          <p className="mt-1">🤖 OKi menggunakan AI untuk analisis dokumen kamu</p>
        </div>
      </div>
    </div>
  );
};

export default Gaskeun;
