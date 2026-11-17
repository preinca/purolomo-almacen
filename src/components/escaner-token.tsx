"use client";

import { useEffect, useRef, useState } from "react";
import { cargarImagen, decodificarImagen, decodificarPixeles } from "@/components/decodificar-imagen-qr";
import { partirToken } from "@/lib/token-paleta";

export function EscanerToken({ onToken }: { onToken: (token: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [camara, setCamara] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  function detenerCamara() {
    streamRef.current?.getTracks().forEach((pista) => pista.stop());
    streamRef.current = null;
    setCamara(false);
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

    const tick = () => {
      if (!vivo || ocupado) return;
      try {
        if (video.readyState >= 2 && ctx && video.videoWidth > 0) {
          const lado = Math.round(Math.min(video.videoWidth, video.videoHeight) * 0.72);
          const sx = Math.round((video.videoWidth - lado) / 2);
          const sy = Math.round((video.videoHeight - lado) / 2);
          const maxLado = 1200;
          const escala = lado > maxLado ? maxLado / lado : 1;
          const width = Math.max(1, Math.round(lado * escala));
          canvas.width = width;
          canvas.height = width;
          ctx.drawImage(video, sx, sy, lado, lado, 0, 0, width, width);
          const datos = ctx.getImageData(0, 0, width, width);
          const texto = decodificarPixeles(datos.data, width, width);
          const partes = texto ? partirToken(texto) : null;
          if (partes?.ok) {
            ocupado = true;
            onTokenRef.current(partes.value.token);
            detenerCamara();
            return;
          }
        }
      } catch {
        ocupado = false;
      }
      if (vivo && !ocupado) espera = window.setTimeout(tick, 180);
    };

    espera = window.setTimeout(tick, 180);
    return () => {
      vivo = false;
      window.clearTimeout(espera);
    };
  }, [camara]);

  async function abrirCamara() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Este navegador no abre la cámara. Carga una imagen del QR.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      setCamara(true);
    } catch {
      setError("No se pudo usar la cámara. Carga una imagen del QR.");
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
          <video ref={videoRef} muted playsInline className="max-h-72 w-full rounded-xl bg-black object-cover" />
          <button
            type="button"
            onClick={detenerCamara}
            className="inline-flex h-11 items-center justify-center rounded-lg border px-4 text-sm"
          >
            Cerrar cámara
          </button>
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
