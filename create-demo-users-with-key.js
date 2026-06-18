#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ipxeraxcbxxsjimzougk.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.argv[2];

if (!SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY required');
  console.error('\nUsage:');
  console.error('  node create-demo-users-with-key.js "your-service-role-key"');
  console.error('  OR');
  console.error('  export SUPABASE_SERVICE_ROLE_KEY="your-key"');
  console.error('  node create-demo-users-with-key.js');
  console.error('\nWhere to find Service Role Key:');
  console.error('  1. Go to: https://supabase.com/dashboard/projects/ipxeraxcbxxsjimzougk/settings/api');
  console.error('  2. Copy "Service role key" (NOT Publishable key)');
  process.exit(1);
}

// ตัวอักษร SERVICE_ROLE_KEY คือ key ที่มีสิทธิ์สูงสุด
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const demoUsers = [
  { email: 'demo.ceo@alisa.com', password: 'Demo@CEO123', name: 'Demo CEO - Full Access', role: 'ceo', dept: 'Executive' },
  { email: 'demo.coo@alisa.com', password: 'Demo@COO123', name: 'Demo COO - Full Access', role: 'coo', dept: 'Operations' },
  { email: 'demo.project_mgr@alisa.com', password: 'Demo@ProjectMgr123', name: 'Demo Project Manager', role: 'project_manager', dept: 'Construction' },
  { email: 'demo.sales_mgr@alisa.com', password: 'Demo@SalesMgr123', name: 'Demo Sales Manager', role: 'sales_manager', dept: 'Sales' },
  { email: 'demo.finance_mgr@alisa.com', password: 'Demo@FinanceMgr123', name: 'Demo Finance Manager', role: 'finance_manager', dept: 'Finance' },
  { email: 'demo.hr_mgr@alisa.com', password: 'Demo@HrMgr123', name: 'Demo HR Manager', role: 'hr_manager', dept: 'HR' },
  { email: 'demo.engineer@alisa.com', password: 'Demo@Engineer123', name: 'Demo Engineer', role: 'engineer', dept: 'Construction' },
  { email: 'demo.qa_inspector@alisa.com', password: 'Demo@QaInspector123', name: 'Demo QA Inspector', role: 'qa_inspector', dept: 'Quality' },
  { email: 'demo.accountant@alisa.com', password: 'Demo@Accountant123', name: 'Demo Accountant', role: 'accountant', dept: 'Finance' },
  { email: 'demo.marketing@alisa.com', password: 'Demo@Marketing123', name: 'Demo Marketing', role: 'marketing', dept: 'Marketing' },
  { email: 'demo.admin@alisa.com', password: 'Demo@Admin123', name: 'Demo Admin', role: 'admin', dept: 'IT' },
];

async function createDemoUsers() {
  try {
    console.log('🚀 Creating 11 demo users for AVIVA ONE v6.36...\n');
    console.log('Method: Direct Supabase Admin API (Service Role Key)\n');

    let successCount = 0;
    let errorCount = 0;
    const results = [];

    // Step: Create each demo user using admin API
    for (const demoUser of demoUsers) {
      try {
        process.stdout.write(`⏳ Creating: ${demoUser.email} (${demoUser.role})... `);

        const { data, error } = await supabase.auth.admin.createUser({
          email: demoUser.email,
          password: demoUser.password,
          email_confirm: true,
          user_metadata: {
            full_name: demoUser.name,
            role: demoUser.role,
            department: demoUser.dept,
          },
          app_metadata: {
            role: demoUser.role,
            department: demoUser.dept,
            is_demo: true,
          },
        });

        if (error) {
          console.log(`❌`);
          console.log(`   Error: ${error.message}`);
          errorCount++;
          results.push({ email: demoUser.email, status: 'error', message: error.message });
        } else {
          console.log(`✅`);
          successCount++;
          results.push({ email: demoUser.email, status: 'success', userId: data.user.id });
        }
      } catch (err) {
        console.log(`❌`);
        console.log(`   Exception: ${err.message}`);
        errorCount++;
        results.push({ email: demoUser.email, status: 'error', message: err.message });
      }
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📊 SUMMARY:`);
    console.log(`${'═'.repeat(60)}`);
    console.log(`   ✅ Successfully created: ${successCount}/${demoUsers.length}`);
    if (errorCount > 0) {
      console.log(`   ❌ Failed: ${errorCount}/${demoUsers.length}`);
    }

    if (successCount > 0) {
      console.log(`\n📋 Demo Users Credentials (สำหรับทดสอบ):`);
      console.log(`${'─'.repeat(60)}`);
      demoUsers.forEach((u, i) => {
        const result = results.find(r => r.email === u.email);
        const status = result?.status === 'success' ? '✅' : '❌';
        console.log(`${status} ${u.email.padEnd(35)} / ${u.password}`);
      });
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🎯 Next Steps:`);
    console.log(`${'═'.repeat(60)}`);
    console.log(`   1. Go to: http://localhost:3000/`);
    console.log(`   2. Login with demo account (e.g., demo.ceo@alisa.com)`);
    console.log(`   3. Smoke test 4 core roles (CEO, Project Mgr, Finance, Engineer)`);
    console.log(`   4. Parallel testing with 8 roles at 18:30 น.`);
    console.log(`\n⏱️  Timeline:`);
    console.log(`   Now     → Setup complete ✅`);
    console.log(`   17:00   → Login + smoke test`);
    console.log(`   18:30   → Parallel demo testing (8 roles, 30 min)`);
    console.log(`   20 มิ.ย. 09:00 น. → GO-LIVE 🚀\n`);

    process.exit(successCount > 0 ? 0 : 1);
  } catch (err) {
    console.error('❌ Fatal error:', err.message);
    process.exit(1);
  }
}

createDemoUsers();
