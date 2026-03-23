import { useState } from "react";

const COLORS = {
  bg: "#0a0e1a",
  card: "#111827",
  cardHover: "#1a2235",
  border: "#1e293b",
  borderActive: "#3b82f6",
  text: "#e2e8f0",
  textMuted: "#94a3b8",
  textDim: "#64748b",
  accent: "#3b82f6",
  accentGlow: "rgba(59,130,246,0.15)",
  green: "#22c55e",
  greenBg: "rgba(34,197,94,0.1)",
  greenBorder: "rgba(34,197,94,0.3)",
  amber: "#f59e0b",
  amberBg: "rgba(245,158,11,0.1)",
  amberBorder: "rgba(245,158,11,0.3)",
  pink: "#ec4899",
  pinkBg: "rgba(236,72,153,0.1)",
  pinkBorder: "rgba(236,72,153,0.3)",
  purple: "#a78bfa",
  purpleBg: "rgba(167,139,250,0.1)",
  purpleBorder: "rgba(167,139,250,0.3)",
  red: "#ef4444",
  redBg: "rgba(239,68,68,0.1)",
  cyan: "#06b6d4",
  cyanBg: "rgba(6,182,212,0.08)",
  cyanBorder: "rgba(6,182,212,0.25)",
};

const subtypes = [
  { id: "hr_her2neg", label: "HR+/HER2−", shortLabel: "HR+", color: COLORS.green, bg: COLORS.greenBg, border: COLORS.greenBorder, pct: "約70%" },
  { id: "her2pos", label: "HER2+", shortLabel: "HER2+", color: COLORS.amber, bg: COLORS.amberBg, border: COLORS.amberBorder, pct: "約15-20%" },
  { id: "tnbc", label: "トリプルネガティブ", shortLabel: "TNBC", color: COLORS.pink, bg: COLORS.pinkBg, border: COLORS.pinkBorder, pct: "約10-15%" },
  { id: "her2low", label: "HER2低発現", shortLabel: "HER2-low", color: COLORS.purple, bg: COLORS.purpleBg, border: COLORS.purpleBorder, pct: "約50-60%*" },
];

const settings = [
  { id: "periop", label: "周術期（初期治療）" },
  { id: "metastatic", label: "転移・再発" },
];

// ── Treatment Data ──
const treatmentData = {
  hr_her2neg: {
    periop: {
      title: "HR+/HER2− 周術期治療",
      desc: "ホルモン受容体陽性・HER2陰性乳癌は全体の約70%を占める最多サブタイプ。内分泌療法が治療の柱。",
      flow: [
        {
          phase: "術前",
          steps: [
            { name: "手術先行が基本", detail: "多くの場合、手術を先行。腫瘍縮小目的で術前化学療法を行う場合もある", standard: true },
            { name: "術前化学療法", detail: "AC/EC → タキサン（腫瘍縮小・温存目的）", standard: true, optional: true },
            { name: "術前内分泌療法", detail: "閉経後・高齢者でAI 6ヶ月間（手術までのブリッジ）", standard: true, optional: true },
          ]
        },
        {
          phase: "手術",
          steps: [
            { name: "乳房温存術 or 全切除", detail: "腫瘍径・広がりに応じて選択。乳房再建も選択肢", standard: true },
            { name: "センチネルリンパ節生検 ± 郭清", detail: "cN0→SLN生検、cN+→腋窩郭清", standard: true },
          ]
        },
        {
          phase: "術後補助療法",
          steps: [
            { name: "放射線療法", detail: "温存術後は必須。全切除後もリスクに応じて", standard: true },
            { name: "内分泌療法 5-10年", detail: "閉経前：TAM±LHRHa / 閉経後：AI（レトロゾール/アナストロゾール）", standard: true },
            { name: "化学療法（リスクに応じて）", detail: "AC/EC→タキサン。OncotypeDX等で化学療法省略を検討", standard: true, optional: true },
            { name: "＋アベマシクリブ 2年", detail: "再発高リスク（LN4+, or LN1-3+腫瘍径5cm+/G3）: monarchE", standard: true, highlight: true },
            { name: "＋S-1 1年", detail: "再発高リスク（POTENT基準）: 内分泌療法と併用", standard: true, highlight: true },
            { name: "＋オラパリブ 1年", detail: "BRCA変異陽性＋再発高リスク: OlympiA", standard: true, highlight: true },
          ]
        },
      ],
      pipeline: [
        { drug: "イナボリシブ", trial: "INAVO120", note: "PIK3CA変異＋NAC後non-pCR→術後治療への適応拡大検討中", phase: "Ph III ✓", color: COLORS.green },
        { drug: "カミゼストラント", trial: "SERENA-6", note: "CDK4/6i後の内分泌療法スイッチ（術後設定への展開可能性）", phase: "Ph III ✓", color: COLORS.amber },
        { drug: "リボシクリブ", trial: "NATALEE", note: "術後CDK4/6i（FDA承認済）。日本未申請→ドラッグラグ", phase: "承認済(海外)", color: COLORS.amber },
      ]
    },
    metastatic: {
      title: "HR+/HER2− 転移・再発治療",
      desc: "Visceral crisisがなければ内分泌療法ベースで逐次治療。バイオマーカーに応じた分子標的薬併用が重要。",
      flow: [
        {
          phase: "1次治療",
          steps: [
            { name: "CDK4/6i ＋ AI（±LHRHa）", detail: "パルボシクリブ/アベマシクリブ ＋ レトロゾール等。PALOMA-2/MONARCH-3/MONALEESA", standard: true },
            { name: "AI単独（±LHRHa）", detail: "CDK4/6i併用が困難な場合", standard: true, optional: true },
          ]
        },
        {
          phase: "2次治療",
          steps: [
            { name: "イムルネストラント", detail: "経口SERD。ESR1変異例に有効。EMBER-3（2025年日本承認）", standard: true, highlight: true },
            { name: "フルベストラント ± CDK4/6i", detail: "1次AI耐性後。アベマシクリブ併用（MONARCH-2）", standard: true },
            { name: "エベロリムス ＋ AI", detail: "mTOR阻害。BOLERO-2", standard: true },
            { name: "＋カピバセルチブ（AKT経路変異時）", detail: "PIK3CA/AKT1/PTEN変異: CAPItello-291", standard: true, highlight: true },
            { name: "＋イナボリシブ（PIK3CA変異時）", detail: "PIK3CA変異: INAVO120（FDA承認済、日本開発中）", standard: false, highlight: true },
          ]
        },
        {
          phase: "3次治療以降",
          steps: [
            { name: "T-DXd エンハーツ（HER2-low時）", detail: "HER2-low（IHC1+/2+ ISH-）: DESTINY-Breast04", standard: true, highlight: true },
            { name: "Sac-Gov トロデルビ", detail: "TROP2-ADC。2次以降の化学療法として", standard: true },
            { name: "化学療法（逐次単剤）", detail: "エリブリン/カペシタビン/ビノレルビン等", standard: true },
            { name: "オラパリブ/タラゾパリブ", detail: "BRCA変異陽性例: OlympiAD/EMBRACA", standard: true },
          ]
        },
      ],
      pipeline: [
        { drug: "カミゼストラント", trial: "SERENA-4/6", note: "次世代SERD。1L/2Lで試験進行中。FDA申請中", phase: "Ph III", color: COLORS.amber },
        { drug: "ベプデゲストラント", trial: "VERITAC-2", note: "PROTAC ER分解薬。新規MOA。FDA申請中", phase: "Ph III ✓", color: COLORS.amber },
        { drug: "ギレデストラント", trial: "evERA/lidERA", note: "経口SERD。persevERA主要EP未達も他適応で申請継続", phase: "申請中", color: COLORS.amber },
        { drug: "ゲダトリシブ", trial: "VIKTORIA-1", note: "PI3K/mTOR二重阻害。FDA申請中", phase: "Ph III ✓", color: COLORS.green },
        { drug: "Dato-DXd", trial: "TB-02/04", note: "TROP2-ADC。HR+2L以降。TNBC FDA承認判断Q2", phase: "Ph III", color: COLORS.amber },
        { drug: "アチルモシクリブ", trial: "FOURLIGHT-3", note: "次世代CDK4i。CDK4/6i後の2Lで有意なPFS改善", phase: "Ph II→III", color: COLORS.cyan },
        { drug: "プリフェトラスタット", trial: "KATSIS-1", note: "KAT6阻害薬。新規標的", phase: "Ph III", color: COLORS.cyan },
      ]
    }
  },
  her2pos: {
    periop: {
      title: "HER2+ 周術期治療",
      desc: "抗HER2療法の導入で予後が劇的に改善。術前化学療法＋抗HER2療法→手術→術後抗HER2療法の流れが標準。",
      flow: [
        {
          phase: "術前化学療法＋抗HER2",
          steps: [
            { name: "AC/EC → DTX+HP", detail: "アンスラサイクリン→ドセタキセル+トラスツズマブ+ペルツズマブ", standard: true },
            { name: "TCbHP（non-AC）", detail: "ドセタキセル+カルボプラチン+HP（心毒性リスク回避）", standard: true, optional: true },
            { name: "wPTX+HP", detail: "パクリタキセル毎週＋HP", standard: true, optional: true },
          ]
        },
        {
          phase: "手術",
          steps: [
            { name: "乳房温存術 or 全切除", detail: "NAC後の腫瘍縮小効果を評価して術式決定", standard: true },
          ]
        },
        {
          phase: "術後補助療法（pCR達成時）",
          steps: [
            { name: "HP継続（計1年）", detail: "トラスツズマブ±ペルツズマブ。フェスゴ（皮下注）も選択肢", standard: true },
            { name: "放射線療法", detail: "温存術後/リスクに応じて", standard: true },
          ]
        },
        {
          phase: "術後補助療法（non-pCR時）",
          steps: [
            { name: "T-DM1 カドサイラ 14サイクル", detail: "KATHERINE試験: iDFS HR 0.50。残存病変ありの場合の標準", standard: true, highlight: true },
            { name: "放射線療法", detail: "温存術後/リスクに応じて", standard: true },
          ]
        },
      ],
      pipeline: [
        { drug: "T-DXd", trial: "DESTINY-Breast05", note: "non-pCR例でT-DM1 vs T-DXd。結果発表待ち（2026 Q3?）", phase: "Ph III ⏳", color: COLORS.amber },
        { drug: "T-DXd", trial: "DESTINY-Breast11", note: "NAC設定でHP+chemo vs T-DXd+HP", phase: "Ph III ⏳", color: COLORS.cyan },
      ]
    },
    metastatic: {
      title: "HER2+ 転移・再発治療",
      desc: "抗HER2療法の進歩により予後が大幅に改善（OS中央値58ヶ月）。治療ラインごとに薬剤を逐次使用。",
      flow: [
        {
          phase: "1次治療",
          steps: [
            { name: "HP＋ドセタキセル（CLEOPATRA）", detail: "トラスツズマブ+ペルツズマブ+DTX。PFS 18.7m, OS 57.1m", standard: true },
            { name: "HP＋パクリタキセル", detail: "DTX不耐時の代替。弱い推奨", standard: true, optional: true },
          ]
        },
        {
          phase: "2次治療",
          steps: [
            { name: "T-DXd エンハーツ", detail: "DESTINY-Breast03: PFS HR 0.33 vs T-DM1。圧倒的優越性", standard: true, highlight: true },
          ]
        },
        {
          phase: "3次治療以降",
          steps: [
            { name: "T-DM1 カドサイラ", detail: "T-DXdを2Lで使用済みの場合の3L選択肢", standard: true },
            { name: "ツカチニブ＋Tmab＋Cape", detail: "HER2CLIMB: 脳転移にも有効。2026年2月日本承認", standard: true, highlight: true },
            { name: "ラパチニブ＋カペシタビン", detail: "HER2 TKI併用。古典的レジメン", standard: true },
            { name: "HP再投与＋化学療法", detail: "PRECIOUS: PFS HR 0.76。ペルツズマブ再投与", standard: true, optional: true },
            { name: "Tmab＋化学療法（逐次）", detail: "エリブリン/ビノレルビン/ゲムシタビン等＋Tmab継続", standard: true },
          ]
        },
      ],
      pipeline: [
        { drug: "DB-1303 (BNT323)", trial: "Phase I/II", note: "次世代HER2-ADC。DXd linker改良。BioNTech/第一三共", phase: "Ph I-II", color: COLORS.cyan },
        { drug: "T-DXd", trial: "DB-09/12", note: "1L設定でHP+chemo vs T-DXd。ゲームチェンジャー候補", phase: "Ph III ⏳", color: COLORS.amber },
        { drug: "ツカチニブ", trial: "HER2CLIMB-02", note: "+T-DM1併用。2L設定。Ph III結果発表済み", phase: "Ph III ✓", color: COLORS.green },
      ]
    }
  },
  tnbc: {
    periop: {
      title: "TNBC 周術期治療",
      desc: "化学療法感受性が高い一方で再発リスクも高い。免疫チェックポイント阻害薬の周術期導入が標準に。",
      flow: [
        {
          phase: "術前化学療法",
          steps: [
            { name: "ペムブロリズマブ＋化学療法", detail: "KEYNOTE-522: AC/EC→PTX+CBDCA+Pembro。pCR率64.8% vs 51.2%", standard: true, highlight: true },
            { name: "AC/EC → タキサン（±CBDCA）", detail: "Pembro非使用の場合の標準NAC", standard: true },
          ]
        },
        {
          phase: "手術",
          steps: [
            { name: "乳房温存術 or 全切除", detail: "NAC奏効に応じて術式決定", standard: true },
          ]
        },
        {
          phase: "術後補助療法（pCR達成時）",
          steps: [
            { name: "ペムブロリズマブ継続（計1年）", detail: "KEYNOTE-522プロトコル。術後9サイクル", standard: true, highlight: true },
            { name: "放射線療法", detail: "リスクに応じて", standard: true },
          ]
        },
        {
          phase: "術後補助療法（non-pCR時）",
          steps: [
            { name: "カペシタビン 6-8サイクル", detail: "CREATE-X: OS HR 0.59。残存病変ありの標準", standard: true, highlight: true },
            { name: "＋オラパリブ 1年（BRCA変異時）", detail: "OlympiA: iDFS HR 0.58。BRCA陽性+高リスク", standard: true, highlight: true },
            { name: "ペムブロリズマブ継続", detail: "non-pCRでも術後Pembro継続＋Cape併用を検討", standard: true },
          ]
        },
      ],
      pipeline: [
        { drug: "Dato-DXd", trial: "TROPION-Breast04", note: "周術期TNBC設定。non-pCR例への適用検討", phase: "Ph III ⏳", color: COLORS.cyan },
        { drug: "Sac-TMT", trial: "OptiTROP-Breast03", note: "次世代TROP2-ADC。周術期設定", phase: "Ph III ⏳", color: COLORS.cyan },
      ]
    },
    metastatic: {
      title: "TNBC 転移・再発治療",
      desc: "予後不良（OS中央値14.2ヶ月）だが、免疫療法・ADC・PARP阻害薬など治療選択肢が急速に拡大。",
      flow: [
        {
          phase: "1次治療",
          steps: [
            { name: "ペムブロリズマブ＋化学療法（PD-L1+）", detail: "KEYNOTE-355: CPS≥10でPFS/OS改善。nab-PTX/PTX/GEM+CBDCA併用", standard: true, highlight: true },
            { name: "化学療法（PD-L1−）", detail: "アンスラサイクリン/タキサン未使用→AC/EC→タキサン等", standard: true },
          ]
        },
        {
          phase: "2次治療以降",
          steps: [
            { name: "Sac-Gov トロデルビ", detail: "TROP2-ADC。ASCENT: PFS 5.6m vs 1.7m (HR 0.41)", standard: true, highlight: true },
            { name: "オラパリブ/タラゾパリブ（BRCA変異時）", detail: "OlympiAD/EMBRACA: BRCA陽性例", standard: true },
            { name: "T-DXd エンハーツ（HER2-low時）", detail: "HER2低発現の場合: DESTINY-Breast04", standard: true, highlight: true },
            { name: "化学療法（逐次単剤）", detail: "エリブリン/カペシタビン/ビノレルビン/ゲムシタビン等", standard: true },
          ]
        },
      ],
      pipeline: [
        { drug: "Dato-DXd", trial: "TB-02 (TROPION-B02)", note: "TNBC 1L設定。FDA承認判断2026 Q2", phase: "Ph III ✓", color: COLORS.green },
        { drug: "Sac-TMT", trial: "OptiTROP-Breast01/02", note: "次世代TROP2-ADC。Sac-Govとのhead-to-head含む", phase: "Ph III ✓", color: COLORS.green },
        { drug: "プミタミグ", trial: "ROSETTA-BREAST-01", note: "PD-L1×VEGF-A二重特異性抗体。BioNTech/BMS", phase: "Ph III ⏳", color: COLORS.cyan },
        { drug: "Sac-Gov", trial: "ASCENT-03/04", note: "1L設定への前倒し。Pembro併用", phase: "Ph III ✓", color: COLORS.amber },
      ]
    }
  },
  her2low: {
    periop: {
      title: "HER2低発現 周術期治療",
      desc: "HER2-lowは従来のサブタイプ分類に横断的なカテゴリー。周術期はHR状態に準じた治療を行い、HER2-low特有の標準治療はまだ確立していない。",
      flow: [
        {
          phase: "現在の治療方針",
          steps: [
            { name: "HR+の場合 → HR+/HER2−に準じる", detail: "内分泌療法ベース＋リスクに応じた化学療法・分子標的薬", standard: true },
            { name: "HR−の場合 → TNBCに準じる", detail: "化学療法＋ペムブロリズマブ（PD-L1状態に応じて）", standard: true },
          ]
        },
        {
          phase: "将来の変化",
          steps: [
            { name: "T-DXd術後設定の可能性", detail: "DESTINY-Breast05等の結果次第で周術期にもHER2-low区別が重要に", standard: false },
          ]
        },
      ],
      pipeline: [
        { drug: "T-DXd", trial: "DB-05/11", note: "HER2-low周術期設定。結果次第でパラダイムシフト", phase: "Ph III ⏳", color: COLORS.amber },
        { drug: "DB-1303", trial: "Phase I/II", note: "次世代HER2-ADC。HER2-low/ultralowへの有効性検証", phase: "Ph I-II", color: COLORS.cyan },
      ]
    },
    metastatic: {
      title: "HER2低発現 転移・再発治療",
      desc: "DESTINY-Breast04の結果により、HER2-lowが治療選択に直結する新カテゴリーとして確立。T-DXdが標準治療に。",
      flow: [
        {
          phase: "バイオマーカー確認",
          steps: [
            { name: "HER2 IHC再検査", detail: "IHC 1+ or IHC 2+/ISH− → HER2-low。治療歴のある転移・再発で確認必須", standard: true, highlight: true },
          ]
        },
        {
          phase: "化学療法歴のある転移・再発",
          steps: [
            { name: "T-DXd エンハーツ", detail: "DESTINY-Breast04: PFS 9.9m vs 5.1m (HR 0.50), OS 23.4m vs 16.8m (HR 0.64)", standard: true, highlight: true },
          ]
        },
        {
          phase: "その他の治療",
          steps: [
            { name: "HR+の場合：HR+/HER2−アルゴリズムに準じる", detail: "内分泌療法ベース→T-DXdを含むシークエンス", standard: true },
            { name: "HR−の場合：TNBCアルゴリズムに準じる", detail: "免疫療法・ADC・化学療法", standard: true },
          ]
        },
      ],
      pipeline: [
        { drug: "T-DXd", trial: "DB-06", note: "HER2-low 1L設定（内分泌耐性後）。Ph III結果positive", phase: "Ph III ✓", color: COLORS.green },
        { drug: "DB-1303", trial: "Phase I/II", note: "次世代ADC。HER2-ultralow (IHC 0 weak)にも有効の可能性", phase: "Ph I-II", color: COLORS.cyan },
        { drug: "Dato-DXd", trial: "TB-04", note: "TROP2-ADC。HER2-low/HR+設定", phase: "Ph III ⏳", color: COLORS.cyan },
      ]
    }
  }
};

// ── Components ──

function PhaseBadge({ phase, color }) {
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: "4px",
      fontSize: "11px",
      fontWeight: 600,
      fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
      color: color || COLORS.textMuted,
      background: `${color || COLORS.textMuted}18`,
      border: `1px solid ${color || COLORS.textMuted}40`,
      letterSpacing: "0.02em",
    }}>{phase}</span>
  );
}

function StepCard({ step, subtypeColor }) {
  const [expanded, setExpanded] = useState(false);
  const borderColor = step.highlight ? subtypeColor : COLORS.border;
  const bgColor = step.highlight ? `${subtypeColor}08` : "transparent";

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        padding: "10px 14px",
        borderLeft: `3px solid ${borderColor}`,
        background: bgColor,
        borderRadius: "0 6px 6px 0",
        cursor: "pointer",
        transition: "all 0.2s",
        marginBottom: "6px",
        position: "relative",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = `${subtypeColor}12`; }}
      onMouseLeave={e => { e.currentTarget.style.background = bgColor; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        {step.standard ? (
          <span style={{ color: COLORS.green, fontSize: "11px", fontWeight: 700, letterSpacing: "0.05em" }}>標準</span>
        ) : (
          <span style={{ color: COLORS.cyan, fontSize: "11px", fontWeight: 700, letterSpacing: "0.05em" }}>開発中</span>
        )}
        {step.optional && <span style={{ color: COLORS.textDim, fontSize: "10px" }}>（選択的）</span>}
        {step.highlight && <span style={{ fontSize: "10px", color: subtypeColor }}>★</span>}
        <span style={{ color: COLORS.text, fontSize: "13px", fontWeight: 600, lineHeight: 1.4 }}>{step.name}</span>
        <span style={{ color: COLORS.textDim, fontSize: "11px", marginLeft: "auto", flexShrink: 0 }}>{expanded ? "▲" : "▼"}</span>
      </div>
      {expanded && (
        <div style={{
          marginTop: "8px",
          padding: "8px 10px",
          background: `${COLORS.bg}80`,
          borderRadius: "4px",
          color: COLORS.textMuted,
          fontSize: "12px",
          lineHeight: 1.6,
        }}>
          {step.detail}
        </div>
      )}
    </div>
  );
}

function PhaseBlock({ phase, steps, subtypeColor, index }) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
        <div style={{
          width: "28px", height: "28px",
          borderRadius: "50%",
          background: `${subtypeColor}20`,
          border: `2px solid ${subtypeColor}60`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "12px", fontWeight: 700, color: subtypeColor,
          fontFamily: "'JetBrains Mono', monospace",
          flexShrink: 0,
        }}>{index + 1}</div>
        <span style={{
          fontSize: "14px", fontWeight: 700, color: COLORS.text,
          letterSpacing: "0.03em",
        }}>{phase}</span>
      </div>
      <div style={{ marginLeft: "14px", borderLeft: `1px dashed ${COLORS.border}`, paddingLeft: "20px" }}>
        {steps.map((s, i) => <StepCard key={i} step={s} subtypeColor={subtypeColor} />)}
      </div>
    </div>
  );
}

function PipelineSection({ drugs, subtypeColor }) {
  if (!drugs || drugs.length === 0) return null;
  return (
    <div style={{
      marginTop: "24px",
      padding: "16px",
      background: COLORS.cyanBg,
      border: `1px solid ${COLORS.cyanBorder}`,
      borderRadius: "8px",
    }}>
      <div style={{
        fontSize: "13px", fontWeight: 700, color: COLORS.cyan,
        marginBottom: "12px", letterSpacing: "0.05em",
        display: "flex", alignItems: "center", gap: "6px",
      }}>
        <span style={{ fontSize: "14px" }}>🔬</span>
        ここに新薬が入る可能性（開発中パイプライン）
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {drugs.map((d, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "flex-start", gap: "10px",
            padding: "8px 10px",
            background: `${COLORS.bg}60`,
            borderRadius: "6px",
            flexWrap: "wrap",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
              <PhaseBadge phase={d.phase} color={d.color} />
              <span style={{ fontSize: "13px", fontWeight: 700, color: COLORS.text }}>{d.drug}</span>
            </div>
            <span style={{ fontSize: "11px", color: COLORS.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>{d.trial}</span>
            <span style={{ fontSize: "11px", color: COLORS.textDim, lineHeight: 1.5 }}>{d.note}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ──
export default function TreatmentAlgorithm() {
  const [activeSubtype, setActiveSubtype] = useState("hr_her2neg");
  const [activeSetting, setActiveSetting] = useState("periop");

  const st = subtypes.find(s => s.id === activeSubtype);
  const data = treatmentData[activeSubtype]?.[activeSetting];

  return (
    <div style={{
      fontFamily: "'Noto Sans JP', 'Hiragino Sans', -apple-system, sans-serif",
      background: COLORS.bg,
      color: COLORS.text,
      minHeight: "100vh",
      padding: "0",
    }}>
      {/* Header */}
      <div style={{
        padding: "24px 20px 16px",
        borderBottom: `1px solid ${COLORS.border}`,
        background: "linear-gradient(180deg, #111827 0%, #0a0e1a 100%)",
      }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span style={{ fontSize: "11px", color: COLORS.textDim, letterSpacing: "0.1em", textTransform: "uppercase" }}>乳がん新書 2026</span>
            <span style={{ fontSize: "11px", color: COLORS.textDim }}>›</span>
            <span style={{ fontSize: "11px", color: COLORS.accent, letterSpacing: "0.1em" }}>日本の標準治療</span>
          </div>
          <h1 style={{
            fontSize: "22px", fontWeight: 800, margin: "8px 0 4px",
            color: COLORS.text, letterSpacing: "-0.01em", lineHeight: 1.3,
          }}>
            サブタイプ別 治療アルゴリズム
          </h1>
          <p style={{ fontSize: "12px", color: COLORS.textDim, margin: 0, lineHeight: 1.5 }}>
            乳癌診療ガイドライン2022年版（2024年Web改訂）準拠 ＋ 2025-2026承認薬反映 ＋ 開発中パイプライン
          </p>
        </div>
      </div>

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "16px 20px 40px" }}>
        {/* Subtype Selector */}
        <div style={{ marginBottom: "12px" }}>
          <div style={{ fontSize: "11px", color: COLORS.textDim, marginBottom: "8px", letterSpacing: "0.05em" }}>サブタイプ選択</div>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {subtypes.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSubtype(s.id)}
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: `1.5px solid ${activeSubtype === s.id ? s.color : COLORS.border}`,
                  background: activeSubtype === s.id ? s.bg : "transparent",
                  color: activeSubtype === s.id ? s.color : COLORS.textMuted,
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: activeSubtype === s.id ? 700 : 500,
                  transition: "all 0.2s",
                  fontFamily: "inherit",
                  display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "2px",
                }}
              >
                <span>{s.label}</span>
                <span style={{ fontSize: "10px", opacity: 0.7 }}>{s.pct}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Setting Selector */}
        <div style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", gap: "4px", background: COLORS.card, borderRadius: "8px", padding: "3px", width: "fit-content" }}>
            {settings.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSetting(s.id)}
                style={{
                  padding: "7px 16px",
                  borderRadius: "6px",
                  border: "none",
                  background: activeSetting === s.id ? st.bg : "transparent",
                  color: activeSetting === s.id ? st.color : COLORS.textDim,
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: activeSetting === s.id ? 700 : 500,
                  transition: "all 0.15s",
                  fontFamily: "inherit",
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* HER2-low note */}
        {activeSubtype === "her2low" && (
          <div style={{
            padding: "12px 16px",
            background: COLORS.purpleBg,
            border: `1px solid ${COLORS.purpleBorder}`,
            borderRadius: "8px",
            marginBottom: "16px",
            fontSize: "12px",
            color: COLORS.purple,
            lineHeight: 1.6,
          }}>
            <strong>※ HER2低発現（HER2-low）</strong>はHR+/HER2−やTNBCに横断的に存在するカテゴリーです（全乳癌の約50-60%）。IHC 1+ または IHC 2+/ISH− で定義されます。従来のサブタイプ分類とは別軸の概念であり、T-DXdの有効性が示されたことで治療選択に重要な意味を持つようになりました。
          </div>
        )}

        {/* Content */}
        {data && (
          <div>
            <div style={{
              padding: "16px",
              background: st.bg,
              border: `1px solid ${st.border}`,
              borderRadius: "8px",
              marginBottom: "20px",
            }}>
              <h2 style={{ fontSize: "16px", fontWeight: 800, color: st.color, margin: "0 0 6px", lineHeight: 1.3 }}>
                {data.title}
              </h2>
              <p style={{ fontSize: "12px", color: COLORS.textMuted, margin: 0, lineHeight: 1.6 }}>
                {data.desc}
              </p>
            </div>

            {/* Algorithm Flow */}
            {data.flow.map((block, i) => (
              <PhaseBlock
                key={i}
                phase={block.phase}
                steps={block.steps}
                subtypeColor={st.color}
                index={i}
              />
            ))}

            {/* Pipeline */}
            <PipelineSection drugs={data.pipeline} subtypeColor={st.color} />

            {/* Legend */}
            <div style={{
              marginTop: "24px",
              padding: "12px 16px",
              background: COLORS.card,
              borderRadius: "8px",
              display: "flex",
              flexWrap: "wrap",
              gap: "16px",
              fontSize: "11px",
              color: COLORS.textDim,
            }}>
              <span><span style={{ color: COLORS.green }}>■ 標準</span> = ガイドライン推奨</span>
              <span><span style={{ color: COLORS.cyan }}>■ 開発中</span> = 未承認（日本）</span>
              <span><span style={{ color: st.color }}>★</span> = 近年の重要な変化</span>
              <span>▼ クリックで詳細表示</span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{
          marginTop: "32px",
          paddingTop: "16px",
          borderTop: `1px solid ${COLORS.border}`,
          fontSize: "10px",
          color: COLORS.textDim,
          lineHeight: 1.7,
        }}>
          <p style={{ margin: "0 0 4px" }}>
            出典: 乳癌診療ガイドライン2022年版（2024年3月Web改訂）、NCCN Guidelines Breast Cancer v1.2026、各薬剤添付文書、ASCO/ESMO/SABCS 2025-2026
          </p>
          <p style={{ margin: 0 }}>
            本アルゴリズムは教育・情報提供目的です。治療方針決定には必ず担当医にご相談ください。2026年3月時点の公開情報に基づきます。
          </p>
        </div>
      </div>
    </div>
  );
}
