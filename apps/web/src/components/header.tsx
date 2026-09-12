"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { Brand } from "./brand";
import { auth } from "../lib/api";
export function Header() {
  const [open, setOpen] = useState(false);
  const [signed, setSigned] = useState(false);
  useEffect(() => {
    try {
      const client = auth();
      void client.auth
        .getSession()
        .then(({ data }) => setSigned(!!data.session));
      const { data } = client.auth.onAuthStateChange((_e, s) => setSigned(!!s));
      return () => data.subscription.unsubscribe();
    } catch {
      return;
    }
  }, []);
  return (
    <header className="site-header">
      <div className="header-inner">
        <Brand />
        <button
          className="menu-toggle"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          aria-controls="public-nav"
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
        <nav
          id="public-nav"
          className={open ? "public-nav open" : "public-nav"}
          aria-label="Main navigation"
        >
          <Link href="/programs" onClick={() => setOpen(false)}>
            Programs
          </Link>
          <Link href="/about" onClick={() => setOpen(false)}>
            About
          </Link>
          <Link
            href={signed ? "/app" : "/login"}
            onClick={() => setOpen(false)}
          >
            {signed ? "Dashboard" : "Athlete Hub"}
          </Link>
          <Link className="button light" href="/app/lessons">
            Book a Lesson <ArrowUpRight size={17} />
          </Link>
        </nav>
      </div>
    </header>
  );
}
