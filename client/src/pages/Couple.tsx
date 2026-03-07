import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, Download, X, ArrowLeft, Heart, CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";

const ENGINES = [
  { key: "flux-dev", label: "FLUX Dev", sub: "고품질 기본" },
  { key: "flux-pro", label: "FLUX Pro 1.1", sub: "프리미엄 품질" },
] as const;
type EngineKey = typeof ENGINES[number]["key"];

const RATIOS = [
  { key: "4:3", label: "4:3", sub: "기본" },
  { key: "16:9", label: "16:9", sub: "와이드" },
  { key: "1:1", label: "1:1", sub: "정사각" },
] as const;
type RatioKey = typeof RATIOS[number]["key"];

const STEPS = [
  { label: "사진 업로드", sub: "배경 분석" },
  { label: "배경 제거", sub: "BiRefNet AI" },
  { label: "이미지 생성", sub: "FLUX" },
  { label: "얼굴 선명화", sub: "CodeFormer" },
];

function ProgressSteps({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex flex-col gap-3 p-4 rounded-lg bg-slate-800/60 border border-slate-700">
      {STEPS.map((s, i) => {
        const isDone = currentStep > i;
        const isActive = currentStep === i;
        return (
          <div key={i} className="flex items-center gap-3">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                isDone ? "bg-emerald-500" : isActive ? "bg-rose-500" : "bg-slate-700"
              }`}
            >
              {isDone ? (
                <CheckCircle2 className="w-4 h-4 text-white" />
              ) : isActive ? (
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              ) : (
                <span className="text-xs text-slate-500">{i + 1}</span>
              )}
            </div>
            <div>
              <p
                className={`text-sm font-medium ${
                  isDone ? "text-emerald-400" : isActive ? "text-white" : "text-slate-500"
                }`}
              >
                {s.label}
              </p>
              <p className="text-xs text-slate-600">{s.sub}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Couple() {
  const [, setLocation] = useLocation();
  const [coupleImage, setCoupleImage] = useState<string | null>(null);
  const [coupleFileName, setCoupleFileName] = useState("");
  const [mimeType, setMimeType] = useState<"image/jpeg" | "image/png" | "image/webp">("image/jpeg");
  const [prompt, setPrompt] = useState("romantic wedding photo, soft natural lighting, elegant atmosphere, photorealistic");
  const [negativePrompt, setNegativePrompt] = useState("blurry, low quality, distorted face, extra limbs, watermark, cartoon");
  const [faceLock, setFaceLock] = useState(true);
  const [engine, setEngine] = useState<EngineKey>("flux-dev");
  const [ratio, setRatio] = useState<RatioKey>("4:3");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [results, setResults] = useState<{ url: string; log: string }[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [showAnalysisDetail, setShowAnalysisDetail] = useState(false);

  const coupleRef = useRef<HTMLInputElement>(null);

  const mutation = trpc.couple.generateCouple.useMutation();
  const analyzeMutation = trpc.couple.analyzeCouple.useMutation();

  const handleCoupleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      toast.error("20MB 이하만 가능합니다");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("이미지 파일만 가능합니다");
      return;
    }

    const mime = (file.type as "image/jpeg" | "image/png" | "image/webp") || "image/jpeg";
    setMimeType(mime);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      setCoupleImage(base64);
      setCoupleFileName(file.name);
      setResults([]);
      setCurrentStep(-1);

      // 배경 분석
      try {
        setIsAnalyzing(true);
        toast.info("배경을 분석하고 있어요…");
        const analysis = await analyzeMutation.mutateAsync({
          imageBase64: base64,
          mimeType: mime,
        });
        
        if (analysis.prompt) {
          setPrompt(prev => `${analysis.prompt}, ${prev}`);
          setAnalysisResult(analysis);
          setShowAnalysisDetail(false);
          toast.success("배경 분석 완료! 프롬프트가 자동으로 채워졌어요 ✨");
        }
      } catch (err) {
        console.error("분석 실패:", err);
        toast.error("배경 분석에 실패했습니다");
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleClearCouple = () => {
    setCoupleImage(null);
    setCoupleFileName("");
    setResults([]);
    setCurrentStep(-1);
    if (coupleRef.current) coupleRef.current.value = "";
  };

  const handleGenerate = async () => {
    if (!coupleImage) {
      toast.error("커플 사진을 업로드해주세요");
      return;
    }

    setIsGenerating(true);
    setResults([]);
    setCurrentStep(0);

    const t1 = setTimeout(() => setCurrentStep(1), 4000);
    const t2 = setTimeout(() => setCurrentStep(2), 18000);
    const t3 = setTimeout(() => setCurrentStep(3), 50000);

    try {
      const base64 = coupleImage.includes(",") ? coupleImage.split(",")[1] : coupleImage;

      const result = await mutation.mutateAsync({
        coupleImageBase64: base64,
        mimeType,
        scene: "all",
        aspectRatio: ratio,
        prompt,
        negativePrompt,
        engine,
        faceLock,
      });

      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);

      setCurrentStep(4);
      setResults(result.images);
      toast.success(`웨딩 사진 ${result.images.length}장 완성! 💑`);
    } catch (err) {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      console.error(err);
      setCurrentStep(-1);
      toast.error("생성 실패. 다시 시도해주세요.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = (url: string, idx: number) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `wedding-${idx + 1}.jpg`;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/")}
            className="mb-4 gap-2 text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            돌아가기
          </Button>

          <div className="flex items-center gap-3 mb-2">
            <Heart className="w-8 h-8 text-rose-500 fill-rose-500" />
            <h1 className="text-3xl font-bold text-white">AI 웨딩 사진 생성</h1>
          </div>
          <p className="text-slate-400 mb-3">커플 사진 업로드 → 배경 AI 분석 → 웨딩 사진 완성</p>
          <div className="flex gap-2 flex-wrap">
            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/30">
              ✅ 얼굴 100% 보존
            </span>
            <span className="text-xs bg-purple-500/20 text-purple-400 px-3 py-1 rounded-full border border-purple-500/30">
              ✅ 배경 AI 분석
            </span>
            <span className="text-xs bg-rose-500/20 text-rose-400 px-3 py-1 rounded-full border border-rose-500/30">
              ✅ 스튜디오급 퀄리티
            </span>
          </div>
        </div>

        {/* 커플 사진 업로드 */}
        <Card className="bg-slate-900/50 border-slate-800 mb-5">
          <CardHeader>
            <CardTitle className="text-white">💑 커플 사진 업로드 (1장)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!coupleImage ? (
              <div
                onClick={() => coupleRef.current?.click()}
                className="border-2 border-dashed border-slate-600 rounded-xl p-10 text-center cursor-pointer hover:border-rose-500/50 transition-colors bg-slate-800/30"
              >
                <Upload className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                <p className="font-semibold text-white mb-1">함께 찍은 커플 사진을 올려주세요</p>
                <p className="text-sm text-slate-500">업로드 즉시 배경을 AI가 자동으로 분석합니다</p>
                <p className="text-xs text-slate-600 mt-1">JPG · PNG · WebP · 최대 20MB</p>
              </div>
            ) : (
              <div className="flex gap-4 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                <div className="flex-shrink-0">
                  <img
                    src={coupleImage}
                    alt="커플"
                    className="w-24 h-24 rounded-lg object-cover border border-rose-500/30"
                  />
                </div>
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-white">사진 선택됨</p>
                      {isAnalyzing && (
                        <span className="flex items-center gap-1 text-xs text-purple-400">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          배경 분석 중...
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{coupleFileName}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleClearCouple}
                    className="w-fit gap-1 text-slate-400 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                    제거
                  </Button>
                </div>
              </div>
            )}
            <input
              ref={coupleRef}
              type="file"
              accept="image/*"
              onChange={handleCoupleFile}
              className="hidden"
            />
          </CardContent>
        </Card>

        {/* 이미지 생성 설정 */}
        <Card className="bg-slate-900/50 border-slate-800 mb-5">
          <CardHeader>
            <CardTitle className="text-white">⚙️ 이미지 생성 설정</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* AI 엔진 */}
            <div>
              <label className="text-sm font-medium text-slate-300 mb-2 block">🚀 AI 엔진</label>
              <div className="grid grid-cols-2 gap-2">
                {ENGINES.map((e) => (
                  <button
                    key={e.key}
                    onClick={() => setEngine(e.key)}
                    className={`p-3 rounded-lg border transition-colors ${
                      engine === e.key
                        ? "bg-rose-500/20 border-rose-500 text-white"
                        : "bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    <p className="font-medium text-sm">{e.label}</p>
                    <p className="text-xs text-slate-500">{e.sub}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* 사진 비율 */}
            <div>
              <label className="text-sm font-medium text-slate-300 mb-2 block">📐 사진 비율</label>
              <div className="grid grid-cols-3 gap-2">
                {RATIOS.map((r) => (
                  <button
                    key={r.key}
                    onClick={() => setRatio(r.key)}
                    className={`p-3 rounded-lg border transition-colors ${
                      ratio === r.key
                        ? "bg-rose-500/20 border-rose-500 text-white"
                        : "bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    <p className="font-medium text-sm">{r.label}</p>
                    <p className="text-xs text-slate-500">{r.sub}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* faceLock 모드 */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700">
              <div>
                <p className="font-medium text-white">🔒 얼굴 고정 모드</p>
                <p className="text-xs text-slate-500">원본 얼굴 100% 보존 (권장)</p>
              </div>
              <button
                onClick={() => setFaceLock(!faceLock)}
                className={`w-12 h-6 rounded-full transition-colors ${
                  faceLock ? "bg-emerald-500" : "bg-slate-700"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    faceLock ? "translate-x-6" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            {/* AI 이미지 정밀 분석 */}
            {analysisResult && (
              <div className="space-y-2 p-3 rounded-lg bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 text-sm flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                    AI 이미지 정밀 분석
                  </label>
                </div>
                <p className="text-[10px] text-slate-500">
                  Anthropic Claude가 배경, 조명, 분위기, 장소 등을 분석하여 최적화된 프롬프트를 생성했습니다.
                </p>
                <div className="p-2 rounded bg-green-500/10 border border-green-500/20 mt-2">
                  <p className="text-xs text-green-300">✅ 배경 분석 결과가 메인 프롬프트에 자동 입력되었어요</p>
                </div>
                <button
                  onClick={() => setShowAnalysisDetail(!showAnalysisDetail)}
                  className="w-full gap-1.5 text-xs text-amber-300 hover:bg-amber-500/10 p-2 rounded mt-2 flex items-center justify-center"
                >
                  {showAnalysisDetail ? "▲ 분석 결과 접기" : "▼ 분석 결과 펼치기"}
                </button>
                {showAnalysisDetail && analysisResult.analysis && (
                  <div className="grid grid-cols-1 gap-1.5 text-[10px] mt-2">
                    {[
                      { icon: "📷", label: "카메라", key: "camera" },
                      { icon: "💡", label: "조명", key: "lighting" },
                      { icon: "🔬", label: "피부", key: "skin" },
                      { icon: "👗", label: "의상", key: "outfit" },
                      { icon: "🤸", label: "포즈", key: "pose" },
                      { icon: "👁️", label: "표정", key: "expression" },
                      { icon: "🌅", label: "배경", key: "background" },
                      { icon: "✨", label: "분위기", key: "mood" },
                      { icon: "💨", label: "움직임", key: "movement" },
                      { icon: "📐", label: "공간감", key: "space" },
                      { icon: "🕐", label: "시간날씨", key: "time" },
                      { icon: "🌟", label: "광학효과", key: "optical" },
                      { icon: "🖼️", label: "구도", key: "composition" },
                      { icon: "🎨", label: "색보정", key: "colorGrade" },
                      { icon: "💭", label: "내면감정", key: "innerState" },
                    ].map(({ icon, label, key }) => (
                      <div key={key} className="flex gap-1.5 p-1.5 rounded bg-black/20 border border-slate-700">
                        <span className="shrink-0">{icon}</span>
                        <span className="text-amber-300 font-medium shrink-0">{label}:</span>
                        <span className="text-slate-300">{(analysisResult.analysis as any)[key] || "-"}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 프롬프트 */}
            <div>
              <label className="text-sm font-medium text-slate-300 mb-2 block">📝 메인 프롬프트</label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="웨딩 사진 설명을 입력하세요"
                className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-600 min-h-20"
              />
            </div>

            {/* 네거티브 프롬프트 */}
            <div>
              <label className="text-sm font-medium text-slate-300 mb-2 block">❌ 네거티브 프롬프트</label>
              <Textarea
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder="제외할 요소들을 입력하세요"
                className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-600 min-h-20"
              />
            </div>
          </CardContent>
        </Card>

        {/* 생성 버튼 */}
        <Button
          onClick={handleGenerate}
          disabled={!coupleImage || isGenerating || isAnalyzing}
          className="w-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-bold py-6 text-lg mb-5"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              생성 중...
            </>
          ) : (
            <>
              <Heart className="w-5 h-5 mr-2 fill-white" />
              💕 웨딩 사진 만들기 (2장)
            </>
          )}
        </Button>

        {/* 진행 상황 */}
        {isGenerating && <ProgressSteps currentStep={currentStep} />}

        {/* 결과 */}
        {results.length > 0 && (
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">✨ 완성된 웨딩 사진</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {results.map((result, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="relative rounded-lg overflow-hidden bg-slate-800">
                    <img
                      src={result.url}
                      alt={`결과 ${idx + 1}`}
                      className="w-full h-auto"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleDownload(result.url, idx)}
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2"
                    >
                      <Download className="w-4 h-4" />
                      다운로드
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500 p-2 bg-slate-800/50 rounded">
                    {result.log}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
