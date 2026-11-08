import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles, ChevronDown, ChevronUp, RefreshCw, Volume2, VolumeX, Square, Copy, Check } from 'lucide-react';
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

interface FormattedBotMessageProps {
  text: string;
}

const renderInline = (str: string): React.ReactNode[] => {
  if (!str) return [];
  const tokenRegex = /(\*\*\*[\s\S]+?\*\*\*|\*\*[\s\S]+?\*\*|__[\s\S]+?__|`[^`]+`|\*[\s\S]+?\*|_[\s\S]+?_|\[(?:DS|CATALOG|SUPABASE)-[A-Z0-9-]+\])/g;
  const parts = str.split(tokenRegex);

  return parts.map((part, i) => {
    if (!part) return null;

    if (part.startsWith('***') && part.endsWith('***') && part.length >= 6) {
      const inner = part.slice(3, -3);
      return <strong key={i} className="font-extrabold italic text-slate-900">{inner}</strong>;
    }
    if ((part.startsWith('**') && part.endsWith('**') && part.length >= 4) ||
        (part.startsWith('__') && part.endsWith('__') && part.length >= 4)) {
      const inner = part.slice(2, -2);
      return <strong key={i} className="font-bold text-slate-900">{inner}</strong>;
    }
    if ((part.startsWith('*') && part.endsWith('*') && part.length >= 2) ||
        (part.startsWith('_') && part.endsWith('_') && part.length >= 2)) {
      const inner = part.slice(1, -1);
      return <em key={i} className="italic text-slate-800">{inner}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      const inner = part.slice(1, -1);
      return <code key={i} className="bg-orange-50 text-orange-600 px-1 py-0.5 rounded font-mono text-[11px] border border-orange-100">{inner}</code>;
    }
    if (part.startsWith('[') && part.endsWith(']')) {
      return (
        <span key={i} className="inline-block bg-orange-50 text-orange-700 font-semibold px-1.5 py-0.5 rounded text-[10px] border border-orange-200 mx-0.5">
          {part}
        </span>
      );
    }

    const cleaned = part.replace(/\*\*/g, '').replace(/^#{1,6}\s*/, '');
    return <span key={i}>{cleaned}</span>;
  }).filter(Boolean);
};

export const FormattedBotMessage: React.FC<FormattedBotMessageProps> = ({ text }) => {
  if (!text) return null;

  const cleanText = text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/[┌─│└┐┘├┤┬┴┼]/g, '')
    .trim();

  const rawLines = cleanText.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < rawLines.length) {
    const line = rawLines[i].trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // 0. Collapsible <details> block handling
    if (trimmed.startsWith('<details>')) {
      const detailsLines: string[] = [];
      while (i < rawLines.length && !rawLines[i].includes('</details>')) {
        detailsLines.push(rawLines[i]);
        i++;
      }
      if (i < rawLines.length) {
        detailsLines.push(rawLines[i]);
        i++;
      }
      const fullDetails = detailsLines.join('\n');
      const summaryMatch = fullDetails.match(/<summary>([\s\S]*?)<\/summary>/i);
      const summaryText = summaryMatch 
        ? summaryMatch[1].replace(/<[^>]+>/g, '').trim() 
        : 'View Executed SQL & Provenance';
      
      const bodyContent = fullDetails
        .replace(/<details>/i, '')
        .replace(/<\/details>/i, '')
        .replace(/<summary>[\s\S]*?<\/summary>/i, '')
        .trim();

      elements.push(
        <details key={`details-${i}`} className="my-2 bg-slate-900 text-slate-200 border border-slate-800 rounded-lg p-2.5 text-[11px] font-mono group">
          <summary className="cursor-pointer font-bold text-amber-400 hover:text-amber-300 select-none flex items-center gap-1.5">
            <span>⚡</span>
            <span>{summaryText}</span>
          </summary>
          <div className="mt-2 pt-2 border-t border-slate-800 text-slate-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
            {bodyContent}
          </div>
        </details>
      );
      continue;
    }

    // Code blocks
    if (trimmed.startsWith('```')) {
      const codeLines: string[] = [];
      const lang = trimmed.replace(/^```/, '').trim();
      i++;
      while (i < rawLines.length && !rawLines[i].trim().startsWith('```')) {
        codeLines.push(rawLines[i]);
        i++;
      }
      if (i < rawLines.length && rawLines[i].trim().startsWith('```')) {
        i++;
      }
      elements.push(
        <div key={`code-${i}`} className="my-2 rounded-lg bg-slate-900 border border-slate-800 overflow-hidden text-[11px] font-mono shadow-inner">
          {lang && (
            <div className="bg-slate-800/80 px-2.5 py-1 text-[10px] font-semibold text-slate-400 border-b border-slate-700/60 uppercase">
              {lang}
            </div>
          )}
          <pre className="p-2.5 text-amber-300 overflow-x-auto">
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>
      );
      continue;
    }

    // Headings
    if (trimmed.startsWith('#')) {
      const hLevel = trimmed.match(/^#+/)?.[0].length || 1;
      const hText = trimmed.replace(/^#+\s*/, '');
      if (hLevel <= 2) {
        elements.push(
          <div key={`h-${i}`} className="font-extrabold text-slate-900 text-xs mt-2 mb-1 border-b border-slate-100 pb-0.5">
            {renderInline(hText)}
          </div>
        );
      } else {
        elements.push(
          <div key={`h-${i}`} className="font-bold text-slate-900 text-xs mt-1.5 mb-0.5">
            {renderInline(hText)}
          </div>
        );
      }
      i++;
      continue;
    }

    // Bullet points
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const bulletContent = trimmed.replace(/^[-*]\s*/, '');
      elements.push(
        <div key={`b-${i}`} className="flex items-start gap-1.5 my-0.5 text-slate-700 leading-relaxed pl-1">
          <span className="text-orange-500 font-bold shrink-0 mt-0.5">•</span>
          <div className="flex-1 min-w-0">
            {renderInline(bulletContent)}
          </div>
        </div>
      );
      i++;
      continue;
    }

    // Numbered lists
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numberedMatch) {
      const num = numberedMatch[1];
      const content = numberedMatch[2];
      elements.push(
        <div key={`num-${i}`} className="flex items-start gap-2 my-0.5 text-slate-700 leading-relaxed pl-0.5">
          <span className="font-bold text-orange-600 text-xs shrink-0 w-4 text-right">{num}.</span>
          <div className="flex-1 min-w-0">
            {renderInline(content)}
          </div>
        </div>
      );
      i++;
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      const quoteContent = trimmed.replace(/^>\s*/, '');
      elements.push(
        <div key={`quote-${i}`} className="my-1.5 pl-3 border-l-2 border-orange-400 text-slate-600 italic bg-orange-50/40 py-1 rounded-r-lg">
          {renderInline(quoteContent)}
        </div>
      );
      i++;
      continue;
    }

    // Paragraph
    elements.push(
      <p key={`p-${i}`} className="my-1 text-slate-700 leading-relaxed">
        {renderInline(trimmed)}
      </p>
    );
    i++;
  }

  return <div className="space-y-0.5">{elements}</div>;
};

export default function BhakasuraChatBot({ contextData }: BhakasuraChatBotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'bot',
      text: "Hi! I’m TableTap AI Copilot. I can query real-time orders, calculate table turnover, check ingredient allergens, and analyze revenue trends. What would you like to ask?"
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [speechMuted, setSpeechMuted] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  // Clean text for speech synthesis
  const cleanForSpeech = (rawText: string) => {
    return rawText
      .replace(/<details>[\s\S]*?<\/details>/gi, '')
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/```[\s\S]*?```/gi, 'Code snippet omitted.')
      .replace(/[*_#`>-]/g, ' ')
      .replace(/\[(?:DS|CATALOG|SUPABASE)-[A-Z0-9-]+\]/gi, '')
      .trim();
  };

  const handleSpeakToggle = (msgId: string, text: string) => {
    if (!('speechSynthesis' in window)) {
      alert('Speech synthesis is not supported on this browser.');
      return;
    }

    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const spokenText = cleanForSpeech(text);
    if (!spokenText) return;

    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    // Pick best English voice if available
    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(v => (v.name.includes('Natural') || v.name.includes('Google') || v.lang.startsWith('en')) && !v.name.includes('Bad'));
    if (naturalVoice) {
      utterance.voice = naturalVoice;
    }

    utterance.onend = () => {
      setSpeakingMsgId(null);
    };
    utterance.onerror = () => {
      setSpeakingMsgId(null);
    };

    setSpeakingMsgId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSend = async (customPrompt?: string) => {
    const promptToSend = (customPrompt || input).trim();
    if (!promptToSend || isLoading) return;

    const userMessage: Message = { id: Date.now().toString(), sender: 'user', text: promptToSend };
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
      const newBotId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, { id: newBotId, sender: 'bot', text: response }]);

      // Auto-narrate if speech is not muted
      if (!speechMuted && 'speechSynthesis' in window) {
        handleSpeakToggle(newBotId, response);
      }
    } catch (error) {
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'bot',
          text: `I ran into a temporary issue retrieving that information. Please try your question again in a moment, or ask about today's live orders, current tables, or menu dishes.`
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = [
    "🔥 What are today's top sellers?",
    "⚡ Active orders in kitchen?",
    "💰 Summary of today's revenue",
    "🥜 Any nut allergy warnings in curries?"
  ];

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-[0_10px_35px_rgba(249,115,22,0.35)] flex items-center justify-center bg-slate-900 hover:bg-slate-800 transition-all hover:scale-105 z-50 group p-1 border-2 border-orange-500/50 cursor-pointer"
        title="Open TableTap AI Assistant"
      >
        <SimpleAIAvatar size={48} />
        <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse"></div>
      </button>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 flex flex-col bg-white rounded-3xl shadow-[0_20px_50px_rgba(15,23,42,0.16)] border border-slate-200/80 z-50 overflow-hidden transition-all duration-300 font-sans ${isExpanded ? 'w-[520px] h-[680px]' : 'w-[400px] h-[550px]'}`}>
      {/* Header */}
      <div className="bg-slate-900 p-4 flex items-center justify-between text-white shadow-sm relative z-10 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <SimpleAIAvatar size={36} />
          <div>
            <h3 className="font-black text-sm leading-tight flex items-center gap-1.5 text-white">
              <span>TableTap AI</span>
              <span className="text-[10px] font-bold bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full border border-orange-500/30">Llama 3.3 70B</span>
            </h3>
            <p className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Live Database & Voice Active</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-slate-400">
          <button 
            onClick={() => {
              if (speakingMsgId) {
                window.speechSynthesis?.cancel();
                setSpeakingMsgId(null);
              }
              setSpeechMuted(!speechMuted);
            }} 
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${speechMuted ? 'text-slate-500 hover:text-slate-400' : 'text-orange-400 hover:text-orange-300'}`} 
            title={speechMuted ? "Voice Narration Muted (Click to Unmute)" : "Voice Narration Active"}
          >
            {speechMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </button>
          <button onClick={() => setIsExpanded(!isExpanded)} className="p-1.5 hover:text-white rounded-lg transition-colors cursor-pointer" title={isExpanded ? "Collapse" : "Expand"}>
            {isExpanded ? <ChevronDown size={17} /> : <ChevronUp size={17} />}
          </button>
          <button 
            onClick={() => {
              if (speakingMsgId) {
                window.speechSynthesis?.cancel();
                setSpeakingMsgId(null);
              }
              setIsOpen(false);
            }} 
            className="p-1.5 hover:text-white rounded-lg transition-colors cursor-pointer" 
            title="Close"
          >
            <X size={17} />
          </button>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/70 scroll-smooth text-xs">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in group`}>
            {msg.sender === 'bot' && (
              <div className="mr-2 self-start shrink-0 mt-1">
                <SimpleAIAvatar size={24} />
              </div>
            )}
            <div className="max-w-[88%] space-y-1">
              <div className={`p-3.5 rounded-2xl leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-slate-900 text-white font-medium rounded-br-xs shadow-sm'
                  : 'bg-white border border-slate-200/70 text-slate-800 rounded-bl-xs shadow-sm'
              }`}>
                {msg.sender === 'user' ? (
                  <span className="whitespace-pre-wrap">{msg.text}</span>
                ) : (
                  <FormattedBotMessage text={msg.text} />
                )}
              </div>

              {/* Bot Message Micro Actions: Listen & Copy */}
              {msg.sender === 'bot' && (
                <div className="flex items-center gap-2 pl-1 pt-0.5 text-[10px] text-slate-400">
                  <button
                    onClick={() => handleSpeakToggle(msg.id, msg.text)}
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-slate-200/60 transition-colors cursor-pointer ${speakingMsgId === msg.id ? 'text-orange-600 font-bold bg-orange-50' : ''}`}
                    title={speakingMsgId === msg.id ? "Stop voice narration" : "Listen aloud"}
                  >
                    {speakingMsgId === msg.id ? (
                      <>
                        <Square size={10} className="fill-current text-orange-600" />
                        <span>Stop Voice</span>
                      </>
                    ) : (
                      <>
                        <Volume2 size={11} />
                        <span>Listen</span>
                      </>
                    )}
                  </button>
                  <span>&bull;</span>
                  <button
                    onClick={() => handleCopyText(msg.id, msg.text)}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-slate-200/60 transition-colors cursor-pointer"
                  >
                    {copiedId === msg.id ? (
                      <>
                        <Check size={11} className="text-emerald-500" />
                        <span className="text-emerald-600 font-semibold">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={11} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2.5 text-slate-500 text-xs py-2 pl-8">
            <RefreshCw size={13} className="animate-spin text-orange-500" />
            <span>Consulting restaurant live database...</span>
          </div>
        )}

        {/* Quick Suggestion Pills (Shown when conversation is fresh) */}
        {messages.length <= 2 && !isLoading && (
          <div className="pt-2 pl-8 space-y-1.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Suggested Inquiries</p>
            <div className="flex flex-wrap gap-1.5">
              {quickPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(prompt)}
                  className="px-2.5 py-1 rounded-full bg-white border border-slate-200 hover:border-orange-400 hover:text-orange-600 text-slate-600 text-[11px] font-medium transition-all shadow-xs text-left"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="p-3 bg-white border-t border-slate-100 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask dishes, kitchen orders, revenue, allergens..."
          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-orange-500 transition-all font-medium"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="w-9 h-9 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white flex items-center justify-center transition-all cursor-pointer shadow-sm shadow-orange-500/25"
          title="Send message"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}
