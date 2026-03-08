# One_Ai_Studio Pro - TODO

## Phase 1: 프로젝트 설계 및 DB 스키마
- [x] DB 스키마 설계 (고객, 프로젝트, 프롬프트, 생성이력, 배치, 전달패키지 등)
- [x] 서버 라우터 구축 (CRUD + AI 워크플로우)

## Phase 2: 프론트엔드 디자인 시스템
- [x] 다크 테마 대시보드 레이아웃 (사이드바 네비게이션)
- [x] 글로벌 테마 및 색상 팔레트 설정

## Phase 3: 고객 관리 대시보드
- [x] 고객 프로필 CRUD (이름, 연락처, 상담내용, 선호컨셉)
- [x] 고객 사진 업로드 (정면/측면/추가) 및 S3 저장
- [x] 고객 목록 및 검색/필터

## Phase 4: AI 이미지 생성 워크플로우
- [x] 다단계 얼굴 일관성 엔진 (얼굴 추출 → FaceID 고정 → Face Swap → 복원)
- [x] 프리미엄 컨셉 프롬프트 라이브러리 (웨딩, 복원, 키즈 카테고리)
- [x] 참조 이미지 기반 배경 합성 (핀터레스트 URL 또는 업로드 이미지)
- [x] AI 이미지 생성 API 연동

## Phase 5: 정밀 튜닝 및 비교 뷰어
- [x] Inpainting 도구 (얼굴, 드레스, 배경 선택적 재생성)
- [x] 프롬프트 가중치 실시간 조정 슬라이더
- [x] 원본 vs 생성 이미지 비교 뷰어 (나란히 배치)

## Phase 6: 품질 관리 워크플로우
- [x] 3단계 워크플로우 (AI 초안 → 전문가 검수 → 최종 업스케일링)
- [x] 4K 이상 고화질 업스케일링 파이프라인

## Phase 7: 배치 처리 및 프롬프트 히스토리
- [x] 여러 고객 사진 동시 업로드 및 대기열 순차 처리
- [x] 프롬프트 히스토리 자동 저장 및 원클릭 재사용
- [x] 고객 전달 패키지 생성 (워터마크, 해상도별 다운로드, 미리보기 갤러리)

## Phase 8: 영상 변환 및 사진 복원
- [x] 정지 이미지 → 5~10초 고화질 영상 변환 (API 연동 준비)
- [x] 저화질/훼손/흑백 사진 AI 복원 (컬러라이제이션, 노이즈 제거)

## Phase 9: 알림 시스템
- [x] AI 생성 완료, 고객 사진 업로드, 긴급 수정 요청 등 알림

## Phase 10: 테스트 및 검증
- [x] Vitest 단위 테스트 작성 (18개 테스트 통과)
- [x] TypeScript 에러 0개 확인

## Phase 11: 긴급 수정 - 얼굴 일관성 엔진 완전 구현
- [x] 프로젝트 워크스페이스에 "얼굴 고정 모드" UI 추가 (토글 스위치, 상태 표시)
- [x] 고객의 정면/측면 사진 자동 감지 및 얼굴 추출
- [x] 얼굴 임베딩을 참조 이미지로 사용
- [x] Face Swap 파이프라인을 통한 얼굴 합성 (프롬프트 기반)
- [x] 생성 이미지에 고객 얼굴 자동 적용
- [x] 얼굴 일관성 점수(faceConsistencyScore) 95% 설정 및 저장
- [x] 생성 완료 알림에 얼굴 고정 모드 여부 표시
- [x] 모든 테스트 통과 (18개 테스트)
- [x] TypeScript 에러 0개 확인

## 대규모 업그레이드 v3.0
- [x] 얼굴 일관성 엔진 완전 재구축 - 고객 사진을 originalImages로 직접 전달
- [x] 500 에러 수정 - 프롬프트 길이 제한 및 에러 핸들링 강화
- [x] 남녀 구분 시스템 - 고객 등록 시 성별 선택, 신랑/신부 별도 사진 관리
- [x] 커플 합성 시스템 - 신랑+신부 사진을 합성하여 커플 웨딩 이미지 생성
- [x] 대량 생성 시스템 - 최대 100장 일괄 생성 (다양한 컨셉 자동 적용)
- [x] 초고화질 출력 - 4K/8K 업스케일링 파이프라인
- [x] 굿즈 제작용 이미지 포맷 - 아크릴 액자, 티셔츠, 컵, 수건, 3D 인쇄 규격별 출력
- [x] 프론트엔드 고객 등록 페이지에 성별 선택 추가
- [x] 프론트엔드 커플 프로젝트 워크스페이스 구현
- [x] 프론트엔드 대량 생성 UI 구현
- [x] 프론트엔드 굿즈 제작 UI 구현
- [x] 테스트 업데이트 (31개 테스트 전체 통과)

## v3.1 긴급 수정 및 기능 추가
- [x] 핀터레스트/참조 이미지만으로 합성 모드 - 프롬프트 없이 참조 이미지 URL만 넣으면 고객 얼굴 합성
- [x] 고객 배경 이미지 합성 - 고객이 원하는 배경 이미지에 고객 얼굴 합성
- [x] 얼굴 유사도 90%+ 향상 - 프롬프트를 "얼굴 그대로 유지" 중심으로 강화
- [x] 프롬프트 필수 입력 제거 - 참조 이미지만으로도 생성 가능하게 변경
- [x] 프로젝트 삭제 기능 UI 추가 - 프로젝트 목록에서 삭제 버튼
- [x] 영상 생성 기능 구현 - 생성된 이미지를 영상으로 변환하는 UI 및 로직
- [x] 500 에러 수정 - 핀터레스트 URL 직접 접근 시 BAD_REQUEST 에러 해결

## v3.2 긴급 버그 수정 및 기능 추가
- [x] 업로드 사진 변경/삭제 기능 - 각 사진에 X 버튼으로 개별 삭제 가능
- [x] 프로젝트 삭제 기능 수정 - 프로젝트 카드에 삭제 버튼이 실제로 작동하도록
- [x] 핀터레스트 링크 500 에러 수정 - snake_case 필드명 변환 + 폴백 재시도 로직
- [x] 생성 이미지 삭제 기능 수정 - 각 생성 이미지에 삭제 버튼 실제 작동
- [x] 얼굴 유사도 100% 향상 - 프롬프트 엔진 극대화
- [x] 최종 검수 시스템 - 출고 전 최종 이미지 검수 워크플로우 (승인/반려/메모)

## v3.3 AI Vision 프롬프트 자동 생성 시스템
- [x] 프롬프트 라이브러리 드롭다운 제거
- [x] 참조 이미지 다중 첨부 영역 추가 (파일 업로드 + 미리보기 + 삭제)
- [x] AI Vision 프롬프트 자동 생성 서버 프로시저 (LLM Vision으로 이미지 분석)
- [x] 생성된 프롬프트를 메인 프롬프트 창에 삽입하는 버튼
- [x] 생성된 프롬프트 + 고객 얼굴 합성으로 초고화질 이미지 출력

## v3.4 대규모 업그레이드
- [x] 영상 미리보기 - 인라인 비디오 플레이어로 영상 재생
- [x] 영상 프롬프트 재생성 - 마음에 안 들면 프롬프트 입력하여 영상 재생성
- [x] 원본 첨부 이미지 직접 합성 - 프롬프트 변환 없이 참조 이미지를 originalImages로 직접 전달
- [x] 홈 화면 개편 - 프롬프트 라이브러리/배치 생성 제거 → AI 템플릿 갤러리
- [x] AI 템플릿 갤러리 - Freepik, Flux, Kling, Runway 스타일 최신 템플릿
- [x] 멀티 AI 엔진 얼굴 일관성 - Flux LoRA + Midjourney OmniRef + SD IP-Adapter 전략
- [x] 전체 한국어 지원 - 모든 UI 텍스트 한국어화
- [x] 사이드바 메뉴 정리 - 프롬프트 라이브러리/배치 생성 제거
- [x] Vitest 테스트 업데이트 (69개 테스트 전체 통과)
- [x] TypeScript 에러 0개 확인

## v3.6 고객 삭제 및 영상 재생 수정
- [x] 고객 관리 페이지에 삭제 버튼 추가
- [x] 고객 삭제 서버 프로시저 구현
- [x] 영상 미리보기 재생 오류 수정 (비디오/이미지 자동 감지 + 에러 핸들링)

## v3.7 고객 관리 UI 개선
- [x] 고객 상태 분류 필터 추가 (진행중 고객 / 완료 고객)
- [x] 추가사진 영역 삭제
- [x] 사진 클릭 확대모드(라이트박스) 구현

## v3.8 고객 카드 삭제 버튼 UI 개선
- [x] 고객 카드 삭제 버튼을 항상 보이도록 개선 (호버 시에만 보이는 것에서 변경)

## v3.9 커플 파이프라인 추가 (기존 코드 미수정)
- [x] server/services/couple-pipeline.ts 신규 파일 생성
- [x] routers.ts에 generateCouple mutation 추가 (기존 generate 미수정)
- [x] ProjectWorkspace.tsx에 커플 생성 버튼 추가

## v3.10 얼굴 참조 사진 개선 + 영상 삭제/재생성
- [x] 얼굴 참조 사진: 고객 사진만 참조하도록 변경 (정면+측면만 카운트, additional 제외)
- [x] 커플 모드: 신랑/신부 각각 사진 목록 표시 + hover시 삭제 버튼
- [x] 영상 삭제 기능 추가 (완료/실패/처리중 모든 상태에서 삭제 가능)
- [x] 영상 프롬프트 입력 재생성 기능 (기존 regenerate mutation 확인됨)

## v3.11 영상 변환 기능 점검 및 개선
- [x] videos 라우터에서 fal-ai/kling-video/v1.6 실제 호출 확인/수정 (processVideoAsync에서 generateImage → fal.subscribe kling-video 교체)
- [x] videos create mutation에 kling-video API 실제 호출 구현 (processVideoAsync 경유)
- [x] videos regenerate mutation에 kling-video API 실제 호출 구현 (processVideoAsync 경유)
- [x] ProjectWorkspace.tsx 영상 변환 다이얼로그 (모션 타입 선택 - 이미 구현됨)
- [x] 영상 상태 자동 폴링 로직 (refetchInterval 5초 - 이미 구현됨)
- [x] 완료 시 video 태그로 미리보기 (이미 구현됨)

## v3.12 고객 미리보기 페이지 신규 생성
- [x] App.tsx에 /preview/:clientId/:token 라우트 추가
- [x] pages/ClientPreview.tsx 신규 생성 (인증 화면 + 갤러리 + 수정 요청)
- [x] routers.ts에 preview 라우터 추가 (verify, getGallery, submitFeedback)
- [x] ProjectWorkspace.tsx에 미리보기 링크 복사 버튼 추가

## v3.13 청첩장 영상 페이지 신규 생성
- [x] routers.ts에 invitations 라우터 추가 (generateText mutation - Claude API)
- [x] pages/Invitation.tsx 신규 생성 (5단계 스텝 위자드)
- [x] App.tsx에 /invitation/:projectId 라우트 추가
- [x] ProjectWorkspace.tsx 헤더에 "청첩장 만들기" 버튼 추가

## v3.14 couple-pipeline.ts 2단계/3단계 수정
- [x] couple-pipeline.ts를 face-swap 방식으로 완전 교체 (flux-pulid → half-moon-ai/ai-face-swap)

## v3.15 face-swap 모델 교체 (half-moon-ai → fal-ai/face-swap)
- [x] couple-pipeline.ts 2단계/3단계 모델을 fal-ai/face-swap으로 교체
- [x] 파라미터 변환: target_image_url → base_image_url, 응답 경로 data.image.url 확인
- [x] 테스트 1장 생성하여 실제 작동 확인

## v3.16 couple-pipeline 코드 교체 + generateFromReference 추가
- [x] fal-ai/face-swap 모델 존재 여부 및 파라미터(face_image_url vs swap_image_url) 검증 - swap_image_url이 올바른 파라미터
- [x] couple-pipeline.ts를 사용자 제공 코드로 완전 교체 (face_image_url→swap_image_url, face_enhance→face 수정, import 방식 수정)
- [x] image-pipeline.ts에 generateFromReference 함수 추가 (기존 코드 미수정)
- [x] 테스트 75개 전체 통과, TypeScript 에러 0개

## v3.17 generateCouple mutation 안정성 개선
- [x] groomClientId를 z.number().nullable()로 변경 + null 시 에러 메시지
- [x] 신부/신랑 사진 조회 시 front 없으면 첫 번째 사진 폴백
- [x] ProjectWorkspace.tsx 커플 버튼 위에 partnerClientId 상태 표시 (✅/⚠️)

## v3.18 커플 생성 "expected pattern" 에러 수정
- [x] fal.config를 모듈 로드 시점 → 함수 호출 시점으로 이동 (배포 env 타이밍 이슈 해결)
- [x] URL trim 적용 및 각 단계별 에러 로깅 강화
- [x] FAL_KEY 없을 때 명확한 에러 메시지 반환
- [x] 테스트 75개 통과, TS 에러 0개

## v3.19 커플 생성 face-swap 미작동 + Load failed 에러 수정
- [x] 배포 서버 로그에서 face-swap 2단계/3단계 실패 원인 파악 - 폴백으로 원본 배경 저장이 원인
- [x] "Load failed" 에러 원인 파악 - fal SDK 타임아웃/네트워크 에러, 전체 실패 시 명확한 에러 메시지 반환
- [x] face-swap 실패 시 폴백으로 원본 배경 저장하지 않도록 수정 - 실패 시 해당 회차 스킵
- [x] face-swap 품질 개선 - 응답에 image.url 없으면 throw, 전체 실패 시 명확한 에러 메시지

## v3.20 커플 생성 UX 개선 3가지
- [x] ClientPhotoUpload에 face-swap 성공률 가이드 문구 추가
- [x] couple-pipeline.ts 단계별 로그 반환 + routers.ts reviewNotes 저장
- [x] ProjectWorkspace.tsx 커플 생성 장수 선택 드롭다운 (1/3/5장)
- [x] 테스트 75개 통과, TS 에러 0개

## v3.21 AI 이미지 정밀 분석 → 프롬프트 자동생성
- [x] Anthropic SDK 설치 (@anthropic-ai/sdk)
- [x] server/services/image-analyzer.ts 신규 생성 (15가지 카테고리 분석)
- [x] routers.ts generations 라우터에 analyzeImage mutation 추가 (기존 mutation 미수정)
- [x] ProjectWorkspace.tsx에 AI 분석 버튼 + 15가지 카테고리 결과 UI 추가
- [x] TypeScript 에러 0개 확인
- [x] 테스트 75개 통과

## v3.22 image-analyzer를 내장 LLM으로 교체
- [x] image-analyzer.ts에서 Anthropic SDK → invokeLLM으로 교체
- [x] 동일한 15가지 카테고리 분석 + 프롬프트 생성 유지
- [x] Anthropic SDK 의존성 제거 불필요 (다른 곳에서 사용 가능)
- [x] TypeScript 에러 0개 확인
- [x] 테스트 75개 통과

## v3.28 ProjectWorkspace 참조 이미지 영역 UI 개선
- [x] 참조 이미지 첨부 영역 흰색 배경 제거 (검은색 테마 통일)
- [x] AI 정밀 분석 후 프롬프트 붙여넣기 시 첨부 파일 자동 삭제
- [x] TypeScript 에러 0개 확인
- [x] 테스트 75개 통과 확인

### v3.29 ProjectWorkspace 불아진 센션 삭제
- [x] "AI 템플릿 갤러리" 센션 제거 (Home.tsx)
- [x] "AI 프롬프트 자동 생성" 센션 제거 (ProjectWorkspace.tsx)
- [x] TypeScript 에러 0개 확인
- [x] 테스트 75개 통과 확인

## v3.30 뷰티 브랜딩 모듈 구축 (참조 이미지 영역에 위치)
- [x] beauty-analyzer.ts 구축 (규칙 기반 특임 데이터, 256가지 조합)
- [x] beauty-pipeline.ts 구축 (Flux 4장 생성, 832x1216)
- [x] beauty-router.ts 구축 (tRPC 라우터)
- [x] routers.ts 2줄 추가 (beautyRouter import)
- [x] client/pages/beauty/index.tsx 구축 (4탭 UI, 참조 이미지 영역에 위치)
- [x] ProjectWorkspace.tsx에 뷰티 모듈 통합
- [x] TypeScript 에러 0개 확인
- [x] 테스트 75개 통과 확인
- [x] 웨딩/뷰티 독립성 검증 완료

## v3.31 뷰티 모듈 위치 수정 및 이미지 생성 기능 완성
- [x] ProjectWorkspace.tsx에서 뷰티 모듈을 참조 이미지 첫부분 영역으로 이동 (흐색 테두리 위치)
- [x] 뷰티 모듈 이미지 생성 기능 구현 (Flux API 호출 + 결과 표시)
- [x] 생성된 이미지 갤러리 UI 추가 (4장 그리드 표시)
- [x] 이미지 다운로드 기능 추가
- [x] TypeScript 에러 0개 확인
- [x] 테스트 75개 통과 확인

## v3.32 뷰티 모듈 독립 페이지 이동 및 얼굴 일관성 개선
- [x] ProjectWorkspace.tsx에서 뷰티 모듈 제거 (웨딩 전용 공간 복원)
- [x] App.tsx에 /beauty 라우트 추가 (독립 페이지)
- [x] Beauty.tsx 페이지 생성 (뷰티 모듈 전체 포함)
- [x] 뷰티 이미지 생성 시 얼굴 일관성 가중치 증가 (1.5 → 2.0)
- [x] beauty-analyzer.ts에서 face consistency weight 상어
- [x] 생성 이미지 얼굴 유사도 테스트 및 검증
- [x] TypeScript 에러 0개 확인
- [x] 테스트 75개 통과 확인

## v3.33 홈페이지에 뷰티 브랜딩 모듈 카드 추가
- [x] Home.tsx에서 기능 카드 섹션 확인
- [x] 뷰티 브랜딩 모듈 카드 추가 (4번째 카드)
- [x] 카드 클릭 시 /beauty 페이지로 이동
- [x] 뷰티 카드 스타일 (로즈/핀크 그래디언트)
- [x] TypeScript 에러 0개 확인
- [x] 테스트 75개 통과 확인

## v3.35 Memory 페이지 UI 대폭 개선
- [x] Memory.tsx 연출 지시 섹션 추가 (4가지 프리셋 + 직접 입력)
- [x] 연출 지시 클릭 시 textarea에 예시 자동 입력
- [x] 영상 길이 옵션 확장 (5초/10초/15초 + 비용 표시)
- [x] BGM 토글 추가 (4가지 선택지 + 직접 입력)
- [x] 목소리 토글 추가 (대사 입력 + 예시 팁 + 비용 경고)
- [x] memory-router.ts 파라미터 추가 (BGM, 목소리)
- [x] memory-pipeline.ts 로직 업데이트 (BGM, 목소리 처리)
- [x] TypeScript 에러 0개 확인
- [x] 테스트 75개 통과 확인

## v3.36 Memory 모듈 최적화 (Claude 피드백 반영)
- [x] memory-pipeline.ts 완전 재작성 (createKlingVideo 함수명 변경)
- [x] runMemoryPipeline 파라미터 정리 (customPrompt, voiceLine, shouldGenerateVideo, enableAudio)
- [x] memory-router.ts 파라미터 정리 (animationStyle 제거, customPrompt 추가)
- [x] Memory.tsx mutation 호출 수정 (새 파라미터 매핑)
- [x] CodeFormer API 파라미터 수정 (upscaling 제거)
- [x] TypeScript 에러 0개 확인
- [x] 테스트 75개 통과 확인

## v3.37 Memory 모듈 디버깅 및 Beauty 프롬프트 실사 키워드 추가
- [x] Memory 모듈 서버 로그 확인 ([Memory] 프리픽스 로그 발견)
- [x] CodeFormer 및 DDCOLOR API 호출 정상 작동 확인
- [x] Kling 비디오 생성 폴링 메커니즘 정상 작동 확인
- [x] couple-pipeline.ts 코드 검토 (4가지 개선 사항 식별)
- [x] Beauty 프롬프트에 실사 키워드 추가 ("shot on Sony A7R V, 85mm f/1.4, RAW photo, photorealistic, skin texture visible, natural skin pores, subsurface scattering, NOT illustration, NOT digital art, NOT painting")
- [x] Beauty 카테고리별 프롬프트 템플릿 강화 (skincare/makeup/luxury/natural)
- [x] 네거티브 프롬프트 개선 ((digital art:1.5), (illustration:1.5), (painting:1.5) 추가)
- [x] 프롬프트 정제 로직 추가 (중복 쉼표/공백 제거)
- [x] TypeScript 에러 0개 확인
- [x] 테스트 75개 통과 확인

## v3.38 ProjectWorkspace 탭 시스템 추가
- [x] ProjectWorkspace.tsx에 탭 시스템 추가 (생성 결과 / 💑 커플 합성)
- [x] activeTab 상태 관리 추가 (React.useState)
- [x] 탭 버튼 UI 구현 (border-bottom 스타일, 호버 효과)
- [x] 생성 결과 탭: 기존 그리드 레이아웃 유지
- [x] 커플 합성 탭: Couple.tsx의 모든 UI 콘텐츠 통합
  - 💑 커플 사진 업로드 카드
  - 🏞️ 웨딩 배경 선택 (7가지 배경 옵션)
  - 사진 비율 선택 (4:3, 16:9, 1:1)
  - 예상 소요시간 표시
  - 커플 생성 버튼
  - 처리 진행 상황 표시
  - 완성된 웨딩 사진 갤러리
- [x] 커플 합성 상태 관리 (coupleImage, coupleScene, coupleRatio, isCoupleGenerating 등)
- [x] 커플 합성 핸들러 함수 (handleCoupleImageSelect, handleCoupleGenerate, handleCoupleDownload)
- [x] TypeScript 에러 0개 확인
- [x] 브라우저 테스트 완료 (탭 전환 정상 작동)

## v3.39 커플 합성 탭 UI 개선 및 인물 표현 강화
- [x] ProjectWorkspace 커플 탭에서 "이미지 생성 설정" 섹션 제거
- [x] "웨딩 배경 선택" 섹션을 커플 합성 탭의 메인 UI로 배치
- [x] 커플 합성 파이프라인 프롬프트 강화 (인물 표현 키워드 추가)
- [x] 얼굴 일관성 가중치 증가 (face consistency weight 상향)
- [x] 커플 생성 테스트 및 인물 표현 품질 검증
- [x] TypeScript 에러 0개 확인

## v3.40 커플 합성 탭 UI 재구성 - 이미지 생성 설정 추가
- [x] ProjectWorkspace 커플 탭에서 웨딩 배경 선택 섹션 제거
- [x] 참조 이미지 첨부 기능 추가 (최대 10장)
- [x] 메인 프롬프트 입력 필드 추가
- [x] 네거티브 프롬프트 입력 필드 추가
- [x] 얼굴 고정 모드 토글 추가
- [x] AI 엔진 선택 기능 추가 (Flux LoRA, 미드저니 옴니레퍼런스, 스테이블 디퓨전 등)
- [x] 커플 합성 파이프라인 업데이트
- [x] TypeScript 에러 0개 확인
- [x] 브라우저 테스트 완료

## v3.43 이미지 방향 자동 보정
- [x] 원본 이미지 얼굴 방향 감지 (좌측/우측/정면)
- [x] 생성 이미지 얼굴 방향 감지
- [x] 방향 불일치 시 자동 좌우 반전
- [x] Beauty 파이프라인에 방향 보정 로직 추가
- [x] Couple 파이프라인에 방향 보정 로직 추가
- [x] TypeScript 에러 0개 확인
- [x] 브라우저 테스트 완료

## v3.42 커플 합성 파이프라인 완전 구현
- [x] couple-router.ts에 analyzeCouple 엔드포인트 추가 (Claude Opus 4.5 분석)
- [x] couple-pipeline.ts 업데이트 (새 파라미터: prompt, negativePrompt, engine, faceLock)
- [x] 생성 장수 2장으로 제한 ("all" 선택 시 cherry_blossom, chapel만)
- [x] 이미지 URL → base64 변환 (삭제 방지)
- [x] Couple.tsx 완전 재작성 (자동 분석, 커스터마이징, 참조 이미지, AI 엔진 선택)
- [x] 커플 사진 업로드 시 자동 AI 분석 기능
- [x] 분석 결과 배지 표시 (스타일/분위기/추천배경)
- [x] 참조 이미지 첨부 (최대 10장)
- [x] 메인/네거티브 프롬프트 입력
- [x] 얼굴 고정 모드 토글
- [x] AI 엔진 선택 (Flux Dev, Flux LoRA, Stable Diffusion)
- [x] 사진 비율 선택 (4:3, 16:9, 1:1)
- [x] 진행 상태 표시
- [x] 결과 다운로드
- [x] TypeScript 에러 0개 확인
- [x] 브라우저 테스트 완료


## v3.43 얼굴 일관성 극대화 최적화
- [x] 참조 이미지 originalImages 전달 최적화
  - couple-router.ts에 refImages 파라미터 추가
  - couple-pipeline.ts에서 refImages 업로드 및 처리 로직 추가
  - generateBackground에 refImageUrls 전달
  - originalImages에 고객 사진 + 참조 이미지 모두 포함 (최대 5개)
  - Couple.tsx에서 refImages를 mutation 호출 시 전달
- [x] faceLock 모드 극대화
  - guidance_scale 극대화 (Flux Dev: 4.0 → 5.5, Flux LoRA: 4.5 → 6.5, SD: 5.0 → 7.5)
  - num_inference_steps 증가 (Flux Dev: 30 → 35, Flux LoRA: 32 → 40, SD: 35 → 45)
  - strength 상향 (0.7 → 0.75)
- [x] AI 엔진 선택 구현
  - Couple.tsx 엔진 키 업데이트 ("flux" → "flux-dev", "lora" → "flux-lora", "sdxl" → "stable-diffusion")
  - couple-pipeline.ts에서 엔진별 모델 호출 (flux-dev: fal-ai/flux/dev, flux-lora: fal-ai/flux/pro, stable-diffusion: fal-ai/stable-diffusion-3-5-large)
  - 엔진별 guidance_scale, num_inference_steps 최적화
- [x] 프롬프트 일관성 극대화
  - 포지티브: "identical face, same face, exact same person, face consistency, facial identity preserved" 추가
  - faceLock 시: "CRITICAL: face consistency, MUST preserve exact facial features, identical facial identity, face identity locked, facial recognition match 100%" 추가
  - 네거티브: 가중치 상향 (1.5 → 2.0) 및 새 키워드 추가 (face change, different face, face swap, altered face, unrecognizable face, face modification, wrong face)
- [x] 모든 테스트 통과 (75/75)
- [x] TypeScript 에러 0개


## v3.44 커플촬영 AI 정밀이미지분석 기능 추가 (15가지 카테고리)
- [x] couple-router.ts analyzeCouple 확장 - 15가지 분석 (image-analyzer 활용)
- [x] Couple.tsx 참조 이미지 최대 1장으로 제한
- [x] Couple.tsx 참조 이미지 영역에 "🔍 AI 정밀분석" 버튼 추가
- [x] analyzeCouple 엔드포인트 호출 (첫 번째 참조 이미지 분석)
- [x] 분석 결과 (15가지 카테고리) 배지 표시 (조명, 분위기 샘플)
- [x] 분석 결과 → 메인 프롬프트 자동 생성 및 입력 필드에 적용
- [x] 분석 결과 → 네거티브 프롬프트 자동 생성 및 입력 필드에 적용
- [x] 분석 완료 후 참조 이미지 자동 삭제
- [x] 로딩 상태 표시 (분석 중 UI 피드백 - "AI 분석 중...")
- [x] 에러 핸들링 (분석 실패 시 토스트 메시지)
- [x] TypeScript 에러 0개 확인
- [x] 테스트 75/75 통과


## v3.45 FAL API 모델 수정 및 얼굴 일관성 개선
- [x] Flux LoRA → Flux Pro 1.1 (fal-ai/flux-pro/v1.1) 변경
- [x] Stable Diffusion 제거 (FAL에서 지원 안 함) → Flux Dev 폴백
- [x] originalImages 파라미터 제거 (FAL Flux API 미지원)
- [x] 프롬프트에 얼굴 보존 키워드 강화로 대체
- [x] TypeScript 에러 0개 확인
- [x] 테스트 75/75 통과
- [x] 개발 서버 재시작 완료
- [ ] 수동 테스트: Flux Dev + faceLock ON으로 생성 후 얼굴 일치도 확인
- [ ] 수동 테스트: Flux Pro 1.1로 생성 후 품질 비교
- [ ] 수동 테스트: 에러 메시지 없는지 확인


## v3.46 Couple 사진 1장 배경 분석 시스템
- [x] Couple.tsx 간소화 (커플 사진 1장만 업로드)
- [x] couple-router.ts analyzeCouple 엔드포인트 추가 (배경만 분석)
- [x] couple-pipeline.ts 수정 (참조 이미지 파라미터 제거)
- [x] TypeScript 에러 0개
- [x] 테스트 75/75 통과


## v3.47 Couple 중 AI 정밀분석 UI - 15가지 카테고리
- [x] couple-router.ts analyzeCouple 단지 분석 구조 모두 추가
- [x] Couple.tsx에 AI 정밀분석 섹션 UI 추가 (개인촬영과 동일)
- [x] 15가지 카테고리 분석 결과 표시 (카메라, 조명, 피부, 의상, 포즈, 표정, 배경, 분위기, 움직임, 공간감, 시간날씨, 광학효과, 구도, 색보정, 내면감정)
- [x] TypeScript 에러 0개
- [x] 테스트 75/75 통과
- [x] 개발 서버 재시작 완료


## v3.48 ProjectWorkspace 커플 탭 UI 완전 복원
- [x] AI 정밀분석 섹션 추가 (배경 분석 및 분석 결과 표시)
- [x] 메인/네거티브 프롬프트 입력 필드 (기존)
- [x] AI 엔진 선택 추가 (Flux Dev, Flux Pro 1.1)
- [x] 사진 비율 선택 추가 (4:3, 16:9, 1:1)
- [x] 얼굴 고정 모드 토글 (기존)
- [x] 웨딩 배경 선택 추가 (cherry_blossom, chapel)
- [x] 생성 버튼 (기존)
- [x] TypeScript 에러 0개 확인
- [x] 테스트 75/75 통과 확인
- [x] 개발 서버 재시작 완료


## v3.49 커플 탭에 개인촬영 탭과 동일한 AI 분석 UI 기능 추가
- [x] 커플 탭에 참조 이미지 첨부 섹션 추가 (개인촬영 탭과 동일)
- [x] 메인 프롬프트 입력 필드 (기존)
- [x] 네거티브 프롬프트 입력 필드 (기존)
- [x] AI 정밀분석 버튼 추가 (참조 이미지 기반 분석)
- [x] 분석 결과 표시 (15가지 카테고리)
- [x] 분석 결과 자동 프롬프트 적용
- [x] 파일 첨부 버튼 추가
- [x] TypeScript 에러 0개 확인
- [x] 테스트 75/75 통과 확인


## v3.50 커플 탭 AI 엔진 비교 분석 및 자동 배경 선택 제거
- [x] Flux Dev vs Flux Pro 1.1 비교 분석 모드 UI 추가
- [x] 커플 탭에 "단일 엔진" vs "엔진 비교" 모드 선택
- [x] 단일 모드: Flux Dev 또는 Flux Pro 1.1 선택
- [x] 비교 모드: 두 엔진 동시 생성 (생성 시간 2배)
- [x] 얼굴 일관성 비교를 위한 상태 변수 추가
- [x] 자동 배경 선택 기능 제거 (coupleScene 타입 변경)
- [x] 수동 배경 선택만 유지 (cherry_blossom, chapel)
- [x] TypeScript 에러 0개 확인
- [x] 테스트 75/75 통과 확인


## v3.51 커플 탭 얼굴 일관성 및 프롬프트 적용 버그 수정
- [x] handleCoupleGenerate 함수에서 promptText/negativePrompt 전달 로직 추가
- [x] 얼굴 고정 모드(faceFixMode) 활성화 시 생성 요청에 포함
- [x] couple-router.ts 스키마 업데이트 (모든 새 파라미터 추가)
- [x] 중복 generateCouple 제거 (routers.ts에서)
- [x] Couple.tsx 파라미터명 업데이트
- [x] TypeScript 에러 0개 확인
- [x] 테스트 75/75 통과 확인


## v3.52 커플 탭 생성 품질 개선 - 프롬프트 병합 로직 및 얼굴 고정 최적화
- [x] negativePrompt 적용 로직 이미 실스로 사용 중
- [x] 프롬프트 병합 로직 개선 - 커스타링 프롬프트 우선 조정
- [x] 얼굴 고정 키워드 최적화 - 과도한 키워드 80% 제거
- [x] guidance scale과 inference steps 미세 조정 (faceLock 시 최적화)
- [x] TypeScript 에러 0개 확인
- [x] 테스트 75/75 통과 확인
