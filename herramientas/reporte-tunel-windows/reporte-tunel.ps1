#Requires -Version 5.1
<#
  Avisa al almacén la dirección nueva del túnel rápido de Cloudflare.
  PowerShell 5.1 (el de Windows 11). No pongas la clave en este archivo:
  va en config.json o en variables de entorno del usuario.
#>

$ErrorActionPreference = "Stop"
$carpetaScript = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $carpetaScript) { $carpetaScript = (Get-Location).Path }

function Leer-VariableUsuario([string]$nombre) {
  $proceso = [Environment]::GetEnvironmentVariable($nombre, "Process")
  if ($proceso) { return $proceso }
  $usuario = [Environment]::GetEnvironmentVariable($nombre, "User")
  if ($usuario) { return $usuario }
  return ""
}

function Leer-Config {
  $archivo = Join-Path $carpetaScript "config.json"
  $json = $null
  if (Test-Path -LiteralPath $archivo) {
    $json = Get-Content -LiteralPath $archivo -Raw -Encoding UTF8 | ConvertFrom-Json
  }

  $almacen = Leer-VariableUsuario "PUROLOMO_ALMACEN_URL"
  if (-not $almacen -and $json) { $almacen = [string]$json.AlmacenUrl }
  $clave = Leer-VariableUsuario "PUROLOMO_REPORTE_CLAVE"
  if (-not $clave -and $json) { $clave = [string]$json.Clave }
  $cloudflared = Leer-VariableUsuario "PUROLOMO_CLOUDFLARED"
  if (-not $cloudflared -and $json) { $cloudflared = [string]$json.Cloudflared }
  $urlLocal = Leer-VariableUsuario "PUROLOMO_URL_LOCAL"
  if (-not $urlLocal -and $json) { $urlLocal = [string]$json.UrlLocal }
  $modo = Leer-VariableUsuario "PUROLOMO_MODO"
  if (-not $modo -and $json) { $modo = [string]$json.Modo }
  $archivoLog = Leer-VariableUsuario "PUROLOMO_ARCHIVO_LOG"
  if (-not $archivoLog -and $json) { $archivoLog = [string]$json.ArchivoLog }

  if (-not $almacen -or -not $clave) {
    Write-Host "Falta la dirección del almacén o la clave. Revisa config.json o las variables PUROLOMO_ALMACEN_URL y PUROLOMO_REPORTE_CLAVE."
    exit 1
  }
  if (-not $urlLocal) { $urlLocal = "http://localhost:5000" }
  if (-not $modo) { $modo = "iniciar" }

  return @{
    Carpeta = $carpetaScript
    AlmacenUrl = $almacen.Trim().TrimEnd("/")
    Clave = $clave.Trim()
    Cloudflared = $cloudflared
    UrlLocal = $urlLocal.Trim()
    Modo = $modo.Trim().ToLower()
    ArchivoLog = $archivoLog
  }
}

function Buscar-Url([string]$texto) {
  if (-not $texto) { return "" }
  $coincidencia = [regex]::Match($texto, "https://[a-zA-Z0-9-]+\.trycloudflare\.com")
  if ($coincidencia.Success) { return $coincidencia.Value.ToLower() }
  return ""
}

function Enviar-Url($config, [string]$url) {
  $destino = $config.AlmacenUrl + "/api/kardex-externo/url"
  $headers = @{ Authorization = ("Bearer " + $config.Clave) }
  $json = @{ url = $url } | ConvertTo-Json -Compress
  $espera = 5
  for ($intento = 1; $intento -le 8; $intento++) {
    try {
      Invoke-RestMethod -Method Post -Uri $destino -Headers $headers -Body $json -ContentType "application/json; charset=utf-8" | Out-Null
      Write-Host ("Reportada: " + $url)
      return $true
    } catch {
      Write-Host ("No se pudo avisar al almacén (intento " + $intento + "). Reintento en " + $espera + " s.")
      Start-Sleep -Seconds $espera
      if ($espera -lt 60) { $espera = $espera * 2 }
    }
  }
  return $false
}

function Leer-Novedades([string]$archivo, [ref]$posicion) {
  if (-not (Test-Path -LiteralPath $archivo)) { return "" }
  $flujo = [System.IO.File]::Open($archivo, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
  try {
    if ($posicion.Value -gt $flujo.Length) { $posicion.Value = 0 }
    $null = $flujo.Seek($posicion.Value, [System.IO.SeekOrigin]::Begin)
    $resto = [int]($flujo.Length - $flujo.Position)
    if ($resto -le 0) { return "" }
    $buffer = New-Object byte[] $resto
    $leidos = $flujo.Read($buffer, 0, $resto)
    $posicion.Value = $flujo.Position
    if ($leidos -le 0) { return "" }
    return [System.Text.Encoding]::UTF8.GetString($buffer, 0, $leidos)
  } finally {
    $flujo.Dispose()
  }
}

function Registrar-SiCambia($config, [string]$texto, [ref]$ultima) {
  $url = Buscar-Url $texto
  if (-not $url) { return }
  if ($url -eq $ultima.Value) { return }
  if (Enviar-Url $config $url) { $ultima.Value = $url }
}

function Iniciar-Cloudflared($config) {
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $config.Cloudflared
  $psi.Arguments = "tunnel --url " + $config.UrlLocal
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.CreateNoWindow = $true
  $psi.StandardOutputEncoding = [System.Text.Encoding]::UTF8
  $psi.StandardErrorEncoding = [System.Text.Encoding]::UTF8
  $proceso = New-Object System.Diagnostics.Process
  $proceso.StartInfo = $psi
  $cola = New-Object "System.Collections.Concurrent.ConcurrentQueue[object]"
  $null = $proceso.Start()
  $salida = Register-ObjectEvent -InputObject $proceso -EventName OutputDataReceived -MessageData $cola -Action {
    if ($EventArgs.Data) { $Event.MessageData.Enqueue([string]$EventArgs.Data) }
  }
  $errorEvt = Register-ObjectEvent -InputObject $proceso -EventName ErrorDataReceived -MessageData $cola -Action {
    if ($EventArgs.Data) { $Event.MessageData.Enqueue([string]$EventArgs.Data) }
  }
  $proceso.BeginOutputReadLine()
  $proceso.BeginErrorReadLine()
  return @{ Proceso = $proceso; Cola = $cola; Salida = $salida; ErrorEvt = $errorEvt }
}

function Cerrar-Cloudflared($job) {
  if ($job.Salida) { Unregister-Event -SubscriptionId $job.Salida.Id -ErrorAction SilentlyContinue }
  if ($job.ErrorEvt) { Unregister-Event -SubscriptionId $job.ErrorEvt.Id -ErrorAction SilentlyContinue }
  if ($job.Proceso -and -not $job.Proceso.HasExited) {
    try { $job.Proceso.Kill() } catch { }
  }
}

$script:config = Leer-Config
Write-Host "Avisando a" $script:config.AlmacenUrl
Write-Host "Modo:" $script:config.Modo
$ultima = ""

if ($script:config.Modo -eq "seguir") {
  if (-not $script:config.ArchivoLog) {
    Write-Host "En modo seguir falta ArchivoLog en config.json (el archivo donde cloudflared escribe su salida)."
    exit 1
  }
  $posicion = [int64]0
  if (Test-Path -LiteralPath $script:config.ArchivoLog) {
    $posicion = (Get-Item -LiteralPath $script:config.ArchivoLog).Length
  }
  while ($true) {
    $texto = Leer-Novedades $script:config.ArchivoLog ([ref]$posicion)
    Registrar-SiCambia $script:config $texto ([ref]$ultima)
    Start-Sleep -Seconds 2
  }
}

while ($true) {
  if (-not (Test-Path -LiteralPath $script:config.Cloudflared)) {
    Write-Host "No encuentro cloudflared.exe en" $script:config.Cloudflared
    Write-Host "Reviso de nuevo en 30 segundos."
    Start-Sleep -Seconds 30
    continue
  }
  Write-Host "Abriendo el túnel hacia" $script:config.UrlLocal
  $job = $null
  try {
    $job = Iniciar-Cloudflared $script:config
    while (-not $job.Proceso.HasExited) {
      $linea = $null
      while ($job.Cola.TryDequeue([ref]$linea)) {
        Registrar-SiCambia $script:config ([string]$linea) ([ref]$ultima)
      }
      Start-Sleep -Seconds 2
    }
    Write-Host "cloudflared se cerró. Lo vuelvo a abrir en 5 segundos."
  } catch {
    Write-Host "No se pudo abrir cloudflared. Reintento en 15 segundos."
  } finally {
    if ($job) { Cerrar-Cloudflared $job }
  }
  Start-Sleep -Seconds 5
}
