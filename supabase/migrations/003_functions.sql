-- Smart Parking System Database Schema
-- Migration 003: Transactional Functions & Overlap Protection

-- 1. Atomic Transactional Booking Function
create or replace function public.book_slot_transactional(
  p_user_id uuid,
  p_slot_code text,
  p_driver_name text,
  p_phone text,
  p_vehicle_number text,
  p_car_model text,
  p_car_color text,
  p_start_time timestamptz,
  p_hours integer,
  p_amount numeric,
  p_qr_token text,
  p_walk_in boolean default false
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_slot_record record;
  v_booking_id uuid;
  v_end_time timestamptz;
  v_conflict_count integer;
begin
  -- Validate slot existence and lock it for concurrency safety
  select * into v_slot_record
  from public.slots
  where id = p_slot_code
  for update;

  if not found then
    raise exception 'SLOT_NOT_FOUND: Slot % does not exist.', p_slot_code;
  end if;

  if v_slot_record.status = 'maintenance' then
    raise exception 'SLOT_MAINTENANCE: Slot % is currently under maintenance.', p_slot_code;
  end if;

  if v_slot_record.status = 'reserved' and not p_walk_in then
    raise exception 'SLOT_RESERVED: Slot % is permanently reserved.', p_slot_code;
  end if;

  -- Calculate booking end time
  v_end_time := p_start_time + (p_hours || ' hours')::interval;

  -- Check for overlapping active or confirmed bookings on the same slot
  select count(*) into v_conflict_count
  from public.bookings
  where slot_code = p_slot_code
    and status in ('booked', 'active')
    and tstzrange(start_time, start_time + (hours || ' hours')::interval) && tstzrange(p_start_time, v_end_time);

  if v_conflict_count > 0 then
    raise exception 'SLOT_ALREADY_BOOKED: Slot % is already booked for the selected time slot.', p_slot_code;
  end if;

  -- Insert booking
  insert into public.bookings (
    user_id,
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
    qr_token,
    walk_in
  ) values (
    p_user_id,
    p_slot_code,
    p_driver_name,
    p_phone,
    upper(trim(p_vehicle_number)),
    p_car_model,
    p_car_color,
    p_start_time,
    p_hours,
    p_amount,
    'booked',
    p_qr_token,
    p_walk_in
  )
  returning id into v_booking_id;

  -- If it's a walk-in or starts right now, update slot status
  if p_walk_in or (p_start_time <= now() and v_end_time >= now() and v_slot_record.status = 'free') then
    update public.slots
    set status = 'booked',
        assigned_booking_id = v_booking_id,
        updated_at = now()
    where id = p_slot_code;
  end if;

  return v_booking_id;
end;
$$;

-- 2. Cleanup Expired Bookings (No-show after 30 minutes)
create or replace function public.cleanup_expired_bookings()
returns table(expired_count integer)
language plpgsql
security definer
as $$
declare
  v_count integer := 0;
begin
  -- Find bookings that are 'booked' but the car never showed up 30 minutes past start_time
  with expired as (
    update public.bookings
    set status = 'no_show',
        updated_at = now()
    where status = 'booked'
      and start_time + interval '30 minutes' < now()
    returning id, slot_code
  )
  -- Reset any slots tied to these no-shows back to 'free' if they are not occupied
  update public.slots s
  set status = 'free',
      assigned_booking_id = null,
      updated_at = now()
  from expired e
  where s.id = e.slot_code
    and s.assigned_booking_id = e.id
    and s.status in ('booked', 'assigned');

  get diagnostics v_count = row_count;
  return query select v_count;
end;
$$;

-- 3. Automatic Profile Creation on Supabase Auth Signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'Driver'), 'user')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
