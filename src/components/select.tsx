"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

export type SelectOption = { value: string; label: string; disabled?: boolean };

/**
 * Styled replacement for <select>: a select-only combobox with a custom listbox.
 * Submits its value through a hidden input, so it works in plain <form>s and server actions.
 */
export function Select({
  options,
  name,
  id,
  value: controlled,
  defaultValue,
  onChange,
  placeholder = "Choose…",
  required,
  className = "",
  "aria-label": ariaLabel,
}: {
  options: SelectOption[];
  name?: string;
  id?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const [inner, setInner] = useState(defaultValue ?? "");
  const value = controlled ?? inner;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const autoId = useId();
  const listId = `${autoId}-list`;
  const selected = options.find((o) => o.value === value);
  const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  // Keep the active option visible by scrolling the list only (scrollIntoView would also scroll the page).
  useEffect(() => {
    const l = list.current;
    const el = l?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    if (!open || !l || !el) return;
    if (el.offsetTop < l.scrollTop) l.scrollTop = el.offsetTop - 6;
    else if (el.offsetTop + el.offsetHeight > l.scrollTop + l.clientHeight) l.scrollTop = el.offsetTop + el.offsetHeight - l.clientHeight + 6;
  }, [open, active]);

  function show() {
    const i = options.findIndex((o) => o.value === value);
    setActive(i >= 0 && !options[i].disabled ? i : (enabled[0] ?? 0));
    setOpen(true);
  }

  function choose(i: number) {
    const o = options[i];
    if (!o || o.disabled) return;
    if (controlled === undefined) setInner(o.value);
    onChange?.(o.value);
    setOpen(false);
  }

  function move(step: number) {
    const pos = enabled.indexOf(active);
    const next = enabled[Math.min(enabled.length - 1, Math.max(0, (pos < 0 ? 0 : pos) + step))];
    if (next !== undefined) setActive(next);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Tab") return setOpen(false);
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        show();
      }
      return;
    }
    if (e.key === "ArrowDown") move(1);
    else if (e.key === "ArrowUp") move(-1);
    else if (e.key === "Home") setActive(enabled[0] ?? 0);
    else if (e.key === "End") setActive(enabled[enabled.length - 1] ?? 0);
    else if (e.key === "Enter" || e.key === " ") choose(active);
    else if (e.key === "Escape") setOpen(false);
    else if (e.key.length === 1) {
      // Type-ahead: jump to the first option starting with the typed letters.
      const now = Date.now();
      typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : "") + e.key.toLowerCase(), at: now };
      const hit = enabled.find((i) => options[i].label.toLowerCase().startsWith(typed.current.text));
      if (hit !== undefined) setActive(hit);
      return;
    } else return;
    e.preventDefault();
  }

  return (
    <div ref={root} className={`relative rounded-[12px] ${className}`}>
      <button
        type="button"
        id={id}
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${autoId}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        className={`input flex items-center justify-between gap-2 !pr-3 text-left !rounded-[inherit] ${open ? "!border-accent ring-2 ring-accent/20" : ""}`}
      >
        <span className={`truncate ${selected ? "" : "text-muted"}`}>{selected?.label ?? placeholder}</span>
        <svg aria-hidden viewBox="0 0 16 16" className={`size-4 shrink-0 text-muted transition-transform duration-150 ${open ? "rotate-180" : ""}`}>
          <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {name && (
        // Carries the value in form submissions; `required` still triggers native validation.
        <input
          tabIndex={-1}
          aria-hidden
          name={name}
          value={value}
          required={required}
          onChange={() => {}}
          onFocus={() => root.current?.querySelector("button")?.focus()}
          className="pointer-events-none absolute bottom-0 left-1/2 h-px w-px opacity-0"
        />
      )}
      {open && (
        <ul
          ref={list}
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute top-full right-0 left-0 z-40 mt-1.5 max-h-64 min-w-max overflow-auto rounded-[16px] border border-line bg-surface p-1.5 shadow-[0_16px_40px_-12px_rgba(24,24,27,0.28)]"
        >
          {options.map((o, i) => (
            <li
              key={o.value}
              id={`${autoId}-${i}`}
              data-index={i}
              role="option"
              aria-selected={o.value === value}
              aria-disabled={o.disabled || undefined}
              onMouseEnter={() => !o.disabled && setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(i)}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-sm ${
                o.disabled ? "cursor-default text-muted/60" : i === active ? "bg-surface-2" : ""
              } ${o.value === value ? "font-medium" : ""}`}
            >
              {o.label}
              {o.value === value && (
                <svg aria-hidden viewBox="0 0 16 16" className="size-4 shrink-0 text-accent">
                  <path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
