"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { Card, Field, inputClass } from "../ui";
import { useMe } from "../useMe";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const me = useMe();
  const [form, setForm] = useState({ email: "", password: "", name: "", schoolName: "" });
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "login") {
        await api("/api/auth/login", { method: "POST", body: { email: form.email, password: form.password } });
        window.location.href = "/designs";
      } else {
        const r = await api<{ user: { status: string } }>("/api/auth/signup", { method: "POST", body: form });
        if (r.user.status === "active") window.location.href = "/designs";
        else setDone("가입 신청이 완료되었습니다. 관리자가 승인하면 로그인할 수 있어요.");
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
        <p className="text-sm text-gray-600">
          저장·로그인 기능이 아직 설정되지 않았습니다. 설계와 문서 내려받기는 로그인 없이도 쓸 수 있어요.
        </p>
        <Link href="/status" className="text-sm font-semibold text-brand-600 underline">설정 확인 화면으로</Link>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-md">
      <form onSubmit={submit} className="space-y-4">
        <h1 className="text-xl font-bold">{mode === "login" ? "로그인" : "회원가입"}</h1>
        {done ? (
          <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{done}</p>
        ) : (
          <>
            <Field label="이메일">
              <input type="email" required autoComplete="email" className={inputClass} value={form.email} onChange={set("email")} />
            </Field>
            <Field label="비밀번호" hint={mode === "signup" ? "8자 이상" : undefined}>
              <input type="password" required minLength={mode === "signup" ? 8 : 1} autoComplete={mode === "login" ? "current-password" : "new-password"} className={inputClass} value={form.password} onChange={set("password")} />
            </Field>
            {mode === "signup" && (
              <>
                <Field label="이름 (교사)">
                  <input required className={inputClass} value={form.name} onChange={set("name")} />
                </Field>
                <Field label="학교명" hint="같은 학교의 활동명 중복 확인에 쓰여요">
                  <input required className={inputClass} value={form.schoolName} placeholder="○○초등학교" onChange={set("schoolName")} />
                </Field>
                <p className="text-xs text-gray-500">학생 개인정보는 입력받거나 저장하지 않습니다. 가입 후 관리자 승인이 필요해요.</p>
              </>
            )}
            {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={busy} className="w-full rounded-lg bg-brand-600 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:bg-gray-300">
              {busy ? "처리 중…" : mode === "login" ? "로그인" : "가입 신청"}
            </button>
            <p className="text-center text-sm text-gray-500">
              {mode === "login" ? (
                <>계정이 없나요? <Link href="/signup" className="font-semibold text-brand-600">회원가입</Link></>
              ) : (
                <>이미 계정이 있나요? <Link href="/login" className="font-semibold text-brand-600">로그인</Link></>
              )}
            </p>
          </>
        )}
      </form>
    </Card>
  );
}
