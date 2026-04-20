import { useState, useEffect } from "react";
import "./styles/app.css";
import Alimentos from "./pages/Alimentos";
import { initDB } from "./services/db";

function App() {
  const [logged, setLogged] = useState(false);
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState("");
  const [page, setPage] = useState("dashboard");

    useEffect(() => {
    initDB();
  }, []);

  const login = () => {
    const usuario = user.trim();
    const clave = pass.trim();

    if (!usuario || !clave) {
      setError("Ingrese usuario y contraseña");
      return;
    }

    if (usuario === "admin" && clave === "1234") {
      setRole("admin");
      setLogged(true);
      setPage("dashboard");
      setError("");
    } else if (usuario === "cocina" && clave === "1234") {
      setRole("cocina");
      setLogged(true);
      setPage("alimentos");
      setError("");
    } else {
      setError("Credenciales incorrectas");
    }
  };

  const logout = () => {
    setLogged(false);
    setUser("");
    setPass("");
    setRole("");
    setPage("dashboard");
  };

  const renderPage = () => {
    if (page === "dashboard") return <h1>Dashboard</h1>;

    if (page === "alimentos") return <Alimentos role={role} />;

    if (page === "limpieza")
      return <h1>Módulo Limpieza</h1>;

    if (page === "activos")
      return <h1>Módulo Activos</h1>;

    if (page === "config")
      return <h1>Configuración</h1>;

    return <h1>SGICE</h1>;
  };

  if (!logged) {
    return (
      <div className="login-container">
        <div className="brand">SGICE</div>

        <div className="login-box">
          <div className="logo-circle">S</div>

          <h1>Bienvenido</h1>
          <p>
            Sistema Gestor de Inventarios
          </p>

          <input
            type="text"
            placeholder="Usuario"
            value={user}
            onChange={(e) =>
              setUser(e.target.value)
            }
          />

          <input
            type="password"
            placeholder="Contraseña"
            value={pass}
            onChange={(e) =>
              setPass(e.target.value)
            }
            onKeyDown={(e) =>
              e.key === "Enter" && login()
            }
          />

          {error && (
            <p className="error-msg">
              {error}
            </p>
          )}

          <button onClick={login}>
            Ingresar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="sidebar">
        <h2>SGICE</h2>

        {role === "admin" && (
          <>
            <button
              onClick={() =>
                setPage("dashboard")
              }
            >
              Dashboard
            </button>

            <button
              onClick={() =>
                setPage("alimentos")
              }
            >
              Alimentos
            </button>

            <button
              onClick={() =>
                setPage("limpieza")
              }
            >
              Limpieza
            </button>

            <button
              onClick={() =>
                setPage("activos")
              }
            >
              Activos
            </button>

            <button
              onClick={() =>
                setPage("config")
              }
            >
              Configuración
            </button>
          </>
        )}

        {role === "cocina" && (
          <>
            <button
              onClick={() =>
                setPage("alimentos")
              }
            >
              Alimentos
            </button>

            <button
              onClick={() =>
                setPage("limpieza")
              }
            >
              Limpieza
            </button>
          </>
        )}

        <button onClick={logout}>
          Salir
        </button>
      </div>

      <div className="content">
        {renderPage()}
      </div>
    </div>
  );
}

export default App;