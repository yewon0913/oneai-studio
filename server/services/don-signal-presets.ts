/**
 * 🎯 돈시그널 전용 프리셋
 */

export interface DonSignalPreset {
  name: string;
  label: string;
  gear: 1 | 3 | 4;
  prompt: string;
  pose?: string;
  pulidWeight: number;
  controlnetWeight?: number;
}

export const DON_SIGNAL_PRESETS: DonSignalPreset[] = [
  {
    name: "news_anchor",
    label: "뉴스 앵커",
    gear: 4,
    prompt: "Korean male news anchor, navy suit, red tie, dark studio with red signal light, confident expression, dramatic studio lighting, 4K photorealistic",
    pose: "anchor_front",
    pulidWeight: 0.92,
    controlnetWeight: 0.85,
  },
  {
    name: "signal_alert",
    label: "시그널 발동",
    gear: 4,
    prompt: "Korean businessman pressing red emergency button, dramatic red lighting effect, dark background, serious intense expression, cinematic 4K",
    pose: "button_press",
    pulidWeight: 0.92,
    controlnetWeight: 0.85,
  },
  {
    name: "profile_power",
    label: "파워 프로필",
    gear: 4,
    prompt: "Korean CEO arms crossed, premium black suit with red pocket square, dark gradient background with red signal waves, confident power pose, 4K",
    pose: "arms_crossed",
    pulidWeight: 0.92,
    controlnetWeight: 0.85,
  },
  {
    name: "casual_friendly",
    label: "캐주얼 친근",
    gear: 3,
    prompt: "Korean businessman smart casual, navy cardigan over white shirt, warm genuine smile, modern office background, approachable friendly, 4K",
    pulidWeight: 0.82,
  },
  {
    name: "godfather",
    label: "대부 스타일",
    gear: 1,
    prompt: "Korean businessman luxurious black suit, Godfather style dramatic side lighting, dark moody atmosphere, red accent light on face, cinematic 4K portrait",
    pulidWeight: 0.92,
  },
];

export function getPreset(name: string): DonSignalPreset | undefined {
  return DON_SIGNAL_PRESETS.find((p) => p.name === name);
}

export function getAllPresets(): DonSignalPreset[] {
  return DON_SIGNAL_PRESETS;
}
