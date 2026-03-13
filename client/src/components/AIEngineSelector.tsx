import { Badge } from "@/components/ui/badge";
import { PIPELINE_STAGES, type PipelineStageInfo } from "../../../shared/aiEngines";
import { Zap } from "lucide-react";

function stageTypeBadge(type: PipelineStageInfo["type"]) {
  switch (type) {
    case "primary":
      return <Badge className="text-[9px] px-1.5 py-0 bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Primary</Badge>;
    case "fallback":
      return <Badge className="text-[9px] px-1.5 py-0 bg-amber-500/15 text-amber-400 border-amber-500/30">Fallback</Badge>;
    case "postprocess":
      return <Badge className="text-[9px] px-1.5 py-0 bg-blue-500/15 text-blue-400 border-blue-500/30">후처리</Badge>;
    case "optional":
      return <Badge className="text-[9px] px-1.5 py-0 bg-purple-500/15 text-purple-400 border-purple-500/30">옵션</Badge>;
  }
}

export default function AIEngineSelector() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Zap className="h-3.5 w-3.5 text-primary" />
        자동 최적화 파이프라인 적용 중
      </div>
      <div className="space-y-1.5">
        {PIPELINE_STAGES.map((stage) => (
          <div
            key={stage.id}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-secondary/20 border border-border/50"
          >
            <span className="text-base">{stage.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-foreground">{stage.nameKo}</span>
                {stageTypeBadge(stage.type)}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">{stage.descriptionKo}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground/70">
        엔진이 자동으로 선택됩니다. Primary 실패 시 Fallback으로 자동 전환됩니다.
      </p>
    </div>
  );
}
