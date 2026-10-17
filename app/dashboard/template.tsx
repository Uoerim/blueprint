/**
 * Wraps each dashboard screen so that, in the installed app, moving to a new
 * screen eases it in like a native view (see `screen-in` in globals.css). The
 * website keeps its instant swaps, and reduced-motion settings turn it off.
 */
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return <div className="app:screen-in">{children}</div>;
}
