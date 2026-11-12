import { describe, expect, it } from "vitest";
import { fileKind, notHwpxMessage } from "./fileKind";

describe("올린 파일의 실제 형식", () => {
  const b = (...xs: number[]) => new Uint8Array([...xs, 0, 0, 0, 0]);
  it("hwpx(zip)·예전 hwp(OLE)·PDF·빈 파일·그 밖(DRM 등)", () => {
    expect(fileKind(b(0x50, 0x4b, 0x03, 0x04))).toBe("zip");
    expect(fileKind(b(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1))).toBe("ole");
    expect(fileKind(new TextEncoder().encode("%PDF-1.7"))).toBe("pdf");
    expect(fileKind(new Uint8Array())).toBe("empty");
    expect(fileKind(new TextEncoder().encode("<## DRM header"))).toBe("unknown");
  });
  it("안내 문구", () => {
    expect(notHwpxMessage("ole")).toContain("예전 한글(.hwp)");
    expect(notHwpxMessage("unknown")).toContain("문서보안(DRM)");
    expect(notHwpxMessage("ole")).toContain("hwpx");
  });
});
