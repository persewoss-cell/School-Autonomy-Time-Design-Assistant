import { it } from "vitest";
import fs from "fs";
import { Packer } from "docx";
import { sampleSubject } from "@/domain/sample";
import { buildDesignDocx } from "@/export/docx";
it("gen", async () => {
  const subj = sampleSubject();
  fs.writeFileSync("/tmp/claude-0/-home-user-School-Autonomy-Time-Design-Assistant/b6a15a78-bd13-5167-b7c7-dba37fe002e4/scratchpad/lay-subj.docx", await Packer.toBuffer(buildDesignDocx(subj, { pending: true, grade: 3 })));
  const act = sampleSubject();
  act.basic.type = "activity";
  fs.writeFileSync("/tmp/claude-0/-home-user-School-Autonomy-Time-Design-Assistant/b6a15a78-bd13-5167-b7c7-dba37fe002e4/scratchpad/lay-act.docx", await Packer.toBuffer(buildDesignDocx(act, { pending: true, grade: 3 })));
});
