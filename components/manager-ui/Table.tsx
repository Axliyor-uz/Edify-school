"use client";

import { createContext, useContext, type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "./cn";
import { MANAGER_DESIGN, type ManagerDesignConfig } from "./config";

/* Usage:
   <Table>
     <thead><tr><Th>O'quvchi</Th><Th>Natija</Th></tr></thead>
     <tbody>
       <TRow><Td>Aziza</Td><Td className="num">18/20</Td></TRow>
     </tbody>
   </Table>

   The look follows MANAGER_DESIGN.Table_style ('lined' | 'striped' | 'cards').
   <Table> provides the style through context so TRow/Td restyle themselves —
   existing call sites need zero changes.
*/

type TableStyle = ManagerDesignConfig["Table_style"];

const TableStyleContext = createContext<TableStyle>(MANAGER_DESIGN.Table_style);

export function Table({ className, children, ...rest }: HTMLAttributes<HTMLTableElement>) {
  const style = MANAGER_DESIGN.Table_style;
  return (
    <TableStyleContext.Provider value={style}>
      <div className="overflow-x-auto">
        <table
          className={cn(
            "w-full min-w-[560px] text-sm text-on-surface",
            style === "cards" ? "border-separate border-spacing-x-0 border-spacing-y-t-gap" : "border-collapse",
            className,
          )}
          {...rest}
        >
          {children}
        </table>
      </div>
    </TableStyleContext.Provider>
  );
}

export function Th({ className, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  const style = useContext(TableStyleContext);
  return (
    <th
      className={cn(
        "whitespace-nowrap px-3.5 py-2.5 text-left text-xs font-bold tracking-wide text-on-surface-variant",
        style !== "cards" && "border-b border-outline-variant",
        className,
      )}
      {...rest}
    />
  );
}

export function TRow({ className, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  const style = useContext(TableStyleContext);
  return (
    <tr
      className={cn(
        "h-t-row transition-colors",
        style === "lined" && "hover:bg-state-hover [&:last-child>td]:border-b-0",
        style === "striped" && "even:bg-surface-container-low hover:bg-state-hover",
        // 'cards': a <tr> can't be rounded/shadowed, so paint the cells.
        // Hover: state-hover is translucent, so layer it as a gradient OVER the
        // opaque card background instead of replacing it.
        style === "cards" &&
          "[&>td]:bg-surface-container-lowest [&>td]:shadow-elev-1 [&>td:first-child]:rounded-l-m3-md [&>td:last-child]:rounded-r-m3-md [&:hover>td]:[background-image:linear-gradient(var(--m3-state-hover),var(--m3-state-hover))]",
        className,
      )}
      {...rest}
    />
  );
}

export function Td({ className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  const style = useContext(TableStyleContext);
  return (
    <td
      className={cn(
        "whitespace-nowrap px-3.5 py-3",
        style === "lined" && "border-b border-outline-variant",
        className,
      )}
      {...rest}
    />
  );
}

export interface PaginationProps {
  /** 1-based current page. */
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
  className?: string;
}

export function Pagination({ page, pageCount, onPage, className }: PaginationProps) {
  if (pageCount <= 1) return null;
  // window of up to 5 page numbers around the current one
  const start = Math.max(1, Math.min(page - 2, pageCount - 4));
  const pages = Array.from({ length: Math.min(5, pageCount) }, (_, i) => start + i);
  const btn = cn(
    "m3-interactive grid h-t-control-sm w-t-control-sm flex-none place-items-center text-[13px] font-semibold",
    MANAGER_DESIGN.Button_style === "pill" ? "rounded-full" : "rounded-m3-sm",
  );
  return (
    <div className={cn("flex items-center justify-end gap-1 pt-3 text-on-surface-variant", className)}>
      <button type="button" aria-label="Oldingi sahifa" disabled={page === 1} onClick={() => onPage(page - 1)} className={cn(btn, "disabled:text-disabled-fg")}>
        <ChevronLeft className="h-4 w-4" />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          aria-current={p === page ? "page" : undefined}
          onClick={() => onPage(p)}
          className={cn(btn, p === page && "bg-primary text-on-primary")}
        >
          {p}
        </button>
      ))}
      <button type="button" aria-label="Keyingi sahifa" disabled={page === pageCount} onClick={() => onPage(page + 1)} className={cn(btn, "disabled:text-disabled-fg")}>
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
