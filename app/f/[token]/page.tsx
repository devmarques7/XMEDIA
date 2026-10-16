import type { Metadata } from "next";
import { FeedbackForm } from "./form";

export const metadata: Metadata = { title: "MediaMarques — Feedback", robots: { index: false, follow: false } };

/** Formulário público de avaliação (link de uso único enviado por email). */
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  return <FeedbackForm token={(await params).token} />;
}
