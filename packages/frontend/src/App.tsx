import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Layout from "./Layout";
import Login from "./pages/Login";
import Forms from "./pages/Forms";
import FormNew from "./pages/FormNew";
import FormDetail from "./pages/FormDetail";
import FormFill from "./pages/FormFill";
import Scripts from "./pages/Scripts";
import ScriptNew from "./pages/ScriptNew";
import ScriptDetail from "./pages/ScriptDetail";
import Admin from "./pages/Admin";

function Home() {
  return (
    <>
      <h1>Orcratration</h1>
      <p>
        Design dynamic multi-page forms and attach JavaScript scripts that run on
        Cloudflare Workers to extend and orchestrate form behaviour.
      </p>
      <p>
        <strong>Creator:</strong> Design forms, attach scripts to events (preload,
        validate, submit), then Deploy.
      </p>
      <p>
        <strong>End-user:</strong> Fill forms at <code>/fill/:slug</code>; scripts run
        between steps and on submit.
      </p>
      <p>
        <Link to="/login">Log in</Link> · <Link to="/forms">Forms</Link> ·{" "}
        <Link to="/scripts">Scripts</Link> · <Link to="/admin">Admin</Link>
      </p>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/fill/:slug" element={<FormFill />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="forms" element={<Forms />} />
          <Route path="forms/new" element={<FormNew />} />
          <Route path="forms/:id" element={<FormDetail />} />
          <Route path="scripts" element={<Scripts />} />
          <Route path="scripts/new" element={<ScriptNew />} />
          <Route path="scripts/:id" element={<ScriptDetail />} />
          <Route path="admin" element={<Admin />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
