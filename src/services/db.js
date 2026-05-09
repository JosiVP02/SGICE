import Database from "@tauri-apps/plugin-sql";
import { documentDir, join } from "@tauri-apps/api/path";
import { mkdir } from "@tauri-apps/plugin-fs";
import { copyFile } from "@tauri-apps/plugin-fs";
import { save } from "@tauri-apps/plugin-dialog";

import { open } from "@tauri-apps/plugin-dialog";


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



    



        // =====================
        // ÍNDICES
        // =====================

        // MOVIMIENTOS
        await db.execute(`
          CREATE INDEX IF NOT EXISTS idx_movimientos_modulo
          ON movimientos(modulo)
        `);

        await db.execute(`
          CREATE INDEX IF NOT EXISTS idx_movimientos_fecha
          ON movimientos(fecha)
        `);

        await db.execute(`
          CREATE INDEX IF NOT EXISTS idx_movimientos_producto
          ON movimientos(producto)
        `);

        await db.execute(`
          CREATE INDEX IF NOT EXISTS idx_movimientos_tipo
          ON movimientos(tipo)
        `);

        // ACTIVOS
        await db.execute(`
          CREATE INDEX IF NOT EXISTS idx_activos_categoria
          ON activos(categoria)
        `);

        await db.execute(`
          CREATE INDEX IF NOT EXISTS idx_activos_estado
          ON activos(estado)
        `);

        await db.execute(`
          CREATE INDEX IF NOT EXISTS idx_activos_placa
          ON activos(placa)
        `);

        // BITÁCORA
        await db.execute(`
          CREATE INDEX IF NOT EXISTS idx_bitacora_activo
          ON bitacora_activos(activo_id)
        `);

        await db.execute(`
          CREATE INDEX IF NOT EXISTS idx_bitacora_fecha
          ON bitacora_activos(fecha)
        `);






    

  } catch (err) {
    console.error("ERROR INIT DB:", err);
  }
}
// =========================
// CRUD PRODUCTOS
// =========================





export async function hacerBackup() {
  try {
    // 1. Forzar que SQLite escriba todo al disco
    await db.execute("PRAGMA wal_checkpoint(TRUNCATE)");

    const documents = await documentDir();
    const origen = await join(documents, "BASEINV", "sgice.db");

    const destino = await save({
      filters: [{ name: "Base de datos", extensions: ["db"] }],
      defaultPath: `sgice.db`,
    });

    if (!destino) return false;

    await copyFile(origen, destino);
    return true;

  } catch (err) {
    console.error("Error en backup:", err);
    return false;
  }
}



export async function importarBackup() {
  try {
    // 1. Usuario elige el archivo .db a importar
    const origen = await open({
      filters: [{ name: "Base de datos", extensions: ["db"] }],
      multiple: false,
    });

    if (!origen) return false; // canceló

    // 2. Ruta destino (la DB activa)
    const documents = await documentDir();
    const destino = await join(documents, "BASEINV", "sgice.db");

    // 3. Sobrescribir la DB actual con la del backup
    await copyFile(origen, destino);

    return true;

  } catch (err) {
    console.error("Error en importar:", err);
    return false;
  }
}













export async function agregarProducto(tabla, nombre, cantidad) {
  await db.execute(
    `INSERT INTO ${tabla} (nombre, cantidad) VALUES (?, ?)`,
    [nombre, cantidad]
  );

  // 🧾 Registrar en historial
  await db.execute(
    `INSERT INTO movimientos
    (modulo, producto, tipo, cantidad, detalle, usuario, fecha)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      tabla,
      nombre,
      "CREACION",
      cantidad,
      "Producto creado",
      "admin",
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







export async function obtenerProductos(tabla) {
  return await db.select(
    `SELECT * FROM ${tabla} ORDER BY nombre ASC`
  );
}



export async function editarProducto(tabla, id, nombre, cantidad, usuario = "admin") {

  // 🔍 Obtener datos anteriores
  const anterior = await db.select(
    `SELECT * FROM ${tabla} WHERE id = ?`,
    [id]
  );

  if (!anterior.length) return;

  const prodAnterior = anterior[0];

  // ✏️ Actualizar producto
  await db.execute(
    `UPDATE ${tabla}
     SET nombre = ?, cantidad = ?
     WHERE id = ?`,
    [nombre, cantidad, id]
  );

  // 📊 Calcular diferencia de cantidad
  const diferencia = cantidad - prodAnterior.cantidad;

  // 🧾 Registrar en historial
  await db.execute(
    `INSERT INTO movimientos
    (modulo, producto, tipo, cantidad, detalle, usuario, fecha)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      tabla,
      nombre,
      "EDICION",
      diferencia,
      `Antes: ${prodAnterior.nombre} (${prodAnterior.cantidad}) → Ahora: ${nombre} (${cantidad})`,
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








export async function eliminarProducto(tabla, id) {

  // 🔍 Obtener producto antes de eliminar
  const producto = await db.select(
    `SELECT * FROM ${tabla} WHERE id = ?`,
    [id]
  );

  if (!producto.length) return;

  const nombre = producto[0].nombre;
  const cantidad = producto[0].cantidad;

  // 🧾 Guardar en historial
  await db.execute(
    `INSERT INTO movimientos
    (modulo, producto, tipo, cantidad, detalle, usuario, fecha)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      tabla,
      nombre,
      "ELIMINADO",
      cantidad,
      "Producto eliminado",
      "admin", // puedes hacerlo dinámico luego
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

  // 🗑️ Eliminar producto
  await db.execute(
    `DELETE FROM ${tabla} WHERE id = ?`,
    [id]
  );
}





// =========================
// MOVIMIENTOS
// =========================


function obtenerFechaCR(fechaManual = null) {

  // Si viene una fecha manual
  if (fechaManual) {

    // agregar hora actual
    const ahora = new Date();

    const hora = String(ahora.getHours()).padStart(2, "0");
    const min  = String(ahora.getMinutes()).padStart(2, "0");
    const seg  = String(ahora.getSeconds()).padStart(2, "0");

    return `${fechaManual} ${hora}:${min}:${seg}`;
  }

  // fecha actual CR
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date()).replace(",", "");
}



export async function entradaStock(tabla, id, cantidad, detalle, usuario, fechaManual = null) {
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
      obtenerFechaCR(fechaManual)
    ]
  );
}

export async function salidaStock(tabla, id, cantidad, detalle, usuario, fechaManual = null) {
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
      obtenerFechaCR(fechaManual)
    ]
  );
}


export async function obtenerMovimientos(modulo, filtros = {}) {
  const { desde, hasta } = filtros;

  let query = `SELECT * FROM movimientos WHERE modulo = ? `;
  const params = [modulo];

  if (desde) { query += `AND fecha >= ? `; params.push(desde + " 00:00:00"); }
  if (hasta) { query += `AND fecha <= ? `; params.push(hasta + " 23:59:59"); }

  query += `ORDER BY id DESC`;

  return await db.select(query, params);
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




export async function eliminarActivoPerma(id) {
  await db.execute(
    "DELETE FROM activos WHERE id = ?",
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