import type { ReactNode } from "react";

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return <div className="protected-layout">{children}</div>;
}
