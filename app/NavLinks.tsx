"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLinks() {
  const pathname = usePathname();
  const links = [
    { href: "/", label: "Overview" },
    { href: "/skills", label: "Skills" },
  ];
  return (
    <nav className="flex gap-4 mt-2">
      {links.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={
            pathname === href
              ? "text-indigo-400 text-sm border-b border-indigo-400 pb-0.5"
              : "text-gray-500 text-sm hover:text-gray-300"
          }
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
