"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/** Round 18: one button on the message, like "Undo" after removing a section. */
export interface ToastAction {
  label: string;
  run: () => void;
}

interface ToastItem {
  id: number;
  text: ReactNode;
  icon?: IconName;
  action?: ToastAction;
}

const ToastContext = createContext<(text: ReactNode, icon?: IconName, action?: ToastAction) => void>(() => {});

/** Short confirmation messages ("Saved", "Link copied"). Ink, bottom centre, gone after 4 seconds
 *  (7 when there's a button to press). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback((text: ReactNode, icon?: IconName, action?: ToastAction) => {
    const id = Date.now() + Math.random();
    setItems((list) => [...list, { id, text, icon, action }]);
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), action ? 7000 : 4000);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-4"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className="bg-ink shadow-float flex items-center gap-2.5 rounded-md px-4 py-3 text-[14px] font-medium text-white"
          >
            {t.icon && <Icon name={t.icon} size={18} />}
            {t.text}
            {t.action && (
              <button
                type="button"
                className="bg-lime text-on-lime pointer-events-auto -my-1 ms-2 h-8 rounded-pill px-3.5 text-[13px] font-semibold"
                onClick={() => {
                  t.action!.run();
                  setItems((list) => list.filter((x) => x.id !== t.id));
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
