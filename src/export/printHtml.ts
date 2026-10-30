import { SUBJECT_GROUPS, TEACHER_PLANS, TEXTBOOK_TYPES, type DesignDoc } from "@/domain/types";
import { codeMap } from "@/domain/codes";
import { applicationTexts } from "@/domain/summary";
import { lessonLabels } from "@/validation/hours";
import { checklistResults } from "@/validation/design";

/**
 * 인쇄용(PDF로 저장) HTML.
 * 교육과정 문서(서식2·4)는 광양중동초 예시안 PDF의 모양을 그대로 따른다.
 * - A4, 좌우 여백 25.4mm, 쪽 번호 "- n -"(함초롬돋움 10pt)
 * - 제목: 회색 띠 + 「과목명」(HY울릉도M 21pt), 과목은 개설 형태 꼬리표
 * - 큰 제목: 회색 상자(오른쪽 아래 모서리 깎음) 13.6pt, 본문 휴먼명조 11.9pt
 * - 표: 위·아래 굵은 선, 바깥 세로선 없음, 머리 칸 회색(#f2f2f2 / #d9d9d9)
 * 표·성취기준 상자·문단 묶음은 쪽 중간에서 잘리지 않게 한다(break-inside: avoid).
 * 계획서(서식1·3)·체크리스트(서식6·7)는 지침의 서식 모양을 따른다.
 */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const br = (s: string) => esc(s).replace(/\n/g, "<br>");
const kindOf = (doc: DesignDoc) => (doc.basic.type === "subject" ? "과목" : "활동");
const schoolOf = (doc: DesignDoc) => doc.application.schoolName.trim() || "○○초등학교";
const paras = (text: string) =>
  text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
const box = (checked: boolean, label: string) => `<span class="chk">${checked ? "■" : "□"} ${esc(label)}</span>`;

const CSS = `
@page { size: A4; margin: 25mm 25.4mm 22mm 25.4mm;
  @bottom-center { content: "- " counter(page) " -"; font-family: "함초롬돋움", "HCR Dotum", "Nanum Gothic", sans-serif; font-size: 10pt; } }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; color: #000; background: #fff;
  font-family: "휴먼명조", "HumanMyeongjo", "함초롬바탕", "HCR Batang", "Nanum Myeongjo", serif; font-size: 11.9pt; line-height: 1.36; }
.hcr { font-family: "함초롬바탕", "HCR Batang", "Nanum Myeongjo", serif; }
.toolbar { position: sticky; top: 0; z-index: 9; background: #1d543c; color: #fff; padding: 10px 16px; font: 14px/1.5 sans-serif; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.toolbar button { font: inherit; font-weight: 700; background: #fff; color: #1d543c; border: 0; border-radius: 8px; padding: 6px 14px; cursor: pointer; }
@media screen {
  body { background: #e5e5e5; }
  .sheet { width: 210mm; margin: 16px auto; padding: 25mm 25.4mm 22mm; background: #fff; box-shadow: 0 1px 6px rgba(0,0,0,.2); }
}
@media print { .toolbar { display: none; } .sheet { width: auto; margin: 0; padding: 0; box-shadow: none; } .sheet + .sheet { break-before: page; } }
p { margin: 0; text-align: justify; }
.keep { break-inside: avoid; }
.pb { break-before: page; }
.with-next { break-after: avoid; }

/* 제목 띠 */
.banner { position: relative; height: 31pt; border-radius: 4pt; margin: 0 0 9pt;
  background: linear-gradient(180deg, #f4f4f4 0%, #d4d4d4 45%, #c6c6c6 55%, #e0e0e0 100%); }
.banner .t { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-family: "HY울릉도M", "HYwulM", "HY견고딕", "Nanum Gothic", sans-serif; font-size: 21pt; letter-spacing: -0.5pt; }
.banner .badge { position: absolute; right: 7pt; top: 50%; transform: translateY(-15%); background: #595959; color: #fff; border-radius: 3pt; padding: 1.5pt 7pt;
  font-family: "HY울릉도M", "HYwulM", "HY견고딕", "Nanum Gothic", sans-serif; font-size: 12pt; }
.subtitle { display: flex; justify-content: space-between; font-size: 11pt; font-weight: 700; padding: 0 6pt; margin-bottom: 30pt; }

/* 큰 제목: 회색 상자, 오른쪽 아래 모서리를 깎음 */
.h1 { width: 92%; background: #e1e1e1; font-size: 13.6pt; padding: 4.5pt 10pt; margin: 0 0 18pt; border-radius: 4pt 4pt 0 4pt;
  clip-path: polygon(0 0, 100% 0, 100% 45%, 94% 100%, 0 100%); break-after: avoid; }
.section { margin-bottom: 40pt; }
.h2 { font-size: 11.9pt; margin: 0 0 6pt; break-after: avoid; }
.h3 { font-size: 12pt; margin: 14pt 0 8pt; break-after: avoid; }
.indent { text-indent: 9pt; }
.goal { margin-top: 16pt; }
.num { padding-left: 34pt; text-indent: -20pt; margin-left: 14pt; }
.num.wide { line-height: 2.02; padding-left: 41pt; text-indent: -41pt; margin-left: 0; }
.list-gap { margin-top: 24pt; }

/* 표 공통: 위·아래 굵은 선, 바깥 세로선 없음 */
table { width: 100%; border-collapse: collapse; }
td, th { border: 0.36pt solid #000; padding: 3pt 4pt; vertical-align: middle; font-weight: normal; }
tr > :first-child { border-left: 0; }
tr > :last-child { border-right: 0; }
table.grid { border-top: 1.08pt solid #000; border-bottom: 1.08pt solid #000; }
thead { display: table-header-group; }
tr { break-inside: avoid; }
/* 단원 첫 행(여러 행을 묶는 칸이 있는 행)은 쪽에서 나뉠 수 있게: 묶음 칸 때문에 표 전체가 다음 쪽으로 밀리지 않도록 */
tr.span-start { break-inside: auto; }
.center { text-align: center; }
.gray { background: #d9d9d9; }
.light { background: #f2f2f2; }

/* 핵심아이디어 */
.ideas { width: 100%; margin-bottom: 10pt; border-collapse: collapse; }
.ideas th { background: #d9d9d9; border: 0; border-top: 1.08pt solid #404040; border-bottom: 0.6pt dashed #000; font-family: "한컴 산뜻돋움", "HanSantteutDotum", "Nanum Gothic", sans-serif; font-weight: 700; font-size: 10.7pt; padding: 3pt; }
.ideas td { border: 0; font-size: 9.7pt; padding: 3pt 6pt; }
.ideas td div { padding-left: 8pt; text-indent: -8pt; }

/* 내용 체계 */
.cs { font-size: 11pt; border-top: 0.48pt solid #000; border-bottom: 0.36pt solid #000; }
.cs th { background: #d9d9d9; font-weight: 700; }
.cs .diag { position: relative; height: 66pt; background: linear-gradient(to top right, #d9d9d9 calc(50% - 0.4pt), #000 50%, #d9d9d9 calc(50% + 0.4pt)); }
.cs .diag .a { position: absolute; right: 5pt; top: 6pt; }
.cs .diag .b { position: absolute; left: 4pt; bottom: 6pt; }
.cs td { font-size: 10.8pt; padding: 7pt 8pt; line-height: 1.75; }
.cs .cat { width: 41pt; text-align: center; font-weight: 700; line-height: 1.3; }
.cs.act .cat { width: 70pt; }

/* 성취기준 */
.std-box { border: 0.6pt dotted #000; padding: 4pt 5pt; font-size: 10pt; line-height: 1.75; margin-bottom: 16pt; }
.std-box div { padding-left: 74pt; text-indent: -74pt; }
.std-tbl { font-size: 10pt; border-top: 1.08pt solid #000; border-bottom: 1.08pt solid #000; }
.std-tbl td { padding: 4pt 6pt; line-height: 1.6; }
.std-tbl .code { width: 59pt; background: #f2f2f2; text-align: center; white-space: nowrap; font-size: 9.5pt; }

/* 단원 지도계획 */
.plan { font-size: 9pt; }
.plan thead th { background: #f2f2f2; font-size: 11pt; font-weight: 700; height: 31pt; }
.plan .unit { font-weight: 700; font-size: 10pt; text-align: center; line-height: 1.7; }
.plan .std { text-align: center; line-height: 1.85; }
.plan .lab { text-align: center; font-size: 10pt; }
.plan .topic { text-align: center; font-size: 9.5pt; line-height: 1.6; }
.plan .content { font-size: 9pt; line-height: 1.55; }
.plan .content .g { font-weight: 700; font-size: 10pt; padding-left: 9pt; text-indent: -9pt; }
.plan .content .a { padding-left: 9pt; text-indent: -7pt; }
.assess { border: 0.6pt dotted #000; margin: 3pt 0 1pt; padding: 2pt 4pt; font-size: 10pt; line-height: 1.6; text-align: right; }
.assess .lab { float: left; background: #ffe7d8; font-size: 9.7pt; }
.plan .note { text-align: center; font-size: 9pt; }

/* 평가 계획 */
.ev { font-size: 10pt; }
.ev thead th { background: #f2f2f2; font-size: 11pt; font-weight: 700; line-height: 1.25; }
.ev .std { font-size: 9pt; text-align: center; line-height: 1.85; }
.ev .focus { font-size: 10pt; line-height: 1.85; }
.ev .lv { text-align: center; font-size: 9.5pt; width: 29pt; }
.ev .lvt { font-size: 9.5pt; line-height: 1.5; }
.ev .m { text-align: center; line-height: 1.9; }

/* 계획서·신청서·체크리스트 (지침 서식) */
.form-tag { font-size: 9pt; margin-bottom: 4pt; }
.form-title { text-align: center; font-size: 16pt; font-weight: 700; letter-spacing: 1pt; border: 0.6pt solid #000; padding: 6pt; margin-bottom: 8pt; }
.form { font-size: 9pt; line-height: 1.38; border-top: 1.08pt solid #000; border-bottom: 1.08pt solid #000; }
.form th { background: #f2f2f2; font-weight: 700; text-align: center; white-space: nowrap; }
.form td { line-height: 1.38; padding: 2pt 5pt; }
.form th { padding: 2.5pt 3pt; }
.form .chk { display: inline-block; margin-right: 8pt; white-space: nowrap; }
.sign { text-align: center; font-size: 10.5pt; line-height: 1.6; margin-top: 10pt; }
.sign .stamp { text-align: right; font-weight: 700; margin-top: 10pt; }
.sign .to { text-align: left; font-weight: 700; font-size: 12pt; margin-top: 10pt; }
.attach { font-size: 10pt; margin-top: 8pt; line-height: 1.6; }
.cl { font-size: 10pt; border-top: 1.08pt solid #000; border-bottom: 1.08pt solid #000; }
.cl th { background: #f2f2f2; font-weight: 700; }
.cl .area { text-align: center; font-weight: 700; width: 70pt; background: #f2f2f2; }
.cl .ok { text-align: center; width: 48pt; }
`;

// ───────────── 계획서(서식1) / 신청서(서식3) ─────────────
function applicationForm(doc: DesignDoc): string {
  const subject = doc.basic.type === "subject";
  const a = doc.application;
  const t = applicationTexts(doc);
  const groups = SUBJECT_GROUPS.map((g) => box(g === doc.basic.subjectGroup, g)).join("");
  const textbooks = TEXTBOOK_TYPES[doc.basic.type].map((x) => box(a.textbookType === x, x)).join("");
  const teachers = TEACHER_PLANS.map((x) => `<div>${box(a.teacherPlans.includes(x), x)}</div>`).join("");
  const rows: string[] = [];
  if (subject) {
    rows.push(
      `<tr><th colspan="2">학교명(기관명)</th><td>${esc(schoolOf(doc))}</td><th>설립 구분</th><td>${["국립", "공립", "사립", "기관"].map((x) => box(a.establishment === x, x)).join("")}</td></tr>`,
      `<tr><th colspan="2">과목명</th><td colspan="3">한글명: ${esc(doc.basic.name)}<br>영문명: ${esc(a.englishName)}</td></tr>`,
    );
  } else {
    rows.push(`<tr><th colspan="2">활동명</th><td colspan="3">${esc(doc.basic.name)}</td></tr>`);
  }
  rows.push(
    `<tr><th colspan="2">편성<br>교과(군)</th><td colspan="3">${groups}</td></tr>`,
    `<tr><th colspan="2">지도 대상/학기</th><td>( ${doc.basic.grade} 학년) / ( ${doc.basic.semester} 학기)</td><th>운영 시수</th><td class="center">${doc.basic.hours} 시간</td></tr>`,
    `<tr><th rowspan="3">${kindOf(doc)}</th><th>개설<br>필요성</th><td colspan="3">${br(t.necessity)}</td></tr>`,
    `<tr><th>목표</th><td colspan="3">${br(t.goal)}</td></tr>`,
    `<tr><th>내용</th><td colspan="3">${br(t.content)}</td></tr>`,
    `<tr><th rowspan="2">교재<br>활용<br>계획</th><th>구분</th><td colspan="3">${textbooks}</td></tr>`,
    `<tr><th>교재/자료명</th><td colspan="3">${esc(a.textbookName)}</td></tr>`,
    `<tr><th colspan="2">관련 교육과정</th><td colspan="3">2022 개정 교육과정</td></tr>`,
    `<tr><th colspan="2">적용 기간</th><td colspan="3">${esc(a.startYear || "○○○○")}학년도부터 (해당 교육과정 종료시) 까지</td></tr>`,
    `<tr><th colspan="2">지도교사<br>확보방안</th><td colspan="3">${teachers}</td></tr>`,
    `<tr><th colspan="2">기타 특이사항</th><td colspan="3">${br(a.etc)}</td></tr>`,
  );
  return `<section class="sheet">
  <div class="form-tag">${subject ? "[서식3]" : "[서식1]"}</div>
  <div class="form-title">${subject ? "고시 외 과목 신설 승인 신청서【초등학교용】" : "학교자율시간 활동 계획서"}</div>
  <table class="form"><colgroup><col style="width:11%"><col style="width:13%"><col><col style="width:12%"><col style="width:27%"></colgroup>${rows.join("")}</table>
  <div class="sign keep">
    <p class="center">${subject ? "위와 같이 과목을 개설･운영하고자 하오니 승인하여 주시기 바랍니다." : "학교자율시간 설계･운영 지침에 의거, 위와 같이 활동을 계획하여 운영하고자 합니다."}</p>
    <div class="attach" style="text-align:left">붙임 1. (${esc(doc.basic.name)}) ${subject ? "교육과정" : "활동 세부 지도계획안"} 1부.<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;2. (${doc.basic.grade})학년 교육과정 편성표 1부.</div>
    <p class="center" style="margin-top:8pt">년&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;월&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;일</p>
    <div class="stamp">${esc(schoolOf(doc))}장&nbsp;&nbsp;${subject ? "(직인)" : "(직인 생략)"}</div>
    <div class="to">${subject ? "전남광주통합특별시교육감 귀하" : `${esc(schoolOf(doc))}운영위원장 귀하`}</div>
  </div>
</section>`;
}

// ───────────── 교육과정 문서(서식2 / 서식4) — 예시안 모양 ─────────────
function ideasTable(doc: DesignDoc): string {
  const ideas = doc.coreIdeas.filter((s) => s.trim());
  return `<table class="ideas"><tr><th>핵심아이디어</th></tr><tr><td>${ideas.map((s) => `<div>·${esc(s)}</div>`).join("")}</td></tr></table>`;
}

function contentTable(doc: DesignDoc): string {
  const subject = doc.basic.type === "subject";
  const n = Math.max(1, doc.areas.length);
  const items = (xs: string[]) =>
    xs
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => `<div>·${esc(s)}</div>`)
      .join("");
  const label = (s: string) => (subject ? s.split("·").map(esc).join("<br>‧<br>") : esc(s));
  const head = subject
    ? `<tr><th class="diag cat" rowspan="2"><span class="a">영역</span><span class="b">범주</span></th><th colspan="${n}">내용 요소</th></tr>`
    : `<tr><th class="cat" rowspan="2">범주</th><th colspan="${n}">내용 요소</th></tr>`;
  const cats = [
    ["지식·이해", "knowledge"],
    ["과정·기능", "process"],
    ["가치·태도", "values"],
  ] as const;
  return `<table class="cs ${subject ? "sub" : "act"}">
  ${head}
  <tr>${doc.areas.map((a, i) => `<th>(${i + 1}) ${esc(a.name)}</th>`).join("")}</tr>
  ${cats.map(([lab, key]) => `<tr><th class="cat">${label(lab)}</th>${doc.areas.map((a) => `<td>${items(a[key])}</td>`).join("")}</tr>`).join("")}
</table>`;
}

function standardsBlock(doc: DesignDoc): string {
  const codes = codeMap(doc);
  if (doc.basic.type === "subject") {
    return doc.areas
      .map((a, i) => {
        const list = doc.standards.filter((s) => s.areaIndex === i);
        return `<div class="keep"><div class="h3">(${i + 1}) ${esc(a.name)}</div><div class="std-box hcr">${list
          .map((s) => `<div>${esc(codes.get(s.id) ?? "")} ${esc(s.text)}</div>`)
          .join("")}</div></div>`;
      })
      .join("");
  }
  return `<table class="std-tbl hcr keep">${doc.standards
    .map((s) => `<tr><td class="code">${esc(codes.get(s.id) ?? "")}</td><td>${esc(s.text)}</td></tr>`)
    .join("")}</table>`;
}

function standardCell(doc: DesignDoc, ids: string[]): string {
  const codes = codeMap(doc);
  return ids
    .map((id) => {
      const s = doc.standards.find((x) => x.id === id);
      return s ? `${esc(codes.get(id) ?? "")}<br>${esc(s.text)}` : "";
    })
    .filter(Boolean)
    .join("<br><br>");
}

function unitPlanTable(doc: DesignDoc): string {
  const plan = doc.plan.selected;
  if (!plan) return `<p>(단원 지도계획을 아직 정하지 않았습니다.)</p>`;
  const labels = lessonLabels(plan.units, doc.basic.hours);
  const rows = plan.units.flatMap((u, ui) =>
    u.lessons.map((l, li) => {
      const content = [
        `<div class="g">· ${esc(l.goal)}</div>`,
        ...l.activities.filter((x) => x.trim()).map((x) => `<div class="a">- ${esc(x)}</div>`),
        ...(l.assessment.trim() ? [`<div class="assess"><span class="lab">[과정중심평가]</span> ${esc(l.assessment)}</div>`] : []),
      ].join("");
      const first =
        li === 0
          ? `<td class="unit" rowspan="${u.lessons.length}">${ui + 1}단원<br>${esc(u.unitName)}</td><td class="std" rowspan="${u.lessons.length}">${standardCell(doc, u.standardIds)}</td>`
          : "";
      return `<tr${li === 0 ? ' class="span-start"' : ""}>${first}<td class="lab">${esc(labels[ui]?.[li] ?? "")}</td><td class="topic">${esc(l.topic)}</td><td class="content">${content}</td><td class="note">${br(l.note)}</td></tr>`;
    }),
  );
  return `<table class="grid plan">
  <colgroup><col style="width:8.7%"><col style="width:14.9%"><col style="width:8.7%"><col style="width:11.3%"><col><col style="width:9.3%"></colgroup>
  <thead><tr><th>단원명</th><th>성취기준</th><th>차시</th><th>학습주제</th><th>학습 내용</th><th>비고</th></tr></thead>
  <tbody>${rows.join("")}</tbody></table>`;
}

function assessmentTable(doc: DesignDoc): string {
  const subject = doc.basic.type === "subject";
  const rows = doc.assessments.flatMap((a) =>
    (["A", "B", "C"] as const).map((lv, k) => {
      const first =
        k === 0
          ? `<td class="center" rowspan="3">${esc(a.month)}</td><td class="std" rowspan="3">${standardCell(doc, a.standardIds)}</td><td class="focus" rowspan="3">${br(a.focus)}</td>`
          : "";
      const last = k === 0 ? `<td class="m" rowspan="3">${a.methods.map(esc).join("<br>")}</td>` : "";
      return `<tr${k === 0 ? ' class="span-start"' : ""}>${first}<td class="lv">${lv}</td><td class="lvt">${esc(a.levels[lv])}</td>${last}</tr>`;
    }),
  );
  return `<table class="grid ev">
  <colgroup><col style="width:9.3%"><col style="width:16%"><col style="width:22.8%"><col style="width:6.4%"><col><col style="width:10.6%"></colgroup>
  <thead><tr><th>시기</th><th>성취기준</th><th>수업·평가 방법,<br>연계의 주안점</th><th colspan="2">${subject ? "성취수준" : "평가 기준"}</th><th>방법</th></tr></thead>
  <tbody>${rows.join("")}</tbody></table>`;
}

const numbered = (items: string[]) =>
  items
    .filter((s) => s.trim())
    .map((s, i) => `<p class="num wide">(${i + 1}) ${esc(s)}</p>`)
    .join("");

function curriculumDoc(doc: DesignDoc): string {
  const subject = doc.basic.type === "subject";
  const head = `<div class="banner"><div class="t">「${esc(doc.basic.name)}」</div>${subject ? `<div class="badge">${esc(doc.basic.openingType.replace(/\s/g, ""))}</div>` : ""}</div>
  <div class="subtitle"><span>학교자율시간 [${kindOf(doc)}]</span><span>${esc(schoolOf(doc))} ${doc.basic.grade}학년 ${doc.basic.semester}학기</span></div>`;
  const rationale = paras(doc.intro.rationale)
    .map((s) => `<p class="indent">${esc(s)}</p>`)
    .join("");
  const goals = doc.intro.detailGoals.filter((g) => g.trim());
  let n = 1;
  const parts: string[] = [head];
  if (subject) {
    parts.push(`<div class="section"><div class="h1">${n++}. 성격</div>${rationale}</div>`);
    parts.push(
      `<div class="section keep"><div class="h1">${n++}. 목표</div><p>${esc(doc.intro.overallGoal)}</p><div class="goal">${goals
        .map((g, i) => `<p class="num">(${i + 1}) ${esc(g)}</p>`)
        .join("")}</div></div>`,
    );
  } else {
    parts.push(
      `<div class="section"><div class="h1">${n++}. 필요성 및 목표</div>${rationale}<div class="keep" style="margin-top:12pt"><p class="indent">${esc(doc.intro.overallGoal)}</p>${goals
        .map((g) => `<p>·${esc(g)}</p>`)
        .join("")}</div></div>`,
    );
  }
  parts.push(`<div class="section"><div class="h1">${n++}. 내용 체계</div><div class="keep">${ideasTable(doc)}${contentTable(doc)}</div></div>`);
  parts.push(`<div class="section"><div class="h1">${n++}. 성취기준</div>${standardsBlock(doc)}</div>`);
  if (subject) {
    const t = doc.teaching;
    // 예시안처럼 큰 제목 5·6과 두 표(단원 지도 계획, 평가 계획)는 새 쪽에서 시작
    parts.push(
      `<div class="section pb"><div class="h1">${n++}. 교수‧학습 방향 및 방법</div>
      <div class="h2">가. 교수·학습의 방향</div>${numbered(t.teachingDirection)}
      <div class="h2 list-gap">나. 교수·학습의 방법</div>${numbered(t.teachingMethods)}
      <div class="h2 pb">다. 단원 지도 계획</div>${unitPlanTable(doc)}</div>`,
    );
    parts.push(
      `<div class="section pb"><div class="h1">${n++}. 평가 방향 및 방법</div>
      <div class="h2">가. 평가의 방향</div>${numbered(t.assessDirection)}
      <div class="h2 list-gap">나. 평가의 방법</div>${numbered(t.assessMethods)}
      <div class="h2 pb">다. 평가 계획</div>${assessmentTable(doc)}</div>`,
    );
  } else {
    parts.push(
      `<div class="section"><div class="h1">${n++}. 지도의 실제</div>
      <div class="h2">가. 단원 지도계획</div>${unitPlanTable(doc)}
      <div class="h2 pb">나. 평가 계획</div>${assessmentTable(doc)}</div>`,
    );
  }
  return `<section class="sheet">${parts.join("\n")}</section>`;
}

// ───────────── 체크리스트(서식6 / 서식7) ─────────────
function checklistDoc(doc: DesignDoc): string {
  const subject = doc.basic.type === "subject";
  const results = checklistResults(doc);
  const areas = [...new Set(results.map((r) => r.area))];
  const rows = areas.flatMap((area) => {
    const items = results.filter((r) => r.area === area);
    return items.map(
      (r, i) => `<tr>${i === 0 ? `<td class="area" rowspan="${items.length}">${esc(area)}</td>` : ""}<td>∘ ${esc(r.label)}</td><td class="ok">${r.ok ? "○" : "X"}</td></tr>`,
    );
  });
  return `<section class="sheet">
  <div class="form-tag">${subject ? "[서식7]" : "[서식6]"}</div>
  <div class="form-title">학교자율시간 「${kindOf(doc)}」 개설 체크리스트</div>
  <p style="font-size:10.5pt;margin-bottom:8pt">${kindOf(doc)}명: ${esc(doc.basic.name)} (${doc.basic.grade}학년 ${doc.basic.semester}학기, ${doc.basic.hours}시간)</p>
  <table class="cl"><thead><tr><th>영역</th><th>평가 지표</th><th>검토 결과<br>(○, X)</th></tr></thead><tbody>${rows.join("")}</tbody></table>
</section>`;
}

/** 인쇄 창에 그대로 쓸 수 있는 HTML 문서 전체 */
export function buildPrintHtml(doc: DesignDoc): string {
  const forms = doc.basic.type === "subject" ? "[서식3] 신청서 + [서식4] 과목 교육과정 + [서식7] 체크리스트" : "[서식1] 활동 계획서 + [서식2] 활동 교육과정 + [서식6] 체크리스트";
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(printFileTitle(doc))}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Nanum+Gothic:wght@400;700&family=Nanum+Myeongjo:wght@400;700&display=swap" rel="stylesheet">
<style>${CSS}</style></head>
<body>
<div class="toolbar"><span>${esc(forms)} · 인쇄 창의 <b>대상(프린터)</b>에서 <b>'PDF로 저장'</b>을 고르면 PDF 파일로 저장돼요. (용지 A4, 배율 100%, 머리글·바닥글 끄기)</span><button type="button" onclick="window.print()">인쇄 / PDF로 저장</button></div>
${applicationForm(doc)}
${curriculumDoc(doc)}
${checklistDoc(doc)}
<script>window.addEventListener("load",function(){(document.fonts?document.fonts.ready:Promise.resolve()).then(function(){setTimeout(function(){window.print()},300)})});</script>
</body></html>`;
}

export function printFileTitle(doc: DesignDoc): string {
  return `${doc.basic.name || "이름없음"}_학교자율시간_${kindOf(doc)}_${doc.basic.grade}학년${doc.basic.semester}학기`;
}
