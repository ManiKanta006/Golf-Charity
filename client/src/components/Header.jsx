import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

export default function Header({ token, user, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <>
      <header className="site-header">
        <Link className="brand" to="/">
          <span className="brand-mark" />
          Impact Draw
        </Link>

        <nav className="nav-links">
          <NavLink to="/">Home</NavLink>
          <NavLink to="/charities">Charities</NavLink>
          {token && <NavLink to="/dashboard">Dashboard</NavLink>}
          {user?.role === "admin" && <NavLink to="/admin">Admin</NavLink>}
        </nav>

        <div className="auth-actions">
          {!token ? (
            <>
              <Link className="btn btn-ghost" to="/login">
                Login
              </Link>
              <Link className="btn btn-primary" to="/register">
                Subscribe
              </Link>
            </>
          ) : (
            <button className="btn btn-ghost" type="button" onClick={onLogout}>
              Logout
            </button>
          )}
        </div>

        <button
          className="btn btn-ghost mobile-menu-btn"
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
        >
          {menuOpen ? "Close" : "Menu"}
        </button>
      </header>

      {menuOpen && (
        <nav className="mobile-menu" aria-label="Mobile navigation">
          <NavLink to="/">Home</NavLink>
          <NavLink to="/charities">Charities</NavLink>
          {token && <NavLink to="/dashboard">Dashboard</NavLink>}
          {user?.role === "admin" && <NavLink to="/admin">Admin</NavLink>}

          {!token ? (
            <div className="mobile-menu-actions">
              <Link className="btn btn-ghost" to="/login">
                Login
              </Link>
              <Link className="btn btn-primary" to="/register">
                Subscribe
              </Link>
            </div>
          ) : (
            <button className="btn btn-ghost" type="button" onClick={onLogout}>
              Logout
            </button>
          )}
        </nav>
      )}
    </>
  );
}
