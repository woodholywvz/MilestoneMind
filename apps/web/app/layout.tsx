import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "../src/components/Providers";
import { WalletBar } from "../src/components/WalletBar";

export const metadata: Metadata = {
  title: "MilestoneMind",
  description: "Read-only on-chain dashboard for MilestoneMind",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="chrome-shell">
            <header className="chrome-header">
              <WalletBar />
            </header>
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
