// ─────────────────────────────────────────────────────
// 뷰티 브랜딩 페이지
// 4탭 UI (스킨케어/메이크업/럭셔리/내추럴)
// 256가지 프롬프트 동적 생성
// ─────────────────────────────────────────────────────

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type BeautyCategory = "skincare" | "makeup" | "luxury" | "natural";
type SkinTone = "ivory" | "beige" | "warm_beige" | "golden";
type MakeupStyle = "nomakeup" | "natural" | "glam" | "full";
type Lighting = "soft" | "dramatic" | "natural" | "studio";

const CATEGORY_CONFIG = {
  skincare: {
    label: "스킨케어",
    description: "물광 피부, 유리피부, 세럼 브랜딩",
    moods: [
      { value: "fresh", label: "신선한 (Fresh)" },
      { value: "luxury", label: "럭셔리 (Luxury)" },
      { value: "serene", label: "고요한 (Serene)" },
      { value: "confident", label: "자신감 (Confident)" },
    ],
  },
  makeup: {
    label: "메이크업",
    description: "글로우 메이크업, 쿠션 파운데이션, 립",
    moods: [
      { value: "playful", label: "장난스러운 (Playful)" },
      { value: "elegant", label: "우아한 (Elegant)" },
      { value: "bold", label: "대담한 (Bold)" },
      { value: "fresh", label: "신선한 (Fresh)" },
    ],
  },
  luxury: {
    label: "럭셔리",
    description: "하이엔드 향수, Chanel Dior 스타일",
    moods: [
      { value: "timeless", label: "클래식 (Timeless)" },
      { value: "modern", label: "현대적 (Modern)" },
      { value: "sensual", label: "관능적 (Sensual)" },
      { value: "regal", label: "우아한 왕족 (Regal)" },
    ],
  },
  natural: {
    label: "내추럴",
    description: "노메이크업, 자연광, 비타민 피부",
    moods: [
      { value: "organic", label: "유기적 (Organic)" },
      { value: "earthy", label: "자연스러운 (Earthy)" },
      { value: "peaceful", label: "평화로운 (Peaceful)" },
      { value: "vibrant", label: "생생한 (Vibrant)" },
    ],
  },
};

const SKIN_TONES = [
  { value: "ivory", label: "Ivory (밝은 톤)" },
  { value: "beige", label: "Beige (자연 톤)" },
  { value: "warm_beige", label: "Warm Beige (따뜻한 톤)" },
  { value: "golden", label: "Golden (황금 톤)" },
];

const MAKEUP_STYLES = [
  { value: "nomakeup", label: "No Makeup (노메이크업)" },
  { value: "natural", label: "Natural (내추럴)" },
  { value: "glam", label: "Glam (글로우)" },
  { value: "full", label: "Full (풀메이크업)" },
];

const LIGHTINGS = [
  { value: "soft", label: "Soft (부드러운)" },
  { value: "dramatic", label: "Dramatic (극적)" },
  { value: "natural", label: "Natural (자연광)" },
  { value: "studio", label: "Studio (스튜디오)" },
];

export default function BeautyPage() {
  const [category, setCategory] = useState<BeautyCategory>("skincare");
  const [skinTone, setSkinTone] = useState<SkinTone>("beige");
  const [makeupStyle, setMakeupStyle] = useState<MakeupStyle>("natural");
  const [lighting, setLighting] = useState<Lighting>("soft");
  const [mood, setMood] = useState("fresh");
  const [customPrompt, setCustomPrompt] = useState("");
  const [imageBase64, setImageBase64] = useState<string>("");
  const [showPrompt, setShowPrompt] = useState(false);

  const generateMutation = trpc.beauty.generateBeauty.useMutation();
  const analyzeMutation = trpc.beauty.analyzeBeauty.useMutation();

  // ─────────────────────────────────────────────────────
  // 이미지 업로드 처리
  // ─────────────────────────────────────────────────────
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = (event.target?.result as string).split(",")[1] || "";
      setImageBase64(base64);
      toast.success("이미지가 업로드되었습니다");
    };
    reader.readAsDataURL(file);
  };

  // ─────────────────────────────────────────────────────
  // 분석만 수행
  // ─────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    try {
      await analyzeMutation.mutateAsync({
        imageBase64,
        category,
        skinTone,
        makeupStyle,
        lighting,
        mood,
      });
      setShowPrompt(true);
      toast.success("분석 완료!");
    } catch (err: any) {
      toast.error(err.message || "분석 실패");
    }
  };

  // ─────────────────────────────────────────────────────
  // 이미지 생성
  // ─────────────────────────────────────────────────────
  const handleGenerate = async () => {
    try {
      await generateMutation.mutateAsync({
        imageBase64,
        category,
        skinTone,
        makeupStyle,
        lighting,
        mood,
        customPrompt: customPrompt || undefined,
        outputCount: 4,
      });
      toast.success("이미지 생성 완료!");
    } catch (err: any) {
      toast.error(err.message || "생성 실패");
    }
  };

  // ─────────────────────────────────────────────────────
  // 현재 설정 정보
  // ─────────────────────────────────────────────────────
  const currentConfig = CATEGORY_CONFIG[category];
  const currentMood = currentConfig.moods.find((m) => m.value === mood);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-rose-950 to-black p-6">
      <div className="max-w-6xl mx-auto">
        {/* ─── 헤더 ─── */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-rose-100 mb-2">뷰티 브랜딩 모듈</h1>
          <p className="text-rose-300">럭셔리 뷰티 화보 자동 생성</p>
        </div>

        {/* ─── 메인 콘텐츠 ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ─── 왼쪽: 컨트롤 패널 ─── */}
          <div className="lg:col-span-1">
            <Card className="bg-black/50 border-rose-900/30 p-6">
              {/* 카테고리 탭 */}
              <Tabs value={category} onValueChange={(v) => setCategory(v as BeautyCategory)} className="w-full">
                <TabsList className="grid grid-cols-2 w-full bg-rose-950/30 mb-6">
                  <TabsTrigger value="skincare" className="text-xs">스킨케어</TabsTrigger>
                  <TabsTrigger value="makeup" className="text-xs">메이크업</TabsTrigger>
                  <TabsTrigger value="luxury" className="text-xs">럭셔리</TabsTrigger>
                  <TabsTrigger value="natural" className="text-xs">내추럴</TabsTrigger>
                </TabsList>

                {/* 각 탭의 설정 */}
                {(["skincare", "makeup", "luxury", "natural"] as BeautyCategory[]).map((cat) => (
                  <TabsContent key={cat} value={cat} className="space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-rose-200 mb-1">{CATEGORY_CONFIG[cat].label}</p>
                      <p className="text-xs text-rose-400">{CATEGORY_CONFIG[cat].description}</p>
                    </div>

                    {/* 피부톤 선택 */}
                    <div>
                      <label className="text-xs font-semibold text-rose-200 block mb-2">피부톤</label>
                      <Select value={skinTone} onValueChange={(v) => setSkinTone(v as SkinTone)}>
                        <SelectTrigger className="bg-black/50 border-rose-900/30 text-rose-100">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-black border-rose-900/30">
                          {SKIN_TONES.map((tone) => (
                            <SelectItem key={tone.value} value={tone.value} className="text-rose-100">
                              {tone.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 메이크업 스타일 */}
                    <div>
                      <label className="text-xs font-semibold text-rose-200 block mb-2">메이크업 스타일</label>
                      <Select value={makeupStyle} onValueChange={(v) => setMakeupStyle(v as MakeupStyle)}>
                        <SelectTrigger className="bg-black/50 border-rose-900/30 text-rose-100">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-black border-rose-900/30">
                          {MAKEUP_STYLES.map((style) => (
                            <SelectItem key={style.value} value={style.value} className="text-rose-100">
                              {style.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 조명 */}
                    <div>
                      <label className="text-xs font-semibold text-rose-200 block mb-2">조명</label>
                      <Select value={lighting} onValueChange={(v) => setLighting(v as Lighting)}>
                        <SelectTrigger className="bg-black/50 border-rose-900/30 text-rose-100">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-black border-rose-900/30">
                          {LIGHTINGS.map((light) => (
                            <SelectItem key={light.value} value={light.value} className="text-rose-100">
                              {light.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 분위기 */}
                    <div>
                      <label className="text-xs font-semibold text-rose-200 block mb-2">분위기</label>
                      <Select value={mood} onValueChange={setMood}>
                        <SelectTrigger className="bg-black/50 border-rose-900/30 text-rose-100">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-black border-rose-900/30">
                          {CATEGORY_CONFIG[cat].moods.map((m) => (
                            <SelectItem key={m.value} value={m.value} className="text-rose-100">
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>

              {/* 이미지 업로드 */}
              <div className="mt-6 pt-6 border-t border-rose-900/30">
                <label className="text-xs font-semibold text-rose-200 block mb-2">참조 이미지 (선택)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="w-full text-xs text-rose-400 file:bg-rose-900/30 file:border-0 file:rounded file:px-3 file:py-1 file:text-rose-200 cursor-pointer"
                />
                {imageBase64 && <p className="text-xs text-rose-300 mt-2">✓ 이미지 업로드됨</p>}
              </div>

              {/* 커스텀 프롬프트 */}
              <div className="mt-4">
                <label className="text-xs font-semibold text-rose-200 block mb-2">커스텀 프롬프트 (선택)</label>
                <Textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="추가 프롬프트를 입력하세요..."
                  className="bg-black/50 border-rose-900/30 text-rose-100 text-xs h-20 resize-none"
                />
              </div>

              {/* 버튼 */}
              <div className="mt-6 space-y-2">
                <Button
                  onClick={handleAnalyze}
                  disabled={analyzeMutation.isPending}
                  className="w-full bg-rose-900/50 hover:bg-rose-900 text-rose-100 border border-rose-700"
                >
                  {analyzeMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      분석 중...
                    </>
                  ) : (
                    "분석만 보기"
                  )}
                </Button>

                <Button
                  onClick={handleGenerate}
                  disabled={generateMutation.isPending}
                  className="w-full bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      생성 중...
                    </>
                  ) : (
                    "이미지 생성 (4장)"
                  )}
                </Button>
              </div>
            </Card>
          </div>

          {/* ─── 오른쪽: 결과 표시 ─── */}
          <div className="lg:col-span-2 space-y-6">
            {/* 분석 결과 */}
            {showPrompt && analyzeMutation.data && (
              <Card className="bg-black/50 border-rose-900/30 p-6">
                <h3 className="text-lg font-semibold text-rose-100 mb-4">분석 결과</h3>

                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-rose-300 mb-2">포지티브 프롬프트</p>
                    <p className="text-xs text-rose-200 bg-black/50 p-3 rounded border border-rose-900/30 max-h-40 overflow-y-auto">
                      {analyzeMutation.data.prompt}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-rose-300 mb-2">네거티브 프롬프트</p>
                    <p className="text-xs text-rose-200 bg-black/50 p-3 rounded border border-rose-900/30 max-h-40 overflow-y-auto">
                      {analyzeMutation.data.negativePrompt}
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* 생성 결과 */}
            {generateMutation.data && (
              <Card className="bg-black/50 border-rose-900/30 p-6">
                <h3 className="text-lg font-semibold text-rose-100 mb-4">생성된 이미지</h3>

                <div className="grid grid-cols-2 gap-4">
                  {generateMutation.data.images.map((img, idx) => (
                    <div key={idx} className="relative group">
                      <img
                        src={img}
                        alt={`Generated ${idx + 1}`}
                        className="w-full h-auto rounded border border-rose-900/30"
                      />
                      <a
                        href={img}
                        download={`beauty-${idx + 1}.png`}
                        className="absolute top-2 right-2 bg-black/70 p-2 rounded opacity-0 group-hover:opacity-100 transition"
                      >
                        <Download className="w-4 h-4 text-rose-300" />
                      </a>
                    </div>
                  ))}
                </div>

                {/* 다시 생성 버튼 */}
                <Button
                  onClick={handleGenerate}
                  disabled={generateMutation.isPending}
                  variant="outline"
                  className="w-full mt-4 border-rose-900/30 text-rose-200 hover:bg-rose-900/20"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  다시 생성
                </Button>
              </Card>
            )}

            {/* 빈 상태 */}
            {!showPrompt && !generateMutation.data && (
              <Card className="bg-black/50 border-rose-900/30 p-12 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-rose-300 text-sm">설정을 선택하고 "분석만 보기" 또는 "이미지 생성"을 클릭하세요</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
