"use client";

import {
  useRef,
  type CSSProperties,
  type ComponentProps,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function ResizableTableHead({
  children,
  width,
  onResize,
  className,
  minWidth = 72,
  resizable = true,
  ...props
}: {
  children?: ReactNode;
  width: number;
  onResize?: (width: number) => void;
  className?: string;
  minWidth?: number;
  resizable?: boolean;
} & Omit<ComponentProps<typeof TableHead>, "style" | "children">) {
  const startX = useRef(0);
  const startWidth = useRef(0);

  function onPointerDown(e: ReactPointerEvent<HTMLSpanElement>) {
    if (!onResize) return;
    e.preventDefault();
    e.stopPropagation();
    startX.current = e.clientX;
    startWidth.current = width;
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);

    function onMove(ev: PointerEvent) {
      onResize!(Math.max(minWidth, startWidth.current + (ev.clientX - startX.current)));
    }
    function onUp(ev: PointerEvent) {
      handle.releasePointerCapture(ev.pointerId);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
    }
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  }

  return (
    <TableHead
      className={cn("relative select-none overflow-hidden", className)}
      style={{ width, minWidth: width, maxWidth: width }}
      {...props}
    >
      {children}
      {resizable && onResize ? (
        <span
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize column"
          onPointerDown={onPointerDown}
          className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize touch-none hover:bg-foreground/25 active:bg-foreground/40"
        />
      ) : null}
    </TableHead>
  );
}

export function columnStyle(width: number): CSSProperties {
  return { width, minWidth: width, maxWidth: width };
}
