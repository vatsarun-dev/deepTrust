import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAppContext } from "../context/AppContext.jsx";

const navItems = [
  { label: "Story", href: "/" },
  { label: "Check", href: "/check" },
  { label: "Complaint", href: "/complaint" },
  { label: "Auth", href: "/auth" },
];

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { loading, user } = useAppContext();

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 py-4 md:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between rounded-full border border-white/10 bg-white/5 px-5 py-3 backdrop-blur-xl">
        <Link
          to="/"
          className="text-lg font-semibold uppercase tracking-[0.35em] text-white"
        >
          DeepTrust
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                `rounded-full px-4 py-2 text-sm uppercase tracking-[0.2em] transition ${
                  isActive
                    ? "bg-[var(--accent)] text-white"
                    : "text-white/65 hover:bg-white/8 hover:text-white"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.22em] text-white/55">
            {loading ? "Analyzing" : user ? user.name : "Guest Mode"}
          </div>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white md:hidden"
          onClick={() => setMenuOpen((value) => !value)}
          aria-label="Toggle navigation"
        >
          <span className="text-lg">{menuOpen ? "X" : "+"}</span>
        </button>
      </div>

      {menuOpen ? (
        <div className="mx-auto mt-3 max-w-7xl rounded-[2rem] border border-white/10 bg-[#0a0a0a]/95 p-4 backdrop-blur-xl md:hidden">
          <div className="flex flex-col gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `rounded-2xl px-4 py-3 text-sm uppercase tracking-[0.18em] transition ${
                    isActive
                      ? "bg-[var(--accent)] text-white"
                      : "bg-white/5 text-white/70"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
}

export default Navbar;
