"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

type ConfirmSubmitButtonProps = {
  children: ReactNode;
  className?: string;
  confirmMessage?: string;
  pendingChildren?: ReactNode;
};

export function ConfirmSubmitButton({
  children,
  className,
  confirmMessage,
  pendingChildren,
}: ConfirmSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      className={className}
      disabled={pending}
      type="submit"
      onClick={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {pending ? (pendingChildren ?? children) : children}
    </button>
  );
}
