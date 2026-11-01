'use client';

import React from 'react';
import Link from 'next/link';
import { Cpu, ShieldCheck, Heart, Sparkles } from 'lucide-react';

export function Footer() {
  return (
    <footer className="w-full border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070e1a] text-slate-600 dark:text-slate-400 py-10 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand Col */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#0B2545] dark:bg-[#0F9D9A] flex items-center justify-center text-white dark:text-[#08111e] font-bold text-sm">
                P
              </div>
              <span className="font-bold text-base text-[#0B2545] dark:text-white">
                Smart Parking System with Intelligent Slot Detection
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
              An IoT & Cloud powered garage automation platform developed for lab demonstrations and engineering exhibitions. Features automated ESP32 ultrasonic slot detection, cryptographic QR check-in, dynamic LCD navigation, and real-time cloud synchronisation.
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-200">
              System Pages
            </h4>
            <ul className="text-sm space-y-1.5">
              <li>
                <Link href="/dashboard" className="hover:text-[#0F9D9A] transition-colors">
                  Live Floor Map
                </Link>
              </li>
              <li>
                <Link href="/book" className="hover:text-[#0F9D9A] transition-colors">
                  Book a Slot
                </Link>
              </li>
              <li>
                <Link href="/gate" className="hover:text-[#0F9D9A] transition-colors">
                  Staff Gate Kiosk
                </Link>
              </li>
              <li>
                <Link href="/admin" className="hover:text-[#0F9D9A] transition-colors">
                  Admin & Demo Simulator
                </Link>
              </li>
            </ul>
          </div>

          {/* Hardware Tech Stack */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-200">
              Lab Specs
            </h4>
            <div className="text-xs space-y-1 text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-[#0F9D9A]" />
                <span>ESP32 NodeMCU + 3x HC-SR04</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#F2A541]" />
                <span>16x2 I2C LCD + SG90 Servo Gate</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                <span>Supabase PostgreSQL + Realtime</span>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© 2026 Smart Parking Lab Project. Built for College Lab & Expo Showcase.</p>
          <div className="flex items-center gap-2">
            <span>Engineering Expo Edition</span>
            <span>•</span>
            <span className="text-[#0F9D9A] font-medium">Ready for Vercel Deployment</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
