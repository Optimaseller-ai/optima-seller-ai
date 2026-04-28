"use client";

import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Toast = {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
};

type ToastState = {
  toasts: Toast[];
};

type ToastAction =
  | { type: "ADD"; toast: Toast }
  | { type: "DISMISS"; id: string }
  | { type: "CLEAR" };

const ToastContext = React.createContext<{
  state: ToastState;
  dispatch: React.Dispatch<ToastAction>;
} | null>(null);

function reducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case "ADD":
      return { toasts: [action.toast, ...state.toasts].slice(0, 3) };
    case "DISMISS":
      return { toasts: state.toasts.filter((t) => t.id !== action.id) };
    case "CLEAR":
      return { toasts: [] };
    default:
      return state;
  }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(reducer, { toasts: [] });
  return (
    <ToastContext.Provider value={{ state, dispatch }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");

  return {
    toast: (t: Omit<Toast, "id">) => {
      const id = crypto.randomUUID();
      ctx.dispatch({ type: "ADD", toast: { id, ...t } });
      return id;
    },
    dismiss: (id: string) => ctx.dispatch({ type: "DISMISS", id }),
    clear: () => ctx.dispatch({ type: "CLEAR" }),
  };
}

export function Toaster() {
  return (
    <ToastPrimitive.Provider swipeDirection="right">
      <Toasts />
      <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2 outline-none md:bottom-6 md:right-6" />
    </ToastPrimitive.Provider>
  );
}

function Toasts() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) return null;

  return (
    <>
      {ctx.state.toasts.map((t) => (
        <ToastPrimitive.Root
          key={t.id}
          duration={3500}
          onOpenChange={(open) => {
            if (!open) ctx.dispatch({ type: "DISMISS", id: t.id });
          }}
          className={cn(
            "group relative grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 rounded-[var(--radius)] border bg-background p-4 shadow-md",
            t.variant === "destructive" &&
              "border-red-600/30 bg-red-600/10",
          )}
        >
          <ToastPrimitive.Title className="text-sm font-semibold">
            {t.title ?? "Info"}
          </ToastPrimitive.Title>
          <ToastPrimitive.Close className="rounded-[calc(var(--radius)-6px)] p-1 opacity-70 transition hover:bg-muted hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <X className="size-4" />
          </ToastPrimitive.Close>
          {t.description ? (
            <ToastPrimitive.Description className="col-span-2 text-sm text-muted-foreground">
              {t.description}
            </ToastPrimitive.Description>
          ) : null}
        </ToastPrimitive.Root>
      ))}
    </>
  );
}
