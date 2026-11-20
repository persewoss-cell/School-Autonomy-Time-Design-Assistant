"""압축 옵션 비트(flag)를 원본 hwpx와 똑같이 맞춘다 (파이썬이 0으로 쓰기 때문). 사용: fixflags.py 원본 결과"""
import sys, struct, zipfile
src, dst = sys.argv[1], sys.argv[2]
want = {i.filename: i.flag_bits for i in zipfile.ZipFile(src).infolist()}
b = bytearray(open(dst, "rb").read())
z = zipfile.ZipFile(dst)
for i in z.infolist():
    f = want.get(i.filename, i.flag_bits)
    struct.pack_into("<H", b, i.header_offset + 6, f)          # 로컬 헤더
cd = bytes(b).find(b"PK\x01\x02")
while cd != -1:
    nlen, elen, clen = struct.unpack_from("<HHH", b, cd + 28)
    name = bytes(b[cd + 46: cd + 46 + nlen]).decode("utf8", "replace")
    if name in want: struct.pack_into("<H", b, cd + 8, want[name])  # 중앙 디렉터리
    cd = bytes(b).find(b"PK\x01\x02", cd + 46 + nlen + elen + clen)
open(dst, "wb").write(b)
