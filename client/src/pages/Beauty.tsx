/**
 * AI 정밀 이미지 분석 모듈
 * 이미지 업로드 후 Claude Vision으로 상세 분석
 */

import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload, Sparkles, X, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function Beauty() {
  const [, setLocation] = useLocation();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    };
    reader.readAsDataURL(file);
  };

  /**
   * 이미지 분석
   */
  const handleAnalyze = async () => {
    if (!selectedImage) {
      toast.error("이미지를 먼저 선택해주세요");
      return;
    }

    setIsAnalyzing(true);

    try {
      await analyzeBeautyMutation.mutateAsync({
        imageBase64: selectedImage,
        mimeType: "image/jpeg",
        category: "skincare",
      });
      toast.success("이미지 분석 완료!");
    } catch (error) {
      console.error("분석 에러:", error);
      toast.error("이미지 분석 실패. 다시 시도해주세요.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  /**
   * 선택 이미지 제거
   */
  const handleClearImage = () => {
    setSelectedImage(null);
    setSelectedFileName("");
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
            <h1 className="text-3xl font-bold text-white">✨ AI 정밀 이미지 분석</h1>
          </div>
          <p className="text-slate-400">
            이미지를 업로드하면 Claude Vision AI가 상세한 분석을 제공합니다
          </p>
        </div>

        {/* 메인 카드 */}
        <Card className="bg-slate-900/50 border-slate-800 mb-8">
          <CardHeader>
            <CardTitle className="text-white">이미지 업로드</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
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

            {/* 분석 버튼 */}
            {selectedImage && (
              <Button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="w-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-semibold py-6 text-lg"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    분석 중...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    이미지 분석
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* 분석 결과 */}
        {analyzeBeautyMutation.data && (
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">분석 결과</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                  <p className="text-xs text-slate-400 mb-2 font-semibold">피부톤</p>
                  <p className="text-sm text-white">{analyzeBeautyMutation.data.analysis.skinTone}</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                  <p className="text-xs text-slate-400 mb-2 font-semibold">피부 질감</p>
                  <p className="text-sm text-white">{analyzeBeautyMutation.data.analysis.skinTexture}</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                  <p className="text-xs text-slate-400 mb-2 font-semibold">얼굴 특징</p>
                  <p className="text-sm text-white">{analyzeBeautyMutation.data.analysis.faceFeatures}</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                  <p className="text-xs text-slate-400 mb-2 font-semibold">메이크업 스타일</p>
                  <p className="text-sm text-white">{analyzeBeautyMutation.data.analysis.makeupStyle}</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                  <p className="text-xs text-slate-400 mb-2 font-semibold">조명</p>
                  <p className="text-sm text-white">{analyzeBeautyMutation.data.analysis.lighting}</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                  <p className="text-xs text-slate-400 mb-2 font-semibold">카메라</p>
                  <p className="text-sm text-white">{analyzeBeautyMutation.data.analysis.camera}</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                  <p className="text-xs text-slate-400 mb-2 font-semibold">분위기</p>
                  <p className="text-sm text-white">{analyzeBeautyMutation.data.analysis.mood}</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                  <p className="text-xs text-slate-400 mb-2 font-semibold">색감</p>
                  <p className="text-sm text-white">{analyzeBeautyMutation.data.analysis.colorGrade}</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700 md:col-span-2">
                  <p className="text-xs text-slate-400 mb-2 font-semibold">배경</p>
                  <p className="text-sm text-white">{analyzeBeautyMutation.data.analysis.background}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
