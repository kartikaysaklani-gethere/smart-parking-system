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

  // High-contrast, sharp color scheme
  const statusConfig: Record<
    SlotStatus,
    {
      label: string;
      bg: string;
      badgeBg: string;
      border: string;
      iconBg: string;
      iconColor: string;
      indicatorColor: string;
      icon: React.ComponentType<{ className?: string }>;
    }
  > = {
    free: {
      label: 'AVAILABLE',
      bg: 'bg-white dark:bg-[#0c182a]',
      badgeBg: 'bg-[#059669] text-white shadow-sm font-black',
      border: 'border-2 border-[#059669]/60 hover:border-[#059669] dark:border-[#059669]/50 shadow-md',
      iconBg: 'bg-[#059669]/15 border-2 border-[#059669]/30 text-[#059669]',
      iconColor: 'text-[#059669]',
      indicatorColor: 'bg-[#059669]',
      icon: CheckCircle2,
    },
    booked: {
      label: 'RESERVED ONLINE',
      bg: 'bg-white dark:bg-[#0c182a]',
      badgeBg: 'bg-[#2563eb] text-white shadow-sm font-black',
      border: 'border-2 border-[#2563eb]/60 dark:border-[#2563eb]/50 shadow-md',
      iconBg: 'bg-[#2563eb]/15 border-2 border-[#2563eb]/30 text-[#2563eb]',
      iconColor: 'text-[#2563eb]',
      indicatorColor: 'bg-[#2563eb]',
      icon: Clock,
    },
    assigned: {
      label: 'CAR EN ROUTE',
      bg: 'bg-white dark:bg-[#0c182a]',
      badgeBg: 'bg-[#d97706] text-white shadow-sm font-black animate-pulse',
      border: 'border-2 border-[#d97706] dark:border-[#d97706] shadow-lg ring-2 ring-[#d97706]/30',
      iconBg: 'bg-[#d97706]/15 border-2 border-[#d97706]/40 text-[#d97706]',
      iconColor: 'text-[#d97706]',
      indicatorColor: 'bg-[#d97706]',
      icon: AlertTriangle,
    },
    occupied: {
      label: 'OCCUPIED',
      bg: 'bg-white dark:bg-[#0c182a]',
      badgeBg: 'bg-[#dc2626] text-white shadow-sm font-black',
      border: 'border-2 border-[#dc2626]/70 dark:border-[#dc2626]/60 shadow-md',
      iconBg: 'bg-[#dc2626]/15 border-2 border-[#dc2626]/30 text-[#dc2626]',
      iconColor: 'text-[#dc2626]',
      indicatorColor: 'bg-[#dc2626]',
      icon: Car,
    },
    reserved: {
      label: 'VIP RESERVED',
      bg: 'bg-white dark:bg-[#0c182a]',
      badgeBg: 'bg-[#7c3aed] text-white shadow-sm font-black',
      border: 'border-2 border-[#7c3aed]/60 dark:border-[#7c3aed]/50 shadow-md',
      iconBg: 'bg-[#7c3aed]/15 border-2 border-[#7c3aed]/30 text-[#7c3aed]',
      iconColor: 'text-[#7c3aed]',
      indicatorColor: 'bg-[#7c3aed]',
      icon: Shield,
    },
    maintenance: {
      label: 'MAINTENANCE',
      bg: 'bg-slate-50 dark:bg-slate-900',
      badgeBg: 'bg-slate-700 text-white font-black',
      border: 'border-2 border-slate-400 dark:border-slate-700 shadow-sm opacity-75',
      iconBg: 'bg-slate-200 dark:bg-slate-800 text-slate-600',
      iconColor: 'text-slate-600',
      indicatorColor: 'bg-slate-600',
      icon: Wrench,
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
        'relative rounded-2xl p-5 transition-all duration-200 flex flex-col justify-between select-none overflow-hidden',
        currentConfig.bg,
        currentConfig.border,
        selectable && isAvailable && 'cursor-pointer hover:scale-102 hover:shadow-xl',
        selectable && !isAvailable && 'cursor-not-allowed opacity-60',
        selected && 'ring-4 ring-[#0F9D9A] shadow-2xl shadow-[#0F9D9A]/30 -translate-y-1'
      )}
    >
      {/* Top accent line for instant high contrast */}
      <div className={cn('absolute top-0 left-0 right-0 h-1.5', currentConfig.indicatorColor)} />

      {/* Top row: Slot Code + Floor + Status Badge */}
      <div className="flex items-start justify-between gap-2 pt-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-black tracking-tight text-[#0B2545] dark:text-white">
              {slot.code}
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-md font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700">
              {slot.floor === 0 ? 'Ground Floor' : '1st Floor'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-600 dark:text-slate-300 font-semibold">
            {slot.type === 'sensor' ? (
              <>
                <Cpu className="w-3.5 h-3.5 text-[#0F9D9A]" />
                <span>IoT Sensor</span>
              </>
            ) : (
              <>
                <Cloud className="w-3.5 h-3.5 text-[#2563eb]" />
                <span>Virtual Slot</span>
              </>
            )}
          </div>
        </div>

        {/* High-Contrast Solid Badge */}
        <div
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] uppercase tracking-wider',
            currentConfig.badgeBg
          )}
        >
          <StatusIcon className="w-3.5 h-3.5" />
          <span>{currentConfig.label}</span>
        </div>
      </div>

      {/* Middle visual: High-Contrast Status Display */}
      <div className="my-5 py-2 flex flex-col items-center justify-center">
        {slot.status === 'occupied' || slot.id === 'G3' ? (
          <div className={cn('w-20 h-20 rounded-2xl flex items-center justify-center', currentConfig.iconBg)}>
            <Car className="w-12 h-12" />
          </div>
        ) : slot.status === 'assigned' ? (
          <div className={cn('w-20 h-20 rounded-2xl flex items-center justify-center relative', currentConfig.iconBg)}>
            <Car className="w-12 h-12 animate-bounce" />
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500"></span>
            </span>
          </div>
        ) : (
          <div className={cn('w-20 h-20 rounded-2xl flex items-center justify-center', currentConfig.iconBg)}>
            <CheckCircle2 className="w-12 h-12" />
          </div>
        )}

        {slot.notes && (
          <p className="mt-3 text-xs text-center font-medium text-slate-600 dark:text-slate-400 line-clamp-1">
            {slot.notes}
          </p>
        )}
      </div>

      {/* Bottom controls or selection callout */}
      {showAdminControls && onStatusChange ? (
        <div className="pt-3 border-t-2 border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
          <span className="font-bold text-slate-700 dark:text-slate-300">Override:</span>
          <select
            value={slot.status}
            onChange={(e) => onStatusChange(slot.id, e.target.value as SlotStatus)}
            aria-label={`Override status for slot ${slot.code}`}
            className="text-xs font-bold bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1 text-slate-900 dark:text-white"
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
        <div className="pt-2 text-center text-xs font-bold">
          {selected ? (
            <span className="text-[#059669] bg-[#059669]/10 px-3 py-1 rounded-full border border-[#059669]/30">
              ✓ Selected Slot
            </span>
          ) : isAvailable ? (
            <span className="text-slate-700 dark:text-slate-200">Click to Select</span>
          ) : (
            <span className="text-slate-400">Unavailable</span>
          )}
        </div>
      ) : null}
    </div>
  );
}
