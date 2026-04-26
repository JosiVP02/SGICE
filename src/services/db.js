import Database from "@tauri-apps/plugin-sql";
import { documentDir, join } from "@tauri-apps/api/path";
import { mkdir } from "@tauri-apps/plugin-fs";

let db;

export async function initDB() {
  try {
    // 📁 Carpeta Documentos del usuario
    const documents = await documentDir();

    // 📁 Tu carpeta personalizada
    const folder = await join(documents, "BASEINV");

    // 🔥 Crear carpeta si no existe
    await mkdir(folder, { recursive: true });

    // 📄 Ruta final de la base de datos
    const dbPath = await join(folder, "sgice.db");

    // 🧠 Cargar SQLite en esa ruta
    db = await Database.load(`sqlite:${dbPath}`);

    // =====================
    // TABLAS
    // =====================

    await db.execute(`
      CREATE TABLE IF NOT EXISTS alimentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        cantidad INTEGER NOT NULL
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS limpieza (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        cantidad INTEGER NOT NULL
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS movimientos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        modulo TEXT NOT NULL,
        producto TEXT NOT NULL,
        tipo TEXT NOT NULL,
        cantidad INTEGER NOT NULL,
        detalle TEXT,
        usuario TEXT,
        fecha TEXT NOT NULL
      )
    `);


         await db.execute(`
          CREATE TABLE IF NOT EXISTS activos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        categoria TEXT NOT NULL,
        articulo TEXT NOT NULL,

        marca TEXT,
        modelo TEXT,
        serie TEXT,

        placa TEXT,
        tiene_placa INTEGER DEFAULT 0,

        fecha_adquisicion TEXT NOT NULL,
        factura TEXT,

        ubicacion TEXT,
        observaciones TEXT,

        costo_original REAL NOT NULL,
        vida_util_anios INTEGER NOT NULL,

        depreciacion_mensual REAL DEFAULT 0,
        depreciacion_acumulada REAL DEFAULT 0,
        valor_libros REAL DEFAULT 0,

        estado TEXT DEFAULT 'ACTIVO'
      )  
    `);

        await db.execute(`
          
          CREATE TABLE IF NOT EXISTS bitacora_activos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,

          activo_id INTEGER,

          articulo TEXT,
          categoria TEXT,
          placa TEXT,
          tiene_placa INTEGER,

          ubicacion TEXT,
          estado TEXT,

          tipo TEXT, -- BAJA, TRASLADO, DAÑADO, etc.
          detalle TEXT,
          usuario TEXT,

          fecha TEXT
        );
          
          
          `);



    










    

  } catch (err) {
    console.error("ERROR INIT DB:", err);
  }
}
// =========================
// CRUD PRODUCTOS
// =========================

export async function agregarProducto(tabla, nombre, cantidad) {
  await db.execute(
    `INSERT INTO ${tabla} (nombre, cantidad) VALUES (?, ?)`,
    [nombre, cantidad]
  );
}

export async function obtenerProductos(tabla) {
  return await db.select(
    `SELECT * FROM ${tabla} ORDER BY nombre ASC`
  );
}

export async function editarProducto(tabla, id, nombre, cantidad) {
  await db.execute(
    `UPDATE ${tabla}
     SET nombre = ?, cantidad = ?
     WHERE id = ?`,
    [nombre, cantidad, id]
  );
}

export async function eliminarProducto(tabla, id) {
  await db.execute(
    `DELETE FROM ${tabla}
     WHERE id = ?`,
    [id]
  );
}

// =========================
// MOVIMIENTOS
// =========================

export async function entradaStock(tabla, id, cantidad, detalle, usuario) {
  await db.execute(
    `UPDATE ${tabla}
     SET cantidad = cantidad + ?
     WHERE id = ?`,
    [cantidad, id]
  );

  const producto = await db.select(
    `SELECT nombre FROM ${tabla} WHERE id = ?`,
    [id]
  );

  await db.execute(
    `INSERT INTO movimientos
    (modulo, producto, tipo, cantidad, detalle, usuario, fecha)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      tabla,
      producto[0].nombre,
      "Entrada",
      cantidad,
      detalle,
      usuario,
      new Intl.DateTimeFormat("sv-SE", {
      timeZone: "America/Costa_Rica",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(new Date()).replace(",", "")
    ]
  );
}

export async function salidaStock(tabla, id, cantidad, detalle, usuario) {
  await db.execute(
    `UPDATE ${tabla}
     SET cantidad = cantidad - ?
     WHERE id = ?`,
    [cantidad, id]
  );

  const producto = await db.select(
    `SELECT nombre FROM ${tabla} WHERE id = ?`,
    [id]
  );

  await db.execute(
    `INSERT INTO movimientos
    (modulo, producto, tipo, cantidad, detalle, usuario, fecha)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      tabla,
      producto[0].nombre,
      "Salida",
      cantidad,
      detalle,
      usuario,
      new Intl.DateTimeFormat("sv-SE", {
      timeZone: "America/Costa_Rica",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(new Date()).replace(",", "")
    ]
  );
}


export async function obtenerMovimientos(modulo) {
  return await db.select(
    `SELECT *
     FROM movimientos
     WHERE modulo = ?
     ORDER BY id DESC
     LIMIT 100`,
    [modulo]
  );
}


export async function ajusteStock(tabla, id, nuevaCantidad, detalle, usuario) {

  const producto = await db.select(
    `SELECT * FROM ${tabla} WHERE id = ?`,
    [id]
  );

  if (!producto.length) return;

  const actual = producto[0].cantidad;
  const diferencia = nuevaCantidad - actual;

  // actualizar stock
  await db.execute(
    `UPDATE ${tabla} SET cantidad = ? WHERE id = ?`,
    [nuevaCantidad, id]
  );

  // 🔥 REGISTRO EN HISTORIAL
  await db.execute(
    `INSERT INTO movimientos
    (modulo, producto, tipo, cantidad, detalle, usuario, fecha)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      tabla,
      producto[0].nombre,
      "CONTEO FISICO",
      diferencia,
      `Modificación por conteo físico - ${detalle}`,
      usuario,
      new Intl.DateTimeFormat("sv-SE", {
        timeZone: "America/Costa_Rica",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      }).format(new Date()).replace(",", "")
    ]
  );
}




export async function registrarConteo(tabla, descripcion, usuario) {

  await db.execute(
    `INSERT INTO movimientos
    (modulo, producto, tipo, cantidad, detalle, usuario, fecha)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      tabla,
      "CONTEO GENERAL",
      "CONTEO",
      0,
      descripcion || "Conteo físico",
      usuario,
      new Intl.DateTimeFormat("sv-SE", {
        timeZone: "America/Costa_Rica",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      }).format(new Date()).replace(",", "")
    ]
  );
}






export async function agregarActivo(data) {
  const res = await db.execute(
    `INSERT INTO activos (
      categoria, articulo, marca, modelo, serie,
      placa, tiene_placa,
      fecha_adquisicion, factura,
      ubicacion, observaciones,
      costo_original, vida_util_anios,
      depreciacion_mensual,
      depreciacion_acumulada,
      valor_libros,
      estado
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.categoria,
      data.articulo,
      data.marca,
      data.modelo,
      data.serie,
      data.placa,
      data.tiene_placa ? 1 : 0,
      data.fecha_adquisicion,
      data.factura,
      data.ubicacion,
      data.observaciones,
      data.costo_original,
      data.vida_util_anios,
      data.depreciacion_mensual,
      data.depreciacion_acumulada,
      data.valor_libros,
      "ACTIVO"
    ]
  );

  // 🔥 NUEVO: obtener el ID insertado
  const id = res.lastInsertId;

  return res;
}






export async function obtenerActivos() {
  return await db.select(`SELECT * FROM activos ORDER BY id DESC`);
}


export async function editarActivo(data) {
  await db.execute(
    `UPDATE activos SET
    categoria = ?,
    articulo = ?,
    marca = ?,
    modelo = ?,
    serie = ?,
    placa = ?,
    tiene_placa = ?,
    fecha_adquisicion = ?,
    factura = ?,
    ubicacion = ?,
    observaciones = ?,
    costo_original = ?,
    vida_util_anios = ?,
    estado = ?
    WHERE id = ?`,
    [
      data.categoria,
      data.articulo,
      data.marca,
      data.modelo,
      data.serie,
      data.placa,
      data.tiene_placa ? 1 : 0,
      data.fecha_adquisicion,
      data.factura,
      data.ubicacion,
      data.observaciones,
      data.costo_original,
      data.vida_util_anios,
      data.estado || "ACTIVO",
      data.id
    ]
  );
}






export async function eliminarActivo(id, motivo = "BAJA") {
  await db.execute(
    `UPDATE activos SET estado = 'BAJA' WHERE id = ?`,
    [id]
  );

  const act = await db.select(
    `SELECT articulo FROM activos WHERE id = ?`,
    [id]
  );

}







export async function registrarBitacoraActivo(data) {
  const act = await db.select(
    `SELECT * FROM activos WHERE id = ?`,
    [data.activo_id]
  );



  if (!act.length) return;

  const a = act[0];

  await db.execute(
    `INSERT INTO bitacora_activos (
      activo_id,
      articulo,
      categoria,
      placa,
      tiene_placa,
      ubicacion,
      estado,
      tipo,
      detalle,
      usuario,
      fecha
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      a.id,
      a.articulo,
      a.categoria,
      a.placa || "",
      a.tiene_placa ? 1 : 0,
      a.ubicacion || "",
      a.estado || "ACTIVO",
      data.tipo,
      data.detalle || "",
      data.usuario || "sistema",
      new Intl.DateTimeFormat("sv-SE", {
        timeZone: "America/Costa_Rica",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      }).format(new Date()).replace(",", "")
    ]
  );
}




export async function obtenerBitacoraActivos() {
  return await db.select(
    `SELECT * FROM bitacora_activos
     ORDER BY id DESC`
  );
}