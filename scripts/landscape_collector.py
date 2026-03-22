#!/usr/bin/env python3
"""
乳がん新書 — ランドスケープデータ収集パイプライン

Usage:
    python scripts/landscape_collector.py
    python scripts/landscape_collector.py --jsx src/App.jsx --output data/landscape.json
    python scripts/landscape_collector.py --inject  # 収集後にJSXに注入

Workflow:
    Step 1: ClinicalTrials.gov APIで候補取得
    Step 2: DRUGS配列との重複排除
    Step 3: 作用機序カテゴリ分類
    Step 4: JSON出力
    Step 5: (--inject指定時) JSXに注入
"""

import argparse
import json
import os
import sys

# Add scripts directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ctgov_api import search_studies
from landscape_dedup import deduplicate
from landscape_to_json import convert_all
from landscape_inject import inject


def main():
    parser = argparse.ArgumentParser(description="Collect landscape data for 乳がん新書")
    parser.add_argument(
        "--jsx", default="src/App.jsx", help="Path to App.jsx (for dedup + inject)"
    )
    parser.add_argument(
        "--output", default="data/landscape.json", help="Output JSON path"
    )
    parser.add_argument(
        "--raw", default="data/ctgov_raw.json", help="Raw API output path"
    )
    parser.add_argument(
        "--filtered",
        default="data/ctgov_filtered.json",
        help="Filtered output path",
    )
    parser.add_argument(
        "--inject",
        action="store_true",
        help="Inject results into App.jsx after collection",
    )
    parser.add_argument(
        "--skip-api",
        action="store_true",
        help="Skip API call, use existing raw data",
    )
    args = parser.parse_args()

    # Ensure data directory exists
    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)

    # Step 1: Fetch from ClinicalTrials.gov
    if args.skip_api and os.path.exists(args.raw):
        print(f"[Step 1] Skipping API call, loading {args.raw}")
        with open(args.raw, "r", encoding="utf-8") as f:
            raw_studies = json.load(f)
    else:
        print("[Step 1] Fetching from ClinicalTrials.gov API...")
        raw_studies = search_studies()
        with open(args.raw, "w", encoding="utf-8") as f:
            json.dump(raw_studies, f, ensure_ascii=False, indent=2)
        print(f"  Raw: {len(raw_studies)} studies → {args.raw}")

    # Step 2: Deduplicate against DRUGS array
    print(f"\n[Step 2] Deduplicating against {args.jsx}...")
    filtered = deduplicate(raw_studies, args.jsx)
    with open(args.filtered, "w", encoding="utf-8") as f:
        json.dump(filtered, f, ensure_ascii=False, indent=2)
    print(f"  Filtered: {len(filtered)} studies → {args.filtered}")

    # Step 3-4: Classify and convert to LANDSCAPE format
    print("\n[Step 3-4] Classifying MOA and converting to LANDSCAPE format...")
    landscape = convert_all(filtered)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(landscape, f, ensure_ascii=False, indent=2)
    print(f"  Landscape: {len(landscape)} unique drugs → {args.output}")

    # Category summary
    cats = {}
    for d in landscape:
        cats[d["moa_cat"]] = cats.get(d["moa_cat"], 0) + 1
    print("\n  Category breakdown:")
    for cat, count in sorted(cats.items(), key=lambda x: -x[1]):
        print(f"    {cat}: {count}")

    # Step 5: Inject into JSX (optional)
    if args.inject:
        print(f"\n[Step 5] Injecting into {args.jsx}...")
        inject(args.jsx, landscape)
    else:
        print(
            f"\n[INFO] To inject into JSX, run:"
            f"\n  python scripts/landscape_inject.py {args.jsx} {args.output}"
        )

    print("\nDone!")


if __name__ == "__main__":
    main()
