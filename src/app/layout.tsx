import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Inter } from "next/font/google";
import "./globals.css";

const bebas = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "Ritmos Latinos · Gestor",
    template: "%s · Ritmos Latinos",
  },
  description:
    "Sistema de gestión de alumnos y CRM de la academia Ritmos Latinos.",
};

export const viewport: Viewport = {
  themeColor: "#1d1d1f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR" className={`${bebas.variable} ${inter.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
