"""Score the analyst's answers with Microsoft Foundry's evaluators.

    python3.12 -m venv .venv && . .venv/bin/activate
    pip install -r scripts/foundry-requirements.txt
    python scripts/foundry-evaluate.py captured.jsonl

Judges groundedness (against the tool results the agent read), relevance and
coherence of the answered questions. Set FOUNDRY_JUDGE_DEPLOYMENT to a
deployment other than the analyst's, and FOUNDRY_PROJECT_ENDPOINT to also log
the run to your Foundry project (sign in with `az login`). Reads FOUNDRY_*
from the environment or .env.local.
"""
import json, os, re, sys, pathlib
from azure.identity import DefaultAzureCredential
from azure.ai.evaluation import (evaluate, GroundednessEvaluator, RelevanceEvaluator,
                                 CoherenceEvaluator, AzureOpenAIModelConfiguration)

def env(path):
    out = {}
    for line in pathlib.Path(path).read_text().splitlines():
        m = re.match(r'^([A-Z_]+)=(.*)$', line)
        if m: out[m.group(1)] = m.group(2).strip().strip('"').strip("'")
    return out

root = pathlib.Path(__file__).resolve().parent.parent
cfg = {**(env(root / ".env.local") if (root / ".env.local").exists() else {}), **os.environ}
endpoint = cfg["FOUNDRY_ENDPOINT"].rstrip("/")
judge = cfg.get("FOUNDRY_JUDGE_DEPLOYMENT", cfg["FOUNDRY_DEPLOYMENT"])
project = cfg.get("FOUNDRY_PROJECT_ENDPOINT")
captured = sys.argv[1]
model = AzureOpenAIModelConfiguration(azure_endpoint=endpoint, api_key=cfg["FOUNDRY_API_KEY"],
                                      azure_deployment=judge, api_version="2025-04-01-preview")
# Reasoning-style judge models reject max_tokens; JUDGE_REASONING=0 turns this off.
reasoning = cfg.get("JUDGE_REASONING", "1") == "1"
ev = {"groundedness": GroundednessEvaluator(model, is_reasoning_model=reasoning),
      "relevance": RelevanceEvaluator(model, is_reasoning_model=reasoning),
      "coherence": CoherenceEvaluator(model, is_reasoning_model=reasoning)}
mapping = {"query": "${data.query}", "response": "${data.response}"}
conf = {"groundedness": {"column_mapping": {**mapping, "context": "${data.context}"}},
        "relevance": {"column_mapping": mapping}, "coherence": {"column_mapping": mapping}}
# Only answered questions are judged; declines are scored by `npm run eval:analyst`.
answered = [r for r in map(json.loads, open(captured)) if r["status"] == "answered" and r["response"]]
data = pathlib.Path(captured).with_suffix(".answered.jsonl")
data.write_text("\n".join(json.dumps({k: r[k] for k in ("query", "response", "context")}) for r in answered) + "\n")
result = evaluate(data=str(data), evaluators=ev, evaluator_config=conf,
                  azure_ai_project=project,
                  evaluation_name=cfg.get("EVAL_NAME", "between-the-lines-analyst"),
                  output_path=str(pathlib.Path(captured).with_suffix(".result.json")))
print(json.dumps(result["metrics"], indent=1))
print("studio_url:", result.get("studio_url"))
for r in result["rows"]:
    print(f'{r["inputs.query"][:44]:44} grounded={r.get("outputs.groundedness.groundedness")} rel={r.get("outputs.relevance.relevance")} coh={r.get("outputs.coherence.coherence")}')
