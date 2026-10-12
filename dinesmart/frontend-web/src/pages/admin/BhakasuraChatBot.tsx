import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { askBhakasuraAI } from './groq';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
}

interface BhakasuraChatBotProps {
  contextData: any;
}

export const SimpleAIAvatar = ({ size = 32 }: { size?: number }) => (
  <div 
    style={{ width: size, height: size }} 
    className="rounded-full bg-gradient-to-tr from-[#FF6B00] via-amber-500 to-sky-400 p-[2px] shadow-md flex items-center justify-center flex-shrink-0 relative"
  >
    <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center">
      <Sparkles size={Math.round(size * 0.52)} className="text-amber-300 animate-pulse" />
    </div>
  </div>
);

export default function BhakasuraChatBot({ contextData }: BhakasuraChatBotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'bot',
      text: "Hi! I’m your restaurant assistant. I can help with menu items, recommendations, orders, allergens, and general questions. What would you like to know?"
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { id: Date.now().toString(), sender: 'user', text: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const history = newMessages.map(m => ({
        role: m.sender === 'bot' ? 'assistant' : 'user',
        content: m.text
      }));
      const response = await askBhakasuraAI(history, contextData);
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: 'bot', text: response }]);
    } catch (error) {
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'bot',
          text: `┌─ Answer ────────────────────────────────────────┐\n│ I encountered a temporary connection issue.    │\n│ Please check your internet connection or verify │\n│ the Groq API key configuration in .env.         │\n│                                                 │\n│ Key Details:                                    │\n│ • System is operating in offline safe mode     │\n│                                                 │\n│ Next Steps:                                     │\n│ • Try asking again in a moment.                 │\n└─────────────────────────────────────────────────┘`
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center bg-slate-900 hover:bg-slate-800 transition-transform hover:scale-110 z-50 group p-1 border-2 border-orange-500/50 cursor-pointer"
        title="Open Restaurant AI Assistant"
      >
        <SimpleAIAvatar size={48} />
        <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse"></div>
      </button>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 flex flex-col bg-white rounded-3xl shadow-2xl border border-orange-100 z-50 overflow-hidden transition-all duration-300 font-sans ${isExpanded ? 'w-[480px] h-[660px]' : 'w-[390px] h-[520px]'}`}>
      {/* Header */}
      <div className="bg-slate-950 p-4 flex items-center justify-between text-white shadow-md relative z-10 border-b border-orange-500/30">
        <div className="flex items-center gap-3">
          <SimpleAIAvatar size={36} />
          <div>
            <h3 className="font-black text-sm leading-tight flex items-center gap-1.5 text-slate-100">
              <span>TableTap AI</span>
              <span className="text-[10px] font-bold bg-orange-500/30 text-orange-400 px-1.5 py-0.5 rounded-full">Groq 160B / 120B</span>
            </h3>
            <p className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Live Knowledge & Database Connected</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-slate-400">
          <button onClick={() => setIsExpanded(!isExpanded)} className="p-1.5 hover:text-white rounded-lg transition-colors cursor-pointer" title={isExpanded ? "Collapse" : "Expand"}>
            {isExpanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </button>
          <button onClick={() => setIsOpen(false)} className="p-1.5 hover:text-white rounded-lg transition-colors cursor-pointer" title="Close">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FCFAF7] scroll-smooth text-xs">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
            {msg.sender === 'bot' && (
              <div className="mr-2 self-end shrink-0 mb-1">
                <SimpleAIAvatar size={24} />
              </div>
            )}
            <div className={`max-w-[88%] p-3.5 rounded-2xl leading-relaxed whitespace-pre-wrap ${
              msg.sender === 'user'
                ? 'bg-[#FF6B00] text-white font-sans font-semibold rounded-br-xs shadow-md shadow-orange-500/20'
                : 'bg-white border border-orange-100 text-slate-800 font-mono text-[11px] rounded-bl-xs shadow-xs overflow-x-auto'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-slate-400 text-xs py-2 pl-8">
            <RefreshCw size={13} className="animate-spin text-orange-500" />
            <span>Consulting restaurant intelligence...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-100 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about dishes, allergens, prices, orders..."
          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-orange-500 transition-all font-medium"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="w-9 h-9 rounded-xl bg-[#FF6B00] hover:bg-orange-600 disabled:opacity-40 text-white flex items-center justify-center transition-all cursor-pointer shadow-sm shadow-orange-500/25"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}
