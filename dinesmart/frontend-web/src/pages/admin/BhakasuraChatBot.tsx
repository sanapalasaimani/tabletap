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

interface FormattedBotMessageProps {
  text: string;
}

const renderInline = (str: string): React.ReactNode[] => {
  if (!str) return [];
  // Tokenize bold, italic, code, and citations
  const tokenRegex = /(\*\*\*[\s\S]+?\*\*\*|\*\*[\s\S]+?\*\*|__[\s\S]+?__|`[^`]+`|\*[\s\S]+?\*|_[\s\S]+?_|\[(?:DS|CATALOG|SUPABASE)-[A-Z0-9-]+\])/g;
  const parts = str.split(tokenRegex);

  return parts.map((part, i) => {
    if (!part) return null;

    // Bold italic ***text***
    if (part.startsWith('***') && part.endsWith('***') && part.length >= 6) {
      const inner = part.slice(3, -3);
      return <strong key={i} className="font-extrabold italic text-slate-900">{inner}</strong>;
    }
    // Bold **text** or __text__
    if ((part.startsWith('**') && part.endsWith('**') && part.length >= 4) ||
        (part.startsWith('__') && part.endsWith('__') && part.length >= 4)) {
      const inner = part.slice(2, -2);
      return <strong key={i} className="font-bold text-slate-900">{inner}</strong>;
    }
    // Italic *text* or _text_
    if ((part.startsWith('*') && part.endsWith('*') && part.length >= 2) ||
        (part.startsWith('_') && part.endsWith('_') && part.length >= 2)) {
      const inner = part.slice(1, -1);
      return <em key={i} className="italic text-slate-800">{inner}</em>;
    }
    // Inline code `code`
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      const inner = part.slice(1, -1);
      return <code key={i} className="bg-orange-50 text-orange-600 px-1 py-0.5 rounded font-mono text-[11px] border border-orange-100">{inner}</code>;
    }
    // Citations [DS-ML-...]
    if (part.startsWith('[') && part.endsWith(']')) {
      return (
        <span key={i} className="inline-block bg-orange-50 text-orange-700 font-semibold px-1.5 py-0.5 rounded text-[10px] border border-orange-200 mx-0.5">
          {part}
        </span>
      );
    }

    // Clean any remaining unparsed stray symbols
    const cleaned = part.replace(/\*\*/g, '').replace(/^#{1,6}\s*/, '');
    return <span key={i}>{cleaned}</span>;
  }).filter(Boolean);
};

export const FormattedBotMessage: React.FC<FormattedBotMessageProps> = ({ text }) => {
  if (!text) return null;

  // Clean ASCII borders and thinking tags if any
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

    // 0. Collapsible <details> block handling for Executed SQL & Provenance
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

    // 0b. Fenced Code Block handling (```sql ... ```)
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

    // 1. Markdown Table Handling
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableRows: string[] = [];
      while (i < rawLines.length && rawLines[i].trim().startsWith('|') && rawLines[i].trim().endsWith('|')) {
        const row = rawLines[i].trim();
        // Skip table separator line (| :--- | :--- |)
        if (!/^[|\s:-]+$/.test(row)) {
          tableRows.push(row);
        }
        i++;
      }

      if (tableRows.length > 0) {
        const headerCols = tableRows[0]
          .split('|')
          .slice(1, -1)
          .map(c => c.trim());
        const bodyRows = tableRows.slice(1).map(r =>
          r.split('|').slice(1, -1).map(c => c.trim())
        );

        elements.push(
          <div key={`table-${i}`} className="my-2.5 overflow-x-auto rounded-xl border border-slate-200 shadow-xs">
            <table className="w-full text-[11px] text-left border-collapse">
              <thead className="bg-orange-50/70 border-b border-slate-200 text-slate-800">
                <tr>
                  {headerCols.map((h, colIdx) => (
                    <th key={colIdx} className="p-2 font-bold text-slate-900 border-r border-slate-200 last:border-r-0">
                      {renderInline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((row, rowIdx) => (
                  <tr key={rowIdx} className="border-b border-slate-100 last:border-b-0 even:bg-slate-50/50">
                    {row.map((cell, cellIdx) => (
                      <td key={cellIdx} className="p-2 text-slate-700 border-r border-slate-100 last:border-r-0">
                        {renderInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // 2. Title detection: either Markdown heading (# Title) or the very first standalone title line
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    const isFirstLineTitle = i === 0 && trimmed.length < 80 && !trimmed.startsWith('-') && !trimmed.startsWith('*') && !trimmed.startsWith('•') && !/^\d+\./.test(trimmed) && !trimmed.includes(':');

    if (headingMatch || isFirstLineTitle) {
      const headingContent = (headingMatch ? headingMatch[2] : trimmed).replace(/\*\*/g, '').trim();

      elements.push(
        <div key={`h-${i}`} className="font-extrabold text-[13px] text-slate-900 mt-1 mb-1.5 pb-1 border-b border-orange-100 tracking-tight flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0"></span>
          <span>{headingContent}</span>
        </div>
      );
      i++;
      continue;
    }

    // 3. Bullet points (-, *, or •)
    const bulletMatch = trimmed.match(/^[-*•]\s+(.*)$/);
    if (bulletMatch) {
      const content = bulletMatch[1];
      elements.push(
        <div key={`bullet-${i}`} className="flex items-start gap-2 my-0.5 text-slate-700 leading-relaxed pl-0.5">
          <span className="text-orange-500 font-bold shrink-0 leading-5 text-sm">•</span>
          <div className="flex-1 min-w-0">
            {renderInline(content)}
          </div>
        </div>
      );
      i++;
      continue;
    }

    // 4. Numbered list (1. , 2. )
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

    // 5. Blockquote (> Note)
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

    // 6. Regular Paragraph
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
          text: `### System Notice\n\nI am operating in offline safe mode. Please verify the connection or try your request again in a moment.\n\n- **Status**: Local verified dataset available\n- **Service Hours**: 7:00 AM – 11:30 PM daily\n- **Assistance**: You can ask about menu dishes, pricing, allergens, staff roster, or 1-year financial metrics.`
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
            <div className={`max-w-[90%] p-3.5 rounded-2xl leading-relaxed ${
              msg.sender === 'user'
                ? 'bg-[#FF6B00] text-white font-sans font-semibold rounded-br-xs shadow-md shadow-orange-500/20 whitespace-pre-wrap'
                : 'bg-white border border-orange-100 text-slate-800 font-sans text-xs rounded-bl-xs shadow-xs overflow-x-auto leading-relaxed'
            }`}>
              {msg.sender === 'user' ? (
                msg.text
              ) : (
                <FormattedBotMessage text={msg.text} />
              )}
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
