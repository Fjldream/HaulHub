"use client";

import { App as AntdApp } from "antd";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export function ToastMessage({
  text,
  type = "error",
}: {
  text: string | null | undefined;
  type?: "error" | "success" | "warning" | "info";
}) {
  const { message } = AntdApp.useApp();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!text) {
      return;
    }

    message[type]({
      className: "haulhub-ant-message",
      content: text,
      duration: type === "error" ? 4 : 2.5,
    });

    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.delete("error");
    const nextQuery = nextSearchParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [message, pathname, router, searchParams, text, type]);

  return null;
}
