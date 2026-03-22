import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Skills Manager",
  description: "Central skills repo manager",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-950 text-gray-100 min-h-screen`}>
        <div className="max-w-4xl mx-auto px-6 py-8">
          <header className="mb-8 border-b border-gray-800 pb-4">
            <h1 className="text-2xl font-bold text-white">Skills Manager</h1>
            <p className="text-gray-400 text-sm mt-1">Central skills repo · <span className="font-mono">~/Github/skills</span></p>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
