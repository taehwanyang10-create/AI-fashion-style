export type CategoryId = 'top' | 'bottom' | 'outer' | 'shoes' | 'accessory' | 'full';

export interface CategoryInfo {
  id: CategoryId;
  label: string;
  sublabel: string;
  iconName: string;
  description: string;
}

export interface UserStyleProfile {
  tpo?: string; // 상황 (예: 소개팅, 출근, 캠퍼스)
  vibe?: string; // 분위기/무드 (예: 미니멀, 캐주얼, 스트릿)
  season?: string; // 계절/날씨 (예: 봄/가을, 여름)
  fitPreference?: string; // 핏 선호 (예: 오버핏, 테이퍼드, 슬림)
  colors?: string[]; // 선호 색상
  avoidColors?: string[]; // 기피 색상
  budget?: string; // 예산대 (선택)
  gender?: string; // 성별/선호 스타일링 (남성/여성/젠더리스)
  notes?: string; // 특이사항/취향 메모
}

export interface CategoryReadiness {
  categoryId: CategoryId;
  readinessScore: number; // 0 ~ 100
  isSufficient: boolean; // >= 50
  statusText: string; // e.g. "정보 부족", "기본 파악 완료", "정밀 추천 가능"
  missingFields: string[]; // e.g. ["상황(TPO)", "선호 핏"]
  collectedHighlights: string[]; // e.g. ["미니멀 무드", "오버핏 선호"]
}

export interface RecommendedItem {
  id: string;
  name: string;
  category: CategoryId;
  subtitle: string;
  colorName: string;
  colorHex: string;
  material: string;
  fit: string;
  stylingTip: string;
  pairingAdvice: string;
  tags: string[];
  confidence: number; // 0 ~ 100
  whyRecommended: string;
}

export interface RecommendationResponse {
  categoryId: CategoryId;
  readiness: CategoryReadiness;
  overviewAdvice: string;
  items: RecommendedItem[];
  followUpQuestions: string[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: number;
  suggestedPrompts?: string[];
  readinessUpdate?: Record<CategoryId, number>;
}
