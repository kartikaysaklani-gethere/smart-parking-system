/**
 * Pricing Calculations for Smart Parking System
 * Default rate: ₹40 per hour (stored in settings table)
 */

export const DEFAULT_HOURLY_RATE = 40;

/**
 * Calculates pre-booked amount: hours * ratePerHour
 */
export function calculatePreBookedAmount(hours: number, ratePerHour: number = DEFAULT_HOURLY_RATE): number {
  if (hours <= 0) return ratePerHour;
  return Math.round(hours * ratePerHour);
}

export interface CheckoutFeeCalculation {
  durationMinutes: number;
  billedHours: number;
  ratePerHour: number;
  amount: number;
  originalAmount?: number;
  overstayHours?: number;
  overstayFee?: number;
}

/**
 * Calculates fee on checkout for walk-in or overstay.
 * Walk-in: Billed by actual time rounded up to the next full hour (minimum 1 hour).
 * Pre-booked with overstay: Checks if actual exit exceeds pre-booked hours.
 */
export function calculateCheckoutFee(
  checkIn: string | Date,
  checkOut: string | Date = new Date(),
  ratePerHour: number = DEFAULT_HOURLY_RATE,
  preBookedHours?: number,
  preBookedAmount?: number
): CheckoutFeeCalculation {
  const inDate = typeof checkIn === 'string' ? new Date(checkIn) : checkIn;
  const outDate = typeof checkOut === 'string' ? new Date(checkOut) : checkOut;

  const durationMs = Math.max(0, outDate.getTime() - inDate.getTime());
  const durationMinutes = Math.ceil(durationMs / (1000 * 60));

  // Minimum 1 hour, then rounded up to the next hour
  // e.g. 15 mins -> 1 hr, 61 mins -> 2 hrs, 120 mins -> 2 hrs
  const billedHours = Math.max(1, Math.ceil(durationMinutes / 60));

  // If this was a pre-booked vehicle
  if (preBookedHours && preBookedAmount !== undefined) {
    if (billedHours > preBookedHours) {
      const overstayHours = billedHours - preBookedHours;
      const overstayFee = overstayHours * ratePerHour;
      return {
        durationMinutes,
        billedHours,
        ratePerHour,
        amount: preBookedAmount + overstayFee,
        originalAmount: preBookedAmount,
        overstayHours,
        overstayFee,
      };
    } else {
      return {
        durationMinutes,
        billedHours: preBookedHours,
        ratePerHour,
        amount: preBookedAmount,
        originalAmount: preBookedAmount,
        overstayHours: 0,
        overstayFee: 0,
      };
    }
  }

  // Walk-in booking:
  const amount = billedHours * ratePerHour;
  return {
    durationMinutes,
    billedHours,
    ratePerHour,
    amount,
  };
}
