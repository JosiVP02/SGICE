import { useEffect, useMemo, useState } from "react";
import {
  obtenerProductos,
  obtenerActivos,
  obtenerMovimientos
} from "../services/db";

import {
  ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Brush
} from "recharts";


import Select from "react-select";



export default function Dashboard() {

  const [alimentos, setAlimentos] = useState([]);
  const [limpieza, setLimpieza] = useState([]);
  const [activos, setActivos] = useState([]);
  const [movimientos, setMovimientos] = useState([]);

  const [modulo, setModulo] = useState("alimentos");
  const [producto, setProducto] = useState("");

  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");

  // 🔥 FECHAS DEFAULT
  useEffect(() => {
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    setFechaInicio(inicioMes.toISOString().slice(0, 10));
    setFechaFin(hoy.toISOString().slice(0, 10));
  }, []);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    const a = await obtenerProductos("alimentos");
    const l = await obtenerProductos("limpieza");
    const ac = await obtenerActivos();
    const mA = await obtenerMovimientos("alimentos");
    const mL = await obtenerMovimientos("limpieza");

    setAlimentos(a || []);
    setLimpieza(l || []);
    setActivos(ac || []);
    setMovimientos([...(mA || []), ...(mL || [])]);
  }

  const productos = modulo === "alimentos" ? alimentos : limpieza;

  useEffect(() => setProducto(""), [modulo]);

  // ================= PARSE FECHA SEGURO =================
  const parseFecha = (f) => {
    // evita problemas con formato texto
    return new Date(f.replace(" ", "T"));
  };

  // ================= FILTRO CORREGIDO =================
const filtrados = useMemo(() => {

  if (!fechaInicio || !fechaFin) return [];

  const inicio = new Date(fechaInicio + "T00:00:00");
  const fin = new Date(fechaFin + "T23:59:59");

  return movimientos.filter(m => {

    const fecha = parseFecha(m.fecha);

    const moduloMatch =
      m.modulo?.toLowerCase().trim() === modulo.toLowerCase().trim();

    const productoMatch =
      !producto ||
      m.producto?.toLowerCase().trim() === producto.toLowerCase().trim();

    const fechaMatch = fecha >= inicio && fecha <= fin;

    const tipoMatch = m.tipo === "Salida";

    return moduloMatch && productoMatch && fechaMatch && tipoMatch;

  });

}, [movimientos, modulo, producto, fechaInicio, fechaFin]);







  // ================= SERIE CONTINUA =================
  const dataConsumo = useMemo(() => {

    if (!fechaInicio || !fechaFin) return [];

    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);

    const map = {};

    let current = new Date(inicio);

    while (current <= fin) {
      const key = current.toISOString().slice(0, 10);
      map[key] = 0;
      current.setDate(current.getDate() + 1);
    }

    filtrados.forEach(m => {
      const key = parseFecha(m.fecha).toISOString().slice(0, 10);
      if (map[key] !== undefined) {
        map[key] += Math.abs(m.cantidad || 0);
      }
    });

    return Object.keys(map).map(k => ({
      fecha: k,
      consumo: map[k]
    }));

  }, [filtrados, fechaInicio, fechaFin]);

  // ================= KPIs =================
  const totalAlimentos = alimentos.length;
  const totalLimpieza = limpieza.length;
  const totalActivos = activos.length;

  // ================= ACTIVOS =================
  const dataActivos = [
    { name: "ACTIVO", value: activos.filter(a => a.estado === "ACTIVO").length },
    { name: "BAJA", value: activos.filter(a => a.estado === "BAJA").length },
    { name: "DAÑADO", value: activos.filter(a => a.estado === "DAÑADO").length }
  ];

  const COLORS = ["#22c55e", "#ef4444", "#f59e0b"];



  const opcionesProductos = [
  { value: "", label: "Todos" },
  ...productos.map(p => ({
    value: p.nombre,
    label: p.nombre
  }))
];



const customSelectStyles = {
  control: (base) => ({
    ...base,
    background: "#020617",
    border: "1px solid #1e293b",
    borderRadius: "12px",
    color: "#e2e8f0",
    minHeight: "42px"
  }),
  menu: (base) => ({
    ...base,
    background: "#020617",
    border: "1px solid #1e293b"
  }),
  option: (base, state) => ({
    ...base,
    background: state.isFocused ? "#1e293b" : "#020617",
    color: "#e2e8f0",
    cursor: "pointer"
  }),
  singleValue: (base) => ({
    ...base,
    color: "#e2e8f0"
  }),
  input: (base) => ({
    ...base,
    color: "#e2e8f0"
  }),
  placeholder: (base) => ({
    ...base,
    color: "#64748b"
  })
};




  return (
    <div className="dashboard">

      {/* HEADER */}
      <div className="dashboard-header">
        <h1>📊 Dashboard</h1>
        <p>Analítica profesional de inventario</p>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        <Card title="Alimentos" value={totalAlimentos} />
        <Card title="Limpieza" value={totalLimpieza} />
        <Card title="Activos" value={totalActivos} />
      </div>

      {/* FILTROS */}
      <div className="filters">

        <select value={modulo} onChange={e => setModulo(e.target.value)}>
          <option value="alimentos">Alimentos</option>
          <option value="limpieza">Limpieza</option>
        </select>

        <Select
        options={opcionesProductos}
        value={opcionesProductos.find(o => o.value === producto)}
        onChange={(selected) => setProducto(selected?.value || "")}
        placeholder="Buscar producto..."
        isSearchable
        isClearable
        styles={customSelectStyles}
        />

        <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
        <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} />

      </div>

      {/* GRAFICOS */}
      <div className="grid-2">

        <div className="chart-card">
          <h3>📈 Consumo</h3>

          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={dataConsumo}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="fecha" />
              <YAxis />
              <Tooltip />

              <Line
                type="monotone"
                dataKey="consumo"
                stroke="#4f46e5"
                strokeWidth={3}
                dot={false}
              />

              {/* 🔥 ZOOM */}
              <Brush dataKey="fecha" height={25} stroke="#4f46e5" />

            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>🖥️ Activos</h3>

          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie data={dataActivos} dataKey="value" outerRadius={110}>
                {dataActivos.map((_, i) => (
                  <Cell key={i} fill={COLORS[i]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

      </div>

    </div>
  );
}

function Card({ title, value }) {
  return (
    <div className="kpi-card">
      <p className="kpi-title">{title}</p>
      <p className="kpi-value">{value}</p>
    </div>
  );
}