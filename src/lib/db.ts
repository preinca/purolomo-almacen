import fs from "node:fs";
import path from "node:path";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import postgres from "postgres";

export type Fila = Record<string, unknown>;

/**
 * Acceso a la base de datos (Postgres en Supabase).
 * Las consultas se escriben con `?` como en la versión SQLite; se convierten a $1, $2...
 */
export interface Db {
  get<T = Fila>(sql: string, ...params: unknown[]): Promise<T | undefined>;
  all<T = Fila>(sql: string, ...params: unknown[]): Promise<T[]>;
  /** Ejecuta INSERT/UPDATE/DELETE y devuelve cuántas filas cambiaron. */
  run(sql: string, ...params: unknown[]): Promise<number>;
  exec(sql: string): Promise<void>;
  /** Ejecuta `fn` dentro de una transacción. Dentro de otra transacción reutiliza la misma. */
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
}

/** Cambia los `?` fuera de comillas simples por $1, $2... */
export function aPostgres(sql: string) {
  let salida = "";
  let n = 0;
  let enTexto = false;
  for (const caracter of sql) {
    if (caracter === "'") enTexto = !enTexto;
    if (caracter === "?" && !enTexto) {
      n += 1;
      salida += `$${n}`;
    } else {
      salida += caracter;
    }
  }
  return salida;
}

export { arregloPg } from "./arreglo-pg";

/** Lo que necesita `crearDb` de una conexión: consultas con parámetros y SQL de varias sentencias. */
export type Conexion = {
  consultar: (texto: string, params: unknown[]) => Promise<{ filas: Fila[]; cambios: number }>;
  ejecutar: (texto: string) => Promise<void>;
};

export function crearDb(
  conexion: Conexion,
  transaccion: (fn: (conexionTx: Conexion) => Promise<unknown>) => Promise<unknown>,
  dentroDeTransaccion = false,
): Db {
  const db: Db = {
    async get<T>(sql: string, ...params: unknown[]) {
      const { filas } = await conexion.consultar(aPostgres(sql), params);
      return filas[0] as T | undefined;
    },
    async all<T>(sql: string, ...params: unknown[]) {
      const { filas } = await conexion.consultar(aPostgres(sql), params);
      return filas as T[];
    },
    async run(sql: string, ...params: unknown[]) {
      const { cambios } = await conexion.consultar(aPostgres(sql), params);
      return cambios;
    },
    async exec(sql: string) {
      await conexion.ejecutar(sql);
    },
    async transaction<T>(fn: (tx: Db) => Promise<T>) {
      if (dentroDeTransaccion) return fn(db);
      return (await transaccion((conexionTx) => fn(crearDb(conexionTx, transaccion, true)))) as T;
    },
  };
  return db;
}

type ClientePostgres = ReturnType<typeof postgres>;

/** Deja pasar como mucho `limite` tareas a la vez; las demás esperan su turno en orden. */
export function crearTurnos(limite: number) {
  let enCurso = 0;
  const cola: (() => void)[] = [];
  return async function conTurno<T>(tarea: () => Promise<T>): Promise<T> {
    if (enCurso >= limite) await new Promise<void>((avisar) => cola.push(avisar));
    else enCurso += 1;
    try {
      return await tarea();
    } finally {
      const siguiente = cola.shift();
      if (siguiente) siguiente();
      else enCurso -= 1;
    }
  };
}

/**
 * El driver, cuando hay más consultas que conexiones, envía varias seguidas por la misma
 * conexión (pipelining). El pooler de Supabase en modo transacción deja colgadas las consultas
 * sin parámetros enviadas así: la página se quedaba en blanco. Para que nunca ocurra, aquí
 * nunca hay más consultas en marcha que conexiones, y dentro de una transacción van de una en una.
 */
function dbDesdePostgres(cliente: ClientePostgres, conexiones: number): Db {
  const turnoGeneral = crearTurnos(conexiones);
  const sobre = (sql: ClientePostgres | postgres.TransactionSql, turno: ReturnType<typeof crearTurnos>): Conexion => ({
    consultar: (texto, params) =>
      turno(async () => {
        const resultado = await sql.unsafe(texto, params as postgres.ParameterOrJSON<never>[]);
        return { filas: [...resultado] as Fila[], cambios: resultado.count ?? 0 };
      }),
    ejecutar: (texto) =>
      turno(async () => {
        // Protocolo simple: admite varias sentencias seguidas (el esquema completo, por ejemplo).
        await sql.unsafe(texto).simple();
      }),
  });
  return crearDb(sobre(cliente, turnoGeneral), (fn) =>
    // La transacción ocupa una conexión (un turno) mientras dura.
    turnoGeneral(() => cliente.begin((tx) => fn(sobre(tx, crearTurnos(1)))) as Promise<unknown>),
  );
}

const globalParaDb = globalThis as unknown as { purolomoDb?: Db };

export function urlBaseDatos() {
  return process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";
}

function dbPostgres(): Db {
  const url = urlBaseDatos();
  // En Vercel cada instancia es corta: una sola conexión evita saturar el pooler.
  const conexiones = Math.max(1, process.env.VERCEL ? 1 : Number(process.env.DB_MAX_CONEXIONES ?? 3));
  const cliente = postgres(url, {
    // El pooler de Supabase en modo transacción no admite sentencias preparadas.
    prepare: false,
    max: conexiones,
    idle_timeout: 20,
    max_lifetime: 60 * 10,
    connect_timeout: 10,
    ssl: /localhost|127\.0\.0\.1/.test(url) ? false : "require",
  });
  return dbDesdePostgres(cliente, conexiones);
}

/** Postgres embebido. Los datos quedan en data/almacen y sobreviven al reinicio. */
async function dbLocal(): Promise<Db> {
  const { PGlite: Motor } = await import("@electric-sql/pglite");
  const dir = path.join(process.cwd(), "data", "almacen");
  fs.mkdirSync(dir, { recursive: true });
  const pg = await Motor.create(dir);
  await pg.exec(fs.readFileSync(path.join(process.cwd(), "supabase", "esquema.sql"), "utf8"));
  const sobre = (q: PGlite | Transaction): Conexion => ({
    async consultar(texto, params) {
      const resultado = await q.query<Fila>(texto, params);
      return { filas: resultado.rows, cambios: resultado.affectedRows ?? 0 };
    },
    async ejecutar(texto) {
      await q.exec(texto);
    },
  });
  const db = crearDb(sobre(pg), (fn) => pg.transaction((tx) => fn(sobre(tx))));
  const { asegurarCatalogo } = await import("./seed");
  await asegurarCatalogo(db);
  return db;
}

function dbCuandoEsteLista(abrir: () => Promise<Db>): Db {
  let real: Promise<Db> | undefined;
  const listo = () => {
    real ??= abrir().catch((error: unknown) => {
      real = undefined;
      throw error;
    });
    return real;
  };
  return {
    async get(sql, ...params) {
      return (await listo()).get(sql, ...params);
    },
    async all(sql, ...params) {
      return (await listo()).all(sql, ...params);
    },
    async run(sql, ...params) {
      return (await listo()).run(sql, ...params);
    },
    async exec(sql) {
      return (await listo()).exec(sql);
    },
    async transaction(fn) {
      return (await listo()).transaction(fn);
    },
  };
}

export function getDb(): Db {
  if (!globalParaDb.purolomoDb) {
    globalParaDb.purolomoDb = urlBaseDatos() ? dbPostgres() : dbCuandoEsteLista(dbLocal);
  }
  return globalParaDb.purolomoDb;
}
