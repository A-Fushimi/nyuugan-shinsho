/**
 * 乳がん新書 — Jev（TypeSafe AI System One）判定ラッパ
 *
 * 1 アイテム = 1 リクエスト。質問は同じ state に対して並列・独立に評価される。
 * 質問名（キー）はモデルに渡らないので、意味は instructions と criteria に全て書く。
 *
 * 設計書 docs/jev-triage-plan.md §2 / §6 に対応する。
 */

import { TypeSafeClient, noul, score, choice } from '@typesafe-ai/sdk';

/** 100万入力トークンあたりの単価（USD）。レポートの概算コスト計算に使う */
export const COST_PER_MILLION_INPUT_TOKENS = 0.042;

/** state に載せる本文の最大長 */
export const MAX_BODY_CHARS = 2000;

/** landscape_to_json.py の MOA_KEYWORDS のキー + other / none */
export const MOA_CATEGORIES = {
  ADC: '抗体薬物複合体（deruxtecan/vedotin/emtansine などのペイロードを持つもの）',
  bispecific: '二重特異性抗体・biparatopic・dual targeting',
  PROTAC_degrader: 'PROTAC・分子接着剤などの標的タンパク質分解誘導薬',
  oral_SERD_next: '経口 SERD・次世代エストロゲン受容体分解/拮抗薬',
  CDK_next: 'CDK2/CDK4 選択的阻害薬など次世代 CDK 阻害薬',
  epigenetic: 'エピジェネティクス標的薬（HDAC・EZH2・BET など）',
  IO_next: '次世代免疫療法（新規免疫チェックポイント・サイトカイン・ワクチンなど）',
  cell_therapy: 'CAR-T・TIL・NK 細胞などの細胞療法',
  RDC: '放射性核種標識薬（radioligand/radioconjugate）',
  small_mol_other: '上記以外の低分子標的薬（PI3K/AKT・PARP・チロシンキナーゼ阻害薬など）',
  Ab_other: '上記以外の抗体医薬（裸抗体など）',
  other: '新薬候補だがいずれのカテゴリにも当てはまらない',
  none: '新薬候補が含まれない（既存化学療法・支持療法・機器・検査のみ）',
};

/** ソース名 → state に書く説明 */
export const SOURCE_LABELS = {
  gnews: 'Google ニュース（日本語、乳がん関連の検索結果）',
  oncolo: 'oncolo.jp（日本のがん情報ニュースサイト）',
  kegg: 'KEGG 新薬承認リスト（日本の承認医薬品）',
  openfda: 'openFDA drugsfda（米国 FDA の承認・一部変更承認レコード）',
  ctgov: 'ClinicalTrials.gov の新規登録試験',
};

/** 質問 relevant / category / impact / subtype / setting は全ソース共通 */
export const BASE_QUESTIONS = {
  relevant: noul(
    'この情報は乳がんの薬物療法（新薬、適応拡大、臨床試験結果、承認・申請）に直接関係するか。',
    {
      true: '乳がん患者に対する薬剤治療に関する具体的な情報である',
      false:
        '乳がん以外のがん種のみの話、検診・手術・放射線のみの話、支持療法・副作用ケアのみ、一般啓発記事、企業の財務・人事ニュース',
    }
  ),
  category: choice('この情報の種類はどれか。', {
    approval_jp: '日本での承認、薬価収載、発売、適応追加',
    approval_us: '米国 FDA の承認、迅速承認、適応追加',
    approval_eu: '欧州 EMA / CHMP の承認、肯定的意見',
    filing: '承認申請、申請受理、優先審査指定、審査中',
    trial_result: '臨床試験の結果（主要評価項目の達成・未達、学会発表、論文化）',
    trial_start: '新規臨床試験の登録・開始、患者登録開始',
    guideline: '診療ガイドラインの改訂・推奨の変更',
    safety: '添付文書改訂、安全性情報、回収、警告の追加',
    other: '上記のいずれにも当てはまらない',
  }),
  impact: score('日本の乳がん診療および患者に与える影響度はどれくらいか。', [
    '影響なし。情報としての価値もない',
    '参考情報。早期臨床試験の登録や、まだ実臨床に結びつかない基礎的な内容',
    '注目に値する。第III相試験の結果、海外での承認、日本での承認申請など',
    '実臨床を変える。日本での承認、標準治療を変える試験結果、ガイドライン改訂',
  ]),
  subtype: choice('主な対象となる乳がんのサブタイプはどれか。', {
    hr_pos: 'ホルモン受容体陽性 / HER2 陰性',
    her2_pos: 'HER2 陽性',
    tnbc: 'トリプルネガティブ',
    her2_low: 'HER2 低発現（HER2-low / HER2-ultralow）',
    multiple: '複数のサブタイプにまたがる',
    unspecified: 'サブタイプが特定されていない、または記載がない',
  }),
  setting: choice('治療セッティングはどれか。', {
    early: '術前・術後（周術期）の早期乳がん',
    metastatic: '転移・再発乳がん（進行乳がん）',
    both: '早期と転移・再発の双方を含む',
    unspecified: '記載がない、または特定できない',
  }),
};

/** ctgov のみで聞く質問 */
export const CTGOV_QUESTIONS = {
  novel_agent: noul(
    'この臨床試験の介入に、新規の分子標的薬・抗体薬物複合体・免疫療法などの「新薬候補」が含まれるか。',
    {
      true: '開発コード付きの治験薬、または新しい作用機序を持つ薬剤が介入に含まれる',
      false:
        '既存の化学療法・ホルモン療法のみ、後発品やバイオシミラー、支持療法、運動・食事などの非薬物介入、医療機器、診断・検査のみ',
    }
  ),
  moa: choice('その新薬候補の作用機序カテゴリはどれか。', MOA_CATEGORIES),
};

/**
 * Jev に渡す state（JSON）を組み立てる。
 * @param {object} item TriageItem
 */
export function buildState(item) {
  const body = String(item?.body || '').slice(0, MAX_BODY_CHARS);
  const state = {
    source: SOURCE_LABELS[item?.source] || item?.source || 'unknown',
    title: item?.title || '',
    body,
    date: item?.date || '',
    known_drugs_in_site: Array.isArray(item?.knownDrugs) ? item.knownDrugs : [],
  };
  if (item?.meta && Object.keys(item.meta).length > 0) state.meta = item.meta;
  return state;
}

/**
 * アイテムに応じた質問セットを返す。
 * @param {object} item TriageItem
 */
export function buildQuestions(item) {
  return item?.source === 'ctgov'
    ? { ...BASE_QUESTIONS, ...CTGOV_QUESTIONS }
    : { ...BASE_QUESTIONS };
}

/**
 * TypeSafeClient を生成する。API キーが無ければ null を返す（呼び出し側で警告）。
 * @param {{apiKey?:string, fetch?:Function, model?:string, timeout?:number, retry?:object}} [opts]
 */
export function createJevClient(opts = {}) {
  const apiKey = opts.apiKey ?? process.env.TYPESAFE_API_KEY;
  if (!apiKey) return null;
  const config = { apiKey };
  if (opts.fetch) config.fetch = opts.fetch;
  if (opts.model) config.defaultModel = opts.model;
  if (opts.timeout) config.timeout = opts.timeout;
  if (opts.retry) config.retry = opts.retry;
  return new TypeSafeClient(config);
}

/**
 * 1件を判定する。例外はそのまま投げる（呼び出し側で review 扱いにする）。
 * @param {import('@typesafe-ai/sdk').TypeSafeClient} client
 * @param {object} item TriageItem
 * @returns {Promise<{model:string, answers:object, usage:object}>}
 */
export async function judgeItem(client, item) {
  const { model, answers, usage } = await client.systemOne({
    state: buildState(item),
    questions: buildQuestions(item),
  });
  return { model, answers, usage };
}

export default { buildState, buildQuestions, createJevClient, judgeItem };
