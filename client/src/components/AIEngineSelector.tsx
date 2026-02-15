import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AI_ENGINE_LIST, type AIEngineId } from "../../../shared/aiEngines";
import { Check, Info, Zap } from "lucide-react";

interface AIEngineSelectorProps {
  selectedEngines: AIEngineId[];
  onToggleEngine: (engineId: AIEngineId) => void;
  compact?: boolean;
}

export default function AIEngineSelector({ selectedEngines, onToggleEngine, compact = false }: AIEngineSelectorProps) {
  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Zap className="h-3.5 w-3.5 text-primary" />
          AI 엔진 일관성 전략
        </div>
        <div className="flex flex-wrap gap-2">
          {AI_ENGINE_LIST.map((engine) => {
            const isSelected = selectedEngines.includes(engine.id);
            return (
              <Tooltip key={engine.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onToggleEngine(engine.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                      isSelected
                        ? `${engine.color} ring-1 ring-current/30`
                        : "bg-secondary/30 text-muted-foreground border-border hover:border-primary/30"
                    }`}
                  >
                    <span>{engine.icon}</span>
                    <span>{engine.nameKo}</span>
                    {isSelected && <Check className="h-3 w-3" />}
                    {engine.recommended && !isSelected && (
                      <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 bg-orange-500/10 text-orange-400 border-orange-500/30">
                        추천
                      </Badge>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <div className="space-y-1">
                    <p className="font-medium">{engine.nameKo}</p>
                    <p className="text-xs text-muted-foreground">{engine.descriptionKo}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs">얼굴 일관성:</span>
                      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full transition-all" 
                          style={{ width: `${engine.faceConsistencyScore}%` }} 
                        />
                      </div>
                      <span className="text-xs font-medium">{engine.faceConsistencyScore}%</span>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
        {selectedEngines.length > 0 && (
          <p className="text-[10px] text-muted-foreground">
            선택된 엔진: {selectedEngines.map(id => AI_ENGINE_LIST.find(e => e.id === id)?.nameKo).join(", ")}
            {" "}— 멀티 엔진 전략이 프롬프트에 자동 반영됩니다.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          멀티 AI 엔진 얼굴 일관성 전략
        </h3>
        <Tooltip>
          <TooltipTrigger>
            <Info className="h-3.5 w-3.5 text-muted-foreground" />
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-sm">
            <p className="text-xs">
              여러 AI 엔진의 얼굴 일관성 기술을 결합하여 최고의 결과를 도출합니다.
              각 엔진의 베스트 프랙티스가 프롬프트에 자동으로 반영됩니다.
            </p>
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {AI_ENGINE_LIST.map((engine) => {
          const isSelected = selectedEngines.includes(engine.id);
          return (
            <Card
              key={engine.id}
              className={`cursor-pointer transition-all ${
                isSelected
                  ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                  : "border-border bg-card hover:border-primary/20"
              }`}
              onClick={() => onToggleEngine(engine.id)}
            >
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <div className={`text-lg mt-0.5`}>{engine.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{engine.nameKo}</span>
                      {engine.recommended && (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-orange-500/10 text-orange-400 border-orange-500/30">
                          추천
                        </Badge>
                      )}
                      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${engine.color}`}>
                        {engine.strengthLabel}
                      </Badge>
                      {isSelected && <Check className="h-3.5 w-3.5 text-primary ml-auto" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{engine.descriptionKo}</p>
                    
                    {/* 일관성 점수 바 */}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">일관성</span>
                      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            engine.faceConsistencyScore >= 95 ? "bg-green-500" :
                            engine.faceConsistencyScore >= 90 ? "bg-blue-500" :
                            "bg-amber-500"
                          }`}
                          style={{ width: `${engine.faceConsistencyScore}%` }} 
                        />
                      </div>
                      <span className="text-[10px] font-medium text-foreground">{engine.faceConsistencyScore}%</span>
                    </div>

                    {/* 주요 기능 (선택 시 표시) */}
                    {isSelected && (
                      <div className="mt-2 space-y-0.5">
                        {engine.featuresKo.slice(0, 3).map((feature, idx) => (
                          <p key={idx} className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <span className="text-primary">•</span> {feature}
                          </p>
                        ))}
                        <p className="text-[10px] text-primary/70 mt-1">{engine.promptStrategyKo}</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
