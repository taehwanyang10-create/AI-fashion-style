import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini client lazily or when API key is available
let aiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Resilient Gemini generator with automatic model fallback for 503 high demand spikes
async function generateContentWithFallback(ai: GoogleGenAI, options: { contents: any; config?: any }) {
  const candidateModels = ['gemini-3.6-flash', 'gemini-3.8-flash'];
  let lastErr: any = null;

  for (const model of candidateModels) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: options.contents,
        config: options.config,
      });
      if (res && res.text) {
        return res;
      }
    } catch (err: any) {
      lastErr = err;
      console.warn(`[AI Stylist] Model ${model} temporarily unavailable, trying alternative model...`);
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
  }

  throw lastErr;
}

// Fallback readiness evaluation based on context keywords when AI is not ready or fails
function evaluateReadinessHeuristic(messages: { sender: string; text: string }[], profile: any) {
  const combined = messages.map(m => m.text).join(' ').toLowerCase();
  
  const hasTPO = Boolean(profile.tpo) || /(데이트|소개팅|출근|회사|오피스|대학|캠퍼스|나들이|여행|모임|결혼식|운동|산책|카페|파티|미팅)/i.test(combined);
  const hasVibe = Boolean(profile.vibe) || /(미니멀|캐주얼|스트릿|댄디|클래식|시크|스포티|아메카지|빈티지|모던|깔끔|힙|단정)/i.test(combined);
  const hasSeason = Boolean(profile.season) || /(봄|여름|가을|겨울|더위|추위|선선|비|쌀쌀|따뜻|환절기)/i.test(combined);
  const hasColor = (profile.colors && profile.colors.length > 0) || /(블랙|화이트|네이비|그레이|베이지|카키|파스텔|무채색|원색|어두운|밝은)/i.test(combined);
  const hasFit = Boolean(profile.fitPreference) || /(오버핏|와이드|슬림|테이퍼드|레귤러|루즈|스탠다드|기장|체형)/i.test(combined);

  // Category specific mentions
  const mentionsTop = /(셔츠|티셔츠|맨투맨|후드|니트|가디건|슬리브|블라우스|상의)/i.test(combined);
  const mentionsBottom = /(청바지|데님|슬랙스|치노|카고|반바지|스커트|바지|하의|와이드팬츠)/i.test(combined);
  const mentionsOuter = /(자켓|코트|패딩|블레이저|점퍼|바람막이|아우터|가디건|점퍼)/i.test(combined);
  const mentionsShoes = /(스니커즈|운동화|로퍼|구두|부츠|더비|샌들|단화|신발)/i.test(combined);
  const mentionsAccessory = /(가방|모자|벨트|목걸이|반지|시계|안경|스카프|악세사리|백팩|크로스백|토트백)/i.test(combined);

  const baseScore = (hasTPO ? 25 : 0) + (hasVibe ? 25 : 0) + (hasSeason ? 15 : 0) + (hasColor ? 15 : 0) + (hasFit ? 10 : 0);

  const calcCat = (catId: string, specificMention: boolean, requiredItems: string[]) => {
    let score = baseScore;
    if (specificMention) score += 20;
    score = Math.min(Math.max(score, 10), 100);

    const isSufficient = score >= 50;
    const missing: string[] = [];
    if (!hasTPO) missing.push('상황/목적(TPO)');
    if (!hasVibe) missing.push('원하는 분위기/무드');
    if (!hasSeason) missing.push('계절/날씨');
    if (!hasColor && !hasFit) missing.push('선호 컬러나 실루엣');

    const statusText = score < 50 
      ? '정보 부족 (대화 필요)' 
      : score < 75 
        ? '기본 파악 완료' 
        : '맞춤 분석 완료';

    return {
      categoryId: catId,
      readinessScore: score,
      isSufficient,
      statusText,
      missingFields: missing,
      collectedHighlights: [
        ...(hasTPO ? ['상황 파악됨'] : []),
        ...(hasVibe ? ['무드 파악됨'] : []),
        ...(specificMention ? ['구체적 취향 언급됨'] : []),
      ],
    };
  };

  return {
    top: calcCat('top', mentionsTop, ['핏', '넥라인', '소재']),
    bottom: calcCat('bottom', mentionsBottom, ['밑단핏', '기장', '소재']),
    outer: calcCat('outer', mentionsOuter, ['두께감', '기장']),
    shoes: calcCat('shoes', mentionsShoes, ['굽', '스타일']),
    accessory: calcCat('accessory', mentionsAccessory, ['포인트 아이템']),
    full: calcCat('full', messages.length >= 3 && baseScore >= 60, ['전체 조화']),
  };
}

// 1. Chat & Profile/Readiness Endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, currentProfile } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const ai = getGemini();

    if (!ai) {
      // Offline/Local intelligent fallback
      const lastUserMsg = messages[messages.length - 1]?.text || '';
      const readiness = evaluateReadinessHeuristic(messages, currentProfile || {});

      let reply = "멋진 패션 스타일을 함께 찾아볼게요! ";
      const missingList: string[] = [];
      if (!currentProfile?.tpo) missingList.push("어떤 상황(출근, 데이트, 캠퍼스 등)");
      if (!currentProfile?.vibe) missingList.push("원하는 스타일 무드(미니멀, 캐주얼, 스트릿 등)");

      if (missingList.length > 0) {
        reply += `현재 ${missingList.join(', ')}에 대해 조금 더 말씀해 주시면 상의, 하의, 신발 등 카테고리별 추천이 훨씬 정밀해져요! 위 카테고리 칸에서 회색빛으로 표시된 항목을 누르면 필요한 정보를 바로 확인하실 수 있습니다.`;
      } else {
        reply += "알려주신 스타일 정보를 바탕으로 카테고리별 추천 준비도가 높아졌습니다. 상단 카테고리 카드를 눌러 맞춤 의상을 확인해보세요!";
      }

      return res.json({
        reply,
        profile: currentProfile || {},
        readiness,
        suggestedPrompts: [
          "이번 주말 편안한 데이트 룩 추천해줘",
          "깔끔하고 단정한 오피스 캐주얼 입고 싶어",
          "평소에 오버핏 와이드 팬츠 자주 입어",
          "밝은 뉴트럴 톤 컬러가 잘 어울릴까?",
        ],
      });
    }

    // Call Gemini to generate chat response + structured JSON metadata
    const chatHistoryPrompt = messages.map(m => `${m.sender === 'user' ? '사용자' : '스타일리스트'}: ${m.text}`).join('\n');

    const systemPrompt = `당신은 친절하고 전문적인 1:1 패션 퍼스널 스타일리스트 AI입니다.
사용자와 자연스럽게 대화하며 사용자의 TPO(상황/목적), 원하는 무드/분위기, 계절/날씨, 선호 핏(오버핏/슬림/와이드 등), 선호/기피 컬러, 체형 고려사항 등을 파악하세요.
답변은 친근하면서도 세련된 패션 감각을 담아 2~4문장으로 명확하게 답변하고, 사용자가 편하게 답할 수 있는 추가 질문을 1개 던져주세요.

또한 다음 카테고리별로 사용자의 정보 수집 충분도(readinessScore: 0~100)와 상태를 냉정하게 평가하세요:
- top (상의)
- bottom (하의)
- outer (아우터)
- shoes (신발)
- accessory (악세사리)
- full (전체 코디)

정보가 전혀 없거나 매우 막연하면 readinessScore는 15~35로 낮게 책정하여 'isSufficient: false' (회색빛 처리)가 되도록 하세요.
구체적인 TPO, 무드, 핏 등이 언급되면 점수를 50 이상(isSufficient: true)으로 올려주세요.

반드시 다음 JSON 스키마 규격으로만 응답하세요.`;

    const response = await generateContentWithFallback(ai, {
      contents: `[대화 내역]\n${chatHistoryPrompt}\n\n현재 프로필: ${JSON.stringify(currentProfile || {})}\n\n위 대화를 바탕으로 스타일리스트 답변과 최신 프로필 및 카테고리별 준비도 점수를 JSON으로 반환하세요.`,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: {
              type: Type.STRING,
              description: '사용자에게 보낼 스타일리스트의 다정하고 전문적인 조언 텍스트',
            },
            suggestedPrompts: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '사용자가 빠르게 누를 수 있는 추천 대화 버튼 3~4개',
            },
            profile: {
              type: Type.OBJECT,
              properties: {
                tpo: { type: Type.STRING, description: '파악된 상황/TPO (예: 주말 데이트, 대학 캠퍼스)' },
                vibe: { type: Type.STRING, description: '파악된 스타일 무드 (예: 미니멀, 시티보이, 캐주얼)' },
                season: { type: Type.STRING, description: '파악된 계절감 (예: 봄/가을, 초여름)' },
                fitPreference: { type: Type.STRING, description: '선호하는 실루엣/핏 (예: 세미오버핏, 와이드)' },
                colors: { type: Type.ARRAY, items: { type: Type.STRING }, description: '선호 색상 목록' },
                gender: { type: Type.STRING, description: '성별 또는 지향 스타일' },
                notes: { type: Type.STRING, description: '추가 취향 특이사항' },
              },
            },
            readiness: {
              type: Type.OBJECT,
              properties: {
                top: {
                  type: Type.OBJECT,
                  properties: {
                    categoryId: { type: Type.STRING },
                    readinessScore: { type: Type.NUMBER, description: '0-100' },
                    isSufficient: { type: Type.BOOLEAN, description: '50 이상이면 true' },
                    statusText: { type: Type.STRING, description: '예: 정보 부족 (대화 필요)' },
                    missingFields: { type: Type.ARRAY, items: { type: Type.STRING } },
                    collectedHighlights: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                  required: ['categoryId', 'readinessScore', 'isSufficient', 'statusText', 'missingFields'],
                },
                bottom: {
                  type: Type.OBJECT,
                  properties: {
                    categoryId: { type: Type.STRING },
                    readinessScore: { type: Type.NUMBER },
                    isSufficient: { type: Type.BOOLEAN },
                    statusText: { type: Type.STRING },
                    missingFields: { type: Type.ARRAY, items: { type: Type.STRING } },
                    collectedHighlights: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                  required: ['categoryId', 'readinessScore', 'isSufficient', 'statusText', 'missingFields'],
                },
                outer: {
                  type: Type.OBJECT,
                  properties: {
                    categoryId: { type: Type.STRING },
                    readinessScore: { type: Type.NUMBER },
                    isSufficient: { type: Type.BOOLEAN },
                    statusText: { type: Type.STRING },
                    missingFields: { type: Type.ARRAY, items: { type: Type.STRING } },
                    collectedHighlights: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                  required: ['categoryId', 'readinessScore', 'isSufficient', 'statusText', 'missingFields'],
                },
                shoes: {
                  type: Type.OBJECT,
                  properties: {
                    categoryId: { type: Type.STRING },
                    readinessScore: { type: Type.NUMBER },
                    isSufficient: { type: Type.BOOLEAN },
                    statusText: { type: Type.STRING },
                    missingFields: { type: Type.ARRAY, items: { type: Type.STRING } },
                    collectedHighlights: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                  required: ['categoryId', 'readinessScore', 'isSufficient', 'statusText', 'missingFields'],
                },
                accessory: {
                  type: Type.OBJECT,
                  properties: {
                    categoryId: { type: Type.STRING },
                    readinessScore: { type: Type.NUMBER },
                    isSufficient: { type: Type.BOOLEAN },
                    statusText: { type: Type.STRING },
                    missingFields: { type: Type.ARRAY, items: { type: Type.STRING } },
                    collectedHighlights: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                  required: ['categoryId', 'readinessScore', 'isSufficient', 'statusText', 'missingFields'],
                },
                full: {
                  type: Type.OBJECT,
                  properties: {
                    categoryId: { type: Type.STRING },
                    readinessScore: { type: Type.NUMBER },
                    isSufficient: { type: Type.BOOLEAN },
                    statusText: { type: Type.STRING },
                    missingFields: { type: Type.ARRAY, items: { type: Type.STRING } },
                    collectedHighlights: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                  required: ['categoryId', 'readinessScore', 'isSufficient', 'statusText', 'missingFields'],
                },
              },
              required: ['top', 'bottom', 'outer', 'shoes', 'accessory', 'full'],
            },
          },
          required: ['reply', 'suggestedPrompts', 'profile', 'readiness'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (error: any) {
    console.warn('[Notice in /api/chat]:', error?.message || error);
    // Return heuristic response on error
    const messages = req.body.messages || [];
    const profile = req.body.currentProfile || {};
    const readiness = evaluateReadinessHeuristic(messages, profile);
    return res.json({
      reply: "말씀해 주신 취향 잘 듣고 있어요! 원하시는 구체적인 핏이나 좋아하는 색상, 그리고 어떤 자리에 입고 가실지 편하게 알려주시면 카테고리별 추천이 더욱 정교해집니다.",
      profile,
      readiness,
      suggestedPrompts: [
        "키와 체형에 어울리는 실루엣 추천해줘",
        "밝고 화사한 뉴트럴 톤으로 입고 싶어",
        "출근할 때와 주말에 모두 활용 가능한 스타일",
      ],
    });
  }
});

// 2. Recommend Items for a Category Endpoint
app.post('/api/recommend', async (req, res) => {
  try {
    const { categoryId, messages, profile, currentReadiness } = req.body;
    if (!categoryId) {
      return res.status(400).json({ error: 'categoryId is required' });
    }

    const ai = getGemini();

    const categoryNames: Record<string, string> = {
      top: '상의 (Tops)',
      bottom: '하의 (Bottoms)',
      outer: '아우터 (Outerwear)',
      shoes: '신발 (Footwear)',
      accessory: '악세사리 (Accessories)',
      full: '전체 코디네이션 (Total Look)',
    };

    const catName = categoryNames[categoryId] || categoryId;
    const conversationSummary = (messages || [])
      .map((m: any) => `${m.sender === 'user' ? '사용자' : '스타일리스트'}: ${m.text}`)
      .join('\n');

    if (!ai) {
      // Intelligent fallback items
      return res.json(getFallbackRecommendations(categoryId, profile, currentReadiness));
    }

    const prompt = `당신은 탑 패션 디렉터이자 퍼스널 쇼퍼입니다.
사용자가 요청한 카테고리: [${catName}] 에 대한 세련된 맞춤 아이템 3개와 전체 스타일링 조언을 제안해주세요.

[대화 내역]
${conversationSummary || '(대화 내역 없음 - 초기 상태)'}

[수집된 사용자 프로필]
${JSON.stringify(profile || {})}

[현재 카테고리 준비도]
${JSON.stringify(currentReadiness || {})}

중요 지침:
1. 정보가 부족한 상태(회색 상태, isSufficient=false)에서 사용자가 눌렀더라도 친절하게 기본 추천 3개를 제공하되, 'overviewAdvice'에 "현재 대화 정보가 적어 대중적인 스타일로 제안드렸어요. 대화에서 TPO나 선호 색상을 알려주시면 더 맞춤형으로 바뀝니다"라는 뉘앙스를 담아주세요.
2. 각 아이템마다 구체적인 컬러(colorName 및 Hex 코드 예: #2B2D42), 소재감, 실루엣(fit), 스타일링 꿀팁(stylingTip), 다른 카테고리와의 매칭 조언(pairingAdvice)을 아주 생생하고 전문적으로 작성해주세요.
3. 한국 트렌드(무신사, 29CM, 컨템포러리 감성)에 부합하는 세련된 아이템명을 부여하세요.`;

    const response = await generateContentWithFallback(ai, {
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            categoryId: { type: Type.STRING },
            overviewAdvice: { type: Type.STRING, description: '전체적인 스타일링 방향성 및 부족했던 점에 대한 친절한 설명' },
            followUpQuestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '더 완벽한 추천을 위해 사용자가 대화창에 보낼 수 있는 제안 질문 2~3개',
            },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING, description: '아이템 명 (예: 소프트 릴렉스드 피마코튼 옥스포드 셔츠)' },
                  subtitle: { type: Type.STRING, description: '한 줄 요약 (예: 자연스러운 체형 보정 & 단정한 무드)' },
                  colorName: { type: Type.STRING, description: '색상 명 (예: 소프트 버터 아이보리)' },
                  colorHex: { type: Type.STRING, description: 'HEX 색상 코드 (예: #F4E8C1)' },
                  material: { type: Type.STRING, description: '소재 (예: 고밀도 바이오워싱 코튼 100%)' },
                  fit: { type: Type.STRING, description: '핏감 (예: 드롭숄더 세미오버핏)' },
                  stylingTip: { type: Type.STRING, description: '전문 스타일링 착용 팁' },
                  pairingAdvice: { type: Type.STRING, description: '다른 하의/신발과의 조합 제안' },
                  tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: '키워드 태그 3~4개' },
                  confidence: { type: Type.NUMBER, description: '추천 매칭 일치도 (0~100)' },
                  whyRecommended: { type: Type.STRING, description: '사용자의 대화 맥락을 반영한 추천 이유' },
                },
                required: ['id', 'name', 'subtitle', 'colorName', 'colorHex', 'material', 'fit', 'stylingTip', 'pairingAdvice', 'tags', 'confidence', 'whyRecommended'],
              },
            },
          },
          required: ['categoryId', 'overviewAdvice', 'followUpQuestions', 'items'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({
      ...parsed,
      readiness: currentReadiness || {
        categoryId,
        readinessScore: 40,
        isSufficient: false,
        statusText: '정보 부족',
        missingFields: ['취향 정보'],
        collectedHighlights: [],
      },
    });
  } catch (error: any) {
    console.warn('[Notice in /api/recommend]:', error?.message || error);
    const { categoryId, profile, currentReadiness } = req.body;
    return res.json(getFallbackRecommendations(categoryId || 'top', profile, currentReadiness));
  }
});

function getFallbackRecommendations(categoryId: string, profile: any, currentReadiness: any) {
  const isSufficient = currentReadiness?.isSufficient ?? false;
  
  const sampleItems: Record<string, any[]> = {
    top: [
      {
        id: 'top-1',
        name: '미니멀 릴렉스드 옥스포드 셔츠',
        subtitle: '단정함과 여유로운 실루엣의 밸런스',
        colorName: '스카이 블루',
        colorHex: '#90CAF9',
        material: '고밀도 컴팩트 코튼 100%',
        fit: '세미 오버핏',
        stylingTip: '소매를 두 겹 롤업하고 슬랙스나 데님 안에 자연스럽게 넣어 연출하세요.',
        pairingAdvice: '차콜 와이드 슬랙스와 더비 슈즈를 매치하면 깔끔한 룩 완성.',
        tags: ['#미니멀', '#데일리', '#체형커버', '#스테디'],
        confidence: isSufficient ? 92 : 65,
        whyRecommended: profile?.vibe || profile?.tpo 
          ? `${profile?.tpo || '일상'}에 잘 어울리는 범용적인 클래식 아이템입니다.` 
          : '기본 정보 수집 전 가장 호불호가 적고 단정한 실루엣으로 추천되었습니다.',
      },
      {
        id: 'top-2',
        name: '헤비웨이트 피케 카라 하프 니트',
        subtitle: '고급스러운 텍스처와 탄탄한 형태감',
        colorName: '오트밀 베이지',
        colorHex: '#D7CEC7',
        material: '워셔블 코튼 아크릴 블렌드',
        fit: '레귤러 릴렉스핏',
        stylingTip: '단추를 하나 풀고 얇은 실버 목걸이로 포인트를 주면 무드가 살아납니다.',
        pairingAdvice: '어두운 톤의 생지 데님이나 테이퍼드 치노 팬츠와 찰떡입니다.',
        tags: ['#단정', '#고급스러움', '#카라니트'],
        confidence: isSufficient ? 88 : 60,
        whyRecommended: '어떤 자리에서도 신뢰감을 주는 안정적인 스타일링이 가능합니다.',
      },
      {
        id: 'top-3',
        name: '소프트 워싱 드롭숄더 롱슬리브',
        subtitle: '편안함과 트렌디한 무드를 동시에',
        colorName: '멜란지 그레이',
        colorHex: '#B0BEC5',
        material: '바이오 코튼 100%',
        fit: '루즈 드롭숄더핏',
        stylingTip: '단독으로 입거나 가벼운 셔츠, 블루종 안에 이너로 레이어드하기 좋습니다.',
        pairingAdvice: '카고 팬츠나 루즈핏 블랙 데님과 매치하여 편안한 감성 연출.',
        tags: ['#캐주얼', '#레이어드', '#편안함'],
        confidence: isSufficient ? 85 : 55,
        whyRecommended: '어디에나 받쳐 입기 좋은 에센셜 데일리 상의입니다.',
      },
    ],
    bottom: [
      {
        id: 'bot-1',
        name: '투턱 와이드 드레이프 슬랙스',
        subtitle: '다리가 길어 보이고 우아한 실루엣',
        colorName: '차콜 그레이',
        colorHex: '#37474F',
        material: 'TR 스판 링클프리',
        fit: '와이드 투턱 스트레이트',
        stylingTip: '신발 위로 브레이크가 자연스럽게 걸리도록 신발과 매치하세요.',
        pairingAdvice: '오버핏 셔츠나 크롭 자켓과 함께하면 다리 비율이 극대화됩니다.',
        tags: ['#비율보정', '#트렌디', '#체형보완'],
        confidence: isSufficient ? 94 : 68,
        whyRecommended: '모든 상의를 세련되게 받쳐주는 현대적인 머스트해브 하의입니다.',
      },
      {
        id: 'bot-2',
        name: '빈티지 페이디드 와이드 데님',
        subtitle: '자연스러운 워싱과 견고한 텍스처',
        colorName: '미디엄 인디고',
        colorHex: '#3F51B5',
        material: '13.5oz 코튼 데님',
        fit: '릴렉스 와이드 레그',
        stylingTip: '흰 티셔츠 하나만 걸쳐도 멋스러운 룩을 연출할 수 있습니다.',
        pairingAdvice: '스니커즈나 독일군 슈즈와 매치하면 캐주얼한 정석 룩.',
        tags: ['#데님', '#데일리', '#캐주얼'],
        confidence: isSufficient ? 90 : 62,
        whyRecommended: '어디에나 매칭하기 쉽고 계절을 타지 않는 스테디셀러입니다.',
      },
      {
        id: 'bot-3',
        name: '원턱 테이퍼드 치노 팬츠',
        subtitle: '단정함과 활동성을 겸비한 핏',
        colorName: '소프트 카키 베이지',
        colorHex: '#C7B198',
        material: '고밀도 코튼 치노',
        fit: '세미 테이퍼드',
        stylingTip: '발목 복사뼈 부근에서 떨어지도록 깔끔한 기장감을 유지하세요.',
        pairingAdvice: '로퍼나 더비 슈즈, 혹은 깔끔한 레더 스니커즈와 잘 어울립니다.',
        tags: ['#클래식', '#출근룩', '#단정함'],
        confidence: isSufficient ? 86 : 58,
        whyRecommended: '단정한 인상을 주는 단단한 실루엣의 팬츠입니다.',
      },
    ],
    outer: [
      {
        id: 'out-1',
        name: '세미오버 싱글 블레이저',
        subtitle: '포멀과 캐주얼을 넘나드는 세련된 외투',
        colorName: '미드나잇 블랙',
        colorHex: '#212121',
        material: '울 블렌드 프리미엄 수트지',
        fit: '세미 오버 드롭숄더',
        stylingTip: '안에 캐주얼한 티셔츠를 입고 청바지와 믹스매치해보세요.',
        pairingAdvice: '슬랙스와 셋업으로 입거나 데님 팬츠와 매치하기 좋습니다.',
        tags: ['#블레이저', '#데이트룩', '#깔끔함'],
        confidence: isSufficient ? 91 : 60,
        whyRecommended: '첫인상을 단번에 깔끔하게 만들어주는 필수 아우터입니다.',
      },
      {
        id: 'out-2',
        name: '미니멀 스탠카라 집업 블루종',
        subtitle: '심플한 라인과 실용적인 디테일',
        colorName: '딥 네이비',
        colorHex: '#1A237E',
        material: '방풍 고밀도 나일론 코튼 블렌드',
        fit: '스탠다드 릴렉스핏',
        stylingTip: '지퍼를 절반쯤 열어 이너웨어와의 배색을 연출하세요.',
        pairingAdvice: '와이드 팬츠와 신발의 색감을 통일하면 센스 있는 코디가 됩니다.',
        tags: ['#블루종', '#미니멀', '#간절기'],
        confidence: isSufficient ? 87 : 57,
        whyRecommended: '간절기 날씨에 가장 실용적이고 스타일리시한 외투입니다.',
      },
      {
        id: 'out-3',
        name: '소프트 오버사이즈 브이넥 가디건',
        subtitle: '부드럽고 포근한 남친/여친룩 무드',
        colorName: '에크루 멜란지',
        colorHex: '#E0D8B0',
        material: '메리노울 블렌드 니트',
        fit: '루즈 오버핏',
        stylingTip: '이너로 흰색 티셔츠나 목폴라를 받쳐 입으면 따뜻한 분위기가 납니다.',
        pairingAdvice: '연청 데님이나 와이드 슬랙스와 따뜻한 무드로 연출.',
        tags: ['#포근함', '#니트가디건', '#데이트룩'],
        confidence: isSufficient ? 84 : 54,
        whyRecommended: '자연스러운 매력과 부드러운 인상을 전달합니다.',
      },
    ],
    shoes: [
      {
        id: 'sho-1',
        name: '클래식 저먼 트레이너 (독일군 스니커즈)',
        subtitle: '어떤 바지와도 실패 없는 궁극의 스니커즈',
        colorName: '화이트 & 그레이 스웨이드',
        colorHex: '#F5F5F5',
        material: '천연 소가죽 + 스웨이드',
        fit: '발볼 여유 있는 스탠다드',
        stylingTip: '슬랙스, 데님, 치노 팬츠 어디에나 가장 자연스럽게 녹아듭니다.',
        pairingAdvice: '와이드 슬랙스의 밑단이 신발 뱀프를 살짝 덮도록 코디하세요.',
        tags: ['#독일군', '#만능신발', '#필수템'],
        confidence: isSufficient ? 95 : 70,
        whyRecommended: '스타일링 입문자와 패션 피플 모두가 사랑하는 필수 아이템입니다.',
      },
      {
        id: 'sho-2',
        name: '라운드토 세미 청키 더비 슈즈',
        subtitle: '캐주얼과 포멀을 모두 만족시키는 레더 슈즈',
        colorName: '매트 블랙',
        colorHex: '#1C1C1C',
        material: '풀그레인 카프스킨',
        fit: '발등 편안한 라운드 라스트',
        stylingTip: '단정한 셋업이나 와이드 팬츠에 무게감을 더해줍니다.',
        pairingAdvice: '차콜 슬랙스 및 블레이저와의 궁합이 탁월합니다.',
        tags: ['#더비슈즈', '#깔끔룩', '#데이트룩'],
        confidence: isSufficient ? 89 : 62,
        whyRecommended: '차려입은 느낌을 확실하게 내주는 든든한 신발입니다.',
      },
      {
        id: 'sho-3',
        name: '레트로 러닝 실루엣 스니커즈',
        subtitle: '스포티한 감성과 탁월한 착화감',
        colorName: '실버 메탈릭 & 화이트',
        colorHex: '#CFD8DC',
        material: '메쉬 & 신세틱 레더',
        fit: '쿠셔닝 강화 컴포트핏',
        stylingTip: '와이드 데님이나 카고 팬츠와 매치해 트렌디한 스트릿 무드를 연출하세요.',
        pairingAdvice: '편안한 오버핏 맨투맨 및 볼캡과 함께 착용.',
        tags: ['#스니커즈', '#편안함', '#고프코어'],
        confidence: isSufficient ? 85 : 55,
        whyRecommended: '오래 걸어야 하는 날에도 스타일과 편안함을 모두 챙길 수 있습니다.',
      },
    ],
    accessory: [
      {
        id: 'acc-1',
        name: '미니멀 레더 크로스 & 숄더백',
        subtitle: '군더더기 없는 실루엣과 컴팩트한 수납',
        colorName: '딥 블랙',
        colorHex: '#111111',
        material: '부드러운 카우하이드 레더',
        fit: '원사이즈 (길이 조절 가능)',
        stylingTip: '몸에 밀착되게 짧게 매치하면 트렌디하고 다리가 길어 보입니다.',
        pairingAdvice: '어두운 상의 위에도 은은한 가죽 광택으로 포인트가 됩니다.',
        tags: ['#가방', '#미니멀', '#포인트'],
        confidence: isSufficient ? 90 : 60,
        whyRecommended: '휴대폰, 지갑, 향수 등을 깔끔하게 휴대하면서 룩의 완성도를 높입니다.',
      },
      {
        id: 'acc-2',
        name: '빈티지 워싱 코튼 볼캡',
        subtitle: '얼굴형을 작아 보이게 해주는 깊은 핏감',
        colorName: '워시드 차콜',
        colorHex: '#424242',
        material: '워싱 코튼 100%',
        fit: '딥 핏 (둘레 조절 가능)',
        stylingTip: '자연스럽게 눌러써서 편안하고 여유로운 분위기를 연출하세요.',
        pairingAdvice: '가디건이나 블루종 등 캐주얼 외투와 훌륭한 밸런스를 이룹니다.',
        tags: ['#볼캡', '#모자', '#캐주얼'],
        confidence: isSufficient ? 86 : 56,
        whyRecommended: '스타일링이 밋밋할 때 즉각적으로 힙한 무드를 더해줍니다.',
      },
      {
        id: 'acc-3',
        name: '슬림 실버 체인 브레이슬릿',
        subtitle: '소매 끝에서 은은하게 빛나는 포인트',
        colorName: '실버 925',
        colorHex: '#E0E0E0',
        material: '스터링 실버',
        fit: '슬림 링크 체인',
        stylingTip: '셔츠나 니트의 소매를 걷었을 때 과하지 않은 센스를 보여줍니다.',
        pairingAdvice: '미니멀한 가죽 시계와 함께 레이어드하면 더욱 좋습니다.',
        tags: ['#주얼리', '#실버', '#디테일'],
        confidence: isSufficient ? 82 : 50,
        whyRecommended: '작은 디테일로 전체적인 패션 감도를 확 끌어올리는 아이템입니다.',
      },
    ],
    full: [
      {
        id: 'ful-1',
        name: '도심 속 세련된 시티보이 캐주얼 셋',
        subtitle: '오버핏 셔츠 + 와이드 데님 + 독일군 스니커즈',
        colorName: '스카이블루 & 인디고 & 화이트',
        colorHex: '#4A90E2',
        material: '옥스포드 코튼 & 워싱 데님',
        fit: '전체적인 릴렉스 와이드 실루엣',
        stylingTip: '상의는 루즈하게, 하의는 자연스럽게 신발에 걸치도록 연출하세요.',
        pairingAdvice: '여기에 블랙 레더 크로스백 하나만 얹으면 완벽한 코디가 됩니다.',
        tags: ['#시티보이', '#완벽조합', '#실패없는룩'],
        confidence: isSufficient ? 95 : 65,
        whyRecommended: '누구나 입어도 과하지 않고 감각적인 인상을 심어주는 풀 코디입니다.',
      },
      {
        id: 'ful-2',
        name: '단정한 스마트 모던 비즈니스 캐주얼',
        subtitle: '니트 카라티 + 투턱 슬랙스 + 더비 슈즈',
        colorName: '오트밀 & 차콜 그레이 & 매트블랙',
        colorHex: '#333333',
        material: '울 블렌드 & 코튼 피케',
        fit: '세미 테이퍼드 & 레귤러 핏',
        stylingTip: '상하의 톤온톤 밸런스를 맞춰 단정하고 지적인 이미지를 전달합니다.',
        pairingAdvice: '날씨가 쌀쌀해지면 블랙 싱글 블레이저를 덧입으세요.',
        tags: ['#오피스룩', '#소개팅룩', '#지적임'],
        confidence: isSufficient ? 92 : 62,
        whyRecommended: '중요한 미팅이나 첫 만남 자리에서 호감도를 극대화하는 조합입니다.',
      },
    ],
  };

  const items = sampleItems[categoryId] || sampleItems.top;
  const missingReason = !isSufficient
    ? '현재 AI와의 대화에서 정보가 충분하지 않아 가장 기본적이고 실패 없는 스테디셀러 위주로 제안드렸습니다. 대화창에서 TPO(장소), 좋아하는 색감, 원하는 핏을 더 알려주시면 취향 저격 맞춤 추천으로 업데이트됩니다!'
    : '대화에서 수집된 고객님의 무드와 TPO를 기반으로 가장 조화로운 스타일을 선별했습니다.';

  return {
    categoryId,
    overviewAdvice: missingReason,
    followUpQuestions: [
      `${categoryId === 'top' ? '상의' : categoryId === 'bottom' ? '하의' : '아이템'} 색상은 밝은 톤과 어두운 톤 중 어떤 걸 더 좋아하세요?`,
      '어떤 장소나 상황(데이트, 출근, 캠퍼스 등)에 맞춰 입으실 계획인가요?',
      '평소 즐겨 입으시는 핏(오버핏, 레귤러, 와이드 등)을 알려주세요!',
    ],
    items,
    readiness: currentReadiness || {
      categoryId,
      readinessScore: 40,
      isSufficient: false,
      statusText: '정보 수집 중',
      missingFields: ['상황(TPO)', '스타일 무드'],
      collectedHighlights: [],
    },
  };
}

// Vite integration
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AI Fashion Stylist server listening on port ${PORT}`);
  });
}

startServer();
