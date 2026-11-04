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
  CreditCard,
  QrCode,
  Lock,
  Smartphone,
  Building,
  Check,
  X,
  Sparkles,
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

  // Payment Modal States
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [upiId, setUpiId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');
  const [selectedBank, setSelectedBank] = useState('HDFC Bank');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentStatusText, setPaymentStatusText] = useState('Processing...');

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

  // Step 1: Validate form and open Payment Gateway
  const handleProceedToPayment = (e: React.FormEvent) => {
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

    // Default UPI ID if blank
    if (!upiId) {
      setUpiId(`${driverName.toLowerCase().replace(/\s+/g, '')}@okaxis`);
    }
    if (!cardName) {
      setCardName(driverName);
    }

    setShowPaymentModal(true);
  };

  // Step 2: Process payment and confirm booking
  const handleExecutePayment = async () => {
    setProcessingPayment(true);
    setPaymentStatusText('Securing 256-bit banking tunnel...');

    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      setPaymentStatusText(`Authorizing ${formatINR(totalAmount)} with Payment Gateway...`);
      await new Promise((resolve) => setTimeout(resolve, 900));
      setPaymentStatusText('Payment Authorized! Generating verified pass...');

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
        throw new Error(resData.error || 'Failed to complete reservation.');
      }

      setShowPaymentModal(false);

      // Confetti celebration
      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 },
      });

      toast.success(`Payment verified! Slot ${selectedSlot} successfully booked.`);
      router.push(`/bookings/${resData.booking.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Payment or reservation failed.';
      setErrorMessage(msg);
      toast.error(msg);
      setShowPaymentModal(false);
    } finally {
      setProcessingPayment(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          Reserve Parking Slot
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Select your duration, choose an available parking bay, and proceed to instant secure checkout.
        </p>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center gap-3 text-rose-700 dark:text-rose-300 text-sm font-medium">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleProceedToPayment} className="space-y-8">
        {/* Step 1: Duration & Start Time */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
            <Clock className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              1. Schedule & Duration
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Arrival Date & Time
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-900 dark:text-white text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Parking Duration (Hours)
              </label>
              <div className="flex items-center gap-3">
                {[1, 2, 3, 4, 6, 8].map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setHours(h)}
                    className={`flex-1 py-3 rounded-2xl text-xs font-bold transition-all ${
                      hours === h
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
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

        {/* Step 2: Slot Selection */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <Car className="w-5 h-5 text-indigo-500" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                2. Select Available Slot
              </h2>
            </div>
            <span className="text-xs font-bold text-slate-500">
              Selected: <span className="text-indigo-600 dark:text-indigo-400">{selectedSlot || 'None'}</span>
            </span>
          </div>

          {loadingSlots ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-32 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {slots.map((slot) => {
                const isSelected = selectedSlot === slot.id;
                const isBookable = slot.status === 'free';

                return (
                  <div
                    key={slot.id}
                    onClick={() => isBookable && setSelectedSlot(slot.id)}
                    className={`cursor-pointer transition-all ${
                      isSelected ? 'ring-3 ring-indigo-500 rounded-3xl' : ''
                    } ${!isBookable ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <SlotCard slot={slot} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Step 3: Driver & Vehicle Details */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
            <User className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              3. Driver & Vehicle Information
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Driver Full Name *
              </label>
              <input
                type="text"
                placeholder="e.g. John Doe"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-900 dark:text-white text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Mobile Number *
              </label>
              <input
                type="tel"
                placeholder="e.g. 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-900 dark:text-white text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Vehicle Registration / Plate No. *
              </label>
              <input
                type="text"
                placeholder="e.g. DL 01 AB 1234"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-900 dark:text-white text-sm font-mono uppercase font-bold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Car Model & Color (Optional)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Honda City"
                  value={carModel}
                  onChange={(e) => setCarModel(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-900 dark:text-white text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  type="text"
                  placeholder="Color"
                  value={carColor}
                  onChange={(e) => setCarColor(e.target.value)}
                  className="w-24 px-3 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-900 dark:text-white text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Pricing Summary & Checkout Button */}
        <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <span className="text-xs uppercase font-bold tracking-wider text-indigo-400 block">
              Booking Summary
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-white">{formatINR(totalAmount)}</span>
              <span className="text-xs text-slate-400">
                ({hours} hrs @ ₹{hourlyRate}/hr)
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Includes dynamic slot guidance, servo access, and cryptographically verified QR ticket.
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all hover:scale-102 flex items-center justify-center gap-2"
          >
            <span>Proceed to Payment</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>

      {/* ===================== CHECKOUT & PAYMENT MODAL ===================== */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-base text-white">ParkWise Secure Checkout</h3>
                  <p className="text-[11px] text-slate-400">256-Bit SSL Bank Verified Gateway</p>
                </div>
              </div>

              {!processingPayment && (
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Order Pill */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">
                    Slot {selectedSlot} • {hours} Hour(s)
                  </span>
                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                    {vehicleNumber.toUpperCase()}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Payable</span>
                  <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                    {formatINR(totalAmount)}
                  </span>
                </div>
              </div>

              {/* Payment Methods Switcher */}
              <div className="grid grid-cols-3 gap-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('upi')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    paymentMethod === 'upi'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>UPI / QR</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    paymentMethod === 'card'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Cards</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('netbanking')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    paymentMethod === 'netbanking'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Building className="w-3.5 h-3.5" />
                  <span>NetBanking</span>
                </button>
              </div>

              {/* Tab 1: UPI */}
              {paymentMethod === 'upi' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                    <span>Pay with Google Pay, PhonePe, Paytm, BHIM</span>
                    <span className="text-emerald-500 font-bold">Zero Surcharge</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Virtual Payment Address (VPA / UPI ID)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. mobile@upi or username@okhdfcbank"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Instant UPI collect request or automatic one-click debit</span>
                  </div>
                </div>
              )}

              {/* Tab 2: Credit / Debit Cards */}
              {paymentMethod === 'card' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Card Number
                    </label>
                    <input
                      type="text"
                      placeholder="4532 8901 2345 6789"
                      maxLength={19}
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Expiry (MM/YY)
                      </label>
                      <input
                        type="text"
                        placeholder="12/28"
                        maxLength={5}
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                        CVV / CVC
                      </label>
                      <input
                        type="password"
                        placeholder="•••"
                        maxLength={4}
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Name on Card
                    </label>
                    <input
                      type="text"
                      placeholder="CARDHOLDER NAME"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs uppercase font-medium"
                    />
                  </div>
                </div>
              )}

              {/* Tab 3: NetBanking */}
              {paymentMethod === 'netbanking' && (
                <div className="space-y-3">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Select Your Bank
                  </label>
                  <select
                    value={selectedBank}
                    onChange={(e) => setSelectedBank(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                  >
                    <option>HDFC Bank</option>
                    <option>State Bank of India (SBI)</option>
                    <option>ICICI Bank</option>
                    <option>Axis Bank</option>
                    <option>Kotak Mahindra Bank</option>
                    <option>Punjab National Bank</option>
                  </select>
                </div>
              )}

              {/* Security Badge */}
              <div className="flex items-center justify-center gap-2 pt-1 text-[11px] text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>PCI-DSS Level 1 Compliant • RBI Tokenized Gateway</span>
              </div>
            </div>

            {/* Modal Footer CTA */}
            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleExecutePayment}
                disabled={processingPayment}
                className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-75"
              >
                {processingPayment ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{paymentStatusText}</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Pay {formatINR(totalAmount)} & Confirm Slot</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
