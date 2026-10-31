"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { DesignDoc } from "@/domain/types";
import type { DesignContext } from "@/validation/design";
import { sameSemesterOthers } from "@/validation/hours";

export interface SavedDesign {
  id: string;
  name: string;
  type: "subject" | "activity";
  grade: number;
  semester: number;
  hours?: number;
  schoolYear?: string;
}

// 여러 화면이 한꺼번에 부르므로 잠깐(10초) 같은 결과를 함께 쓴다
let cache: { at: number; list: Promise<SavedDesign[]> } | null = null;
function loadSaved(): Promise<SavedDesign[]> {
  if (!cache || Date.now() - cache.at > 10_000) {
    cache = {
      at: Date.now(),
      list: api<{ designs: SavedDesign[] }>("/api/designs")
        .then((r) => r.designs)
        .catch(() => []),
    };
  }
  return cache.list;
}

/** 로그인했으면 우리 학교가 저장한 설계 목록 (아니면 빈 목록) */
export function useSavedDesigns(): SavedDesign[] {
  const [list, setList] = useState<SavedDesign[]>([]);
  useEffect(() => {
    let alive = true;
    void loadSaved().then((l) => alive && setList(l));
    return () => {
      alive = false;
    };
  }, []);
  return list;
}

/** 검사에 쓰는 '같은 학기의 다른 설계' (운영 시수 경고를 학기 합계로 판단) */
export function useDesignContext(doc: Pick<DesignDoc, "basic" | "application">, designId?: string): DesignContext {
  const saved = useSavedDesigns();
  const { grade, semester } = doc.basic;
  const year = doc.application.startYear;
  return useMemo(() => ({ semesterOthers: sameSemesterOthers({ id: designId, grade, semester, schoolYear: year }, saved) }), [saved, designId, grade, semester, year]);
}
