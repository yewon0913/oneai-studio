import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, Download, X, ArrowLeft, Heart, RefreshCw, CheckCircle2, Plus, Lock, Unlock, Sparkles } from "lucide-react";
import { toast } from "sonner";

const ENGINES = [
  { key: "flux-dev", label: "FLUX Dev", sub: "고품질 기본" },
  { key: "flux-lora", label: "FLUX LoRA", sub: "스타일 특화" },
  { key: "stable-diffusion", label: "Stable Diffusion", sub: "빠른 생성" },
] as const;
type EngineKey = typeof ENGINES[number]["key"];

const RATIOS = [
  { key: "4:3", label: "4:3", sub: "기본" },
  { key: "16:9", label: "16:9", sub: "와이드" },
  { key: "1:1", label: "1:1", sub: "정사각" },
] as const;
type RatioKey = typeof RATIOS[number]["key"];

const STEPS = [
  { label: "사진 업로드", sub: "FAL storage" },
  { label: "배경 제거", sub: "BiRefNet AI" },
  { label: "이미지 생성", sub: "FLUX Dev" },
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
  const [refImages, setRefImages] = useState<{ base64: string; name: string }[]>([]);
  const [prompt, setPrompt] = useState("romantic wedding photo, soft natural lighting, elegant atmosphere, photorealistic");
  const [negativePrompt, setNegativePrompt] = useState("blurry, low quality, distorted face, extra limbs, watermark, cartoon");
  const [faceLock, setFaceLock] = useState(true);
  const [engine, setEngine] = useState<EngineKey>("flux-dev");
  const [ratio, setRatio] = useState<RatioKey>("4:3");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [results, setResults] = useState<{ url: string; log: string }[]>([]);

  const coupleRef = useRef<HTMLInputElement>(null);
  const refImgRef = useRef<HTMLInputElement>(null);

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

      try {
        toast.info("AI가 사진을 분석하고 있어요…");
        const analysis = await analyzeMutation.mutateAsync({
          imageBase64: base64,
          mimeType: mime,
        });
        if (analysis.prompt) {
          setPrompt(analysis.prompt);
          toast.success("AI 분석 완료! 프롬프트가 자동으로 채워졌어요 ✨");
        }
      } catch (err) {
        console.error("분석 실패:", err);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRefFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = 1 - refImages.length;

    if (remaining <= 0) {
      toast.error("참조 이미지는 1장만 가능합니다");
      return;
    }

    files.slice(0, remaining).forEach((file) => {
      if (!file.type.startsWith("image/")) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        setRefImages((prev) => [...prev, { base64: ev.target?.result as string, name: file.name }]);
      };
      reader.readAsDataURL(file);
    });

    e.target.value = "";
  };

  const removeRefImage = (idx: number) => {
    setRefImages((prev) => prev.filter((_, i) => i !== idx));
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
        refImages: refImages.length > 0 ? refImages : undefined,
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
          <p className="text-slate-400 mb-3">커플 사진 업로드 → AI 자동 분석 → 웨딩 사진 완성</p>
          <div className="flex gap-2 flex-wrap">
            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/30">
              ✅ 얼굴 100% 보존
            </span>
            <span className="text-xs bg-purple-500/20 text-purple-400 px-3 py-1 rounded-full border border-purple-500/30">
              ✅ AI 자동 분석
            </span>
            <span className="text-xs bg-rose-500/20 text-rose-400 px-3 py-1 rounded-full border border-rose-500/30">
              ✅ 스튜디오급 퀄리티
            </span>
          </div>
        </div>

        {/* 커플 사진 업로드 */}
        <Card className="bg-slate-900/50 border-slate-800 mb-5">
          <CardHeader>
            <CardTitle className="text-white">💑 커플 사진 업로드</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!coupleImage ? (
              <div
                onClick={() => coupleRef.current?.click()}
                className="border-2 border-dashed border-slate-600 rounded-xl p-10 text-center cursor-pointer hover:border-rose-500/50 transition-colors bg-slate-800/30"
              >
                <Upload className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                <p className="font-semibold text-white mb-1">함께 찍은 커플 사진을 올려주세요</p>
                <p className="text-sm text-slate-500">업로드 즉시 AI가 자동으로 분석합니다</p>
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
                      {analyzeMutation.isPending && (
                        <span className="flex items-center gap-1 text-xs text-purple-400">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          AI 분석 중...
                        </span>
                      )}
                      {analyzeMutation.isSuccess && (
                        <span className="flex items-center gap-1 text-xs text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" />
                          분석 완료
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400 truncate">{coupleFileName}</p>
                    {analyzeMutation.data && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
                          조명: {analyzeMutation.data.analysis?.lighting?.substring(0, 12)}...
                        </span>
                        <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
                          분위기: {analyzeMutation.data.analysis?.mood?.substring(0, 12)}...
                        </span>
                        <span className="text-xs bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded">
                          ✨ 15가지 분석 완료
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Button
                      onClick={() => coupleRef.current?.click()}
                      variant="outline"
                      size="sm"
                      className="border-slate-600 text-slate-300 hover:bg-slate-700"
                    >
                      <Upload className="w-4 h-4 mr-1" />
                      다른 사진
                    </Button>
                    <Button
                      onClick={handleClearCouple}
                      variant="outline"
                      size="sm"
                      className="border-slate-600 text-slate-300 hover:bg-slate-700"
                    >
                      <X className="w-4 h-4 mr-1" />
                      제거
                    </Button>
                  </div>
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
            <div className="grid grid-cols-2 gap-x-4 text-xs text-slate-500 p-3 rounded-lg bg-slate-800/40 border border-slate-700/50">
              <p>✅ 두 분 얼굴이 잘 보이는 사진</p>
              <p>✅ 밝고 선명한 사진</p>
              <p>✅ 상반신 이상 나오는 사진</p>
              <p>❌ 너무 어둡거나 흐린 사진</p>
            </div>
          </CardContent>
        </Card>

        {/* 참조 이미지 */}
        <Card className="bg-slate-900/50 border-slate-800 mb-5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white">
                📸 참조 이미지{" "}
                <span className="text-sm font-normal text-slate-500">(선택, 1장 분석용)</span>
              </CardTitle>
              <span className="text-xs text-slate-500">
                {refImages.length}/1
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {refImages.map((img, idx) => (
                <div
                  key={idx}
                  className="relative aspect-square rounded-lg overflow-hidden border border-slate-700 group"
                >
                  <img
                    src={img.base64}
                    alt={img.name}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => removeRefImage(idx)}
                    className="absolute top-1 right-1 bg-black/70 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
              {refImages.length < 1 && (
                <div
                  onClick={() => refImgRef.current?.click()}
                  className="aspect-square rounded-lg border-2 border-dashed border-slate-600 hover:border-rose-500/50 cursor-pointer flex items-center justify-center transition-colors bg-slate-800/30"
                >
                  <Plus className="w-6 h-6 text-slate-500" />
                </div>
              )}
            </div>
            <input
              ref={refImgRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleRefFiles}
              className="hidden"
            />
            <p className="text-xs text-slate-600 mt-2">
              원하는 배경, 스타일, 드레스 등 참조 이미지를 추가하세요
            </p>
          </CardContent>
        </Card>

        {/* 이미지 생성 설정 */}
        <Card className="bg-slate-900/50 border-slate-800 mb-5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white">⚙️ 이미지 생성 설정</CardTitle>
              {analyzeMutation.isPending && (
                <span className="flex items-center gap-1 text-xs text-purple-400">
                  <Sparkles className="w-3 h-3 animate-pulse" />
                  AI 분석 중...
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* AI 정밀분석 버튼 */}
            {refImages.length > 0 && (
              <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/30">
                <Button
                  onClick={async () => {
                    if (refImages.length === 0) {
                      toast.error("참조 이미지를 업로드해주세요");
                      return;
                    }
                    try {
                      const result = await analyzeMutation.mutateAsync({
                        imageBase64: refImages[0].base64,
                        mimeType,
                      });
                      // 분석 결과 프롬프트 적용
                      setPrompt(result.prompt);
                      setNegativePrompt(result.negativePrompt);
                      // 분석 완료 후 참조 이미지 자동 삭제
                      setRefImages([]);
                      toast.success("✨ 15가지 분석 완료! 프롬프트가 자동 적용되었습니다");
                    } catch (err) {
                      toast.error("분석 실패. 다시 시도해주세요");
                    }
                  }}
                  disabled={analyzeMutation.isPending}
                  className="w-full bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-700 hover:to-rose-700 text-white"
                >
                  {analyzeMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      AI 분석 중...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      🔍 AI 정밀분석 (15가지 카테고리)
                    </>
                  )}
                </Button>
                <p className="text-xs text-slate-500 mt-2">
                  참조 이미지를 분석하여 메인/네거티브 프롬프트를 자동 생성합니다
                </p>
              </div>
            )}

            <div>
              <label className="text-sm text-slate-400 mb-2 block">
                📝 메인 프롬프트
                {analyzeMutation.isSuccess && (
                  <span className="ml-2 text-xs text-emerald-400">✨ AI 자동 완성됨</span>
                )}
              </label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="원하는 스타일, 배경, 분위기를 영어로 입력하세요"
                rows={3}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 resize-none text-sm"
              />
            </div>

            <div>
              <label className="text-sm text-slate-400 mb-2 block">
                🚫 네거티브 프롬프트
              </label>
              <Textarea
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder="제외할 요소를 입력하세요"
                rows={2}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 resize-none text-sm"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/60 border border-slate-700">
              <div>
                <p className="text-sm text-white font-medium flex items-center gap-2">
                  {faceLock ? (
                    <Lock className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Unlock className="w-4 h-4 text-slate-400" />
                  )}
                  얼굴 고정 모드
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {faceLock
                    ? "원본 얼굴 100% 보존 (권장)"
                    : "AI가 얼굴을 재생성"}
                </p>
              </div>
              <button
                onClick={() => setFaceLock(!faceLock)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  faceLock ? "bg-emerald-500" : "bg-slate-600"
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                    faceLock ? "left-7" : "left-1"
                  }`}
                />
              </button>
            </div>

            <div>
              <label className="text-sm text-slate-400 mb-2 block">
                ⚡ AI 엔진
              </label>
              <div className="grid grid-cols-3 gap-2">
                {ENGINES.map((e) => (
                  <button
                    key={e.key}
                    onClick={() => setEngine(e.key)}
                    className={`p-3 rounded-lg text-center border transition-all ${
                      engine === e.key
                        ? "bg-rose-500/20 border-rose-500/60 text-white"
                        : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    <div className="text-xs font-semibold">{e.label}</div>
                    <div className="text-xs opacity-50 mt-0.5">{e.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm text-slate-400 mb-2 block">
                📐 사진 비율
              </label>
              <div className="flex gap-2">
                {RATIOS.map((r) => (
                  <button
                    key={r.key}
                    onClick={() => setRatio(r.key)}
                    className={`px-4 py-2 rounded-lg text-sm border transition-all ${
                      ratio === r.key
                        ? "bg-rose-500/20 border-rose-500/60 text-rose-300"
                        : "bg-slate-800 border-slate-700 text-slate-400"
                    }`}
                  >
                    {r.label}
                    <span className="block text-xs opacity-50">{r.sub}</span>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 생성 버튼 */}
        <Button
          onClick={handleGenerate}
          disabled={!coupleImage || isGenerating}
          className="w-full mb-5 bg-gradient-to-r from-rose-600 to-pink-500 hover:from-rose-700 hover:to-pink-600 text-white font-semibold py-6 text-lg disabled:opacity-40"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              생성 중...
            </>
          ) : (
            <>
              <Heart className="w-5 h-5 mr-2 fill-white" />
              웨딩 사진 만들기 (2장)
            </>
          )}
        </Button>

        {/* 진행 상태 */}
        {isGenerating && currentStep >= 0 && (
          <Card className="bg-slate-900/50 border-slate-800 mb-5">
            <CardHeader>
              <CardTitle className="text-white text-base">진행 중...</CardTitle>
            </CardHeader>
            <CardContent>
              <ProgressSteps currentStep={currentStep} />
              <p className="text-xs text-slate-600 mt-3 text-center">페이지를 닫지 마세요</p>
            </CardContent>
          </Card>
        )}

        {/* 결과 */}
        {results.length > 0 && (
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">💑 완성된 웨딩 사진</CardTitle>
                <Button
                  onClick={handleGenerate}
                  variant="outline"
                  size="sm"
                  className="border-slate-600 text-slate-300 hover:bg-slate-800"
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  다시 생성
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.map((img, idx) => (
                  <div
                    key={idx}
                    className="relative group rounded-xl overflow-hidden border border-rose-500/30"
                  >
                    <img
                      src={img.url}
                      alt={`웨딩 ${idx + 1}`}
                      className="w-full aspect-[4/3] object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <Button
                        onClick={() => handleDownload(img.url, idx)}
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 hover:bg-white text-black font-semibold"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        다운로드
                      </Button>
                    </div>
                    <div className="absolute bottom-0 inset-x-0 bg-black/60 py-1.5 px-3 flex justify-between">
                      <p className="text-xs text-slate-300">#{idx + 1}</p>
                      <p className="text-xs text-slate-500 truncate ml-2">{img.log}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
