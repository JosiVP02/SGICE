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

        categoria TEXT NOT NULL, -- JPS, ACE, Ley7999, Ley5662

        articulo TEXT NOT NULL,
        marca TEXT,
        modelo TEXT,
        serie TEXT,
        placa TEXT,
        tiene_placa INTEGER DEFAULT 0,

        fecha TEXT,
        factura TEXT,
        ubicacion TEXT,
        observaciones TEXT,

        costo_original REAL,
        vida_util_anios INTEGER,

        depreciacion_acumulada REAL DEFAULT 0,
        valor_libros REAL DEFAULT 0,

        estado TEXT DEFAULT 'ACTIVO'
      )  
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
  await db.execute(
    `INSERT INTO activos (
      categoria, articulo, marca, modelo, serie,
      placa, tiene_placa, fecha, factura, ubicacion,
      observaciones, costo_original, vida_util_anios,
      depreciacion_acumulada, valor_libros, estado
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.categoria,
      data.articulo,
      data.marca,
      data.modelo,
      data.serie,
      data.placa,
      data.tiene_placa ? 1 : 0,
      data.fecha,
      data.factura,
      data.ubicacion,
      data.observaciones,
      data.costo_original,
      data.vida_util_anios,
      data.depreciacion_acumulada,
      data.valor_libros,
      "ACTIVO"
    ]
  );
}


export async function obtenerActivos() {
  return await db.select(
    `SELECT * FROM activos ORDER BY id DESC`
  );
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
      fecha = ?,
      factura = ?,
      ubicacion = ?,
      observaciones = ?,
      costo_original = ?,
      vida_util_anios = ?
     WHERE id = ?`,
    [
      data.categoria,
      data.articulo,
      data.marca,
      data.modelo,
      data.serie,
      data.placa,
      data.tiene_placa ? 1 : 0,
      data.fecha,
      data.factura,
      data.ubicacion,
      data.observaciones,
      data.costo_original,
      data.vida_util_anios,
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

  await db.execute(
    `INSERT INTO movimientos
    (modulo, producto, tipo, cantidad, detalle, usuario, fecha)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      "activos",
      act[0].articulo,
      "BAJA",
      1,
      motivo,
      "sistema",
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



export async function registrarMovimientoActivo(data) {
  const act = await db.select(
    `SELECT articulo FROM activos WHERE id = ?`,
    [data.activo_id]
  );

  await db.execute(
    `INSERT INTO movimientos
    (modulo, producto, tipo, cantidad, detalle, usuario, fecha)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      "activos",
      act[0].articulo,
      data.tipo,
      1,
      data.detalle,
      data.usuario,
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