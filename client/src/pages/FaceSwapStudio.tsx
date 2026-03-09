/**
 * FaceSwapStudio.tsx
 *
 * 얼굴 교체 + 스타일 프롬프트 생성 통합 UI
 * Route: /studio/face-swap
 *
 * 탭:
 *   커플 얼굴 교체 | 스타일 → 프롬프트
 */

import { useState, useRef, useCallback } from 'react';

const API = '/api/face-swap';

type Tab = 'swap' | 'prompt';

// ── Sub Components ────────────────────────────────────────────────────────────

function UploadBox({ label, preview, onFile, icon = '📷', hint }:
{ label: string; preview: string | null; onFile: (f: File) => void; icon?: string; hint?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div style={s.uploadWrap}>
      <div style={s.uploadLabel}>{label}</div>
      {hint && <div style={s.uploadHint}>{hint}</div>}
      <div
        style={{ ...s.dropzone, ...(preview ? s.dropzoneFilled : {}) }}
        onClick={() => ref.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}
      >
        {preview
          ? <img src={preview} style={s.previewImg} alt={label} />
          : <><span style={s.dropIcon}>{icon}</span><span style={s.dropText}>{label}</span></>}
      </div>
      <input ref={ref} type="file" accept="image/*" hidden onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
    </div>
  );
}

function RangeSlider({ label, value, min, max, step, onChange }:
{ label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <div style={s.sliderRow}>
      <div style={s.sliderLabel}>{label}: <span style={{ color: '#c9a96e' }}>{value}</span></div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))} style={s.slider} />
    </div>
  );
}

function StepLog({ steps }: { steps: string[] }) {
  if (!steps.length) return null;
  return (
    <div style={s.stepLog}>
      <div style={s.stepLogTitle}>⚙ 처리 과정</div>
      {steps.map((st, i) => (
        <div key={i} style={{
          ...s.stepLine,
          color: st.startsWith('✅') ? '#6ec68a' : st.includes('완료 ✓') ? '#8ec8a0' : '#9a95b0'
        }}>{st}</div>
      ))}
    </div>
  );
}

function PromptCard({ prompt, index }: { prompt: any; index: number }) {
  const [copied, setCopied] = useState(false);
  const [copiedFlux, setCopiedFlux] = useState(false);
  const copy = (text: string, setFn: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setFn(true);
    setTimeout(() => setFn(false), 2000);
  };
  return (
    <div style={s.promptCard}>
      <div style={s.promptCardHeader}>
        <span style={s.promptIndex}>#{index + 1}</span>
        <span style={s.promptTitle}>{prompt.title}</span>
        <span style={s.promptUseCase}>{prompt.useCase}</span>
      </div>
      <div style={s.promptBox}>
        <div style={s.promptLabel}>Midjourney</div>
        <div style={s.promptText}>{prompt.prompt}</div>
        <button style={{ ...s.copyBtn, ...(copied ? s.copyBtnDone : {}) }}
          onClick={() => copy(prompt.prompt, setCopied)}>
          {copied ? '✓ 복사됨' : '📋 복사'}
        </button>
      </div>
      <div style={{ ...s.promptBox, marginTop: 8 }}>
        <div style={s.promptLabel}>Flux / FAL AI</div>
        <div style={s.promptText}>{prompt.fluxPrompt}</div>
        <button style={{ ...s.copyBtn, ...(copiedFlux ? s.copyBtnDone : {}) }}
          onClick={() => copy(prompt.fluxPrompt, setCopiedFlux)}>
          {copiedFlux ? '✓ 복사됨' : '📋 복사'}
        </button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function FaceSwapStudio() {
  const [tab, setTab] = useState<Tab>('swap');

  // Swap tab state
  const [targetFile, setTargetFile] = useState<File | null>(null);
  const [brideFile, setBrideFile] = useState<File | null>(null);
  const [groomFile, setGroomFile] = useState<File | null>(null);
  const [targetPreview, setTargetPreview] = useState<string | null>(null);
  const [bridePreview, setBridePreview] = useState<string | null>(null);
  const [groomPreview, setGroomPreview] = useState<string | null>(null);
  const [faceStrength, setFaceStrength] = useState(0.9);
  const [restoreStrength, setRestoreStrength] = useState(0.8);
  const [useCodeFormer, setUseCodeFormer] = useState(true);

  // Prompt tab state
  const [styleFile, setStyleFile] = useState<File | null>(null);
  const [stylePreview, setStylePreview] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  // Shared state
  const [result, setResult] = useState<string | null>(null);
  const [intermediate, setIntermediate] = useState<string | null>(null);
  const [steps, setSteps] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [error, setError] = useState<string | null>(null);

  const setFileWithPreview = (setFile: (f: File) => void, setPreview: (p: string) => void) =>
    (file: File) => { setFile(file); setPreview(URL.createObjectURL(file)); };

  // ── 얼굴 교체 실행 ─────────────────────────────────────────────────────────
  const handleSwap = useCallback(async () => {
    if (!targetFile) { setError('타겟 이미지를 업로드해주세요.'); return; }
    if (!brideFile && !groomFile) { setError('신부 또는 신랑 얼굴 사진이 필요합니다.'); return; }

    setError(null); setLoading(true); setResult(null); setIntermediate(null); setSteps([]);
    setLoadingMsg('FAL Reactor 얼굴 교체 중...');

    try {
      const form = new FormData();
      form.append('target', targetFile);
      if (brideFile) form.append('bride', brideFile);
      if (groomFile) form.append('groom', groomFile);
      form.append('faceStrength', String(faceStrength));
      form.append('restoreStrength', String(restoreStrength));
      form.append('useCodeFormer', String(useCodeFormer));

      const res = await fetch(`${API}/couple`, { method: 'POST', body: form });
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
      const data = await res.json();

      setResult(`data:image/jpeg;base64,${data.imageBase64}`);
      if (data.intermediateBase64) setIntermediate(`data:image/jpeg;base64,${data.intermediateBase64}`);
      setSteps(data.processingSteps ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [targetFile, brideFile, groomFile, faceStrength, restoreStrength, useCodeFormer]);

  // ── 스타일 프롬프트 생성 ────────────────────────────────────────────────────
  const handleStylePrompt = useCallback(async () => {
    if (!styleFile) { setError('스타일 참고 사진을 업로드해주세요.'); return; }

    setError(null); setLoading(true); setAnalysisResult(null); setSteps([]);
    setLoadingMsg('Claude Vision 스타일 분석 중...');

    try {
      const form = new FormData();
      form.append('style', styleFile);

      const res = await fetch(`${API}/style-prompt`, { method: 'POST', body: form });
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
      const data = await res.json();

      setAnalysisResult(data);
      setSteps(['✅ Claude Vision 분석 완료', `✅ ${data.prompts?.length ?? 0}개 Midjourney 프롬프트 생성됨`]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [styleFile]);

  return (
    <div style={s.root}>
      {/* 로딩 오버레이 */}
      {loading && (
        <div style={s.loadingOverlay}>
          <div style={s.spinner} />
          <div style={s.loadingMsg}>{loadingMsg}</div>
          <div style={s.loadingSub}>FAL AI + Claude 처리 중 · 30~90초 소요</div>
        </div>
      )}

      {/* 헤더 */}
      <div style={s.header}>
        <span style={s.logo}>✦ ONE AI STUDIO</span>
        <span style={s.headerSub}>Face Swap Studio — FAL Reactor · CodeFormer · Claude Vision</span>
      </div>

      {/* 탭 */}
      <div style={s.tabBar}>
        <button onClick={() => { setTab('swap'); setError(null); }}
          style={{ ...s.tab, ...(tab === 'swap' ? s.tabActive : {}) }}>
          🔄 커플 얼굴 교체
        </button>
        <button onClick={() => { setTab('prompt'); setError(null); }}
          style={{ ...s.tab, ...(tab === 'prompt' ? s.tabActive : {}) }}>
          🎨 스타일 → MJ 프롬프트
        </button>
      </div>

      {error && <div style={s.error}>⚠ {error}</div>}

      <div style={s.body}>

        {/* ── 얼굴 교체 탭 ── */}
        {tab === 'swap' && (
          <>
            <div style={s.infoBox}>
              💡 <strong>사용법:</strong> Gemini/Flux로 생성된 웨딩 이미지에 실제 고객 얼굴을 교체합니다.
              신랑 → 신부 순서로 순차 처리되며 얼굴 100% 보존이 목표입니다.
            </div>

            <div style={s.uploadRow}>
              <UploadBox label="🖼 생성된 웨딩 이미지" preview={targetPreview} icon="🖼"
                hint="Gemini / Flux / MJ 결과물"
                onFile={setFileWithPreview(f => setTargetFile(f), p => setTargetPreview(p))} />
              <UploadBox label="🤵 신랑 얼굴 원본" preview={groomPreview} icon="🤵"
                hint="정면, 밝은 사진 권장"
                onFile={setFileWithPreview(f => setGroomFile(f), p => setGroomPreview(p))} />
              <UploadBox label="👰 신부 얼굴 원본" preview={bridePreview} icon="👰"
                hint="정면, 밝은 사진 권장"
                onFile={setFileWithPreview(f => setBrideFile(f), p => setBridePreview(p))} />
            </div>

            <div style={s.optPanel}>
              <RangeSlider label="얼굴 교체 강도" value={faceStrength} min={0.5} max={1.0} step={0.05} onChange={setFaceStrength} />
              <RangeSlider label="얼굴 복원 fidelity" value={restoreStrength} min={0.5} max={1.0} step={0.05} onChange={setRestoreStrength} />
              <div style={s.toggleRow}>
                <button
                  style={{ ...s.toggleBtn, ...(useCodeFormer ? s.toggleBtnOn : {}) }}
                  onClick={() => setUseCodeFormer(v => !v)}>
                  {useCodeFormer ? '✓' : '○'} CodeFormer 얼굴 선명화
                </button>
              </div>
              <div style={s.processPipeline}>
                <span style={s.pipeChip}>FAL Reactor</span>
                <span style={s.pipeArrow}>→</span>
                {useCodeFormer && <><span style={s.pipeChip}>CodeFormer</span><span style={s.pipeArrow}>→</span></>}
                <span style={s.pipeChip}>색 그레이딩</span>
              </div>
            </div>

            <button style={s.btnPrimary} onClick={handleSwap} disabled={loading}>
              🔄 얼굴 교체 실행
            </button>

            {/* 중간 결과 & 최종 결과 */}
            {(intermediate || result) && (
              <div style={s.resultRow}>
                {intermediate && (
                  <div style={s.resultItem}>
                    <div style={s.resultLabel}>Reactor 직후 (CodeFormer 이전)</div>
                    <img src={intermediate} style={s.resultImg} alt="intermediate" />
                  </div>
                )}
                {result && (
                  <div style={s.resultItem}>
                    <div style={s.resultLabel}>✅ 최종 결과</div>
                    <img src={result} style={s.resultImg} alt="result" />
                    <a href={result} download="face_swap_result.jpg" style={s.btnDownload}>
                      ⬇ 다운로드
                    </a>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── 스타일 프롬프트 탭 ── */}
        {tab === 'prompt' && (
          <>
            <div style={s.infoBox}>
              💡 <strong>사용법:</strong> 핀터레스트, 인스타그램 등에서 원하는 웨딩 사진을 저장 후 업로드하면,
              Claude Vision이 분석하여 Midjourney v6.1 최적화 프롬프트 5개를 자동 생성합니다.
            </div>

            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: '0 0 280px' }}>
                <UploadBox label="🎨 희망 스타일 사진" preview={stylePreview} icon="🎨"
                  hint="핀터레스트 / 인스타 참고 사진"
                  onFile={setFileWithPreview(f => setStyleFile(f), p => setStylePreview(p))}
                />
                <button style={{ ...s.btnPrimary, marginTop: 16 }} onClick={handleStylePrompt} disabled={loading || !styleFile}>
                  🔍 스타일 분석 & 프롬프트 생성
                </button>
              </div>

              {/* 분석 결과 */}
              {analysisResult?.analysis && (
                <div style={s.analysisBox}>
                  <div style={s.analysisTitle}>📊 Claude Vision 분석 결과</div>
                  <div style={s.analysisGrid}>
                    {[
                      ['장소', analysisResult.analysis.venue],
                      ['조명', analysisResult.analysis.lightingType],
                      ['색온도', analysisResult.analysis.colorTemperature],
                      ['분위기', analysisResult.analysis.overallMood],
                      ['드레스', analysisResult.analysis.dressStyle],
                      ['신랑', analysisResult.analysis.groomStyle],
                      ['구도', analysisResult.analysis.composition],
                      ['포즈', analysisResult.analysis.poseStyle],
                      ['계절', analysisResult.analysis.season],
                      ['시간대', analysisResult.analysis.timeOfDay],
                    ].map(([k, v]) => (
                      <div key={k} style={s.analysisChip}>
                        <span style={s.analysisKey}>{k}</span>
                        <span style={s.analysisVal}>{v}</span>
                      </div>
                    ))}
                  </div>
                  {analysisResult.analysis.styleKeywords?.length > 0 && (
                    <div style={s.keywords}>
                      {analysisResult.analysis.styleKeywords.map((kw: string) => (
                        <span key={kw} style={s.keyword}>{kw}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 생성된 프롬프트들 */}
            {analysisResult?.prompts?.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <div style={s.sectionTitle}>✨ 생성된 Midjourney 프롬프트 ({analysisResult.prompts.length}개)</div>
                {analysisResult.prompts.map((p: any, i: number) => (
                  <PromptCard key={i} prompt={p} index={i} />
                ))}
              </div>
            )}
          </>
        )}

        <StepLog steps={steps} />
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  root: { fontFamily: "'Pretendard','Apple SD Gothic Neo',sans-serif", background: '#0e0f13', minHeight: '100vh', color: '#e8e4dc', position: 'relative' },
  header: { background: 'linear-gradient(135deg,#1a1520,#0e1520)', borderBottom: '1px solid #2a2535', padding: '18px 32px', display: 'flex', alignItems: 'center', gap: 20 },
  logo: { fontSize: 20, fontWeight: 700, letterSpacing: '0.12em', color: '#c9a96e' },
  headerSub: { fontSize: 12, color: '#7a7090', letterSpacing: '0.06em' },
  tabBar: { display: 'flex', borderBottom: '1px solid #1e1c28', padding: '0 32px' },
  tab: { padding: '14px 24px', background: 'none', border: 'none', borderBottom: '2px solid transparent', color: '#5a5870', fontSize: 14, cursor: 'pointer', fontWeight: 500 },
  tabActive: { color: '#c9a96e', borderBottomColor: '#c9a96e' },
  error: { margin: '16px 32px', padding: '12px 16px', background: '#2a1520', border: '1px solid #6a2535', borderRadius: 8, color: '#e07070', fontSize: 13 },
  body: { padding: '24px 32px', maxWidth: 1200, margin: '0 auto' },
  infoBox: { padding: '12px 16px', background: '#141a20', border: '1px solid #2a3040', borderRadius: 10, fontSize: 13, color: '#9aa5b8', lineHeight: 1.6, marginBottom: 20 },
  uploadRow: { display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 },
  uploadWrap: { flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 6 },
  uploadLabel: { fontSize: 13, fontWeight: 600, color: '#c9a96e' },
  uploadHint: { fontSize: 11, color: '#5a5870' },
  dropzone: { border: '1.5px dashed #2e2a40', borderRadius: 12, minHeight: 180, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: 8, padding: 12, background: '#141620' },
  dropzoneFilled: { padding: 4 },
  dropIcon: { fontSize: 28 },
  dropText: { fontSize: 12, color: '#7a7090' },
  previewImg: { width: '100%', objectFit: 'contain', borderRadius: 8, maxHeight: 200 },
  optPanel: { background: '#141620', border: '1px solid #22202e', borderRadius: 12, padding: 20, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 14 },
  sliderRow: { display: 'flex', flexDirection: 'column', gap: 6 },
  sliderLabel: { fontSize: 13, color: '#9a95b0' },
  slider: { width: '100%', accentColor: '#c9a96e' },
  toggleRow: { display: 'flex', gap: 8 },
  toggleBtn: { padding: '8px 16px', borderRadius: 8, border: '1px solid #2e2a40', background: '#1c1a2a', color: '#7a7090', fontSize: 13, cursor: 'pointer' },
  toggleBtnOn: { background: '#2a2040', borderColor: '#c9a96e', color: '#c9a96e' },
  processPipeline: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  pipeChip: { padding: '4px 10px', borderRadius: 20, background: '#1e2a1e', border: '1px solid #3a5a3a', color: '#6ec68a', fontSize: 11 },
  pipeArrow: { color: '#4a4860', fontSize: 14 },
  btnPrimary: { width: '100%', padding: '14px', background: 'linear-gradient(135deg,#c9a96e,#a07840)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 16 },
  btnDownload: { display: 'block', textAlign: 'center', padding: '10px', background: 'linear-gradient(135deg,#3a5a3a,#2a4a2a)', border: 'none', borderRadius: 8, color: '#6ec68a', fontSize: 13, fontWeight: 700, textDecoration: 'none', marginTop: 8 },
  resultRow: { display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 20 },
  resultItem: { flex: 1, minWidth: 280, background: '#141620', border: '1px solid #22202e', borderRadius: 12, padding: 16 },
  resultLabel: { fontSize: 12, color: '#7a7090', marginBottom: 10, letterSpacing: '0.06em' },
  resultImg: { width: '100%', borderRadius: 8, objectFit: 'contain', maxHeight: 400 },
  stepLog: { background: '#0c0a14', border: '1px solid #1e1c28', borderRadius: 10, padding: 16, marginTop: 20 },
  stepLogTitle: { fontSize: 11, color: '#c9a96e', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 },
  stepLine: { fontSize: 12, lineHeight: 1.8, fontFamily: 'monospace' },
  analysisBox: { flex: 1, background: '#141620', border: '1px solid #22202e', borderRadius: 12, padding: 20 },
  analysisTitle: { fontSize: 14, fontWeight: 700, color: '#c9a96e', marginBottom: 14 },
  analysisGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 },
  analysisChip: { background: '#1c1a2a', border: '1px solid #2e2a40', borderRadius: 8, padding: '6px 10px' },
  analysisKey: { display: 'block', fontSize: 10, color: '#7a7090', textTransform: 'uppercase', letterSpacing: '0.08em' },
  analysisVal: { fontSize: 13, color: '#e8e4dc', fontWeight: 500, textTransform: 'capitalize' },
  keywords: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  keyword: { padding: '3px 8px', borderRadius: 20, background: '#1e1a30', border: '1px solid #3e3a60', color: '#9a95c8', fontSize: 11 },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: '#c9a96e', marginBottom: 16 },
  promptCard: { background: '#141620', border: '1px solid #22202e', borderRadius: 12, padding: 18, marginBottom: 14 },
  promptCardHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 },
  promptIndex: { width: 28, height: 28, borderRadius: '50%', background: '#2a2040', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#c9a96e' },
  promptTitle: { fontSize: 14, fontWeight: 700, color: '#e8e4dc', flex: 1 },
  promptUseCase: { fontSize: 11, color: '#7a7090', background: '#1c1a2a', padding: '3px 8px', borderRadius: 20 },
  promptBox: { background: '#0c0a14', border: '1px solid #1e1c28', borderRadius: 8, padding: '12px 14px', position: 'relative' },
  promptLabel: { fontSize: 10, color: '#7a7090', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 },
  promptText: { fontSize: 12, color: '#c9c5d8', lineHeight: 1.7, paddingRight: 60, wordBreak: 'break-all' },
  copyBtn: { position: 'absolute', top: 10, right: 10, padding: '4px 10px', background: '#2a2535', border: '1px solid #3e3a50', borderRadius: 6, color: '#9a95b0', fontSize: 11, cursor: 'pointer' },
  copyBtnDone: { background: '#1e3a2a', borderColor: '#3a6a4a', color: '#6ec68a' },
  loadingOverlay: { position: 'fixed', inset: 0, background: 'rgba(14,15,19,0.93)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 999, gap: 16 },
  spinner: { width: 48, height: 48, border: '3px solid #2a2535', borderTop: '3px solid #c9a96e', borderRadius: '50%', animation: 'spin 1s linear infinite' },
  loadingMsg: { fontSize: 16, color: '#c9a96e', fontWeight: 600 },
  loadingSub: { fontSize: 13, color: '#7a7090' },
};
