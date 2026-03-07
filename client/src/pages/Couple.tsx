import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload, Download, X, ArrowLeft, Heart, RefreshCw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const SCENES = [
  { key: "all",            emoji: "✨", label: "전체 4장",   sub: "모든 배경" },
  { key: "cherry_blossom", emoji: "🌸", label: "벚꽃 정원", sub: "로맨틱" },
  { key: "chapel",         emoji: "⛪", label: "고급 채플", sub: "우아함" },
  { key: "garden",         emoji: "🌿", label: "야외 정원", sub: "자연" },
  { key: "beach",          emoji: "🌅", label: "해변 노을", sub: "골든아워" },
  { key: "forest",         emoji: "🌲", label: "숲속",      sub: "동화같은" },
  { key: "palace",         emoji: "🏰", label: "유럽 궁전", sub: "럭셔리" },
] as const;

type SceneKey = typeof SCENES[number]["key"];

const RATIOS = [
  { key: "4:3",  label: "4:3",  sub: "기본" },
  { key: "16:9", label: "16:9", sub: "와이드" },
  { key: "1:1",  label: "1:1",  sub: "정사각" },
] as const;

type RatioKey = typeof RATIOS[number]["key"];

const STEPS = [
  { label: "사진 업로드",       sub: "FAL storage" },
  { label: "배경 자동 제거",    sub: "BiRefNet AI" },
  { label: "새 배경 생성",      sub: "FLUX Dev" },
  { label: "얼굴 선명도 강화",  sub: "CodeFormer" },
];

function ProgressSteps({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex flex-col gap-2 p-4 rounded-lg bg-slate-800/60 border border-slate-700">
      {STEPS.map((s, i) => {
        const isDone   = currentStep > i;
        const isActive = currentStep === i;
        return (
          <div key={i} className="flex items-center gap-3">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
              isDone ? "bg-emerald-500" : isActive ? "bg-rose-500" : "bg-slate-700"
            }`}>
              {isDone   ? <CheckCircle2 className="w-4 h-4 text-white" /> :
               isActive ? <Loader2 className="w-4 h-4 text-white animate-spin" /> :
                          <span className="text-xs text-slate-500">{i + 1}</span>}
            </div>
            <div>
              <p className={`text-sm font-medium ${isDone ? "text-emerald-400" : isActive ? "text-white" : "text-slate-500"}`}>{s.label}</p>
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
  const [coupleImage, setCoupleImage]   = useState<string | null>(null);
  const [fileName, setFileName]         = useState("");
  const [mimeType, setMimeType]         = useState<"image/jpeg"|"image/png"|"image/webp">("image/jpeg");
  const [scene, setScene]               = useState<SceneKey>("all");
  const [ratio, setRatio]               = useState<RatioKey>("4:3");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep]   = useState(-1);
  const [results, setResults]           = useState<{url:string;log:string}[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const generateMutation = trpc.couple.generateCouple.useMutation();

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20*1024*1024) { toast.error("20MB 이하만 가능"); return; }
    if (!file.type.startsWith("image/")) { toast.error("이미지 파일만 가능"); return; }
    setMimeType((file.type as "image/jpeg"|"image/png"|"image/webp") || "image/jpeg");
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCoupleImage(ev.target?.result as string);
      setFileName(file.name);
      setResults([]);
      setCurrentStep(-1);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!coupleImage) { toast.error("커플 사진을 업로드해주세요"); return; }
    setIsGenerating(true);
    setResults([]);
    setCurrentStep(0);
    const t1 = setTimeout(() => setCurrentStep(1), 4000);
    const t2 = setTimeout(() => setCurrentStep(2), 20000);
    const t3 = setTimeout(() => setCurrentStep(3), 50000);
    try {
      const base64 = coupleImage.includes(",") ? coupleImage.split(",")[1] : coupleImage;
      const result = await generateMutation.mutateAsync({
        coupleImageBase64: base64,
        mimeType,
        scene,
        aspectRatio: ratio,
      });
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      setCurrentStep(4);
      setResults(result.images);
      toast.success(`웨딩 사진 ${result.images.length}장 완성! 💑`);
    } catch (err) {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      console.error(err);
      setCurrentStep(-1);
      toast.error("생성 실패. 다시 시도해주세요.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = (url: string, idx: number) => {
    const a = document.createElement("a");
    a.href=url; a.download=`wedding-${idx+1}.jpg`; a.target="_blank";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const estimatedTime = scene === "all" ? "약 5~8분" : "약 2~3분";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="mb-4 gap-2 text-slate-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" />돌아가기
          </Button>
          <div className="flex items-center gap-3 mb-3">
            <Heart className="w-8 h-8 text-rose-500 fill-rose-500" />
            <h1 className="text-3xl font-bold text-white">AI 웨딩 배경 합성</h1>
          </div>
          <p className="text-slate-400">커플 사진 1장으로 세계 어디서든 웨딩 사진을 찍어드립니다</p>
          <div className="flex gap-2 mt-3 flex-wrap">
            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/30">✅ 얼굴 100% 보존</span>
            <span className="text-xs bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full border border-blue-500/30">✅ 2~8분 내 완성</span>
            <span className="text-xs bg-rose-500/20 text-rose-400 px-3 py-1 rounded-full border border-rose-500/30">✅ 스튜디오급 퀄리티</span>
          </div>
        </div>

        <Card className="bg-slate-900/50 border-slate-800 mb-6">
          <CardHeader><CardTitle className="text-white">💑 커플 사진 업로드</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {!coupleImage ? (
              <div onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-600 rounded-lg p-10 text-center cursor-pointer hover:border-rose-500/50 transition-colors bg-slate-800/30">
                <Upload className="w-14 h-14 text-slate-500 mx-auto mb-3" />
                <h3 className="font-semibold text-white text-lg mb-2">함께 찍은 커플 사진을 올려주세요</h3>
                <p className="text-sm text-slate-400">JPG · PNG · WebP · 최대 20MB</p>
                <p className="text-xs text-slate-600 mt-2">두 분이 함께 나온 사진 1장이면 충분해요</p>
              </div>
            ) : (
              <div className="relative rounded-lg overflow-hidden border border-rose-500/30">
                <img src={coupleImage} alt="커플" className="w-full max-h-80 object-contain bg-slate-800" />
                <div className="absolute top-2 right-2 flex gap-2">
                  <Button onClick={() => fileInputRef.current?.click()} size="sm" className="bg-black/70 hover:bg-black text-white border-0">
                    <Upload className="w-4 h-4 mr-1" />변경
                  </Button>
                  <Button onClick={() => { setCoupleImage(null); setFileName(""); setResults([]); }} size="sm" className="bg-black/70 hover:bg-black text-white border-0">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="absolute bottom-0 inset-x-0 bg-black/60 py-2 px-3">
                  <p className="text-xs text-slate-300 truncate">{fileName}</p>
                </div>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
            <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/50">
              <p className="text-xs text-slate-400 font-medium mb-1">💡 잘 나오는 사진 조건</p>
              <div className="grid grid-cols-2 gap-x-4 text-xs text-slate-500">
                <p>✅ 두 분 얼굴이 잘 보이는 사진</p>
                <p>✅ 밝고 선명한 사진</p>
                <p>✅ 상반신 이상 나오는 사진</p>
                <p>❌ 너무 어둡거나 흐린 사진</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800 mb-6">
          <CardHeader><CardTitle className="text-white">🏞️ 웨딩 배경 선택</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {SCENES.map((s) => (
                <button key={s.key} onClick={() => setScene(s.key)}
                  className={`p-3 rounded-lg text-center border transition-all ${
                    scene === s.key ? "bg-rose-500/20 border-rose-500/60 text-white scale-105" : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                  }`}>
                  <div className="text-2xl mb-1">{s.emoji}</div>
                  <div className="text-xs font-semibold">{s.label}</div>
                  <div className="text-xs opacity-60 mt-0.5">{s.sub}</div>
                </button>
              ))}
            </div>
            <div>
              <p className="text-sm text-slate-400 mb-2">사진 비율</p>
              <div className="flex gap-2">
                {RATIOS.map((r) => (
                  <button key={r.key} onClick={() => setRatio(r.key)}
                    className={`px-4 py-2 rounded-lg text-sm border transition-all ${
                      ratio === r.key ? "bg-rose-500/20 border-rose-500/60 text-rose-300" : "bg-slate-800 border-slate-700 text-slate-400"
                    }`}>
                    {r.label}<span className="block text-xs opacity-60">{r.sub}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-800/40 border border-slate-700/50">
              <span className="text-slate-400 text-sm">⏱️ 예상 소요시간:</span>
              <span className="text-white text-sm font-semibold">{estimatedTime}</span>
            </div>
          </CardContent>
        </Card>

        {coupleImage && (
          <Button onClick={handleGenerate} disabled={isGenerating}
            className="w-full mb-6 bg-gradient-to-r from-rose-600 to-pink-500 hover:from-rose-700 hover:to-pink-600 text-white font-semibold py-6 text-lg">
            {isGenerating
              ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />배경 합성 중... ({estimatedTime})</>
              : <><Heart className="w-5 h-5 mr-2 fill-white" />웨딩 사진 만들기</>}
          </Button>
        )}

        {isGenerating && currentStep >= 0 && (
          <Card className="bg-slate-900/50 border-slate-800 mb-6">
            <CardHeader><CardTitle className="text-white">처리 진행 상황</CardTitle></CardHeader>
            <CardContent>
              <ProgressSteps currentStep={currentStep} />
              <p className="text-xs text-slate-600 mt-3 text-center">페이지를 닫지 마세요</p>
            </CardContent>
          </Card>
        )}

        {results.length > 0 && (
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-white">💑 완성된 웨딩 사진</CardTitle>
                <Button onClick={handleGenerate} variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-800">
                  <RefreshCw className="w-4 h-4 mr-1" />다시 생성
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.map((img, idx) => (
                  <div key={idx} className="relative group rounded-lg overflow-hidden border border-rose-500/30">
                    <img src={img.url} alt={`웨딩 ${idx+1}`} className="w-full aspect-[4/3] object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <Button onClick={() => handleDownload(img.url, idx)} size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 hover:bg-white text-black font-semibold">
                        <Download className="w-4 h-4 mr-2" />다운로드
                      </Button>
                    </div>
                    <div className="absolute bottom-0 inset-x-0 bg-black/60 py-1.5 px-3 flex justify-between">
                      <p className="text-xs text-slate-300">#{idx+1}</p>
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
