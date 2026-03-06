import React, { useState, useCallback, useRef } from 'react';
import { Paperclip, Send, Sparkles, Clock } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';

// Mock chat history data
const chatHistory = [
  { time: 'Today', chats: [{ id: 1, thread: 'Analysis of Invoice #123' }] },
  { time: 'Yesterday', chats: [{ id: 2, thread: 'Delivery Order Summary' }] },
  { time: 'Previous 7 Days', chats: [{ id: 3, thread: 'Receipt OCR' }] },
];

const OtaruChatPage = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const fileInputRef = useRef(null);

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      setAttachment({
        name: file.name,
        type: file.type,
        preview: URL.createObjectURL(file),
        file: file,
      });
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: 'image/jpeg, image/png, application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    noClick: true,
    noKeyboard: true,
  });

  const handleSendMessage = async () => {
    if (!input.trim() && !attachment) return;

    const userMessage = { text: input, sender: 'user', attachment };
    setMessages((prev) => [...prev, userMessage]);

    const formData = new FormData();
    formData.append('prompt', input);
    if (attachment) {
      formData.append('file', attachment.file);
    }

    setInput('');
    setAttachment(null);

    // Simulate bot thinking
    setTimeout(() => {
        setMessages((prev) => [...prev, { text: 'Otaru is thinking...', sender: 'bot' }]);
    }, 500);


    try {
      const response = await fetch('/api/chatbot/chat', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const data = await response.json();
      
      // Replace "thinking" message with actual response
      setMessages((prev) => {
        const newMessages = [...prev];
        const thinkingIndex = newMessages.findIndex(m => m.text === 'Otaru is thinking...');
        if (thinkingIndex !== -1) {
            newMessages[thinkingIndex] = { text: data.response, sender: 'bot' };
        }
        return newMessages;
      });

    } catch (error) {
      console.error('Chat API error:', error);
       setMessages((prev) => {
        const newMessages = [...prev];
        const thinkingIndex = newMessages.findIndex(m => m.text === 'Otaru is thinking...');
        if (thinkingIndex !== -1) {
            newMessages[thinkingIndex] = { text: 'Sorry, I encountered an error. Please try again.', sender: 'bot' };
        }
        return newMessages;
      });
    }
  };

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
     if (file) {
      setAttachment({
        name: file.name,
        type: file.type,
        preview: URL.createObjectURL(file),
        file: file,
      });
    }
  }

  return (
    <div {...getRootProps()} className="flex flex-col h-full bg-background text-foreground relative">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center">
          <Sparkles className="w-6 h-6 text-primary mr-2" />
          <h1 className="text-lg font-bold">Otaru</h1>
        </div>
        <button onClick={() => setIsHistoryOpen(true)} aria-label="Chat History">
          <Clock className="w-6 h-6" />
        </button>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 p-4 overflow-y-auto">
        {messages.map((msg, index) => (
          <div key={index} className={`flex mb-4 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`rounded-lg px-4 py-2 max-w-xs lg:max-w-md ${msg.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              {msg.attachment && (
                <div className="mb-2">
                  {msg.attachment.type.startsWith('image/') ? (
                    <img src={msg.attachment.preview} alt="attachment" className="rounded-md max-h-40" />
                  ) : (
                    <div className="p-2 bg-background rounded-md text-sm">{msg.attachment.name}</div>
                  )}
                </div>
              )}
              {msg.text}
            </div>
          </div>
        ))}
        {isDragActive && (
            <div className="absolute inset-0 bg-primary/10 flex items-center justify-center border-2 border-dashed border-primary rounded-lg">
                <p className="text-lg font-semibold">Drop files to analyze</p>
            </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-border">
        {attachment && (
          <div className="mb-2 flex items-center bg-muted p-2 rounded-lg">
            <Paperclip className="w-5 h-5 mr-2" />
            <span className="text-sm">{attachment.name}</span>
            <button onClick={() => setAttachment(null)} className="ml-auto text-xs">Remove</button>
          </div>
        )}
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Ask Otaru about your documents..."
            className="w-full bg-muted rounded-full py-3 pl-12 pr-20 focus:outline-none"
          />
          <button onClick={handleAttachmentClick} className="absolute left-4 top-1/2 -translate-y-1/2">
            <Paperclip className="w-5 h-5 text-muted-foreground" />
          </button>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
          <button onClick={handleSendMessage} className="absolute right-4 top-1/2 -translate-y-1/2 bg-primary text-primary-foreground rounded-full p-2">
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      {/* History Drawer */}
      <AnimatePresence>
        {isHistoryOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="absolute top-0 right-0 h-full w-full max-w-sm bg-background border-l border-border z-50 p-4"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">History</h2>
              <button onClick={() => setIsHistoryOpen(false)}>Close</button>
            </div>
            <div className="space-y-4">
              {chatHistory.map((group) => (
                <div key={group.time}>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">{group.time}</h3>
                  <ul className="space-y-2">
                    {group.chats.map((chat) => (
                      <li key={chat.id} className="p-2 bg-muted rounded-md cursor-pointer hover:bg-primary/10">
                        {chat.thread}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OtaruChatPage;
