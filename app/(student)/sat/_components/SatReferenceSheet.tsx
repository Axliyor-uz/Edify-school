"use client";

import LatexRenderer from "@/components/LatexRenderer";

/**
 * A reference panel of standard geometry/algebra formulas relevant to SAT
 * Math — public, factual mathematical content written from scratch, NOT a
 * reproduction of College Board's printed reference sheet (a copyrighted
 * layout/graphic). See docs/SAT_QUIZ.md.
 */

const FORMULAS: Array<{ label: string; latex: string }> = [
  { label: "Circle area", latex: "$A = \\pi r^2$" },
  { label: "Circle circumference", latex: "$C = 2\\pi r$" },
  { label: "Rectangle area", latex: "$A = lw$" },
  { label: "Triangle area", latex: "$A = \\tfrac{1}{2}bh$" },
  { label: "Pythagorean theorem", latex: "$a^2 + b^2 = c^2$" },
  { label: "45-45-90 triangle sides", latex: "$x,\\ x,\\ x\\sqrt{2}$" },
  { label: "30-60-90 triangle sides", latex: "$x,\\ x\\sqrt{3},\\ 2x$" },
  { label: "Rectangular solid volume", latex: "$V = lwh$" },
  { label: "Cylinder volume", latex: "$V = \\pi r^2 h$" },
  { label: "Sphere volume", latex: "$V = \\tfrac{4}{3}\\pi r^3$" },
  { label: "Cone volume", latex: "$V = \\tfrac{1}{3}\\pi r^2 h$" },
  { label: "Pyramid volume", latex: "$V = \\tfrac{1}{3}lwh$" },
  { label: "Sum of angles in a triangle", latex: "$180°$" },
  { label: "Sum of angles in a quadrilateral", latex: "$360°$" },
  { label: "Degrees in a circle", latex: "$360°$" },
  { label: "Radians in a circle", latex: "$2\\pi$" },
];

export default function SatReferenceSheet() {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {FORMULAS.map((f) => (
        <div key={f.label} className="flex items-center justify-between gap-3 rounded-m3-md bg-surface-container-lowest px-3 py-2">
          <span className="text-[12px] font-medium text-on-surface-variant">{f.label}</span>
          <span className="flex-none text-[14px] font-bold text-on-surface">
            <LatexRenderer latex={f.latex} />
          </span>
        </div>
      ))}
    </div>
  );
}
