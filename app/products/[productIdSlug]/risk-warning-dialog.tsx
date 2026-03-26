"use client";

import { useState, useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ProductDescriptionViewClient } from "@/app/components/product-description-view-client";

type RiskWarningDialogProps = {
  productId: string;
  title?: string | null;
  content: string;
  countdown?: number | null;
  confirmText?: string | null;
};

export function RiskWarningDialog({
  productId,
  title,
  content,
  countdown,
  confirmText,
}: RiskWarningDialogProps) {
  const [open, setOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const storageKey = `risk-seen-${productId}`;
  const initialSeconds =
    countdown != null && countdown >= 5 && countdown <= 60 ? countdown : 15;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem(storageKey)) return;
    setSecondsLeft(initialSeconds);
    setOpen(true);
  }, [storageKey, initialSeconds]);

  useEffect(() => {
    if (!open || secondsLeft <= 0) return;
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [open, secondsLeft]);

  const handleConfirm = () => {
    sessionStorage.setItem(storageKey, "1");
    setOpen(false);
  };

  const blockClose = (e: Event) => e.preventDefault();

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md max-h-[80vh] flex flex-col"
        showCloseButton={false}
        onPointerDownOutside={blockClose}
        onEscapeKeyDown={blockClose}
        onInteractOutside={blockClose}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            {title || "风险提示"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            请仔细阅读以下风险提示
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1">
          <ProductDescriptionViewClient description={content} />
        </div>

        <Button
          className="w-full"
          disabled={secondsLeft > 0}
          onClick={handleConfirm}
          aria-live="polite"
        >
          {secondsLeft > 0
            ? `阅读完毕后确认（剩余 ${secondsLeft}s）`
            : confirmText || "我已知晓"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
