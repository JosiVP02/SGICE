import { useEffect, useMemo, useState } from "react";
import Select from "react-select";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
  obtenerActivos, agregarActivo, editarActivo, eliminarActivo,
  registrarBitacoraActivo, obtenerBitacoraActivos, eliminarActivoPerma
} from "../services/db";










function Activos({ role }) {
  const initialForm = { categoria:"",articulo:"",marca:"",modelo:"",serie:"",placa:"",tiene_placa:false,fecha_adquisicion:"",factura:"",ubicacion:"",observaciones:"",costo:0,vida_util:0 };







  const [form,     setForm]     = useState(initialForm);
  const [activos,  setActivos]  = useState([]);
  const [historial,setHistorial]= useState([]);
  const [tab,      setTab]      = useState("inventario");
  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroPlaca,     setFiltroPlaca]     = useState("TODOS");
  const [filtroEstado,    setFiltroEstado]    = useState("");
  const [msg,    setMsg]    = useState("");
  const [msgType,setMsgType]= useState("ok");
  const [editando,setEditando]= useState(null);
  const esAdmin = role === "admin";
  const [fechaInicio,setFechaInicio]= useState("");
  const [fechaFin,   setFechaFin]   = useState("");
  const [busquedaMov,        setBusquedaMov]        = useState("");
  const [filtroCategoriaMov, setFiltroCategoriaMov] = useState("");
  const [filtroEstadoMov,    setFiltroEstadoMov]    = useState("");
  const [filtroPlacaMov,     setFiltroPlacaMov]     = useState("TODOS");



const [inputModal, setInputModal] = useState(null);




const pedirUbicacion = (mensaje, valorInicial = "") =>
  new Promise((resolve) => {
    setInputModal({
      mensaje,
      value: valorInicial,
      onConfirm: (valor) => {
        resolve(valor);
        setInputModal(null);
      },
      onCancel: () => {
        resolve(null);
        setInputModal(null);
      }
    });
  });


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















  useEffect(() => {
    if (tab==="movimientos") { setBusquedaMov(""); setFiltroCategoriaMov(""); setFiltroEstadoMov(""); setFiltroPlacaMov("TODOS"); }
    if (tab==="inventario")  { setBusqueda(""); setFiltroCategoria(""); setFiltroEstado(""); setFiltroPlaca("TODOS"); }
    if (tab==="historial")   { setFechaInicio(""); setFechaFin(""); cargarHistorial(); }
  }, [tab]);




  useEffect(() => { cargar(); cargarHistorial(); }, []);





  const mesesEntre = (fecha) => {
    if (!fecha) return 0;
    const f = new Date(fecha.replace(" ","T")), h = new Date();
    return (h.getFullYear()-f.getFullYear())*12 + (h.getMonth()-f.getMonth());
  };





  const depreciacionMensual   = (costo, vida) => (!costo||!vida) ? 0 : costo/(vida*12);
  const depreciacionAcumulada = (a) => {
    const costo=Number(a.costo_original??a.costo??0), vida=Number(a.vida_util_anios??a.vida_util??0);
    if (!a.fecha_adquisicion||costo<=0||vida<=0) return 0;
    const meses=mesesEntre(a.fecha_adquisicion), mensual=costo/(vida*12);
    return +(mensual*Math.min(meses,vida*12)).toFixed(2);
  };
  const valorLibros = (a) => { const v=Number(a.costo_original??a.costo??0)-depreciacionAcumulada(a); return v<0?0:+v.toFixed(2); };





  const cargar         = async () => setActivos(await obtenerActivos());
  const cargarHistorial= async () => setHistorial(await obtenerBitacoraActivos());
  const toast = (text,type="ok") => { setMsg(text); setMsgType(type); setTimeout(()=>setMsg(""),2500); };





  const guardar = async () => {
    if (!form.articulo||!form.categoria||!form.fecha_adquisicion) { toast("Faltan datos","error"); return; }
    const ok = await confirm("¿Desea registrar este activo?");
    if (!ok) return;
    const payload = {
      categoria:form.categoria, articulo:form.articulo, marca:form.marca, modelo:form.modelo,
      serie:form.serie, placa:form.placa, tiene_placa:form.tiene_placa,
      fecha_adquisicion:form.fecha_adquisicion, factura:form.factura,
      ubicacion:form.ubicacion, observaciones:form.observaciones,
      costo_original:form.costo, vida_util_anios:form.vida_util,
      depreciacion_mensual:depreciacionMensual(form.costo,form.vida_util),
      depreciacion_acumulada:depreciacionAcumulada({...form,fecha_adquisicion:form.fecha_adquisicion}),
      valor_libros:valorLibros({...form,fecha_adquisicion:form.fecha_adquisicion}),
      estado:"ACTIVO"
    };
    if (editando) {
      await editarActivo({...payload,id:editando}); toast("Actualizado");
    } else {
      await agregarActivo(payload);
      const nuevos=await obtenerActivos(), ultimo=nuevos[0];
      await registrarBitacoraActivo({activo_id:ultimo.id,tipo:"CREACION",detalle:"Activo registrado",usuario:esAdmin?"admin":"usuario"});
      toast("Activo creado correctamente");
    }
    setForm(initialForm); setEditando(null); await cargar(); await cargarHistorial();
  };





  const abrirEditar = (a) => {
    setEditando(a.id);
    setForm({categoria:a.categoria,articulo:a.articulo,marca:a.marca,modelo:a.modelo,serie:a.serie,placa:a.placa,tiene_placa:Boolean(a.tiene_placa),fecha_adquisicion:a.fecha_adquisicion,factura:a.factura,ubicacion:a.ubicacion,observaciones:a.observaciones,costo:a.costo_original,vida_util:a.vida_util_anios});
    setTab("nuevo");
  };





  const darDeBaja = async (id) => {
    const ok=await confirm("¿Dar de baja?"); if(!ok)return;
    await eliminarActivo(id,"BAJA");
    await registrarBitacoraActivo({activo_id:id,tipo:"BAJA",detalle:"Activo dado de baja",usuario:esAdmin?"admin":"usuario"});
    await cargar(); await cargarHistorial(); toast("Baja realizada");
  };





const cambiarUbicacion = async (a) => {
  const nueva = await pedirUbicacion("Nueva ubicación del activo", a.ubicacion);
  if (!nueva) return;



  const ok = await confirm(`¿Desea cambiar la ubicación a "${nueva}"?`);
  if (!ok) return;

  await editarActivo({...a, ubicacion: nueva, fecha: a.fecha_adquisicion});

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
  const ok = await confirm(`¿Seguro que desea cambiar el estado a "${estado}"?`);
  if (!ok) return;

  await editarActivo({...a, estado, fecha: a.fecha_adquisicion});

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




  const filtrados = useMemo(() => activos.filter(a => {
    const txt = a.articulo?.toLowerCase().includes(busqueda.toLowerCase());
    const cat = !filtroCategoria||a.categoria===filtroCategoria;
    const estadoOk = !filtroEstado||a.estado===filtroEstado;
    const placa = filtroPlaca==="TODOS"||(filtroPlaca==="CON"&&Number(a.tiene_placa)===1)||(filtroPlaca==="SIN"&&Number(a.tiene_placa)===0);
    return txt&&cat&&estadoOk&&placa;
  }),[activos,busqueda,filtroCategoria,filtroPlaca,filtroEstado]);





  const filtradosMovimientos = useMemo(() => activos.filter(a => {
    const txt = a.articulo?.toLowerCase().includes(busquedaMov.toLowerCase());
    const cat = !filtroCategoriaMov||a.categoria===filtroCategoriaMov;
    const estado = !filtroEstadoMov||a.estado===filtroEstadoMov;
    const placa = filtroPlacaMov==="TODOS"||(filtroPlacaMov==="CON"&&Number(a.tiene_placa)===1)||(filtroPlacaMov==="SIN"&&Number(a.tiene_placa)===0);
    return txt&&cat&&estado&&placa;
  }),[activos,busquedaMov,filtroCategoriaMov,filtroEstadoMov,filtroPlacaMov]);






  const historialFiltrado = useMemo(() => historial.filter(h => {
    const fechaMov=new Date(h.fecha.replace(" ","T"));
    const desde=fechaInicio?new Date(fechaInicio+"T00:00:00"):null;
    const hasta=fechaFin?new Date(fechaFin+"T23:59:59"):null;
    return (!desde||fechaMov>=desde)&&(!hasta||fechaMov<=hasta);
  }),[historial,fechaInicio,fechaFin]);




const exportPDF = () => {
    const doc=new jsPDF("landscape");
    doc.setFontSize(14); doc.text("REPORTE DE ACTIVOS",14,15);
    doc.setFontSize(10); doc.text(`Fecha: ${new Date().toLocaleString("es-CR")}`,14,22);
    doc.text(`Categoría: ${filtroCategoria||"Todas"} | Placa: ${filtroPlaca} | Estado: ${filtroEstado||"Todos"}`,14,28);
    doc.text(`Total: ${filtrados.length}`,14,34);
    autoTable(doc,{startY:40,theme:"grid",headStyles:{fillColor:[30,49,74]},
      head:[["Artículo","Categoría","Marca","Modelo","Serie","Placa","Factura","Fecha","Ubicación","Observaciones","Costo","Vida util","Dep. Mensual","Dep. Acum","Valor en libros","Estado"]],
      body:filtrados.map(a=>[a.articulo,a.categoria,a.marca||"-",a.modelo||"-",a.serie||"-",a.tiene_placa?a.placa:"SIN",a.factura||"-",a.fecha_adquisicion,a.ubicacion||"-",a.observaciones||"-",a.costo_original,a.vida_util_anios,a.depreciacion_mensual,depreciacionAcumulada(a),valorLibros(a),a.estado]),
      styles:{fontSize:7,cellPadding:1.5,overflow:"linebreak"},
      columnStyles:{
        0:{cellWidth:22},  // Artículo
        1:{cellWidth:12},  // Categoría
        2:{cellWidth:18},  // Marca
        3:{cellWidth:18},  // Modelo
        4:{cellWidth:20},  // Serie
        5:{cellWidth:10},  // Placa
        6:{cellWidth:12},  // Factura
        7:{cellWidth:18},  // Fecha
        8:{cellWidth:20},  // Ubicación
        9:{cellWidth:25},  // Observaciones
        10:{cellWidth:18}, // Costo
        11:{cellWidth:10}, // Vida util
        12:{cellWidth:18}, // Dep. Mensual
        13:{cellWidth:18}, // Dep. Acum
        14:{cellWidth:18}, // Valor en libros
        15:{cellWidth:12}, // Estado
      }
    });
    doc.save("reporte_activos.pdf");
  };









  

  const exportExcel = () => {
    const data=filtrados.map(a=>({Articulo:a.articulo,Categoria:a.categoria,Marca:a.marca||"-",Modelo:a.modelo||"-",Serie:a.serie||"-",Placa:a.tiene_placa?a.placa:"SIN",Factura:a.factura||"-",Fecha:a.fecha_adquisicion,Ubicacion:a.ubicacion||"-",Observaciones:a.observaciones||"-",Costo:a.costo_original,"Vida util":a.vida_util_anios,"Dep Mensual":a.depreciacion_mensual,"Dep Acumulada":depreciacionAcumulada(a),"Valor Libros":valorLibros(a),Estado:a.estado}));
    const ws=XLSX.utils.json_to_sheet(data,{origin:"A6"});
    XLSX.utils.sheet_add_aoa(ws,[["REPORTE DE ACTIVOS"],[`Fecha: ${new Date().toLocaleString("es-CR")}`],[`Categoría: ${filtroCategoria||"Todas"} | Placa: ${filtroPlaca} | Estado: ${filtroEstado||"Todos"}`],[`Total: ${filtrados.length}`],[]],{origin:"A1"});
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"Activos"); XLSX.writeFile(wb,"reporte_activos.xlsx");
  };





  const exportHistorialPDF = () => {
    const doc=new jsPDF("landscape");
    doc.setFontSize(14); doc.text("HISTORIAL DE MOVIMIENTOS DE ACTIVOS",14,15);
    doc.setFontSize(10); doc.text(`Fecha: ${new Date().toLocaleString("es-CR")}`,14,22);
    doc.text(`Desde: ${fechaInicio||"Inicio"} | Hasta: ${fechaFin||"Hoy"}`,14,28);
    doc.text(`Total: ${historialFiltrado.length}`,14,34);
    autoTable(doc,{startY:40,theme:"grid",head:[["Activo","Placa","Categoría","Tipo","Detalle","Usuario","Fecha"]],body:historialFiltrado.map(m=>[m.articulo,m.placa,m.categoria,m.tipo,m.detalle,m.usuario,m.fecha]),styles:{fontSize:9}});
    doc.save("historial_activos.pdf");
  };




  const estadoBadge = (estado) => {
    if (!estado) return null;
    const e = estado.toUpperCase();
    if (e==="ACTIVO") return <span className="badge activo">Activo</span>;
    if (e==="DAÑADO") return <span className="badge dañado">Dañado</span>;
    if (e==="BAJA")   return <span className="badge baja">Baja</span>;
    return <span className="badge">{estado}</span>;
  };







const eliminarConfirmado = async (id) => {
  const ok = await confirm("¿Seguro que desea eliminar este activo? Esta acción no se puede deshacer.");
  if (!ok) return;


  await registrarBitacoraActivo({
    activo_id: id,
    tipo: "ELIMINACION",
    detalle: "Activo eliminado",
    usuario: esAdmin ? "admin" : "usuario"
  });

  await eliminarActivoPerma(id, "ELIMINADO");


  await cargar();
  await cargarHistorial();
  toast("Activo eliminado correctamente");

};


























  return (
    <div className="module-wrap" style={{maxWidth:"100%", paddingRight:24}}>

      {msg && <div className={`toast ${msgType}`}>{msg}</div>}

      <div className="module-top">
        <div><h1>Activos Fijos</h1><p className="subtext">Control y seguimiento de activos institucionales</p></div>
      </div>

      <div className="subtabs">
        <button className={tab==="inventario"?"tab-active":""} onClick={()=>setTab("inventario")}>Inventario</button>
        {esAdmin && <button className={tab==="nuevo"?"tab-active":""} onClick={()=>setTab("nuevo")}>Nuevo</button>}
        <button className={tab==="movimientos"?"tab-active":""} onClick={()=>setTab("movimientos")}>Movimientos</button>
        <button className={tab==="historial"?"tab-active":""} onClick={()=>setTab("historial")}>Historial</button>
      </div>

      {/* ── INVENTARIO ── */}
      {tab === "inventario" && (
        <>
          <div className="filtros-card">
            <div className="filtros-fecha" style={{flexWrap:"wrap",gap:10}}>
              <input placeholder="Buscar activo..." value={busqueda} onChange={e=>setBusqueda(e.target.value)}
                style={{padding:"9px 13px",border:"1.5px solid var(--border)",borderRadius:10,fontSize:13,background:"var(--surface2)",outline:"none",flex:1,minWidth:160}} />
              <select value={filtroCategoria} onChange={e=>setFiltroCategoria(e.target.value)} style={{padding:"9px 13px",border:"1.5px solid var(--border)",borderRadius:10,fontSize:13,background:"var(--surface2)",outline:"none"}}>
                <option value="">Todas las categorías</option>
                <option value="JPS">JPS</option><option value="ACE">ACE</option>
                <option value="Ley7999">Ley 7999</option><option value="Ley5662">Ley 5662</option>
              </select>
              <select value={filtroPlaca} onChange={e=>setFiltroPlaca(e.target.value)} style={{padding:"9px 13px",border:"1.5px solid var(--border)",borderRadius:10,fontSize:13,background:"var(--surface2)",outline:"none"}}>
                <option value="TODOS">Todos (placa)</option><option value="CON">Con placa</option><option value="SIN">Sin placa</option>
              </select>
              <select value={filtroEstado} onChange={e=>setFiltroEstado(e.target.value)} style={{padding:"9px 13px",border:"1.5px solid var(--border)",borderRadius:10,fontSize:13,background:"var(--surface2)",outline:"none"}}>
                <option value="">Todos (estado)</option><option value="ACTIVO">Activos</option>
                <option value="DAÑADO">Dañados</option><option value="BAJA">De baja</option>
              </select>
              <div className="export-buttons" style={{marginLeft:"auto",alignItems:"center"}}>
                <button className="btn-export excel" onClick={exportExcel}>📊 Excel</button>
                <button className="btn-export pdf"   onClick={exportPDF}>📄 PDF</button>
              </div>
            </div>
          </div>

          <div className="table-card" style={{overflowX:"auto"}}>
          <table className="tabla" style={{width:"100%", tableLayout:"fixed", minWidth:1600}}>

            <thead>
              <tr>
                <th style={{width:"13%"}}>Artículo</th>
                <th style={{width:"5%"}}>Categoría</th>
                <th style={{width:"7%"}}>Marca</th>
                <th style={{width:"7%"}}>Modelo</th>
                <th style={{width:"8%"}}>Serie</th>
                <th style={{width:"5%"}}>Placa</th>
                <th style={{width:"5%"}}>Factura</th>
                <th style={{width:"6%"}}>Fecha</th>
                <th style={{width:"8%"}}>Ubicación</th>
                <th style={{width:"10%"}}>Observaciones</th>
                <th style={{width:"7%"}}>Costo</th>
                <th style={{width:"7%"}}>Dep. Acum.</th>
                <th style={{width:"7%"}}>Valor Libros</th>
                <th style={{width:"5%"}}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(a => (
                <tr key={a.id}>
                  <td style={{wordBreak:"break-word"}}><strong>{a.articulo}</strong></td>
                  <td><span className="badge" style={{background:"var(--blue-lt)",color:"var(--blue)"}}>{a.categoria}</span></td>
                  <td style={{wordBreak:"break-word"}}>{a.marca||"—"}</td>
                  <td style={{wordBreak:"break-word"}}>{a.modelo||"—"}</td>
                  <td style={{fontFamily:"'DM Mono',monospace",fontSize:12,wordBreak:"break-all"}}>{a.serie||"—"}</td>
                  <td>{a.tiene_placa?<span className="badge placa">{a.placa}</span>:<span className="badge sin">SIN</span>}</td>
                  <td>{a.factura||"—"}</td>
                  <td style={{fontSize:12,fontFamily:"'DM Mono',monospace"}}>{a.fecha_adquisicion}</td>
                  <td style={{wordBreak:"break-word"}}>{a.ubicacion||"—"}</td>
                  <td style={{color:"var(--text2)",fontSize:12,wordBreak:"break-word"}}>{a.observaciones||"—"}</td>
                  <td style={{fontFamily:"'DM Mono',monospace"}}>{a.costo_original}</td>
                  <td style={{fontFamily:"'DM Mono',monospace",color:"var(--amber)"}}>{depreciacionAcumulada(a)}</td>
                  <td style={{fontFamily:"'DM Mono',monospace",color:"var(--green)",fontWeight:600}}>{valorLibros(a)}</td>
                  <td>{estadoBadge(a.estado)}</td>
                </tr>
              ))}
              {filtrados.length===0 && <tr><td colSpan={14} style={{textAlign:"center",padding:"32px",color:"var(--text3)"}}>Sin resultados</td></tr>}
            </tbody>
          </table>
        </div>
        </>
      )}

      {/* ── NUEVO / EDITAR ── */}
      {tab === "nuevo" && (
        <div className="form-box" style={{maxWidth:640}}>
          <h3>{editando?"Editar Activo":"Nuevo Activo"}</h3>
          <div className="form-grid">
            <div>
              <label className="form-label">Categoría *</label>
              <Select options={[{value:"JPS",label:"JPS"},{value:"ACE",label:"ACE"},{value:"Ley7999",label:"Ley 7999"},{value:"Ley5662",label:"Ley 5662"}]}
                onChange={e=>setForm({...form,categoria:e.value})}
                value={form.categoria?{value:form.categoria,label:form.categoria}:null}
                placeholder="Seleccione..." styles={customSelectStyles} />
            </div>
            <div>
              <label className="form-label">Artículo *</label>
              <input placeholder="Nombre del artículo" value={form.articulo} onChange={e=>setForm({...form,articulo:e.target.value})} />
            </div>
          </div>
          <div className="form-grid">
            <div><label className="form-label">Marca</label><input placeholder="Marca" value={form.marca} onChange={e=>setForm({...form,marca:e.target.value})} /></div>
            <div><label className="form-label">Modelo</label><input placeholder="Modelo" value={form.modelo} onChange={e=>setForm({...form,modelo:e.target.value})} /></div>
          </div>
          <div className="form-grid">
            <div><label className="form-label">Número de serie</label><input placeholder="Serie" value={form.serie} onChange={e=>setForm({...form,serie:e.target.value})} /></div>
            <div><label className="form-label">Fecha de adquisición *</label><input type="date" value={form.fecha_adquisicion} onChange={e=>setForm({...form,fecha_adquisicion:e.target.value})} /></div>
          </div>
          <div className="form-grid">
            <div><label className="form-label">Factura</label><input placeholder="N° factura" value={form.factura} onChange={e=>setForm({...form,factura:e.target.value})} /></div>
            <div><label className="form-label">Ubicación</label><input placeholder="Ubicación" value={form.ubicacion} onChange={e=>setForm({...form,ubicacion:e.target.value})} /></div>
          </div>
          <label className="form-label">Observaciones</label>
          <textarea placeholder="Observaciones" value={form.observaciones} onChange={e=>setForm({...form,observaciones:e.target.value})} />
          <label className="check-label">
            <input type="checkbox" checked={form.tiene_placa} onChange={e=>setForm({...form,tiene_placa:e.target.checked,placa:""})} />
            Tiene placa institucional
          </label>
          <label className="form-label">Placa</label>
          <input disabled={!form.tiene_placa} placeholder="Número de placa" value={form.placa} onChange={e=>setForm({...form,placa:e.target.value})} />
          <div className="form-grid">
            <div><label className="form-label">Costo original (₡)</label><input type="number" placeholder="0" value={form.costo} onChange={e=>setForm({...form,costo:Number(e.target.value)})} /></div>
            <div><label className="form-label">Vida útil (años)</label><input type="number" placeholder="0" value={form.vida_util} onChange={e=>setForm({...form,vida_util:Number(e.target.value)})} /></div>
          </div>
          <button onClick={guardar}>{editando?"Actualizar":"Guardar Activo"}</button>
        </div>
      )}

      {/* ── MOVIMIENTOS ── */}
      {tab === "movimientos" && (
        <>
          <div className="filtros-card">
            <div className="filtros-fecha" style={{flexWrap:"wrap",gap:10}}>
              <input placeholder="Buscar activo..." value={busquedaMov} onChange={e=>setBusquedaMov(e.target.value)}
                style={{padding:"9px 13px",border:"1.5px solid var(--border)",borderRadius:10,fontSize:13,background:"var(--surface2)",outline:"none",flex:1,minWidth:160}} />
              <select onChange={e=>setFiltroCategoriaMov(e.target.value)} style={{padding:"9px 13px",border:"1.5px solid var(--border)",borderRadius:10,fontSize:13,background:"var(--surface2)",outline:"none"}}>
                <option value="">Todas</option><option value="JPS">JPS</option><option value="ACE">ACE</option><option value="Ley7999">Ley 7999</option><option value="Ley5662">Ley 5662</option>
              </select>

              <select onChange={e=>setFiltroPlacaMov(e.target.value)} style={{padding:"9px 13px",border:"1.5px solid var(--border)",borderRadius:10,fontSize:13,background:"var(--surface2)",outline:"none"}}>
                <option value="TODOS">Todos (placa)</option><option value="CON">Con placa</option><option value="SIN">Sin placa</option>
              </select>


              <select onChange={e=>setFiltroEstadoMov(e.target.value)} style={{padding:"9px 13px",border:"1.5px solid var(--border)",borderRadius:10,fontSize:13,background:"var(--surface2)",outline:"none"}}>
                <option value="">Todos</option><option value="ACTIVO">Activos</option><option value="DAÑADO">Dañados</option><option value="BAJA">De baja</option>
              </select>

            </div>
          </div>
          <div className="table-card" style={{overflowX:"auto"}}>
            <table className="tabla">
              <thead><tr><th>Artículo</th><th>Categoría</th><th>Placa</th><th>Ubicación</th><th>Estado</th><th>Acciones</th></tr></thead>
              <tbody>
                {filtradosMovimientos.map(a => (
                  <tr key={a.id}>
                    <td><strong>{a.articulo}</strong></td>
                    <td><span className="badge" style={{background:"var(--blue-lt)",color:"var(--blue)"}}>{a.categoria}</span></td>
                    <td>{a.tiene_placa?<span className="badge placa">{a.placa}</span>:<span className="badge sin">SIN</span>}</td>
                    <td>{a.ubicacion}</td>
                    <td>{estadoBadge(a.estado)}</td>
                    <td>
                      <div className="actions">
                        <button className="btn-neutral" onClick={()=>cambiarUbicacion(a)}>Ubicación</button>
                        {a.estado!=="DAÑADO" && <button className="btn-warning" onClick={()=>cambiarEstado(a,"DAÑADO")}>Dañado</button>}
                        {a.estado!=="ACTIVO" && <button className="btn-save"    onClick={()=>cambiarEstado(a,"ACTIVO")}>Activar</button>}
                        {a.estado!=="BAJA"   && <button className="btn-delete"  onClick={()=>darDeBaja(a.id)}>Baja</button>}
                        <button className="btn-delete" onClick={() => eliminarConfirmado(a.id)}>Eliminar</button>




                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── HISTORIAL ── */}
      {tab === "historial" && (
        <>
          <div className="filtros-card">
            <div className="filtros-fecha">
              <div className="grupo-fecha"><span>Desde</span><input type="date" value={fechaInicio} onChange={e=>setFechaInicio(e.target.value)} /></div>
              <div className="grupo-fecha"><span>Hasta</span><input type="date" value={fechaFin} onChange={e=>setFechaFin(e.target.value)} /></div>
              <div className="export-buttons" style={{marginLeft:"auto",alignItems:"flex-end"}}>
                <button className="btn-export pdf" onClick={exportHistorialPDF}>📄 PDF</button>
              </div>
            </div>
          </div>
          <div className="table-card" style={{overflowX:"auto"}}>
            <table className="tabla">
              <thead><tr><th>Artículo</th><th>Placa</th><th>Categoría</th><th>Tipo</th><th>Detalle</th><th>Usuario</th><th>Fecha</th></tr></thead>
              <tbody>
                {historialFiltrado.map((m,i) => (
                  <tr key={i}>
                    <td><strong>{m.articulo}</strong></td>
                    <td>{m.placa||"—"}</td>
                    <td>{m.categoria}</td>
                    <td><span className={`badge ${m.tipo?.toLowerCase()}`}>{m.tipo}</span></td>
                    <td style={{color:"var(--text2)"}}>{m.detalle}</td>
                    <td>{m.usuario}</td>
                    <td style={{fontFamily:"'DM Mono',monospace",fontSize:12}}>{m.fecha}</td>
                  </tr>
                ))}
                {historialFiltrado.length===0 && <tr><td colSpan={7} style={{textAlign:"center",padding:"32px",color:"var(--text3)"}}>Sin movimientos en este rango</td></tr>}
              </tbody>
            </table>
          </div>
        </>
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


        {inputModal && (
        <div className="confirm-overlay">
            <div className="confirm-box">

            <h3>Ubicación</h3>
            <p>{inputModal.mensaje}</p>

            <input
                autoFocus
                value={inputModal.value}
                onChange={(e) =>
                setInputModal({ ...inputModal, value: e.target.value })
                }
                className="confirm-input"
            />

            <div className="confirm-actions">
                <button className="btn-cancel" onClick={inputModal.onCancel}>
                Cancelar
                </button>

                <button
                className="btn-save"
                onClick={() => inputModal.onConfirm(inputModal.value)}
                >
                Guardar
                </button>
            </div>
            </div>
        </div>
        )}
        


    </div>
  );




}

export default Activos;