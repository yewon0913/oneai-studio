/**
 * ExistingImageFaceSwap - 기존 생성 이미지에 얼굴 교체 적용
 *
 * 기능:
 * - 기존 웨딩/뷰티 이미지 업로드
 * - 신부/신랑 원본 사진 업로드
 * - FAL Reactor로 얼굴 교체
 * - 결과 다운로드
 */

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Upload, Download, RefreshCw, ArrowLeft, Zap, User, Users } from "lucide-react";
import { Link } from "wouter";

type Mode = "single" | "couple";

interface FaceSwapResult {
  resultImage: string;
  log: string;
  processingTime?: number;
}

export default function ExistingImageFaceSwap() {
  const [mode, setMode] = useState<Mode>("couple");

  // 이미지 상태
  const [targetImage, setTargetImage] = useState<string | null>(null);  // 기존 생성 이미지
  const [faceImage1, setFaceImage1] = useState<string | null>(null);    // 신부/단독 얼굴
  const [faceImage2, setFaceImage2] = useState<string | null>(null);    // 신랑 얼굴 (커플 모드)

  // 설정
  const [faceStrength, setFaceStrength] = useState(0.85);

  // 결과
  const [result, setResult] = useState<FaceSwapResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState("");

  const targetRef = useRef<HTMLInputElement | null>(null);
  const face1Ref = useRef<HTMLInputElement | null>(null);
  const face2Ref = useRef<HTMLInputElement | null>(null);

  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (v: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const b64 = await readFileAsBase64(file);
    setter(b64);
  };

  const handleRun = async () => {
    if (!targetImage || !faceImage1) {
      setError("기존 이미지와 얼굴 사진을 모두 업로드해주세요.");
      return;
    }
    if (mode === "couple" && !faceImage2) {
      setError("커플 모드에서는 신랑 사진도 필요합니다.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResult(null);
    const startTime = Date.now();

    try {
      setStep("얼굴 교체 중...");

      const endpoint = mode === "couple"
        ? "/api/face-swap/couple"
        : "/api/face-swap/single";

      const body = mode === "couple"
        ? {
            targetImageBase64: targetImage,
            brideImageBase64: faceImage1,
            groomImageBase64: faceImage2,
            faceStrength,
          }
        : {
            targetImageBase64: targetImage,
            faceImageBase64: faceImage1,
            faceStrength,
          };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText.slice(0, 200));
      }

      const data = await res.json();
      const processingTime = Math.round((Date.now() - startTime) / 1000);

      setResult({
        resultImage: data.resultImage || data.image,
        log: data.log || "완료",
        processingTime,
      });
      setStep("완료!");
    } catch (err: any) {
      setError(err.message || "처리 중 오류가 발생했습니다.");
      setStep("");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!result?.resultImage) return;
    const a = document.createElement("a");
    a.href = result.resultImage;
    a.download = `faceswap-result-${Date.now()}.jpg`;
    a.click();
  };

  const UploadBox = ({
    label,
    image,
    inputRef,
    onChange,
    icon: Icon,
  }: {
    label: string;
    image: string | null;
    inputRef: React.RefObject<HTMLInputElement | null>;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    icon: React.ElementType;
  }) => (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-slate-300">{label}</p>
      <div
        className="relative border-2 border-dashed border-slate-600 rounded-xl overflow-hidden cursor-pointer hover:border-purple-500 transition-colors"
        style={{ aspectRatio: "3/4", minHeight: 180 }}
        onClick={() => inputRef.current?.click()}
      >
        {image ? (
          <>
            <img src={image} alt={label} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
              <p className="text-white text-sm font-medium">변경</p>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500">
            <Icon size={28} />
            <p className="text-xs text-center px-2">{label} 업로드</p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onChange}
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4">
      <div className="max-w-2xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/">
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
              <ArrowLeft size={20} />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">기존 이미지 얼굴 교체</h1>
            <p className="text-sm text-slate-400">생성된 이미지에 실제 고객 얼굴을 이식합니다</p>
          </div>
        </div>

        {/* 모드 선택 */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={mode === "couple" ? "default" : "outline"}
            className={mode === "couple" ? "bg-purple-600 hover:bg-purple-700" : "border-slate-600 text-slate-300"}
            onClick={() => setMode("couple")}
          >
            <Users size={16} className="mr-2" />
            커플 모드
          </Button>
          <Button
            variant={mode === "single" ? "default" : "outline"}
            className={mode === "single" ? "bg-purple-600 hover:bg-purple-700" : "border-slate-600 text-slate-300"}
            onClick={() => setMode("single")}
          >
            <User size={16} className="mr-2" />
            단독 모드
          </Button>
        </div>

        {/* 이미지 업로드 */}
        <Card className="bg-slate-900 border-slate-700 mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-200">이미지 업로드</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`grid gap-4 ${mode === "couple" ? "grid-cols-3" : "grid-cols-2"}`}>
              <UploadBox
                label="🖼️ 기존 생성 이미지"
                image={targetImage}
                inputRef={targetRef}
                onChange={(e) => handleFileUpload(e, setTargetImage)}
                icon={Upload}
              />
              <UploadBox
                label={mode === "couple" ? "👰 신부 얼굴" : "👤 얼굴 사진"}
                image={faceImage1}
                inputRef={face1Ref}
                onChange={(e) => handleFileUpload(e, setFaceImage1)}
                icon={User}
              />
              {mode === "couple" && (
                <UploadBox
                  label="🤵 신랑 얼굴"
                  image={faceImage2}
                  inputRef={face2Ref}
                  onChange={(e) => handleFileUpload(e, setFaceImage2)}
                  icon={User}
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* 설정 */}
        <Card className="bg-slate-900 border-slate-700 mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-200">얼굴 강도 설정</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <span className="text-xs text-slate-400 w-16">자연스럽게</span>
              <Slider
                value={[faceStrength]}
                onValueChange={([v]) => setFaceStrength(v)}
                min={0.5}
                max={1.0}
                step={0.05}
                className="flex-1"
              />
              <span className="text-xs text-slate-400 w-16 text-right">정확하게</span>
              <Badge variant="outline" className="border-purple-500 text-purple-300 w-12 text-center">
                {faceStrength.toFixed(2)}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              높을수록 원본 얼굴과 더 유사하게 교체됩니다. 권장값: 0.80~0.90
            </p>
          </CardContent>
        </Card>

        {/* 에러 */}
        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 mb-4 text-sm text-red-300">
            ⚠️ {error}
          </div>
        )}

        {/* 실행 버튼 */}
        <Button
          className="w-full bg-purple-600 hover:bg-purple-700 h-12 text-base font-semibold mb-6"
          onClick={handleRun}
          disabled={isProcessing || !targetImage || !faceImage1}
        >
          {isProcessing ? (
            <>
              <RefreshCw size={18} className="mr-2 animate-spin" />
              {step || "처리 중..."}
            </>
          ) : (
            <>
              <Zap size={18} className="mr-2" />
              얼굴 교체 실행
            </>
          )}
        </Button>

        {/* 결과 */}
        {result && (
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-slate-200">✅ 결과</CardTitle>
                <div className="flex items-center gap-2">
                  {result.processingTime && (
                    <Badge variant="outline" className="border-slate-600 text-slate-400 text-xs">
                      {result.processingTime}초
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700"
                    onClick={handleDownload}
                  >
                    <Download size={14} className="mr-1" />
                    다운로드
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <img
                src={result.resultImage}
                alt="Face swap result"
                className="w-full rounded-lg"
              />
              {result.log && (
                <p className="text-xs text-slate-500 mt-2 font-mono">{result.log}</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
