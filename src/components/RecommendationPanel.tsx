import React from 'react';
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Send,
  ExternalLink,
  Tag,
  Palette,
  Compass,
  ArrowRight,
} from 'lucide-react';
import {
  CategoryId,
  RecommendationResponse,
  CategoryReadiness,
} from '../types';
import { CATEGORIES } from './CategoryBar';

interface RecommendationPanelProps {
  selectedCategory: CategoryId | null;
  recommendation: RecommendationResponse | null;
  isLoading: boolean;
  onRefreshRecommendation: (catId: CategoryId) => void;
  onAskInChat: (prompt: string) => void;
  onSelectCategory: (catId: CategoryId) => void;
}

export const RecommendationPanel: React.FC<RecommendationPanelProps> = ({
  selectedCategory,
  recommendation,
  isLoading,
  onRefreshRecommendation,
  onAskInChat,
  onSelectCategory,
}) => {
  if (!selectedCategory) {
    return (
      <div className="h-full bg-neutral-900/40 rounded-2xl border border-neutral-800/80 p-8 flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-neutral-800/80 border border-neutral-700/60 flex items-center justify-center text-amber-400 mb-4">
          <Compass className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-neutral-200 mb-2">
          원하는 카테고리를 선택하세요
        </h3>
        <p className="text-xs text-neutral-400 max-w-sm leading-relaxed mb-6">
          상단의 <strong className="text-neutral-200">상의, 하의, 신발, 악세사리</strong> 등 카테고리를 클릭하면 대화한 내용을 바탕으로 맞춤 옷을 추천해 드립니다.
        </p>

        <div className="grid grid-cols-3 gap-2 max-w-md w-full">
          {CATEGORIES.slice(0, 3).map((c) => (
            <button
              key={c.id}
              onClick={() => onSelectCategory(c.id)}
              className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-amber-500/50 hover:bg-neutral-850 text-xs text-neutral-300 flex items-center justify-center gap-1.5 transition-all"
            >
              {c.icon}
              <span>{c.label} 추천</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const categoryMeta = CATEGORIES.find((c) => c.id === selectedCategory);
  const readiness = recommendation?.readiness;
  const isSufficient = readiness?.isSufficient ?? false;

  return (
    <div className="h-full bg-neutral-900/40 rounded-2xl border border-neutral-800/80 flex flex-col overflow-hidden">
      {/* Top Header */}
      <div className="p-4 border-b border-neutral-800/80 bg-neutral-900/90 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
            {categoryMeta?.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-neutral-100">
                {categoryMeta?.label} 스타일링 추천
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono">
                {categoryMeta?.sublabel}
              </span>
            </div>
            <p className="text-[11px] text-neutral-400">
              {categoryMeta?.defaultDescription}
            </p>
          </div>
        </div>

        {/* Action button */}
        <button
          id="btn-refresh-recommendation"
          onClick={() => onRefreshRecommendation(selectedCategory)}
          disabled={isLoading}
          className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-750 text-neutral-300 text-xs flex items-center gap-1.5 border border-neutral-700/60 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>다시 추천받기</span>
        </button>
      </div>

      {/* Main Content scroll area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
        {/* Readiness Status Banner */}
        {readiness && (
          <div
            className={`p-3.5 rounded-xl border text-xs ${
              isSufficient
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                : 'bg-neutral-900 border-neutral-700/80 text-neutral-300'
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 font-bold">
                {isSufficient ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-amber-400" />
                    <span>대화 분석 기반 맞춤 추천 ({readiness.readinessScore}%)</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-neutral-400" />
                    <span className="text-neutral-300">
                      정보 부족 상태 (회색빛 표시 중 - {readiness.readinessScore}%)
                    </span>
                  </>
                )}
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
                {readiness.statusText}
              </span>
            </div>

            <p className="leading-relaxed text-neutral-300 text-[11px] mb-2.5">
              {recommendation?.overviewAdvice}
            </p>

            {/* If info is insufficient, show what's missing & 1-click helper buttons */}
            {!isSufficient && readiness.missingFields.length > 0 && (
              <div className="mt-2 pt-2.5 border-t border-neutral-800/80 space-y-2">
                <div className="flex flex-wrap items-center gap-1 text-[11px]">
                  <span className="text-neutral-400 font-medium">부족한 정보:</span>
                  {readiness.missingFields.map((f, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700 text-[10px]"
                    >
                      {f}
                    </span>
                  ))}
                </div>

                {recommendation?.followUpQuestions && recommendation.followUpQuestions.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[11px] text-amber-400/90 font-medium">
                      💡 클릭하여 대화창에 취향 알려주기:
                    </span>
                    <div className="flex flex-col gap-1">
                      {recommendation.followUpQuestions.map((q, idx) => (
                        <button
                          key={idx}
                          onClick={() => onAskInChat(q)}
                          className="text-left text-[11px] px-2.5 py-1 rounded bg-neutral-800/60 hover:bg-neutral-800 text-neutral-300 hover:text-amber-300 border border-neutral-700/50 transition-colors flex items-center justify-between group"
                        >
                          <span>{q}</span>
                          <Send className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-amber-400" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mb-3">
              <Sparkles className="w-5 h-5 animate-spin" />
            </div>
            <p className="text-xs font-semibold text-neutral-200">
              대화 내용을 종합하여 {categoryMeta?.label} 아이템을 선별하고 있습니다...
            </p>
            <p className="text-[11px] text-neutral-400 mt-1">
              소재감, 실루엣, 컬러 매칭 밸런스를 계산하는 중입니다.
            </p>
          </div>
        )}

        {/* Recommended Items Grid */}
        {!isLoading && recommendation && recommendation.items.length > 0 && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between text-xs text-neutral-400 font-semibold px-1">
              <span>추천 아이템 컬렉션 ({recommendation.items.length})</span>
              <span className="text-[11px] text-neutral-500">
                아이템 클릭 시 상세 스타일링 가이드 확인
              </span>
            </div>

            {recommendation.items.map((item, idx) => (
              <div
                key={item.id || idx}
                className="bg-neutral-900 border border-neutral-800 hover:border-neutral-700/80 rounded-xl p-4 transition-all duration-200 space-y-3 shadow-sm"
              >
                {/* Item Top: Title, Confidence, Subtitle */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-neutral-100">
                        {item.name}
                      </h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 font-mono">
                        #{idx + 1}
                      </span>
                    </div>
                    <p className="text-xs text-amber-400/90 font-medium mt-0.5">
                      {item.subtitle}
                    </p>
                  </div>

                  {/* Confidence pill */}
                  <div className="shrink-0 text-right">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      매칭률 {item.confidence}%
                    </span>
                  </div>
                </div>

                {/* Color & Material Details */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs bg-neutral-950/60 p-2.5 rounded-lg border border-neutral-800/80">
                  {/* Color Swatch */}
                  <div className="flex items-center gap-2">
                    <span
                      className="w-4 h-4 rounded-full border border-neutral-600 shrink-0 shadow-inner"
                      style={{ backgroundColor: item.colorHex || '#666' }}
                    />
                    <div>
                      <span className="text-[10px] text-neutral-400 block">추천 컬러</span>
                      <span className="text-neutral-200 font-medium text-[11px]">
                        {item.colorName}
                      </span>
                    </div>
                  </div>

                  {/* Material */}
                  <div>
                    <span className="text-[10px] text-neutral-400 block">소재감</span>
                    <span className="text-neutral-200 font-medium text-[11px] truncate block">
                      {item.material}
                    </span>
                  </div>

                  {/* Fit */}
                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-neutral-400 block">실루엣/핏</span>
                    <span className="text-neutral-200 font-medium text-[11px]">
                      {item.fit}
                    </span>
                  </div>
                </div>

                {/* Tips & Pairing Advice */}
                <div className="space-y-1.5 text-xs">
                  <div className="p-2.5 rounded-lg bg-neutral-800/50 border border-neutral-800 text-neutral-300 leading-relaxed">
                    <strong className="text-amber-400 font-semibold mr-1.5">
                      스타일링 팁:
                    </strong>
                    {item.stylingTip}
                  </div>

                  <div className="p-2.5 rounded-lg bg-neutral-800/30 border border-neutral-800 text-neutral-400 leading-relaxed">
                    <strong className="text-neutral-200 font-semibold mr-1.5">
                      매칭 조언:
                    </strong>
                    {item.pairingAdvice}
                  </div>
                </div>

                {/* Tags & Action */}
                <div className="pt-2 border-t border-neutral-800/60 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1">
                    {item.tags?.map((tag, tIdx) => (
                      <span
                        key={tIdx}
                        className="text-[10px] px-2 py-0.5 rounded bg-neutral-800 text-neutral-400"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Ask AI in chat about this item */}
                  <button
                    onClick={() =>
                      onAskInChat(
                        `방금 추천받은 '${item.name}'(${item.colorName})에 어울리는 다른 코디 아이템과 스타일링 팁을 더 자세히 알려줘!`
                      )
                    }
                    className="text-[11px] px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-750 text-amber-400 hover:text-amber-300 font-medium border border-neutral-700/60 flex items-center gap-1 transition-colors"
                  >
                    <span>이 옷으로 대화 이어가기</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
