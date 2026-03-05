/**
 * Beauty Branding Module - Client UI
 * 4-tab interface (Skincare/Makeup/Luxury/Natural)
 * Positioned in reference image attachment area
 */

import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Upload, Sparkles, Download, X } from "lucide-react";
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

export default function BeautyModule() {
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

    // 파일 크기 확인 (10MB 제한)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("파일 크기가 10MB를 초과합니다");
      return;
    }

    // 이미지 파일 타입 확인
    if (!file.type.startsWith("image/")) {
      toast.error("이미지 파일만 선택할 수 있습니다");
      return;
    }

    // Base64로 변환
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      setSelectedImage(base64);
      setSelectedFileName(file.name);

      // 분석 미리보기
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
    <div className="w-full space-y-4">
      {/* 헤더 */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-rose-500" />
          <h2 className="text-lg font-bold text-white">✨ 뷰티 브랜딩 모듈</h2>
        </div>
        <p className="text-xs text-slate-400">
          당신의 사진을 기반으로 4가지 뷰티 스타일의 이미지를 생성합니다
        </p>
      </div>

      {/* 탭 네비게이션 */}
      <div className="grid grid-cols-4 gap-2">
        {(Object.entries(CATEGORY_INFO) as Array<[BeautyCategory, typeof CATEGORY_INFO[BeautyCategory]]>).map(
          ([key, info]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`p-2.5 rounded-lg transition-all text-center ${
                activeTab === key
                  ? `bg-gradient-to-r ${info.color} text-white shadow-lg`
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <div className="font-semibold text-xs">{info.label}</div>
              <div className="text-[10px] opacity-80 mt-0.5 line-clamp-1">{info.description}</div>
            </button>
          )
        )}
      </div>

      {/* 이미지 업로드 영역 */}
      {!selectedImage ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-600 rounded-lg p-6 text-center cursor-pointer hover:border-rose-500/50 transition-colors bg-slate-900/30"
        >
          <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
          <h3 className="font-semibold text-white text-sm mb-1">이미지를 선택하세요</h3>
          <p className="text-xs text-slate-400">JPG, PNG, WebP 형식 지원 (최대 10MB)</p>
        </div>
      ) : (
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <img
              src={selectedImage}
              alt="Selected"
              className="w-20 h-20 rounded-lg object-cover border border-rose-500/30"
            />
          </div>
          <div className="flex-1 flex flex-col justify-between">
            <div>
              <h3 className="font-semibold text-white text-sm mb-1">이미지 선택됨</h3>
              <p className="text-xs text-slate-400 truncate">{selectedFileName}</p>
              <p className="text-xs text-slate-500 mt-1">
                {CATEGORY_INFO[activeTab].label} 스타일로 4장의 이미지를 생성합니다
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                size="sm"
                className="border-slate-600 text-slate-300 hover:bg-slate-700 text-xs"
              >
                <Upload className="w-3 h-3 mr-1" />
                다른 이미지
              </Button>
              <Button
                onClick={handleClearImage}
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

      {/* 생성 버튼 */}
      {selectedImage && (
        <Button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-semibold"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              생성 중... (30초 소요)
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              이미지 생성 (4장)
            </>
          )}
        </Button>
      )}

      {/* 생성된 이미지 갤러리 */}
      {generatedImages.length > 0 && (
        <div className="space-y-3">
          <div>
            <h3 className="font-semibold text-white text-sm mb-2">생성된 이미지</h3>
            <div className="grid grid-cols-2 gap-2">
              {generatedImages.map((imageUrl, idx) => (
                <div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-600">
                  <img
                    src={imageUrl}
                    alt={`생성 ${idx + 1}`}
                    className="w-full aspect-[3/4] object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    <Button
                      onClick={() => handleDownload(imageUrl, idx)}
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 hover:bg-white text-black"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      다운로드
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 프롬프트 표시 */}
          {generatedPrompt && (
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
              <p className="text-xs text-slate-400 mb-1">사용된 프롬프트:</p>
              <p className="text-xs text-slate-300 line-clamp-3">{generatedPrompt}</p>
            </div>
          )}
        </div>
      )}

      {/* 분석 결과 (선택사항) */}
      {analyzeBeautyMutation.data && !generatedImages.length && (
        <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
          <h3 className="font-semibold text-white text-xs mb-2">분석 결과</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-400">피부톤:</span>
              <p className="text-white truncate">{analyzeBeautyMutation.data.analysis.skinTone}</p>
            </div>
            <div>
              <span className="text-slate-400">조명:</span>
              <p className="text-white truncate">{analyzeBeautyMutation.data.analysis.lighting}</p>
            </div>
            <div>
              <span className="text-slate-400">메이크업:</span>
              <p className="text-white truncate">{analyzeBeautyMutation.data.analysis.makeupStyle}</p>
            </div>
            <div>
              <span className="text-slate-400">분위기:</span>
              <p className="text-white truncate">{analyzeBeautyMutation.data.analysis.mood}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
