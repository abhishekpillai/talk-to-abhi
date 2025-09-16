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
  title: "Talk as Abhi",
  description:
    "Upload a short audio clip and watch Abhi lip-sync it instantly. Consensual parody powered by Replicate's lipsync-2-pro.",
  openGraph: {
    title: "Talk as Abhi",
    description:
      "Upload a short audio clip and watch Abhi lip-sync it instantly. Consensual parody powered by Replicate's lipsync-2-pro.",
    url: "https://talkasabhi.com",
    siteName: "Talk as Abhi",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Talk as Abhi",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Talk as Abhi",
    description:
      "Upload a short audio clip and watch Abhi lip-sync it instantly. Consensual parody powered by Replicate's lipsync-2-pro.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
