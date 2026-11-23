// Chaport's app ID is public and included in its website installation snippet.
export const CHAPORT_APP_ID = process.env.NEXT_PUBLIC_CHAPORT_APP_ID?.trim() || "6b04a7561681bb00160403ce";
export const CHAPORT_ENABLED = /^[A-Za-z0-9_-]{1,100}$/.test(CHAPORT_APP_ID);

export type ChaportWidget = {
  _q: unknown[][];
  _l: Record<string, ((...args: unknown[]) => void)[]>;
  q: (...args: unknown[]) => void;
  on: (event: string, callback: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    chaportConfig?: { appId: string };
    chaport?: ChaportWidget;
  }
}
