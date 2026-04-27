import { useEffect, useMemo, useState } from "react";
import {
  obtenerProductos,
  obtenerActivos,
  obtenerMovimientos
} from "../services/db";

import {
  ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Brush,
  BarChart, Bar
} from "recharts";




import Select from "react-select";

// ── Constantes de estilo ──────────────────────
const TOOLTIP_STYLE = {
  background: "#0f172a",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 10,
  color: "#e2e8f0",
  fontSize: 13,
};
const AXIS_TICK = { fill: "#94a3b8", fontSize: 11 };

const SELECT_DARK = {
  control: (b) => ({ ...b, background: "#0f172a", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, color: "#e2e8f0", minHeight: 40, boxShadow:"none" }),
  menu:    (b) => ({ ...b, background: "#0f172a", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, zIndex: 50 }),
  option:  (b, s) => ({ ...b, background: s.isFocused ? "#1e293b" : "#0f172a", color: "#e2e8f0", cursor:"pointer", fontSize:13 }),
  singleValue: (b) => ({ ...b, color: "#e2e8f0" }),
  input:       (b) => ({ ...b, color: "#e2e8f0" }),
  placeholder: (b) => ({ ...b, color: "#64748b" }),
  dropdownIndicator: (b) => ({ ...b, color: "#64748b" }),
  clearIndicator:    (b) => ({ ...b, color: "#64748b" }),
  indicatorSeparator: () => ({ display: "none" }),
};

// ── Helpers ───────────────────────────────────
function parseFecha(f) { return new Date((f || "").replace(" ", "T")); }

function fmtHora(f) {
  if (!f) return "—";
  try {
    return new Date(f.replace(" ","T")).toLocaleString("es-CR", {
      day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit", hour12:false,
    });
  } catch { return f; }
}

function TipoBadge({ tipo }) {
  const t = (tipo || "").toLowerCase();
  if (t === "entrada")  return <span className="badge entrada">Entrada</span>;
  if (t === "salida")   return <span className="badge salida">Salida</span>;
  if (t.includes("conteo")) return <span className="badge conteo">Conteo</span>;
  if (t === "edicion")  return <span className="badge ajuste">Edición</span>;
  if (t === "creacion") return <span className="badge creacion">Creación</span>;
  return <span className="badge sin">{tipo}</span>;
}

function KpiCard({ icon, title, value, sub, subColor, accent="#6366f1" }) {
  return (
    <div className="kpi-card" style={{ "--accent-color": accent }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          <div className="kpi-title">{title}</div>
          <div className="kpi-value">{value}</div>
          {sub && <div className="kpi-sub" style={{ color: subColor||"#64748b", marginTop:4, fontSize:12 }}>{sub}</div>}
        </div>
        <span style={{ fontSize:26, opacity:.8, marginLeft:8 }}>{icon}</span>
      </div>
    </div>
  );
}

function ChartCard({ title, icon, children, style }) {
  return (
    <div className="chart-card" style={style}>
      <h3>{icon && <span style={{ marginRight:8 }}>{icon}</span>}{title}</h3>
      {children}
    </div>
  );
}

function EmptyMsg({ msg }) {
  return <div style={{ textAlign:"center", padding:"32px 0", color:"#64748b", fontSize:13 }}>{msg}</div>;
}

// ═══════════════════════════════════════════════
export default function Dashboard() {
  const [alimentos,   setAlimentos]   = useState([]);
  const [limpieza,    setLimpieza]    = useState([]);
  const [activos,     setActivos]     = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [modulo,      setModulo]      = useState("alimentos");
  const [producto,    setProducto]    = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin,    setFechaFin]    = useState("");

  useEffect(() => {
    const hoy = new Date();
    setFechaInicio(new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0,10));
    setFechaFin(hoy.toISOString().slice(0,10));
  }, []);

  useEffect(() => { cargar(); }, []);
  useEffect(() => { setProducto(""); }, [modulo]);

  async function cargar() {
    const [a,l,ac,mA,mL] = await Promise.all([
      obtenerProductos("alimentos"), obtenerProductos("limpieza"),
      obtenerActivos(),
      obtenerMovimientos("alimentos"), obtenerMovimientos("limpieza"),
    ]);
    setAlimentos(a||[]); setLimpieza(l||[]); setActivos(ac||[]);
    setMovimientos([...(mA||[]), ...(mL||[])]);
  }

  const productosLista = modulo==="alimentos" ? alimentos : limpieza;

  // ── KPIs ──
  const sinStockAlim  = alimentos.filter(p => Number(p.cantidad) <= 0);
  const sinStockLimp  = limpieza.filter(p  => Number(p.cantidad) <= 0);
  const totalSinStock = sinStockAlim.length + sinStockLimp.length;
  const bajosA        = alimentos.filter(p => Number(p.cantidad) > 0 && Number(p.cantidad) < 5);
  const bajosL        = limpieza.filter(p  => Number(p.cantidad) > 0 && Number(p.cantidad) < 5);

  const activosOk     = activos.filter(a => a.estado==="ACTIVO").length;
  const activosDañado = activos.filter(a => a.estado==="DAÑADO").length;
  const activosBaja   = activos.filter(a => a.estado==="BAJA").length;

  const hoyStr    = new Date().toISOString().slice(0,10);
  const movsHoy   = movimientos.filter(m => (m.fecha||"").slice(0,10)===hoyStr);
  const salidasHoy  = movsHoy.filter(m => m.tipo==="Salida").length;
  const entradasHoy = movsHoy.filter(m => m.tipo==="Entrada").length;

  // ── Movimientos recientes ──
  const recientes = useMemo(() =>
    [...movimientos].sort((a,b)=>(b.fecha||"").localeCompare(a.fecha||"")).slice(0,10),
    [movimientos]
  );

  // ── Top 5 consumidos ──
  const topConsumidos = useMemo(() => {
    if (!fechaInicio||!fechaFin) return [];
    const ini=new Date(fechaInicio+"T00:00:00"), fin=new Date(fechaFin+"T23:59:59");
    const map={};
    movimientos
      .filter(m => m.tipo==="Salida" && parseFecha(m.fecha)>=ini && parseFecha(m.fecha)<=fin)
      .forEach(m => { map[m.producto]=(map[m.producto]||0)+Math.abs(m.cantidad||0); });
    return Object.entries(map)
      .map(([name,consumo])=>({ name:name.length>16?name.slice(0,16)+"…":name, consumo }))
      .sort((a,b)=>b.consumo-a.consumo).slice(0,5);
  }, [movimientos,fechaInicio,fechaFin]);

  // ── Gráfico consumo ──
  const filtrados = useMemo(() => {
    if (!fechaInicio||!fechaFin) return [];
    const ini=new Date(fechaInicio+"T00:00:00"), fin=new Date(fechaFin+"T23:59:59");
    return movimientos.filter(m => {
      const f=parseFecha(m.fecha);
      return m.modulo?.toLowerCase()===modulo &&
             (!producto||m.producto?.toLowerCase()===producto.toLowerCase()) &&
             f>=ini && f<=fin && m.tipo==="Salida";
    });
  }, [movimientos,modulo,producto,fechaInicio,fechaFin]);

  const dataConsumo = useMemo(() => {
    if (!fechaInicio||!fechaFin) return [];
    const map={}, cur=new Date(fechaInicio), fin=new Date(fechaFin);
    while (cur<=fin) { map[cur.toISOString().slice(0,10)]=0; cur.setDate(cur.getDate()+1); }
    filtrados.forEach(m => {
      const k=parseFecha(m.fecha).toISOString().slice(0,10);
      if (map[k]!==undefined) map[k]+=Math.abs(m.cantidad||0);
    });
    return Object.entries(map).map(([fecha,consumo])=>({fecha,consumo}));
  }, [filtrados,fechaInicio,fechaFin]);

  const dataActivos = [
    {name:"Activo",  value:activosOk,     color:"#22c55e"},
    {name:"De baja", value:activosBaja,   color:"#f04438"},
    {name:"Dañado",  value:activosDañado, color:"#f59e0b"},
  ].filter(d=>d.value>0);

  const opcionesProductos = [
    {value:"",label:"Todos los productos"},
    ...productosLista.map(p=>({value:p.nombre,label:p.nombre})),
  ];

  // ── Input style reutilizable ──
  const inputStyle = {
    padding:"9px 13px", borderRadius:10, background:"#0f172a",
    border:"1px solid rgba(255,255,255,0.15)", color:"#e2e8f0",
    fontSize:13, outline:"none", colorScheme:"dark",
  };
  const labelStyle = {
    fontSize:11, fontWeight:700, color:"#64748b",
    textTransform:"uppercase", letterSpacing:".5px",
  };

  return (
    <div className="dashboard">

      {/* ── HEADER ── */}
      <div className="dashboard-header">
        <h1>📊 Dashboard</h1>
        <p>
          {new Date().toLocaleDateString("es-CR",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}
          {totalSinStock > 0 && (
            <span style={{
              marginLeft:14, padding:"2px 12px", borderRadius:20,
              background:"rgba(240,68,56,0.15)", color:"#f87171",
              border:"1px solid rgba(240,68,56,0.3)",
              fontSize:12, fontWeight:700, verticalAlign:"middle",
            }}>⚠ {totalSinStock} sin stock</span>
          )}
        </p>
      </div>

      {/* ── KPIs ── */}
      <div className="kpi-grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(175px,1fr))",marginBottom:20}}>
        <KpiCard icon="🥦" title="Alimentos"     value={alimentos.length}
          sub={sinStockAlim.length>0?`${sinStockAlim.length} sin stock`:"Todo con stock"}
          subColor={sinStockAlim.length>0?"#f87171":"#4ade80"} accent="#6366f1"/>
        <KpiCard icon="🧹" title="Limpieza"       value={limpieza.length}
          sub={sinStockLimp.length>0?`${sinStockLimp.length} sin stock`:"Todo con stock"}
          subColor={sinStockLimp.length>0?"#f87171":"#4ade80"} accent="#06b6d4"/>
        <KpiCard icon="📦" title="Activos"         value={activos.length}
          sub={`${activosOk} activos · ${activosDañado} dañados`}
          subColor={activosDañado>0?"#fbbf24":"#4ade80"} accent="#a855f7"/>
       
        <KpiCard icon="⚠️" title="Sin stock"       value={totalSinStock}
          sub={totalSinStock===0?"Sin problemas":"Requieren atención"}
          subColor={totalSinStock>0?"#f87171":"#4ade80"}
          accent={totalSinStock>0?"#f04438":"#22c55e"}/>
        
      </div>

      {/* ── FILA 1: Sin stock + Recientes ── */}
      <div className="grid-2" style={{marginBottom:18}}>

        <ChartCard title="Productos sin stock" icon="⚠️">
          {totalSinStock===0 ? (
            <div style={{textAlign:"center",padding:"28px 0"}}>
              <div style={{fontSize:32,marginBottom:8}}>✅</div>
              <div style={{color:"#4ade80",fontSize:13,fontWeight:600}}>Todos con stock</div>
            </div>
          ) : (
            <div style={{maxHeight:280,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
              {sinStockAlim.length>0 && <>
                <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:".5px",padding:"4px 0 2px"}}>🥦 Alimentos</div>
                {sinStockAlim.map(p=>(
                  <div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                    padding:"8px 12px",borderRadius:8,
                    background:"rgba(240,68,56,0.07)",border:"1px solid rgba(240,68,56,0.18)"}}>
                    <span style={{color:"#e2e8f0",fontSize:13,fontWeight:500}}>{p.nombre}</span>
                    <span style={{color:"#f87171",fontSize:12,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{p.cantidad} uds</span>
                  </div>
                ))}
              </>}
              {sinStockLimp.length>0 && <>
                <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:".5px",padding:"8px 0 2px"}}>🧹 Limpieza</div>
                {sinStockLimp.map(p=>(
                  <div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                    padding:"8px 12px",borderRadius:8,
                    background:"rgba(247,144,9,0.07)",border:"1px solid rgba(247,144,9,0.18)"}}>
                    <span style={{color:"#e2e8f0",fontSize:13,fontWeight:500}}>{p.nombre}</span>
                    <span style={{color:"#fbbf24",fontSize:12,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{p.cantidad} uds</span>
                  </div>
                ))}
              </>}
            </div>
          )}
        </ChartCard>

        <ChartCard title="Movimientos recientes" icon="🕒">
          {recientes.length===0 ? <EmptyMsg msg="No hay movimientos registrados"/> : (
            <div style={{maxHeight:280,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
              {recientes.map((m,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,
                  padding:"8px 10px",borderRadius:8,
                  background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.05)"}}>
                  <div style={{width:76,flexShrink:0}}><TipoBadge tipo={m.tipo}/></div>
                  <div style={{flex:1,color:"#cbd5e1",fontSize:12,fontWeight:500,
                    overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.producto}</div>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:"#94a3b8",flexShrink:0}}>
                    {m.cantidad>0?"+":""}{m.cantidad}
                  </div>
                  <div style={{fontSize:11,color:"#475569",flexShrink:0,minWidth:78,textAlign:"right"}}>
                    {fmtHora(m.fecha)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>

      {/* ── FILTROS ── */}
      <div style={{
        background:"rgba(15,23,42,0.8)",border:"1px solid rgba(255,255,255,0.08)",
        borderRadius:12,padding:"14px 18px",marginBottom:18,
        display:"flex",gap:14,flexWrap:"wrap",alignItems:"flex-end",
        backdropFilter:"blur(12px)",
      }}>
        {[
          { label:"Módulo", content:(
            <select value={modulo} onChange={e=>setModulo(e.target.value)} style={{...inputStyle,minWidth:130,cursor:"pointer"}}>
              <option value="alimentos">Alimentos</option>
              <option value="limpieza">Limpieza</option>
            </select>
          )},
          { label:"Producto", content:(
            <div style={{minWidth:220}}>
              <Select options={opcionesProductos}
                value={opcionesProductos.find(o=>o.value===producto)||null}
                onChange={sel=>setProducto(sel?.value||"")}
                placeholder="Todos" isSearchable isClearable styles={SELECT_DARK}/>
            </div>
          )},
          { label:"Desde", content:<input type="date" value={fechaInicio} onChange={e=>setFechaInicio(e.target.value)} style={inputStyle}/> },
          { label:"Hasta", content:<input type="date" value={fechaFin}    onChange={e=>setFechaFin(e.target.value)}    style={inputStyle}/> },
        ].map(f=>(
          <div key={f.label} style={{display:"flex",flexDirection:"column",gap:5}}>
            <span style={labelStyle}>{f.label}</span>
            {f.content}
          </div>
        ))}
      </div>

      {/* ── FILA 2: Consumo + Top 5 ── */}
      <div className="grid-2" style={{marginBottom:18}}>

        <ChartCard title="Consumo diario (salidas)" icon="📈">
          {dataConsumo.every(d=>d.consumo===0) ? <EmptyMsg msg="Sin salidas en el período"/> : (
            <ResponsiveContainer width="100%" height={270}>
              <LineChart data={dataConsumo} margin={{top:4,right:8,left:-16,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false}/>
                <XAxis dataKey="fecha" tick={AXIS_TICK} axisLine={false} tickLine={false}
                  tickFormatter={v=>v.slice(5)} interval="preserveStartEnd"/>
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false}/>
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{stroke:"rgba(99,102,241,0.3)",strokeWidth:1}}/>
                <Line type="monotone" dataKey="consumo" name="Salidas"
                  stroke="#6366f1" strokeWidth={2.5} dot={false}
                  activeDot={{r:5,fill:"#6366f1",stroke:"#020617",strokeWidth:2}}/>
                <Brush dataKey="fecha" height={22} stroke="rgba(99,102,241,0.4)"
                  fill="rgba(15,23,42,0.8)" travellerWidth={6} tickFormatter={v=>v.slice(5)}/>
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Top 5 más consumidos" icon="🏆">
          {topConsumidos.length===0 ? <EmptyMsg msg="Sin datos de salidas en el período"/> : (
            <ResponsiveContainer width="100%" height={270}>
              <BarChart data={topConsumidos} layout="vertical" margin={{top:4,right:16,left:0,bottom:0}} barSize={11}>
                <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false}/>
                <YAxis type="category" dataKey="name" width={110}
                  tick={{fill:"#cbd5e1",fontSize:11}} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{fill:"rgba(255,255,255,0.03)"}}/>
                <Bar dataKey="consumo" name="Consumo" fill="#f25c19" radius={[0,4,4,0]}
                  background={{fill:"rgba(255,255,255,0.03)",radius:[0,4,4,0]}}/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ── FILA 3: Pie activos + Stock bajo ── */}
      <div className="grid-2" style={{marginBottom:18}}>

        <ChartCard title="Estado de activos" icon="🖥️">
          {dataActivos.length===0 ? <EmptyMsg msg="Sin activos registrados"/> : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={dataActivos} dataKey="value" cx="50%" cy="50%"
                    outerRadius={85} innerRadius={44} paddingAngle={3}>
                    {dataActivos.map((d,i)=><Cell key={i} fill={d.color}/>)}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE}/>
                  <Legend wrapperStyle={{fontSize:12,color:"#94a3b8"}}/>
                </PieChart>
              </ResponsiveContainer>
              <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>
                {[
                  {label:"Activos", val:activosOk,     color:"#22c55e"},
                  {label:"Dañados", val:activosDañado, color:"#f59e0b"},
                  {label:"De baja", val:activosBaja,   color:"#f04438"},
                ].map(item=>(
                  <div key={item.label} style={{
                    flex:1,minWidth:70,textAlign:"center",padding:"8px 6px",borderRadius:8,
                    background:"rgba(255,255,255,0.03)",border:`1px solid ${item.color}30`,
                  }}>
                    <div style={{fontSize:20,fontWeight:700,color:item.color,fontFamily:"'DM Mono',monospace"}}>{item.val}</div>
                    <div style={{fontSize:11,color:"#64748b",marginTop:2}}>{item.label}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </ChartCard>

        <ChartCard title="Stock bajo (menos de 5 unidades)" icon="📉">
          {(() => {
            const todos=[
              ...bajosA.map(p=>({...p,mod:"Alimento"})),
              ...bajosL.map(p=>({...p,mod:"Limpieza"})),
            ].sort((a,b)=>a.cantidad-b.cantidad);
            if (todos.length===0) return (
              <div style={{textAlign:"center",padding:"32px 0"}}>
                <div style={{fontSize:28,marginBottom:8}}>✅</div>
                <div style={{color:"#4ade80",fontSize:13,fontWeight:600}}>Sin productos con stock bajo</div>
              </div>
            );
            return (
              <div style={{maxHeight:300,overflowY:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                  <thead>
                    <tr style={{borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
                      {["Producto","Módulo","Stock"].map(h=>(
                        <th key={h} style={{padding:"6px 10px",textAlign:"left",
                          fontSize:11,fontWeight:700,color:"#64748b",
                          textTransform:"uppercase",letterSpacing:".4px"}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {todos.map((p,i)=>(
                      <tr key={i} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                        <td style={{padding:"8px 10px",color:"#e2e8f0",fontWeight:500}}>{p.nombre}</td>
                        <td style={{padding:"8px 10px"}}>
                          <span style={{
                            fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20,
                            background:p.mod==="Alimento"?"rgba(99,102,241,0.15)":"rgba(6,182,212,0.15)",
                            color:p.mod==="Alimento"?"#a5b4fc":"#67e8f9",
                            fontFamily:"'DM Mono',monospace",
                          }}>{p.mod}</span>
                        </td>
                        <td style={{padding:"8px 10px"}}>
                          <span style={{
                            fontFamily:"'DM Mono',monospace",fontWeight:700,fontSize:14,
                            color:p.cantidad<=2?"#f87171":"#fbbf24",
                          }}>{p.cantidad}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </ChartCard>
      </div>

    </div>
  );
}