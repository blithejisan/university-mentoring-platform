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
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background/75 p-4 text-foreground backdrop-blur-sm [&_input[data-slot=input]]:border-border [&_input[data-slot=input]]:bg-surface-elevated [&_input[data-slot=input]]:text-foreground [&_input[data-slot=input]]:placeholder:text-muted-foreground [&_label]:text-foreground [&_select]:border-border [&_select]:bg-surface-elevated [&_select]:text-foreground [&_textarea]:border-border [&_textarea]:bg-surface-elevated [&_textarea]:text-foreground [&_textarea]:placeholder:text-muted-foreground [&_.text-muted-foreground]:text-muted-foreground"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      {children}
    </div>,
    document.body,
  );
}
