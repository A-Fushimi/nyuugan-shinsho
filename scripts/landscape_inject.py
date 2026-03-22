"""Inject LANDSCAPE JSON data into App.jsx const LANDSCAPE = [...] array."""

import json
import re
import sys


def json_to_js_array(data):
    """Convert Python list of dicts to JS array literal string."""
    lines = []
    for d in data:
        parts = []
        parts.append(f'id:"{d["id"]}"')
        parts.append(f'name:"{d["name"]}"')
        parts.append(f'co:"{d["co"]}"')
        parts.append(f'moa_cat:"{d["moa_cat"]}"')
        parts.append(f'tgt:"{d["tgt"]}"')
        subs = ",".join(f'"{s}"' for s in d["sub"])
        parts.append(f"sub:[{subs}]")
        parts.append(f'stage:"{d["stage"]}"')
        parts.append(f'nct:"{d["nct"]}"')
        parts.append(f'nct_url:"{d["nct_url"]}"')
        parts.append(f'status:"{d["status"]}"')
        parts.append(f'fih_date:"{d.get("fih_date", "")}"')
        n = d.get("n_enrolled")
        parts.append(f"n_enrolled:{n if n else 'null'}")
        parts.append(f'early_result:"{d.get("early_result", "")}"')
        parts.append(f'source_url:"{d.get("source_url", "")}"')
        parts.append(f'source_label:"{d.get("source_label", "")}"')
        parts.append(f'note:"{d.get("note", "")}"')
        parts.append(f'updated:"{d.get("updated", "")}"')
        lines.append("  {" + ",".join(parts) + "},")

    return "[\n" + "\n".join(lines) + "\n]"


def inject(jsx_path, data, output_path=None):
    """Replace const LANDSCAPE = [...] in JSX with new data."""
    with open(jsx_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Match the LANDSCAPE array: from "const LANDSCAPE = [" to the matching "];"
    pattern = r"(const LANDSCAPE = )\[.*?\];?"
    js_array = json_to_js_array(data) + ";"

    new_content, count = re.subn(pattern, r"\g<1>" + js_array, content, flags=re.DOTALL)

    if count == 0:
        print("ERROR: Could not find 'const LANDSCAPE = [...]' in JSX file.")
        print("Make sure the LANDSCAPE array exists in the file.")
        sys.exit(1)

    out = output_path or jsx_path
    with open(out, "w", encoding="utf-8") as f:
        f.write(new_content)

    print(f"Injected {len(data)} entries into {out}")


if __name__ == "__main__":
    jsx_path = sys.argv[1] if len(sys.argv) > 1 else "src/App.jsx"
    data_path = sys.argv[2] if len(sys.argv) > 2 else "data/landscape.json"
    output_path = sys.argv[3] if len(sys.argv) > 3 else None

    with open(data_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    inject(jsx_path, data, output_path)
