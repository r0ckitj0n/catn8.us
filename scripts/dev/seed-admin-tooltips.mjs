#!/usr/bin/env node
/**
 * Seed Admin Tooltips into DB via API
 * - Targets the Settings page (links + modals) and common admin nav to start
 * - Adds SNARKY tooltips. Safe to re-run; skips if tooltip exists (by element_id + page_context)
 *
 * Usage:
 *   node scripts/dev/seed-admin-tooltips.mjs --apply   # actually create
 *   node scripts/dev/seed-admin-tooltips.mjs --dry-run # default, preview only
 */

import _fs from 'node:fs';
import _path from 'node:path';

const API_BASE = process.env.CATN8_BASE_URL || 'http://localhost:8888';
const IS_LOCAL = /localhost|127\.0\.0\.1/.test(API_BASE);
const API_URL = `${API_BASE}/api/help_tooltips.php`;
const ADMIN_TOKEN = process.env.CATN8_ADMIN_TOKEN || 'whimsical_admin_2024';

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');

async function getJson(url) {
  const headers = { 'Accept': 'application/json' };
  if (IS_LOCAL) headers['X-WF-Dev-Admin'] = '1';
  const res = await fetch(url, { headers, credentials: 'include' });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.json();
}
async function postJson(url, body) {
  const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
  if (IS_LOCAL) headers['X-WF-Dev-Admin'] = '1';
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...body, admin_token: ADMIN_TOKEN }),
  });
  if (!res.ok) throw new Error(`POST ${url} -> ${res.status}`);
  return res.json();
}

function tip(element_id, page_context, title, content, position = 'bottom') {
  return { element_id, page_context, title, content, position, is_active: 1 };
}

// SNARKY tooltips for Settings page links
const settingsTips = [
  tip('dashboardConfigBtn', 'settings', 'Dashboard Configuration', "Customize your control center so you can ignore different metrics in style."),
  tip('categoriesBtn', 'settings', 'Categories', "Put your products into tidy little boxes so customers can actually find them."),
  tip('globalColorSizeBtn', 'settings', 'Colors & Sizes', "Centralized sizes and colors, because typing 'Medium' 47 times builds character but ruins wrists."),
  tip('roomsBtn', 'settings', 'Room Settings', "Rename rooms like you're redecorating—without moving a single piece of furniture."),
  tip('roomCategoryBtn', 'settings', 'Room-Category Links', "Tell each room what it should pretend to sell. Works better than yelling at your screen."),
  tip('templateManagerBtn', 'settings', 'Template Manager', "Because copying and pasting HTML from 2013 is a lifestyle, not a choice."),
  // Colors & Fonts (Visual & Design)
  tip('open-colors-fonts', 'settings', 'Colors & Fonts', "Brand colors and type, unified. Pick your palette and typography like you mean it."),

  tip('globalCSSBtn', 'settings', 'CSS Rules', "Paint the entire site with two variables and a dream. Try not to invent a sixth shade of green."),
  tip('backgroundManagerBtn', 'settings', 'Background Manager', "Rotate backgrounds like motivational posters—now with fewer eagles and sunsets."),
  tip('roomMapperBtn', 'settings', 'Room Mapper', "Turn pixels into hotspots. It’s like cartography, but for your shop and without sea monsters."),
  tip('open-room-map-manager', 'settings', 'Room Map Manager', "Manage and apply room maps. Align click zones without arranging a single piece of furniture."),
  tip('areaItemMapperBtn', 'settings', 'Area-Item Mapper', "Assign items to click zones. Because customers love playing 'find the button'."),

  tip('businessInfoBtn', 'settings', 'Business Information', "Your public face. Make it look like you totally meant to be professional today."),
  tip('squareSettingsBtn', 'settings', 'Square Configuration', "Let people exchange actual money for your stuff—what a concept!"),

  tip('emailConfigBtn', 'settings', 'Email Configuration', "Teach your emails to arrive fashionably on time, not 'mysteriously never'."),
  tip('emailHistoryBtn', 'settings', 'Email History', "Because 'we definitely sent that' pairs well with evidence."),
  tip('fixSampleEmailBtn', 'settings', 'Send Sample Email', "Test an email on yourself before testing it on your customers' patience."),
  tip('loggingStatusBtn', 'settings', 'Logging Status', "peek behind the curtain and see what your site muttered under its breath."),
  tip('receiptMessagesBtn', 'settings', 'Receipt Messages', "Add heartfelt thank-yous, or passive-aggressive reminders to keep receipts."),

  tip('accountSettingsBtn', 'settings', 'Account Settings', "Change your details like a spy on the run—new names not included."),
  tip('secretsManagerBtn', 'settings', 'Secrets Manager', "Store keys and secrets here, not in a sticky note under your keyboard."),
  tip('costBreakdownBtn', 'settings', 'Cost Breakdown', "Figure out why profits disappear faster than fresh donuts in a break room."),
  tip('userManagerBtn', 'settings', 'User Manager', "Grant access responsibly. No, your cousin doesn’t need admin rights."),

  tip('aiSettingsBtn', 'settings', 'AI Provider', "Choose your robot overlord. May it write emails better than you."),
  tip('aiToolsBtn', 'settings', 'AI & Automation Tools', "Buttons that sound fancy and sometimes actually are."),
  // Button Manager
  tip('open-action-icons-manager', 'settings', 'Button Manager', "Customize admin buttons and icons so your clicks look as good as they feel."),
  tip('actionIconsManagerBtn', 'settings', 'Button Manager', "Customize admin buttons and icons so your clicks look as good as they feel."),

  // Square modal actions
  tip('squareSaveBtn', 'settings', 'Save Square Settings', "Lock in your payment destiny."),
  tip('squareTestBtn', 'settings', 'Test Connection', "Press to discover if the finance gods are smiling today."),
  tip('squareSyncItemsBtn', 'settings', 'Sync Items', "Teach Square about your inventory, like show-and-tell but with SKUs."),
  tip('squareClearTokenBtn', 'settings', 'Clear Token', "For when you pasted the key into the wrong box. Again."),

  // CSS rules modal
  tip('cssRulesSaveBtn', 'settings', 'Save CSS Rules', "Save your masterpiece before inspiration fades and variables multiply."),
  tip('cssRulesCloseBtn', 'settings', 'Close', "Leave before you redesign the universe."),

  // Business info modal
  tip('businessInfoSaveBtn', 'settings', 'Save Business Info', "Commit your 'brand voice' to the database like a responsible adult."),
  tip('businessInfoCloseBtn', 'settings', 'Close', "Retreat with dignity."),

  // AI settings modal
  tip('aiSettingsSaveBtn', 'settings', 'Save AI Settings', "Give the robot clear instructions before it 'helps'."),
  tip('aiSettingsTestBtn', 'settings', 'Test AI Settings', "Make the AI perform a trick. Clap politely if it works."),

  // Email settings modal
  tip('emailSettingsCloseBtn', 'settings', 'Close Email Settings', "Escape the email labyrinth unscathed."),
];

// Common admin navigation (page_context = 'common')
const adminNavTips = [
  tip('adminDashboardTab', 'common', 'Dashboard', "Your empire at a glance. Try not to panic."),
  tip('adminCustomersTab', 'common', 'Customers', "Treat them well. They have the money."),
  tip('adminInventoryTab', 'common', 'Inventory', "Where SKUs go to multiply when you’re not looking."),
  tip('adminOrdersTab', 'common', 'Orders', "Organize chaos into packages."),
  tip('adminPosTab', 'common', 'POS', "Point-of-Sale, not the other POS you were thinking."),
  tip('adminReportsTab', 'common', 'Reports', "Because spreadsheets are a love language."),
  tip('adminMarketingTab', 'common', 'Marketing', "Convince strangers to love your brand. No pressure."),
  tip('adminSettingsTab', 'common', 'Settings', "The control room. Flip switches, look important."),
];

// Inventory section (mix of ids and data-action names)
const inventoryTips = [
  tip('refresh-categories', 'inventory', 'Refresh Categories', "When in doubt, mash refresh. It fixes everything... eventually."),
  tip('delete-item', 'inventory', 'Delete Item', "Send this SKU to the big warehouse in the sky."),
  tip('navigate-item', 'inventory', 'Navigate Items', "Because scrolling is passé."),
  tip('open-cost-modal', 'inventory', 'Open Cost Modal', "Crunch the numbers so the numbers don't crunch you."),
  tip('save-cost-item', 'inventory', 'Save Cost Item', "Commit your math to the database like you mean it."),
  tip('delete-cost-item', 'inventory', 'Delete Cost Item', "Goodbye, questionable expense."),
  tip('clear-cost-breakdown', 'inventory', 'Clear Cost Breakdown', "Nuke it from orbit—it’s the only way to be sure."),
  tip('get-cost-suggestion', 'inventory', 'Get Cost Suggestion', "Ask the machine what it thinks money is."),
  tip('get-price-suggestion', 'inventory', 'Get Price Suggestion', "Robot says charge more. You probably should."),
  tip('apply-price-suggestion', 'inventory', 'Apply Price Suggestion', "Trust the algorithm. What could go wrong?"),
  tip('open-marketing-manager', 'inventory', 'Marketing Manager', "Outsource creativity to silicon."),
  tip('generate-marketing-copy', 'inventory', 'Generate Marketing Copy', "AI-generated enthusiasm—now with fewer typos."),
  tip('process-images-ai', 'inventory', 'AI Process Images', "Let AI crop everything because rectangles are hard."),
  tip('open-color-template-modal', 'inventory', 'Color Templates', "Because one shade of blue was never enough."),
  tip('open-global-colors-management', 'inventory', 'Global Colors', "Centralize your rainbow like a responsible adult."),
];

// Orders
const ordersTips = [
  tip('filter-orders', 'orders', 'Filter Orders', "Sift the chaos until only the good stuff remains."),
  tip('refund-order', 'orders', 'Refund Order', "Be the hero customers deserve. Or the villain accountants fear."),
  tip('mark-shipped', 'orders', 'Mark Shipped', "Declare it shipped like a captain christening a boat."),
];

// Customers
const customersTips = [
  tip('search-customers', 'customers', 'Search Customers', "Hunt down that one email from 2018."),
  tip('add-customer', 'customers', 'Add Customer', "Create a new friend who owes you money."),
  tip('merge-customers', 'customers', 'Merge Customers', "Two become one. Data harmony achieved."),
];

// Reports
const reportsTips = [
  tip('export-report', 'reports', 'Export Report', "Download a spreadsheet to ignore later."),
  tip('print-report', 'reports', 'Print Report', "Feed your printer and your soul with paper charts."),
  tip('change-range', 'reports', 'Change Date Range', "Move the goalposts until the numbers look nice."),
];

// Marketing
const marketingTips = [
  tip('create-campaign', 'marketing', 'Create Campaign', "Announce your existence to the disinterested masses."),
  tip('send-test-email', 'marketing', 'Send Test Email', "Email yourself like it's 2005."),
  tip('generate-coupons', 'marketing', 'Generate Coupons', "Because nothing sells like a discount and a countdown."),
];

// POS
const posTips = [
  tip('toggle-fullscreen', 'pos', 'Fullscreen', "Make the buttons comically large for dramatic effect."),
  tip('exit-pos', 'pos', 'Exit POS', "Return to the world of tiny buttons and even tinier margins."),
  tip('browse-items', 'pos', 'Browse Items', "Window-shopping, but with fewer windows."),
  tip('checkout', 'pos', 'Complete Sale', "Turn tapping into revenue. Cha-ching."),
];

// DB Status / Tools
const dbStatusTips = [
  tip('runCommand', 'db-status', 'Run Command', "Push mysterious buttons and hope for green checkmarks."),
  tip('generate-css', 'db-status', 'Generate CSS', "Birth fresh styles from the command line."),
  tip('test-css', 'db-status', 'Test CSS', "Make sure you didn’t invent a new shade of broken."),
];

const dbWebManagerTips = [
  tip('showTab', 'db-web-manager', 'Switch Tab', "Tabs: because one panel is never enough."),
  tip('executeQuery', 'db-web-manager', 'Execute Query', "Summon data with ancient SQL incantations."),
  tip('clearQuery', 'db-web-manager', 'Clear Query', "Erase your brilliance. Regret immediately."),
  tip('loadTables', 'db-web-manager', 'Refresh Tables', "Count your tables like sheep."),
  tip('describeTable', 'db-web-manager', 'Describe Table', "Peek under the hood without getting greasy."),
];

// Room Config Manager / Cost Breakdown Manager
const roomConfigTips = [
  tip('resetForm', 'room-config-manager', 'Reset To Defaults', "Ctrl+Z for your entire taste in design."),
];

const costBreakdownMgrTips = [
  tip('apply-suggested-cost-to-cost-field', 'cost-breakdown-manager', 'Apply Suggested Cost', "Let the computer guess and pretend it was your idea."),
];

async function main() {
  // Build existing set via public 'get' per page_context to avoid admin auth in dry-run
  const ctxs = ['settings','common','inventory','orders','customers','reports','marketing','pos','db-status','db-web-manager','room-config-manager','cost-breakdown-manager'];
  const have = new Set();
  for (const ctx of ctxs) {
    try {
      const res = await getJson(`${API_URL}?action=get&page_context=${encodeURIComponent(ctx)}`);
      const list = (res && res.success && Array.isArray(res.tooltips)) ? res.tooltips : [];
      for (const t of list) have.add(`${(t.page_context||ctx)}::${t.element_id}`);
    } catch (e) {
      // non-fatal in dry-run
    }
  }

  const planned = [
    ...settingsTips,
    ...adminNavTips,
    ...inventoryTips,
    ...ordersTips,
    ...customersTips,
    ...reportsTips,
    ...marketingTips,
    ...posTips,
    ...dbStatusTips,
    ...dbWebManagerTips,
    ...roomConfigTips,
    ...costBreakdownMgrTips,
  ];
  const missing = planned.filter(t => !have.has(`${t.page_context}::${t.element_id}`));

  console.log(`[seed-tooltips] Planned: ${planned.length}, Existing: ${have.size}, Missing: ${missing.length}`);
  if (!APPLY) {
    console.log('[seed-tooltips] Dry-run. Missing entries preview:');
    for (const m of missing) console.log(` - [${m.page_context}] ${m.element_id}: ${m.title}`);
    console.log('\nRun with --apply to create.');
    return;
  }

  let upserted = 0;
  for (const m of missing) {
    try {
      const res = await postJson(`${API_URL}?action=upsert`, m);
      if (res?.success) { upserted++; console.log(` + Upserted: [${m.page_context}] ${m.element_id}`); }
      else console.warn(` ! Failed to upsert: [${m.page_context}] ${m.element_id}`, res);
    } catch (e) {
      console.warn(` ! Error upserting: [${m.page_context}] ${m.element_id}`, e.message);
    }
  }
  console.log(`[seed-tooltips] Upserted ${upserted}/${missing.length} tooltips.`);
}

main().catch(err => { console.error('[seed-tooltips] Fatal:', err); process.exit(1); });
