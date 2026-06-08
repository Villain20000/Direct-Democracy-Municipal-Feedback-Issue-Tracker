import { AppProvider } from "@/lib/store/app-context";
import "./globals.css";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata = {
  title: "CivicPulse | DemokratiaOS",
  description: "Direct-democracy civic engagement platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <AppProvider>
          {children}
          <Toaster position="bottom-right" richColors />
        </AppProvider>
      </body>
    </html>
  );
}
