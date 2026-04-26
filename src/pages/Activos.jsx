import { useEffect, useMemo, useState } from "react";
import Select from "react-select";
import { confirm } from "@tauri-apps/plugin-dialog";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

import {
  obtenerActivos,
  agregarActivo,
  editarActivo,
  eliminarActivo,
  registrarBitacoraActivo,
  obtenerBitacoraActivos
} from "../services/db";




function Activos({ role }) {

  // =========================
  // ESTADO
  // =========================

  const initialForm = {
    categoria: "",
    articulo: "",
    marca: "",
    modelo: "",
    serie: "",
    placa: "",
    tiene_placa: false,

    fecha_adquisicion: "",
    factura: "",
    ubicacion: "",
    observaciones: "",

    costo: 0,
    vida_util: 0
  };

  const [form, setForm] = useState(initialForm);
  const [activos, setActivos] = useState([]);
  const [historial, setHistorial] = useState([]);

  const [tab, setTab] = useState("inventario");

  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroPlaca, setFiltroPlaca] = useState("TODOS");

  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("ok");

  const [editando, setEditando] = useState(null);

  const esAdmin = role === "admin";


  const [filtroEstado, setFiltroEstado] = useState("");


const [fechaInicio, setFechaInicio] = useState("");
const [fechaFin, setFechaFin] = useState("");


const [busquedaMov, setBusquedaMov] = useState("");
const [filtroCategoriaMov, setFiltroCategoriaMov] = useState("");
const [filtroEstadoMov, setFiltroEstadoMov] = useState("");
const [filtroPlacaMov, setFiltroPlacaMov] = useState("TODOS");





useEffect(() => {
  if (tab === "movimientos") {
    setBusquedaMov("");
    setFiltroCategoriaMov("");
    setFiltroEstadoMov("");
    setFiltroPlacaMov("TODOS");
  }

  if (tab === "inventario") {
    setBusqueda("");
    setFiltroCategoria("");
    setFiltroEstado(""); // 👈 importante
    setFiltroPlaca("TODOS");
  }

  if (tab === "historial") {
    setFechaInicio("");
    setFechaFin("");
     cargarHistorial();
  }
}, [tab]);


useEffect(() => {
  cargar();
  cargarHistorial();
}, []);












  // =========================
  // FECHAS / DEPRECIACIÓN
  // =========================

const mesesEntre = (fecha) => {
  if (!fecha) return 0;

  const f = new Date(fecha.replace(" ", "T")); // 🔥 FIX IMPORTANTE
  const h = new Date();

  return (
    (h.getFullYear() - f.getFullYear()) * 12 +
    (h.getMonth() - f.getMonth())
  );
};

  const depreciacionMensual = (costo, vida) => {
    if (!costo || !vida) return 0;
    return costo / (vida * 12);
  };






const depreciacionAcumulada = (a) => {
  const costo = Number(a.costo_original ?? a.costo ?? 0);
  const vida = Number(a.vida_util_anios ?? a.vida_util ?? 0);

  if (!a.fecha_adquisicion || costo <= 0 || vida <= 0) return 0;

  const meses = mesesEntre(a.fecha_adquisicion);
  const mensual = costo / (vida * 12);

  const maxMeses = vida * 12;
  const usados = Math.min(meses, maxMeses);

  return +(mensual * usados).toFixed(2);
};

const valorLibros = (a) => {
  const costo = Number(a.costo_original ?? a.costo ?? 0);
  const valor = costo - depreciacionAcumulada(a);

  return valor < 0 ? 0 : +valor.toFixed(2);
};


  // =========================
  // CARGA
  // =========================

  const cargar = async () => {
    setActivos(await obtenerActivos());
  };






const cargarHistorial = async () => {
  setHistorial(await obtenerBitacoraActivos());
};





  useEffect(() => {
    cargar();
    cargarHistorial();
  }, []);

  // =========================
  // TOAST
  // =========================

  const toast = (text, type = "ok") => {
    setMsg(text);
    setMsgType(type);
    setTimeout(() => setMsg(""), 2500);
  };

  // =========================
  // CREAR / EDITAR
  // =========================

const guardar = async () => {

  if (!form.articulo || !form.categoria || !form.fecha_adquisicion) {
    toast("Faltan datos", "error");
    return;
  }

  const ok = await confirm("¿Desea registrar este activo?");
  if (!ok) return;

    const payload = {
    categoria: form.categoria,
    articulo: form.articulo,
    marca: form.marca,
    modelo: form.modelo,
    serie: form.serie,
    placa: form.placa,
    tiene_placa: form.tiene_placa,

    fecha_adquisicion: form.fecha_adquisicion,
    factura: form.factura,
    ubicacion: form.ubicacion,
    observaciones: form.observaciones,

    costo_original: form.costo,
    vida_util_anios: form.vida_util,

    depreciacion_mensual: depreciacionMensual(form.costo, form.vida_util),
    depreciacion_acumulada: depreciacionAcumulada({
        ...form,
        fecha_adquisicion: form.fecha_adquisicion
    }),
    valor_libros: valorLibros({
        ...form,
        fecha_adquisicion: form.fecha_adquisicion
    }),

    estado: "ACTIVO"
    };

    if (editando) {
      await editarActivo({ ...payload, id: editando });
      toast("Actualizado");
    } else {


      const res = await agregarActivo(payload);

        const nuevos = await obtenerActivos();
        const ultimo = nuevos[0];

        await registrarBitacoraActivo({
        activo_id: ultimo.id,
        tipo: "CREACION",
        detalle: "Activo registrado",
        usuario: esAdmin ? "admin" : "usuario"
        });
        toast("Activo creado correctamente");
    }

    setForm(initialForm);
    setEditando(null);
    await cargar();
    await cargarHistorial();

  };

  // =========================
  // EDITAR
  // =========================

  const abrirEditar = (a) => {
    setEditando(a.id);
    setForm({
    categoria: a.categoria,
    articulo: a.articulo,
    marca: a.marca,
    modelo: a.modelo,
    serie: a.serie,
    placa: a.placa,
    tiene_placa: Boolean(a.tiene_placa),

    fecha_adquisicion: a.fecha_adquisicion,
    factura: a.factura,
    ubicacion: a.ubicacion,
    observaciones: a.observaciones,

    costo: a.costo_original,
    vida_util: a.vida_util_anios
    });
    setTab("nuevo");
  };

  // =========================
  // BAJA
  // =========================

  const darDeBaja = async (id) => {
    const ok = await confirm("¿Dar de baja?");
    if (!ok) return;

    await eliminarActivo(id, "BAJA");

    await registrarBitacoraActivo({
  activo_id: id,
  tipo: "BAJA",
  detalle: "Activo dado de baja",
  usuario: esAdmin ? "admin" : "usuario"
});

    await cargar();
    await cargarHistorial();
    toast("Baja realizada");
  };

  // =========================
  // SALIDA (NUEVO - TE FALTABA)
  // =========================

  const registrarSalida = async (id) => {
    const ok = await confirm("¿Registrar salida del activo?");
    if (!ok) return;

    await registrarBitacoraActivo({
      activo_id: id,
      tipo: "SALIDA",
      detalle: "Salida de activo",
      usuario: esAdmin ? "admin" : "usuario"
    });

    toast("Salida registrada");
    await cargarHistorial();
  };

  // =========================
  // FILTROS
  // =========================

  const filtrados = useMemo(() => {
  return activos.filter((a) => {

    const txt = a.articulo?.toLowerCase().includes(busqueda.toLowerCase());

    const cat = !filtroCategoria || a.categoria === filtroCategoria;

    const estadoOk =
    !filtroEstado || a.estado === filtroEstado;
    const placa =
      filtroPlaca === "TODOS" ||
      (filtroPlaca === "CON" && Number(a.tiene_placa) === 1) ||
      (filtroPlaca === "SIN" && Number(a.tiene_placa) === 0);

    return txt && cat && estadoOk && placa;

  });
}, [activos, busqueda, filtroCategoria, filtroPlaca, filtroEstado]);

  // =========================
  // PDF (EXPORTA FILTRADO)
  // =========================

  const exportPDF = () => {
  const doc = new jsPDF("landscape"); // 👈 importante para muchas columnas

  const fecha = new Date().toLocaleString("es-CR");

  // =========================
  // ENCABEZADO DEL REPORTE
  // =========================
  doc.setFontSize(14);
  doc.text("REPORTE DE ACTIVOS", 14, 15);

  doc.setFontSize(10);

  doc.text(`Fecha del reporte: ${fecha}`, 14, 22);

doc.text(
  `Categoría: ${filtroCategoria || "Todas"} | Placa: ${filtroPlaca} | Estado: ${filtroEstado || "Todos"}`,
  14,
  28
);

  doc.text(`Total registros: ${filtrados.length}`, 14, 34);

  // =========================
  // TABLA
  // =========================
  autoTable(doc, {
    startY: 40,
    theme: "grid",
    headStyles: { fillColor: [30, 30, 30] },

    head: [[
     "Artículo", "Categoría", "Marca", "Modelo",
      "Serie", "Placa", "Factura", "Fecha",
      "Ubicación","Observaciones",  "Costo", "Vida util","Dep. Mensual",
      "Dep. Acum", "Valor", "Estado"
    ]],

    body: filtrados.map(a => [
      a.articulo,
      a.categoria,
      a.marca || "-",
      a.modelo || "-",
      a.serie || "-",
      a.tiene_placa ? a.placa : "SIN",
      a.factura || "-",
      a.fecha_adquisicion,
      a.ubicacion || "-",
      a.observaciones || "-",
      a.costo_original,
      a.vida_util_anios,
      a.depreciacion_mensual,
     depreciacionAcumulada(a),
       valorLibros(a),
      a.estado
    ]),

    styles: {
      fontSize: 8,
      cellPadding: 2
    }
  });

  doc.save("reporte_activos.pdf");
};




const exportExcel = () => {
  const fecha = new Date().toLocaleString("es-CR");

  // =========================
  // DATOS FILTRADOS
  // =========================
  const data = filtrados.map(a => ({
    Articulo: a.articulo,
    Categoria: a.categoria,
    Marca: a.marca || "-",
    Modelo: a.modelo || "-",
    Serie: a.serie || "-",
    Placa: a.tiene_placa ? a.placa : "SIN",
    Factura: a.factura || "-",
    Fecha: a.fecha_adquisicion,
    Ubicacion: a.ubicacion || "-",
    Observaciones: a.observaciones || "-",
    Costo: a.costo_original,
    "Vida util": a.vida_util_anios,
    "Dep Mensual": a.depreciacion_mensual,
    "Dep Acumulada": depreciacionAcumulada(a),
    "Valor Libros": valorLibros(a),
    Estado: a.estado
  }));

  // =========================
  // CREAR HOJA (DESDE FILA 6)
  // =========================
  const ws = XLSX.utils.json_to_sheet(data, { origin: "A6" });

  // =========================
  // ENCABEZADO DEL REPORTE
  // =========================
  XLSX.utils.sheet_add_aoa(ws, [
    ["REPORTE DE ACTIVOS"],
    [`Fecha del reporte: ${fecha}`],
    [
      `Categoría: ${filtroCategoria || "Todas"} | Placa: ${filtroPlaca} | Estado: ${filtroEstado || "Todos"}`
    ],
    [`Total registros: ${filtrados.length}`],
    [] // espacio
  ], { origin: "A1" });

  // =========================
  // CREAR ARCHIVO
  // =========================
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Activos");

  XLSX.writeFile(wb, `reporte_activos.xlsx`);
};





const cambiarUbicacion = async (a) => {
  const nueva = prompt("Nueva ubicación:", a.ubicacion);
  if (!nueva) return;

  await editarActivo({
    ...a,
    ubicacion: nueva,
    fecha: a.fecha_adquisicion
  });

await registrarBitacoraActivo({
  activo_id: a.id,
  tipo: "TRASLADO",
  detalle: `Cambio de ubicación a ${nueva}`,
   usuario: esAdmin ? "admin" : "usuario"
});


  toast("Ubicación actualizada");
  await cargar();
  await cargarHistorial();
};





const cambiarEstado = async (a, estado) => {
  await editarActivo({
    ...a,
    estado,
    fecha: a.fecha_adquisicion
  });

await registrarBitacoraActivo({
  activo_id: a.id,
  tipo: estado,
  detalle: `Cambio de estado a ${estado}`,
  usuario: esAdmin ? "admin" : "usuario"
});

  toast("Estado actualizado");
  await cargar();
  await cargarHistorial();
};






const historialFiltrado = useMemo(() => {
  return historial.filter((h) => {
    const fechaMov = new Date(h.fecha.replace(" ", "T"));

    const desde = fechaInicio
      ? new Date(fechaInicio + "T00:00:00")
      : null;

    const hasta = fechaFin
      ? new Date(fechaFin + "T23:59:59")
      : null;

    const cumpleDesde = !desde || fechaMov >= desde;
    const cumpleHasta = !hasta || fechaMov <= hasta;

    return cumpleDesde && cumpleHasta;
  });
}, [historial, fechaInicio, fechaFin]);












const exportHistorialPDF = () => {
  const doc = new jsPDF("landscape");

  const fecha = new Date().toLocaleString("es-CR");

  doc.setFontSize(14);
  doc.text("HISTORIAL DE MOVIMIENTOS DE ACTIVOS", 14, 15);

  doc.setFontSize(10);
  doc.text(`Fecha del reporte: ${fecha}`, 14, 22);

  doc.text(
    `Desde: ${fechaInicio || "Inicio"} | Hasta: ${fechaFin || "Hoy"}`,
    14,
    28
  );

  doc.text(`Total movimientos: ${historialFiltrado.length}`, 14, 34);

  autoTable(doc, {
    startY: 40,
    theme: "grid",

    head: [[
      "Activo",
      "Placa",
      "Categoria",
      "Tipo",
      "Detalle",
      "Usuario",
      "Fecha"
    ]],

    body: historialFiltrado.map(m => [
      m.articulo,
      m.placa,
      m.categoria,
      m.tipo,
      m.detalle,
      m.usuario,
      m.fecha
    ]),

    styles: {
      fontSize: 9
    }
  });

  doc.save("historial_activos.pdf");
};








const filtradosMovimientos = useMemo(() => {
  return activos.filter((a) => {
    const txt = a.articulo
      ?.toLowerCase()
      .includes(busquedaMov.toLowerCase());

    const cat =
      !filtroCategoriaMov || a.categoria === filtroCategoriaMov;

    const estado =
      !filtroEstadoMov || a.estado === filtroEstadoMov;

    const placa =
      filtroPlacaMov === "TODOS" ||
      (filtroPlacaMov === "CON" && Number(a.tiene_placa) === 1) ||
      (filtroPlacaMov === "SIN" && Number(a.tiene_placa) === 0);

    return txt && cat && estado && placa;
  });
}, [
  activos,
  busquedaMov,
  filtroCategoriaMov,
  filtroEstadoMov,
  filtroPlacaMov
]);



















  // =========================
  // UI
  // =========================

  return (
    <div className="module-wrap">

      {msg && (
        <div className={msgType === "error" ? "toast error" : "toast ok"}>
          {msg}
        </div>
      )}

      {/* NAV SUPERIOR */}
      <div className="subtabs">
        <button onClick={() => setTab("inventario")}>Inventario</button>
        {esAdmin && <button onClick={() => setTab("nuevo")}>Nuevo</button>}
        <button onClick={() => setTab("movimientos")}>Movimientos</button> 
        <button onClick={() => setTab("historial")}> Historial</button>     
        
     </div>

      {/* INVENTARIO */}
      {tab === "inventario" && (
        <>
          <div className="filtros">
            <input
              placeholder="Buscar"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />

            <select onChange={(e) => setFiltroCategoria(e.target.value)}>
              <option value="">Todas</option>
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

           
            <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            >
            <option value="">Todos</option>
            <option value="ACTIVO">Activos</option>
            <option value="DAÑADO">Dañados</option>
            <option value="BAJA">De baja</option>
            </select>


          <button onClick={exportPDF}>Exportar PDF</button>
          <button onClick={exportExcel}>Exportar Excel</button>

          <table className="tabla">
            <thead>
              <tr>
                <th>Artículo</th>
                <th>Categoría</th>
                <th>Marca</th>
                <th>Modelo</th>
                <th>Serie</th>
                <th>Placa</th>
                <th>Factura</th>
                <th>Fecha</th>
                <th>Ubicación</th>
                <th>Observaciones</th>
                <th>Costo</th>
                <th>Vida util</th>
                <th>Dep. Mensual</th>
                <th>Dep. Acum</th>
                <th>Valor en Libros</th>
                <th>Estado</th>
                
              </tr>
            </thead>

            <tbody>
              {filtrados.map((a) => (
                <tr key={a.id}>
                  <td>{a.articulo}</td>
                  <td>{a.categoria}</td>
                  <td>{a.marca}</td>
                  <td>{a.modelo}</td>
                  <td>{a.serie}</td>
                  <td>{a.tiene_placa ? a.placa : "SIN"}</td>
                  <td>{a.factura}</td>
                  <td>{a.fecha_adquisicion}</td>
                  <td>{a.ubicacion}</td>
                  <td>{a.observaciones}</td>
                  <td>{a.costo_original}</td>
                  <td>{a.vida_util_anios}</td>
                  <td>{a.depreciacion_mensual}</td>
                    <td>{depreciacionAcumulada(a)}</td>
                    <td>{valorLibros(a)}</td>
                  <td>{a.estado}</td>

                  
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* AQUÍ SIGUE TU FORM (NO LO ELIMINO) */}
      {tab === "nuevo" && (
        <div className="form-box">
          <h3>{editando ? "Editar" : "Nuevo Activo"}</h3>

          <Select
            options={[
              { value: "JPS", label: "JPS" },
              { value: "ACE", label: "ACE" },
              { value: "Ley7999", label: "Ley 7999" },
              { value: "Ley5662", label: "Ley 5662" }
            ]}
            onChange={(e) => setForm({ ...form, categoria: e.value })}
          />

          <input placeholder="Artículo" value={form.articulo}
            onChange={(e) => setForm({ ...form, articulo: e.target.value })} />
            
            <input
            placeholder="Marca"
            value={form.marca}
            onChange={(e) => setForm({ ...form, marca: e.target.value })}
            />

            <input
            placeholder="Modelo"
            value={form.modelo}
            onChange={(e) => setForm({ ...form, modelo: e.target.value })}
            />

            <input
            placeholder="Serie"
            value={form.serie}
            onChange={(e) => setForm({ ...form, serie: e.target.value })}
            />

          <input
            type="date"
            value={form.fecha_adquisicion}
            onChange={(e) =>
                setForm({ ...form, fecha_adquisicion: e.target.value })
            }
            />

          <input placeholder="Factura" value={form.factura}
            onChange={(e) => setForm({ ...form, factura: e.target.value })} />

          <textarea placeholder="Observaciones"
            value={form.observaciones}
            onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />

          <label>
            <input
              type="checkbox"
              checked={form.tiene_placa}
              onChange={(e) =>
                setForm({ ...form, tiene_placa: e.target.checked, placa: "" })
              }
            />
            Tiene placa
          </label>

          <input disabled={!form.tiene_placa}
            placeholder="Placa"
            value={form.placa}
            onChange={(e) => setForm({ ...form, placa: e.target.value })} />

            <input
            type="number"
            placeholder="Costo"
            value={form.costo}
            onChange={(e) =>
                setForm({ ...form, costo: Number(e.target.value) })
            }
            />

            <input
            type="number"
            placeholder="Vida útil"
            value={form.vida_util}
            onChange={(e) =>
                setForm({ ...form, vida_util: Number(e.target.value) })
            }
            />

            <input
            placeholder="Ubicación"
            value={form.ubicacion}
            onChange={(e) =>
                setForm({ ...form, ubicacion: e.target.value })
            }
            />
            

          <button onClick={guardar}>
            {editando ? "Actualizar" : "Guardar"}
          </button>
        </div>
      )}

      {tab === "movimientos" && (

        
      <div className="form-box">
        <h3>Movimientos de Activos</h3>

        <div className="filtros">

        <input
            placeholder="Buscar activo"
            value={busquedaMov}
            onChange={(e) => setBusquedaMov(e.target.value)}
        />

        <select onChange={(e) => setFiltroCategoriaMov(e.target.value)}>
            <option value="">Todas</option>
            <option value="JPS">JPS</option>
            <option value="ACE">ACE</option>
            <option value="Ley7999">Ley 7999</option>
            <option value="Ley5662">Ley 5662</option>
        </select>

        <select onChange={(e) => setFiltroEstadoMov(e.target.value)}>
            <option value="">Todos</option>
            <option value="ACTIVO">Activos</option>
            <option value="DAÑADO">Dañados</option>
            <option value="BAJA">De baja</option>
        </select>

        <select onChange={(e) => setFiltroPlacaMov(e.target.value)}>
            <option value="TODOS">Todos</option>
            <option value="CON">Con placa</option>
            <option value="SIN">Sin placa</option>
        </select>

        </div>


        <table className="tabla">
        <thead>
            <tr>
            <th>Artículo</th>
             <th>Categoría</th>   
             <th>Placa</th>      
             <th>Ubicación</th>
            <th>Estado</th>
            <th>Acciones</th>
            </tr>
        </thead>


        <tbody>

            {filtradosMovimientos.map((a) => (
            <tr key={a.id}>
                <td>{a.articulo}</td>
                <td>{a.categoria}</td>
                <td>
                {a.tiene_placa ? (
                    <span className="badge placa">{a.placa}</span>
                ) : (
                    <span className="badge sin">SIN</span>
                )}
                </td>
                <td>{a.ubicacion}</td>
                <td>{a.estado}</td>

                <td>
                {/* CAMBIAR UBICACIÓN SIEMPRE */}
                <button onClick={() => cambiarUbicacion(a)}>
                    Ubicación
                </button>

                {/* SOLO SI NO ESTÁ DAÑADO */}
                {a.estado !== "DAÑADO" && (
                    <button onClick={() => cambiarEstado(a, "DAÑADO")}>
                    Dañado
                    </button>
                )}

                {/* SOLO SI NO ESTÁ ACTIVO */}
                {a.estado !== "ACTIVO" && (
                    <button onClick={() => cambiarEstado(a, "ACTIVO")}>
                    Activar
                    </button>
                )}

                {/* SOLO SI NO ESTÁ DE BAJA */}
                {a.estado !== "BAJA" && (
                    <button onClick={() => darDeBaja(a.id)}>
                    Baja
                    </button>
                )}
                </td>



            </tr>
            ))}
        </tbody>
        </table>
    </div>
    )}


    {tab === "historial" && (
  <div className="form-box">
    <h3>Historial de Movimientos</h3>

    <div className="filtros">
  <label>Desde:</label>
  <input
    type="date"
    value={fechaInicio}
    onChange={(e) => setFechaInicio(e.target.value)}
  />

  <label>Hasta:</label>
  <input
    type="date"
    value={fechaFin}
    onChange={(e) => setFechaFin(e.target.value)}
  />
</div>

<button onClick={exportHistorialPDF}>
  Exportar PDF
</button>

    <table className="tabla">
      <thead>
        <tr>
            <th>Artículo</th>
            <th>Placa</th>
            <th>Categoría</th>
            <th>Tipo</th>
            <th>Detalle</th>
            <th>Usuario</th>
            <th>Fecha</th>
        </tr>
        </thead>

        <tbody>
        {historialFiltrado.map((m, i) => (
            <tr key={i}>
            <td>{m.articulo}</td>
            <td>{m.placa}</td>
            <td>{m.categoria}</td>
            <td>{m.tipo}</td>
            <td>{m.detalle}</td>
            <td>{m.usuario}</td>
            <td>{m.fecha}</td>
            </tr>
        ))}
        </tbody>


    </table>
  </div>
)}

    </div>
  );
}

export default Activos;