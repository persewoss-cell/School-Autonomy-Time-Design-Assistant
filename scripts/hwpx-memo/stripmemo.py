# -*- coding: utf-8 -*-
"""한글(hwpx) 문서에 이미 있는 메모를 모두 지운다 (본문 글자는 그대로).
다른 사람이 단 메모를 '컨설팅' 메모로 다시 쓸 때, 먼저 이것으로 지우고 addmemo.py로 새로 단다.
사용: python3 -I stripmemo.py 원본.hwpx 결과.hwpx
"""
import re, sys, zipfile
import xml.etree.ElementTree as ET

src, dst = sys.argv[1], sys.argv[2]
zin = zipfile.ZipFile(src)
xml = zin.read("Contents/section0.xml").decode("utf8")
BEGIN = re.compile(r'<hp:ctrl><hp:fieldBegin id="(\d+)" type="MEMO".*?</hp:fieldBegin></hp:ctrl>', re.S)
ids = BEGIN.findall(xml)
out = BEGIN.sub("", xml)
for i in ids:
    out = re.sub(r'<hp:ctrl><hp:fieldEnd beginIDRef="%s"[^>]*/></hp:ctrl>' % i, "", out)
# 메모 때문에 나뉜 글자 조각을 다시 붙인다 (같은 run 안)
out = re.sub(r"</hp:t>(?:<hp:t/>)*<hp:t>", "", out)
ET.fromstring(out.encode("utf8"))
with zipfile.ZipFile(dst, "w") as zout:
    for info in zin.infolist():
        data = out.encode("utf8") if info.filename == "Contents/section0.xml" else zin.read(info.filename)
        zout.writestr(info, data, compress_type=info.compress_type)
print("removed", len(ids), "memos →", dst)
