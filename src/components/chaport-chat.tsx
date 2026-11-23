"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { CHAPORT_APP_ID, CHAPORT_ENABLED, type ChaportWidget } from "@/lib/chat-config";

export default function ChaportChat() {
  const pathname = usePathname();
  const previousPath = useRef<string | null>(null);

  useEffect(() => {
    const changedPath = previousPath.current !== null && previousPath.current !== pathname;
    previousPath.current = pathname;
    // Keep third-party scripts off the password reset flow.
    if (!CHAPORT_ENABLED || pathname === "/reset-password") return;

    window.chaportConfig = { appId: CHAPORT_APP_ID };
    if (changedPath && window.chaport) window.chaport.q("newPageView");
    if (window.chaport || document.getElementById("chaport-live-chat")) return;

    const widget: ChaportWidget = {
      _q: [],
      _l: {},
      q(...args) { widget._q.push(args); },
      on(event, callback) { (widget._l[event] ||= []).push(callback); },
    };
    window.chaport = widget;

    const script = document.createElement("script");
    script.id = "chaport-live-chat";
    script.type = "text/javascript";
    script.async = true;
    script.src = "https://app.chaport.ru/javascripts/insert.js";
    document.head.appendChild(script);
  }, [pathname]);

  return null;
}
