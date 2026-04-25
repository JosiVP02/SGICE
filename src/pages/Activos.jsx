import { useEffect, useMemo, useState } from "react";

import Select from "react-select";
import { confirm } from "@tauri-apps/plugin-dialog";

import * as XLSX from "xlsx";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// 🔥 servicios (ajusta nombres a tu backend)
import {
  obtenerActivos,
  agregarActivo,
  editarActivo,
  eliminarActivo,
  obtenerMovimientos,
  registrarMovimientoActivo
} from "../services/db";



function Activos({ role }) {













const [filtroCategoria, setFiltroCategoria] = useState("");
const [filtroPlaca, setFiltroPlaca] = useState("TODOS"); // TODOS | CON | SIN
const [tab, setTab] = useState("inventario");
const [activos, setActivos] = useState([]);
const [historial, setHistorial] = useState([]);
const [busqueda, setBusqueda] = useState("");

const [msg, setMsg] = useState("");
const [msgType, setMsgType] = useState("ok");






// NUEVO ACTIVO
const [form, setForm] = useState({
  categoria: "",
  articulo: "",
  marca: "",
  modelo: "",
  serie: "",
  placa: "",
  tiene_placa: false,
  fecha: "",
  factura: "",
  ubicacion: "",
  observaciones: "",
  costo: 0,
  vida_util: 0
});

// EDITAR
const [editando, setEditando] = useState(null);

// MOVIMIENTOS
const [movTipo, setMovTipo] = useState("ASIGNACION");
const [movDetalle, setMovDetalle] = useState("");

const esAdmin = role === "admin";




const calcularDepreciacion = (a) => {
  if (!a.costo || !a.vida_util) return 0;

  return (a.costo / a.vida_util).toFixed(2);
};

const calcularValorLibros = (a) => {
  const anual = a.costo / a.vida_util;
  const años = 1; // puedes mejorar con fecha
  return a.costo - anual * años;
};







const cargar = async () => {
  const data = await obtenerActivos();
  setActivos(data);
};

const cargarHistorial = async () => {
  const data = await obtenerMovimientos("activos");
  setHistorial(data);
};

useEffect(() => {
  cargar();
  cargarHistorial();
}, []);




const toast = (texto, tipo = "ok") => {
  setMsg(texto);
  setMsgType(tipo);
  setTimeout(() => setMsg(""), 2500);
};




const crear = async () => {
  if (!form.articulo || !form.categoria) {
    toast("Datos incompletos", "error");
    return;
  }

  await agregarActivo({
    ...form,
    depreciacion_acumulada: calcularDepreciacion(form),
    valor_libros: calcularValorLibros(form),
    estado: "ACTIVO"
  });

  setForm({
    categoria: "",
    articulo: "",
    marca: "",
    modelo: "",
    serie: "",
    placa: "",
    tiene_placa: false,
    fecha: "",
    factura: "",
    ubicacion: "",
    observaciones: "",
    costo: 0,
    vida_util: 0
  });

  await cargar();
  toast("Activo creado");
};




const abrirEditar = (a) => {
  setEditando(a.id);
  setForm(a);
};



const guardarEdicion = async () => {
  const ok = await confirm("¿Guardar cambios?");
  if (!ok) return;

  await editarActivo({
    ...form,
    id: editando
  });

  setEditando(null);
  await cargar();
  toast("Actualizado");
};


const darDeBaja = async (id) => {
  const ok = await confirm("¿Dar de baja este activo?");
  if (!ok) return;

  await eliminarActivo(id, "BAJA");

  await registrarMovimientoActivo({
    activo_id: id,
    tipo: "BAJA",
    detalle: "Activo dado de baja",
    usuario: esAdmin ? "admin" : "usuario"
  });

  await cargar();
  toast("Activo dado de baja");
};


const mover = async (id) => {
  await registrarMovimientoActivo({
    activo_id: id,
    tipo: movTipo,
    detalle: movDetalle,
    usuario: esAdmin ? "admin" : "usuario"
  });

  setMovDetalle("");
  await cargarHistorial();

  toast("Movimiento registrado");
};



const filtrados = useMemo(() => {
  return activos.filter((a) => {
    const matchTexto =
      a.articulo?.toLowerCase().includes(busqueda.toLowerCase());

    const matchCategoria =
      !filtroCategoria || a.categoria === filtroCategoria;

    const matchPlaca =
      filtroPlaca === "TODOS" ||
      (filtroPlaca === "CON" && a.tiene_placa === 1) ||
      (filtroPlaca === "SIN" && a.tiene_placa === 0);

    return a.estado !== "BAJA" && matchTexto && matchCategoria && matchPlaca;
  });
}, [activos, busqueda, filtroCategoria, filtroPlaca]);








  return (
    <div className="module-wrap">

      {/* TOAST */}
      {msg && (
        <div className={msgType === "error" ? "toast error" : "toast ok"}>
          {msg}
        </div>
      )}

      {/* SUBTABS */}
      <div className="subtabs">
        <button onClick={() => setTab("inventario")}>Inventario</button>
        {esAdmin && <button onClick={() => setTab("nuevo")}>Nuevo</button>}
        <button onClick={() => setTab("movimientos")}>Movimientos</button>
        <button onClick={() => setTab("historial")}>Historial</button>
      </div>

      {/* INVENTARIO */}

      <div className="filtros">

        <select onChange={(e) => setFiltroCategoria(e.target.value)}>
            <option value="">Todas categorías</option>
            <option value="JPS">JPS</option>
            <option value="ACE">ACE</option>
            <option value="Ley7999">Ley 7999</option>
            <option value="Ley5662">Ley 5662</option>
        </select>

        <select onChange={(e) => setFiltroPlaca(e.target.value)}>
            <option value="TODOS">Todos</option>
            <option value="CON">Con placa</option>
            <option value="SIN">Sin placa</option>
        </select>

        </div>


      {tab === "inventario" && (
        <table className="tabla">
          <thead>
            <tr>
              <th>Artículo</th>
              <th>Categoría</th>
              <th>Ubicación</th>
              <th>Costo</th>
              <th>Valor Libros</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {filtrados.map((a) => (
              <tr key={a.id}>
                <td>{a.articulo}</td>
                <td>{a.categoria}</td>
                <td>{a.ubicacion}</td>
                <td>{a.costo}</td>
                <td>{a.valor_libros}</td>
                <td>{a.estado}</td>

                <td>
                  <button onClick={() => abrirEditar(a)}>Editar</button>
                  <button onClick={() => mover(a.id)}>Movimiento</button>
                  <button onClick={() => darDeBaja(a.id)}>Baja</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* NUEVO */}
      {tab === "nuevo" && (
        <div className="form-box">
          <h3>Nuevo Activo</h3>

          <Select
            options={[
              { value: "JPS", label: "JPS" },
              { value: "ACE", label: "ACE" },
              { value: "Ley7999", label: "Ley 7999" },
              { value: "Ley5662", label: "Ley 5662" }
            ]}
            onChange={(e) =>
              setForm({ ...form, categoria: e.value })
            }
          />

          <input
            placeholder="Artículo"
            onChange={(e) =>
              setForm({ ...form, articulo: e.target.value })
            }
          />

          <input
            placeholder="Marca"
            onChange={(e) =>
              setForm({ ...form, marca: e.target.value })
            }
          />

          <input
            placeholder="Modelo"
            onChange={(e) =>
              setForm({ ...form, modelo: e.target.value })
            }
          />

          <input
            placeholder="Serie"
            onChange={(e) =>
              setForm({ ...form, serie: e.target.value })
            }
          />

          <input
            placeholder="Placa"
            onChange={(e) =>
              setForm({ ...form, placa: e.target.value })
            }
          />

          <input
            type="number"
            placeholder="Costo"
            onChange={(e) =>
              setForm({ ...form, costo: Number(e.target.value) })
            }
          />

          <input
            type="number"
            placeholder="Vida útil"
            onChange={(e) =>
              setForm({ ...form, vida_util: Number(e.target.value) })
            }
          />

          <input
            placeholder="Ubicación"
            onChange={(e) =>
              setForm({ ...form, ubicacion: e.target.value })
            }
          />

          <button onClick={crear}>Guardar</button>
        </div>
      )}

    </div>
  );
}


export default Activos;