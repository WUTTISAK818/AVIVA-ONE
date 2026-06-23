/**
 * Hikvision Cronjob - Auto-sync attendance data every 5 minutes
 *
 * ใช้ Vercel Cron Functions หรือ external cron service
 * ดู: https://vercel.com/docs/cron-jobs
 */

import { getHikvisionService } from './hikvision-service';

/**
 * Handler สำหรับ Vercel Cron
 * ตั้งค่า: vercel.json crons section
 */
export async function syncHikvisionAttendance() {
  try {
    // คำนวณช่วงเวลา (ย้อนหลัง 10 นาที)
    const endTime = new Date();
    const startTime = new Date();
    startTime.setMinutes(startTime.getMinutes() - 10);

    console.log(`[Hikvision Sync] Start: ${startTime.toISOString()}, End: ${endTime.toISOString()}`);

    const hikvisionService = getHikvisionService({
      deviceIp: process.env.HIKVISION_IP || '192.168.1.100',
      username: process.env.HIKVISION_USERNAME || 'admin',
      password: process.env.HIKVISION_PASSWORD || '',
      port: parseInt(process.env.HIKVISION_PORT || '8080'),
    });

    const result = await hikvisionService.syncAttendanceData(
      startTime.toISOString(),
      endTime.toISOString()
    );

    if (result.ok) {
      const syncData = result.data || { total: 0, success: 0, failed: 0 };
      console.log(`[Hikvision Sync] Success:`, syncData);
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: `Synced ${syncData.total} events`,
          data: syncData,
        }),
      };
    } else {
      console.error(`[Hikvision Sync] Error:`, result.error);
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: result.error,
        }),
      };
    }
  } catch (err) {
    console.error('[Hikvision Sync] Exception:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }),
    };
  }
}

/**
 * สำหรับ Node-cron (ถ้าใช้ background job)
 * ติดตั้ง: npm install node-cron
 *
 * import cron from 'node-cron';
 *
 * export function startHikvisionCronjob() {
 *   // ทุก 5 นาที
 *   cron.schedule('* /5 * * * *', async () => {
 *     await syncHikvisionAttendance();
 *   });
 * }
 */
