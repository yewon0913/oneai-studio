# OneAI Studio — 스튜디오부

## 프로젝트 개요
AI 영상/이미지 생성 스튜디오. 커플사진, AI 프로필, 영상 자동화.
- 스택: Vite + TypeScript + React
- AI: fal.ai (FLUX + Kling + InstantID)

## 에이전트 구조

| 역할 | 이름 | 담당 |
|------|------|------|
| 부장 | 스튜디오 디렉터 | 전체 UI/UX + API 통합 |
| 사원1 | 이미지 엔지니어 | FLUX + InstantID 파이프라인 |
| 사원2 | 영상 엔지니어 | Kling V2 영상 생성 + 립싱크 |

## 기어 시스템

| 기어 | 기능 | 모델 |
|------|------|------|
| Gear 1 | AI 프로필 사진 | FLUX 2 Pro |
| Gear 2 | 커플 합성 사진 | InstantID + FLUX |
| Gear 3 | AI 영상 생성 | Kling V2 |
| Gear 4 | AI 앵커 영상 | Kling + TTS + 립싱크 |

## MVP 전략

1단계 (즉시): 커플사진 AI 합성 → 무료 체험 + 유료 고화질
2단계 (1주): AI 프로필 사진 생성 → B2B (기업 프로필)
3단계 (2주): AI 영상 자동화 → 카멜레온 연동

## 환경변수
```
FAL_KEY
ANTHROPIC_API_KEY
DATABASE_URL
```

---

## ✅ 품질검수팀 (스튜디오)
- 이미지 품질: 실사 90점 이상
- 얼굴 일관성: PuLID 동일인 판별

## 🤝 고객성공팀 (스튜디오)
- 결과물 만족도 조사
- 불만족 시 무료 재제작 안내

---

## gstack 활용
- 기어 변경 → /plan-eng-review + /checkpoint
- 배포 → /ship
- 보안 → /cso
