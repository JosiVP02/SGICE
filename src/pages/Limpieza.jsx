import { useEffect, useMemo, useState } from "react";
import {
  obtenerProductos, agregarProducto, entradaStock,
  salidaStock, editarProducto, eliminarProducto
} from "../services/db";
import Select from "react-select";
import { obtenerMovimientos } from "../services/db";
import { confirm } from "@tauri-apps/plugin-dialog";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { ajusteStock, registrarConteo } from "../services/db";

function Limpieza({ role }) {









  const [tab, setTab]           = useState("inventario");
  const [productos, setProductos] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [busqueda, setBusqueda]   = useState("");
  const [msg, setMsg]             = useState("");
  const [msgType, setMsgType]     = useState("ok");

  const [nuevoNombre,   setNuevoNombre]   = useState("");
  const [nuevoCantidad, setNuevoCantidad] = useState("");

  const [entradaId,      setEntradaId]      = useState("");
  const [entradaCantidad,setEntradaCantidad]= useState("");
  const [entradaDetalle, setEntradaDetalle] = useState("");

  const [entradaFecha, setEntradaFecha] = useState("");

  const [salidaId,       setSalidaId]       = useState("");
  const [salidaCantidad, setSalidaCantidad] = useState("");
  const [salidaDetalle,  setSalidaDetalle]  = useState("");

  const [salidaFecha, setSalidaFecha] = useState("");

  const [editando,    setEditando]    = useState(null);
  const [editNombre,  setEditNombre]  = useState("");
  const [editCantidad,setEditCantidad]= useState("");

  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin,    setFechaFin]    = useState("");

  const [ordenFecha, setOrdenFecha] = useState("desc");

  const esAdmin  = role === "admin";
  const esCocina = role === "cocina";

  const [busquedaConteo,   setBusquedaConteo]   = useState("");
  const [conteo,           setConteo]           = useState([]);
  const [descripcionConteo,setDescripcionConteo]= useState("");









  
const customSelectStyles = {
  control: (base, state) => ({
    ...base,
    backgroundColor: "#020617",
    border: "1.5px solid #1e293b",
    borderRadius: 12,
    padding: "2px",
    boxShadow: state.isFocused ? "0 0 0 2px rgba(99,102,241,0.25)" : "none",
    "&:hover": {
      borderColor: "#6366f1"
    }
  }),

  menu: (base) => ({
    ...base,
    backgroundColor: "#020617",
    border: "1px solid #1e293b",
    borderRadius: 12,
    overflow: "hidden"
  }),

  option: (base, state) => ({
    ...base,
    backgroundColor: state.isFocused ? "#1e293b" : "#020617",
    color: "#e2e8f0",
    cursor: "pointer",
    padding: "10px 14px"
  }),

  singleValue: (base) => ({
    ...base,
    color: "#e2e8f0"
  }),

  placeholder: (base) => ({
    ...base,
    color: "#64748b"
  }),

  input: (base) => ({
    ...base,
    color: "#e2e8f0"
  }),

  dropdownIndicator: (base) => ({
    ...base,
    color: "#94a3b8",
    "&:hover": {
      color: "#e2e8f0"
    }
  }),

  indicatorSeparator: () => ({
    display: "none"
  })
};








const [confirmData, setConfirmData] = useState(null);

const confirm = (mensaje) =>
  new Promise((resolve) => {
    setConfirmData({
      mensaje,
      onConfirm: () => {
        resolve(true);
        setConfirmData(null);
      },
      onCancel: () => {
        resolve(false);
        setConfirmData(null);
      }
    });
  });






  const productosFiltradosConteo = productos.filter(p =>
    p.nombre.toLowerCase().includes(busquedaConteo.toLowerCase())
  );

  const agregarAConteo = (producto) => {
    if (conteo.find(p => p.id === producto.id)) { toast("Ya está agregado", "error"); return; }
    setConteo([...conteo, { id: producto.id, nombre: producto.nombre, actual: producto.cantidad, conteo: "" }]);
  };

  const actualizarConteo = (id, valor) =>
    setConteo(prev => prev.map(p => p.id === id ? { ...p, conteo: Number(valor) } : p));

  const quitarDeConteo = (id) => setConteo(prev => prev.filter(p => p.id !== id));

  const procesarConteo = async () => {
    if (!descripcionConteo.trim()) { toast("Ingrese descripción", "error"); return; }
    const usuarioActual = esAdmin ? "admin" : "cocina";
    let resultados = [];
    for (const item of conteo) {
      if (item.conteo === "" || item.conteo < 0) continue;
      const diferencia = item.conteo - item.actual;
      if (diferencia !== 0) {
        await ajusteStock("limpieza", item.id, item.conteo, "Reajuste", usuarioActual);
        resultados.push({ nombre: item.nombre, anterior: item.actual, nuevo: item.conteo, diferencia });
      }
    }
    await registrarConteo("limpieza", descripcionConteo, usuarioActual);
    await generarPDFConteo(resultados);
    await cargar(); await cargarHistorial();
    setConteo([]); setDescripcionConteo("");
    toast("Conteo registrado correctamente");
  };

  async function generarPDFConteo(resultados) {
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text("REPORTE DE CONTEO FÍSICO", 14, 15);
    doc.setFontSize(12); doc.text("CENTRO DIURNO CORAJE Y ESPERANZA", 14, 22);
    doc.setFontSize(10); doc.text(`Fecha: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(`Descripción: ${descripcionConteo}`, 14, 36);
    if (resultados.length === 0) {
      doc.text("No se registraron diferencias en este conteo.", 14, 50);
    } else {
      autoTable(doc, { startY: 50, head: [["Producto","Anterior","Nuevo","Diferencia"]], body: resultados.map(r=>[r.nombre,r.anterior,r.nuevo,r.diferencia]) });
    }
    const pdfBytes = doc.output("arraybuffer");
    const path = await save({ filters: [{ name: "PDF", extensions: ["pdf"] }] });
    if (!path) return;
    await writeFile(path, new Uint8Array(pdfBytes));
  }

  const cancelarEdicion = () => { setEditando(null); setEditNombre(""); setEditCantidad(""); };

  const toast = (texto, tipo = "ok") => {
    setMsg(texto); setMsgType(tipo);
    setTimeout(() => setMsg(""), 2500);
  };

  const cargar = async () => setProductos(await obtenerProductos("limpieza"));



  
const cargarHistorial = async (desde = "", hasta = "") => {
  try { setHistorial(await obtenerMovimientos("limpieza", { desde, hasta })); } catch (e) { console.error(e); }
};


useEffect(() => {
  cargar();

  // 🔥 Fecha actual
  const hoy = new Date();

  // 🔥 Hace 15 días
  const hace15 = new Date();
  hace15.setDate(hace15.getDate() - 15);

  // formato YYYY-MM-DD
  const format = (f) => f.toISOString().slice(0, 10);

  const desde = format(hace15);
  const hasta = format(hoy);

  // guardar en inputs
  setFechaInicio(desde);
  setFechaFin(hasta);

  // cargar historial filtrado
  cargarHistorial(desde, hasta);

}, []);




  const filtrados = useMemo(() =>
    productos.filter(p => p.nombre.toLowerCase().includes(busqueda.toLowerCase())),
    [productos, busqueda]
  );

  const existeNombre = (nombre) =>
    productos.some(p => p.nombre.trim().toLowerCase() === nombre.trim().toLowerCase());

  const nuevo = async () => {
    const nombre = nuevoNombre.trim();
    if (!nombre) { toast("Ingrese nombre", "error"); return; }
    if (existeNombre(nombre)) { toast("Ese producto ya existe", "error"); return; }
    await agregarProducto("limpieza", nombre, Number(nuevoCantidad || 0));
    setNuevoNombre(""); setNuevoCantidad("");
    await cargar(); await cargarHistorial();
    setTab("inventario"); toast("Producto agregado");
  };

  const entrada = async () => {
    if (!entradaId || Number(entradaCantidad) <= 0) { toast("Datos inválidos", "error"); return; }
    const usuarioActual = esAdmin ? "admin" : "cocina";
    await entradaStock("limpieza", Number(entradaId), Number(entradaCantidad), entradaDetalle || "Entrada manual", usuarioActual, entradaFecha || null);
    setEntradaId(""); setEntradaCantidad(""); setEntradaDetalle("");
    setEntradaFecha("");
    await cargar(); await cargarHistorial(); toast("Entrada registrada");
  };

  const salida = async () => {
    const prod = productos.find(p => p.id === Number(salidaId));
    if (!prod) { toast("Seleccione producto", "error"); return; }
    if (Number(salidaCantidad) <= 0) { toast("Cantidad inválida", "error"); return; }
    if (Number(salidaCantidad) > prod.cantidad) { toast("Stock insuficiente", "error"); return; }
    const usuarioActual = esAdmin ? "admin" : "cocina";
    await salidaStock("limpieza", Number(salidaId), Number(salidaCantidad), salidaDetalle || "Salida manual", usuarioActual, salidaFecha || null);
    setSalidaId(""); setSalidaCantidad(""); setSalidaDetalle("");
    setSalidaFecha("");
    await cargar(); await cargarHistorial(); toast("Salida registrada");
  };

  const abrirEditar = (p) => { setEditando(p.id); setEditNombre(p.nombre); setEditCantidad(p.cantidad); };

  const guardarEdicion = async () => {
    const ok = await confirm("¿Guardar cambios del producto?");
    if (!ok) return;
    const nombre = editNombre.trim();
    const repetido = productos.some(p => p.id !== editando && p.nombre.toLowerCase() === nombre.toLowerCase());
    if (repetido) { toast("Ya existe ese nombre", "error"); return; }
    await editarProducto("limpieza", editando, nombre, Number(editCantidad));
    setEditando(null); await cargar(); toast("Producto actualizado");
  };

  const borrar = async (id) => {
    const ok = await confirm("¿Eliminar producto?");
    if (!ok) return;
    await eliminarProducto("limpieza", id); await cargar();  await cargarHistorial(); toast("Producto eliminado");
  };


const historialFiltrado = useMemo(() => {
  return historial
    .filter(h => {
      if (!fechaInicio && !fechaFin) return true;
      if (!h.fecha) return false;

      const fechaDB = h.fecha.slice(0, 10);

      if (fechaInicio && fechaDB < fechaInicio) return false;
      if (fechaFin && fechaDB > fechaFin) return false;

      return true;
    })
    .sort((a, b) => {
      if (ordenFecha === "asc") {
        return new Date(a.fecha) - new Date(b.fecha);
      }

      return new Date(b.fecha) - new Date(a.fecha);
    });

}, [historial, fechaInicio, fechaFin, ordenFecha]);



  async function exportarInventarioExcel() {
    const data = productos.map(p => ({ Producto: p.nombre, Cantidad: p.cantidad }));
    const totalUnidades = productos.reduce((acc, p) => acc + p.cantidad, 0);
    const ws = XLSX.utils.json_to_sheet([]);
    XLSX.utils.sheet_add_aoa(ws, [["REPORTE DE INVENTARIO"],["CENTRO DIURNO CORAJE Y ESPERANZA"],[`Generado: ${new Date().toLocaleString()}`],[`Total productos: ${productos.length}`],[`Total unidades: ${totalUnidades}`],[]], { origin: "A1" });
    XLSX.utils.sheet_add_json(ws, data, { origin: "A7" });
    ws["!cols"] = [{ wch: 35 }, { wch: 15 }];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Inventario");
    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const path = await save({ filters: [{ name: "Excel", extensions: ["xlsx"] }] });
    if (!path) return; await writeFile(path, new Uint8Array(buffer));
  }

  async function exportarInventarioPDF() {
    const doc = new jsPDF();
    const totalUnidades = productos.reduce((acc, p) => acc + p.cantidad, 0);
    doc.setFontSize(16); doc.text("REPORTE DE INVENTARIO", 14, 15);
    doc.setFontSize(12); doc.text("CENTRO DIURNO CORAJE Y ESPERANZA", 14, 22);
    doc.setFontSize(10); doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(`Total productos: ${productos.length}`, 14, 36); doc.text(`Total unidades: ${totalUnidades}`, 14, 42);
    autoTable(doc, { startY: 50, head: [["Producto","Cantidad"]], body: productos.map(p=>[p.nombre,p.cantidad]) });
    const pdfBytes = doc.output("arraybuffer");
    const path = await save({ filters: [{ name: "PDF", extensions: ["pdf"] }] });
    if (!path) return; await writeFile(path, new Uint8Array(pdfBytes));
  }

  async function exportarHistorialExcel() {
    const data = historialFiltrado.map(h => ({ Fecha:h.fecha,Producto:h.producto,Tipo:h.tipo,Cantidad:h.cantidad,Usuario:h.usuario,Detalle:h.detalle }));
    const ws = XLSX.utils.json_to_sheet([]);
    XLSX.utils.sheet_add_aoa(ws, [["REPORTE DE MOVIMIENTOS"],["CENTRO DIURNO CORAJE Y ESPERANZA"],[`Generado: ${new Date().toLocaleString()}`],[]], { origin: "A1" });
    XLSX.utils.sheet_add_json(ws, data, { origin: "A5" });
    ws["!cols"] = [{ wch:20 },{ wch:25 },{ wch:15 },{ wch:10 },{ wch:30 }];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Historial");
    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const path = await save({ filters: [{ name: "Excel", extensions: ["xlsx"] }] });
    if (!path) return; await writeFile(path, new Uint8Array(buffer));
  }

  async function exportarHistorialPDF() {
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text("REPORTE DE MOVIMIENTOS", 14, 15);
    doc.setFontSize(12); doc.text("CENTRO DIURNO CORAJE Y ESPERANZA", 14, 22);
    doc.setFontSize(10); doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 30);
    if (fechaInicio && fechaFin) doc.text(`Desde: ${fechaInicio} Hasta: ${fechaFin}`, 14, 36);
    autoTable(doc, { startY: 45, head: [["Fecha","Producto","Tipo","Cant.","Usuario","Detalle"]], body: historialFiltrado.map(h=>[h.fecha,h.producto,h.tipo,h.cantidad,h.usuario,h.detalle]) });
    const pdfBytes = doc.output("arraybuffer");
    const path = await save({ filters: [{ name: "PDF", extensions: ["pdf"] }] });
    if (!path) return; await writeFile(path, new Uint8Array(pdfBytes));
  }

  const tipoBadge = (tipo) => {
    if (!tipo) return null;
    const t = tipo.toLowerCase();
    if (t === "entrada") return <span className="badge entrada">Entrada</span>;
    if (t === "salida")  return <span className="badge salida">Salida</span>;
    if (t === "ajuste" || t === "reajuste") return <span className="badge ajuste">Ajuste</span>;
    if (t === "conteo")  return <span className="badge conteo">Conteo</span>;
    return <span className="badge">{tipo}</span>;
  };

  return (
    <div className="module-wrap">
      <div className="module-top">
        <div>
          <h1>Limpieza</h1>
          <p className="subtext">Gestión de artículos de limpieza</p>
        </div>
      </div>

      {msg && <div className={`toast ${msgType}`}>{msg}</div>}

      <div className="subtabs">
        <button className={tab==="inventario"?"tab-active":""} onClick={()=>setTab("inventario")}>Inventario</button>
        {esAdmin && <button className={tab==="nuevo"?"tab-active":""} onClick={()=>setTab("nuevo")}>Nuevo</button>}
        <button className={tab==="entrada"?"tab-active":""} onClick={()=>setTab("entrada")}>Entradas</button>
        <button className={tab==="salida"?"tab-active":""} onClick={()=>setTab("salida")}>Salidas</button>
        {esAdmin && <button className={tab==="conteo"?"tab-active":""} onClick={()=>setTab("conteo")}>Conteo Físico</button>}
        <button className={tab==="historial"?"tab-active":""} onClick={()=>setTab("historial")}>Historial</button>
      </div>

      {/* ── INVENTARIO ── */}
      {tab === "inventario" && (
        <>
          <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap", marginBottom:16 }}>
            <input className="search" placeholder="Buscar producto..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} style={{marginBottom:0}} />
            {esAdmin && (
              <div className="export-buttons" style={{marginLeft:"auto"}}>
                <button className="btn-export excel" onClick={exportarInventarioExcel}>📊 Excel</button>
                <button className="btn-export pdf"   onClick={exportarInventarioPDF}>📄 PDF</button>
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
                {filtrados.map(p => (
                  <tr key={p.id}>
                    <td>
                      {editando===p.id
                        ? <input value={editNombre} onChange={e=>setEditNombre(e.target.value)} />
                        : <strong>{p.nombre}</strong>}
                    </td>
                    <td>
                      {editando===p.id
                        ? <input type="number" min="0" value={editCantidad} onChange={e=>setEditCantidad(e.target.value)} />
                        : <span style={{fontFamily:"'DM Mono',monospace",fontWeight:600}}>{p.cantidad}</span>}
                    </td>
                    {esAdmin && (
                      <td>
                        <div className="actions">
                          {editando===p.id ? (
                            <>
                              <button className="btn-save"   onClick={guardarEdicion}>Guardar</button>
                              <button className="btn-cancel" onClick={cancelarEdicion}>Cancelar</button>
                            </>
                          ) : (
                            <button className="btn-edit" onClick={()=>abrirEditar(p)}>Editar</button>
                          )}
                          <button className="btn-delete" onClick={()=>borrar(p.id)}>Eliminar</button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {filtrados.length === 0 && (
                  <tr><td colSpan={esAdmin?3:2} style={{textAlign:"center",padding:"32px 16px",color:"var(--text3)"}}>
                    No se encontraron productos
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── NUEVO ── */}
      {tab === "nuevo" && (
        <div className="form-box">
          <h3>Nuevo Producto</h3>
          <label className="form-label">Nombre *</label>
          <input placeholder="" value={nuevoNombre} onChange={e=>setNuevoNombre(e.target.value)} />
          <label className="form-label">Cantidad inicial</label>
          <input type="number" min="0" placeholder="0" value={nuevoCantidad} onChange={e=>setNuevoCantidad(e.target.value)} />
          <button onClick={nuevo}>Guardar Producto</button>
        </div>
      )}

      {/* ── ENTRADA ── */}
      {tab === "entrada" && (
        <div className="form-box">
          <h3>Registrar Entrada</h3>
          <label className="form-label">Producto *</label>
          <Select
            placeholder="Seleccione producto..."
            value={productos.map(p=>({value:p.id,label:p.nombre})).find(opt=>opt.value===Number(entradaId))||null}
            onChange={sel=>setEntradaId(sel?.value||"")}
            options={productos.map(p=>({value:p.id,label:p.nombre}))}
            isSearchable
            styles={customSelectStyles}
          />


          <label className="form-label">Cantidad *</label>
          <input type="number" min="1" placeholder="Cantidad" value={entradaCantidad} onChange={e=>setEntradaCantidad(e.target.value)} />
          <label className="form-label">Detalle</label>
          <input placeholder="" value={entradaDetalle} onChange={e=>setEntradaDetalle(e.target.value)} />

          <label className="form-label">Fecha (opcional)</label>

            <input
              type="date"
              value={entradaFecha}
              onChange={e => setEntradaFecha(e.target.value)}
            />

          <button onClick={entrada}>Registrar Entrada</button>
        </div>
      )}

      {/* ── SALIDA ── */}
      {tab === "salida" && (
        <div className="form-box">
          <h3>Registrar Salida</h3>
          <label className="form-label">Producto *</label>
          <Select
            placeholder="Seleccione producto..."
            value={productos.map(p=>({value:p.id,label:p.nombre})).find(opt=>opt.value===Number(salidaId))||null}
            onChange={sel=>setSalidaId(sel?.value||"")}
            options={productos.map(p=>({value:p.id,label:p.nombre}))}
            isSearchable
            styles={customSelectStyles}         
            
          />
          <label className="form-label">Cantidad *</label>
          <input type="number" min="1" placeholder="Cantidad" value={salidaCantidad} onChange={e=>setSalidaCantidad(e.target.value)} />
          <label className="form-label">Detalle</label>
          <input placeholder="" value={salidaDetalle} onChange={e=>setSalidaDetalle(e.target.value)} />

          <label className="form-label">Fecha (opcional)</label>

            <input
              type="date"
              value={salidaFecha}
              onChange={e => setSalidaFecha(e.target.value)}
            />

          <button onClick={salida}>Registrar Salida</button>
        </div>
      )}

      {/* ── HISTORIAL ── */}
      {tab === "historial" && (
        <>
          <div className="filtros-card">
            <div className="filtros-fecha">
              <div className="grupo-fecha">
                <span>Desde</span>
                  <input type="date" value={fechaInicio} onChange={async e => {
                    setFechaInicio(e.target.value);
                    await cargarHistorial(e.target.value, fechaFin);
                  }} />              </div>
              <div className="grupo-fecha">
                <span>Hasta</span>
                <input type="date" value={fechaFin} onChange={async e => {
                  setFechaFin(e.target.value);
                  await cargarHistorial(fechaInicio, e.target.value);
                }} />              
                </div>


              <div className="grupo-fecha">
                <span>Orden</span>

                <select
                  value={ordenFecha}
                  onChange={e => setOrdenFecha(e.target.value)}
                >
                  <option value="desc">⬇ Más reciente</option>
                  <option value="asc">⬆ Más antiguo</option>
                </select>
              </div>

              <button
                className="btn-clear"
                onClick={() => {
                  const hoy = new Date();

                  // 🔥 hace 15 días
                  const hace15 = new Date();
                  hace15.setDate(hace15.getDate() - 15);

                  // formato YYYY-MM-DD
                  const format = (f) => f.toISOString().slice(0, 10);

                  const desde = format(hace15);
                  const hasta = format(hoy);

                  // actualizar estados
                  setFechaInicio(desde);
                  setFechaFin(hasta);

                  setOrdenFecha("desc");

                  // recargar historial
                  cargarHistorial(desde, hasta);
                }}
              >
                Limpiar
              </button>
              
              <div className="export-buttons">
                <button className="btn-export excel" onClick={exportarHistorialExcel}>📊 Excel</button>
                <button className="btn-export pdf"   onClick={exportarHistorialPDF}>📄 PDF</button>
              </div>
            </div>
          </div>
          <div className="table-card">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fecha</th><th>Producto</th><th>Tipo</th>
                  <th>Cant.</th><th>Usuario</th><th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {historialFiltrado.map(h => (
                  <tr key={h.id}>
                    <td style={{fontFamily:"'DM Mono',monospace",fontSize:12}}>
                      {new Date(h.fecha).toLocaleString("es-CR",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false})}
                    </td>
                    <td><strong>{h.producto}</strong></td>
                    <td>{tipoBadge(h.tipo)}</td>
                    <td style={{fontFamily:"'DM Mono',monospace",fontWeight:600}}>{h.cantidad}</td>
                    <td>{h.usuario}</td>
                    <td style={{color:"var(--text2)"}}>{h.detalle}</td>
                  </tr>
                ))}
                {historialFiltrado.length===0 && (
                  <tr><td colSpan={6} style={{textAlign:"center",padding:"32px",color:"var(--text3)"}}>Sin movimientos en este rango</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── CONTEO ── */}
      {tab === "conteo" && (
        <div className="form-box" style={{maxWidth:800}}>
          <h3>Conteo Físico</h3>
          <label className="form-label">Descripción del conteo *</label>
          <input placeholder="Ej: Conteo mensual enero" value={descripcionConteo} onChange={e=>setDescripcionConteo(e.target.value)} />
          <label className="form-label">Buscar y agregar productos</label>
          <input className="search" style={{maxWidth:"100%",marginBottom:12}} placeholder="Buscar producto..." value={busquedaConteo} onChange={e=>setBusquedaConteo(e.target.value)} />
          {busquedaConteo && (
            <div className="table-card" style={{marginBottom:14}}>
              <table className="tabla">
                <tbody>
                  {productosFiltradosConteo.map(p => (
                    <tr key={p.id}>
                      <td>{p.nombre}</td>
                      <td style={{textAlign:"right"}}>
                        <button className="btn-action" onClick={()=>agregarAConteo(p)}>+ Agregar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="table-card" style={{marginBottom:16}}>
            <table className="tabla">
              <thead>
                <tr><th>Producto</th><th>Stock actual</th><th>Cantidad contada</th><th></th></tr>
              </thead>
              <tbody>
                {conteo.map(p => (
                  <tr key={p.id}>
                    <td><strong>{p.nombre}</strong></td>
                    <td style={{fontFamily:"'DM Mono',monospace"}}>{p.actual}</td>
                    <td>
                      <input type="number" value={p.conteo} onChange={e=>actualizarConteo(p.id,e.target.value)} style={{width:100}} />
                    </td>
                    <td><button className="btn-delete" onClick={()=>quitarDeConteo(p.id)}>Quitar</button></td>
                  </tr>
                ))}
                {conteo.length===0 && (
                  <tr><td colSpan={4} style={{textAlign:"center",padding:"24px",color:"var(--text3)"}}>Agregue productos con el buscador</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <button onClick={procesarConteo}>Procesar Conteo</button>
        </div>
      )}

  {confirmData && (
  <div className="confirm-overlay">
    <div className="confirm-box">
      <h3>Confirmación</h3>
      <p>{confirmData.mensaje}</p>

      <div className="confirm-actions">
        <button className="btn-cancel" onClick={confirmData.onCancel}>
          Cancelar
        </button>
        <button className="btn-confirm" onClick={confirmData.onConfirm}>
          {confirmData.textConfirm || "Confirmar"}
        </button>
        
      </div>
    </div>
  </div>



)}



    </div>
  );
}

export default Limpieza;