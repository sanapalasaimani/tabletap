import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles, MessageCircle, ChevronDown, ChevronUp, Bot, BrainCircuit } from 'lucide-react';
import { askBhakasuraAI } from './groq';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
}

interface BhakasuraChatBotProps {
  contextData: any;
}

export default function BhakasuraChatBot({ contextData }: BhakasuraChatBotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'bot',
      text: "Greetings! I am TableTap Core AI. I will answer your questions directly with data-driven insights. How can I help you today?"
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
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: 'bot', text: "Error fetching my thoughts... Please check my connection." }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-16 h-16 rounded-full shadow-2xl flex items-center justify-center bg-orange-500 hover:bg-orange-600 transition-transform hover:scale-110 z-50 group p-1"
      >
        <div className="absolute inset-0 rounded-full border-4 border-white opacity-20"></div>
        <img src="/ai-avatar.png" alt="AI Avatar" className="w-full h-full rounded-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling!.classList.remove('hidden'); }} />
        <Bot className="w-8 h-8 text-white hidden" />
        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full border-2 border-white shadow-sm">
          1
        </div>
      </button>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 flex flex-col bg-white rounded-2xl shadow-2xl border border-orange-100 z-50 overflow-hidden transition-all duration-300 ${isExpanded ? 'w-[400px] h-[600px]' : 'w-[350px] h-[450px]'}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-400 p-4 flex items-center justify-between text-white shadow-md relative z-10">
        <div className="flex items-center gap-3">
          <div className="relative bg-white/20 rounded-full border-2 border-white/50 shadow-sm flex items-center justify-center w-10 h-10 overflow-hidden p-0.5">
            <img src="/ai-avatar.png" alt="AI" className="w-full h-full rounded-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling!.classList.remove('hidden'); }} />
            <Bot size={20} className="text-white hidden" />
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-white rounded-full z-10"></div>
          </div>
          <div>
            <h3 className="font-extrabold text-sm leading-tight flex items-center gap-1">
              TableTap Core AI <Sparkles size={12} className="text-yellow-200" />
            </h3>
            <p className="text-[10px] font-medium text-orange-100 opacity-90">Ready to provide insights</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setIsExpanded(!isExpanded)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
            {isExpanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </button>
          <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-orange-50/30 scroll-smooth">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
            {msg.sender === 'bot' && (
              <div className="w-6 h-6 rounded-full mr-2 self-end shadow-sm bg-orange-500 flex items-center justify-center shrink-0 p-0.5">
                <img src="/ai-avatar.png" alt="AI" className="w-full h-full object-cover rounded-full" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling!.classList.remove('hidden'); }} />
                <Bot size={12} className="text-white hidden" />
              </div>
            )}
            <div
              className={`max-w-[75%] p-3 rounded-2xl text-sm shadow-sm whitespace-pre-wrap ${
                msg.sender === 'user'
                  ? 'bg-orange-500 text-white rounded-br-sm'
                  : 'bg-white border border-orange-100 text-gray-800 rounded-bl-sm'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="w-6 h-6 rounded-full mr-2 self-end shadow-sm bg-orange-500 flex items-center justify-center shrink-0 opacity-50 p-0.5">
              <img src="/ai-avatar.png" alt="AI" className="w-full h-full object-cover rounded-full" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling!.classList.remove('hidden'); }} />
              <Bot size={12} className="text-white hidden" />
            </div>
            <div className="bg-white border border-orange-100 p-3 rounded-2xl rounded-bl-sm text-sm text-gray-400 shadow-sm flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce"></span>
              <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              <span className="text-xs ml-1 font-medium italic">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 bg-white border-t border-orange-100">
        <div className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about sales, menu, insights..."
            className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-4 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-shadow"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-2 p-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white rounded-lg transition-colors shadow-sm"
          >
            <Send size={16} className={input.trim() && !isLoading ? 'ml-0.5' : ''} />
          </button>
        </div>
      </form>
    </div>
  );
}
