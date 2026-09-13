import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, HelpCircle } from 'lucide-react';
import { ChatMessage, CategoryId } from '../types';

interface ChatRoomProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isLoading: boolean;
  onSelectCategory: (catId: CategoryId) => void;
}

const DEFAULT_QUICK_PROMPTS = [
  '주말 첫 데이트에 어울리는 깔끔한 룩 추천해줘',
  '매일 출근할 때 입기 좋은 편안한 비즈니스 캐주얼',
  '대학 캠퍼스에서 입을 트렌디한 시티보이/캐주얼',
  '체형을 보완하면서 다리가 길어 보이는 와이드핏 코디',
];

export const ChatRoom: React.FC<ChatRoomProps> = ({
  messages,
  onSendMessage,
  isLoading,
  onSelectCategory,
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handlePromptClick = (prompt: string) => {
    if (isLoading) return;
    onSendMessage(prompt);
  };

  return (
    <div className="flex flex-col h-full bg-neutral-900/40 rounded-2xl border border-neutral-800/80 overflow-hidden">
      {/* Chat header banner */}
      <div className="px-4 py-3 border-b border-neutral-800/80 bg-neutral-900/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-neutral-200">
            AI 스타일리스트 실시간 상담실
          </span>
        </div>
        <span className="text-[11px] text-neutral-500">
          대화할수록 카테고리 추천이 정교해집니다
        </span>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
        {messages.map((msg) => {
          const isAssistant = msg.sender === 'assistant';
          return (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-[90%] sm:max-w-[80%] ${
                isAssistant ? 'self-start' : 'self-end ml-auto flex-row-reverse'
              }`}
            >
              {/* Avatar */}
              <div
                className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-xs font-bold ${
                  isAssistant
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-neutral-800 text-neutral-300 border border-neutral-700'
                }`}
              >
                {isAssistant ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>

              {/* Message Bubble */}
              <div className="space-y-2">
                <div
                  className={`p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                    isAssistant
                      ? 'bg-neutral-900 border border-neutral-800 text-neutral-200 shadow-sm'
                      : 'bg-amber-600/90 text-neutral-50 font-medium'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>

                {/* Suggested Follow-up chips if provided by AI */}
                {isAssistant && msg.suggestedPrompts && msg.suggestedPrompts.length > 0 && (
                  <div className="pt-1 flex flex-wrap gap-1.5">
                    {msg.suggestedPrompts.map((prompt, idx) => (
                      <button
                        key={idx}
                        id={`suggested-prompt-${idx}`}
                        onClick={() => handlePromptClick(prompt)}
                        disabled={isLoading}
                        className="text-[11px] px-2.5 py-1 rounded-full bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 hover:text-amber-300 border border-neutral-700/60 hover:border-amber-500/40 transition-all text-left"
                      >
                        ↳ {prompt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading Bubble */}
        {isLoading && (
          <div className="flex gap-3 max-w-[80%] self-start">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0 flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-3.5 rounded-2xl bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
              <span>스타일리스트가 스타일을 분석하고 있습니다...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested initial quick prompts if conversation is early */}
      {messages.length <= 2 && (
        <div className="px-4 py-2 border-t border-neutral-800/60 bg-neutral-900/30">
          <div className="text-[11px] text-neutral-400 mb-1.5 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>추천 시작 질문:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DEFAULT_QUICK_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handlePromptClick(prompt)}
                disabled={isLoading}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-neutral-100 border border-neutral-800 hover:border-neutral-700 transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input form */}
      <div className="p-3 sm:p-4 border-t border-neutral-800/80 bg-neutral-950/60">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            ref={inputRef}
            id="chat-input"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="스타일 취향, 입고 갈 장소, 원하는 분위기를 자유롭게 입력하세요..."
            disabled={isLoading}
            className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40 transition-all disabled:opacity-50"
          />
          <button
            id="chat-send-btn"
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-neutral-800 text-neutral-950 disabled:text-neutral-500 font-semibold rounded-xl text-xs sm:text-sm flex items-center gap-1.5 transition-all cursor-pointer disabled:cursor-not-allowed shadow-sm"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">전송</span>
          </button>
        </form>
      </div>
    </div>
  );
};
