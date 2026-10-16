"use client";

// Otimização de vídeo no browser (WebCodecs, aceleração por hardware): converte para MP4 H.264/AAC até 1080p — o formato
// que o Instagram usa — com o bitrate calculado para caber num tamanho máximo. Usado quando não há armazenamento para
// ficheiros grandes (Supabase Free: 50 MB por ficheiro). A biblioteca só é carregada quando é precisa.

export type OptimizeResult = { file: File } | { error: "cant_decode" | "too_long" | "stalled" };

/** Sem progresso durante este tempo → a conversão encravou (descodificador/codificador do browser parado). */
const STALL_MS = 45_000;

/** Bitrate de vídeo (bps) para caber em `maxBytes` com áudio a 128 kbps e ~7% de margem; máx. 12 Mbps. */
export function targetBitrate(maxBytes: number, seconds: number, audio = 128_000) {
  if (!(seconds > 0)) return 0;
  return Math.min(12_000_000, Math.floor((maxBytes * 8 * 0.93) / seconds - audio));
}

export async function optimizeVideo(file: File, maxBytes: number, onProgress?: (fraction: number) => void): Promise<OptimizeResult> {
  if (typeof VideoEncoder === "undefined") return { error: "cant_decode" };
  const mb = await import("mediabunny");
  const open = () => new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });

  // 1) ler o vídeo uma vez: duração, tamanho e bitrate alvo
  const probe = open();
  let dims: { width: number } | { height: number };
  let bitrate: number;
  try {
    const track = await probe.getPrimaryVideoTrack();
    if (!track || !(await track.canDecode())) return { error: "cant_decode" };
    bitrate = targetBitrate(maxBytes, await probe.computeDuration());
    if (bitrate < 1_500_000) return { error: "too_long" }; // abaixo disto a qualidade fica fraca demais
    // lado maior até 1920 px (1080×1920 num reel); nunca aumenta
    const landscape = track.displayWidth >= track.displayHeight;
    dims = landscape ? { width: Math.min(1920, track.displayWidth) } : { height: Math.min(1920, track.displayHeight) };
  } finally {
    probe.dispose?.();
  }

  // 2) converter: primeiro com o hardware de vídeo; se encravar (acontece no Safari), repete por software
  for (const hardwareAcceleration of ["prefer-hardware", "prefer-software"] as const) {
    const input = open();
    try {
      const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }), target: new mb.BufferTarget() });
      const conversion = await mb.Conversion.init({
        input,
        output,
        video: { ...dims, codec: "avc", bitrate, forceTranscode: true, hardwareAcceleration },
        audio: { codec: "aac", bitrate: 128_000 },
      });
      if (!conversion.isValid) return { error: "cant_decode" };
      let last = Date.now();
      conversion.onProgress = (p: number) => {
        last = Date.now();
        onProgress?.(p);
      };
      // vigia: se o browser deixar de converter, cancela em vez de ficar parado para sempre
      let stalled = false;
      const watch = setInterval(() => {
        if (Date.now() - last < STALL_MS) return;
        stalled = true;
        void conversion.cancel();
      }, 5_000);
      try {
        await conversion.execute();
      } catch (e) {
        if (stalled) {
          onProgress?.(0);
          continue; // próxima tentativa (ou "stalled" no fim)
        }
        throw e;
      } finally {
        clearInterval(watch);
      }
      const buf = output.target.buffer;
      if (!buf) return { error: "cant_decode" };
      return { file: new File([buf], file.name.replace(/\.[^.]+$/, "") + ".mp4", { type: "video/mp4" }) };
    } finally {
      input.dispose?.();
    }
  }
  return { error: "stalled" };
}
