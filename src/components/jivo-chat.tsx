"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// The widget ID is public by design. Only load a valid Jivo widget ID.
export default function JivoChat() {
  const id = process.env.NEXT_PUBLIC_JIVO_WIDGET_ID?.trim() ?? "";
  const pathname = usePathname();
  const [safeToLoad, setSafeToLoad] = useState(false);
  useEffect(() => {
    // Do not load third-party scripts while a reset token is in the address bar.
    const check = () => setSafeToLoad(!(window.location.pathname === "/reset-password" && new URLSearchParams(window.location.search).has("token")));
    check();
    const timer = window.setInterval(check, 250);
    return () => window.clearInterval(timer);
  }, [pathname]);
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id) || !safeToLoad) return null;
  return <Script id="jivo-chat" src={`https://code.jivosite.com/widget/${id}`} strategy="afterInteractive" />;
}
