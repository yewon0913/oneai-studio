/**
 * Beauty Branding Module - Independent Page
 * 뷰티 브랜딩 모듈 독립 페이지
 */

import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload, Sparkles, Download, X, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

type BeautyCategory = "skincare" | "makeup" | "luxury" | "natural";

const CATEGORY_INFO: Record<BeautyCategory, { label: string; description: string; color: string }> = {
  skincare: {
    label: "스킨케어",
    description: "글래스 스킨, 수분감 있는 피부",
    color: "from-pink-500 to-rose-500",
  },
  makeup: {
    label: "메이크업",
    description: "완벽한 베이스, 에디토리얼 메이크업",
    color: "from-purple-500 to-pink-500",
  },
  luxury: {
    label: "럭셔리",
    description: "드라마틱한 조명, 럭셔리 캠페인",
    color: "from-amber-500 to-rose-500",
  },
  natural: {
    label: "내추럴",
    description: "자연스러운 글로우, 미니멀 메이크업",
    color: "from-green-500 to-emerald-500",
  },
};

export default function Beauty() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<BeautyCategory>("skincare");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [generatedPrompt, setGeneratedPrompt] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateBeautyMutation = trpc.beauty.generateBeauty.useMutation();
  const analyzeBeautyMutation = trpc.beauty.analyzeBeauty.useMutation();

  /**
   * 이미지 파일 선택 처리
   */
  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("파일 크기가 10MB를 초과합니다");
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("이미지 파일만 선택할 수 있습니다");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      setSelectedImage(base64);
      setSelectedFileName(file.name);

      try {
        await analyzeBeautyMutation.mutateAsync({
          imageBase64: base64,
          mimeType: (file.type as "image/jpeg" | "image/png" | "image/webp") || "image/jpeg",
          category: activeTab,
        });
      } catch (error) {
        console.error("분석 에러:", error);
      }
    };
    reader.readAsDataURL(file);
  };

  /**
   * 뷰티 이미지 생성
   */
  const handleGenerate = async () => {
    if (!selectedImage) {
      toast.error("이미지를 먼저 선택해주세요");
      return;
    }

    setIsGenerating(true);
    setGeneratedImages([]);
    setGeneratedPrompt("");

    try {
      const result = await generateBeautyMutation.mutateAsync({
        imageBase64: selectedImage,
        category: activeTab,
        outputCount: 4,
      });

      setGeneratedImages(result.images);
      setGeneratedPrompt(result.prompt);
      toast.success(`${CATEGORY_INFO[activeTab].label} 이미지 4장 생성 완료!`);
    } catch (error) {
      console.error("생성 에러:", error);
      toast.error("이미지 생성 실패. 다시 시도해주세요.");
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * 이미지 다운로드
   */
  const handleDownload = (imageUrl: string, index: number) => {
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = `beauty-${activeTab}-${index + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /**
   * 선택 이미지 제거
   */
  const handleClearImage = () => {
    setSelectedImage(null);
    setSelectedFileName("");
    setGeneratedImages([]);
    setGeneratedPrompt("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
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

          <div className="flex items-center gap-3 mb-3">
            <Sparkles className="w-8 h-8 text-rose-500" />
            <h1 className="text-3xl font-bold text-white">✨ 뷰티 브랜딩 모듈</h1>
          </div>
          <p className="text-slate-400">
            당신의 사진을 기반으로 4가지 뷰티 스타일의 고품질 이미지를 생성합니다
          </p>
        </div>

        {/* 메인 카드 */}
        <Card className="bg-slate-900/50 border-slate-800 mb-8">
          <CardHeader>
            <CardTitle className="text-white">뷰티 스타일 선택</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 탭 네비게이션 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(Object.entries(CATEGORY_INFO) as Array<[BeautyCategory, typeof CATEGORY_INFO[BeautyCategory]]>).map(
                ([key, info]) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`p-3 rounded-lg transition-all text-center ${
                      activeTab === key
                        ? `bg-gradient-to-r ${info.color} text-white shadow-lg`
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    <div className="font-semibold text-sm">{info.label}</div>
                    <div className="text-xs opacity-80 mt-1 line-clamp-2">{info.description}</div>
                  </button>
                )
              )}
            </div>

            {/* 이미지 업로드 영역 */}
            {!selectedImage ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center cursor-pointer hover:border-rose-500/50 transition-colors bg-slate-800/30"
              >
                <Upload className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                <h3 className="font-semibold text-white text-lg mb-2">이미지를 선택하세요</h3>
                <p className="text-sm text-slate-400">JPG, PNG, WebP 형식 지원 (최대 10MB)</p>
              </div>
            ) : (
              <div className="flex gap-4 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                <div className="flex-shrink-0">
                  <img
                    src={selectedImage}
                    alt="Selected"
                    className="w-24 h-24 rounded-lg object-cover border border-rose-500/30"
                  />
                </div>
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-semibold text-white mb-1">이미지 선택됨</h3>
                    <p className="text-sm text-slate-400 truncate">{selectedFileName}</p>
                    <p className="text-xs text-slate-500 mt-2">
                      {CATEGORY_INFO[activeTab].label} 스타일로 4장의 이미지를 생성합니다
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      variant="outline"
                      size="sm"
                      className="border-slate-600 text-slate-300 hover:bg-slate-700"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      다른 이미지
                    </Button>
                    <Button
                      onClick={handleClearImage}
                      variant="outline"
                      size="sm"
                      className="border-slate-600 text-slate-300 hover:bg-slate-700"
                    >
                      <X className="w-4 h-4 mr-2" />
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

            {/* 생성 버튼 */}
            {selectedImage && (
              <Button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-semibold py-6 text-lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    생성 중... (30초 소요)
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    이미지 생성 (4장)
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* 생성된 이미지 갤러리 */}
        {generatedImages.length > 0 && (
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">생성된 이미지</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {generatedImages.map((imageUrl, idx) => (
                  <div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-700">
                    <img
                      src={imageUrl}
                      alt={`생성 ${idx + 1}`}
                      className="w-full aspect-[3/4] object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <Button
                        onClick={() => handleDownload(imageUrl, idx)}
                        size="lg"
                        className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 hover:bg-white text-black font-semibold"
                      >
                        <Download className="w-5 h-5 mr-2" />
                        다운로드
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* 프롬프트 표시 */}
              {generatedPrompt && (
                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                  <p className="text-sm text-slate-400 mb-2">사용된 프롬프트:</p>
                  <p className="text-sm text-slate-300">{generatedPrompt}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 분석 결과 */}
        {analyzeBeautyMutation.data && !generatedImages.length && (
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">이미지 분석 결과</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                  <p className="text-xs text-slate-400 mb-1">피부톤</p>
                  <p className="text-sm text-white font-semibold truncate">
                    {analyzeBeautyMutation.data.analysis.skinTone}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                  <p className="text-xs text-slate-400 mb-1">조명</p>
                  <p className="text-sm text-white font-semibold truncate">
                    {analyzeBeautyMutation.data.analysis.lighting}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                  <p className="text-xs text-slate-400 mb-1">메이크업</p>
                  <p className="text-sm text-white font-semibold truncate">
                    {analyzeBeautyMutation.data.analysis.makeupStyle}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                  <p className="text-xs text-slate-400 mb-1">분위기</p>
                  <p className="text-sm text-white font-semibold truncate">
                    {analyzeBeautyMutation.data.analysis.mood}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
