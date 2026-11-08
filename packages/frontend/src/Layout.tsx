import { Link, Outlet, useLocation } from "react-router-dom";

export default function Layout() {
  const { pathname } = useLocation();
  const night = pathname === "/admin" || pathname.startsWith("/admin/");
  return (
    <div className={night ? "layout layout-night" : "layout"}>
      <nav>
        <Link to="/">Orcratration</Link>
        <Link to="/forms">Forms</Link>
        <Link to="/forms/new">Create form</Link>
        <Link to="/scripts">Scripts</Link>
        <Link to="/admin">Admin</Link>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
