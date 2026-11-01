-- Smart Parking System Database Schema
-- Migration 001: Initial Schema

-- Enable necessary extensions
create extension if not exists "uuid-ossp";
create extension if not exists "btree_gist";

-- 1. Profiles Table (extends Supabase auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null default '',
  phone text default '',
  role text not null default 'user' check (role in ('user', 'staff', 'admin')),
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- 2. Slots Table
create table if not exists public.slots (
  id text primary key, -- 'G1', 'G2', 'G3', 'F1', 'F2', 'F3'
  code text not null,
  floor integer not null check (floor in (0, 1)), -- 0: Ground, 1: First
  type text not null check (type in ('sensor', 'virtual')),
  status text not null default 'free' check (status in ('free', 'booked', 'assigned', 'occupied', 'reserved', 'maintenance')),
  assigned_booking_id uuid, -- reference added below
  notes text,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- 3. Bookings Table
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  slot_code text not null references public.slots(id) on delete restrict,
  driver_name text not null,
  phone text not null,
  vehicle_number text not null,
  car_model text,
  car_color text,
  start_time timestamptz not null,
  hours integer not null check (hours >= 1 and hours <= 24),
  amount numeric(10, 2) not null default 0.00,
  status text not null default 'booked' check (status in ('booked', 'active', 'completed', 'cancelled', 'expired', 'no_show')),
  qr_token text,
  walk_in boolean not null default false,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- Add foreign key constraint to slots.assigned_booking_id
alter table public.slots
  drop constraint if exists fk_slots_assigned_booking,
  add constraint fk_slots_assigned_booking foreign key (assigned_booking_id) references public.bookings(id) on delete set null;

-- 4. Telemetry Log Table
create table if not exists public.telemetry_log (
  id bigint generated always as identity primary key,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  slots jsonb not null,
  gate jsonb,
  device_ip text
);

-- 5. Settings Table
create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- Indexes for performance
create index if not exists idx_bookings_user_id on public.bookings(user_id);
create index if not exists idx_bookings_slot_code on public.bookings(slot_code);
create index if not exists idx_bookings_status on public.bookings(status);
create index if not exists idx_bookings_start_time on public.bookings(start_time);
create index if not exists idx_telemetry_created_at on public.telemetry_log(created_at desc);

-- Realtime publication
alter publication supabase_realtime add table public.slots;
alter publication supabase_realtime add table public.telemetry_log;
