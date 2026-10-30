"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { Card, Field, inputClass } from "../ui";
import { useMe } from "../useMe";

/** 비밀번호 바꾸기 (임시 비밀번호로 처음 로그인했을 때도 여기로 옴) */
export function ChangePassword({ first }: { first: boolean }) {
  const me = useMe();
  const [form, setForm] = useState({ current: "", password: "", passwordConfirm: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  if (me && !me.user) {
    return (
      <Card className="mx-auto max-w-md space-y-2">
        <p className="text-gray-600">로그인이 필요합니다.</p>
        <Link href="/login" className="font-semibold text-brand-600 underline">로그인</Link>
      </Card>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.passwordConfirm) return setMsg({ ok: false, text: "새 비밀번호와 비밀번호 확인이 서로 다릅니다." });
    setBusy(true);
    try {
      await api("/api/auth/password", { method: "POST", body: form });
      setMsg({ ok: true, text: "비밀번호를 바꿨습니다." });
      setForm({ current: "", password: "", passwordConfirm: "" });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "바꾸지 못했습니다." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mx-auto max-w-md">
      <form onSubmit={submit} className="space-y-4">
        <h1 className="text-xl font-bold">비밀번호 바꾸기</h1>
        {(first || me?.user?.mustChangePassword) && !msg?.ok && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">임시 비밀번호로 로그인했어요. 새 비밀번호로 바꿔 주세요.</p>
        )}
        <Field label={first ? "임시 비밀번호" : "지금 비밀번호"}>
          <input type="password" required autoComplete="current-password" className={inputClass} value={form.current} onChange={set("current")} />
        </Field>
        <Field label="새 비밀번호" hint="8자 이상">
          <input type="password" required minLength={8} autoComplete="new-password" className={inputClass} value={form.password} onChange={set("password")} />
        </Field>
        <Field label="새 비밀번호 확인">
          <input type="password" required autoComplete="new-password" className={inputClass} value={form.passwordConfirm} onChange={set("passwordConfirm")} />
        </Field>
        {msg && <p className={`rounded-lg p-3 text-sm ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
        {msg?.ok ? (
          <Link href="/designs" className="block rounded-lg bg-brand-600 py-2.5 text-center font-semibold text-white">설계 현황으로 가기</Link>
        ) : (
          <button type="submit" disabled={busy} className="w-full rounded-lg bg-brand-600 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:bg-gray-300">
            {busy ? "바꾸는 중…" : "비밀번호 바꾸기"}
          </button>
        )}
      </form>
    </Card>
  );
}
