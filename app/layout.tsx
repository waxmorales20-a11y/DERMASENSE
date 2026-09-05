import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

// Cifras tabulares para que los numeros se alineen entre simulaciones:
// es lo que hace posible compararlos de un vistazo.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DERMASENSE — Laboratorio virtual de simulacion de piel",
  description:
    "Simulacion in silico de penetracion dermica para I+D cosmetica. Herramienta de soporte a la decision en fase exploratoria, no de validacion regulatoria.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
