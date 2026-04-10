import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

/**
 * Supabaseからデータを取得するフック
 * フォールバック: Supabase接続失敗時はfallbackDataを返す
 */
export function useSupabaseQuery(table, query, fallbackData, options = {}) {
  const [data, setData] = useState(fallbackData);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("json"); // "json" | "supabase"
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      try {
        const { select = "*", order, limit, eq } = options;
        let q = supabase.from(table).select(select);
        if (eq) Object.entries(eq).forEach(([k, v]) => { q = q.eq(k, v); });
        if (order) q = q.order(order.column, { ascending: order.ascending ?? true });
        if (limit) q = q.limit(limit);

        const { data: rows, error: err } = await q;
        if (err) throw err;
        if (!cancelled && rows && rows.length > 0) {
          setData(rows);
          setSource("supabase");
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message);
          // フォールバック: JSONデータをそのまま使う
          console.warn(`Supabase fetch failed for ${table}, using JSON fallback:`, e.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetch();
    return () => { cancelled = true; };
  }, [table, query]);

  return { data, loading, source, error };
}

/**
 * パイプライン概要ビューを取得
 */
export function usePipelineOverview(fallbackData) {
  return useSupabaseQuery("v_pipeline_overview", "pipeline", fallbackData, {
    select: "*"
  });
}

/**
 * 試験サマリービューを取得
 */
export function useTrialSummary(fallbackData) {
  return useSupabaseQuery("v_trial_summary", "trials", fallbackData, {
    select: "*"
  });
}
