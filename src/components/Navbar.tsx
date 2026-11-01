'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from './ThemeProvider';
import {
  Car,
  LayoutDashboard,
  CalendarPlus,
  Ticket,
  DoorOpen,
  ShieldCheck,
  Moon,
  Sun,
  Menu,
  X,
  Radio,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function Navbar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: '/', label: 'Home', icon: Car },
    { href: '/dashboard', label: 'Live Map', icon: LayoutDashboard },
    { href: '/book', label: 'Book Slot', icon: CalendarPlus },
    { href: '/bookings', label: 'My Bookings', icon: Ticket },
    { href: '/gate', label: 'Gate Kiosk', icon: DoorOpen },
    { href: '/admin', label: 'Admin & Simulator', icon: ShieldCheck },
  ];

  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-white/85 dark:bg-[#08111e]/85 border-b border-slate-200/80 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0B2545] to-[#0F9D9A] flex items-center justify-center text-white shadow-md shadow-[#0F9D9A]/20 group-hover:scale-105 transition-transform">
            <Radio className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <span className="font-bold text-lg tracking-tight text-[#0B2545] dark:text-white flex items-center gap-1.5">
              ParkSmart <span className="text-[#0F9D9A]">IoT</span>
            </span>
            <span className="text-[10px] block font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Intelligent Slot Detection
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all',
                  isActive
                    ? 'bg-[#0B2545] text-white dark:bg-[#0F9D9A] dark:text-[#08111e] shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-[#0B2545] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                )}
              >
                <Icon className="w-4 h-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Actions: Theme Toggle & Mobile Menu */}
        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5 text-[#F2A541]" />
            ) : (
              <Moon className="w-5 h-5 text-[#0B2545]" />
            )}
          </button>

          {/* Quick CTA on Desktop */}
          <Link
            href="/book"
            className="hidden sm:inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-semibold bg-[#0F9D9A] hover:bg-[#0c827f] text-white shadow-sm transition-all hover:scale-102"
          >
            Reserve Slot
          </Link>

          {/* Mobile hamburger button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            className="md:hidden p-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#08111e]/95 backdrop-blur-md px-4 pt-2 pb-4 space-y-1">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-[#0B2545] text-white dark:bg-[#0F9D9A] dark:text-[#08111e]'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                )}
              >
                <Icon className="w-5 h-5" />
                {link.label}
              </Link>
            );
          })}
          <div className="pt-2">
            <Link
              href="/book"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full flex items-center justify-center py-2.5 rounded-xl text-sm font-semibold bg-[#0F9D9A] text-white shadow-sm"
            >
              Reserve Slot Now
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
