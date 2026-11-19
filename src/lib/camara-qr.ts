/** La elección de cámara del usuario, en este navegador. */
export const CLAVE_CAMARA = "purolomo-almacen.camara";

export type CamaraLista = {
  deviceId: string;
  label: string;
  kind?: string;
};

/** Ultra gran angular, 0.5x, dual wide o «wide angle». La trasera principal no entra aquí. */
export function esGranAngular(etiqueta: string) {
  return /ultra|wide angle|gran angular|0\.5|dual wide|\bwide\b/i.test(etiqueta);
}

function esTele(etiqueta: string) {
  return /tele/i.test(etiqueta);
}

function esFrontal(etiqueta: string) {
  return /front|frontal|\buser\b/i.test(etiqueta);
}

function esTrasera(etiqueta: string) {
  return /back|rear|trasera|environment/i.test(etiqueta) && !esFrontal(etiqueta);
}

/** «Back Camera» y «Cámara trasera» son la 1x. Tele y ultra quedan por debajo. */
function puntaje(etiqueta: string) {
  const nombre = etiqueta.trim();
  if (!nombre || esGranAngular(nombre) || esFrontal(nombre)) return 0;
  if (/^(back camera|c[aá]mara trasera)$/i.test(nombre)) return 100;
  if (esTrasera(nombre) && !esTele(nombre)) return 80;
  if (esTrasera(nombre)) return 20;
  return 10;
}

/**
 * Prefiere la cámara que el usuario guardó. Si no hay, la trasera principal
 * (no la ultra gran angular). Sin etiquetas, no elige: hace falta el permiso.
 */
export function elegirCamaraPrincipal(dispositivos: CamaraLista[], preferido?: string | null) {
  const videos = dispositivos.filter((dispositivo) => (dispositivo.kind ?? "videoinput") === "videoinput");
  if (preferido && videos.some((dispositivo) => dispositivo.deviceId === preferido)) return preferido;
  let mejor: CamaraLista | undefined;
  let puntos = 0;
  for (const dispositivo of videos) {
    const valor = puntaje(dispositivo.label);
    if (valor > puntos) {
      puntos = valor;
      mejor = dispositivo;
    }
  }
  return mejor?.deviceId;
}

/** 0.5x sube a 1x. Una cámara que ya parte en 1x y llega a 2x se acerca un poco. */
export function objetivoZoom(min: number, max: number) {
  if (min <= 0.6 && max >= 1) return 1;
  if (min <= 1 && max >= 2) return 2;
  return min;
}
