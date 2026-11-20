import re, sys, zipfile
s = zipfile.ZipFile(sys.argv[1]).read("Contents/section0.xml").decode("utf8")
unent = lambda x: x.replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"').replace("&apos;", "'").replace("&amp;", "&")
for m in re.finditer(r'<hp:fieldBegin id="(\d+)" type="MEMO"[^>]*>(.*?)</hp:fieldBegin>', s, re.S):
    bid, inner = m.group(1), m.group(2)
    author = re.search(r'Author">([^<]*)<', inner).group(1)
    num = re.search(r'Number">(\d+)<', inner).group(1)
    sub = re.search(r"<hp:subList.*?</hp:subList>", inner, re.S).group(0)
    paras = [unent("".join(re.findall(r"<hp:t>([^<]*)</hp:t>", p))) for p in re.findall(r"<hp:p\b.*?</hp:p>", sub, re.S)]
    end = s.find(f'beginIDRef="{bid}"', m.end())
    anchor = unent("".join(re.findall(r"<hp:t>([^<]*)</hp:t>", s[m.end():end])))
    print(f"### 메모{num} [{author}] 대상: 「{anchor[:70]}」")
    for p in paras: print("   ", p)
