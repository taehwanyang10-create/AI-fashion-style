import React from 'react';
import { Sparkles, RotateCcw, SlidersHorizontal, Info } from 'lucide-react';
import { UserStyleProfile } from '../types';

interface HeaderProps {
  profile: UserStyleProfile;
  onReset: () => void;
  showProfileSummary: boolean;
  onToggleProfileSummary: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  profile,
  onReset,
  showProfileSummary,
  onToggleProfileSummary,
}) => {
  const profileItems = [
    { label: '상황(TPO)', val: profile.tpo },
    { label: '스타일 무드', val: profile.vibe },
    { label: '계절/날씨', val: profile.season },
    { label: '선호 핏', val: profile.fitPreference },
    { label: '색상', val: profile.colors?.join(', ') },
  ].filter((item) => Boolean(item.val));

  return (
    <header className="border-b border-neutral-800/80 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
        {/* Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-neutral-200 p-[1px] flex items-center justify-center shadow-sm">
            <div className="w-full h-full bg-neutral-900 rounded-[11px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-amber-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-neutral-100 tracking-tight">
                AI 패션 스타일리스트
              </h1>
              <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Collab Studio
              </span>
            </div>
            <p className="text-xs text-neutral-400 hidden sm:block">
              AI와 대화하며 실시간 분석으로 상·하의·신발 맞춤 룩을 제안받으세요
            </p>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          {/* Active Profile tags toggle button */}
          <button
            id="btn-toggle-profile"
            onClick={onToggleProfileSummary}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all ${
              showProfileSummary
                ? 'bg-neutral-800 text-amber-400 border-neutral-700'
                : 'bg-neutral-900 text-neutral-300 border-neutral-800 hover:bg-neutral-800'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>분석된 취향</span>
            {profileItems.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-300 text-[10px] flex items-center justify-center font-bold">
                {profileItems.length}
              </span>
            )}
          </button>

          {/* Reset button */}
          <button
            id="btn-reset-chat"
            onClick={onReset}
            title="대화 초기화"
            className="p-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-800 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expandable profile summary bar */}
      {showProfileSummary && (
        <div className="border-t border-neutral-800/60 bg-neutral-900/50 px-4 sm:px-6 py-2.5">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-2 text-xs">
            <span className="text-neutral-400 flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-amber-400" />
              AI가 대화에서 파악한 스타일 태그:
            </span>
            {profileItems.length === 0 ? (
              <span className="text-neutral-500 italic">
                아직 대화가 시작되지 않아 수집된 정보가 없습니다. 대화를 나누면 자동으로 업데이트됩니다.
              </span>
            ) : (
              profileItems.map((item, idx) => (
                <div
                  key={idx}
                  className="px-2.5 py-1 rounded-md bg-neutral-800 border border-neutral-700/60 text-neutral-200 flex items-center gap-1.5"
                >
                  <span className="text-neutral-400 text-[11px]">{item.label}:</span>
                  <span className="font-semibold text-amber-300">{item.val}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </header>
  );
};
