import type { Metadata } from "next";
import "./globals.css";
import { ReactNode } from "react";
import { Providers } from "./providers";
import { Navigation } from "@/components/Navigation";

export const metadata: Metadata = {
  title: "Portefeuille Multi-Sources",
  description: "Dashboard financier pour portefeuilles crypto et PEA",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <Providers>
          <div className="app-shell">
            <Navigation />
            <div className="app-content">
              {children}
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
