import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, Download, X, ArrowLeft, Sparkles, RefreshCw, Trash2, ChevronDown } from "lucide-react";
import { toast } from "sonner";

interface AnalysisResult {
  skinTone: string;
  skinTexture: string;
  faceShape: string;
  eyeShape: string;
  hasGlasses: boolean;
  glassesStyle: string;
  hasBear: boolean;
  bearStyle: string;
  hairStyle: string;
  hairColor: string;
  pose: string;
  gaze: string;
  expression: string;
  makeupLevel: string;
  lightingType: string;
  lightingDirection: string;
  shadowPresence: string;
  background: string;
  outfit: string;
  mood: string;
  generatedPrompt: string;
  generatedNegative: string;
}

function PhotoBox({ label, emoji, image, fileName, onSelect, onClear, inputRef, isAnalyzing }: {
  label: string; emoji: string; image: string | null; fileName: string;
  onSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void; inputRef: React.RefObject<HTMLInputElement | null>; isAnalyzing?: boolean;
}) {
  return (
    <div className="flex-1">
      <p className="text-sm font-medium text-slate-400 mb-2">{emoji} {label}</p>
      {!image ? (
        <div onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-slate-600 rounded-xl aspect-[3/4] flex flex-col items-center justify-center cursor-pointer hover:border-purple-500/50 transition-colors bg-slate-800/30">
          <Upload className="w-8 h-8 text-slate-500 mb-2" />
          <p className="text-xs text-slate-500">얼굴 사진 업로드</p>
          <p className="text-xs text-slate-600 mt-1">정면 사진 권장</p>
        </div>
      ) : (
        <div className="relative rounded-xl overflow-hidden border border-purple-500/30 aspect-[3/4]">
          <img src={image} alt={label} className="w-full h-full object-cover" />
          <div className="absolute top-2 right-2 flex gap-1">
            <button onClick={() => inputRef.current?.click()} className="bg-black/70 hover:bg-black rounded-lg px-2 py-1 text-xs text-white">변경</button>
            <button onClick={onClear} className="bg-black/70 hover:bg-red-500/80 rounded-lg p-1 text-white transition-colors" disabled={isAnalyzing}>
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
          <div className="absolute bottom-0 inset-x-0 bg-black/60 py-1 text-center">
            <p className="text-xs text-slate-300 truncate px-2">{fileName}</p>
          </div>
        </div>
      )}
      <input ref={inputRef as any} type="file" accept="image/*" onChange={onSelect} className="hidden" />
    </div>
  );
}

function AnalysisPanel({ label, analysis, isLoading }: {
  label: string; analysis: AnalysisResult | null; isLoading: boolean;
}) {
  const [expanded, setExpanded] = useState(true);

  if (!analysis && !isLoading) return null;

  return (
    <div className="rounded-lg border border-purple-500/30 bg-slate-800/40 overflow-hidden">
      <button onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800/60 transition-colors">
        <span className="text-sm font-semibold text-slate-300">✨ {label} AI 정밀 분석</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="px-4 py-3 border-t border-slate-700/50 space-y-3 max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-purple-400 mr-2" />
              <span className="text-xs text-slate-400">분석 중...</span>
            </div>
          ) : analysis ? (
            <>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-slate-500">피부톤:</span> <span className="text-slate-300">{analysis.skinTone}</span></div>
                <div><span className="text-slate-500">피부질감:</span> <span className="text-slate-300">{analysis.skinTexture}</span></div>
                <div><span className="text-slate-500">얼굴형:</span> <span className="text-slate-300">{analysis.faceShape}</span></div>
                <div><span className="text-slate-500">눈 모양:</span> <span className="text-slate-300">{analysis.eyeShape}</span></div>
                <div><span className="text-slate-500">머리 스타일:</span> <span className="text-slate-300">{analysis.hairStyle}</span></div>
                <div><span className="text-slate-500">머리 색상:</span> <span className="text-slate-300">{analysis.hairColor}</span></div>
                <div><span className="text-slate-500">자세:</span> <span className="text-slate-300">{analysis.pose}</span></div>
                <div><span className="text-slate-500">시선:</span> <span className="text-slate-300">{analysis.gaze}</span></div>
                <div><span className="text-slate-500">표정:</span> <span className="text-slate-300">{analysis.expression}</span></div>
                <div><span className="text-slate-500">메이크업:</span> <span className="text-slate-300">{analysis.makeupLevel}</span></div>
                <div><span className="text-slate-500">조명:</span> <span className="text-slate-300">{analysis.lightingType}</span></div>
                <div><span className="text-slate-500">배경:</span> <span className="text-slate-300">{analysis.background}</span></div>
              </div>
              <div className="border-t border-slate-700/50 pt-3 space-y-2">
                <div>
                  <p className="text-xs text-slate-500 mb-1">📝 생성 프롬프트:</p>
                  <p className="text-xs text-slate-300 bg-slate-900/50 p-2 rounded line-clamp-4">{analysis.generatedPrompt}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">🚫 네거티브 프롬프트:</p>
                  <p className="text-xs text-slate-300 bg-slate-900/50 p-2 rounded line-clamp-2">{analysis.generatedNegative}</p>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function GeminiWedding() {
  const [, setLocation] = useLocation();
  const [brideImage, setBrideImage]         = useState<string | null>(null);
  const [brideFileName, setBrideFileName]   = useState("");
  const [brideMime, setBrideMime]           = useState<"image/jpeg"|"image/png"|"image/webp">("image/jpeg");
  const [groomImage, setGroomImage]         = useState<string | null>(null);
  const [groomFileName, setGroomFileName]   = useState("");
  const [groomMime, setGroomMime]           = useState<"image/jpeg"|"image/png"|"image/webp">("image/jpeg");
  const [scene, setScene]                   = useState("cherry_blossom");
  const [customPrompt, setCustomPrompt]     = useState("");
  const [useCustom, setUseCustom]           = useState(false);
  const [isGenerating, setIsGenerating]     = useState(false);
  const [results, setResults]               = useState<{ url: string; log: string }[]>([]);
  const [brideAnalysis, setBrideAnalysis]   = useState<AnalysisResult | null>(null);
  const [groomAnalysis, setGroomAnalysis]   = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing]       = useState(false);

  const brideRef = useRef<HTMLInputElement>(null);
  const groomRef = useRef<HTMLInputElement>(null);
  const mutation = trpc.geminiWedding.generate.useMutation();
  const analyzeImageMutation = trpc.geminiWedding.analyzeImage.useMutation();

  const makeHandler = (
    setImg: (v: string) => void,
    setName: (v: string) => void,
    setMime: (v: "image/jpeg"|"image/png"|"image/webp") => void,
    setAnalysis: (v: AnalysisResult | null) => void
  ) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("10MB 이하만 가능합니다"); return; }
    setMime((file.type as "image/jpeg"|"image/png"|"image/webp") || "image/jpeg");
    setAnalysis(null);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      setImg(base64);
      setName(file.name);
      
      // 자동 분석 실행
      setIsAnalyzing(true);
      try {
        const base64Data = base64.includes(",") ? base64.split(",")[1] : base64;
        const result = await analyzeImageMutation.mutateAsync({
          imageBase64: base64Data,
          mimeType: (file.type as "image/jpeg"|"image/png"|"image/webp") || "image/jpeg",
        });
        setAnalysis(result);
        toast.success("분석 완료!");
      } catch (err) {
        console.error(err);
        toast.error("분석 실패");
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!brideImage) { toast.error("신부 사진을 업로드해주세요"); return; }
    if (!groomImage) { toast.error("신랑 사진을 업로드해주세요"); return; }
    setIsGenerating(true);
    setResults([]);
    try {
      const brideBase64 = brideImage.includes(",") ? brideImage.split(",")[1] : brideImage;
      const groomBase64 = groomImage.includes(",") ? groomImage.split(",")[1] : groomImage;
      const result = await mutation.mutateAsync({
        brideImageBase64: brideBase64,
        brideMimeType: brideMime,
        groomImageBase64: groomBase64,
        groomMimeType: groomMime,
        scene: scene as any,
        customPrompt: useCustom && customPrompt.trim() ? customPrompt.trim() : undefined,
      });
      setResults(result.images);
      toast.success(`웨딩 사진 ${result.images.length}장 완성! 💑`);
    } catch (err) {
      console.error(err);
      toast.error("생성 실패. 사진을 확인하고 다시 시도해주세요.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = (url: string, idx: number) => {
    const a = document.createElement("a");
    a.href = url; a.download = `gemini-wedding-${idx + 1}.png`; a.target = "_blank";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const handleClearResults = () => {
    setResults([]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="mb-4 gap-2 text-slate-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" />돌아가기
          </Button>
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="w-8 h-8 text-purple-400" />
            <h1 className="text-3xl font-bold text-white">Gemini AI 웨딩</h1>
            <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full border border-purple-500/30">BETA</span>
          </div>
          <p className="text-slate-400 mb-3">각자 사진만 있어도 OK — Gemini가 웨딩 사진을 만들어드립니다</p>
          <div className="flex gap-2 flex-wrap">
            <span className="text-xs bg-purple-500/20 text-purple-400 px-3 py-1 rounded-full border border-purple-500/30">✨ Flux LoRA + Imagen 3.0</span>
            <span className="text-xs bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full border border-blue-500/30">👰🤵 각자 사진 가능</span>
            <span className="text-xs bg-rose-500/20 text-rose-400 px-3 py-1 rounded-full border border-rose-500/30">🎩 자동 웨딩룩</span>
            <span className="text-xs bg-green-500/20 text-green-400 px-3 py-1 rounded-full border border-green-500/30">🔄 95%+ 얼굴 일관성</span>
          </div>
        </div>

        <Card className="bg-slate-900/50 border-slate-800 mb-5">
          <CardHeader><CardTitle className="text-white">👰🤵 신부 · 신랑 사진 업로드</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <PhotoBox label="신부" emoji="👰" image={brideImage} fileName={brideFileName}
                onSelect={makeHandler(setBrideImage, setBrideFileName, setBrideMime, setBrideAnalysis)}
                onClear={() => { setBrideImage(null); setBrideFileName(""); setBrideAnalysis(null); }} 
                inputRef={brideRef} isAnalyzing={isAnalyzing} />
              <div className="flex items-center justify-center text-2xl">💍</div>
              <PhotoBox label="신랑" emoji="🤵" image={groomImage} fileName={groomFileName}
                onSelect={makeHandler(setGroomImage, setGroomFileName, setGroomMime, setGroomAnalysis)}
                onClear={() => { setGroomImage(null); setGroomFileName(""); setGroomAnalysis(null); }} 
                inputRef={groomRef} isAnalyzing={isAnalyzing} />
            </div>
            <div className="grid grid-cols-2 gap-x-4 text-xs text-slate-500 p-3 rounded-lg bg-slate-800/40 border border-slate-700/50">
              <p>✅ 정면 얼굴이 잘 보이는 사진</p>
              <p>✅ 밝고 선명한 사진</p>
              <p>✅ 드레스/턱시도 없어도 OK</p>
              <p>❌ 측면·뒷모습 사진</p>
            </div>
          </CardContent>
        </Card>

        {(brideAnalysis || groomAnalysis || isAnalyzing) && (
          <div className="space-y-3 mb-5">
            <AnalysisPanel label="신부" analysis={brideAnalysis} isLoading={isAnalyzing && !brideAnalysis} />
            <AnalysisPanel label="신랑" analysis={groomAnalysis} isLoading={isAnalyzing && !groomAnalysis} />
          </div>
        )}

        <Card className="bg-slate-900/50 border-slate-800 mb-5">
          <CardHeader><CardTitle className="text-white">🏞️ 배경 선택</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-5 gap-2">
              {[
                { key: "cherry_blossom", emoji: "🌸", label: "벚꽃 정원" },
                { key: "chapel",         emoji: "⛪", label: "고급 채플" },
                { key: "garden",         emoji: "🌿", label: "야외 정원" },
                { key: "beach",          emoji: "🌅", label: "해변 노을" },
                { key: "studio",         emoji: "📸", label: "스튜디오" },
              ].map((s) => (
                <button key={s.key} onClick={() => setScene(s.key)}
                  className={`p-3 rounded-xl text-center border transition-all ${scene === s.key ? "bg-purple-500/20 border-purple-500/60 text-white scale-105" : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"}`}>
                  <div className="text-xl mb-1">{s.emoji}</div>
                  <div className="text-xs font-semibold">{s.label}</div>
                </button>
              ))}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <button onClick={() => setUseCustom(!useCustom)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${useCustom ? "bg-purple-500" : "bg-slate-600"}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${useCustom ? "left-5" : "left-0.5"}`} />
                </button>
                <span className="text-sm text-slate-400">직접 프롬프트 입력</span>
              </div>
              {useCustom && (
                <Textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="예) Create a photorealistic wedding photo, Eiffel Tower background..."
                  rows={3} className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 resize-none text-sm" />
              )}
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleGenerate} disabled={!brideImage || !groomImage || isGenerating || isAnalyzing}
          className="w-full mb-5 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white font-semibold py-6 text-lg disabled:opacity-40">
          {isGenerating
            ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Gemini 생성 중... (~1분)</>
            : <><Sparkles className="w-5 h-5 mr-2" />Gemini로 웨딩 사진 만들기 (2장)</>}
        </Button>

        {results.length > 0 && (
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">💑 생성된 웨딩 사진</CardTitle>
                <div className="flex gap-2">
                  <Button onClick={handleGenerate} variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-800">
                    <RefreshCw className="w-4 h-4 mr-1" />다시 생성
                  </Button>
                  <Button onClick={handleClearResults} variant="outline" size="sm" className="border-red-600/50 text-red-400 hover:bg-red-500/10">
                    <Trash2 className="w-4 h-4 mr-1" />삭제
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.map((img, idx) => (
                  <div key={idx} className="relative group rounded-xl overflow-hidden border border-purple-500/30">
                    {img.url ? (
                      <>
                        <img src={img.url} alt={`웨딩 ${idx + 1}`} className="w-full aspect-[3/4] object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                          <Button onClick={() => handleDownload(img.url, idx)} size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 hover:bg-white text-black font-semibold">
                            <Download className="w-4 h-4 mr-2" />다운로드
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="w-full aspect-[3/4] bg-slate-800 flex items-center justify-center">
                        <p className="text-sm text-red-400">{img.log}</p>
                      </div>
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-black/60 py-1.5 px-3">
                      <p className="text-xs text-slate-300">#{idx + 1} · Gemini</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 rounded-lg bg-purple-500/10 border border-purple-500/30">
                <p className="text-xs text-purple-300">💡 업그레이드: Flux LoRA + Imagen 3.0 기술로 95%+ 얼굴 일관성을 달성합니다. 정면 얼굴 사진일수록 결과가 좋아요.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
