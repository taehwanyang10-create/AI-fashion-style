import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { CategoryBar, CATEGORIES } from './components/CategoryBar';
import { ChatRoom } from './components/ChatRoom';
import { RecommendationPanel } from './components/RecommendationPanel';
import {
  CategoryId,
  ChatMessage,
  UserStyleProfile,
  CategoryReadiness,
  RecommendationResponse,
} from './types';
import { MessageSquare, Sparkles } from 'lucide-react';

const INITIAL_READINESS: Record<CategoryId, CategoryReadiness> = {
  top: {
    categoryId: 'top',
    readinessScore: 25,
    isSufficient: false, // 회색빛 상태
    statusText: '정보 수집 중',
    missingFields: ['상황(TPO)', '선호 핏/무드', '색상 취향'],
    collectedHighlights: [],
  },
  bottom: {
    categoryId: 'bottom',
    readinessScore: 20,
    isSufficient: false, // 회색빛 상태
    statusText: '정보 수집 중',
    missingFields: ['상황(TPO)', '선호 실루엣(와이드/슬림)', '소재'],
    collectedHighlights: [],
  },
  outer: {
    categoryId: 'outer',
    readinessScore: 15,
    isSufficient: false, // 회색빛 상태
    statusText: '정보 수집 중',
    missingFields: ['계절/날씨', '원하는 두께감', '아우터 무드'],
    collectedHighlights: [],
  },
  shoes: {
    categoryId: 'shoes',
    readinessScore: 20,
    isSufficient: false, // 회색빛 상태
    statusText: '정보 수집 중',
    missingFields: ['착용 장소', '선호 스타일(스니커즈/구두)'],
    collectedHighlights: [],
  },
  accessory: {
    categoryId: 'accessory',
    readinessScore: 15,
    isSufficient: false, // 회색빛 상태
    statusText: '정보 수집 중',
    missingFields: ['포인트 아이템 취향(가방/모자/주얼리)'],
    collectedHighlights: [],
  },
  full: {
    categoryId: 'full',
    readinessScore: 20,
    isSufficient: false, // 회색빛 상태
    statusText: '정보 수집 중',
    missingFields: ['전체 스타일 무드', 'TPO', '컬러 조화'],
    collectedHighlights: [],
  },
};

const INITIAL_GREETING: ChatMessage = {
  id: 'msg-init-1',
  sender: 'assistant',
  text: `안녕하세요! 당신의 전담 1:1 AI 패션 스타일리스트입니다. ✨\n\n어떤 자리에 입고 갈 옷을 찾으시나요? 평소 즐겨 입는 스타일이나 원하는 분위기(미니멀, 캐주얼, 스트릿, 댄디 등), 선호하는 핏과 색상을 편하게 말씀해 주세요.\n\n📌 상단의 [상의, 하의, 아우터, 신발, 악세사리, 전체 코디] 카테고리는 대화 도중 어느 때라도 클릭하실 수 있습니다! 아직 정보가 충분하지 않은 항목은 회색빛으로 표시되며, 대화를 나눌수록 분석 정확도가 올라가 맞춤 아이템으로 진화합니다.`,
  timestamp: Date.now(),
  suggestedPrompts: [
    '이번 주말 첫 데이트에 어울리는 단정한 룩 추천해줘',
    '출퇴근용으로 편안하면서 깔끔한 비즈니스 캐주얼',
    '체형을 보완해주는 세미오버핏 & 와이드 팬츠 스타일',
    '평소에 무채색이나 뉴트럴 톤을 즐겨 입어',
  ],
};

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_GREETING]);
  const [profile, setProfile] = useState<UserStyleProfile>({});
  const [readinessMap, setReadinessMap] =
    useState<Record<CategoryId, CategoryReadiness>>(INITIAL_READINESS);
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('top');
  const [recommendations, setRecommendations] = useState<
    Record<CategoryId, RecommendationResponse | null>
  >({
    top: null,
    bottom: null,
    outer: null,
    shoes: null,
    accessory: null,
    full: null,
  });

  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [isLoadingRecommendation, setIsLoadingRecommendation] = useState(false);
  const [showProfileSummary, setShowProfileSummary] = useState(false);
  const [mobileTab, setMobileTab] = useState<'chat' | 'recommendation'>('chat');

  // Fetch recommendation for a specific category
  const fetchRecommendation = useCallback(
    async (
      catId: CategoryId,
      currentMsgs: ChatMessage[],
      currentProf: UserStyleProfile,
      currentReady: Record<CategoryId, CategoryReadiness>
    ) => {
      setIsLoadingRecommendation(true);
      try {
        const res = await fetch('/api/recommend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            categoryId: catId,
            messages: currentMsgs.map((m) => ({ sender: m.sender, text: m.text })),
            profile: currentProf,
            currentReadiness: currentReady[catId],
          }),
        });
        if (res.ok) {
          const data: RecommendationResponse = await res.json();
          setRecommendations((prev) => ({
            ...prev,
            [catId]: data,
          }));
        }
      } catch (err) {
        console.error('Failed to fetch recommendation:', err);
      } finally {
        setIsLoadingRecommendation(false);
      }
    },
    []
  );

  // Initial recommendation fetch for 'top' on load so user sees it right away
  useEffect(() => {
    fetchRecommendation('top', [INITIAL_GREETING], {}, INITIAL_READINESS);
  }, [fetchRecommendation]);

  // Handle clicking a category button at any time
  const handleSelectCategory = (catId: CategoryId) => {
    setSelectedCategory(catId);
    setMobileTab('recommendation');

    // Fetch recommendation for this category using current conversation & readiness
    fetchRecommendation(catId, messages, profile, readinessMap);
  };

  // Handle sending a chat message
  const handleSendMessage = async (text: string) => {
    const userMsg: ChatMessage = {
      id: `msg-user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: Date.now(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsLoadingChat(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ sender: m.sender, text: m.text })),
          currentProfile: profile,
        }),
      });

      if (res.ok) {
        const data = await res.json();

        const assistantMsg: ChatMessage = {
          id: `msg-asst-${Date.now()}`,
          sender: 'assistant',
          text: data.reply,
          timestamp: Date.now(),
          suggestedPrompts: data.suggestedPrompts,
        };

        const updatedMessages = [...newMessages, assistantMsg];
        setMessages(updatedMessages);

        if (data.profile) {
          setProfile(data.profile);
        }

        if (data.readiness) {
          setReadinessMap(data.readiness);

          // If a category is currently open, refresh its recommendations with new context!
          if (selectedCategory) {
            fetchRecommendation(
              selectedCategory,
              updatedMessages,
              data.profile || profile,
              data.readiness
            );
          }
        }
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setIsLoadingChat(false);
    }
  };

  // Handle Reset
  const handleReset = () => {
    if (window.confirm('대화와 스타일 분석 정보를 처음 상태로 초기화할까요?')) {
      setMessages([INITIAL_GREETING]);
      setProfile({});
      setReadinessMap(INITIAL_READINESS);
      setSelectedCategory('top');
      setRecommendations({
        top: null,
        bottom: null,
        outer: null,
        shoes: null,
        accessory: null,
        full: null,
      });
      fetchRecommendation('top', [INITIAL_GREETING], {}, INITIAL_READINESS);
    }
  };

  const currentRecommendation = selectedCategory
    ? recommendations[selectedCategory]
    : null;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col selection:bg-amber-500/20">
      {/* 1. Global Header */}
      <Header
        profile={profile}
        onReset={handleReset}
        showProfileSummary={showProfileSummary}
        onToggleProfileSummary={() => setShowProfileSummary((prev) => !prev)}
      />

      {/* 2. Prominent Category Bar (Always visible from the start, grayed-out when lacking info) */}
      <CategoryBar
        readinessMap={readinessMap}
        selectedCategory={selectedCategory}
        onSelectCategory={handleSelectCategory}
        isLoadingRecommendation={isLoadingRecommendation}
      />

      {/* Mobile Tab Switcher (visible on smaller screens) */}
      <div className="lg:hidden border-b border-neutral-800 bg-neutral-900/60 p-2 flex gap-2">
        <button
          onClick={() => setMobileTab('chat')}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
            mobileTab === 'chat'
              ? 'bg-amber-500 text-neutral-950 shadow'
              : 'bg-neutral-850 text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>스타일리스트 대화</span>
        </button>

        <button
          onClick={() => setMobileTab('recommendation')}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
            mobileTab === 'recommendation'
              ? 'bg-amber-500 text-neutral-950 shadow'
              : 'bg-neutral-850 text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>
            {CATEGORIES.find((c) => c.id === selectedCategory)?.label || '카테고리'}{' '}
            추천
          </span>
        </button>
      </div>

      {/* 3. Main Workspace: Chat on Left, Recommendations on Right */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 overflow-hidden">
        {/* Left Column: AI Stylist Chat (takes 6 cols on lg) */}
        <section
          className={`lg:col-span-6 h-[680px] lg:h-[calc(100vh-250px)] min-h-[500px] flex flex-col ${
            mobileTab === 'chat' ? 'block' : 'hidden lg:flex'
          }`}
        >
          <ChatRoom
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoadingChat}
            onSelectCategory={handleSelectCategory}
          />
        </section>

        {/* Right Column: Recommendation Showcase for Selected Category (takes 6 cols on lg) */}
        <section
          className={`lg:col-span-6 h-[680px] lg:h-[calc(100vh-250px)] min-h-[500px] flex flex-col ${
            mobileTab === 'recommendation' ? 'block' : 'hidden lg:flex'
          }`}
        >
          <RecommendationPanel
            selectedCategory={selectedCategory}
            recommendation={currentRecommendation}
            isLoading={isLoadingRecommendation}
            onRefreshRecommendation={(catId) =>
              fetchRecommendation(catId, messages, profile, readinessMap)
            }
            onAskInChat={(prompt) => {
              handleSendMessage(prompt);
              setMobileTab('chat');
            }}
            onSelectCategory={handleSelectCategory}
          />
        </section>
      </main>
    </div>
  );
}
