/**
 * Memory Restoration Module - Independent Page
 */

import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2, Upload, Download, X, ArrowLeft,
  CheckCircle2, Sparkles, Play, Video, Image
} from "lucide-react";
import { toast } from "sonner";

type AnimationStyle = "calm" | "nostalgia" | "lively";
type Step = "idle" | "restoring" | "colorizing" | "generating" | "done";

const STYLE_INFO: Record<AnimationStyle, {
  label: string; description: string; emoji: string; color: string;
}> = {
  calm:      { label: "잔잔함", description: "눈 깜빡임, 잔잔한 미소",   emoji: "🕯️", color: "from-amber-600 to-yellow-500" },
  nostalgia: { label: "그리움", description: "고개 돌림, 따뜻한 눈빛",   emoji: "🌸", color: "from-rose-600 to-pink-500"   },
  lively:    { label: "생동감", description: "환한 미소, 손 흔들기",     emoji: "✨", color: "from-emerald-600 to-teal-500" },
};

const STEP_LIST: { key: Step; label: string; sub: string }[] = [
  { key: "restoring",  label: "사진 복원 중", sub: "손상·노이즈 제거 (CodeFormer)" },
  { key: "colorizing", label: "색상 복원 중", sub: "흑백 → 컬러 변환 (DeOldify)" },
  { key: "generating", label: "영상 생성 중", sub: "살아 움직이는 5초 영상 (Kling 3.0)" },
  { key: "done",       label: "완성!",        sub: "다운로드 가능" },
];

function StepIndicator({ current }: { current: Step }) {
  const order: Step[] = ["restoring", "colorizing", "generating", "done"];
  const currentIdx = order.indexOf(current);
  return (
    <div className="flex flex-col gap-3 p-4 rounded-lg bg-slate-800/60 border border-slate-700">
      {STEP_LIST.map((s, i) => {
        const isDone   = currentIdx > i;
        const isActive = current === s.key;
        return (
          <div key={s.key} className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
              isDone ? "bg-emerald-500" : isActive ? "bg-rose-500" : "bg-slate-700"
            }`}>
              {isDone   ? <CheckCircle2 className="w-4 h-4 text-white" /> :
               isActive ? <Loader2 className="w-4 h-4 text-white animate-spin" /> :
                          <span className="text-xs text-slate-500">{i + 1}</span>}
            </div>
            <div>
              <p className={`text-sm font-semibold ${
                isDone ? "text-emerald-400" : isActive ? "text-white" : "text-slate-500"
              }`}>{s.label}</p>
              <p className="text-xs text-slate-500">{s.sub}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Memory() {
  const [, setLocation] = useLocation();
  const [activeStyle, setActiveStyle]         = useState<AnimationStyle>("nostalgia");
  const [generateVideo, setGenerateVideo]     = useState(true);
  const [selectedImage, setSelectedImage]     = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [mimeType, setMimeType]               = useState<"image/jpeg" | "image/png" | "image/webp">("image/jpeg");
  const [step, setStep]                       = useState<Step>("idle");
  const [restoredImageUrl, setRestoredImageUrl]   = useState<string | null>(null);
  const [colorizedImageUrl, setColorizedImageUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl]               = useState<string | null>(null);
  const [wasGrayscale, setWasGrayscale]       = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateMemoryMutation = trpc.memory.generateMemory.useMutation();

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("파일 크기가 10MB를 초과합니다"); return; }
    if (!file.type.startsWith("image/")) { toast.error("이미지 파일만 선택할 수 있습니다"); return; }
    const mime = (file.type as "image/jpeg" | "image/png" | "image/webp") || "image/jpeg";
    setMimeType(mime);
    const reader = new FileReader();
    reader.onload = (e) => {
      setSelectedImage(e.target?.result as string);
      setSelectedFileName(file.name);
      setRestoredImageUrl(null);
      setColorizedImageUrl(null);
      setVideoUrl(null);
      setStep("idle");
    };
    reader.readAsDataURL(file);
  };

  const handleClearImage = () => {
    setSelectedImage(null);
    setSelectedFileName("");
    setRestoredImageUrl(null);
    setColorizedImageUrl(null);
    setVideoUrl(null);
    setStep("idle");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleGenerate = async () => {
    if (!selectedImage) { toast.error("사진을 먼저 선택해주세요"); return; }
    setStep("restoring");
    setRestoredImageUrl(null);
    setColorizedImageUrl(null);
    setVideoUrl(null);
    try {
      const base64Data = selectedImage.includes(",") ? selectedImage.split(",")[1] : selectedImage;
      const t1 = setTimeout(() => setStep("colorizing"), 15000);
      const t2 = setTimeout(() => setStep("generating"), 40000);
      const result = await generateMemoryMutation.mutateAsync({
        imageBase64: base64Data,
        mimeType,
        animationStyle: activeStyle,
        generateVideo,
      });
      clearTimeout(t1);
      clearTimeout(t2);
      setRestoredImageUrl(result.restoredImageUrl);
      setColorizedImageUrl(result.colorizedImageUrl);
      setVideoUrl(result.videoUrl);
      setWasGrayscale(result.wasGrayscale);
      setStep("done");
      toast.success("기억이 살아났습니다! 🎉");
    } catch (error) {
      console.error("Memory generation error:", error);
      setStep("idle");
      toast.error("처리 실패. 다시 시도해주세요.");
    }
  };

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isProcessing = step !== "idle" && step !== "done";
  const finalImageUrl = colorizedImageUrl || restoredImageUrl;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">

        <div className="mb-8">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/")}
            className="mb-4 gap-2 text-slate-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" />돌아가기
          </Button>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-4xl">⏱️</span>
            <h1 className="text-3xl font-bold text-white">AI 기억복원소</h1>
          </div>
          <p className="text-slate-400">오래된 사진을 고화질로 복원하고, 살아 움직이는 영상으로 만들어드립니다</p>
        </div>

        <Card className="bg-slate-900/50 border-slate-800 mb-6">
          <CardHeader><CardTitle className="text-white">영상 감성 선택</CardTitle></CardHeader>
          <CardContent className="space-y-6">

            <div className="grid grid-cols-3 gap-3">
              {(Object.entries(STYLE_INFO) as Array<[AnimationStyle, typeof STYLE_INFO[AnimationStyle]]>).map(([key, info]) => (
                <button key={key} onClick={() => setActiveStyle(key)}
                  className={`p-4 rounded-lg transition-all text-center ${
                    activeStyle === key
                      ? `bg-gradient-to-r ${info.color} text-white shadow-lg scale-105`
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}>
                  <div className="text-2xl mb-1">{info.emoji}</div>
                  <div className="font-semibold text-sm">{info.label}</div>
                  <div className="text-xs opacity-80 mt-1">{info.description}</div>
                </button>
              ))}
            </div>

            <div onClick={() => setGenerateVideo(!generateVideo)}
              className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all ${
                generateVideo ? "border-rose-500/50 bg-rose-500/10" : "border-slate-700 bg-slate-800/30"
              }`}>
              <Video className={`w-5 h-5 ${generateVideo ? "text-rose-400" : "text-slate-500"}`} />
              <div className="flex-1">
                <p className={`font-medium text-sm ${generateVideo ? "text-white" : "text-slate-400"}`}>영상 생성 포함</p>
                <p className="text-xs text-slate-500">
                  {generateVideo ? "복원 이미지 + 5초 영상 모두 생성 (~5~7분)" : "복원 이미지만 생성 (~1분)"}
                </p>
              </div>
              <div className={`w-10 h-6 rounded-full transition-all relative ${generateVideo ? "bg-rose-500" : "bg-slate-700"}`}>
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${generateVideo ? "left-5" : "left-1"}`} />
              </div>
            </div>

            {!selectedImage ? (
              <div onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-600 rounded-lg p-10 text-center cursor-pointer hover:border-rose-500/50 transition-colors bg-slate-800/30">
                <Upload className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                <h3 className="font-semibold text-white text-lg mb-2">오래된 사진을 올려주세요</h3>
                <p className="text-sm text-slate-400">JPG, PNG, WebP 지원 · 흑백 사진도 OK · 최대 10MB</p>
              </div>
            ) : (
              <div className="flex gap-4 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                <img src={selectedImage} alt="Selected" className="w-24 h-24 rounded-lg object-cover border border-rose-500/30 flex-shrink-0" />
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-semibold text-white mb-1">사진 선택됨</h3>
                    <p className="text-sm text-slate-400 truncate">{selectedFileName}</p>
                    <p className="text-xs text-slate-500 mt-1">{STYLE_INFO[activeStyle].emoji} {STYLE_INFO[activeStyle].label} 스타일로 복원합니다</p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => fileInputRef.current?.click()} variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-700">
                      <Upload className="w-4 h-4 mr-2" />다른 사진
                    </Button>
                    <Button onClick={handleClearImage} variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-700">
                      <X className="w-4 h-4 mr-2" />제거
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />

            {selectedImage && (
              <Button onClick={handleGenerate} disabled={isProcessing}
                className="w-full bg-gradient-to-r from-rose-600 to-pink-500 hover:from-rose-700 hover:to-pink-600 text-white font-semibold py-6 text-lg">
                {isProcessing
                  ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />처리 중... (잠시만 기다려주세요)</>
                  : <><Sparkles className="w-5 h-5 mr-2" />기억 복원 시작</>}
              </Button>
            )}
          </CardContent>
        </Card>

        {step !== "idle" && (
          <Card className="bg-slate-900/50 border-slate-800 mb-6">
            <CardHeader><CardTitle className="text-white">처리 진행 상황</CardTitle></CardHeader>
            <CardContent>
              <StepIndicator current={step} />
              {isProcessing && (
                <p className="text-xs text-slate-500 mt-3 text-center">
                  {generateVideo ? "영상 포함 시 총 5~7분 소요됩니다" : "복원 이미지만 생성 시 약 1분 소요됩니다"}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {step === "done" && (
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader><CardTitle className="text-white">🎉 복원 완료</CardTitle></CardHeader>
            <CardContent className="space-y-6">

              <div>
                <h3 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
                  <Image className="w-4 h-4" />복원된 사진
                  {wasGrayscale && (
                    <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">🎨 컬러화 완료</span>
                  )}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative rounded-lg overflow-hidden border border-slate-700">
                    <img src={selectedImage!} alt="원본" className="w-full aspect-[3/4] object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 py-2 text-center">
                      <p className="text-xs text-slate-300">원본</p>
                    </div>
                  </div>
                  {finalImageUrl && (
                    <div className="relative group rounded-lg overflow-hidden border border-rose-500/30">
                      <img src={finalImageUrl} alt="복원됨" className="w-full aspect-[3/4] object-cover" />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 py-2 text-center">
                        <p className="text-xs text-rose-300">{wasGrayscale ? "복원 + 컬러화" : "복원 완료"}</p>
                      </div>
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <Button onClick={() => handleDownload(finalImageUrl, "memory-restored.jpg")}
                          size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 hover:bg-white text-black font-semibold">
                          <Download className="w-4 h-4 mr-2" />다운로드
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {videoUrl && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
                    <Play className="w-4 h-4" />살아 움직이는 영상
                    <span className="text-xs bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded-full border border-rose-500/30">
                      {STYLE_INFO[activeStyle].emoji} {STYLE_INFO[activeStyle].label}
                    </span>
                  </h3>
                  <div className="relative rounded-lg overflow-hidden border border-rose-500/30 bg-black max-w-sm mx-auto">
                    <video src={videoUrl} controls autoPlay loop className="w-full" style={{ aspectRatio: "9/16" }} />
                  </div>
                  <div className="flex justify-center mt-3">
                    <Button onClick={() => handleDownload(videoUrl, "memory-video.mp4")}
                      className="bg-gradient-to-r from-rose-600 to-pink-500 hover:from-rose-700 hover:to-pink-600 text-white">
                      <Download className="w-4 h-4 mr-2" />영상 다운로드 (mp4)
                    </Button>
                  </div>
                </div>
              )}

              <Button onClick={handleClearImage} variant="outline" className="w-full border-slate-600 text-slate-300 hover:bg-slate-800">
                새 사진으로 다시 시작
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
