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
  { email: 'demo.ceo@alisa.com', name: 'Demo CEO - Full Access', role: 'ceo', dept: 'Executive', phone: '+66-8800-1111' },
  { email: 'demo.coo@alisa.com', name: 'Demo COO - Full Access', role: 'coo', dept: 'Operations', phone: '+66-8800-2222' },
  { email: 'demo.project_mgr@alisa.com', name: 'Demo Project Manager', role: 'project_manager', dept: 'Construction', phone: '+66-8800-3333' },
  { email: 'demo.sales_mgr@alisa.com', name: 'Demo Sales Manager', role: 'sales_manager', dept: 'Sales', phone: '+66-8800-4444' },
  { email: 'demo.finance_mgr@alisa.com', name: 'Demo Finance Manager', role: 'finance_manager', dept: 'Finance', phone: '+66-8800-5555' },
  { email: 'demo.hr_mgr@alisa.com', name: 'Demo HR Manager', role: 'hr_manager', dept: 'HR', phone: '+66-8800-6666' },
  { email: 'demo.engineer@alisa.com', name: 'Demo Engineer', role: 'engineer', dept: 'Construction', phone: '+66-8800-7777' },
  { email: 'demo.qa_inspector@alisa.com', name: 'Demo QA Inspector', role: 'qa_inspector', dept: 'Quality', phone: '+66-8800-8888' },
  { email: 'demo.accountant@alisa.com', name: 'Demo Accountant', role: 'accountant', dept: 'Finance', phone: '+66-8800-9999' },
  { email: 'demo.marketing@alisa.com', name: 'Demo Marketing', role: 'marketing', dept: 'Marketing', phone: '+66-8801-1111' },
  { email: 'demo.admin@alisa.com', name: 'Demo Admin', role: 'admin', dept: 'IT', phone: '+66-8801-2222' },
];

async function createDemoUsers() {
  try {
    console.log('🚀 Creating 11 demo users for AVIVA ONE v6.36...\n');

    const sql = `
      BEGIN;
      ${demoUsers.map(user => `
        INSERT INTO public.profiles (id, email, full_name, role, department, phone, is_active, is_demo, created_at, updated_at)
        VALUES (gen_random_uuid(), '${user.email}', '${user.name}', '${user.role}', '${user.dept}', '${user.phone}', true, true, NOW(), NOW())
        ON CONFLICT (email) DO UPDATE SET role='${user.role}', full_name='${user.name}', is_demo=true, is_active=true, updated_at=NOW();
      `).join('\n')}
      COMMIT;
    `;

    const { data, error } = await supabase.rpc('execute_sql', { query: sql });

    if (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }

    console.log('✅ Demo users created successfully!');

    // Verify
    const { data: profiles, error: verifyError } = await supabase
      .from('profiles')
      .select('email, role, is_demo')
      .eq('is_demo', true);

    if (verifyError) {
      console.error('❌ Verification error:', verifyError.message);
      process.exit(1);
    }

    console.log(`\n📊 Verification: ${profiles.length} demo users found`);
    console.log('\n📋 Demo Users Created:');
    profiles.forEach(p => {
      console.log(`   ✓ ${p.email} (${p.role})`);
    });

    console.log('\n🎯 Next Step: Login test in 18:00 น.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Fatal error:', err.message);
    process.exit(1);
  }
}

createDemoUsers();
