import { useEffect, useMemo, useState } from "react";
import {
  obtenerProductos,
  agregarProducto,
  entradaStock,
  salidaStock,
  editarProducto,
  eliminarProducto
} from "../services/db";

import { obtenerMovimientos } from "../services/db";

import { confirm } from "@tauri-apps/plugin-dialog";


import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

function Alimentos({ role }) {
  const [tab, setTab] = useState("inventario");
  const [productos, setProductos] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [busqueda, setBusqueda] = useState("");

  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("ok");

  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoCantidad, setNuevoCantidad] = useState("");

  const [entradaId, setEntradaId] = useState("");
  const [entradaCantidad, setEntradaCantidad] = useState("");
  const [entradaDetalle, setEntradaDetalle] = useState("");

  const [salidaId, setSalidaId] = useState("");
  const [salidaCantidad, setSalidaCantidad] = useState("");
  const [salidaDetalle, setSalidaDetalle] = useState("");

  const [editando, setEditando] = useState(null);
  const [editNombre, setEditNombre] = useState("");
  const [editCantidad, setEditCantidad] = useState("");

  const [fechaInicio, setFechaInicio] = useState("");
const [fechaFin, setFechaFin] = useState("");

const esAdmin = role === "admin";
const esCocina = role === "cocina";



const cancelarEdicion = () => {
  setEditando(null);
  setEditNombre("");
  setEditCantidad("");
};



  const toast = (texto, tipo = "ok") => {
    setMsg(texto);
    setMsgType(tipo);

    setTimeout(() => {
      setMsg("");
    }, 2500);
  };

  const cargar = async () => {
    const data = await obtenerProductos("alimentos");
    setProductos(data);
  };





const cargarHistorial = async () => {
  try {
    const data = await obtenerMovimientos("alimentos");
    setHistorial(data);
  } catch (e) {
    console.error(e);
  }
};






  useEffect(() => {
    cargar();
    cargarHistorial();
  }, []);


  const filtrados = useMemo(() => {
    return productos.filter((p) =>
      p.nombre.toLowerCase().includes(busqueda.toLowerCase())
    );
  }, [productos, busqueda]);

  const existeNombre = (nombre) => {
    return productos.some(
      (p) =>
        p.nombre.trim().toLowerCase() ===
        nombre.trim().toLowerCase()
    );
  };




  const nuevo = async () => {
    const nombre = nuevoNombre.trim();

    if (!nombre) {
      toast("Ingrese nombre", "error");
      return;
    }

    if (existeNombre(nombre)) {
      toast("Ese producto ya existe", "error");
      return;
    }

    await agregarProducto(
      "alimentos",
      nombre,
      Number(nuevoCantidad || 0)
    );

    setNuevoNombre("");
    setNuevoCantidad("");

    await cargar();
    await cargarHistorial();

    setTab("inventario");
    toast("Producto agregado");
  };



  const entrada = async () => {
    if (!entradaId || Number(entradaCantidad) <= 0) {
      toast("Datos inválidos", "error");
      return;
    }

    const usuarioActual = esAdmin ? "admin" : "cocina";

    await entradaStock(
      "alimentos",
      Number(entradaId),
      Number(entradaCantidad),
      entradaDetalle || "Entrada manual",
      usuarioActual
    );

    setEntradaId("");
    setEntradaCantidad("");
    setEntradaDetalle("");

    await cargar();
    await cargarHistorial();

    toast("Entrada registrada");
  };




  const salida = async () => {
    const prod = productos.find(
      (p) => p.id === Number(salidaId)
    );

    if (!prod) {
      toast("Seleccione producto", "error");
      return;
    }

    if (Number(salidaCantidad) <= 0) {
      toast("Cantidad inválida", "error");
      return;
    }

    if (Number(salidaCantidad) > prod.cantidad) {
      toast("Stock insuficiente", "error");
      return;
    }
    const usuarioActual = esAdmin ? "admin" : "cocina";

    await salidaStock(
      "alimentos",
      Number(salidaId),
      Number(salidaCantidad),
      salidaDetalle || "Salida manual",
      usuarioActual
    );

    setSalidaId("");
    setSalidaCantidad("");
    setSalidaDetalle("");

    await cargar();
    await cargarHistorial();

    toast("Salida registrada");
  };




  const abrirEditar = (p) => {
    setEditando(p.id);
    setEditNombre(p.nombre);
    setEditCantidad(p.cantidad);
  };


  const guardarEdicion = async () => {
  const ok = await confirm("¿Guardar cambios del producto?");

  if (!ok) return;

  const nombre = editNombre.trim();

  const repetido = productos.some(
    (p) =>
      p.id !== editando &&
      p.nombre.toLowerCase() === nombre.toLowerCase()
  );

  if (repetido) {
    toast("Ya existe ese nombre", "error");
    return;
  }

  await editarProducto(
    "alimentos",
    editando,
    nombre,
    Number(editCantidad)
  );

  setEditando(null);
  await cargar();

  toast("Producto actualizado");
};

const borrar = async (id) => {
  const ok = await confirm("¿Eliminar producto?");

  if (!ok) return;

  await eliminarProducto("alimentos", id);

  await cargar();

  toast("Producto eliminado");
};


  
const historialFiltrado = useMemo(() => {
  return historial.filter((h) => {
    if (!fechaInicio && !fechaFin) return true;
    if (!h.fecha) return false;

    const fechaDB = new Date(h.fecha).toISOString().slice(0, 10);

    if (fechaInicio && fechaDB < fechaInicio) return false;
    if (fechaFin && fechaDB > fechaFin) return false;

    return true;
  });
}, [historial, fechaInicio, fechaFin]);



// ===== INVENTARIO =====
async function exportarInventarioExcel() {
  const data = productos.map((p) => ({
    Producto: p.nombre,
    Cantidad: p.cantidad
  }));

  const totalUnidades = productos.reduce((acc, p) => acc + p.cantidad, 0);
  const totalProductos = productos.length;

  const ws = XLSX.utils.json_to_sheet([]);

  XLSX.utils.sheet_add_aoa(ws, [
    ["REPORTE DE INVENTARIO"],
    ["CENTRO DIURNO CORAGE Y ESPERANZA"],
    [`Generado: ${new Date().toLocaleString()}`],
    [`Total productos: ${totalProductos}`],
    [`Total unidades: ${totalUnidades}`],
    []
  ], { origin: "A1" });

  XLSX.utils.sheet_add_json(ws, data, { origin: "A7" });

  ws["!cols"] = [{ wch: 35 }, { wch: 15 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventario");

  const buffer = XLSX.write(wb, {
    bookType: "xlsx",
    type: "array"
  });

  const path = await save({
    filters: [{ name: "Excel", extensions: ["xlsx"] }]
  });

  if (!path) return;

  await writeFile(path, new Uint8Array(buffer));
}




async function exportarInventarioPDF() {
  const doc = new jsPDF();

  const totalUnidades = productos.reduce((acc, p) => acc + p.cantidad, 0);
  const totalProductos = productos.length;

  doc.setFontSize(16);
  doc.text("REPORTE DE INVENTARIO", 14, 15);

  doc.setFontSize(12);
  doc.text("CENTRO DIURNO CORAGE Y ESPERANZA", 14, 22);

  doc.setFontSize(10);
  doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 30);
  doc.text(`Total productos: ${totalProductos}`, 14, 36);
  doc.text(`Total unidades: ${totalUnidades}`, 14, 42);

  autoTable(doc, {
    startY: 50,
    head: [["Producto", "Cantidad"]],
    body: productos.map((p) => [p.nombre, p.cantidad])
  });

  const pdfBytes = doc.output("arraybuffer");

  const path = await save({
    filters: [{ name: "PDF", extensions: ["pdf"] }]
  });

  if (!path) return;

  await writeFile(path, new Uint8Array(pdfBytes)); // 🔥 CORREGIDO
}




// ===== HISTORIAL =====
async function exportarHistorialExcel() {
  const data = historialFiltrado.map((h) => ({
    Fecha: h.fecha,
    Producto: h.producto,
    Tipo: h.tipo,
    Cantidad: h.cantidad,
     Usuario: h.usuario,
    Detalle: h.detalle
  }));

  const ws = XLSX.utils.json_to_sheet([]);

  XLSX.utils.sheet_add_aoa(ws, [
    ["REPORTE DE MOVIMIENTOS"],
    ["CENTRO DIURNO CORAGE Y ESPERANZA"],
    [`Generado: ${new Date().toLocaleString()}`],
    []
  ], { origin: "A1" });

  XLSX.utils.sheet_add_json(ws, data, { origin: "A5" });

  ws["!cols"] = [
    { wch: 20 },
    { wch: 25 },
    { wch: 15 },
    { wch: 10 },
    { wch: 30 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Historial");

  const buffer = XLSX.write(wb, {
    bookType: "xlsx",
    type: "array"
  });

  const path = await save({
    filters: [{ name: "Excel", extensions: ["xlsx"] }]
  });

  if (!path) return;

  await writeFile(path, new Uint8Array(buffer));
}



async function exportarHistorialPDF() {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text("REPORTE DE MOVIMIENTOS", 14, 15);

  doc.setFontSize(12);
  doc.text("CENTRO DIURNO CORAGE Y ESPERANZA", 14, 22);

  doc.setFontSize(10);
  doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 30);

  if (fechaInicio && fechaFin) {
    doc.text(`Desde: ${fechaInicio} Hasta: ${fechaFin}`, 14, 36);
  }

  autoTable(doc, {
    startY: 45,
    head: [["Fecha", "Producto", "Tipo", "Cant.", "Usuario", "Detalle"]],
    body: historialFiltrado.map((h) => [
      h.fecha,
      h.producto,
      h.tipo,
      h.cantidad,
      h.usuario,
      h.detalle
    ])
  });

  const pdfBytes = doc.output("arraybuffer");

  const path = await save({
    filters: [{ name: "PDF", extensions: ["pdf"] }]
  });

  if (!path) return;

  await writeFile(path, new Uint8Array(pdfBytes)); 
}


  return (
    <div className="module-wrap">
      <div className="module-top">
        <div>
          <h1>Alimentos</h1>
          <p className="subtext">
            Gestión de inventario alimentario
          </p>
        </div>
      </div>

      {msg && (
        <div
          className={
            msgType === "error"
              ? "toast error"
              : "toast ok"
          }
        >
          {msg}
        </div>
      )}

      <div className="subtabs">
        <button onClick={() => setTab("inventario")}>
          Inventario
        </button>

     {esAdmin && (
        <button onClick={() => setTab("nuevo")}>
            Nuevo
        </button>
        )}

        {esAdmin && (
        <button onClick={() => setTab("entrada")}>
            Entradas
        </button>
        )}

        <button onClick={() => setTab("salida")}>
          Salidas
        </button>

        <button onClick={() => setTab("historial")}>
          Historial
        </button>
      </div>

      {tab === "inventario" && (
        <>
          <input
            className="search"
            placeholder="Buscar producto..."
            value={busqueda}
            onChange={(e) =>
              setBusqueda(e.target.value)
            }
          />
          <div style={{ marginBottom: "10px" }}>


        {esAdmin && (
        <div className="export-buttons">
        <button className="btn-export excel" onClick={exportarInventarioExcel}>
            📊 Excel
        </button>

        <button className="btn-export pdf" onClick={exportarInventarioPDF}>
            📄 PDF
        </button>
        </div>
        )}
        

        </div>

          <div className="table-card">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  {esAdmin && <th>Acciones</th>}
                </tr>
              </thead>

              <tbody>
                {filtrados.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {editando === p.id ? (
                        <input
                          value={editNombre}
                          onChange={(e) =>
                            setEditNombre(
                              e.target.value
                            )
                          }
                        />
                      ) : (
                        p.nombre
                      )}
                    </td>

                    <td>
                      {editando === p.id ? (
                        <input
                          type="number"
                          min="0"
                          value={editCantidad}
                          onChange={(e) =>
                            setEditCantidad(
                              e.target.value
                            )
                          }
                        />
                      ) : (
                        p.cantidad
                      )}
                    </td>

                    {esAdmin && (
                    <td className="actions">
                        {editando === p.id ? (<>
                            <button className="btn-save" onClick={guardarEdicion}>
                              Guardar
                            </button>

                            <button className="btn-cancel" onClick={cancelarEdicion}>
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <button className="btn-edit" onClick={() => abrirEditar(p)}>
                            Editar
                          </button>
                        )}

                        <button
                        className="btn-delete"
                        onClick={() => borrar(p.id)}
                        >
                        Eliminar
                        </button>
                    </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "nuevo" && (
        <div className="form-box">
          <h3>Nuevo Producto</h3>

          <input
            placeholder="Nombre"
            value={nuevoNombre}
            onChange={(e) =>
              setNuevoNombre(e.target.value)
            }
          />

          <input
            type="number"
            min="0"
            placeholder="Cantidad inicial"
            value={nuevoCantidad}
            onChange={(e) =>
              setNuevoCantidad(e.target.value)
            }
          />

          <button onClick={nuevo}>
            Guardar Producto
          </button>
        </div>
      )}

      {tab === "entrada" && (
        <div className="form-box">
          <h3>Registrar Entrada</h3>

          <select
            value={entradaId}
            onChange={(e) =>
              setEntradaId(e.target.value)
            }
          >
            <option value="">
              Seleccione producto
            </option>

            {productos.map((p) => (
              <option
                key={p.id}
                value={p.id}
              >
                {p.nombre}
              </option>
            ))}
          </select>

          <input
            type="number"
            min="1"
            placeholder="Cantidad"
            value={entradaCantidad}
            onChange={(e) =>
              setEntradaCantidad(
                e.target.value
              )
            }
          />

          <input
            placeholder="Detalle"
            value={entradaDetalle}
            onChange={(e) =>
              setEntradaDetalle(
                e.target.value
              )
            }
          />

          <button onClick={entrada}>
            Registrar Entrada
          </button>
        </div>
      )}

      {tab === "salida" && (
        <div className="form-box">
          <h3>Registrar Salida</h3>

          <select
            value={salidaId}
            onChange={(e) =>
              setSalidaId(e.target.value)
            }
          >
            <option value="">
              Seleccione producto
            </option>

            {productos.map((p) => (
              <option
                key={p.id}
                value={p.id}
              >
                {p.nombre}
              </option>
            ))}
          </select>

          <input
            type="number"
            min="1"
            placeholder="Cantidad"
            value={salidaCantidad}
            onChange={(e) =>
              setSalidaCantidad(
                e.target.value
              )
            }
          />

          <input
            placeholder="Detalle"
            value={salidaDetalle}
            onChange={(e) =>
              setSalidaDetalle(
                e.target.value
              )
            }
          />

          <button onClick={salida}>
            Registrar Salida
          </button>
        </div>
      )}

      {tab === "historial" && (
  <>
    <div style={{ marginBottom: "10px" }}>
      <input
        type="date"
        onChange={(e) => setFechaInicio(e.target.value)}
      />

      <input
        type="date"
        onChange={(e) => setFechaFin(e.target.value)}
      />

      <button onClick={exportarHistorialExcel}>
        Excel
      </button>

      <button onClick={exportarHistorialPDF}>
        PDF
      </button>
    </div>

    <div className="table-card">
      <table className="tabla">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Producto</th>
            <th>Tipo</th>
            <th>Cant.</th>
            <th>Usuario</th>
            <th>Detalle</th>
          </tr>
        </thead>

        <tbody>
          {historialFiltrado.map((h) => (
            <tr key={h.id}>
              <td>
                {new Date(h.fecha).toLocaleString("es-CR", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false
                })}
              </td>
              <td>{h.producto}</td>
              <td>{h.tipo}</td>
              <td>{h.cantidad}</td>
              <td>{h.usuario}</td>
              <td>{h.detalle}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </>
)}
    </div>
  );
}

export default Alimentos;