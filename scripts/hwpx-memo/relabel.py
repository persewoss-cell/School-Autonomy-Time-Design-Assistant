# -*- coding: utf-8 -*-
"""한글(hwpx) 문서의 메모 글자만 바꾼다 (본문은 그대로). 메모 구분 표시를 [필수]/[권장] 두 가지로 바꿀 때 쓴다.
사용: python3 -I relabel.py 원본.hwpx 결과.hwpx
규칙(사용자 결정, 2026-11-23): [지침]·[연수]·[확인] → [필수], [권장] 그대로,
  단 '[권장] 각 영역별로 나누기'는 [필수]. 구분 표시가 없는 메모는 앞에 [권장]을 붙인다.
바꾼 메모 문단의 <hp:linesegarray>(줄 배치 정보)는 지운다 (한글이 다시 계산함).
"""
import re, sys, zipfile
import xml.etree.ElementTree as ET

RULES = [
    (r"\[권장\]\s*각 영역별로 나누기", "[필수] 각 영역별로 나누기"),
    (r"\[(지침|연수|확인)\]\s*", "[필수] "),
    (r"\[권장\]\s*", "[권장] "),
]
TAG = re.compile(r"\[(필수|권장|지침|연수|확인)\]")

src, dst = sys.argv[1], sys.argv[2]
zin = zipfile.ZipFile(src)
xml = zin.read("Contents/section0.xml").decode("utf8")
MEMO = re.compile(r'(<hp:fieldBegin [^>]*type="MEMO".*?</hp:fieldBegin>)', re.S)
report = []

def fix(block):
    m = re.search(r"<hp:subList.*?</hp:subList>", block, re.S)
    sub = m.group(0)
    texts = re.findall(r"<hp:t>([^<]*)</hp:t>", sub)
    new = sub
    for pat, rep in RULES:
        new = re.sub(pat, rep, new)
    first = next((t for t in texts if t.strip()), "")
    if first and not TAG.search(first):  # 구분 표시 없는 메모
        new = new.replace(f"<hp:t>{first}</hp:t>", f"<hp:t>[권장] {first}</hp:t>", 1)
    if new != sub:
        new = re.sub(r"<hp:linesegarray>.*?</hp:linesegarray>", "", new, flags=re.S)
        after = "".join(re.findall(r"<hp:t>([^<]*)</hp:t>", new))
        report.append(after[:50])
    return block.replace(sub, new)

out = MEMO.sub(lambda m: fix(m.group(1)), xml)
ET.fromstring(out.encode("utf8"))
with zipfile.ZipFile(dst, "w") as zout:
    for info in zin.infolist():
        data = out.encode("utf8") if info.filename == "Contents/section0.xml" else zin.read(info.filename)
        zout.writestr(info, data, compress_type=info.compress_type)
print("\n".join(report))
print("changed", len(report), "memos →", dst)
