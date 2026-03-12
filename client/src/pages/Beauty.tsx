/**
 * Beauty Page v2.0 - 완전 재작성
 * - 실제 이미지 생성 기능 포함
 * - 카테고리 선택 UI
 * - 분석 결과 올바른 필드명
 * - 생성 결과 다운로드
 */

import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload, Sparkles, X, ArrowLeft, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = [
  { id: "natural", label: "🌿 내추럴", desc: "자연스러운 무보정 느낌" },
  { id: "skincare", label: "✨ 스킨케어", desc: "글로우 광채 피부" },
  { id: "makeup", label: "💄 메이크업", desc: "한국 뷰티 에디토리얼" },
  { id: "luxury", label: "👑 럭셔리", desc: "보그 코리아 화보 스타일" },
] as const;

type Category = typeof CATEGORIES[number]["id"];

export default function Beauty() {
  const [, setLocation] = useLocation();

  // 이미지 상태
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [mimeType, setMimeType] = useState<"image/jpeg" | "image/png" | "image/webp">("image/jpeg");

  // 설정
  const [category, setCategory] = useState<Category>("natural");
  const [outputCount, setOutputCount] = useState(2);

  // 생성 상태
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [analysisInfo, setAnalysisInfo] = useState<Record<string, unknown> | null>(null);
  const [usedPrompt, setUsedPrompt] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateMutation = trpc.beauty.generateBeauty.useMutation();

  // 이미지 선택
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("10MB 이하만 가능합니다");
      return;
    }

    const mime = (file.type as "image/jpeg" | "image/png" | "image/webp") || "image/jpeg";
    setMimeType(mime);
    setResults([]);
    setAnalysisInfo(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      setSelectedImage(ev.target?.result as string);
      setSelectedFileName(file.name);
    };
    reader.readAsDataURL(file);
  };

  // 이미지 생성
  const handleGenerate = async () => {
    if (!selectedImage) {
      toast.error("사진을 먼저 업로드해주세요");
      return;
    }

    setIsGenerating(true);
    setResults([]);
    try {
      const base64 = selectedImage.includes(",") ? selectedImage.split(",")[1] : selectedImage;

      const result = await generateMutation.mutateAsync({
        imageBase64: base64,
        mimeType,
        category,
        outputCount,
      });

      setResults(result.images);
      setAnalysisInfo(result.analysis);
      setUsedPrompt(result.prompt);
      toast.success(`✨ ${result.images.length}장 생성 완료!`);
    } catch (err) {
      console.error(err);
      toast.error("생성 실패. 다시 시도해주세요.");
    } finally {
      setIsGenerating(false);
    }
  };

  // 다운로드
  const handleDownload = (url: string, idx: number) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `oneai-studio-${category}-${idx + 1}.jpg`;
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
            <Sparkles className="w-8 h-8 text-rose-400" />
            <h1 className="text-3xl font-bold text-white">AI 개인촬영</h1>
          </div>
          <p className="text-slate-400">사진 1장으로 프로 프로필 사진을 만들어드립니다</p>
          <div className="flex gap-2 mt-3 flex-wrap">
            <span className="text-xs bg-rose-500/20 text-rose-400 px-3 py-1 rounded-full border border-rose-500/30">
              ✨ Claude Vision 분석
            </span>
            <span className="text-xs bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full border border-blue-500/30">
              🎨 Flux AI 생성
            </span>
            <span className="text-xs bg-green-500/20 text-green-400 px-3 py-1 rounded-full border border-green-500/30">
              👤 원본 얼굴 보존
            </span>
          </div>
        </div>

        {/* 사진 업로드 */}
        <Card className="mb-5 border-slate-700 bg-slate-800/40">
          <CardHeader>
            <CardTitle className="text-white">📸 사진 업로드</CardTitle>
            <p className="text-xs text-slate-500">정면 얼굴이 잘 보이는 사진 권장 · JPG/PNG/WebP · 최대 10MB</p>
          </CardHeader>
          <CardContent>
            {!selectedImage ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-600 rounded-xl p-10 text-center cursor-pointer hover:border-rose-500/50 transition-colors bg-slate-800/30"
              >
                <Upload className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                <p className="text-slate-300 font-medium mb-1">사진을 선택하세요</p>
                <p className="text-xs text-slate-500">정면 얼굴 사진 · 밝고 선명한 사진일수록 좋아요</p>
              </div>
            ) : (
              <div className="flex gap-4 p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                <img
                  src={selectedImage}
                  alt="원본"
                  className="w-24 h-32 rounded-lg object-cover border border-rose-500/30 flex-shrink-0"
                />
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white mb-1">✅ 사진 선택됨</p>
                    <p className="text-xs text-slate-400 truncate">{selectedFileName}</p>
                    {analysisInfo && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-slate-500">
                          피부톤: <span className="text-slate-300">{analysisInfo.skinTone as string}</span>
                        </p>
                        <p className="text-xs text-slate-500">
                          추정 나이: <span className="text-slate-300">{analysisInfo.estimatedAge as string}세</span>
                        </p>
                        <p className="text-xs text-slate-500">
                          안경: <span className="text-slate-300">{analysisInfo.hasGlasses ? "✅ 감지됨" : "없음"}</span>
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      variant="outline"
                      size="sm"
                      className="border-slate-600 text-slate-300 hover:bg-slate-700 text-xs"
                    >
                      <Upload className="w-3 h-3 mr-1" />
                      변경
                    </Button>
                    <Button
                      onClick={() => {
                        setSelectedImage(null);
                        setSelectedFileName("");
                        setResults([]);
                        setAnalysisInfo(null);
                      }}
                      variant="outline"
                      size="sm"
                      className="border-slate-600 text-slate-300 hover:bg-slate-700 text-xs"
                    >
                      <X className="w-3 h-3 mr-1" />
                      제거
                    </Button>
                  </div>
                </div>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
          </CardContent>
        </Card>

        {/* 카테고리 선택 */}
        <Card className="mb-5 border-slate-700 bg-slate-800/40">
          <CardHeader>
            <CardTitle className="text-white">🎨 스타일 선택</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    category === cat.id
                      ? "border-rose-500/60 bg-rose-500/10"
                      : "border-slate-700 bg-slate-800/30 hover:border-slate-600"
                  }`}
                >
                  <p className="text-sm font-semibold text-white">{cat.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{cat.desc}</p>
                </button>
              ))}
            </div>

            {/* 생성 장수 */}
            <div className="mt-4">
              <p className="text-sm text-slate-400 mb-2">생성 장수</p>
              <div className="flex gap-2">
                {[2, 4, 6].map((n) => (
                  <button
                    key={n}
                    onClick={() => setOutputCount(n)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                      outputCount === n
                        ? "border-rose-500/60 bg-rose-500/10 text-rose-300"
                        : "border-slate-700 bg-slate-800/30 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    {n}장
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 생성 버튼 */}
        <Button
          onClick={handleGenerate}
          disabled={!selectedImage || isGenerating}
          className="w-full mb-6 h-14 text-lg font-semibold bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              AI 생성 중... (약 1~2분)
            </>
          ) : !selectedImage ? (
            <>
              <Upload className="w-5 h-5 mr-2" />
              사진을 먼저 업로드해주세요
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 mr-2" />
              ✨ AI 프로필 사진 만들기 ({outputCount}장)
            </>
          )}
        </Button>

        {/* 생성 진행 표시 */}
        {isGenerating && (
          <div className="mb-6 p-4 rounded-xl bg-slate-800/40 border border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
              <p className="text-sm text-slate-300">Claude Vision으로 얼굴 분석 중...</p>
            </div>
            <div className="text-xs text-slate-500 space-y-1">
              <p>✅ 피부톤 · 얼굴형 · 헤어스타일 분석</p>
              <p>✅ 연령대별 최적 보정 적용</p>
              <p>✅ Flux AI로 {outputCount}장 생성</p>
            </div>
          </div>
        )}

        {/* 결과 */}
        {results.length > 0 && (
          <Card className="border-slate-700 bg-slate-800/40">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white">🎉 생성 완료! ({results.length}장)</CardTitle>
              <Button
                onClick={handleGenerate}
                variant="outline"
                size="sm"
                className="border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                다시 생성
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {results.map((url, idx) => (
                  <div key={idx} className="rounded-xl overflow-hidden border border-slate-700">
                    <img src={url} alt={`결과 ${idx + 1}`} className="w-full h-auto" />
                    <div className="p-2 bg-slate-900/50 flex items-center justify-between">
                      <span className="text-xs text-slate-400">#{idx + 1}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(url, idx)}
                        className="text-slate-300 hover:text-white gap-1 h-7 text-xs"
                      >
                        <Download className="w-3 h-3" />
                        저장
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* 분석 정보 */}
              {analysisInfo && (
                <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700">
                  <p className="text-xs text-slate-500 mb-2 font-semibold">AI 분석 결과</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500">피부톤:</span>{" "}
                      <span className="text-slate-300">{analysisInfo.skinTone as string}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">추정 나이:</span>{" "}
                      <span className="text-slate-300">{analysisInfo.estimatedAge as string}세</span>
                    </div>
                    <div>
                      <span className="text-slate-500">헤어:</span>{" "}
                      <span className="text-slate-300">{analysisInfo.hairStyle as string}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">조명:</span>{" "}
                      <span className="text-slate-300">{analysisInfo.lightingType as string}</span>
                    </div>
                    {(analysisInfo.hasGlasses as boolean) && (
                      <div className="col-span-2 text-yellow-400">👓 안경 감지 → 자동 보존</div>
                    )}
                    {(analysisInfo.hasBear as boolean) && (
                      <div className="col-span-2 text-yellow-400">🧔 수염 감지 → 자동 보존</div>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30">
                <p className="text-xs text-rose-300">
                  💡 얼굴 일관성 최대화 모드로 생성됐어요. 정면 사진일수록 더 좋은 결과가 나와요.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
