# -*- coding: utf-8 -*-
"""한글(hwpx) 문서에 메모를 넣는다. 한글이 저장한 메모 구조(fieldBegin type=MEMO + subList)를 그대로 따른다.
사용: python3 -I addmemo.py 원본.hwpx 결과.hwpx 학년 [--dry]
"""
import re, sys, zipfile, random, time, json
from xml.sax.saxutils import escape
import xml.etree.ElementTree as ET

sys.path.insert(0, sys.argv[0].rsplit('/', 1)[0])
import os, importlib
MEMOS = importlib.import_module(os.environ.get("MEMOS_MODULE", "memos")).MEMOS

src, dst, grade = sys.argv[1], sys.argv[2], int(sys.argv[3])
dry = "--dry" in sys.argv
# 시험용 옵션: --only=1 (그 번호 메모만), --keep-lineseg (줄 배치 정보 그대로 두기), --author=HK, --oneline (메모 한 줄만)
opt = {a.split("=")[0]: (a.split("=")[1] if "=" in a else True) for a in sys.argv[4:] if a.startswith("--")}

zin = zipfile.ZipFile(src)
xml = zin.read("Contents/section0.xml").decode("utf8")
T = re.compile(r"<hp:t>([^<]*)</hp:t>")

def unent(s):
    return s.replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"').replace("&apos;", "'").replace("&amp;", "&")

# 메모를 붙일 자리 찾기 (원본 위치 기준, 뒤에서부터 바꿈)
targets = []
report = []
AUTHOR = opt.get("--author", "컨설팅")
for k, m in enumerate(MEMOS[grade], 1):
    if "--only" in opt and str(k) != opt["--only"]:
        continue
    want = escape(m["find"])  # 문서 XML 안에서는 &, <, > 가 바뀌어 있음
    hits = [x for x in T.finditer(xml) if want in x.group(1)]
    if len(hits) < m.get("nth", 1):
        report.append({"no": k, "find": m["find"], "ok": False})
        continue
    h = hits[m.get("nth", 1) - 1]
    start = h.start(1) + h.group(1).index(want)
    targets.append((start, start + len(want), k, m))
    report.append({"no": k, "find": m["find"], "ok": True, "context": unent(h.group(1))[:60]})

missing = [r for r in report if not r["ok"]]
print(json.dumps(report, ensure_ascii=False, indent=0))
if missing or dry:
    sys.exit(1 if missing else 0)

def filetime(t):
    v = int((t + 11644473600) * 10_000_000)
    return v & 0xFFFFFFFF, v >> 32

def para(text, first):
    pid = "0" if first else "2147483648"
    return (f'<hp:p id="{pid}" paraPrIDRef="{PARA_PR}" styleIDRef="{STYLE}" pageBreak="0" columnBreak="0" merged="0">'
            f'<hp:run charPrIDRef="{CHAR_PR}"><hp:t>{escape(text)}</hp:t></hp:run></hp:p>')

base_id = random.randint(1_400_000_000, 1_900_000_000)
field_id = 623209829  # 한글 메모 필드의 고정 종류 번호 (한글 12·13이 저장한 파일 모두 같음)
hdr = zin.read("Contents/header.xml").decode("utf8")
ms = re.search(r'<hh:style id="(\d+)" type="PARA" name="메모"[^>]*paraPrIDRef="(\d+)" charPrIDRef="(\d+)"', hdr)
STYLE, PARA_PR, CHAR_PR = (ms.group(1), ms.group(2), ms.group(3)) if ms else ("0", "0", "0")
now = time.time()
def para_spans(x):
    """각 <hp:p>의 (시작, 끝) — 표 안 문단처럼 겹쳐 있어도 짝을 맞춘다"""
    stack, spans = [], []
    for t in re.finditer(r"<hp:p\b|</hp:p>", x):
        if t.group(0) == "</hp:p>":
            spans.append((stack.pop(), t.start()))
        else:
            stack.append(t.start())
    return spans

edits = []  # (시작, 끝, 바꿀 글) — 뒤에서부터 적용
if "--keep-lineseg" not in opt:
    spans = para_spans(xml)
    done = set()
    for start, end, k, m in targets:
        inner = min((sp for sp in spans if sp[0] < start < sp[1]), key=lambda sp: sp[1] - sp[0])
        if inner in done:
            continue
        done.add(inner)
        pe = inner[1]
        if xml[:pe].endswith("</hp:linesegarray>"):
            ls = xml.rfind("<hp:linesegarray>", inner[0], pe)
            if ls != -1 and "</hp:p>" not in xml[ls:pe]:
                edits.append((ls, pe, ""))
# 줄 배치 정보 지우기와 메모 넣기를 하나의 목록으로 묶어 파일 뒤쪽부터 차례로 적용 (앞쪽 위치가 밀리지 않게)
ops = [("cut", a_, b_, None, None) for a_, b_, _ in edits] + [("memo", st, en, k, m) for st, en, k, m in targets]
out = xml
for kind, start, end, k, m in sorted(ops, key=lambda o: -o[1]):
    if kind == "cut":
        out = out[:start] + out[end:]
        continue
    bid = base_id + k
    lo, hi = filetime(now + k)
    iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now + k))
    prefix = os.environ.get("FIX_PREFIX", "→ 고친 예: ")
    # body는 줄바꿈(\n)으로 여러 줄을 쓸 수 있다 (예: (예시) 다음 줄부터 모범 문장)
    lines = [x for x in [m["tag"], *m["body"].split("\n")] if x.strip()] + ([f"{prefix}{m['fix']}"] if m.get("fix") else [])
    if "--oneline" in opt:
        lines = [m["tag"]]
    sub = "".join(para(t, i == 0) for i, t in enumerate(lines))
    begin = (f'<hp:ctrl><hp:fieldBegin id="{bid}" type="MEMO" name="" editable="1" dirty="1" zorder="{k}" fieldid="{field_id}">'
             f'<hp:parameters cnt="7" name=""><hp:integerParam name="Prop">0</hp:integerParam>'
             f'<hp:stringParam name="Command">MEMO/65535/{k}/{lo}/{hi}/{AUTHOR}/\\;;</hp:stringParam>'
             f'<hp:stringParam name="ID">memo{k}</hp:stringParam><hp:integerParam name="Number">{k}</hp:integerParam>'
             f'<hp:stringParam name="Author">{AUTHOR}</hp:stringParam><hp:stringParam name="MemoShapeIDRef">65535</hp:stringParam>'
             f'<hp:stringParam name="CreateDateTime">{iso}</hp:stringParam></hp:parameters>'
             f'<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="TOP" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">'
             f'{sub}</hp:subList></hp:fieldBegin></hp:ctrl>')
    endc = f'<hp:ctrl><hp:fieldEnd beginIDRef="{bid}" fieldid="{field_id}"/></hp:ctrl>'
    # <hp:t>앞</hp:t> + 메모 시작 + <hp:t>대상</hp:t> + 메모 끝 + <hp:t>뒤</hp:t>  (같은 run 안)
    out = out[:start] + "</hp:t>" + begin + "<hp:t>" + out[start:end] + "</hp:t>" + endc + "<hp:t>" + out[end:]

out = out.replace("<hp:t></hp:t>", "<hp:t/>")
ET.fromstring(out.encode("utf8"))  # XML이 깨지지 않았는지 확인

with zipfile.ZipFile(dst, "w") as zout:
    for info in zin.infolist():
        data = out.encode("utf8") if info.filename == "Contents/section0.xml" else zin.read(info.filename)
        zout.writestr(info, data, compress_type=info.compress_type)
print("saved", dst, len(targets), "memos")
