import "./globals.css";
import type { Metadata } from "next";
import "./otp.css";
import { ToastProvider } from "@/components/ToastProvider";
import { SessionTimeoutMonitor } from "@/components/SessionTimeoutMonitor";
export const metadata: Metadata = { title: "Hakika Business OS", description: "One operating system for the businesses that keep Kenya moving." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body><ToastProvider>{children}<SessionTimeoutMonitor /></ToastProvider></body></html>; }
