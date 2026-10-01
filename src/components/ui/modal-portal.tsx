"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

let activeModalCount = 0;
let previousBodyOverflow = "";

interface ModalPortalProps {
  children: ReactNode;
  labelledBy: string;
}

export function ModalPortal({ children, labelledBy }: ModalPortalProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (activeModalCount === 0) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }

    activeModalCount += 1;

    return () => {
      activeModalCount -= 1;
      if (activeModalCount === 0) {
        document.body.style.overflow = previousBodyOverflow;
      }
    };
  }, []);

  if (!isMounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/70 p-4 text-slate-100 backdrop-blur-sm [&_input[data-slot=input]]:border-slate-700 [&_input[data-slot=input]]:bg-slate-800 [&_input[data-slot=input]]:text-slate-100 [&_input[data-slot=input]]:placeholder:text-slate-400 [&_label]:text-slate-200 [&_select]:border-slate-700 [&_select]:bg-slate-800 [&_select]:text-slate-100 [&_textarea]:border-slate-700 [&_textarea]:bg-slate-800 [&_textarea]:text-slate-100 [&_textarea]:placeholder:text-slate-400 [&_.text-muted-foreground]:text-slate-400"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      {children}
    </div>,
    document.body,
  );
}
