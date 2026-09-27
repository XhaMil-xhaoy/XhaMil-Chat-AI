import json
import subprocess
import datetime
import os
from pathlib import Path

TMP = Path(os.environ["TEMP"]) / "ghbody.json"

# 本仓库归属 xiongxinx57-bot，不要用 xhaoy-XhaMil / QQ 邮箱
AUTHOR = {
    "name": "xhaoy",
    "email": "xiongxinx57@gmail.com",
}


def api(method: str, path: str, body=None):
    cmd = ["gh", "api", "-X", method, path]
    if body is not None:
        TMP.write_bytes(json.dumps(body, ensure_ascii=False).encode("utf-8"))
        cmd += ["--input", str(TMP)]
    r = subprocess.run(cmd, capture_output=True)
    out = r.stdout.decode("utf-8", "replace")
    err = r.stderr.decode("utf-8", "replace")
    if r.returncode != 0:
        raise SystemExit(f"FAIL {method} {path}: {err[:500]}\n{out[:500]}")
    return json.loads(out) if out.strip() else {}


ref = api("GET", "repos/xiongxinx57-bot/XhaMil-Chat-AI/git/ref/heads/main")
head = ref["object"]["sha"]
commit = api("GET", f"repos/xiongxinx57-bot/XhaMil-Chat-AI/git/commits/{head}")
tree = commit["tree"]["sha"]
print("head", head[:7], "tree", tree[:7])

now = (
    datetime.datetime.now(datetime.timezone.utc)
    .replace(microsecond=0)
    .isoformat()
    .replace("+00:00", "Z")
)
author = {**AUTHOR, "date": now}

new = api(
    "POST",
    "repos/xiongxinx57-bot/XhaMil-Chat-AI/git/commits",
    {
        "message": "开源仓库发布",
        "tree": tree,
        "parents": [],
        "author": author,
        "committer": author,
    },
)
print("new", new["sha"][:7], new.get("author"))

api(
    "PATCH",
    "repos/xiongxinx57-bot/XhaMil-Chat-AI/git/refs/heads/main",
    {"sha": new["sha"], "force": True},
)

c = api("GET", "repos/xiongxinx57-bot/XhaMil-Chat-AI/commits/main")
print(
    "main_now",
    c["sha"][:7],
    (c.get("author") or {}).get("login"),
    c["commit"]["author"]["email"],
    c["commit"]["author"]["name"],
)

cons = api("GET", "repos/xiongxinx57-bot/XhaMil-Chat-AI/contributors")
print("contributors (cache may lag):")
for u in cons:
    print(" ", u["login"], u["contributions"])

TMP.unlink(missing_ok=True)
print("DONE")
