'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ParkingSlot, SlotId } from '@/lib/types';
import { SlotCard } from '@/components/SlotCard';
import { formatINR } from '@/lib/utils';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import {
  Calendar,
  Clock,
  Car,
  User,
  Phone,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Info,
} from 'lucide-react';

export default function BookSlotPage() {
  const router = useRouter();
  const [slots, setSlots] = useState<ParkingSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);

  // Form states
  const [startTime, setStartTime] = useState('');
  const [hours, setHours] = useState<number>(2);
  const [selectedSlot, setSelectedSlot] = useState<SlotId | null>(null);
  const [driverName, setDriverName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [carModel, setCarModel] = useState('');
  const [carColor, setCarColor] = useState('');

  const [hourlyRate, setHourlyRate] = useState<number>(40);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch slots and current hourly rate
  useEffect(() => {
    setStartTime(new Date().toISOString().slice(0, 16));
    async function loadData() {
      try {
        const [slotsRes, settingsRes] = await Promise.all([
          fetch('/api/slots'),
          fetch('/api/settings'),
        ]);

        if (slotsRes.ok) {
          const data = await slotsRes.json();
          setSlots(data.slots || []);

          // Auto-select first available bookable slot
          const firstFree = (data.slots as ParkingSlot[]).find(
            (s) => s.status === 'free' && s.id !== 'G3' && s.id !== 'F3'
          );
          if (firstFree) {
            setSelectedSlot(firstFree.id);
          }
        }

        if (settingsRes.ok) {
          const data = await settingsRes.json();
          setHourlyRate(data.settings?.price_per_hour || 40);
        }
      } catch {
        // Fallback
      } finally {
        setLoadingSlots(false);
      }
    }

    loadData();
  }, []);

  const totalAmount = hours * hourlyRate;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedSlot) {
      toast.error('Please select an available parking slot.');
      return;
    }

    if (!driverName.trim()) {
      toast.error('Please enter the driver full name.');
      return;
    }

    if (!phone.trim()) {
      toast.error('Please enter driver phone number.');
      return;
    }

    if (!vehicleNumber.trim()) {
      toast.error('Please enter vehicle license plate number.');
      return;
    }

    setSubmitting(true);

    try {
      // Calculate start time in ISO
      const isoStartTime = new Date(startTime).toISOString();

      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slot_code: selectedSlot,
          driver_name: driverName.trim(),
          phone: phone.trim(),
          vehicle_number: vehicleNumber.trim().toUpperCase(),
          car_model: carModel.trim() || undefined,
          car_color: carColor.trim() || undefined,
          start_time: isoStartTime,
          hours,
          amount: totalAmount,
        }),
      });

      const resData = await response.json();

      if (!response.ok) {
        throw new Error(resData.error || 'Failed to reserve slot');
      }

      // Success interaction
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });

      toast.success(`Slot ${selectedSlot} successfully booked!`);
      router.push(`/bookings/${resData.booking.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Reservation failed.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-black text-[#0B2545] dark:text-white tracking-tight">
          Reserve a Parking Slot
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Select your duration, choose an available slot, and receive an instant cryptographically signed QR ticket.
        </p>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-500" />
          <div>
            <p className="font-bold">Booking Conflict Detected</p>
            <p className="text-xs mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Step 1: Time & Duration */}
        <div className="bg-white dark:bg-[#0c182a] p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex items-center gap-2 text-[#0B2545] dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
            <Clock className="w-5 h-5 text-[#0F9D9A]" />
            <h2 className="font-bold text-base">1. Schedule & Duration</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="booking-start-time" className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-2">
                Start Date & Time (IST)
              </label>
              <div className="relative">
                <input
                  id="booking-start-time"
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0F9D9A]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-2">
                Duration (Hours: 1 to 12)
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 6, 8, 12].map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setHours(h)}
                    className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${
                      hours === h
                        ? 'bg-[#0B2545] dark:bg-[#0F9D9A] text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {h}h
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Step 2: Slot Selection on Map */}
        <div className="bg-white dark:bg-[#0c182a] p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-[#0B2545] dark:text-white">
              <CheckCircle2 className="w-5 h-5 text-[#0F9D9A]" />
              <h2 className="font-bold text-base">2. Select Your Slot</h2>
            </div>
            {selectedSlot && (
              <span className="text-xs font-bold text-[#0F9D9A] bg-[#0F9D9A]/10 px-3 py-1 rounded-full border border-[#0F9D9A]/20">
                Selected: Slot {selectedSlot}
              </span>
            )}
          </div>

          <p className="text-xs text-slate-500">
            Click on any available green slot below. Virtual slots (G3 dummy occupied, F3 reserved) are disabled.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {slots.map((slot) => {
              const isBlocked = slot.status !== 'free' || slot.id === 'G3' || slot.id === 'F3';
              return (
                <SlotCard
                  key={slot.id}
                  slot={slot}
                  selectable={!isBlocked}
                  selected={selectedSlot === slot.id}
                  onSelect={(s) => setSelectedSlot(s.id)}
                />
              );
            })}
          </div>
        </div>

        {/* Step 3: Vehicle & Driver Information */}
        <div className="bg-white dark:bg-[#0c182a] p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-[#0B2545] dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
            <Car className="w-5 h-5 text-[#0F9D9A]" />
            <h2 className="font-bold text-base">3. Driver & Vehicle Credentials</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="driver-full-name" className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-1.5">
                Driver Full Name *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  id="driver-full-name"
                  type="text"
                  placeholder="e.g. Aarav Sharma"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0F9D9A]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="driver-phone-number" className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-1.5">
                Phone Number *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  id="driver-phone-number"
                  type="tel"
                  placeholder="e.g. +91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0F9D9A]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="vehicle-registration-number" className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-1.5">
                Vehicle Registration Number *
              </label>
              <input
                id="vehicle-registration-number"
                type="text"
                placeholder="e.g. DL 01 AB 1234"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white text-sm font-semibold tracking-wider uppercase focus:outline-none focus:ring-2 focus:ring-[#0F9D9A]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="car-model-name" className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-1.5">
                  Car Model
                </label>
                <input
                  id="car-model-name"
                  type="text"
                  placeholder="e.g. Honda City"
                  value={carModel}
                  onChange={(e) => setCarModel(e.target.value)}
                  className="w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0F9D9A]"
                />
              </div>
              <div>
                <label htmlFor="car-exterior-color" className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-1.5">
                  Color
                </label>
                <input
                  id="car-exterior-color"
                  type="text"
                  placeholder="e.g. White"
                  value={carColor}
                  onChange={(e) => setCarColor(e.target.value)}
                  className="w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0F9D9A]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Step 4: Pricing Summary & Confirm Button */}
        <div className="bg-white dark:bg-[#0c182a] p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-slate-500">Total Price</span>
              <div className="text-3xl font-black text-[#0B2545] dark:text-white mt-0.5">
                {formatINR(totalAmount)}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {hours} hour{hours > 1 ? 's' : ''} × {formatINR(hourlyRate)}/hr
              </p>
            </div>

            <div className="text-right">
              <span className="text-xs font-semibold text-slate-500 block">Slot Assigned:</span>
              <span className="text-xl font-black text-[#0F9D9A]">
                {selectedSlot ? `Slot ${selectedSlot}` : 'None chosen'}
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || !selectedSlot}
            className="w-full py-4 rounded-2xl bg-[#0F9D9A] hover:bg-[#0c827f] disabled:opacity-50 text-white font-bold text-base shadow-lg shadow-[#0F9D9A]/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {submitting ? (
              <span>Verifying & Reserving Slot...</span>
            ) : (
              <>
                <span>Confirm Reservation & Generate QR Ticket</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
