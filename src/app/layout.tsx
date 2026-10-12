import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TimeReport",
  description: "Projektbezogene Zeiterfassung für Schweizer Teams.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="de-CH"><body>{children}</body></html>;
}
