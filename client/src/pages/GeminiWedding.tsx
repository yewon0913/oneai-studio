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
          <p className="text-xs text-purple-500/70 mt-1">분석 후 자동 삭제</p>
        </div>
      ) : (
        <div className="relative rounded-xl overflow-hidden border border-purple-500/30 aspect-[3/4]">
          <img src={image} alt={label} className="w-full h-full object-cover" />
          {isAnalyzing && (
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-purple-400 mb-2" />
              <p className="text-xs text-purple-300">AI 분석 중...</p>
            </div>
          )}
          <div className="absolute top-2 right-2 flex gap-1">
            <button onClick={() => inputRef.current?.click()}
              className="bg-black/70 hover:bg-black rounded-lg px-2 py-1 text-xs text-white"
              disabled={isAnalyzing}>변경</button>
            <button onClick={onClear}
              className="bg-black/70 hover:bg-red-500/80 rounded-lg p-1 text-white transition-colors"
              disabled={isAnalyzing}>
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
        <div className="px-4 py-3 border-t border-slate-700/50 space-y-3 max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-purple-400 mr-2" />
              <span className="text-xs text-slate-400">Claude Vision 분석 중...</span>
            </div>
          ) : analysis ? (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-slate-500">피부톤:</span> <span className="text-slate-300">{analysis.skinTone}</span></div>
              <div><span className="text-slate-500">얼굴형:</span> <span className="text-slate-300">{analysis.faceShape}</span></div>
              <div><span className="text-slate-500">눈 모양:</span> <span className="text-slate-300">{analysis.eyeShape}</span></div>
              <div><span className="text-slate-500">헤어:</span> <span className="text-slate-300">{analysis.hairStyle}</span></div>
              <div><span className="text-slate-500">표정:</span> <span className="text-slate-300">{analysis.expression}</span></div>
              <div><span className="text-slate-500">분위기:</span> <span className="text-slate-300">{analysis.mood}</span></div>
              {analysis.hasGlasses && (
                <div className="col-span-2 text-yellow-400">👓 안경 감지 → 자동 고정</div>
              )}
              {analysis.hasBear && (
                <div className="col-span-2 text-yellow-400">🧔 수염 감지 → 자동 유지</div>
              )}
            </div>
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

  const [brideAnalysis, setBrideAnalysis]   = useState<AnalysisResult | null>(null);
  const [groomAnalysis, setGroomAnalysis]   = useState<AnalysisResult | null>(null);
  const [isAnalyzingBride, setIsAnalyzingBride] = useState(false);
  const [isAnalyzingGroom, setIsAnalyzingGroom] = useState(false);

  const [mainPrompt, setMainPrompt]         = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [promptEdited, setPromptEdited]     = useState(false);

  const [isGenerating, setIsGenerating]     = useState(false);
  const [results, setResults]               = useState<{ url: string; log: string }[]>([]);

  const brideReady = !!brideAnalysis;
  const groomReady = !!groomAnalysis;
  const bothReady  = brideReady && groomReady;

  const brideRef = useRef<HTMLInputElement>(null);
  const groomRef = useRef<HTMLInputElement>(null);

  const mutation             = trpc.geminiWedding.generate.useMutation();
  const analyzeImageMutation = trpc.geminiWedding.analyzeImage.useMutation();

  const mergePrompts = (bride: AnalysisResult, groom: AnalysisResult) => {
    const merged = `Photorealistic professional Korean wedding photography.
Bride: ${bride.skinTone} skin, ${bride.faceShape} face, ${bride.eyeShape} eyes, ${bride.hairStyle}, ${bride.makeupLevel} makeup${bride.hasGlasses ? `, wearing ${bride.glassesStyle} glasses preserved` : ""}.
Groom: ${groom.skinTone} skin, ${groom.faceShape} face, ${groom.eyeShape} eyes, ${groom.hairStyle}${groom.hasBear ? `, ${groom.bearStyle} beard preserved` : ""}.
Both wearing elegant white wedding dress and black tuxedo.
Natural candid pose, slight body turn 15 degrees, relaxed shoulders, genuine smiles, eyes slightly off-camera.
${bride.lightingType.includes("outdoor") ? "Outdoor natural lighting, hard sunlight casting directional shadows, sun catchlight in eyes, ambient occlusion" : "Studio lighting, Rembrandt triangle on cheek, visible key light in eyes, hair light separation"}.
Skin pores visible, natural skin texture, subsurface scattering, film grain ISO 400.
Shot on Canon EOS R5, 85mm f/2.8, RAW photo, photorealistic, 8K.
NOT illustration, NOT digital art, NOT AI generated.`;
    setMainPrompt(merged);
    setNegativePrompt(bride.generatedNegative);
    setPromptEdited(false);
  };

  const makeHandler = (
    setImg: (v: string | null) => void,
    setName: (v: string) => void,
    setMime: (v: "image/jpeg"|"image/png"|"image/webp") => void,
    setAnalysis: (v: AnalysisResult | null) => void,
    setAnalyzing: (v: boolean) => void,
    otherAnalysis: AnalysisResult | null,
    isBride: boolean
  ) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("10MB 이하만 가능합니다"); return; }
    const mime = (file.type as "image/jpeg"|"image/png"|"image/webp") || "image/jpeg";
    setMime(mime);
    setAnalysis(null);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64Full = ev.target?.result as string;
      setImg(base64Full);
      setName(file.name);
      setAnalyzing(true);
      try {
        const base64Data = base64Full.includes(",") ? base64Full.split(",")[1] : base64Full;
        const result = await analyzeImageMutation.mutateAsync({
          imageBase64: base64Data,
          mimeType: mime,
        });
        setAnalysis(result as AnalysisResult);
        setImg(null);
        setName("");
        toast.success(`${isBride ? "신부" : "신랑"} 분석 완료 ✨ (이미지 보안 삭제됨)`);
        const bride = isBride ? (result as AnalysisResult) : otherAnalysis;
        const groom = isBride ? otherAnalysis : (result as AnalysisResult);
        if (bride && groom && !promptEdited) {
          mergePrompts(bride, groom);
          toast.success("메인/네거티브 프롬프트 자동 적용 완료 ✅");
        }
      } catch (err) {
        console.error(err);
        toast.error("분석 실패. 정면 얼굴 사진으로 다시 시도해주세요.");
        setImg(null);
        setName("");
      } finally {
        setAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!bothReady) { toast.error("신부/신랑 사진을 먼저 업로드하고 분석을 완료해주세요"); return; }
    if (!mainPrompt.trim()) { toast.error("프롬프트가 비어있어요"); return; }
    setIsGenerating(true);
    setResults([]);
    try {
      const result = await mutation.mutateAsync({
        brideAnalysis: brideAnalysis!,
        groomAnalysis: groomAnalysis!,
        mainPrompt: mainPrompt.trim(),
        negativePrompt: negativePrompt.trim(),
      });
      setResults(result.images);
      toast.success(`웨딩 사진 ${result.images.length}장 완성! 💑`);
    } catch (err) {
      console.error(err);
      toast.error("생성 실패. 다시 시도해주세요.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = (url: string, idx: number) => {
    const a = document.createElement("a");
    a.href = url; a.download = `gemini-wedding-${idx + 1}.png`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => setLocation("/")} className="text-slate-400 hover:text-slate-200">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-8 h-8 text-purple-400" />
            Gemini AI 웨딩
            <span className="text-xs bg-purple-600/30 text-purple-300 px-2 py-1 rounded-full">BETA</span>
          </h1>
        </div>

        <p className="text-slate-400 mb-6">각자 사진만 있어도 OK — Gemini가 웨딩 사진을 만들어 드립니다</p>

        {/* 사진 업로드 섹션 */}
        <Card className="border-slate-700 bg-slate-800/40 mb-6">
          <CardHeader>
            <CardTitle className="text-lg">👰 👨 신부·신랑 사진 업로드</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-4">
              <PhotoBox
                label="신부"
                emoji="👰"
                image={brideImage}
                fileName={brideFileName}
                onSelect={makeHandler(setBrideImage, setBrideFileName, setBrideMime, setBrideAnalysis, setIsAnalyzingBride, groomAnalysis, true)}
                onClear={() => { setBrideImage(null); setBrideFileName(""); setBrideAnalysis(null); }}
                inputRef={brideRef}
                isAnalyzing={isAnalyzingBride}
              />
              <div className="flex items-center justify-center">
                <div className="text-4xl">💍</div>
              </div>
              <PhotoBox
                label="신랑"
                emoji="👨"
                image={groomImage}
                fileName={groomFileName}
                onSelect={makeHandler(setGroomImage, setGroomFileName, setGroomMime, setGroomAnalysis, setIsAnalyzingGroom, brideAnalysis, false)}
                onClear={() => { setGroomImage(null); setGroomFileName(""); setGroomAnalysis(null); }}
                inputRef={groomRef}
                isAnalyzing={isAnalyzingGroom}
              />
            </div>

            {/* 체크리스트 */}
            <div className="rounded-lg bg-slate-900/50 p-3 text-xs space-y-1">
              <div className={`flex items-center gap-2 ${brideReady ? "text-green-400" : "text-slate-500"}`}>
                <span>{brideReady ? "✅" : "⭕"}</span> 정면 얼굴이 잘 보이는 사진
              </div>
              <div className={`flex items-center gap-2 ${groomReady ? "text-green-400" : "text-slate-500"}`}>
                <span>{groomReady ? "✅" : "⭕"}</span> 밝고 선명한 사진
              </div>
              <div className={`flex items-center gap-2 ${bothReady ? "text-green-400" : "text-slate-500"}`}>
                <span>{bothReady ? "✅" : "❌"}</span> 즉면·뒷모습 사진
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 분석 결과 */}
        {(brideAnalysis || isAnalyzingBride) && (
          <AnalysisPanel label="신부" analysis={brideAnalysis} isLoading={isAnalyzingBride} />
        )}
        {(groomAnalysis || isAnalyzingGroom) && (
          <AnalysisPanel label="신랑" analysis={groomAnalysis} isLoading={isAnalyzingGroom} />
        )}

        {/* 프롬프트 섹션 */}
        {bothReady && (
          <Card className="border-slate-700 bg-slate-800/40 my-6">
            <CardHeader>
              <CardTitle className="text-lg">📝 생성 프롬프트</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 mb-2 block">메인 프롬프트</label>
                <Textarea
                  value={mainPrompt}
                  onChange={(e) => { setMainPrompt(e.target.value); setPromptEdited(true); }}
                  className="bg-slate-900 border-slate-700 text-slate-200 text-xs h-24"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-2 block">네거티브 프롬프트</label>
                <Textarea
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  className="bg-slate-900 border-slate-700 text-slate-200 text-xs h-16"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* 생성 버튼 */}
        {bothReady && (
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !mainPrompt.trim()}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white mb-6 h-12 text-base"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                생성 중... (약 1분)
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Gemini로 웨딩 사진 만들기 (2장)
              </>
            )}
          </Button>
        )}

        {/* 결과 */}
        {results.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">✨ 생성 결과</h2>
            {results.map((result, idx) => (
              <Card key={idx} className="border-slate-700 bg-slate-800/40 overflow-hidden">
                <CardContent className="p-0">
                  {result.url ? (
                    <>
                      <img src={result.url} alt={`Result ${idx + 1}`} className="w-full h-auto" />
                      <div className="p-4 flex items-center justify-between bg-slate-900/50">
                        <span className="text-xs text-slate-400">#{idx + 1} · {result.log}</span>
                        <Button
                          onClick={() => handleDownload(result.url, idx)}
                          size="sm"
                          className="bg-purple-600 hover:bg-purple-700"
                        >
                          <Download className="w-3 h-3 mr-1" />
                          다운로드
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="p-8 text-center text-slate-400">
                      <p className="text-sm">{result.log}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
