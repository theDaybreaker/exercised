import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Exercised — Turn workout videos into structured routines",
  description:
    "Paste a YouTube workout URL. We extract the exercises, sets, reps, and form cues in seconds.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="bg-[var(--color-bg-base)] text-[var(--color-text-primary)] font-sans antialiased">
        {children}
        <Toaster richColors theme="dark" position="bottom-center" />
      </body>
    </html>
  );
}
