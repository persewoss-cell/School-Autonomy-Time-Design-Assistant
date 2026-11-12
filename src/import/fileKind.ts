/**
 * 올린 파일의 앞부분(시그니처)을 보고 실제 형식을 알아낸다.
 * 이름이 .hwpx여도 속은 예전 한글(.hwp)·PDF·문서보안(DRM)으로 잠긴 파일일 수 있다.
 */
export type FileKind = "zip" | "ole" | "pdf" | "empty" | "unknown";

export function fileKind(bytes: Uint8Array): FileKind {
  if (bytes.length === 0) return "empty";
  const at = (sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (at([0x50, 0x4b, 0x03, 0x04]) || at([0x50, 0x4b, 0x05, 0x06])) return "zip";
  if (at([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "ole";
  if (at([0x25, 0x50, 0x44, 0x46])) return "pdf";
  return "unknown";
}

/** hwpx로 읽을 수 없는 파일일 때 선생님께 보여 줄 안내 */
export function notHwpxMessage(kind: FileKind): string {
  const resave = "한글에서 이 파일을 열고 [파일] → [다른 이름으로 저장하기] → 파일 형식 '한글 표준 문서(*.hwpx)'로 새로 저장해 올려 주세요.";
  switch (kind) {
    case "ole":
      return `이름은 .hwpx이지만 실제로는 예전 한글(.hwp) 형식이거나 암호가 걸린 파일이에요. ${resave} (암호가 걸려 있으면 [보안] → 문서 암호를 먼저 해제해 주세요)`;
    case "pdf":
      return "이름은 .hwpx이지만 실제로는 PDF 파일이에요. 원본 한글 파일을 HWPX로 저장해 올려 주세요.";
    case "empty":
      return "빈 파일이에요(0바이트). 파일이 제대로 저장되었는지 확인해 주세요.";
    default:
      return `한글(hwpx) 형식으로 읽을 수 없는 파일이에요. 학교 문서보안(DRM)이 걸린 파일이거나 파일이 손상된 것 같아요. 문서보안 프로그램에서 '보안 해제(복호화)'한 뒤, ${resave}`;
  }
}
