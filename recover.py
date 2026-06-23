import json

log_path = r"C:\Users\Hussnain Ahmad\.gemini\antigravity-ide\brain\9e234480-f0d9-49bf-b6a6-ab7f64385292\.system_generated\logs\transcript.jsonl"

hijri_content = None

with open(log_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
            # Check tool_calls for replace_file_content or write_to_file modifying hijri.tsx
            if "tool_calls" in data:
                for tc in data["tool_calls"]:
                    if tc.get("name") in ["default_api:multi_replace_file_content", "default_api:replace_file_content", "default_api:write_to_file"]:
                        args = tc.get("arguments", {})
                        if "hijri.tsx" in str(args.get("TargetFile", "")):
                            print(f"Found modification to hijri.tsx in step {data.get('step_index')}")
                            # We can't perfectly reconstruct from multi_replace easily if it's complex,
                            # but we can look for the output of "view_file" if it was called on the whole file?
                            pass
            
            # Or better, look at the tool responses to see if the file was dumped!
            if data.get("type") == "TOOL_RESPONSE":
                content = data.get("content", "")
                if "hijri.tsx" in content and "Total Lines: 1286" in content:
                    # view_file doesn't show the whole file...
                    pass
        except:
            pass

print("Done parsing.")
