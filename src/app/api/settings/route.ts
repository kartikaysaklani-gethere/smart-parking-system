import { NextRequest, NextResponse } from 'next/server';
import { getSettings, updateSettings, isHardwareOnline, getTelemetryLogs } from '@/lib/store';

export async function GET() {
  try {
    const settings = await getSettings();
    const lastSeenTime = settings.device_last_seen ? new Date(settings.device_last_seen).getTime() : 0;
    // Hardware is online if memory ping is fresh OR if persistent last_seen is within 25 seconds
    let online = isHardwareOnline() || (Date.now() - lastSeenTime <= 25000);
    let activeLastSeen = settings.device_last_seen;

    // Local-to-Cloud Bridge: If ESP32 is pinging Vercel instead of localhost, sync hardware status!
    if (!online) {
      try {
        const cloudRes = await fetch('https://smart-parking-system-ten-pearl.vercel.app/api/settings', {
          cache: 'no-store',
          signal: AbortSignal.timeout(2500),
        });
        if (cloudRes.ok) {
          const cloudData = await cloudRes.json();
          const cloudLastSeen = cloudData.settings?.device_last_seen;
          if (cloudLastSeen) {
            const cloudDiff = Date.now() - new Date(cloudLastSeen).getTime();
            if (cloudDiff <= 35000) {
              online = true;
              activeLastSeen = cloudLastSeen;
              settings.device_last_seen = cloudLastSeen;
            }
          }
        }
      } catch {
        // Fallback gracefully
      }
    }

    const logs = getTelemetryLogs();

    return NextResponse.json({
      settings,
      hardware: {
        online,
        lastSeen: activeLastSeen,
        recentTelemetryCount: logs.length,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error reading settings';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const updated = await updateSettings(body);
    return NextResponse.json({ success: true, settings: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error updating settings';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
