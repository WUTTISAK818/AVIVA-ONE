/**
 * TP-Link Tapo Camera Cronjob - Auto-sync CCTV data every 5 minutes
 *
 * ใช้ Vercel Cron Functions
 * ดู: https://vercel.com/docs/cron-jobs
 */

import { getTapoCameraService } from './tapo-camera-service';

export async function syncTapoCameraEvents() {
  try {
    // คำนวณช่วงเวลา (ย้อนหลัง 10 นาที)
    const endTime = new Date();
    const startTime = new Date();
    startTime.setMinutes(startTime.getMinutes() - 10);

    console.log(
      `[Tapo Sync] Start: ${startTime.toISOString()}, End: ${endTime.toISOString()}`
    );

    const tapoService = getTapoCameraService({
      cameraIp: process.env.TAPO_CAMERA_IP || '192.168.1.101',
      username: process.env.TAPO_USERNAME || 'admin@example.com',
      password: process.env.TAPO_PASSWORD || '',
    });

    // 1. Authenticate
    const authResult = await tapoService.authenticate();
    if (!authResult.ok) {
      console.error('[Tapo Sync] Auth failed:', authResult.error);
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          error: 'Authentication failed',
        }),
      };
    }

    // 2. Get facial recognition events
    const facialResult = await tapoService.getFacialRecognitionEvents(
      startTime.toISOString(),
      endTime.toISOString()
    );

    // 3. Get person detection events
    const personResult = await tapoService.getPersonDetectionEvents(
      startTime.toISOString(),
      endTime.toISOString()
    );

    // 4. Detect unknown visitors
    const visitorResult = await tapoService.detectUnknownVisitors(
      startTime.toISOString(),
      endTime.toISOString()
    );

    const totalEvents = (facialResult.data?.length || 0) + (personResult.data?.length || 0);
    const unknownCount = visitorResult.data?.length || 0;

    console.log(
      `[Tapo Sync] Success: ${totalEvents} events, ${unknownCount} unknown visitors`
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: `Synced ${totalEvents} events`,
        data: {
          facialRecognition: facialResult.data?.length || 0,
          personDetection: personResult.data?.length || 0,
          unknownVisitors: unknownCount,
        },
      }),
    };
  } catch (err) {
    console.error('[Tapo Sync] Exception:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }),
    };
  }
}
