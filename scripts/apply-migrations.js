const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const SUPABASE_URL = 'https://ipxeraxcbxxsjimzougk.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY not set')
  process.exit(1)
}

console.log('🔐 Initializing Supabase client...')
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function applyMigrations() {
  const migrations = [
    { name: '🏗️  Construction', file: 'supabase/migrations/20260619b_add_construction_activity_log.sql' },
    { name: '💰 Finance', file: 'supabase/migrations/20260619c_add_finance_activity_log.sql' },
    { name: '👥 HR', file: 'supabase/migrations/20260619d_add_hr_activity_log.sql' }
  ]

  console.log('\n🚀 Deploying migrations...\n')

  for (const migration of migrations) {
    try {
      const sqlPath = path.join(process.cwd(), migration.file)
      const sql = fs.readFileSync(sqlPath, 'utf-8')
      
      console.log(`${migration.name}`)
      console.log(`  Lines: ${sql.split('\n').length}`)
      
      // Test database connection
      const { data, error } = await supabase
        .from('daily_activity_log')
        .select('id')
        .limit(1)
      
      if (!error) {
        console.log(`  ✅ DB connection OK\n`)
      } else {
        console.log(`  ⚠️  Error: ${error.message}\n`)
      }
    } catch (err) {
      console.error(`  ❌ ${err.message}\n`)
    }
  }
  
  console.log('=' .repeat(60))
  console.log('\n📋 MANUAL STEPS TO COMPLETE:')
  console.log('1. Go to https://app.supabase.com/project/ipxeraxcbxxsjimzougk\n')
  console.log('2. Click SQL Editor → New Query\n')
  console.log('3. Paste and run each migration file:\n')
  
  migrations.forEach(m => {
    console.log(`   File: ${m.file}`)
  })
  
  console.log('\n✨ After applying all 3 migrations:')
  console.log('   Verify: SELECT routine_name FROM information_schema.routines')
  console.log('           WHERE routine_schema = \'public\' AND routine_name LIKE \'%log_%\'')
}

applyMigrations().catch(console.error)
