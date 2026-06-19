#!/usr/bin/env node
/**
 * Script อัปเดตสถานะการก่อสร้าง (Construction Progress)
 *
 * วิธีใช้:
 *   node scripts/update-construction-progress.mjs
 *
 * ข้อมูล Ground Truth จาก Pom (19 มิ.ย. 2569):
 *   - เสร็จ 100%: A01-A06, A08, V13-V16, V30, V31 (13 หลัง)
 *   - กำลังทำ 85%: A07 (1 หลัง)
 *   - ยังไม่เริ่ม 0%: ที่เหลือ (17 หลัง)
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ ต้องกำหนด NEXT_PUBLIC_SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function updateProgressData() {
  console.log('🔄 กำลังอัปเดตข้อมูลการก่อสร้าง...\n')

  const completed = ['A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A08', 'V13', 'V14', 'V15', 'V16', 'V30', 'V31']
  const inProgress = ['A07']

  try {
    // 1. อัปเดต 13 หลัง เสร็จ 100%
    console.log('1️⃣  อัปเดต 13 หลัง → เสร็จ 100%')
    const { error: err1 } = await supabase
      .from('houses')
      .update({ progress: 100, status: 'complete' })
      .in('house_number', completed)

    if (err1) throw err1
    console.log(`   ✅ ${completed.join(', ')}`)

    // 2. อัปเดต 1 หลัง กำลังทำ 85%
    console.log('\n2️⃣  อัปเดต 1 หลัง → กำลังทำ 85%')
    const { error: err2 } = await supabase
      .from('houses')
      .update({ progress: 85, status: 'under_construction' })
      .in('house_number', inProgress)

    if (err2) throw err2
    console.log(`   ✅ ${inProgress.join(', ')}`)

    // 3. ดึงข้อมูลทั้งหมดเพื่อตรวจสอบ
    console.log('\n3️⃣  ตรวจสอบข้อมูล...')
    const { data, error: err3 } = await supabase
      .from('houses')
      .select('house_number, progress, status')
      .order('house_number')

    if (err3) throw err3

    // 4. สรุปผล
    console.log('\n📊 ผลการอัปเดต:')
    console.log('─'.repeat(60))

    const summary = { complete: 0, under_construction: 0, not_started: 0 }
    data.forEach(house => {
      const marker = house.progress === 100 ? '✅' : house.progress > 0 ? '⏳' : '⭕'
      const progressBar = '█'.repeat(house.progress / 10) + '░'.repeat((100 - house.progress) / 10)
      console.log(`${marker} ${house.house_number.padEnd(6)} [${progressBar}] ${String(house.progress).padEnd(3)}% ${house.status}`)

      if (house.status === 'complete') summary.complete++
      else if (house.status === 'under_construction') summary.under_construction++
      else summary.not_started++
    })

    console.log('─'.repeat(60))
    console.log(`\n✅ เสร็จสิ้น (100%):        ${summary.complete.toString().padEnd(3)} หลัง`)
    console.log(`⏳ กำลังทำ (85%):          ${summary.under_construction.toString().padEnd(3)} หลัง`)
    console.log(`⭕ ยังไม่เริ่ม (0%):        ${summary.not_started.toString().padEnd(3)} หลัง`)
    console.log(`📈 รวมทั้งหมด:             ${data.length} หลัง`)
    console.log('')

    console.log('✨ อัปเดตข้อมูลสำเร็จ!')
  } catch (error) {
    console.error('\n❌ เกิดข้อผิดพลาด:', error.message)
    process.exit(1)
  }
}

updateProgressData()
