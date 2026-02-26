

import React, { useEffect, useRef } from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
};

export function Composer({ value, onChange, onSend, disabled }: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (disabled) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  return (
    <div className="glass glow rounded-2xl border border-white/10 px-4 py-3 flex items-end gap-3">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Type a message…"
        className="w-full resize-none bg-transparent outline-none text-sm leading-6 max-h-44 min-h-11.5 placeholder:text-muted-foreground/70"
        rows={1}
        disabled={disabled}
      />

      <button
        type="button"
        onClick={onSend}
        disabled={disabled || !value.trim()}
        className="shrink-0 h-11 w-11 rounded-xl bg-purple-600/40 hover:bg-purple-600/55 border border-white/10 disabled:opacity-40 grid place-items-center transition"
        title="Send"
      >
        <span className="text-lg">➤</span>
      </button>
    </div>
  );
}