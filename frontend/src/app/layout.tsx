import "./globals.css";
import type { Metadata } from "next";
import "./otp.css";
export const metadata: Metadata = { title: "Hakika Business OS", description: "One operating system for the businesses that keep Kenya moving." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
