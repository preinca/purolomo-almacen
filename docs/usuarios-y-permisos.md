# Usuarios y permisos

## Propósito

Define quién puede registrar entradas, pesar salidas, cargar la receta o solo consultar. El rango viaja dentro de la sesión firmada y el proxy lo compara con la ruta antes de pintar la página.

## Rangos

| Rango | Nombre en pantalla | Qué puede abrir |
| --- | --- | --- |
| `administrador` | Administrador | Todas las rutas. |
| `consulta` | Consulta | Solo el grupo de consulta (inicio, ficha de lote y varias rutas de lectura que el código nombra). No entra a `/entradas`, `/salidas` ni `/usuarios`. |
| `recepcionista` | Recepcionista | Lo de consulta más `/entradas`. |
| `pesador` | Pesador | Lo de consulta más `/salidas`. |

El menú lateral solo muestra lo que el rango puede usar:

- Todos: **Inicio** (`/`).
- Administrador y recepcionista: **Registrar entradas** (`/entradas`).
- Administrador y pesador: **Registrar salidas** (`/salidas`).
- Solo administrador: **Cargar receta** (`/receta`).

`puedeEntrar` también deja pasar a consulta, recepcionista y pesador por estas rutas (la ruta o un prefijo, salvo la raíz): `/`, `/stock`, `/inventario`, `/nomenclatura`, `/logistica`, `/registro-entrada`, `/pesajes`, `/minilotes`, `/consulta-pesaje`, `/qr`, `/etiquetas`, `/historial` y `/lote`.

Varias de esas rutas no tienen archivo de página en el repositorio. El proxy las autorizaría, y Next respondería con la página de no encontrado. Las páginas que sí existen están en [autenticación](autenticacion.md), [panel](panel.md), [entradas de paleta](entradas-paleta.md), [recetas](recetas.md), [salida para consumo](salida-consumo.md) y [ficha del TAG](lote-y-historial.md).

## Pasos previstos para administrar cuentas

La única pantalla que crea un usuario es `/entrar`, y solo mientras la tabla está vacía. A partir de ahí, el alta y el alta/baja viven en server actions que hoy no tienen página:

1. Un administrador enviaría nombre, usuario, clave y rango a `crearUsuarioFormulario`.
2. La validación exige nombre de al menos 2 caracteres, usuario de 3 a 20 caracteres (`a-z`, `0-9`, `.`, `_`, `-`) y clave de al menos 4 caracteres.
3. Si el usuario ya existe (comparación sin distinguir mayúsculas), la acción devuelve error y no inserta.
4. `alternarUsuario` cambia `activo` entre 1 y 0. No deja desactivar la propia sesión ni al último administrador activo.
5. Tras crear, revalida `/usuarios`. Tras alternar, redirige a `/usuarios` (con `?error=` si falla).

No hay `src/app/**/usuarios/page.tsx`. El texto de `/entrar` menciona que después se agregan recepcionista, pesador y consulta «desde Usuarios», pero esa pantalla no está en el árbol de rutas.

Las acciones de negocio no se fían solo del menú. Cada una vuelve a exigir rango:

| Operación | Rangos |
| --- | --- |
| Cargar o eliminar receta, traslado a logística, despacho suelto, consumo suelto, eliminar lote, marcar transferencia | `administrador` |
| Entrada de paleta por QR, observación de TAG, proceso de recepción de TAG, imprimir etiqueta Zebra | `administrador`, `recepcionista` |
| Abrir, consumir, quitar kilos, finalizar o eliminar un pesaje; observación del pesaje | `administrador`, `pesador` |
| Leer un TAG o un QR (`loteActualDesdeTag`, `loteActualDesdeQr`, `numeroSiguientePesaje`) | Cualquier sesión |

## Tablas

`usuarios`. El rango solo puede ser `administrador`, `consulta`, `recepcionista` o `pesador` (`CHECK`). `activo` es 1 o 0.

RLS activado, sin políticas. Ver [persistencia](persistencia.md).

## Código relacionado

- Reglas de ruta: [`src/lib/acceso.ts`](../src/lib/acceso.ts)
- Altas, listado y activación: [`src/lib/usuarios.ts`](../src/lib/usuarios.ts)
- Acciones de formulario: [`src/app/usuarios-acciones.ts`](../src/app/usuarios-acciones.ts)
- Menú por rango: [`src/components/shell.tsx`](../src/components/shell.tsx)
- Exigencia de rango en el resto de acciones: [`src/app/actions.ts`](../src/app/actions.ts) y [`src/app/entradas-paleta-acciones.ts`](../src/app/entradas-paleta-acciones.ts)
- Pruebas: [`src/lib/acceso.test.ts`](../src/lib/acceso.test.ts)
