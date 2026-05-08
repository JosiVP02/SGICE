import { useState, useEffect, lazy, Suspense } from "react";
import "./styles/app.css";
import { initDB } from "./services/db";
import logo from "./assets/logo.png";

const Alimentos = lazy(() => import("./pages/Alimentos"));
const Limpieza = lazy(() => import("./pages/Limpieza"));
const Activos = lazy(() => import("./pages/Activos"));
const Dashboard = lazy(() => import("./pages/Dashboard"));




const NAV_ADMIN = [
  { key: "dashboard", label: "Dashboard",  icon: "⊞" },
  { key: "alimentos", label: "Alimentos",  icon: "🥦" },
  { key: "limpieza",  label: "Limpieza",   icon: "🧹" },
  { key: "activos",   label: "Activos",    icon: "📦" },
];

const NAV_COCINA = [
  { key: "alimentos", label: "Alimentos",  icon: "🥦" },
  { key: "limpieza",  label: "Limpieza",   icon: "🧹" },
];

function App() {
  const [logged, setLogged]   = useState(false);
  const [user,   setUser]     = useState("");
  const [pass,   setPass]     = useState("");
  const [role,   setRole]     = useState("");
  const [error,  setError]    = useState("");
  const [page,   setPage]     = useState("dashboard");

  useEffect(() => { initDB(); }, []);

  const login = () => {
    const u = user.trim(), p = pass.trim();
    if (!u || !p) { setError("Ingrese usuario y contraseña"); return; }
    if (u === "admin"  && p === "1234") { setRole("admin");  setLogged(true); setPage("dashboard"); setError(""); }
    else if (u === "cocina" && p === "1234") { setRole("cocina"); setLogged(true); setPage("alimentos"); setError(""); }
    else setError("Credenciales incorrectas");
  };



  const logout = () => { setLogged(false); setUser(""); setPass(""); setRole(""); setPage("dashboard"); };



const pages = {
  dashboard: <Dashboard />,
  alimentos: <Alimentos role={role} />,
  limpieza: <Limpieza role={role} />,
  activos: <Activos role={role} />
};

const renderPage = () => pages[page] || null;


  

  /* ── LOGIN ─────────────────────────────── */
  if (!logged) return (
    
    <div className="login-container">
      <div className="brand">SG<span>I</span>CE</div>
      <div className="login-box">
        <div className="logo-circle">
        <img src={logo} alt="Logo SGICE" />
      </div>


        <h1>Bienvenido</h1>
        <p>Sistema Gestor de Inventarios</p>
        <input
          type="text" placeholder="Usuario" value={user}
          onChange={e => setUser(e.target.value)}
        />
        <input
          type="password" placeholder="Contraseña" value={pass}
          onChange={e => setPass(e.target.value)}
          onKeyDown={e => e.key === "Enter" && login()}
        />
        {error && <p className="error-msg">{error}</p>}
        <button onClick={login}>Ingresar al sistema</button>
      </div>
    </div>
  );

  /* ── APP ───────────────────────────────── */
  const nav = role === "admin" ? NAV_ADMIN : NAV_COCINA;
  const roleLabel = role === "admin" ? "Administrador" : "Cocina";
  const roleInitial = role === "admin" ? "AD" : "CO";

  

  return (
    <div className="panel">
      {/* SIDEBAR */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="logo-circle">
              <img src={logo} alt="Logo SGICE" />
            </div>
            
            <div className="sidebar-title">SGICE</div>
          </div>
          <div className="sidebar-sub">Inventarios</div>
        </div>

        <div className="sidebar-nav">
          <div className="sidebar-section">Módulos</div>
          {nav.map(item => (
            <button
              key={item.key}
              className={page === item.key ? "active" : ""}
              onClick={() => setPage(item.key)}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{roleInitial}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user}</div>
              <div className="sidebar-user-role">{roleLabel}</div>
            </div>
          </div>
          <button onClick={logout}>⬆ Cerrar sesión</button>
        </div>
      </div>

   
      {/* CONTENT */}
      <div className="content">
        <Suspense
          fallback={
            <div className="loader">
              Cargando módulo...
            </div>
          }
        >
          {renderPage()}
        </Suspense>
      </div>
      
    </div>
  );
}

export default App;