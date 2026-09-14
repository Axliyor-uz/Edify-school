"use client";

import { useState } from "react";
import { Delete, X } from "lucide-react";
import { Button, cn } from "@/components/student-ui";

/**
 * A basic four-function on-screen calculator for the SAT Math runner.
 *
 * ⚠️ Deliberately NOT the real Desmos graphing calculator the actual digital
 * SAT uses. Desmos's embeddable API requires an API key registered to this
 * domain under Desmos's own terms (desmos.com/api) — something only the
 * account owner can obtain, not something to embed with a placeholder key in
 * a real product. This is a safe, self-contained substitute that covers SAT
 * Math's arithmetic needs; swap it for the real Desmos embed once a key
 * exists (docs/SAT_QUIZ.md).
 *
 * Classic calculator state machine (current value + pending operator) — NOT a
 * string expression evaluator, so there is no `eval`/`Function` on anything
 * resembling user input.
 */

type Op = "+" | "−" | "×" | "÷" | null;

export default function SatCalculator({ onClose }: { onClose: () => void }) {
  const [display, setDisplay] = useState("0");
  const [stored, setStored] = useState<number | null>(null);
  const [op, setOp] = useState<Op>(null);
  const [fresh, setFresh] = useState(true);

  const inputDigit = (d: string) => {
    setDisplay((prev) => {
      if (fresh) return d === "." ? "0." : d;
      if (d === "." && prev.includes(".")) return prev;
      if (prev === "0" && d !== ".") return d;
      return prev + d;
    });
    setFresh(false);
  };

  const compute = (a: number, b: number, operator: Op): number => {
    switch (operator) {
      case "+": return a + b;
      case "−": return a - b;
      case "×": return a * b;
      case "÷": return b === 0 ? NaN : a / b;
      default: return b;
    }
  };

  const applyOp = (next: Op) => {
    const current = Number(display);
    if (stored !== null && op && !fresh) {
      const result = compute(stored, current, op);
      setDisplay(Number.isFinite(result) ? String(Math.round(result * 1e10) / 1e10) : "Error");
      setStored(Number.isFinite(result) ? result : null);
    } else {
      setStored(current);
    }
    setOp(next);
    setFresh(true);
  };

  const equals = () => { applyOp(null); setOp(null); };
  const clear = () => { setDisplay("0"); setStored(null); setOp(null); setFresh(true); };
  const toggleSign = () => setDisplay((prev) => (prev.startsWith("-") ? prev.slice(1) : prev === "0" ? prev : `-${prev}`));
  const percent = () => setDisplay((prev) => String(Number(prev) / 100));
  const sqrt = () => setDisplay((prev) => {
    const n = Number(prev);
    return n < 0 ? "Error" : String(Math.sqrt(n));
  });
  const backspace = () => setDisplay((prev) => (prev.length > 1 ? prev.slice(0, -1) : "0"));

  const KEYS: Array<{ label: string; onPress: () => void; tone?: "op" | "fn" }> = [
    { label: "C", onPress: clear, tone: "fn" },
    { label: "√", onPress: sqrt, tone: "fn" },
    { label: "%", onPress: percent, tone: "fn" },
    { label: "÷", onPress: () => applyOp("÷"), tone: "op" },
    { label: "7", onPress: () => inputDigit("7") },
    { label: "8", onPress: () => inputDigit("8") },
    { label: "9", onPress: () => inputDigit("9") },
    { label: "×", onPress: () => applyOp("×"), tone: "op" },
    { label: "4", onPress: () => inputDigit("4") },
    { label: "5", onPress: () => inputDigit("5") },
    { label: "6", onPress: () => inputDigit("6") },
    { label: "−", onPress: () => applyOp("−"), tone: "op" },
    { label: "1", onPress: () => inputDigit("1") },
    { label: "2", onPress: () => inputDigit("2") },
    { label: "3", onPress: () => inputDigit("3") },
    { label: "+", onPress: () => applyOp("+"), tone: "op" },
    { label: "±", onPress: toggleSign },
    { label: "0", onPress: () => inputDigit("0") },
    { label: ".", onPress: () => inputDigit(".") },
    { label: "=", onPress: equals, tone: "op" },
  ];

  return (
    <div className="w-64 rounded-m3-lg border border-outline-variant bg-surface-container-high p-3 shadow-elev-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-black uppercase tracking-wider text-on-surface-variant">Calculator</span>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="text" onClick={backspace} aria-label="Backspace"><Delete size={14} /></Button>
          <Button size="sm" variant="text" onClick={onClose} aria-label="Close"><X size={14} /></Button>
        </div>
      </div>
      <div className="mb-2 truncate rounded-m3-md bg-surface px-3 py-3 text-right text-[22px] font-black tabular-nums text-on-surface">
        {display}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {KEYS.map((k) => (
          <button
            key={k.label}
            onClick={k.onPress}
            className={cn(
              "rounded-m3-sm py-2.5 text-[14px] font-bold transition-colors",
              k.tone === "op" ? "bg-primary text-on-primary hover:opacity-90"
                : k.tone === "fn" ? "bg-surface-container text-on-surface-variant hover:bg-surface-container-lowest"
                : "bg-surface-container-lowest text-on-surface hover:bg-surface-container",
            )}
          >
            {k.label}
          </button>
        ))}
      </div>
    </div>
  );
}
