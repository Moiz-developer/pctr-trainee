import { useEffect, useState } from "react";

// Geometry, colours and timing come straight from the approved loader.svg: ten
// rounded bars around a circle, alternating purple/cyan, each fading 1 → 0 on a
// 1.449s loop with the phase offset stepped by a tenth of the loop.
const BAR_COUNT = 10;
const LOOP_SECONDS = 1.449275;
const BARS = Array.from({ length: BAR_COUNT }, (_, index) => ({
  angle: index * 36,
  color: index % 2 === 0 ? "#6c5ffc" : "#05c3fb",
  delay: -(LOOP_SECONDS * 0.9) + index * (LOOP_SECONDS / BAR_COUNT),
  // Used only when animation is off (prefers-reduced-motion): a still, graded ring.
  staticOpacity: 0.1 + index * 0.1,
}));

/** The loader.svg spinner, drawn inline so its animation can honour prefers-reduced-motion. */
export function LoaderSpinner({ size = 56 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
      className="block"
    >
      {BARS.map((bar) => (
        <g key={bar.angle} transform={`rotate(${bar.angle} 50 50)`}>
          <rect
            className="loader-bar"
            x="41.5"
            y="24.5"
            rx="8.5"
            ry="2.5"
            width="17"
            height="5"
            fill={bar.color}
            style={{ animationDelay: `${bar.delay}s`, opacity: bar.staticOpacity }}
          />
        </g>
      ))}
    </svg>
  );
}

/**
 * The app's loading state: the spinner centred on a clear area, announced to
 * assistive tech as a polite status. Two uses:
 *  - inline (default): reserves an in-flow area for the spinner. Unused
 *    directly now that RemoteDataView asks for `fullScreen` instead, but kept
 *    for any caller that wants a loader confined to its own layout box.
 *  - `fullScreen`: a `fixed inset-0` overlay above the app shell (sidebar,
 *    header) but below Modal, so it covers the whole viewport no matter where
 *    it's mounted. Used by RequireSession while the session/account is
 *    resolved on a reload (shows immediately — the static boot loader in
 *    index.html is already on screen at that point, so a delay would only add
 *    a blank gap) and by RemoteDataView while a page/panel's data is loading
 *    (`delayMs={150}`, so a response that arrives quickly never flashes it).
 */
export function PageLoader({
  fullScreen = false,
  delayMs,
  label = "Loading",
}: {
  fullScreen?: boolean;
  delayMs?: number;
  label?: string;
}) {
  const delay = delayMs ?? (fullScreen ? 0 : 150);
  const [visible, setVisible] = useState(delay === 0);

  useEffect(() => {
    if (delay === 0) return;
    const timer = window.setTimeout(() => setVisible(true), delay);
    return () => window.clearTimeout(timer);
  }, [delay]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={
        fullScreen
          ? "fixed inset-0 z-[35] flex items-center justify-center bg-white"
          : "flex items-center justify-center py-10"
      }
    >
      <span className="sr-only">{label}…</span>
      <div className={`transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}>
        <LoaderSpinner size={fullScreen ? 100 : 56} />
      </div>
    </div>
  );
}
