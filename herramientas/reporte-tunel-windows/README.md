# Avisar la dirección del túnel (Windows 11)

El tablero Purolomo Kárdex se abre al exterior con un túnel de Cloudflare. Esa dirección (`https://algo.trycloudflare.com`) cambia cada vez que se reinicia el túnel. Este programa la detecta y se la manda al almacén. No hay que copiarla a mano.

Hace falta Windows 11. Usa el PowerShell que ya trae el sistema (versión 5.1). No hace falta instalar PowerShell 7.

## Qué tiene que estar listo antes

1. El tablero Kárdex encendido en esta misma computadora, en `http://localhost:5000`. Si el puerto es otro, se cambia en la configuración del paso 4.
2. El almacén ya publicado (la dirección `https://…vercel.app`).
3. Quien administra el almacén te dio una clave larga. No es la clave para entrar al tablero. Es otra, solo para este aviso.
4. El archivo `cloudflared.exe`. Se baja de la página oficial de Cloudflare: [github.com/cloudflare/cloudflared/releases](https://github.com/cloudflare/cloudflared/releases). Elige el archivo de Windows de 64 bits (`cloudflared-windows-amd64.exe`) y renómbralo a `cloudflared.exe`.

## Dónde poner los archivos

1. Crea la carpeta `C:\Purolomo\reporte-tunel`.
2. Copia ahí estos dos archivos de esta carpeta del proyecto:
   - `reporte-tunel.ps1`
   - `config.ejemplo.json`
3. Copia también `cloudflared.exe` a esa misma carpeta.
4. En esa carpeta, copia `config.ejemplo.json` y ponle de nombre `config.json`.

`config.json` se queda solo en esta computadora. No lo mandes por correo ni lo subas a ningún lado: lleva la clave.

## Cómo configurarlo

Abre `config.json` con el Bloc de notas y deja algo así (con tus datos):

```json
{
  "AlmacenUrl": "https://tu-almacen.vercel.app",
  "Clave": "la-clave-que-te-pasaron",
  "Cloudflared": "C:\\Purolomo\\reporte-tunel\\cloudflared.exe",
  "UrlLocal": "http://localhost:5000",
  "Modo": "iniciar",
  "ArchivoLog": ""
}
```

- `AlmacenUrl` es la dirección del almacén, sin barra al final.
- `Clave` es la clave de reporte.
- `Cloudflared` es la ruta de `cloudflared.exe`. Las barras se escriben dobles, como en el ejemplo.
- `UrlLocal` es donde está el tablero en esta computadora.
- `Modo` déjalo en `iniciar`. El programa abre el túnel y lee la dirección él solo.

Otra forma, sin escribir la clave en el archivo: en el menú Inicio busca «variables de entorno», entra en «Variables de entorno» del usuario y crea:

| Nombre | Valor |
|---|---|
| `PUROLOMO_ALMACEN_URL` | `https://tu-almacen.vercel.app` |
| `PUROLOMO_REPORTE_CLAVE` | la clave |

Si existen, mandan sobre el archivo. No hace falta reiniciar Windows: el próximo inicio de sesión ya las ve. Si las acabas de crear y vas a probar ahora, cierra y abre PowerShell.

## Cómo probarlo a mano

1. Confirma que el tablero Kárdex ya está abierto.
2. Pulsa la tecla Windows, escribe `PowerShell` y ábrelo.
3. Pega esta línea y pulsa Enter (cambia la ruta si no usaste `C:\Purolomo\reporte-tunel`):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Purolomo\reporte-tunel\reporte-tunel.ps1"
```

4. Espera. Tiene que aparecer una línea como esta:

```text
Reportada: https://nombre-largo.trycloudflare.com
```

5. En el almacén, entra como administrador y abre **Registrar entradas**. Arriba debe verse la misma dirección y la hora del aviso.
6. Deja esa ventana de PowerShell abierta mientras usen el tablero. Si la cierras, el túnel se apaga.

Si dice que no encuentra `cloudflared.exe`, revisa la ruta en `config.json`. Si dice que no pudo avisar al almacén, revisa `AlmacenUrl` y la clave. No inventes una dirección de prueba: el almacén solo acepta direcciones `https://….trycloudflare.com`.

### Si el túnel ya lo abres tú

Puedes dejar `cloudflared` como lo arrancas hoy y que este programa solo lea el texto. En la ventana donde lo abres, la salida tiene que guardarse en un archivo. Por ejemplo, en PowerShell:

```powershell
& "C:\Purolomo\reporte-tunel\cloudflared.exe" tunnel --url http://localhost:5000 *>&1 | Tee-Object -FilePath "C:\Purolomo\reporte-tunel\cloudflared.log"
```

En `config.json` cambia:

```json
"Modo": "seguir",
"ArchivoLog": "C:\\Purolomo\\reporte-tunel\\cloudflared.log"
```

El modo recomendado es `iniciar`. Usa `seguir` solo si el túnel ya lo arranca otra cosa.

## Que arranque solo al iniciar sesión

Cuando la prueba a mano ya mostró `Reportada:`, ciérrala (Ctrl+C) y registra la tarea. Abre PowerShell y pega esto. La ruta tiene que ser la de tu carpeta:

```powershell
$accion = New-ScheduledTaskAction -Execute "powershell.exe" -Argument '-NoProfile -ExecutionPolicy Bypass -File "C:\Purolomo\reporte-tunel\reporte-tunel.ps1"'
$cuando = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$quien = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName "Purolomo reporte tunel kardex" -Action $accion -Trigger $cuando -Principal $quien -Force
```

El mismo alta, en una sola línea de `schtasks`, por si prefieres el símbolo del sistema:

```bat
schtasks /Create /TN "Purolomo reporte tunel kardex" /SC ONLOGON /RL LIMITED /F /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"C:\Purolomo\reporte-tunel\reporte-tunel.ps1\""
```

Cierra sesión y vuelve a entrar. El túnel arranca solo. Para verlo: menú Inicio, «Programador de tareas», biblioteca, tarea «Purolomo reporte tunel kardex».

Si cloudflared se cierra, el programa lo vuelve a abrir. Si la dirección cambió, la manda otra vez. Si el almacén no contesta, reintenta solo.

## Seguridad

- Este programa solo hace peticiones de salida hacia el almacén. No abre puertos en el router ni en el firewall de Windows.
- Cada aviso manda únicamente la dirección del túnel (`https://….trycloudflare.com`) y, en la cabecera, la clave de reporte. No manda claves del tablero, ni productos, ni archivos.
- Mientras el túnel está encendido, quien tenga esa dirección puede llegar al tablero. Por eso cambia en cada reinicio y no se deja un túnel fijo. La clave de `config.json` no se comparte.
- Para quitarlo:
  1. Abre PowerShell y pega:

     ```powershell
     Unregister-ScheduledTask -TaskName "Purolomo reporte tunel kardex" -Confirm:$false
     ```

     O, en el símbolo del sistema: `schtasks /Delete /TN "Purolomo reporte tunel kardex" /F`
  2. Abre el Administrador de tareas y, si aparece `cloudflared.exe`, ciérralo.
  3. Borra la carpeta `C:\Purolomo\reporte-tunel`.
  4. Si creaste las variables `PUROLOMO_ALMACEN_URL` y `PUROLOMO_REPORTE_CLAVE`, bórralas en las variables de entorno del usuario.

El almacén se queda con la última dirección que recibió. Al quitar el programa, esa dirección deja de actualizarse. No se borra sola.
