import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SearchProvider } from "@/components/search-command";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "BadgerIQ — UW-Madison course intelligence",
    template: "%s · BadgerIQ",
  },
  description:
    "Grade distributions, difficulty rankings, and advising flags for 9,700+ UW-Madison courses, built from 20 years of real Madgrades data and RateMyProfessor ratings.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <SearchProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
            Built on 20 years of Madgrades data ·{" "}
            <a
              href="https://github.com/RithikGobinath/BadgerIQ"
              className="underline-offset-4 hover:text-foreground hover:underline"
            >
              GitHub
            </a>{" "}
            ·{" "}
            <a
              href="https://github.com/RithikGobinath/CourseIQ"
              className="underline-offset-4 hover:text-foreground hover:underline"
            >
              CourseIQ pipeline
            </a>
          </footer>
        </SearchProvider>
      </body>
    </html>
  );
}
