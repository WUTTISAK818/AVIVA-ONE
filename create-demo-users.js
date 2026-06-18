#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ipxeraxcbxxsjimzougk.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.argv[2];

if (!SUPABASE_KEY) {
  console.error('❌ Error: Supabase Publishable Key required');
  console.error('Usage: node create-demo-users.js "your-publishable-key"');
  console.error('Or set: export SUPABASE_ANON_KEY="your-key"');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const demoUsers = [
  { email: 'demo.ceo@alisa.com', password: 'AVIVA1188', name: 'Demo CEO - Full Access', role: 'ceo', dept: 'Executive' },
  { email: 'demo.coo@alisa.com', password: 'AVIVA1188', name: 'Demo COO - Full Access', role: 'coo', dept: 'Operations' },
  { email: 'demo.project_mgr@alisa.com', password: 'AVIVA1188', name: 'Demo Project Manager', role: 'project_manager', dept: 'Construction' },
  { email: 'demo.sales_mgr@alisa.com', password: 'AVIVA1188', name: 'Demo Sales Manager', role: 'sales_manager', dept: 'Sales' },
  { email: 'demo.finance_mgr@alisa.com', password: 'AVIVA1188', name: 'Demo Finance Manager', role: 'finance_manager', dept: 'Finance' },
  { email: 'demo.hr_mgr@alisa.com', password: 'AVIVA1188', name: 'Demo HR Manager', role: 'hr_manager', dept: 'HR' },
  { email: 'demo.engineer@alisa.com', password: 'AVIVA1188', name: 'Demo Engineer', role: 'engineer', dept: 'Construction' },
  { email: 'demo.qa_inspector@alisa.com', password: 'AVIVA1188', name: 'Demo QA Inspector', role: 'qa_inspector', dept: 'Quality' },
  { email: 'demo.accountant@alisa.com', password: 'AVIVA1188', name: 'Demo Accountant', role: 'accountant', dept: 'Finance' },
  { email: 'demo.marketing@alisa.com', password: 'AVIVA1188', name: 'Demo Marketing', role: 'marketing', dept: 'Marketing' },
  { email: 'demo.admin@alisa.com', password: 'AVIVA1188', name: 'Demo Admin', role: 'admin', dept: 'IT' },
];

async function createDemoUsers() {
  try {
    console.log('🚀 Creating 11 demo users for AVIVA ONE v6.36...\n');
    console.log('Method: Using Edge Function admin-user-management\n');

    // Step 1: Verify user is authenticated as admin/ceo/coo
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (!session || sessionError) {
      console.error('❌ Error: Not authenticated or no session');
      console.error('Please login to AVIVA ONE first, then run this script');
      process.exit(1);
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (!user || userError) {
      console.error('❌ Error: Cannot get user info');
      process.exit(1);
    }

    console.log(`✓ Authenticated as: ${user.email}`);
    console.log(`✓ Session token obtained\n`);

    let successCount = 0;
    let errorCount = 0;

    // Step 2: Create each demo user via Edge Function
    for (const demoUser of demoUsers) {
      try {
        console.log(`⏳ Creating: ${demoUser.email} (${demoUser.role})...`);

        const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-user-management`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: demoUser.email,
            password: demoUser.password,
            full_name: demoUser.name,
            role: demoUser.role,
            department: demoUser.dept,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          console.log(`   ❌ Failed: ${result.error}`);
          errorCount++;
        } else {
          console.log(`   ✅ Success`);
          successCount++;
        }
      } catch (err) {
        console.log(`   ❌ Error: ${err.message}`);
        errorCount++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Successfully created: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    console.log(`   📝 Total: ${demoUsers.length}`);

    if (successCount === 0) {
      console.log('\n⚠️ No users created. Check:');
      console.log('   1. Are you logged in as admin/ceo/coo?');
      console.log('   2. Is the Edge Function deployed?');
      process.exit(1);
    }

    console.log('\n📋 Demo Users Credentials:');
    demoUsers.forEach(u => {
      console.log(`   ${u.email} / ${u.password}`);
    });

    console.log('\n🎯 Next Steps:');
    console.log('   1. Go to http://localhost:3000/');
    console.log('   2. Login with any demo account above');
    console.log('   3. Start smoke testing');

    process.exit(0);
  } catch (err) {
    console.error('❌ Fatal error:', err.message);
    process.exit(1);
  }
}

createDemoUsers();
