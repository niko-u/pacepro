import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
    default: "PacePro - AI Coach for Runners & Triathletes",
    template: "%s | PacePro",
  },
  description: "An AI endurance coach that reads your recovery, analyzes your workouts, and adapts your training in real-time. For runners and triathletes training for 5K to Ironman.",
  keywords: ["running coach", "triathlon coach", "AI coach", "training plan", "marathon training", "ironman training"],
  openGraph: {
    title: "PacePro - AI Coach for Runners & Triathletes",
    description: "An AI coach that actually knows you. Post-workout analysis, recovery intelligence, and real-time plan adaptation.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
