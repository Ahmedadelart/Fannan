"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

interface ToastItem {
  id: number;
  text: ReactNode;
  icon?: IconName;
}

const ToastContext = createContext<(text: ReactNode, icon?: IconName) => void>(() => {});

/** Short confirmation messages ("Saved", "Link copied"). Ink, bottom centre, gone after 4 seconds. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback((text: ReactNode, icon?: IconName) => {
    const id = Date.now() + Math.random();
    setItems((list) => [...list, { id, text, icon }]);
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 4000);
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
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
