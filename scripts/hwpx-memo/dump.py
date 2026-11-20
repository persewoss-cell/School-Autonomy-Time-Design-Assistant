import re,sys,zipfile
z=zipfile.ZipFile(sys.argv[1])
s=z.read('Contents/section0.xml').decode('utf8')
for i,m in enumerate(re.finditer(r'<hp:t>([^<]*)</hp:t>',s)):
    t=m.group(1)
    if t.strip(): print(i, repr(t[:90]))
