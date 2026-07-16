import type { Metadata } from "next";
import { Space_Grotesk, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import ThemeHydrator from "@/components/ThemeHydrator";
const space = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", weight: ["400", "600"] });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", weight: ["400", "600"] });
const ibm = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400"] });

export const metadata: Metadata = {
  title: "FlowDesk",
  description: "See the work as it happens, not just the update.",
};

// Inline bootstrap. Runs in <head> before any paint, reads localStorage,
// adds the 'dark' class to <html> if needed. This is the FOUC prevention —
// without it, every page load would flash light for 1 frame before flipping.
const themeBootstrapScript = `
  (function() {
    try {
      if (localStorage.getItem('flowdesk-theme') === 'dark') {
        document.documentElement.classList.add('dark');
      }
    } catch (e) {}
  })();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${space.variable} ${inter.variable} ${ibm.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: themeBootstrapScript }}
        />
      </head>
      <body className="bg-paper text-ink font-body min-h-screen">
        <ThemeHydrator />
        {children}
      </body>
    </html>
  );
}