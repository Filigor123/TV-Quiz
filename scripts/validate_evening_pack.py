"""Validate the evening content pack without external dependencies."""
import argparse, hashlib, json, re
from pathlib import Path
from urllib.parse import urlparse
import xml.etree.ElementTree as ET
from collections import Counter

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / "content/evening-2026-11-14"
def norm(s):
    return re.sub(r"[^\w]+", "", s.casefold().replace("ё", "е"))
def load_baseline(path):
    raw = path.read_text(encoding="utf-8")
    if raw.lstrip().startswith("window."):
        raw = raw[raw.index("["):].rstrip().removesuffix(";")
    obj = json.loads(raw)
    return obj if isinstance(obj, list) else obj["questions"]
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--baseline", type=Path)
    args = parser.parse_args()
    questions = json.loads((PACK / "questions.json").read_text())["questions"]
    media = json.loads((PACK / "media.json").read_text())
    ids, texts = set(), set()
    allowed = {"Музыка": {"Музыкальные группы", "Исполнители и хиты"},
               "Кино": {"Культовые фильмы", "Актёры и режиссёры"},
               "Автомобили": {"Марки и модели", "Двигатели и техника"},
               "География": {"Страны и столицы", "Города и природа"},
               "Наука": {"Космос", "Физика и изобретения", "Логика и числа"}}
    for x in questions + media["ready"] + media["candidates"]:
        assert x["id"] not in ids, x["id"]
        ids.add(x["id"])
        opts = x.get("answers", x.get("options"))
        assert len(opts) == 4 and len({norm(a) for a in opts}) == 4
        assert all(isinstance(a,str) and a.strip() for a in opts)
        if x.get("correct") is not None:
            assert type(x["correct"]) is int and 0 <= x["correct"] < 4
            if "answer" in x:
                assert opts[x["correct"]] == x["answer"]
        assert x.get("text",x.get("prompt","")).strip()
    for x in questions:
        assert x["category"] in allowed and x["topic"] in allowed[x["category"]]
        assert x["difficulty"] in ("Лёгкий", "Средний", "Сложный")
        assert norm(x["text"]) not in texts
        texts.add(norm(x["text"]))
        assert x["explanation"].strip() and x["sourceUrls"]
        for u in x["sourceUrls"]:
            assert urlparse(u).scheme == "https" and urlparse(u).netloc
    for x in media["ready"]:
        assert x["status"] == "file_prepared" and x["media"]["type"] == "image"
        path = (ROOT / x["media"]["src"]).resolve()
        assert path.is_relative_to(ROOT.resolve()) and path.is_file()
        raw = path.read_bytes()
        svg = ET.fromstring(raw)
        assert svg.tag.endswith("svg") and svg.attrib["viewBox"] == "0 0 1280 720"
        assert not any(node.tag.endswith(("script","foreignObject")) for node in svg.iter())
        assert b"http://" not in raw.replace(b"http://www.w3.org/2000/svg", b"")
        assert x["bytes"] == len(raw) and x["sha256"] == hashlib.sha256(raw).hexdigest()
        assert x["answer"] in x["acceptedAnswers"]
    for x in media["candidates"]:
        assert x["status"] == "source_only" and x["media"] is None
        assert x["sourceStartSeconds"] is None and x["sourceEndSeconds"] is None
        assert urlparse(x["sourcePage"]).scheme == "https"
    if args.baseline:
        baseline = {norm(x["text"]) for x in load_baseline(args.baseline)}
        assert not texts & baseline, "Duplicate normalized question in baseline"
    # Independent exact counts for the original constructions.
    assert sum((3-k)**2 for k in (1,2)) == 5
    paths = {(0,0):1}
    for x in range(4):
        for y in range(4):
            if (x,y)!=(0,0):
                paths[x,y] = paths.get((x-1,y),0) + paths.get((x,y-1),0)
    assert paths[3,3] == 20
    cells = {(0,0),(0,1),(0,2),(1,2),(2,2)}
    perimeter = sum((x+dx,y+dy) not in cells for x,y in cells for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)))
    assert perimeter == 12
    print(json.dumps({"result":"PASS","text":len(questions),"ready_images":len(media["ready"]),
        "source_only":len(media["candidates"]),"unique_ids":len(ids),
        "correct_positions":dict(Counter(x["correct"] for x in questions)),
        "baseline_compared": bool(args.baseline)},ensure_ascii=False))
if __name__ == "__main__":
    main()
