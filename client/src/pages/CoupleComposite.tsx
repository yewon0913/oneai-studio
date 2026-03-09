/**
 * CoupleComposite.tsx
 *
 * 커플 합성 스튜디오 페이지
 * Route: /studio/couple-composite
 *
 * 탭 구성:
 * 커플 합성 | 신부 단독 | 신랑 단독
 */

import { useState, useCallback, useRef } from 'react';

const API = '/api/couple-composite';

type Layout = 'side-by-side' | 'overlapping' | 'solo-bride' | 'solo-groom';
type Shadow = 'none' | 'soft' | 'medium' | 'strong';
type Tab = 'couple' | 'bride' | 'groom';

const LAYOUTS = [
  { value: 'side-by-side', label: '👫 나란히', desc: '신랑 좌 · 신부 우' },
  { value: 'overlapping',  label: '💑 자연스럽게', desc: '자연스럽게 겹침' },
];

const SHADOW_OPTS = [
  { value: 'none',   label: '없음' },
  { value: 'soft',   label: '부드럽게' },
  { value: 'medium', label: '보통' },
  { value: 'strong', label: '강하게' },
];

// ── Sub UI ────────────────────────────────────────────────────────────────────

function UploadBox({
  label, preview, onFile, accept = 'image/*', icon = '📷'
}: {
  label: string; preview: string | null;
  onFile: (f: File) => void; accept?: string; icon?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div style={s.uploadWrap}>
      <span style={s.uploadLabel}>{label}</span>
      <div
        style={{ ...s.dropzone, ...(preview ? s.dropzoneFilled : {}) }}
        onClick={() => ref.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]); }}
      >
        {preview
          ? <img src={preview} style={s.previewImg} alt={label} />
          : <><span style={s.dropIcon}>{icon}</span><span style={s.dropText}>{label} 업로드</span></>}
      </div>
      <input ref={ref} type="file" accept={accept} hidden onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
    </div>
  );
}

function ToggleBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{ ...s.toggleBtn, ...(active ? s.toggleBtnActive : {}) }}
    >
      {children}
    </button>
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
          color: st.startsWith('✅') ? '#6ec68a'
            : st.startsWith('──') ? '#c9a96e'
            : '#9a95b0'
        }}>
          {st}
        </div>
      ))}
    </div>
  );
}

function LoadingOverlay({ message }: { message: string }) {
  return (
    <div style={s.loadingOverlay}>
      <div style={s.loadingSpinner} />
      <div style={s.loadingMsg}>{message}</div>
      <div style={s.loadingSub}>FAL AI 처리 중… 30~60초 소요될 수 있습니다</div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CoupleComposite() {
  const [tab, setTab] = useState<Tab>('couple');

  // Files
  const [brideFile, setBrideFile] = useState<File | null>(null);
  const [groomFile, setGroomFile] = useState<File | null>(null);
  const [bgFile, setBgFile] = useState<File | null>(null);
  const [soloFile, setSoloFile] = useState<File | null>(null);
  const [soloBgFile, setSoloBgFile] = useState<File | null>(null);

  // Previews
  const [bridePreview, setBridePreview] = useState<string | null>(null);
  const [groomPreview, setGroomPreview] = useState<string | null>(null);
  const [bgPreview, setBgPreview] = useState<string | null>(null);
  const [soloPreview, setSoloPreview] = useState<string | null>(null);
  const [soloBgPreview, setSoloBgPreview] = useState<string | null>(null);

  // Options
  const [layout, setLayout] = useState<Layout>('side-by-side');
  const [shadow, setShadow] = useState<Shadow>('soft');
  const [useCodeFormer, setUseCodeFormer] = useState(true);
  const [useIcLight, setUseIcLight] = useState(true);

  // Results
  const [result, setResult] = useState<string | null>(null);
  const [brideResult, setBrideResult] = useState<string | null>(null);
  const [groomResult, setGroomResult] = useState<string | null>(null);
  const [steps, setSteps] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [error, setError] = useState<string | null>(null);

  const setFile = useCallback((setter: (f: File) => void, previewSetter: (p: string) => void) =>
    (file: File) => {
      setter(file);
      previewSetter(URL.createObjectURL(file));
    }, []);

  // ── 커플 합성 실행 ─────────────────────────────────────────────────────────
  const handleCouple = useCallback(async () => {
    if (!bgFile) { setError('배경 이미지를 업로드해주세요.'); return; }
    if (!brideFile && !groomFile) { setError('신부 또는 신랑 이미지가 필요합니다.'); return; }

    setError(null); setLoading(true); setResult(null); setSteps([]);
    setLoadingMsg('BiRefNet 배경 제거 중...');

    try {
      const form = new FormData();
      if (brideFile) form.append('bride', brideFile);
      if (groomFile) form.append('groom', groomFile);
      form.append('background', bgFile);
      form.append('layout', layout);
      form.append('shadowIntensity', shadow);
      form.append('useCodeFormer', String(useCodeFormer));
      form.append('useIcLight', String(useIcLight));

      const res = await fetch(`${API}/run`, { method: 'POST', body: form });
      if (!res.ok) throw new Error(`합성 실패: ${res.statusText}`);

      const data = await res.json();
      setResult(`data:image/jpeg;base64,${data.imageBase64}`);
      if (data.brideBase64) setBrideResult(`data:image/png;base64,${data.brideBase64}`);
      if (data.groomBase64) setGroomResult(`data:image/png;base64,${data.groomBase64}`);
      setSteps(data.processingSteps ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [brideFile, groomFile, bgFile, layout, shadow, useCodeFormer, useIcLight]);

  // ── 단독 합성 실행 ─────────────────────────────────────────────────────────
  const handleSolo = useCallback(async (role: 'bride' | 'groom') => {
    if (!soloFile || !soloBgFile) { setError('인물과 배경 이미지를 모두 업로드해주세요.'); return; }

    setError(null); setLoading(true); setResult(null); setSteps([]);
    setLoadingMsg('단독 합성 처리 중...');

    try {
      const form = new FormData();
      form.append('subject', soloFile);
      form.append('background', soloBgFile);
      form.append('role', role);
      form.append('shadowIntensity', shadow);
      form.append('useCodeFormer', String(useCodeFormer));
      form.append('useIcLight', String(useIcLight));

      const res = await fetch(`${API}/solo`, { method: 'POST', body: form });
      if (!res.ok) throw new Error(`합성 실패: ${res.statusText}`);

      const data = await res.json();
      setResult(`data:image/jpeg;base64,${data.imageBase64}`);
      setSteps(data.processingSteps ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [soloFile, soloBgFile, shadow, useCodeFormer, useIcLight]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={s.root}>
      {loading && <LoadingOverlay message={loadingMsg} />}

      {/* Header */}
      <div style={s.header}>
        <span style={s.logo}>✦ ONE AI STUDIO</span>
        <span style={s.headerSub}>Couple Composite — FAL AI BiRefNet · IC-Light · CodeFormer</span>
      </div>

      {/* Tab Bar */}
      <div style={s.tabBar}>
        {(['couple', 'bride', 'groom'] as Tab[]).map((t) => {
          const labels: Record<Tab, string> = { couple: '💑 커플 합성', bride: '👰 신부 단독', groom: '🤵 신랑 단독' };
          return (
            <button key={t} onClick={() => { setTab(t); setResult(null); setSteps([]); }}
              style={{ ...s.tab, ...(tab === t ? s.tabActive : {}) }}>{labels[t]}</button>
          );
        })}
      </div>

      {error && <div style={s.error}>⚠ {error}</div>}

      <div style={s.body}>
        {/* ── 커플 합성 탭 ── */}
        {tab === 'couple' && (
          <>
            <div style={s.uploadRow}>
              <UploadBox label="👰 신부 사진" preview={bridePreview}
                onFile={setFile(f => setBrideFile(f), p => setBridePreview(p))} icon="👰" />
              <UploadBox label="🤵 신랑 사진" preview={groomPreview}
                onFile={setFile(f => setGroomFile(f), p => setGroomPreview(p))} icon="🤵" />
              <UploadBox label="🌿 배경 이미지" preview={bgPreview}
                onFile={setFile(f => setBgFile(f), p => setBgPreview(p))} icon="🌿" />
            </div>

            <div style={s.optionsPanel}>
              <div style={s.optionGroup}>
                <span style={s.optLabel}>레이아웃</span>
                <div style={s.toggleRow}>
                  {LAYOUTS.map(l => (
                    <ToggleBtn key={l.value} active={layout === l.value} onClick={() => setLayout(l.value as Layout)}>
                      <div>{l.label}</div>
                      <div style={s.optDesc}>{l.desc}</div>
                    </ToggleBtn>
                  ))}
                </div>
              </div>

              <div style={s.optionGroup}>
                <span style={s.optLabel}>그림자</span>
                <div style={s.toggleRow}>
                  {SHADOW_OPTS.map(o => (
                    <ToggleBtn key={o.value} active={shadow === o.value} onClick={() => setShadow(o.value as Shadow)}>
                      {o.label}
                    </ToggleBtn>
                  ))}
                </div>
              </div>

              <div style={s.optionGroup}>
                <span style={s.optLabel}>AI 처리</span>
                <div style={s.toggleRow}>
                  <ToggleBtn active={useIcLight} onClick={() => setUseIcLight(v => !v)}>
                    {useIcLight ? '✓' : '○'} IC-Light 조명
                  </ToggleBtn>
                  <ToggleBtn active={useCodeFormer} onClick={() => setUseCodeFormer(v => !v)}>
                    {useCodeFormer ? '✓' : '○'} CodeFormer 선명화
                  </ToggleBtn>
                </div>
              </div>

              <div style={s.aiChips}>
                <span style={s.aiChip}>BiRefNet</span>
                {useIcLight && <span style={s.aiChip}>IC-Light</span>}
                <span style={s.aiChip}>cool→warm 보정</span>
                {useCodeFormer && <span style={s.aiChip}>CodeFormer</span>}
              </div>
            </div>

            <button style={s.btnPrimary} onClick={handleCouple} disabled={loading}>
              💑 커플 합성 실행
            </button>

            {/* 개별 처리 결과 미리보기 */}
            {(brideResult || groomResult) && (
              <div style={s.intermediateRow}>
                {brideResult && (
                  <div style={s.intermediateItem}>
                    <div style={s.intermediateLabel}>신부 배경 제거</div>
                    <img src={brideResult} style={s.intermediateImg} alt="bride processed" />
                  </div>
                )}
                {groomResult && (
                  <div style={s.intermediateItem}>
                    <div style={s.intermediateLabel}>신랑 배경 제거 + warm 보정</div>
                    <img src={groomResult} style={s.intermediateImg} alt="groom processed" />
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── 신부/신랑 단독 탭 ── */}
        {(tab === 'bride' || tab === 'groom') && (
          <>
            <div style={s.uploadRow}>
              <UploadBox
                label={tab === 'bride' ? '👰 신부 사진' : '🤵 신랑 사진'}
                preview={soloPreview}
                onFile={setFile(f => setSoloFile(f), p => setSoloPreview(p))}
                icon={tab === 'bride' ? '👰' : '🤵'}
              />
              <UploadBox label="🌿 배경 이미지" preview={soloBgPreview}
                onFile={setFile(f => setSoloBgFile(f), p => setSoloBgPreview(p))} icon="🌿" />
            </div>

            <div style={s.optionsPanel}>
              <div style={s.optionGroup}>
                <span style={s.optLabel}>그림자</span>
                <div style={s.toggleRow}>
                  {SHADOW_OPTS.map(o => (
                    <ToggleBtn key={o.value} active={shadow === o.value} onClick={() => setShadow(o.value as Shadow)}>
                      {o.label}
                    </ToggleBtn>
                  ))}
                </div>
              </div>
              <div style={s.optionGroup}>
                <span style={s.optLabel}>AI 처리</span>
                <div style={s.toggleRow}>
                  <ToggleBtn active={useIcLight} onClick={() => setUseIcLight(v => !v)}>
                    {useIcLight ? '✓' : '○'} IC-Light 조명
                  </ToggleBtn>
                  <ToggleBtn active={useCodeFormer} onClick={() => setUseCodeFormer(v => !v)}>
                    {useCodeFormer ? '✓' : '○'} CodeFormer 선명화
                  </ToggleBtn>
                </div>
              </div>
              {tab === 'groom' && (
                <div style={s.infoBox}>
                  🎨 신랑 사진은 <strong>cool → warm</strong> 색온도 자동 보정 + IC-Light로 조명 방향 right 보정이 적용됩니다.
                </div>
              )}
            </div>

            <button style={s.btnPrimary} onClick={() => handleSolo(tab as 'bride' | 'groom')} disabled={loading}>
              {tab === 'bride' ? '👰 신부 단독 합성' : '🤵 신랑 단독 합성'}
            </button>
          </>
        )}

        {/* ── 결과 ── */}
        {result && (
          <div style={s.resultSection}>
            <div style={s.resultTitle}>✅ 합성 완료</div>
            <img src={result} style={s.resultImg} alt="composite result" />
            <div style={s.resultActions}>
              <a href={result} download="composite_result.jpg" style={s.btnDownload}>
                ⬇ 고화질 다운로드
              </a>
              <button style={s.btnSecondary} onClick={() => { setResult(null); setSteps([]); setBrideResult(null); setGroomResult(null); }}>
                다시 합성
              </button>
            </div>
          </div>
        )}

        <StepLog steps={steps} />
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  root: { fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif", background: '#0e0f13', minHeight: '100vh', color: '#e8e4dc', position: 'relative' },
  header: { background: 'linear-gradient(135deg,#1a1520,#0e1520)', borderBottom: '1px solid #2a2535', padding: '18px 32px', display: 'flex', alignItems: 'center', gap: 20 },
  logo: { fontSize: 20, fontWeight: 700, letterSpacing: '0.12em', color: '#c9a96e' },
  headerSub: { fontSize: 12, color: '#7a7090', letterSpacing: '0.06em' },
  tabBar: { display: 'flex', borderBottom: '1px solid #1e1c28', padding: '0 32px' },
  tab: { padding: '14px 24px', background: 'none', border: 'none', borderBottom: '2px solid transparent', color: '#5a5870', fontSize: 14, cursor: 'pointer', fontWeight: 500, transition: 'all 0.2s' },
  tabActive: { color: '#c9a96e', borderBottomColor: '#c9a96e' },
  error: { margin: '16px 32px', padding: '12px 16px', background: '#2a1520', border: '1px solid #6a2535', borderRadius: 8, color: '#e07070', fontSize: 13 },
  body: { padding: '24px 32px', maxWidth: 1200, margin: '0 auto' },
  uploadRow: { display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 },
  uploadWrap: { flex: 1, minWidth: 240, display: 'flex', flexDirection: 'column', gap: 8 },
  uploadLabel: { fontSize: 12, color: '#7a7090', letterSpacing: '0.08em', textTransform: 'uppercase' },
  dropzone: { border: '1.5px dashed #2e2a40', borderRadius: 12, minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: 8, padding: 16, transition: 'border-color 0.2s', background: '#141620' },
  dropzoneFilled: { padding: 4 },
  dropIcon: { fontSize: 32 },
  dropText: { fontSize: 13, color: '#7a7090', fontWeight: 500 },
  previewImg: { width: '100%', objectFit: 'contain', borderRadius: 8, maxHeight: 220 },
  optionsPanel: { background: '#141620', border: '1px solid #22202e', borderRadius: 14, padding: 20, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 16 },
  optionGroup: { display: 'flex', flexDirection: 'column', gap: 8 },
  optLabel: { fontSize: 11, color: '#7a7090', letterSpacing: '0.1em', textTransform: 'uppercase' },
  toggleRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  toggleBtn: { padding: '8px 16px', borderRadius: 8, border: '1px solid #2e2a40', background: '#1c1a2a', color: '#7a7090', fontSize: 13, cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center' },
  toggleBtnActive: { background: '#2a2040', borderColor: '#c9a96e', color: '#c9a96e' },
  optDesc: { fontSize: 11, color: '#5a5870', marginTop: 2 },
  aiChips: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  aiChip: { padding: '4px 10px', borderRadius: 20, background: '#1e2a1e', border: '1px solid #3a5a3a', color: '#6ec68a', fontSize: 11, letterSpacing: '0.06em' },
  infoBox: { padding: '10px 14px', background: '#1c1a2a', border: '1px solid #3e3a50', borderRadius: 8, fontSize: 13, color: '#c9c5d8', lineHeight: 1.6 },
  btnPrimary: { width: '100%', padding: '14px', background: 'linear-gradient(135deg,#c9a96e,#a07840)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', marginBottom: 20, letterSpacing: '0.05em' },
  btnSecondary: { flex: 1, padding: '12px', background: '#1c1a2a', border: '1px solid #3e3a50', borderRadius: 8, color: '#9a95b0', fontSize: 14, cursor: 'pointer' },
  btnDownload: { flex: 1, padding: '12px', background: 'linear-gradient(135deg,#3a5a3a,#2a4a2a)', border: 'none', borderRadius: 8, color: '#6ec68a', fontSize: 14, fontWeight: 700, textDecoration: 'none', textAlign: 'center', display: 'block' },
  intermediateRow: { display: 'flex', gap: 16, marginBottom: 20 },
  intermediateItem: { flex: 1, background: '#141620', border: '1px solid #22202e', borderRadius: 10, padding: 12 },
  intermediateLabel: { fontSize: 11, color: '#7a7090', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' },
  intermediateImg: { width: '100%', borderRadius: 6, objectFit: 'contain', maxHeight: 160 },
  resultSection: { background: '#141620', border: '1px solid #3a5a3a', borderRadius: 16, padding: 24, marginBottom: 24 },
  resultTitle: { fontSize: 15, color: '#6ec68a', fontWeight: 700, marginBottom: 16 },
  resultImg: { width: '100%', borderRadius: 12, marginBottom: 16, objectFit: 'contain' },
  resultActions: { display: 'flex', gap: 12 },
  stepLog: { background: '#0c0a14', border: '1px solid #1e1c28', borderRadius: 10, padding: 16 },
  stepLogTitle: { fontSize: 12, color: '#c9a96e', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 },
  stepLine: { fontSize: 12, lineHeight: 1.8, fontFamily: 'monospace' },
  loadingOverlay: { position: 'fixed', inset: 0, background: 'rgba(14,15,19,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 999, gap: 16 },
  loadingSpinner: { width: 48, height: 48, border: '3px solid #2a2535', borderTop: '3px solid #c9a96e', borderRadius: '50%', animation: 'spin 1s linear infinite' },
  loadingMsg: { fontSize: 16, color: '#c9a96e', fontWeight: 600 },
  loadingSub: { fontSize: 13, color: '#7a7090' },
};
