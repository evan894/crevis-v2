"use client";

import { useRef } from "react";

export function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const digits = value.split("").concat(Array(6).fill("")).slice(0, 6);
  const refs = Array.from({ length: 6 }, () => useRef<HTMLInputElement>(null)); // eslint-disable-line react-hooks/rules-of-hooks

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (digits[i] === "" && i > 0) refs[i - 1].current?.focus();
      const next = [...digits];
      next[i] = "";
      onChange(next.join(""));
    }
  };

  const handleChange = (i: number, v: string) => {
    const ch = v.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = ch;
    onChange(next.join(""));
    if (ch && i < 5) refs[i + 1].current?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    onChange(text.padEnd(6, "").slice(0, 6));
    e.preventDefault();
  };

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={refs[i]}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKey(i, e)}
          className={`w-11 h-14 text-center text-2xl font-jetbrains-mono font-bold rounded-xl border-2 bg-surface outline-none transition-all ${
            d ? "border-saffron text-saffron" : "border-border text-ink"
          } focus:border-saffron focus:shadow-[0_0_0_3px_rgba(244,99,30,0.12)]`}
        />
      ))}
    </div>
  );
}
