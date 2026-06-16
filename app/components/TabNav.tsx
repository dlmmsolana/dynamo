"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Discover", href: "/discover" },
  { label: "Live LP", href: "/livelp" },
  { label: "Auditor", href: "/auditor" },
  { label: "Portfolio", href: "/portfolio" },
  { label: "Architect", href: "/architect" },
  { label: "Simulator", href: "/simulator" },
] as const;

export default function TabNav() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        borderBottom: "1px solid var(--border)",
        background: "var(--surface)",
        display: "flex",
        alignItems: "center",
        gap: 0,
        padding: "0 16px",
        height: 44,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          color: "var(--text-muted)",
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginRight: 20,
          fontWeight: 600,
        }}
      >
        Dynamo
      </span>
      {TABS.map((tab) => {
        const active =
          pathname === tab.href || pathname.startsWith(tab.href + "/");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: "100%",
              padding: "0 14px",
              fontSize: 12,
              fontWeight: active ? 600 : 400,
              color: active ? "var(--text)" : "var(--text-muted)",
              borderBottom: active
                ? "2px solid var(--accent)"
                : "2px solid transparent",
              textDecoration: "none",
              transition: "color 0.1s",
              letterSpacing: "0.02em",
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
