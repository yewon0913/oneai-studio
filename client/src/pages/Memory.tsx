import { useState, useRef } from "react";
import { Upload, Video, Music, Mic, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Spinner } from "@/components/ui/spinner";

type DirectionStyle = "calm" | "nostalgia" | "lively" | "gratitude";
type BGMStyle = "piano" | "orchestra" | "acoustic" | "custom";
type VideoDuration = 5 | 10 | 15;

const DIRECTION_PRESETS: Record<DirectionStyle, string> = {
  calm: "부드럽고 고요한 분위기에서 천천히 움직이는 모습. 자연스러운 표정과 우아한 제스처. 따뜻한 조명.",
  nostalgia: "추억 어린 표정으로 먼 곳을 바라보는 모습. 부드러운 회상의 감정. 황금빛 조명.",
  lively: "밝고 생생한 표정으로 활기차게 움직이는 모습. 자연스러운 웃음과 생동감. 선명한 조명.",
  gratitude: "감사함이 묻어나는 따뜻한 표정. 부드러운 손 제스처. 감정적인 순간 포착.",
};

const BGM_PRESETS: Record<BGMStyle, string> = {
  piano: "잔잔한 피아노 배경음악",
  orchestra: "감정적인 오케스트라 음악",
  acoustic: "어쿠스틱 기타 배경음악",
  custom: "직접 입력",
};

const DURATION_COSTS: Record<VideoDuration, number> = {
  5: 500,
  10: 800,
  15: 1200,
};

export default function Memory() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string>("");
  const [mimeType, setMimeType] = useState<"image/jpeg" | "image/png" | "image/webp">("image/jpeg");

  // 연출 지시
  const [activeDirection, setActiveDirection] = useState<DirectionStyle>("calm");
  const [customDirection, setCustomDirection] = useState("");
  const [showDirectionInput, setShowDirectionInput] = useState(false);

  // 영상 옵션
  const [generateVideo, setGenerateVideo] = useState(true);
  const [videoDuration, setVideoDuration] = useState<VideoDuration>(5);

  // BGM
  const [enableBGM, setEnableBGM] = useState(false);
  const [activeBGM, setActiveBGM] = useState<BGMStyle>("piano");
  const [customBGM, setCustomBGM] = useState("");

  // 목소리
  const [enableVoice, setEnableVoice] = useState(false);
  const [voiceScript, setVoiceScript] = useState("");

  // 생성 상태
  const generateMemoryMutation = trpc.memory.generateMemory.useMutation();
  const [generatedImages, setGeneratedImages] = useState<{
    restored?: string;
    colorized?: string;
    video?: string;
  }>({});

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setImageBase64(base64.split(",")[1] || base64);
      setMimeType((file.type as any) || "image/jpeg");
      setSelectedImage(URL.createObjectURL(file));
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateMemory = async () => {
    if (!selectedImage || !imageBase64) return;

    const direction = showDirectionInput ? customDirection : DIRECTION_PRESETS[activeDirection];
    const bgmText = enableBGM ? (activeBGM === "custom" ? customBGM : BGM_PRESETS[activeBGM]) : "";

    await generateMemoryMutation.mutateAsync(
      {
        imageBase64,
        mimeType,
        animationStyle: activeDirection,
        generateVideo,
        duration: videoDuration,
        direction,
        enableBGM,
        bgmStyle: bgmText,
        enableVoice,
        voiceScript,
      } as any,
      {
        onSuccess: (result: any) => {
          setGeneratedImages({
            restored: result.restoredImageUrl,
            colorized: result.colorizedImageUrl,
            video: result.videoUrl,
          });
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">⏱️ 기억복원소</h1>
          <p className="text-slate-400">오래된 사진을 복원하고 감정 어린 영상으로 변환하세요</p>
        </div>

        <div className="space-y-6">
          {/* 📷 사진 업로드 */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5" /> 📷 사진 업로드
              </h2>

              {!selectedImage ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-600 rounded-lg p-10 text-center cursor-pointer hover:border-rose-500/50 transition-colors bg-slate-800/30"
                >
                  <Upload className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                  <h3 className="font-semibold text-white text-lg mb-2">오래된 사진을 올려주세요</h3>
                  <p className="text-sm text-slate-400">손상된 사진, 흑백 사진, 낡은 사진 모두 가능</p>
                </div>
              ) : (
                <div className="flex gap-4">
                  <img src={selectedImage} alt="selected" className="w-32 h-32 rounded-lg object-cover" />
                  <div className="flex-1">
                    <p className="text-white mb-3">선택된 사진</p>
                    <Button
                      onClick={() => {
                        setSelectedImage(null);
                        setImageBase64("");
                      }}
                      variant="outline"
                      className="bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
                    >
                      다른 사진 선택
                    </Button>
                  </div>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </CardContent>
          </Card>

          {/* 🎬 연출 지시 */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-white mb-4">🎬 연출 지시</h2>

              {!showDirectionInput ? (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {(["calm", "nostalgia", "lively", "gratitude"] as DirectionStyle[]).map((style) => (
                    <button
                      key={style}
                      onClick={() => {
                        setActiveDirection(style);
                        setShowDirectionInput(false);
                      }}
                      className={`p-3 rounded-lg font-medium transition-all text-sm ${
                        activeDirection === style && !showDirectionInput
                          ? "bg-rose-500 text-white"
                          : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                      }`}
                    >
                      [{style === "calm" ? "잔잔함" : style === "nostalgia" ? "그리움" : style === "lively" ? "생동감" : "감사"}]
                    </button>
                  ))}
                </div>
              ) : null}

              <button
                onClick={() => setShowDirectionInput(!showDirectionInput)}
                className="w-full p-3 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-all text-sm mb-3 flex items-center justify-between"
              >
                <span>✏️ {showDirectionInput ? "프리셋으로 돌아가기" : "직접 입력"}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showDirectionInput ? "rotate-180" : ""}`} />
              </button>

              {showDirectionInput && (
                <textarea
                  value={customDirection}
                  onChange={(e) => setCustomDirection(e.target.value)}
                  placeholder="예시: 부드럽고 우아한 표정으로 천천히 움직이는 모습..."
                  className="w-full p-3 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 text-sm"
                  rows={4}
                />
              )}

              <div className="mt-3 p-3 rounded-lg bg-slate-900/50 border border-slate-700">
                <p className="text-xs text-slate-400">
                  💡 <strong>작성 팁:</strong> 표정(밝은/슬픈/감사), 제스처(손 움직임/고개 기울임), 조명(따뜻한/차가운) 등을 구체적으로 묘사하면 더 좋은 결과를 얻을 수 있습니다.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 🎞️ 영상 옵션 */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Video className="w-5 h-5" /> 🎞️ 영상 옵션
              </h2>

              {/* 영상 생성 토글 */}
              <div
                onClick={() => setGenerateVideo(!generateVideo)}
                className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all mb-4 ${
                  generateVideo ? "border-rose-500/50 bg-rose-500/10" : "border-slate-700 bg-slate-800/30"
                }`}
              >
                <Video className={`w-5 h-5 ${generateVideo ? "text-rose-400" : "text-slate-500"}`} />
                <div className="flex-1">
                  <p className={`font-medium text-sm ${generateVideo ? "text-white" : "text-slate-400"}`}>영상 생성 포함</p>
                  <p className="text-xs text-slate-500">
                    {generateVideo ? `복원 이미지 + ${videoDuration}초 영상 모두 생성` : "복원 이미지만 생성"}
                  </p>
                </div>
                <div className={`w-10 h-6 rounded-full transition-all relative ${generateVideo ? "bg-rose-500" : "bg-slate-700"}`}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${generateVideo ? "left-5" : "left-1"}`} />
                </div>
              </div>

              {/* 영상 길이 선택 */}
              {generateVideo && (
                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700 mb-4">
                  <p className="text-sm font-semibold text-white mb-3">영상 길이 선택</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[5, 10, 15].map((duration) => (
                      <button
                        key={duration}
                        onClick={() => setVideoDuration(duration as VideoDuration)}
                        className={`py-2 px-3 rounded-lg font-medium transition-all text-sm ${
                          videoDuration === duration
                            ? "bg-rose-500 text-white"
                            : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                        }`}
                      >
                        {duration}초
                        <br />
                        <span className="text-xs opacity-75">{DURATION_COSTS[duration as VideoDuration]}원</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* BGM 토글 */}
              {generateVideo && (
                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700 mb-4">
                  <div
                    onClick={() => setEnableBGM(!enableBGM)}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      enableBGM ? "border-amber-500/50 bg-amber-500/10" : "border-slate-700 bg-slate-800/30"
                    }`}
                  >
                    <Music className={`w-5 h-5 ${enableBGM ? "text-amber-400" : "text-slate-500"}`} />
                    <div className="flex-1">
                      <p className={`font-medium text-sm ${enableBGM ? "text-white" : "text-slate-400"}`}>🎵 BGM 추가</p>
                    </div>
                    <div className={`w-10 h-6 rounded-full transition-all relative ${enableBGM ? "bg-amber-500" : "bg-slate-700"}`}>
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${enableBGM ? "left-5" : "left-1"}`} />
                    </div>
                  </div>

                  {enableBGM && (
                    <div className="mt-3 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        {(["piano", "orchestra", "acoustic", "custom"] as BGMStyle[]).map((bgm) => (
                          <button
                            key={bgm}
                            onClick={() => setActiveBGM(bgm)}
                            className={`p-2 rounded-lg font-medium transition-all text-xs ${
                              activeBGM === bgm
                                ? "bg-amber-500 text-white"
                                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                            }`}
                          >
                            {BGM_PRESETS[bgm]}
                          </button>
                        ))}
                      </div>

                      {activeBGM === "custom" && (
                        <input
                          type="text"
                          value={customBGM}
                          onChange={(e) => setCustomBGM(e.target.value)}
                          placeholder="예: 클래식 바이올린 음악"
                          className="w-full p-2 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 text-sm"
                        />
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 목소리 토글 */}
              {generateVideo && (
                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                  <div
                    onClick={() => setEnableVoice(!enableVoice)}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      enableVoice ? "border-purple-500/50 bg-purple-500/10" : "border-slate-700 bg-slate-800/30"
                    }`}
                  >
                    <Mic className={`w-5 h-5 ${enableVoice ? "text-purple-400" : "text-slate-500"}`} />
                    <div className="flex-1">
                      <p className={`font-medium text-sm ${enableVoice ? "text-white" : "text-slate-400"}`}>🗣️ 나레이션 추가</p>
                      <p className="text-xs text-slate-500">+300원</p>
                    </div>
                    <div className={`w-10 h-6 rounded-full transition-all relative ${enableVoice ? "bg-purple-500" : "bg-slate-700"}`}>
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${enableVoice ? "left-5" : "left-1"}`} />
                    </div>
                  </div>

                  {enableVoice && (
                    <div className="mt-3 space-y-3">
                      <textarea
                        value={voiceScript}
                        onChange={(e) => setVoiceScript(e.target.value)}
                        placeholder="예시: 이 사진은 2010년 여름, 우리가 처음 만난 날입니다..."
                        className="w-full p-3 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 text-sm"
                        rows={3}
                      />

                      <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700">
                        <p className="text-xs text-slate-400">
                          💡 <strong>팁:</strong> 추억, 감정, 감사의 말 등을 담아 작성하면 더 감동적인 영상이 됩니다.
                        </p>
                      </div>

                      <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                        <p className="text-xs text-red-400">
                          ⚠️ <strong>주의:</strong> 나레이션 생성에 추가 크레딧이 소모됩니다.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 생성 버튼 */}
          <Button
            onClick={handleGenerateMemory}
            disabled={!selectedImage || generateMemoryMutation.isPending}
            className="w-full py-6 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-semibold rounded-lg transition-all"
          >
            {generateMemoryMutation.isPending ? (
              <div className="flex items-center gap-2">
                <Spinner className="w-4 h-4" />
                생성 중...
              </div>
            ) : (
              "✨ 기억 복원하기"
            )}
          </Button>

          {/* 생성 결과 */}
          {Object.keys(generatedImages).length > 0 && (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-white mb-4">✨ 생성 완료</h2>

                <div className="space-y-4">
                  {generatedImages.restored && (
                    <div>
                      <p className="text-sm text-slate-400 mb-2">복원된 이미지</p>
                      <img src={generatedImages.restored} alt="restored" className="w-full rounded-lg" />
                    </div>
                  )}

                  {generatedImages.colorized && (
                    <div>
                      <p className="text-sm text-slate-400 mb-2">컬러화된 이미지</p>
                      <img src={generatedImages.colorized} alt="colorized" className="w-full rounded-lg" />
                    </div>
                  )}

                  {generatedImages.video && (
                    <div>
                      <p className="text-sm text-slate-400 mb-2">생성된 영상</p>
                      <video src={generatedImages.video} controls className="w-full rounded-lg" />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
