import type { Metadata } from "next";
import { Rubik, Karantina } from "next/font/google";
import "./globals.css";

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["latin", "hebrew"],
});

const karantina = Karantina({
  variable: "--font-karantina",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "מזהה סרטים",
  description: "זהה מאיזה סרט תמונה נלקחה באמצעות AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="he"
      className={`${rubik.variable} ${karantina.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" style={{ fontFamily: "var(--font-rubik), sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
