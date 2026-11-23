// An abstract tapered spiral: a drill / vortex motif for the DDCM wordmark.
export default function DdcmMark({ size = 22 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
    <path d="M4 8.5c2.5-2.4 6.6-3.8 12-3.8s9.5 1.4 12 3.8c-2.8 2.2-7 3.5-12 3.5S6.8 10.7 4 8.5Z" fill="currentColor"/>
    <path d="M7.1 13.1c2.4 1.4 5.4 2.1 8.9 2.1s6.5-.7 8.9-2.1l-2.6 4.6c-1.8 1-3.9 1.5-6.3 1.5s-4.5-.5-6.3-1.5l-2.6-4.6Z" fill="currentColor" opacity=".85"/>
    <path d="M11.5 20.1c1.4.5 2.9.8 4.5.8s3.1-.3 4.5-.8L16 28l-4.5-7.9Z" fill="currentColor" opacity=".72"/>
  </svg>;
}
