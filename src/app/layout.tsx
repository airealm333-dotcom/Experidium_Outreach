import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/sidebar";
import { MobileNav } from "@/components/mobile-nav";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Experidium Outreach",
  description: "AI-powered outreach CRM for Experidium",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background">
        <TooltipProvider>
          <Sidebar />
          <MobileNav />
          <main className="min-h-full pt-14 md:pt-0 md:pl-64">
            <div className="px-4 py-6 sm:px-6 lg:px-8 md:py-8">{children}</div>
          </main>
        </TooltipProvider>
      </body>
    </html>
  );
}
