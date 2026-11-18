# Autenticación y sesión

## Propósito

Impide que alguien use el almacén sin una cuenta activa. La primera visita crea el administrador. Después, cada persona entra con usuario y clave, y la aplicación recuerda la sesión en una cookie firmada durante 12 horas.

## Quién lo usa

Cualquier persona que abre la aplicación. Si todavía no hay filas en `usuarios`, la pantalla pide crear el administrador. Si ya hay cuentas, pide usuario y clave.

## Pasos del usuario

1. Abre cualquier ruta del panel. Si no hay sesión válida, el proxy lo manda a `/entrar` y conserva la ruta pedida en `siguiente` (salvo la raíz).
2. Si no existe ningún usuario, ve «Crear administrador»: nombre, usuario, clave y repetir clave.
3. Si ya hay usuarios, ve «Iniciar sesión»: usuario y clave.
4. Si los datos son correctos, entra al panel (o a la ruta de `siguiente`, si es una ruta interna que no empieza por `/entrar`).
5. El encabezado muestra el nombre y el rango. El botón **Salir** borra la cookie y vuelve a `/entrar`.
6. Si la cuenta se desactiva mientras la sesión sigue abierta, el layout del panel vuelve a `/entrar`.
7. Una sesión ya iniciada que sigue activa, al visitar `/entrar`, se redirige a `/`.

La clave se guarda con scrypt y una sal aleatoria (`scrypt$sal$hash`). La comprobación usa comparación en tiempo constante. El usuario se normaliza a minúsculas.

La cookie se llama `sesion`. Es `httpOnly`, `sameSite=lax` y `path=/`. El valor es el JSON de la sesión en base64url más una firma HMAC-SHA256. La firma usa la variable de entorno `SESION_SECRETO`. Si esa variable está vacía, el código usa un valor fijo del fuente; en producción hay que definir `SESION_SECRETO`. La sesión caduca a las 12 horas (`exp`).

La constante `LOGIN_DESACTIVADO` en el código de firma está en `false`. Si se pusiera en `true`, el proxy dejaría pasar todas las rutas (y mandaría `/entrar` a `/`) y `leerSesion` devolvería una sesión de demostración con rango administrador.

## Rutas y páginas

| Ruta | Qué hace |
| --- | --- |
| `/entrar` | Crear el primer administrador o iniciar sesión. No usa el marco del panel. |
| Cualquier otra ruta (salvo estáticos y `/api/impresion`) | Exige cookie válida y un rango que pueda entrar. |

El proxy no cubre `/_next/static`, `/_next/image`, `favicon.ico` ni `logo-purolomo.png`. `/api/impresion` queda fuera del login: se autentica con su propia clave (ver [impresión](impresion.md)).

## Componentes

- [`FormularioEntrada`](<../src/components/formulario-entrada.tsx>) elige la acción según el modo `crear` o `entrar` y muestra el error.
- [`LogoPurolomo`](../src/components/logo.tsx) en la pantalla de acceso y en el menú.
- [`Shell`](../src/components/shell.tsx) muestra el nombre, el rango y el formulario de **Salir**.
- El layout del panel ([`(panel)/layout.tsx`](<../src/app/(panel)/layout.tsx>)) vuelve a comprobar que la sesión sigue activa en la base.

## Server actions

En [`usuarios-acciones.ts`](../src/app/usuarios-acciones.ts):

| Acción | Efecto |
| --- | --- |
| `entrar` | Busca la cuenta con `autenticar`. Si falla, devuelve «Usuario o clave incorrectos.» Si acierta, guarda la cookie y redirige. |
| `crearPrimerAdministrador` | Solo si `contarUsuarios` es 0. Exige que las dos claves coincidan, valida la cuenta con rango `administrador`, la crea, abre sesión y va a `/`. |
| `cerrarSesion` | Borra la cookie y redirige a `/entrar`. |

`exigirSesion`, `exigirAdmin` y `exigirRango` viven en [`usuarios.ts`](../src/lib/usuarios.ts). Si no hay sesión, redirigen a `/entrar`. Si el rango no está en la lista, redirigen a `/`.

## Tablas

`usuarios` (columnas `id`, `nombre`, `usuario`, `clave`, `rango`, `activo`, `creado_en`). El índice único es `lower(usuario)`.

RLS está activado y no hay políticas. El detalle está en [persistencia](persistencia.md). La aplicación no usa la API pública de Supabase: lee y escribe por la conexión directa de Postgres.

## Código relacionado

- Página: [`src/app/entrar/page.tsx`](../src/app/entrar/page.tsx)
- Acciones: [`src/app/usuarios-acciones.ts`](../src/app/usuarios-acciones.ts)
- Cuentas y cookie: [`src/lib/usuarios.ts`](../src/lib/usuarios.ts)
- Hash de clave: [`src/lib/claves.ts`](../src/lib/claves.ts)
- Firma de sesión: [`src/lib/firma.ts`](../src/lib/firma.ts)
- Qué rutas admite cada rango: [`src/lib/acceso.ts`](../src/lib/acceso.ts)
- Interceptor de peticiones: [`src/proxy.ts`](../src/proxy.ts)
- Pruebas de firma, clave y acceso: [`src/lib/acceso.test.ts`](../src/lib/acceso.test.ts)
- Nombres de variables (sin valores): [`.env.example`](../.env.example) (`SESION_SECRETO`)
