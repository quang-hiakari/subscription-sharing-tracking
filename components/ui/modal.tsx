'use client';

import { useRef } from 'react';

/** A native <dialog>-based popup: the browser handles the backdrop, ESC-to-close and focus
 * trapping, so no extra dependency is needed for a simple "open a form without navigating" popup. */
export function Modal({
  trigger,
  triggerClassName,
  title,
  children,
}: {
  trigger: React.ReactNode;
  triggerClassName?: string;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button type="button" onClick={() => ref.current?.showModal()} className={triggerClassName}>
        {trigger}
      </button>
      {/* Tailwind's preflight resets `margin: 0` globally, which kills <dialog>'s native
       * margin:auto centering — set it back explicitly so the popup lands mid-screen. */}
      <dialog ref={ref} className="m-auto w-[min(92vw,480px)] rounded-lg border border-gray-200 p-0 backdrop:bg-black/30">
        <div className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-medium">{title}</h3>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              aria-label="Đóng"
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          {children}
        </div>
      </dialog>
    </>
  );
}
