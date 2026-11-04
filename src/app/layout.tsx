import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Toaster } from 'sonner';
import { Suspense } from 'react';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ParkWise | Smart Parking & Mobility Platform',
  description:
    'IoT-driven multi-level parking platform by Kartikay Saklani & Anshuman (Chandigarh University). Features real-time ultrasonic slot detection, automated barrier entry, and instant QR passes.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen flex flex-col bg-[#F4F8FB] dark:bg-[#08111e] transition-colors`}>
        <ThemeProvider>
          <Suspense fallback={<header className="h-16 border-b border-slate-200 dark:border-slate-800" />}>
            <Navbar />
          </Suspense>
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <Suspense fallback={<div className="py-12 text-center text-xs text-slate-400">Loading...</div>}>
              {children}
            </Suspense>
          </main>
          <Footer />
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
