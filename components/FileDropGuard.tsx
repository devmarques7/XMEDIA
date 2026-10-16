"use client";

// Impede o navegador de abrir um ficheiro largado fora de uma zona de upload (perdia-se a página).
import { useEffect } from "react";

export function FileDropGuard() {
  useEffect(() => {
    const stop = (e: DragEvent) => {
      if (e.dataTransfer && [...e.dataTransfer.types].includes("Files")) e.preventDefault();
    };
    window.addEventListener("dragover", stop);
    window.addEventListener("drop", stop);
    return () => {
      window.removeEventListener("dragover", stop);
      window.removeEventListener("drop", stop);
    };
  }, []);
  return null;
}
