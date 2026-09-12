import type { Metadata } from "next";
import "./globals.css";
import { Telemetry } from "../components/telemetry";
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  ),
  title: {
    default: "Pitch Lab Athletics | Pitching Coaching in Corpus Christi",
    template: "%s | Pitch Lab Athletics",
  },
  description:
    "Individualized pitching development with Coach Jacob Sosa. Private lessons, throwing plans, and video feedback for youth through college athletes.",
  openGraph: {
    title: "Pitch Lab Athletics",
    description: "Develop with intent. Compete with confidence.",
    type: "website",
  },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
        <Telemetry />
      </body>
    </html>
  );
}
