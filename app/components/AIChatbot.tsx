'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, Minimize2 } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AIChatbotProps {
  selectedMeds?: string[]; // Made optional to prevent strict typing errors
}

const SYSTEM_PROMPT = `You are Sanjeevani, the AI health assistant for Project Sanjeevani — a real-time medicine and pharmacy locator platform built for emergencies in India. You are embedded inside the Sanjeevani web app.

Your purpose:
- Help users find medicines and nearby pharmacies using Sanjeevani's features
- Answer questions about medicines in simple, clear, non-technical language
- Guide users on how to use the app (search box, prescription scan, map ping)
- Suggest common generic alternatives when a medicine might be unavailable
- Give calm, reassuring responses during what may be a stressful medical situation

Key app features you can guide users on:
1. Location search — type a neighborhood/city name and click Teleport to center the map
​2. GPS button — auto-detects their current location
3. Medicine search box — type medicines comma-separated (e.g., "Crocin 1 strip, Dolo 650")
4. Scan Rx — upload a prescription photo, Gemini AI extracts medicine names automatically
5. Map markers — click any pharmacy pin, then "Ping Pharmacist" to check stock in real-time
6. Medicine chips — after scanning, tap to select/deselect which medicines to search for

Rules:
- Keep responses concise (2-4 sentences max unless explaining something complex)
- Never diagnose conditions or tell someone what medicine to take for a symptom
- If someone describes a medical emergency, immediately tell them to call 112 (India emergency) or go to the nearest hospital
- You can explain what a medicine generally treats (e.g., "Crocin is a common paracetamol painkiller/fever reducer") but always add "consult your doctor or pharmacist"
- Be warm, human, and calm — users may be stressed
- If asked about medicine availability, remind them to use the map ping feature for real-time stock
- Respond in the same language the user writes in (Hindi/English mix is fine)

Do NOT:
- Recommend specific dosages
- Say you are Claude or made by Anthropic — you are Sanjeevani by Sanjeevani
- Make up pharmacy locations or medicine prices`;

// FIX 1: Added a default empty array so it never crashes if undefined
export default function AIChatbot({ selectedMeds = [] }: AIChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! I'm **Sanjee**, your Sanjeevani health assistant 👋\n\nI can help you find medicines, explain how to use this app, or answer quick medicine questions. What do you need?"
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [messages, isOpen]);

  const buildContextualSystemPrompt = () => {
    // FIX 2: Bulletproof safety check before checking length
    if (!selectedMeds || selectedMeds.length === 0) return SYSTEM_PROMPT;
    return `${SYSTEM_PROMPT}\n\nCurrent context: The user is currently searching for these medicines on the map: ${selectedMeds.join(', ')}. If relevant, you can reference this.`;
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const newMessages: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_prompt: buildContextualSystemPrompt(),
          messages: newMessages,
        }),
      });

      if (response.status === 429) {
        throw new Error("RATE_LIMIT");
      }

      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json();
      const reply = data.reply ?? "Sorry, I couldn't get a response. Please try again.";

      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (err: any) {
      console.error('Chatbot error:', err);
      
      if (err.message === "RATE_LIMIT") {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: "You are sending messages too fast. Please wait 60 seconds."
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: "Sorry, I'm having trouble connecting to the backend right now. Please try again in a moment."
        }]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim()) {
        sendMessage();
      }
    }
  };

  const renderMessage = (content: string) => {
    const parts = content.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return part.split('\n').map((line, j) => (
        <span key={`${i}-${j}`}>{line}{j < part.split('\n').length - 1 && <br />}</span>
      ));
    });
  };

  return (
    <>
      {/* ── FLOATING BUTTON ── */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        aria-label="Open AI assistant"
        className="fixed bottom-6 right-6 z-[9998] w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95"
        style={{
          background: 'linear-gradient(135deg, #0ea5e9, #10b981)',
          boxShadow: '0 8px 32px rgba(14,165,233,0.45), 0 0 0 1px rgba(56,189,248,0.2)',
        }}
      >
        {isOpen
          ? <X size={22} className="text-white" />
          : <MessageCircle size={22} className="text-white" />
        }
        {!isOpen && (
          <span className="absolute top-1 right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white animate-pulse" />
        )}
      </button>

      {/* ── CHAT PANEL ── */}
      <div
        className="fixed bottom-24 right-6 z-[9997] w-[360px] max-w-[calc(100vw-2rem)] flex flex-col rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 origin-bottom-right"
        style={{
          opacity: isOpen ? 1 : 0,
          transform: isOpen ? 'scale(1) translateY(0)' : 'scale(0.92) translateY(12px)',
          pointerEvents: isOpen ? 'auto' : 'none',
          background: 'rgba(6,14,28,0.97)',
          border: '1px solid rgba(56,189,248,0.18)',
          backdropFilter: 'blur(24px)',
          maxHeight: '520px',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0"
             style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.15), rgba(16,185,129,0.10))', borderBottom: '1px solid rgba(56,189,248,0.12)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                 style={{ background: 'linear-gradient(135deg, #0ea5e9, #10b981)' }}>
              <Bot size={16} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Sanjeevani AI</div>
              <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                Online · Sanjeevani Assistant
              </div>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-slate-300 transition-colors p-1">
            <Minimize2 size={16} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0"
             style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(56,189,248,0.2) transparent' }}>
          {messages.map((msg, i) => (
            <div key={i} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mb-0.5"
                     style={{ background: 'linear-gradient(135deg, #0ea5e9, #10b981)' }}>
                  <Bot size={12} className="text-white" />
                </div>
              )}
              <div
                className="max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed"
                style={msg.role === 'user'
                  ? { background: 'linear-gradient(135deg, #0ea5e9, #06b6d4)', color: 'white', borderBottomRightRadius: '4px' }
                  : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#cbd5e1', borderBottomLeftRadius: '4px' }
                }
              >
                {renderMessage(msg.content)}
              </div>
              {msg.role === 'user' && (
                <div className="w-6 h-6 rounded-lg bg-slate-700 flex items-center justify-center shrink-0 mb-0.5">
                  <User size={12} className="text-slate-300" />
                </div>
              )}
            </div>
          ))}

          {/* Loading dots */}
          {isLoading && (
            <div className="flex items-end gap-2 justify-start">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                   style={{ background: 'linear-gradient(135deg, #0ea5e9, #10b981)' }}>
                <Bot size={12} className="text-white" />
              </div>
              <div className="px-4 py-3 rounded-2xl rounded-bl-sm"
                   style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex gap-1 items-center">
                  {[0, 1, 2].map(d => (
                    <span key={d} className="w-1.5 h-1.5 rounded-full bg-sky-400"
                          style={{ animation: `bounce 1.2s ease-in-out ${d * 0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick prompts */}
        {messages.length === 1 && (
          <div className="px-4 pb-2 flex flex-wrap gap-2">
            {[
              'How do I scan a prescription?',
              'What does Crocin treat?',
              'How do I ping a pharmacist?',
            ].map(prompt => (
              <button
                key={prompt}
                onClick={() => { setInput(prompt); inputRef.current?.focus(); }}
                className="text-xs px-3 py-1.5 rounded-full transition-all hover:scale-105"
                style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(56,189,248,0.2)', color: '#7dd3fc' }}
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="px-3 pb-3 pt-2 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2 rounded-xl px-3 py-2"
               style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(56,189,248,0.15)' }}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Sanjeevani anything..."
              className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-40 hover:scale-110 active:scale-95"
              style={{ background: 'linear-gradient(135deg, #0ea5e9, #10b981)' }}
            >
              <Send size={13} className="text-white" />
            </button>
          </div>
          <p className="text-center text-[10px] text-slate-600 mt-1.5">
            Sanjeevani AI · Not a substitute for medical advice
          </p>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30%            { transform: translateY(-5px); }
        }
      `}</style>
    </>
  );
}