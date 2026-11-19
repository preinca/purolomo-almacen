"use client";

import { useEffect, useRef, useState } from "react";
import { cargarImagen, decodificarImagen, decodificarPixeles } from "@/components/decodificar-imagen-qr";
import {
  CLAVE_CAMARA,
  elegirCamaraPrincipal,
  esGranAngular,
  objetivoZoom,
  type CamaraLista,
} from "@/lib/camara-qr";
import { partirToken } from "@/lib/token-paleta";

type DetectorQr = {
  detect: (source: CanvasImageSource) => Promise<{ rawValue?: string }[]>;
};

type Capacidades = MediaTrackCapabilities & {
  zoom?: { min: number; max: number };
  focusMode?: string[];
  torch?: boolean;
};

const INTERVALO_MS = 80;

export function EscanerToken({ onToken }: { onToken: (token: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [camara, setCamara] = useState(false);
  const [sesion, setSesion] = useState(0);
  const [camaras, setCamaras] = useState<CamaraLista[]>([]);
  const [elegida, setElegida] = useState("");
  const [linternaDisponible, setLinternaDisponible] = useState(false);
  const [linterna, setLinterna] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<DetectorQr | null>(null);
  const onTokenRef = useRef(onToken);
  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  function detenerCamara() {
    streamRef.current?.getTracks().forEach((pista) => pista.stop());
    streamRef.current = null;
    setCamara(false);
    setLinterna(false);
    setLinternaDisponible(false);
  }

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((pista) => pista.stop());
    };
  }, []);

  useEffect(() => {
    if (!camara || !videoRef.current || !streamRef.current) return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    void video.play();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    let vivo = true;
    let ocupado = false;
    let espera = 0;

    const tick = async () => {
      if (!vivo || ocupado) return;
      ocupado = true;
      try {
        if (video.readyState >= 2 && video.videoWidth > 0) {
          const texto = await leerCuadro(video, canvas, ctx, detectorRef.current);
          const partes = texto ? partirToken(texto) : null;
          if (partes?.ok) {
            onTokenRef.current(partes.value.token);
            detenerCamara();
            return;
          }
        }
      } catch {
        // Un cuadro fallido no cierra la cámara.
      }
      ocupado = false;
      if (vivo) espera = window.setTimeout(() => void tick(), INTERVALO_MS);
    };

    espera = window.setTimeout(() => void tick(), INTERVALO_MS);
    return () => {
      vivo = false;
      window.clearTimeout(espera);
    };
  }, [camara, sesion]);

  async function abrirCamara() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Este navegador no abre la cámara. Escribe el token o carga una imagen del QR.");
      return;
    }
    try {
      streamRef.current?.getTracks().forEach((pista) => pista.stop());
      streamRef.current = null;
      const guardada = leerCamaraGuardada();
      let stream = await abrirStream(guardada);
      if (!stream) stream = await abrirStream(null);
      if (!stream) throw new Error("camara");
      const lista = await listarCamaras();
      const id = elegirCamaraPrincipal(lista, guardada);
      const actual = stream.getVideoTracks()[0]?.getSettings().deviceId;
      if (id && id !== actual) {
        const cambiada = await abrirStream(id);
        if (cambiada) {
          stream.getTracks().forEach((pista) => pista.stop());
          stream = cambiada;
        }
      }
      const pista = stream.getVideoTracks()[0];
      await enfocar(pista);
      streamRef.current = stream;
      detectorRef.current = crearDetector();
      setCamaras(lista);
      setElegida(pista?.getSettings().deviceId ?? id ?? "");
      setLinternaDisponible(soportaLinterna(pista));
      setLinterna(false);
      setCamara(true);
      setSesion((valor) => valor + 1);
    } catch {
      setError("No se pudo usar la cámara. Escribe el token o carga una imagen del QR.");
    }
  }

  async function cambiarCamara(id: string) {
    setError(null);
    guardarCamara(id);
    setElegida(id);
    try {
      streamRef.current?.getTracks().forEach((pista) => pista.stop());
      const stream = await abrirStream(id);
      if (!stream) throw new Error("camara");
      const pista = stream.getVideoTracks()[0];
      await enfocar(pista);
      streamRef.current = stream;
      setLinternaDisponible(soportaLinterna(pista));
      setLinterna(false);
      setSesion((valor) => valor + 1);
    } catch {
      setError("No se pudo cambiar de cámara. Escribe el token o carga una imagen del QR.");
    }
  }

  async function alternarLinterna() {
    const pista = streamRef.current?.getVideoTracks()[0];
    if (!pista) return;
    const siguiente = !linterna;
    try {
      await pista.applyConstraints({ advanced: [{ torch: siguiente } as MediaTrackConstraintSet] });
      setLinterna(siguiente);
    } catch {
      setError("Esta cámara no encendió la linterna.");
    }
  }

  async function leerArchivo(archivo: File | undefined) {
    if (!archivo) return;
    setLeyendo(true);
    setError(null);
    const url = URL.createObjectURL(archivo);
    try {
      const imagen = await cargarImagen(url);
      const texto = decodificarImagen(imagen);
      const partes = texto ? partirToken(texto) : null;
      if (!partes?.ok) {
        setError(partes?.error ?? "Esa imagen no tiene el QR de una paleta.");
        return;
      }
      onToken(partes.value.token);
    } catch {
      setError("No se pudo abrir esa imagen.");
    } finally {
      URL.revokeObjectURL(url);
      setLeyendo(false);
    }
  }

  return (
    <div className="grid gap-4">
      <button
        type="button"
        onClick={() => void abrirCamara()}
        className="inline-flex h-16 w-full items-center justify-center rounded-xl bg-blue-600 px-6 text-lg font-semibold text-white hover:bg-blue-700 sm:h-14 sm:text-base"
      >
        Escanear con cámara
      </button>
      <label className="inline-flex h-14 w-full cursor-pointer items-center justify-center rounded-xl bg-amber-500 px-4 text-center text-base font-semibold text-white hover:bg-amber-600 sm:h-12">
        {leyendo ? "Leyendo…" : "Cargar imagen de QR"}
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={leyendo}
          onChange={(event) => {
            const archivo = event.target.files?.[0];
            event.target.value = "";
            void leerArchivo(archivo);
          }}
        />
      </label>
      {camara ? (
        <div className="grid gap-3">
          <div className="relative">
            <video ref={videoRef} muted playsInline autoPlay className="max-h-80 w-full rounded-xl bg-black object-contain" />
            <div className="pointer-events-none absolute inset-[8%] rounded-lg border-2 border-white/80" />
          </div>
          {camaras.length > 1 ? (
            <label className="grid gap-1 text-sm font-medium">
              Cámara
              <select
                value={elegida}
                onChange={(event) => void cambiarCamara(event.target.value)}
                className="h-11 rounded-lg border bg-white px-3 text-sm"
              >
                {camaras.map((item, indice) => (
                  <option key={item.deviceId} value={item.deviceId}>
                    {etiquetaCamara(item.label, indice)}
                  </option>
                ))}
              </select>
              <span className="text-xs font-normal text-muted-foreground">
                Usa la trasera principal. La ultra gran angular (0.5) se ve borrosa de cerca.
              </span>
            </label>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {linternaDisponible ? (
              <button
                type="button"
                onClick={() => void alternarLinterna()}
                className="inline-flex h-11 items-center justify-center rounded-lg border px-4 text-sm"
              >
                {linterna ? "Apagar linterna" : "Linterna"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={detenerCamara}
              className="inline-flex h-11 items-center justify-center rounded-lg border px-4 text-sm"
            >
              Cerrar cámara
            </button>
          </div>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-950">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function leerCamaraGuardada() {
  try {
    return localStorage.getItem(CLAVE_CAMARA);
  } catch {
    return null;
  }
}

function guardarCamara(id: string) {
  try {
    localStorage.setItem(CLAVE_CAMARA, id);
  } catch {
    // El navegador privado no guarda la elección. La cámara sigue abierta.
  }
}

async function abrirStream(deviceId: string | null) {
  const video: MediaTrackConstraints = deviceId
    ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
    : { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } };
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: false, video });
  } catch {
    if (!deviceId) return null;
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { deviceId: { ideal: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
    } catch {
      return null;
    }
  }
}

async function listarCamaras() {
  const dispositivos = await navigator.mediaDevices.enumerateDevices();
  return dispositivos
    .filter((dispositivo) => dispositivo.kind === "videoinput")
    .map((dispositivo) => ({ deviceId: dispositivo.deviceId, label: dispositivo.label, kind: dispositivo.kind }));
}

async function enfocar(pista: MediaStreamTrack | undefined) {
  if (!pista) return;
  const capacidades = pista.getCapabilities?.() as Capacidades | undefined;
  const zoom = capacidades?.zoom;
  const pedidos: MediaTrackConstraintSet[] = [];
  if (zoom) pedidos.push({ zoom: objetivoZoom(zoom.min, zoom.max) } as MediaTrackConstraintSet);
  if (capacidades?.focusMode?.includes("continuous")) {
    pedidos.push({ focusMode: "continuous" } as MediaTrackConstraintSet);
  }
  for (const pedido of pedidos) {
    try {
      await pista.applyConstraints({ advanced: [pedido] });
    } catch {
      // El celular no deja cambiar ese ajuste. La cámara sigue abierta.
    }
  }
}

function soportaLinterna(pista: MediaStreamTrack | undefined) {
  const capacidades = pista?.getCapabilities?.() as Capacidades | undefined;
  return capacidades?.torch === true;
}

function crearDetector() {
  const Detector = (
    globalThis as { BarcodeDetector?: new (opciones: { formats: string[] }) => DetectorQr }
  ).BarcodeDetector;
  if (!Detector) return null;
  try {
    return new Detector({ formats: ["qr_code"] });
  } catch {
    return null;
  }
}

async function leerCuadro(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D | null,
  detector: DetectorQr | null,
) {
  if (detector) {
    try {
      const codigos = await detector.detect(video);
      const texto = codigos.find((codigo) => codigo.rawValue)?.rawValue;
      if (texto) return texto;
    } catch {
      // jsQR cubre los navegadores donde el detector falla a mitad de cuadro.
    }
  }
  if (!ctx) return null;
  const amplio = pintarRecorte(video, canvas, ctx, 0.92, 1600);
  const primero = amplio ? decodificarPixeles(amplio.data, amplio.width, amplio.height) : null;
  if (primero) return primero;
  const cerrado = pintarRecorte(video, canvas, ctx, 0.45, 1400);
  return cerrado ? decodificarPixeles(cerrado.data, cerrado.width, cerrado.height) : null;
}

function pintarRecorte(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  fraccion: number,
  maxLado: number,
) {
  const lado = Math.round(Math.min(video.videoWidth, video.videoHeight) * fraccion);
  if (lado < 1) return null;
  const sx = Math.round((video.videoWidth - lado) / 2);
  const sy = Math.round((video.videoHeight - lado) / 2);
  const escala = lado > maxLado ? maxLado / lado : 1;
  const width = Math.max(1, Math.round(lado * escala));
  canvas.width = width;
  canvas.height = width;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(video, sx, sy, lado, lado, 0, 0, width, width);
  return ctx.getImageData(0, 0, width, width);
}

function etiquetaCamara(etiqueta: string, indice: number) {
  if (!etiqueta) return `Cámara ${indice + 1}`;
  if (esGranAngular(etiqueta)) return `${etiqueta} (0.5, no enfoca de cerca)`;
  return etiqueta;
}
