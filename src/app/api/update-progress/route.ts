import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, serviceRoleKey)

export async function POST() {
  try {
    // 13 หลัง เสร็จ 100%
    const completed = ['A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A08', 'V13', 'V14', 'V15', 'V16', 'V30', 'V31']

    const { error: err1 } = await supabase
      .from('houses')
      .update({ progress: 100, status: 'complete' })
      .in('house_number', completed)

    if (err1) throw err1

    // 1 หลัง กำลังทำ 85%
    const { error: err2 } = await supabase
      .from('houses')
      .update({ progress: 85, status: 'under_construction' })
      .eq('house_number', 'A07')

    if (err2) throw err2

    // ดึงข้อมูลทั้งหมด
    const { data, error: err3 } = await supabase
      .from('houses')
      .select('house_number, progress, status')
      .order('house_number')

    if (err3) throw err3

    const summary = {
      complete: data?.filter(d => d.status === 'complete').length || 0,
      under_construction: data?.filter(d => d.status === 'under_construction').length || 0,
      not_started: data?.filter(d => d.status === 'not_started').length || 0,
      total: data?.length || 0
    }

    return Response.json({
      success: true,
      message: '✅ อัปเดตข้อมูลสำเร็จ',
      summary,
      data
    }, { status: 200 })
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
