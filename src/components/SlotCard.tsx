'use client';

import React from 'react';
import { ParkingSlot, SlotStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Cpu, Cloud, Car, CheckCircle2, Clock, AlertTriangle, Shield, Wrench } from 'lucide-react';

interface SlotCardProps {
  slot: ParkingSlot;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (slot: ParkingSlot) => void;
  showAdminControls?: boolean;
  onStatusChange?: (id: string, status: SlotStatus) => void;
}

export function SlotCard({
  slot,
  selectable = false,
  selected = false,
  onSelect,
  showAdminControls = false,
  onStatusChange,
}: SlotCardProps) {
  const isAvailable = slot.status === 'free';

  const statusConfig: Record<
    SlotStatus,
    {
      label: string;
      bg: string;
      badgeBg: string;
      textColor: string;
      border: string;
      icon: React.ComponentType<{ className?: string }>;
      glow: string;
    }
  > = {
    free: {
      label: 'Available',
      bg: 'bg-emerald-50/70 dark:bg-emerald-950/20',
      badgeBg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300',
      textColor: 'text-emerald-600 dark:text-emerald-400',
      border: 'border-emerald-300 dark:border-emerald-800/80',
      icon: CheckCircle2,
      glow: 'shadow-emerald-500/10',
    },
    booked: {
      label: 'Booked',
      bg: 'bg-blue-50/70 dark:bg-blue-950/20',
      badgeBg: 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300',
      textColor: 'text-blue-600 dark:text-blue-400',
      border: 'border-blue-300 dark:border-blue-800/80',
      icon: Clock,
      glow: 'shadow-blue-500/10',
    },
    assigned: {
      label: 'Car In Transit',
      bg: 'bg-amber-50/80 dark:bg-amber-950/30',
      badgeBg: 'bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-300',
      textColor: 'text-amber-600 dark:text-amber-400',
      border: 'border-amber-400 dark:border-amber-700',
      icon: AlertTriangle,
      glow: 'shadow-amber-500/20 ring-2 ring-amber-400/50',
    },
    occupied: {
      label: 'Occupied',
      bg: 'bg-rose-50/70 dark:bg-rose-950/25',
      badgeBg: 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300',
      textColor: 'text-rose-600 dark:text-rose-400',
      border: 'border-rose-300 dark:border-rose-800/80',
      icon: Car,
      glow: 'shadow-rose-500/10',
    },
    reserved: {
      label: 'Reserved',
      bg: 'bg-purple-50/70 dark:bg-purple-950/20',
      badgeBg: 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300',
      textColor: 'text-purple-600 dark:text-purple-400',
      border: 'border-purple-300 dark:border-purple-800/80',
      icon: Shield,
      glow: 'shadow-purple-500/10',
    },
    maintenance: {
      label: 'Maintenance',
      bg: 'bg-slate-100/70 dark:bg-slate-800/40',
      badgeBg: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300',
      textColor: 'text-slate-500 dark:text-slate-400',
      border: 'border-slate-300 dark:border-slate-700',
      icon: Wrench,
      glow: '',
    },
  };

  const currentConfig = statusConfig[slot.status] || statusConfig.free;
  const StatusIcon = currentConfig.icon;

  const handleClick = () => {
    if (selectable && isAvailable && onSelect) {
      onSelect(slot);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        'relative rounded-2xl p-5 border transition-all duration-200 flex flex-col justify-between select-none',
        currentConfig.bg,
        currentConfig.border,
        currentConfig.glow,
        selectable && isAvailable && 'cursor-pointer hover:scale-102 hover:shadow-lg',
        selectable && !isAvailable && 'cursor-not-allowed opacity-65',
        selected && 'ring-3 ring-[#0F9D9A] shadow-lg shadow-[#0F9D9A]/25 -translate-y-1'
      )}
    >
      {/* Top row: Slot Code + Type Badge */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black tracking-tight text-[#0B2545] dark:text-white">
              {slot.code}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-md font-semibold bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {slot.floor === 0 ? 'Ground Floor' : '1st Floor'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            {slot.type === 'sensor' ? (
              <>
                <Cpu className="w-3.5 h-3.5 text-[#0F9D9A]" />
                <span>ESP32 Ultrasonic</span>
              </>
            ) : (
              <>
                <Cloud className="w-3.5 h-3.5 text-blue-500" />
                <span>Virtual Slot</span>
              </>
            )}
          </div>
        </div>

        {/* Status Pill */}
        <div
          className={cn(
            'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold shadow-xs',
            currentConfig.badgeBg
          )}
        >
          <StatusIcon className="w-3.5 h-3.5" />
          <span>{currentConfig.label}</span>
        </div>
      </div>

      {/* Middle visual: Car illustration / Slot indicator */}
      <div className="my-4 py-3 flex flex-col items-center justify-center">
        {slot.status === 'occupied' || slot.id === 'G3' ? (
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 flex items-center justify-center text-rose-500">
            <Car className="w-10 h-10 animate-pulse-subtle" />
          </div>
        ) : slot.status === 'assigned' ? (
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center text-amber-500 relative">
            <Car className="w-10 h-10 animate-bounce" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            </span>
          </div>
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-500">
            <CheckCircle2 className="w-9 h-9" />
          </div>
        )}

        {slot.notes && (
          <p className="mt-2 text-[11px] text-center text-slate-500 dark:text-slate-400 line-clamp-1 italic">
            {slot.notes}
          </p>
        )}
      </div>

      {/* Bottom controls or selection callout */}
      {showAdminControls && onStatusChange ? (
        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs">
          <span className="text-slate-500">Override:</span>
          <select
            value={slot.status}
            onChange={(e) => onStatusChange(slot.id, e.target.value as SlotStatus)}
            aria-label={`Override status for slot ${slot.code}`}
            className="text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 font-medium text-slate-800 dark:text-slate-200"
          >
            <option value="free">Free</option>
            <option value="booked">Booked</option>
            <option value="assigned">Assigned</option>
            <option value="occupied">Occupied</option>
            <option value="reserved">Reserved</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </div>
      ) : selectable ? (
        <div className="pt-2 text-center text-xs font-semibold">
          {selected ? (
            <span className="text-[#0F9D9A]">✓ Selected Slot</span>
          ) : isAvailable ? (
            <span className="text-slate-600 dark:text-slate-300">Click to Select</span>
          ) : (
            <span className="text-slate-400">Unavailable</span>
          )}
        </div>
      ) : null}
    </div>
  );
}
