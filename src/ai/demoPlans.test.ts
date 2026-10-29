import { describe, expect, it } from "vitest";
import { makeDemoPlans } from "./demoPlans";
import { totalLessonHours } from "@/validation/hours";
import type { BasicInfo } from "@/domain/types";

const basic: BasicInfo = {
  type: "activity",
  name: "테스트",
  grade: 5,
  semester: 1,
  hours: 32,
  subjectGroup: "사회",
  openingType: "지역 연계형",
  operationMode: "지속형",
};

describe("makeDemoPlans", () => {
  it("3안을 만들고 각 안의 차시 합계가 운영 시수와 같다", () => {
    for (const hours of [10, 17, 29, 32]) {
      const plans = makeDemoPlans({ ...basic, hours }, {
        topic: "생태",
        requiredContents: [],
        desiredActivities: [],
        schoolContext: "",
        resources: "",
      });
      expect(plans).toHaveLength(3);
      for (const p of plans) expect(totalLessonHours(p.units)).toBe(hours);
    }
  });
});
