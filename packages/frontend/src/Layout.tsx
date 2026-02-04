import { Link, Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <div className="layout">
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
