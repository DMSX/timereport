"use client";

import { useEffect, useRef } from "react";

export default function Modal({ title, busy, onClose, children }: {
  title: string; busy: boolean; onClose: () => void; children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return <dialog ref={ref} className="modal" aria-labelledby="modal-title"
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="modal-heading"><h2 id="modal-title">{title}</h2><button type="button" className="secondary compact" disabled={busy} aria-label="Dialog schliessen" onClick={onClose}>✕</button></div>
    {children}
  </dialog>;
}
