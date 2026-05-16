"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
}: ModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/45 px-4 py-8">
      <div className="surface-panel w-full max-w-2xl bg-card">
        <div className="flex items-start justify-between gap-4 border-b border-border/80 p-6">
          <div className="space-y-2">
            <p className="section-kicker">Action</p>
            <h2 className="font-heading text-3xl font-bold uppercase">{title}</h2>
            {description ? <p className="max-w-xl text-sm leading-7 text-muted-foreground">{description}</p> : null}
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close dialog">
            <XIcon />
          </Button>
        </div>
        <div className="p-6">{children}</div>
        {footer ? <div className="border-t border-border/80 p-6">{footer}</div> : null}
      </div>
    </div>
  );
}
