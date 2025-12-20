import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, X, Bot, Sparkles } from 'lucide-react';
import { Message } from '../types';

interface Props {
  onUpdate: (prompt: string) => Promise<void>;
  isGenerating: boolean;
}

export default function Assistant({ onUpdate, isGenerating }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: "Hi! I'm your AI Travel Assistant. Not happy with a specific day? Want to change the restaurant? Just tell me, and I'll update the itinerary instantly.", timestamp: Date.now() }
  ]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userText = input;
    setInput('');
    setLoading(true);
    
    // Add User Message
    const newMessages = [...messages, { role: 'user', text: userText, timestamp: Date.now() } as Message];
    setMessages(newMessages);

    try {
      // Add thinking placeholder
      setMessages(prev => [...prev, { role: 'model', text: 'Thinking and updating your itinerary...', timestamp: Date.now() }]);
      
      // Call Parent Handler (which calls Gemini)
      await onUpdate(userText);

      // Update success message
      setMessages(prev => {
        const sliced = prev.slice(0, -1); // remove thinking
        return [...sliced, { role: 'model', text: "I've updated the itinerary based on your request! Check out the changes above.", timestamp: Date.now() }];
      });
    } catch (error) {
       setMessages(prev => {
        const sliced = prev.slice(0, -1);
        return [...sliced, { role: 'model', text: "Sorry, I encountered an error updating the plan. Please try again.", timestamp: Date.now() }];
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-80 md:w-96 h-[500px] mb-4 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-10 duration-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-brand-600 to-brand-500 p-4 flex justify-between items-center text-white">
            <div className="flex items-center gap-2">
              <div className="bg-white/20 p-1.5 rounded-lg">
                <Sparkles className="w-5 h-5 text-yellow-300" />
              </div>
              <div>
                <h3 className="font-bold text-sm">Travel Assistant</h3>
                <p className="text-xs text-brand-100">AI-Powered Updates</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1 rounded transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div 
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-brand-600 text-white rounded-br-none' 
                      : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="p-3 bg-white border-t border-gray-200">
            <div className="relative flex items-center">
              <input
                type="text"
                className="w-full pl-4 pr-12 py-3 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                placeholder="Ask to change anything..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={loading}
              />
              <button 
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="absolute right-2 p-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:hover:bg-brand-600 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toggle Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="group flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-3 rounded-full shadow-lg transition-all hover:scale-105 active:scale-95"
      >
        <div className="relative">
          <Bot className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
        </div>
        <span className="font-medium pr-1">AI Helper</span>
      </button>
    </div>
  );
}