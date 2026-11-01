"use client";

import { useState } from "react";
import { SearchIcon } from "./icons";

/**
 * 검색 입력칸 + 오른쪽 돋보기 버튼. 돋보기를 누르거나 Enter를 치면 검색한다.
 * 글을 모두 지우면 바로 전체 목록으로 돌아간다. (사용자 결정, 2026-11-01)
 */
export function SearchBox({ value, onSearch, placeholder, className = "w-56" }: { value: string; onSearch: (q: string) => void; placeholder: string; className?: string }) {
  const [draft, setDraft] = useState(value);
  return (
    <form
      role="search"
      className={`flex items-center overflow-hidden rounded-lg border border-gray-300 bg-white focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100 ${className}`}
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(draft.trim());
      }}
    >
      <input
        className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none"
        placeholder={placeholder}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          if (!e.target.value.trim()) onSearch("");
        }}
      />
      <button type="submit" title="검색" aria-label="검색" className="flex self-stretch items-center px-2.5 text-gray-500 transition-colors hover:bg-brand-100 hover:text-brand-700">
        <SearchIcon />
      </button>
    </form>
  );
}
