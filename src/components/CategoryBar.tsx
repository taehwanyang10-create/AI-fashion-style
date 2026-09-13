import React from 'react';
import {
  Shirt,
  Scissors,
  Layers,
  Footprints,
  Watch,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { CategoryId, CategoryReadiness } from '../types';

interface CategoryBarProps {
  readinessMap: Record<CategoryId, CategoryReadiness>;
  selectedCategory: CategoryId | null;
  onSelectCategory: (catId: CategoryId) => void;
  isLoadingRecommendation: boolean;
}

interface CategoryMeta {
  id: CategoryId;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  defaultDescription: string;
}

export const CATEGORIES: CategoryMeta[] = [
  {
    id: 'top',
    label: '상의',
    sublabel: 'Tops',
    icon: <Shirt className="w-4 h-4" />,
    defaultDescription: '셔츠, 니트, 티셔츠, 맨투맨',
  },
  {
    id: 'bottom',
    label: '하의',
    sublabel: 'Bottoms',
    icon: <Scissors className="w-4 h-4 rotate-90" />,
    defaultDescription: '슬랙스, 데님, 와이드 팬츠',
  },
  {
    id: 'outer',
    label: '아우터',
    sublabel: 'Outerwear',
    icon: <Layers className="w-4 h-4" />,
    defaultDescription: '자켓, 블레이저, 가디건, 블루종',
  },
  {
    id: 'shoes',
    label: '신발',
    sublabel: 'Shoes',
    icon: <Footprints className="w-4 h-4" />,
    defaultDescription: '스니커즈, 더비슈즈, 로퍼',
  },
  {
    id: 'accessory',
    label: '악세사리',
    sublabel: 'Accessories',
    icon: <Watch className="w-4 h-4" />,
    defaultDescription: '가방, 모자, 벨트, 주얼리',
  },
  {
    id: 'full',
    label: '전체 코디',
    sublabel: 'Full Look',
    icon: <Sparkles className="w-4 h-4" />,
    defaultDescription: '조화로운 토탈 코디네이션',
  },
];

export const CategoryBar: React.FC<CategoryBarProps> = ({
  readinessMap,
  selectedCategory,
  onSelectCategory,
  isLoadingRecommendation,
}) => {
  return (
    <section className="w-full bg-neutral-950/60 border-b border-neutral-800/80 p-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        {/* Section Header with status reminder */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              실시간 카테고리 추천 허브
            </span>
            <span className="text-[11px] text-neutral-500 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
              대화 중 언제든 클릭 가능
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-neutral-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-neutral-700 inline-block border border-neutral-600"></span>
              <span className="text-neutral-400">회색: 정보 부족 (기본 추천)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
              <span className="text-amber-400 font-medium">밝은 톤: 맞춤 분석 완료</span>
            </span>
          </div>
        </div>

        {/* Categories Grid (6 categories present from the very start) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {CATEGORIES.map((cat) => {
            const readiness = readinessMap[cat.id] || {
              categoryId: cat.id,
              readinessScore: 20,
              isSufficient: false,
              statusText: '정보 부족',
              missingFields: ['상황', '무드'],
              collectedHighlights: [],
            };

            const isSufficient = readiness.isSufficient;
            const isSelected = selectedCategory === cat.id;
            const score = Math.round(readiness.readinessScore);

            return (
              <button
                key={cat.id}
                id={`category-btn-${cat.id}`}
                onClick={() => onSelectCategory(cat.id)}
                disabled={isLoadingRecommendation && isSelected}
                className={`group relative text-left p-3 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden ${
                  isSelected
                    ? 'ring-2 ring-amber-500 bg-neutral-900 border-amber-500/80 shadow-lg shadow-amber-500/10'
                    : isSufficient
                    ? 'bg-neutral-900/90 border-neutral-700/80 hover:border-neutral-600 hover:bg-neutral-850 text-neutral-200'
                    : // 회색빛 처리: 정보가 충분하지 않을 때 (Grayed-out state)
                      'bg-neutral-900/30 border-neutral-800/60 text-neutral-400 opacity-75 hover:opacity-100 hover:border-neutral-700 hover:bg-neutral-900/60'
                }`}
              >
                {/* Top Row: Icon & Status Badge */}
                <div className="flex items-center justify-between w-full mb-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'bg-amber-500 text-neutral-950 font-bold'
                        : isSufficient
                        ? 'bg-neutral-800 text-amber-300'
                        : 'bg-neutral-800/80 text-neutral-500'
                    }`}
                  >
                    {cat.icon}
                  </div>

                  {/* Readiness status pill */}
                  {isSufficient ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1 font-medium">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      <span>{score}%</span>
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-neutral-800/80 text-neutral-400 border border-neutral-700/60 flex items-center gap-1">
                      <AlertCircle className="w-2.5 h-2.5 text-neutral-400" />
                      <span>{score}% 회색빛</span>
                    </span>
                  )}
                </div>

                {/* Middle: Category Label & Sublabel */}
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className={`text-sm font-bold tracking-tight ${
                        isSelected
                          ? 'text-amber-400'
                          : isSufficient
                          ? 'text-neutral-100'
                          : 'text-neutral-400'
                      }`}
                    >
                      {cat.label}
                    </span>
                    <span className="text-[10px] text-neutral-500 uppercase font-mono">
                      {cat.sublabel}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 line-clamp-1 mt-0.5">
                    {cat.defaultDescription}
                  </p>
                </div>

                {/* Bottom Status text & progress bar */}
                <div className="mt-3 pt-2 border-t border-neutral-800/60 w-full">
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span
                      className={
                        isSufficient
                          ? 'text-amber-300/90 font-medium'
                          : 'text-neutral-400'
                      }
                    >
                      {isSufficient ? '추천 준비완료' : '정보 수집 중...'}
                    </span>
                    <span className="text-neutral-500">{score}%</span>
                  </div>

                  {/* Visual micro progress bar */}
                  <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isSufficient
                          ? 'bg-gradient-to-r from-amber-600 to-amber-400'
                          : 'bg-neutral-600'
                      }`}
                      style={{ width: `${Math.max(score, 8)}%` }}
                    />
                  </div>
                </div>

                {/* Subtle visual badge if grayed out */}
                {!isSufficient && (
                  <div className="absolute top-1 right-1 pointer-events-none">
                    <span className="w-1.5 h-1.5 rounded-full bg-neutral-600 inline-block"></span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
