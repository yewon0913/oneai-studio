import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, Download, X, ArrowLeft, Sparkles, RefreshCw, Trash2, ChevronDown, ImageIcon } from "lucide-react";
import { toast } from "sonner";

interface BackgroundAnalysis {
  venueType: string;
  timeOfDay: string;
  lighting: string;
  colorTone: string;
  season: string;
  architectureStyle: string;
  mood: string;
  promptDescription: string;
}

function PhotoBox({ label, emoji, image, fileName, onSelect, onClear, inputRef, isLoading, badge }: {
  label: string; emoji: string; image: string | null; fileName: string;
  onSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void; inputRef: React.RefObject<HTMLInputElement | null>;
  isLoading?: boolean; badge?: string;
}) {
  return (
    <div className="flex-1">
      <p className="text-sm font-medium text-slate-400 mb-2">{emoji} {label}</p>
      {!image ? (
        <div onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-slate-600 rounded-xl aspect-[3/4] flex flex-col items-center justify-center cursor-pointer hover:border-purple-500/50 transition-colors bg-slate-800/30">
          <Upload className="w-8 h-8 text-slate-500 mb-2" />
          <p className="text-xs text-slate-500">사진 업로드</p>
          {badge && <p className="text-xs text-purple-400/70 mt-1">{badge}</p>}
        </div>
      ) : (
        <div className="relative rounded-xl overflow-hidden border border-purple-500/30 aspect-[3/4]">
          <img src={image} alt={label} className="w-full h-full object-cover" />
          {isLoading && (
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-purple-400 mb-2" />
              <p className="text-xs text-purple-300">AI 분석 중…</p>
            </div>
          )}
          <div className="absolute top-2 right-2 flex gap-1">
            <button onClick={() => inputRef.current?.click()}
              className="bg-black/70 hover:bg-black rounded-lg px-2 py-1 text-xs text-white"
              disabled={isLoading}>변경</button>
            <button onClick={onClear}
              className="bg-black/70 hover:bg-red-500/80 rounded-lg p-1 text-white"
              disabled={isLoading}>
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

function BgAnalysisPanel({ analysis, isLoading }: { analysis: BackgroundAnalysis | null; isLoading: boolean }) {
  const [expanded, setExpanded] = useState(true);
  if (!analysis && !isLoading) return null;

  return (
    <div className="rounded-lg border border-blue-500/30 bg-slate-800/40 overflow-hidden">
      <button onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800/60 transition-colors">
        <span className="text-sm font-semibold text-slate-300">🏞️ 배경 AI 분석 결과</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && (
        <div className="px-4 py-3 border-t border-slate-700/50">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400 mr-2" />
              <span className="text-xs text-slate-400">배경 분석 중…</span>
            </div>
          ) : analysis ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-slate-500">장소:</span> <span className="text-slate-300">{analysis.venueType}</span></div>
                <div><span className="text-slate-500">시간대:</span> <span className="text-slate-300">{analysis.timeOfDay}</span></div>
                <div><span className="text-slate-500">조명:</span> <span className="text-slate-300">{analysis.lighting}</span></div>
                <div><span className="text-slate-500">색감:</span> <span className="text-slate-300">{analysis.colorTone}</span></div>
                <div><span className="text-slate-500">계절:</span> <span className="text-slate-300">{analysis.season}</span></div>
                <div><span className="text-slate-500">분위기:</span> <span className="text-slate-300">{analysis.mood}</span></div>
              </div>
              <div className="mt-2 p-2 bg-slate-900/50 rounded text-xs text-slate-300">
                <p className="text-slate-500 mb-1">📝 배경 묘사:</p>
                <p className="line-clamp-3">{analysis.promptDescription}</p>
              </div>
              <p className="text-xs text-green-400">✅ 프롬프트에 자동 반영됨</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function GeminiWedding() {
  const [, setLocation] = useLocation();

  // 신부/신랑 원본 이미지 (삭제 안 함 - 얼굴 일관성)
  const [brideImage, setBrideImage]       = useState<string | null>(null);
  const [brideFileName, setBrideFileName] = useState("");
  const [brideMime, setBrideMime]         = useState<"image/jpeg"|"image/png"|"image/webp">("image/jpeg");
  const [groomImage, setGroomImage]       = useState<string | null>(null);
  const [groomFileName, setGroomFileName] = useState("");
  const [groomMime, setGroomMime]         = useState<"image/jpeg"|"image/png"|"image/webp">("image/jpeg");

  // 배경 이미지 (분석 후 삭제)
  const [bgImage, setBgImage]             = useState<string | null>(null);
  const [bgFileName, setBgFileName]       = useState("");
  const [bgMime, setBgMime]               = useState<"image/jpeg"|"image/png"|"image/webp">("image/jpeg");
  const [bgAnalysis, setBgAnalysis]       = useState<BackgroundAnalysis | null>(null);
  const [isAnalyzingBg, setIsAnalyzingBg] = useState(false);

  // 프롬프트
  const [customPrompt, setCustomPrompt]   = useState("");
  const [useCustom, setUseCustom]         = useState(false);

  // 생성
  const [isGenerating, setIsGenerating]   = useState(false);
  const [generatingStep, setGeneratingStep] = useState("");
  const [results, setResults]             = useState<{ url: string; log: string }[]>([]);
  const [originalGeminiImages, setOriginalGeminiImages] = useState<string[]>([]);
  const [showOriginal, setShowOriginal]   = useState(false);
  const [faceSwapSteps, setFaceSwapSteps] = useState<string[]>([]);
  const [faceSwapSuccess, setFaceSwapSuccess] = useState(false);

  const brideRef = useRef<HTMLInputElement>(null);
  const groomRef = useRef<HTMLInputElement>(null);
  const bgRef    = useRef<HTMLInputElement>(null);

  const mutation   = trpc.geminiWedding.generate.useMutation();
  const analyzeBgM = trpc.geminiWedding.analyzeBackground.useMutation();

  const makeImageHandler = (
    setImg: (v: string) => void,
    setName: (v: string) => void,
    setMime: (v: "image/jpeg"|"image/png"|"image/webp") => void
  ) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("10MB 이하만 가능합니다"); return; }
    setMime((file.type as any) || "image/jpeg");
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImg(ev.target?.result as string);
      setName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("10MB 이하만 가능합니다"); return; }
    const mime = (file.type as "image/jpeg"|"image/png"|"image/webp") || "image/jpeg";
    setBgMime(mime);
    setBgAnalysis(null);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64Full = ev.target?.result as string;
      setBgImage(base64Full);
      setBgFileName(file.name);

      // 배경 분석 시작
      setIsAnalyzingBg(true);
      try {
        const base64Data = base64Full.includes(",") ? base64Full.split(",")[1] : base64Full;
        const result = await analyzeBgM.mutateAsync({ imageBase64: base64Data, mimeType: mime });
        setBgAnalysis(result);

        // 배경 이미지 자동 삭제 (분석 완료 후)
        setBgImage(null);
        setBgFileName("");
        toast.success("배경 분석 완료 ✅ (이미지 보안 삭제됨)");
      } catch (err) {
        console.error(err);
        toast.error("배경 분석 실패");
        setBgImage(null);
        setBgFileName("");
      } finally {
        setIsAnalyzingBg(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!brideImage) { toast.error("신부 사진을 업로드해주세요"); return; }
    if (!groomImage) { toast.error("신랑 사진을 업로드해주세요"); return; }

    setIsGenerating(true);
    setResults([]);
    setOriginalGeminiImages([]);
    setFaceSwapSteps([]);
    setFaceSwapSuccess(false);
    setShowOriginal(false);

    try {
      setGeneratingStep("1단계: Gemini 웨딩 이미지 생성 중...");

      const formData = new FormData();
      const brideDataUrl = brideImage.startsWith("data:") ? brideImage : `data:${brideMime};base64,${brideImage}`;
      const groomDataUrl = groomImage.startsWith("data:") ? groomImage : `data:${groomMime};base64,${groomImage}`;
      const brideBlob = await fetch(brideDataUrl).then(r => r.blob());
      const groomBlob = await fetch(groomDataUrl).then(r => r.blob());
      formData.append("bride", brideBlob, "bride.jpg");
      formData.append("groom", groomBlob, "groom.jpg");
      if (useCustom && customPrompt.trim()) {
        formData.append("customPrompt", customPrompt.trim());
      }
      formData.append("faceStrength", "0.85");
      formData.append("restoreFidelity", "0.75");
      formData.append("useCodeFormer", "true");
      formData.append("autoFaceSwap", "true");

      setGeneratingStep("2단계: 얼굴 교체 중... (FAL Reactor)");
      const res = await fetch("/api/gemini-faceswap/run", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText);
      }
      const data = await res.json();

      setGeneratingStep("3단계: 얼굴 선명화 완료!");

      const images = (data.images || []).map((url: string, i: number) => ({
        url: url.startsWith("data:") ? url : `data:image/jpeg;base64,${url}`,
        log: data.faceSwapSuccess ? `v4.0 ✅ face-swap` : `v4.0 (Gemini only)`,
      }));
      setResults(images);
      setOriginalGeminiImages(data.originalGeminiImages || []);
      setFaceSwapSteps(data.faceSwapSteps || []);
      setFaceSwapSuccess(!!data.faceSwapSuccess);
      toast.success(`웨딩 사진 ${images.length}장 완성! 💑`);
    } catch (err) {
      console.error(err);
      toast.error("생성 실패. 다시 시도해주세요.");
    } finally {
      setIsGenerating(false);
      setGeneratingStep("");
    }
  };

  const handleDownload = (url: string, idx: number) => {
    const a = document.createElement("a");
    a.href = url; a.download = `gemini-wedding-${idx + 1}.png`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const bothReady = !!brideImage && !!groomImage;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">

        {/* 헤더 */}
        <div className="mb-8">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/")}
            className="mb-4 gap-2 text-slate-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" />돌아가기
          </Button>
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="w-8 h-8 text-purple-400" />
            <h1 className="text-3xl font-bold text-white">Gemini AI 웨딩</h1>
            <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full border border-purple-500/30">v4.0</span>
          </div>
          <p className="text-slate-400 mb-3">각자 사진만 있어도 OK — 원본 얼굴 그대로 웨딩 사진을 만들어드립니다</p>
          <div className="flex gap-2 flex-wrap">
            <span className="text-xs bg-purple-500/20 text-purple-400 px-3 py-1 rounded-full border border-purple-500/30">✨ Gemini Imagen 3</span>
            <span className="text-xs bg-green-500/20 text-green-400 px-3 py-1 rounded-full border border-green-500/30">👤 원본 얼굴 직접 전송</span>
            <span className="text-xs bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full border border-blue-500/30">🏞️ 배경 AI 분석</span>
          </div>
        </div>

        {/* 신부 / 신랑 사진 */}
        <Card className="mb-5 border-slate-700 bg-slate-800/40">
          <CardHeader>
            <CardTitle className="text-white">👰🤵 신부 · 신랑 사진</CardTitle>
            <p className="text-xs text-slate-500">원본 이미지를 Gemini에 직접 전송 → 얼굴 일관성 최대화</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <PhotoBox label="신부" emoji="👰"
                image={brideImage} fileName={brideFileName}
                onSelect={makeImageHandler(setBrideImage, setBrideFileName, setBrideMime)}
                onClear={() => { setBrideImage(null); setBrideFileName(""); }}
                inputRef={brideRef}
                badge="원본 유지" />
              <div className="flex items-center justify-center text-2xl">💍</div>
              <PhotoBox label="신랑" emoji="🤵"
                image={groomImage} fileName={groomFileName}
                onSelect={makeImageHandler(setGroomImage, setGroomFileName, setGroomMime)}
                onClear={() => { setGroomImage(null); setGroomFileName(""); }}
                inputRef={groomRef}
                badge="원본 유지" />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 p-3 rounded-lg bg-slate-800/40 border border-slate-700/50">
              <p>✅ 정면 얼굴이 잘 보이는 사진</p>
              <p>✅ 밝고 선명한 사진</p>
              <p>✅ 드레스/정장 입은 모습</p>
              <p>✅ 배경은 상관없음</p>
            </div>
          </CardContent>
        </Card>

        {/* 배경 사진 */}
        <Card className="mb-5 border-slate-700 bg-slate-800/40">
          <CardHeader>
            <CardTitle className="text-white text-base">🏞️ 배경 사진 (선택)</CardTitle>
            <p className="text-xs text-slate-500">웨딩 배경을 참고할 사진 업로드 — AI가 분석해서 자동 적용</p>
          </CardHeader>
          <CardContent>
            {!bgAnalysis ? (
              <div className="flex gap-4">
                <div className="flex-1">
                  {!bgImage ? (
                    <div onClick={() => bgRef.current?.click()}
                      className="border-2 border-dashed border-slate-600 rounded-xl aspect-video flex flex-col items-center justify-center cursor-pointer hover:border-blue-500/50 transition-colors bg-slate-800/30">
                      <ImageIcon className="w-8 h-8 text-slate-500 mb-2" />
                      <p className="text-xs text-slate-500">배경 사진 업로드</p>
                      <p className="text-xs text-slate-600 mt-1">선택사항</p>
                    </div>
                  ) : (
                    <div className="relative rounded-xl overflow-hidden border border-blue-500/30 aspect-video">
                      <img src={bgImage} alt="Background" className="w-full h-full object-cover" />
                      {isAnalyzingBg && (
                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                          <Loader2 className="w-5 h-5 animate-spin text-blue-400 mb-1" />
                          <p className="text-xs text-blue-300">배경 분석 중...</p>
                        </div>
                      )}
                    </div>
                  )}
                  <input ref={bgRef as any} type="file" accept="image/*" onChange={handleBgUpload} className="hidden" />
                </div>
                <div className="flex-1 text-xs text-slate-400 space-y-1 pt-2">
                  <p>📸 어떤 사진이든 OK</p>
                  <p>🌸 벚꽃/정원/해변</p>
                  <p>⛪ 채플/홀/스튜디오</p>
                  <p>🏙️ 도심/루프탑/카페</p>
                  <p className="text-slate-500 mt-2">없으면 기본 배경 사용</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <BgAnalysisPanel analysis={bgAnalysis} isLoading={isAnalyzingBg} />
                <Button variant="outline" size="sm"
                  onClick={() => { setBgAnalysis(null); }}
                  className="border-slate-600 text-slate-400 hover:bg-slate-800 text-xs">
                  <X className="w-3 h-3 mr-1" />배경 제거
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 커스텀 프롬프트 */}
        <Card className="mb-5 border-slate-700 bg-slate-800/40">
          <CardHeader>
            <CardTitle className="text-white text-base">📝 프롬프트 설정</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <button onClick={() => setUseCustom(!useCustom)}
                className={`relative w-10 h-5 rounded-full transition-colors ${useCustom ? "bg-purple-500" : "bg-slate-600"}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${useCustom ? "left-5" : "left-0.5"}`} />
              </button>
              <span className="text-sm text-slate-400">직접 프롬프트 입력</span>
              {!useCustom && (
                <span className="text-xs text-green-400">
                  {bgAnalysis ? "✅ 배경 분석 자동 적용" : "✅ AI 자동 생성"}
                </span>
              )}
            </div>
            {useCustom && (
              <Textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="직접 프롬프트 입력..."
                rows={4} className="bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-600 resize-none text-xs" />
            )}
          </CardContent>
        </Card>

        {/* 생성 버튼 */}
        <Button onClick={handleGenerate}
          disabled={!bothReady || isGenerating}
          className="w-full mb-6 h-12 text-base font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50">
          {isGenerating
            ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />{generatingStep || "생성 중... (약 60초)"}</>
            : !bothReady
            ? <><Upload className="w-4 h-4 mr-2" />신부 · 신랑 사진을 업로드해주세요</>
            : <><Sparkles className="w-4 h-4 mr-2" />✨ Gemini로 웨딩 사진 만들기 (2장)</>}
        </Button>

        {/* 결과 */}
        {results.length > 0 && (
          <Card className="border-slate-700 bg-slate-800/40">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white">💑 생성 완료!</CardTitle>
              <div className="flex gap-2">
                <Button onClick={handleGenerate} variant="outline" size="sm"
                  className="border-slate-600 text-slate-300 hover:bg-slate-800">
                  <RefreshCw className="w-4 h-4 mr-1" />다시 생성
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setResults([])} className="text-slate-400">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.map((r, idx) => (
                  <div key={idx} className="rounded-lg overflow-hidden border border-slate-700">
                    {r.url ? (
                      <>
                        <img src={r.url} alt={`Result ${idx + 1}`} className="w-full h-auto" />
                        <div className="p-3 bg-slate-900/50 flex items-center justify-between">
                          <span className="text-xs text-slate-400">#{idx + 1} · {r.log}</span>
                          <Button variant="ghost" size="sm" onClick={() => handleDownload(r.url, idx)}
                            className="text-slate-300 hover:text-white gap-1">
                            <Download className="w-3 h-3" />다운로드
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="p-8 text-center text-slate-500">❌ {r.log}</div>
                    )}
                  </div>
                ))}
              </div>
              {/* Face-Swap 단계 로그 */}
              {faceSwapSteps.length > 0 && (
                <div className="mt-4 p-3 rounded-lg bg-slate-900/60 border border-slate-700">
                  <p className="text-xs font-semibold text-slate-400 mb-2">🔄 처리 단계</p>
                  <div className="space-y-1">
                    {faceSwapSteps.map((step, i) => (
                      <p key={i} className="text-xs text-slate-500">{step}</p>
                    ))}
                  </div>
                </div>
              )}
              {/* 원본 Gemini 이미지 비교 토글 */}
              {originalGeminiImages.length > 0 && (
                <div className="mt-3">
                  <button onClick={() => setShowOriginal(!showOriginal)}
                    className="text-xs text-slate-500 hover:text-slate-300 underline">
                    {showOriginal ? "▲ Gemini 원본 숨기기" : "▼ Gemini 원본 보기 (face-swap 전)"}
                  </button>
                  {showOriginal && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {originalGeminiImages.map((url, i) => (
                        <div key={i} className="rounded-lg overflow-hidden border border-slate-700/50">
                          <img src={url.startsWith("data:") ? url : `data:image/jpeg;base64,${url}`}
                            alt={`Gemini original ${i + 1}`} className="w-full h-auto" />
                          <p className="text-xs text-center text-slate-600 py-1">Gemini 원본 #{i + 1}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="mt-4 p-3 rounded-lg bg-purple-500/10 border border-purple-500/30">
                <p className="text-xs text-purple-300">
                  {faceSwapSuccess
                    ? "✅ Gemini 생성 → FAL Reactor 얼굴 교체 완료. 정면 사진일수록 더 좋아요."
                    : "💡 Gemini 생성 완료 (FAL KEY 미설정 시 face-swap 스킵). 정면 사진일수록 더 좋아요."}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
