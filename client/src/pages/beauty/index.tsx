/**
 * Beauty Branding Module - Client UI
 * 4-tab interface (Skincare/Makeup/Luxury/Natural)
 * Positioned in reference image attachment area
 */

import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Upload, Sparkles } from "lucide-react";
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
  const [isGenerating, setIsGenerating] = useState(false);
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

      // 분석 미리보기
      try {
        const result = await analyzeBeautyMutation.mutateAsync({
          imageBase64: base64,
          mimeType: (file.type as "image/jpeg" | "image/png" | "image/webp") || "image/jpeg",
          category: activeTab,
        });
        toast.success("이미지 분석 완료");
      } catch (error) {
        toast.error("이미지 분석 실패");
        console.error(error);
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
    try {
      const result = await generateBeautyMutation.mutateAsync({
        imageBase64: selectedImage,
        category: activeTab,
        outputCount: 4,
      });

      toast.success(`${CATEGORY_INFO[activeTab].label} 이미지 4장 생성 완료!`);
      console.log("Generated images:", result.images);

      // 생성된 이미지 표시
      // 실제 구현에서는 이미지를 저장하거나 다운로드 처리
    } catch (error) {
      toast.error("이미지 생성 실패");
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="w-full bg-gradient-to-b from-slate-950 to-slate-900 rounded-lg border border-rose-500/20 p-6">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-rose-500" />
          <h2 className="text-xl font-bold text-white">뷰티 브랜딩 모듈</h2>
        </div>
        <p className="text-sm text-slate-400">
          당신의 사진을 기반으로 4가지 뷰티 스타일의 이미지를 생성합니다
        </p>
      </div>

      {/* 탭 네비게이션 */}
      <div className="grid grid-cols-4 gap-2 mb-6">
        {(Object.entries(CATEGORY_INFO) as Array<[BeautyCategory, typeof CATEGORY_INFO[BeautyCategory]]>).map(
          ([key, info]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`p-3 rounded-lg transition-all ${
                activeTab === key
                  ? `bg-gradient-to-r ${info.color} text-white shadow-lg`
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <div className="font-semibold text-sm">{info.label}</div>
              <div className="text-xs opacity-80 mt-1">{info.description}</div>
            </button>
          )
        )}
      </div>

      {/* 이미지 업로드 영역 */}
      <Card className="bg-slate-800/50 border-slate-700 mb-6">
        <div className="p-6">
          {selectedImage ? (
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <img
                  src={selectedImage}
                  alt="Selected"
                  className="w-24 h-24 rounded-lg object-cover border border-rose-500/30"
                />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white mb-2">이미지 선택됨</h3>
                <p className="text-sm text-slate-400 mb-4">
                  {CATEGORY_INFO[activeTab].label} 스타일로 4장의 이미지를 생성합니다
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    variant="outline"
                    size="sm"
                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    다른 이미지 선택
                  </Button>
                  <Button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    size="sm"
                    className="bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        생성 중...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        이미지 생성
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center cursor-pointer hover:border-rose-500/50 transition-colors"
            >
              <Upload className="w-8 h-8 text-slate-500 mx-auto mb-3" />
              <h3 className="font-semibold text-white mb-1">이미지를 선택하세요</h3>
              <p className="text-sm text-slate-400">
                JPG, PNG, WebP 형식 지원 (최대 10MB)
              </p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
        </div>
      </Card>

      {/* 분석 결과 (선택사항) */}
      {analyzeBeautyMutation.data && (
        <Card className="bg-slate-800/50 border-slate-700">
          <div className="p-4">
            <h3 className="font-semibold text-white mb-3">분석 결과</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-slate-400">피부톤:</span>
                <p className="text-white">{analyzeBeautyMutation.data.analysis.skinTone}</p>
              </div>
              <div>
                <span className="text-slate-400">조명:</span>
                <p className="text-white">{analyzeBeautyMutation.data.analysis.lighting}</p>
              </div>
              <div>
                <span className="text-slate-400">메이크업:</span>
                <p className="text-white">{analyzeBeautyMutation.data.analysis.makeupStyle}</p>
              </div>
              <div>
                <span className="text-slate-400">분위기:</span>
                <p className="text-white">{analyzeBeautyMutation.data.analysis.mood}</p>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
