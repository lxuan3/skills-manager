import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavLinks from "./NavLinks";
import RepoPathHeader from "./RepoPathHeader";
import { getRawSkillsRepoPath } from "@/lib/config.mjs";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Skills Manager",
  description: "Central skills repo manager",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const repoPath = getRawSkillsRepoPath() ?? "not configured";
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-950 text-gray-100 min-h-screen`}>
        <div className="max-w-6xl mx-auto px-6 py-8">
          <header className="mb-8 border-b border-gray-800 pb-4">
            <h1 className="text-2xl font-bold text-white">Skills Manager</h1>
            <RepoPathHeader initialPath={repoPath} />
            <NavLinks />
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
