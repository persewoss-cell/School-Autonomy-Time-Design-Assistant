"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { REGION_VALUES } from "@/domain/regions";
import { Card, Field, inputClass } from "../ui";
import { useMe } from "../useMe";


/** 계정은 학교 단위(한 학교당 1개). 가입: 지역 → 학교명 → 비밀번호·확인. 로그인: 학교명 + 비밀번호. */
export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const me = useMe();
  const [form, setForm] = useState({ region: "", schoolName: "", password: "", passwordConfirm: "" });
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signup" && form.password !== form.passwordConfirm) {
      setError("비밀번호와 비밀번호 확인이 서로 다릅니다.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (mode === "login") {
        const r = await api<{ user: { mustChangePassword: boolean } }>("/api/auth/login", {
          method: "POST",
          body: { schoolName: form.schoolName, password: form.password },
        });
        // 로그인 뒤 돌아갈 곳 (?next=/hours 등, 앱 안 주소만)
        const next = new URLSearchParams(window.location.search).get("next");
        const back = next && next.startsWith("/") && !next.startsWith("//") ? next : "/designs";
        window.location.href = r.user.mustChangePassword ? "/account/password?first=1" : back;
      } else {
        const r = await api<{ user: { status: string } }>("/api/auth/signup", { method: "POST", body: form });
        if (r.user.status === "active") window.location.href = "/designs";
        else setDone("가입 신청이 완료되었습니다. 관리자가 확인하고 승인하면 학교명과 비밀번호로 로그인할 수 있어요.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "처리하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  if (me && !me.enabled) {
    return (
      <Card className="mx-auto max-w-md space-y-2">
        <h1 className="text-xl font-bold">{mode === "login" ? "로그인" : "회원가입"}</h1>
        <p className="text-sm text-gray-600">저장·로그인 기능이 아직 설정되지 않았습니다. 설계와 문서 내려받기는 로그인 없이도 쓸 수 있어요.</p>
        <Link href="/status" className="text-sm font-semibold text-brand-600 underline">설정 확인 화면으로</Link>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <Card>
        <form onSubmit={submit} className="space-y-4">
          <h1 className="text-xl font-bold">{mode === "login" ? "로그인" : "회원가입 신청"}</h1>
          {mode === "signup" && (
            <p className="text-sm text-gray-600">계정은 <b>학교당 1개</b>입니다. 가입 신청 후 관리자가 승인하면 사용할 수 있어요.</p>
          )}
          {done ? (
            <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{done}</p>
          ) : (
            <>
              {mode === "signup" && (
                <Field label="지역 (시·군·구)">
                  <select required className={inputClass} value={form.region} onChange={set("region")}>
                    <option value="" disabled>
                      지역을 고르세요
                    </option>
                    {REGION_VALUES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="학교명" hint={mode === "signup" ? "정식 명칭으로 입력하세요. 예: 광양중동초등학교 (○○초 X)" : "가입할 때 입력한 정식 명칭"}>
                <input required autoComplete="username" className={inputClass} value={form.schoolName} placeholder="○○초등학교" onChange={set("schoolName")} />
              </Field>
              <Field label="비밀번호" hint={mode === "signup" ? "8자 이상" : undefined}>
                <input
                  type="password"
                  required
                  minLength={mode === "signup" ? 8 : 1}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className={inputClass}
                  value={form.password}
                  onChange={set("password")}
                />
              </Field>
              {mode === "signup" && (
                <Field label="비밀번호 확인">
                  <input type="password" required autoComplete="new-password" className={inputClass} value={form.passwordConfirm} onChange={set("passwordConfirm")} />
                  {form.passwordConfirm && form.password !== form.passwordConfirm && (
                    <span className="block text-xs text-red-600">비밀번호가 서로 다릅니다.</span>
                  )}
                </Field>
              )}
              {mode === "signup" && <p className="text-xs text-gray-500">학생 개인정보는 입력받거나 저장하지 않습니다.</p>}
              {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
              <button type="submit" disabled={busy} className="w-full rounded-lg bg-brand-600 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:bg-gray-300">
                {busy ? "처리 중…" : mode === "login" ? "로그인" : "가입 신청"}
              </button>
              <p className="text-center text-sm text-gray-500">
                {mode === "login" ? (
                  <>
                    아직 가입하지 않은 학교인가요? <Link href="/signup" className="font-semibold text-brand-600">회원가입</Link>
                  </>
                ) : (
                  <>
                    이미 가입한 학교인가요? <Link href="/login" className="font-semibold text-brand-600">로그인</Link>
                  </>
                )}
              </p>
            </>
          )}
        </form>
      </Card>
      {mode === "login" && <ResetRequest />}
    </div>
  );
}

/** 로그인 화면 아래: 비밀번호를 잊은 학교의 재설정 신청 */
function ResetRequest() {
  const [open, setOpen] = useState(false);
  const [schoolName, setSchoolName] = useState("");
  const [contact, setContact] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/auth/reset-request", { method: "POST", body: { schoolName, contact } });
      setMsg({ ok: true, text: "관리자에게 비밀번호 재설정을 신청했습니다. 관리자가 확인한 뒤 적어 주신 연락처로 임시 비밀번호를 알려 드려요." });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "신청하지 못했습니다." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-3">
      <p className="text-sm text-gray-700">비밀번호를 잊으셨나요?</p>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-brand-500 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50">
          관리자에게 비밀번호 재설정 신청하기
        </button>
      ) : msg?.ok ? (
        <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{msg.text}</p>
      ) : (
        <form onSubmit={send} className="space-y-3">
          <Field label="학교명">
            <input required className={inputClass} value={schoolName} placeholder="○○초등학교" onChange={(e) => setSchoolName(e.target.value)} />
          </Field>
          <Field label="임시 비밀번호를 받을 연락처" hint="예: 교무실 전화번호 (학생 정보는 적지 마세요)">
            <input required className={inputClass} value={contact} onChange={(e) => setContact(e.target.value)} />
          </Field>
          {msg && !msg.ok && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{msg.text}</p>}
          <button type="submit" disabled={busy} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:bg-gray-300">
            {busy ? "보내는 중…" : "재설정 신청 보내기"}
          </button>
        </form>
      )}
    </Card>
  );
}
