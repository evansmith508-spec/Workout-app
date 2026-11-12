import { useEffect, type ReactNode } from "react";
import { Icon } from "./ui";

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="iconbtn grey" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
