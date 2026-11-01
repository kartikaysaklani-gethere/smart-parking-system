-- Smart Parking System Database Schema
-- Migration 004: Seed Data

-- 1. Insert Initial 6 Slots
insert into public.slots (id, code, floor, type, status, notes)
values
  ('G1', 'G1', 0, 'sensor', 'free', 'Ground Floor - ESP32 Ultrasonic Sensor'),
  ('G2', 'G2', 0, 'sensor', 'free', 'Ground Floor - ESP32 Ultrasonic Sensor'),
  ('G3', 'G3', 0, 'virtual', 'occupied', 'Ground Floor - Virtual Dummy Car (Pasted Model)'),
  ('F1', 'F1', 1, 'sensor', 'free', '1st Floor - ESP32 Ultrasonic Sensor'),
  ('F2', 'F2', 1, 'virtual', 'free', '1st Floor - Virtual Slot for Online Booking'),
  ('F3', 'F3', 1, 'virtual', 'reserved', '1st Floor - Virtual Slot Permanently Reserved')
on conflict (id) do update set
  floor = excluded.floor,
  type = excluded.type,
  status = excluded.status,
  notes = excluded.notes;

-- 2. Insert Settings
insert into public.settings (key, value, updated_at)
values
  ('price_per_hour', '40'::jsonb, now()),
  ('device_last_seen', 'null'::jsonb, now()),
  ('latest_assignment', 'null'::jsonb, now()),
  ('garage_name', '"Campus Hub Smart Parking"'::jsonb, now())
on conflict (key) do update set
  value = excluded.value,
  updated_at = now();

-- 3. Sample Historic Bookings (For Admin Analytics & Busy Hours Charts)
insert into public.bookings (
  id,
  slot_code,
  driver_name,
  phone,
  vehicle_number,
  car_model,
  car_color,
  start_time,
  hours,
  amount,
  status,
  walk_in,
  checked_in_at,
  checked_out_at,
  created_at
)
values
  (
    '11111111-1111-1111-1111-111111111101',
    'G1',
    'Aarav Sharma',
    '+91 98765 43210',
    'DL 01 AB 1234',
    'Honda City',
    'Silver',
    now() - interval '2 days 4 hours',
    2,
    80.00,
    'completed',
    false,
    now() - interval '2 days 4 hours',
    now() - interval '2 days 2 hours',
    now() - interval '2 days 5 hours'
  ),
  (
    '11111111-1111-1111-1111-111111111102',
    'G2',
    'Rohan Verma',
    '+91 98123 45678',
    'MH 02 CD 5678',
    'Hyundai Creta',
    'White',
    now() - interval '1 day 6 hours',
    3,
    120.00,
    'completed',
    false,
    now() - interval '1 day 6 hours',
    now() - interval '1 day 3 hours',
    now() - interval '1 day 7 hours'
  ),
  (
    '11111111-1111-1111-1111-111111111103',
    'F1',
    'Pooja Nair',
    '+91 97234 56789',
    'KA 05 EF 9012',
    'Tata Nexon EV',
    'Blue',
    now() - interval '18 hours',
    2,
    80.00,
    'completed',
    true,
    now() - interval '18 hours',
    now() - interval '16 hours',
    now() - interval '18 hours'
  ),
  (
    '11111111-1111-1111-1111-111111111104',
    'F2',
    'Vikram Mehta',
    '+91 99345 67890',
    'HR 26 GH 3456',
    'Maruti Brezza',
    'Red',
    now() - interval '4 hours',
    4,
    160.00,
    'completed',
    false,
    now() - interval '4 hours',
    now() - interval '1 hour',
    now() - interval '5 hours'
  )
on conflict (id) do nothing;
