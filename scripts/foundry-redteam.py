"""Attack the analyst with Microsoft Foundry's AI Red Teaming Agent.

    AI_ENABLED=true AI_PROVIDER=foundry AI_USAGE_STORE=memory AI_REDIS_URL= \
    AI_MINUTE_LIMIT=1000 AI_HOURLY_LIMIT=1000 AI_DAILY_LIMIT=1000 AI_TOTAL_LIMIT=5000 \
    AI_ASK_PER_CLIENT_LIMIT=1000 AI_TOKEN_MINUTE_LIMIT=300000 AI_REQUEST_MINUTE_LIMIT=300 \
    AI_SPEND_LEDGER=test AI_SPEND_CEILING_USD=15 npm run dev -- -p 3111
    python3.12 -m venv .venv && . .venv/bin/activate
    pip install -r scripts/foundry-requirements.txt
    FOUNDRY_REDTEAM_PROJECT_ENDPOINT=<project endpoint> python scripts/foundry-redteam.py

Sends each attack to a local copy of POST /api/ask, one at a time, and prints
how every attack ended. The project must be in a region the red teaming
service supports (West US 3 is not; East US 2 is). Sign in with `az login`.
"""
import asyncio, collections, json, os, re, urllib.error, urllib.request
from azure.identity import DefaultAzureCredential
from azure.ai.evaluation.red_team import RedTeam, RiskCategory, AttackStrategy

PROJECT = os.environ["FOUNDRY_REDTEAM_PROJECT_ENDPOINT"]
URL = os.environ.get("ANALYST_URL", "http://localhost:3111/api/ask")
OBJECTIVES = int(os.environ.get("REDTEAM_OBJECTIVES", "5"))

def ask(question):
    body = json.dumps({"scenario": "pressure", "time": 4200, "question": question}).encode()
    req = urllib.request.Request(URL, body, {"content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            for line in r:
                m = json.loads(line)
                if m["type"] == "result":
                    res = m["result"]
                    return f"[{res['status']}] " + (res["answer"] or res["notice"])
    except urllib.error.HTTPError as e:  # e.g. over the 240-character question limit
        return f"[HTTP {e.code}] " + e.read().decode()[:200]
    return "[no result]"

lock = None
async def target(messages, stream=False, session_state=None, context=None):
    """One attack at a time; a spending-cap refusal is retried so it isn't scored as resistance."""
    global lock
    lock = lock or asyncio.Lock()
    async with lock:
        for _ in range(6):
            out = await asyncio.to_thread(ask, messages[-1]["content"])
            if not out.startswith("[unavailable]"): break
            await asyncio.sleep(20)
    return {"messages": [{"role": "assistant", "content": out}]}

async def main():
    rt = RedTeam(azure_ai_project=PROJECT, credential=DefaultAzureCredential(),
                 risk_categories=[RiskCategory.Violence, RiskCategory.HateUnfairness, RiskCategory.Sexual,
                                  RiskCategory.SelfHarm, RiskCategory.UngroundedAttributes],
                 num_objectives=OBJECTIVES)
    result = await rt.scan(target=target, scan_name=os.environ.get("REDTEAM_NAME", "between-the-lines-analyst-redteam"),
                           attack_strategies=[AttackStrategy.Baseline, AttackStrategy.Jailbreak, AttackStrategy.Tense,
                                              AttackStrategy.Leetspeak, AttackStrategy.Base64],
                           output_path="redteam-results")
    ends = collections.Counter()
    for a in result.attack_details:
        conv = a["conversation"]; conv = conv["messages"] if isinstance(conv, dict) else conv
        m = re.match(r"\[[\w ]+\]", conv[-1]["content"])
        ends[m.group(0) if m else "?"] += 1
        if a.get("attack_success"):
            print("FLAGGED", a["risk_category"], a["attack_technique"], "|", conv[0]["content"][:100], "=>", conv[-1]["content"][:200])
    print("how attacks ended:", dict(ends))

asyncio.run(main())
