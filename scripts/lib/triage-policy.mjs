/**
 * 乳がん新書 — トリアージ方針（純粋関数）
 *
 * Jev の生の答え（answers）を、採用 / 要確認 / 破棄の決定に変換する。
 * 判定（Jev）と方針（しきい値）を分離しているので、
 * しきい値を変えても data/triage/<date>.json の answers から再計算でき、再推論は不要。
 *
 * 設計書 docs/jev-triage-plan.md §7 のルール 1〜9 に対応する。
 */

/** しきい値は全てここに集約する（テストで境界値を検証） */
export const THRESHOLDS = {
  /** relevant.noul がこれ未満なら破棄 */
  relevantLow: 0.35,
  /** relevant.noul がこれ以上なら「関連あり」と確定 */
  relevantHigh: 0.65,
  /** impact.score がこれ以上なら採用 */
  impactAccept: 1.8,
  /** impact.score がこれ以上なら要確認（未満は破棄） */
  impactReview: 1.0,
  /** category.confidence がこれ未満の accept は要確認に格下げ */
  categoryConfidence: 0.5,
  /** ctgov: novel_agent.noul がこれ未満なら破棄 */
  novelLow: 0.35,
  /** ctgov: novel_agent.noul がこれ以上なら新薬候補と確定 */
  novelHigh: 0.65,
};

const fmt = (n) => (typeof n === 'number' ? n.toFixed(2) : '—');

/**
 * 1件の判定結果から決定を求める。
 *
 * @param {object} item TriageItem（source を参照する）
 * @param {object} answers Jev の answers（relevant/category/impact/subtype/setting[/novel_agent/moa]）
 * @returns {{decision:'accept'|'review'|'discard', priority:number, reasons:string[], tags:object}}
 */
export function decide(item, answers) {
  const a = answers || {};
  const reasons = [];

  const tags = {
    category: a.category?.choice ?? 'other',
    subtype: a.subtype?.choice ?? 'unspecified',
    setting: a.setting?.choice ?? 'unspecified',
  };
  if (a.moa?.choice) tags.moa = a.moa.choice;

  const relevant = a.relevant?.noul;
  if (typeof relevant !== 'number') {
    return {
      decision: 'review',
      priority: 0,
      reasons: ['Jev の relevant 判定が欠落しているため人手で確認'],
      tags,
    };
  }

  const impact = typeof a.impact?.score === 'number' ? a.impact.score : 0;

  let decision;
  let priority = 0;

  if (relevant < THRESHOLDS.relevantLow) {
    // ルール1
    decision = 'discard';
    reasons.push(`乳がん薬物療法に非該当 (relevant ${fmt(relevant)})`);
  } else if (relevant < THRESHOLDS.relevantHigh) {
    // ルール2
    decision = 'review';
    reasons.push(`関連性が不確実 (relevant ${fmt(relevant)})`);
  } else if (impact >= THRESHOLDS.impactAccept) {
    // ルール3
    decision = 'accept';
    priority = impact;
    reasons.push(`影響度が高い (impact ${fmt(impact)})`);
  } else if (impact >= THRESHOLDS.impactReview) {
    // ルール4
    decision = 'review';
    priority = impact;
    reasons.push(`参考情報レベルの影響度 (impact ${fmt(impact)})`);
  } else {
    // ルール5
    decision = 'discard';
    reasons.push(`影響度が低い (impact ${fmt(impact)})`);
  }

  // ルール6: 分類が曖昧な accept は要確認に格下げ
  if (decision === 'accept') {
    const conf = a.category?.confidence;
    if (typeof conf === 'number' && conf < THRESHOLDS.categoryConfidence) {
      decision = 'review';
      reasons.push(`分類が曖昧 (category ${tags.category} conf ${fmt(conf)})`);
    }
  }

  // ── ctgov 固有（ルール7〜9） ──
  if (item?.source === 'ctgov' && typeof a.novel_agent?.noul === 'number') {
    const novel = a.novel_agent.noul;
    if (novel < THRESHOLDS.novelLow) {
      // ルール7: 既存化学療法・後発品・支持療法・機器など
      decision = 'discard';
      priority = 0;
      reasons.push(`新薬候補を含まない試験 (novel_agent ${fmt(novel)})`);
    } else if (novel < THRESHOLDS.novelHigh) {
      // ルール8: 新規性が不確実。ただし乳がんに非該当（ルール1）なら破棄のまま
      if (!(decision === 'discard' && relevant < THRESHOLDS.relevantLow)) {
        decision = 'review';
        reasons.push(`新薬候補かどうかが不確実 (novel_agent ${fmt(novel)})`);
      }
    } else if (relevant >= THRESHOLDS.relevantHigh) {
      // ルール9: landscape 候補として採用
      decision = 'accept';
      priority = Math.max(priority, impact, THRESHOLDS.impactReview);
      reasons.push(
        `新規作用機序の乳がん試験 (novel_agent ${fmt(novel)}${tags.moa ? `, moa ${tags.moa}` : ''})`
      );
    }
  }

  return { decision, priority: Math.round(priority * 100) / 100, reasons, tags };
}

export default { THRESHOLDS, decide };
