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