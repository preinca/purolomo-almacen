# Carga de receta

## Propósito

Antes de pesar la salida para consumo hay que cargar la fórmula de Alibal 1 kg. La receta fija, por línea, los kilos de cada tipo de materia prima (GL, CH, CHEXT u otros tipos del catálogo) y la tolerancia. En **Registrar salidas** solo se puede retirar lo que esa receta permite.

La línea 1 parte de 740 kg de objetivo y 15 kg de tolerancia. La línea 2 usa el doble (objetivo, tolerancia y kilos de cada partida).

## Quién lo usa

Solo el administrador ve **Cargar receta** y solo él pasa el proxy en `/receta`: la ruta no está en las listas de consulta, recepción ni pesaje. `cargarRecetaAlibal` y `eliminarRecetaFormulario` vuelven a llamar a `exigirAdmin`. Otro rango que disparara la acción sería enviado a `/`.

## Pasos del usuario

1. Abre **Cargar receta** (`/receta`).
2. Elige línea 1 o línea 2.
3. Puede **Descargar Excel** antes de subir nada. Si esa línea no tiene receta vigente, el archivo sale de la plantilla (GL 340, CH 240 y CHEXT 160 en la línea 1, multiplicados por 2 en la línea 2).
4. Ajusta la tolerancia en el Excel y lo sube con **Cargar receta**. El archivo tiene que traer columnas de tipo y de kilos.
5. Si el Excel no se puede leer, el formulario muestra el error y no redirige.
6. Si se lee, se inserta una receta nueva de destino `ALIBAL 1 K` y se vuelve a `/receta`.
7. A la derecha se listan las recetas vigentes: objetivo, tolerancia, rango mínimo–máximo y cada partida.
8. **Eliminar receta** pide marcar «Confirmo eliminar». No deja borrar la línea que tiene un pesaje sin finalizar. Si la receta ya se usó en algún pesaje, no se borra: se marca `vigente = 0` para conservar la trazabilidad. Si nadie la usó, se borran ítems y cabecera.
9. El enlace **Ir a registrar salidas** lleva a `/salidas`.

`recetasCargadas` muestra, por destino y línea, solo la fila vigente de mayor `id`. Subir otra receta no apaga las anteriores: pueden quedar varias con `vigente = 1`. `recetaVigente`, que es la que usa el pesaje y la descarga, toma la de mayor `id`.

## Rutas y páginas

| Ruta | Qué hace |
| --- | --- |
| `/receta` | Formulario y listado. |
| `GET /receta/excel/1` y `GET /receta/excel/2` | Descarga `receta-alibal-linea-1.xlsx` o `receta-alibal-linea-2.xlsx`. Otra línea responde 400. |

La descarga no comprueba el rango en la ruta: usa la receta vigente o, si no hay, la plantilla. El proxy sí exige sesión.

## Componentes y acciones

- [`CargarRecetaForm`](../src/components/cargar-receta-form.tsx) envía `linea` y `archivo` a `cargarRecetaAlibal`.
- La página [`receta/page.tsx`](<../src/app/(panel)/receta/page.tsx>) lista y elimina con `eliminarRecetaFormulario`.
- La lectura del libro está en `leerRecetaExcel` ([`recetas.ts`](../src/lib/recetas.ts), librería `xlsx`).
- La generación del libro está en [`excel-receta.ts`](../src/lib/excel-receta.ts) (ExcelJS). La hoja se llama «Fórmula».
- Líneas y capacidad: [`lineas.ts`](../src/lib/lineas.ts). Línea 1 admite hasta 1800 kg por salida; línea 2, hasta 3600 kg.

## Tablas

| Tabla | Columnas relevantes |
| --- | --- |
| `recetas` | `destino`, `linea`, `objetivo_kg`, `tolerancia_kg`, `minimo_kg`, `maximo_kg`, `vigente`, `creado_en`. |
| `receta_items` | `receta_id`, `tipo`, `kg` (mayor que 0), `tolerancia_kg`, `minimo_kg`, `maximo_kg`. Único por `(receta_id, tipo)`. |
| `pesajes` | Se consulta para impedir borrar la receta de una línea con pesaje abierto, y para decidir si una receta se archiva en vez de borrarse. |

RLS activado, sin políticas. Ver [persistencia](persistencia.md).

## Código relacionado

- Página: [`src/app/(panel)/receta/page.tsx`](<../src/app/(panel)/receta/page.tsx>)
- Descarga: [`src/app/(panel)/receta/excel/[linea]/route.ts`](<../src/app/(panel)/receta/excel/[linea]/route.ts>)
- Formulario: [`src/components/cargar-receta-form.tsx`](../src/components/cargar-receta-form.tsx)
- Reglas: [`src/lib/recetas.ts`](../src/lib/recetas.ts)
- Excel de salida: [`src/lib/excel-receta.ts`](../src/lib/excel-receta.ts)
- Acciones: [`src/app/actions.ts`](../src/app/actions.ts) (`cargarRecetaAlibal`, `eliminarRecetaFormulario`)
