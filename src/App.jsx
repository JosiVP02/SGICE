import { useState, useEffect, lazy, Suspense } from "react";
import "./styles/app.css";
import logo from "./assets/logo.png";
import { initDB, hacerBackup, importarBackup, limpiarMovimientosHasta } from "./services/db";

// Al inicio de App.jsx, agregá confirm de Tauri:
import { confirm } from "@tauri-apps/plugin-dialog";



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


const [haciendoBackup, setHaciendoBackup] = useState(false);

const backup = async () => {
  setHaciendoBackup(true);
  const ok = await hacerBackup();
  setHaciendoBackup(false);
};






const [showSuccess, setShowSuccess] = useState(false);

const limpiarBD = async () => {

  if (!fechaLimite) {

    setShowLimpiar(false);

    setConfirmData({
      titulo: "⚠ Fecha requerida",
      mensaje: "Debe seleccionar una fecha para continuar.",
      soloAceptar: true,
      onConfirm: () => {
        setConfirmData(null);
        setShowLimpiar(true);
      }
    });

    return;
  }

  // cerrar modal fecha
  setShowLimpiar(false);

  const ok = await mostrarConfirm(
    `¿Seguro que desea eliminar todos los movimientos hasta ${fechaLimite}?`
  );

  // si cancela volver a abrir selector
  if (!ok) {
    setShowLimpiar(true);
    return;
  }

  try {

    setLimpiando(true);

    const exito = await limpiarMovimientosHasta(fechaLimite);

    if (exito) {

      setFechaLimite("");

      setShowSuccess(true);

      setTimeout(() => {
        window.location.reload();
      }, 3000);
    }

  } catch (err) {

    console.error(err);

    setConfirmData({
      titulo: "❌ Error",
      mensaje: "Ocurrió un error al limpiar movimientos.",
      soloAceptar: true,
      onConfirm: () => setConfirmData(null)
    });

  } finally {

    setLimpiando(false);
  }
};




const [showMantenimiento, setShowMantenimiento] = useState(false);



const [confirmData, setConfirmData] = useState(null);

const mostrarConfirm = (mensaje) =>
  new Promise((resolve) => {
    setConfirmData({
      titulo: "⚠ Confirmar acción",
      mensaje,
      onConfirm: () => {
        resolve(true);
        setConfirmData(null);
      },
      onCancel: () => {
        resolve(false);
        setConfirmData(null);
      },
    });
  });

  const [showLimpiar, setShowLimpiar] = useState(false);
const [fechaLimite, setFechaLimite] = useState("");
const [limpiando, setLimpiando] = useState(false);


const importar = async () => {
  const ok = await mostrarConfirm("¿Seguro? Esto reemplazará todos los datos actuales con los del backup.");
  if (!ok) return;

  const exito = await importarBackup();
  if (!exito) return;

  await initDB();
  window.location.reload();
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



            <button onClick={() => setShowMantenimiento(true)}>
                ⚙ Mantenimiento
              </button>



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


{confirmData && (
  <div className="confirm-overlay">

    <div className="confirm-box">

      <div className="success-icon">
        ⚠
      </div>

      <h3>{confirmData.titulo}</h3>

      <p>{confirmData.mensaje}</p>

      <div className="confirm-actions">

        {!confirmData.soloAceptar && (
          <button
            className="btn-cancel"
            onClick={confirmData.onCancel}
          >
            Cancelar
          </button>
        )}

        <button
          className="btn-confirm"
          onClick={confirmData.onConfirm}
        >
          {confirmData.soloAceptar ? "Aceptar" : "Sí, continuar"}
        </button>

      </div>

    </div>

  </div>
)}



      {showLimpiar && (
  <div className="confirm-overlay">
    <div className="confirm-box">

      <h3>🗑 Limpiar movimientos</h3>

      <p>
        Seleccione hasta qué fecha desea eliminar movimientos.
      </p>

      <input
        type="date"
        value={fechaLimite}
        onChange={(e) => setFechaLimite(e.target.value)}
        style={{
          width: "100%",
          padding: "10px",
          marginTop: "10px",
          marginBottom: "15px"
        }}
      />

      <div className="confirm-actions">

            <button
              className="btn-cancel"
              onClick={() => {
                setShowLimpiar(false);
                setFechaLimite("");
              }}
            >
              Cancelar
            </button>

            <button
              className="btn-confirm"
              onClick={limpiarBD}
              disabled={limpiando}
            >
              {limpiando ? "Limpiando..." : "Sí, limpiar"}
            </button>

          </div>
        </div>
      </div>
    )}


    {showSuccess && (
  <div className="confirm-overlay">

    <div className="confirm-box success-box">

      <div className="success-icon">
        ✓
      </div>

      <h3>Movimientos eliminados</h3>

      <p>
        Los movimientos fueron eliminados correctamente.
      </p>

      <small>
        La aplicación se reiniciará automáticamente...
      </small>

    </div>

  </div>
)}











{showMantenimiento && (
  <div className="confirm-overlay">

    <div className="confirm-box">

      <h3>⚙ Mantenimiento del sistema</h3>

      <p>
        Seleccione una opción administrativa.
      </p>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          marginTop: "20px"
        }}
      >

        <button
          className="btn-confirm"
          onClick={async () => {

            setShowMantenimiento(false);

            setTimeout(async () => {
              await backup();
            }, 150);

          }}
          disabled={haciendoBackup}
        >
          {haciendoBackup
            ? "⏳ Exportando..."
            : "💾 Exportar base de datos"}
        </button>

        <button
          className="btn-confirm"
          onClick={async () => {

            // cerrar mantenimiento
            setShowMantenimiento(false);

            // pequeña pausa para evitar overlap visual
            setTimeout(async () => {
              await importar();
            }, 150);

          }}
        >
          📂 Importar base de datos
        </button>
        

        {role === "admin" && (
        <button
          className="btn-confirm"
          onClick={() => {
            setShowMantenimiento(false);
            setShowLimpiar(true);
          }}
        >
          🗑 Limpiar movimientos
        </button>
        )}


        

        <button
          className="btn-cancel"
          onClick={() => setShowMantenimiento(false)}
        >
          Cerrar
        </button>

      </div>

    </div>

  </div>
)}
                
    </div>
  );
}

export default App;