#!/usr/bin/env node
/**
 * refresh_tooltip_audit.mjs
 * Generates a fresh audit report of all tooltips with plain-English descriptions
 * and unique snarky/helpful copy for each one.
 */

const BASE = process.env.CATN8_DEV_ORIGIN || 'http://localhost:8888';
const CONTEXTS = ['settings','customers','inventory','orders','pos','reports','admin','common','dashboard','marketing'];

async function apiGet(url) {
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`GET ${url} => ${res.status}`);
  return await res.json();
}

// Generate unique snarky/helpful tooltip based on element_id and context
function generateTooltip(elementId, context, _currentContent) {
  const id = String(elementId || '').toLowerCase();
  const ctx = String(context || '').toLowerCase();
  
  // Extract action from action:* format
  const action = id.startsWith('action:') ? id.slice(7) : id;
  
  // Comprehensive mapping of element patterns to unique, helpful, snarky copy
  const patterns = {
    // Save actions
    'save': [
      'Commits your changes to the database. Like a seatbelt for settings—click it before things get bumpy.',
      'Writes updates and makes them stick. Drafts are for novels, not admin panels.',
      'Locks in your edits. If future-you disagrees, future-you can change it back.',
      'Stores your work so it survives page refreshes and existential crises.',
      'Persists changes. Small, frequent saves beat heroic rescues every time.'
    ],
    // Cancel/Close actions
    'cancel|close': [
      'Closes without saving. Exit stage left—props stay where they were.',
      'Backs out gracefully. Changes that didn\'t meet the Save button won\'t be invited.',
      'Dismisses the dialog. No hard feelings, no saved changes.',
      'Shuts this down without committing. A clean exit is still progress.',
      'Closes the panel and carries on. Nothing saved, nothing broken.'
    ],
    // Delete actions
    'delete|remove': [
      'Removes permanently. Gone means gone—triple-check before clicking.',
      'Erases the selected item. This is the nuclear option—use with respect.',
      'Deletes forever. If your stomach fluttered, pause and double-check.',
      'Permanent removal. Consider accounting before wielding this power.',
      'Removes the target. No undo, no "just kidding," no ctrl+Z to save you.'
    ],
    // Test actions
    'test': [
      'Checks your setup. Green lights mean proceed; red means tea, then fixes.',
      'Pings the service with your settings. If it responds, we\'re friends.',
      'Runs diagnostics. Better to find issues here than in front of customers.',
      'Validates configuration. Two minutes now saves two hours later.',
      'Sends a test signal. If it answers with wisdom, you\'re set.'
    ],
    // Import actions
    'import': [
      'Brings external data in. Check your columns—spreadsheets are unforgiving.',
      'Loads data from a file. Backup first. Adventure second.',
      'Imports from CSV. Templates exist so headaches don\'t.',
      'Uploads data in bulk. One wrong mapping and you\'ve renamed 500 products to "undefined."',
      'Feeds the system a file. Well-labeled CSVs become products; chaos becomes regret.'
    ],
    // Export actions
    'export|download': [
      'Sends data to a file. Accountability in CSV form.',
      'Downloads a clean export. Future you loves this habit.',
      'Exports to CSV for backups or analysis. Data travels well.',
      'Grabs your data before the universe tests your backup strategy.',
      'Generates a file. Keep it safe; you\'ll thank yourself later.'
    ],
    // Preview actions
    'preview': [
      'Shows how changes will look. Try before you buy—no commitment.',
      'Displays a preview. Two seconds here saves ten minutes later.',
      'Renders a preview so you can spot issues before they go live.',
      'Shows the result. Peek, adjust, repeat until it\'s right.',
      'Previews your work. Confidence beats guesswork.'
    ],
    // Duplicate actions
    'duplicate|copy|clone': [
      'Clones the selected item. Because doing it twice by hand is a hobby, not a workflow.',
      'Makes a copy so you can tweak without breaking the original. Chaos, but contained.',
      'Duplicates the item. Copy a winner, adjust the details, save time.',
      'Creates a clone. Smart beats busy every time.',
      'Copies this thing. Efficient is attractive.'
    ],
    // Reset actions
    'reset|default': [
      'Reverts to defaults. The "oops" button—use sparingly, with beverages.',
      'Restores factory settings. Back to basics when experiments get enthusiastic.',
      'Resets everything. No shame in a clean slate.',
      'Returns to defaults. Sometimes starting over is the fastest path forward.',
      'Clears customizations. A fresh start for when things got weird.'
    ],
    // Refresh actions
    'refresh|reload': [
      'Reloads the current view. Catch fresh data without page gymnastics.',
      'Refreshes the list. Because stale data is nobody\'s friend.',
      'Pulls the latest. Stay current without full page reloads.',
      'Updates the display. See what changed without losing your place.',
      'Syncs with the server. Fresh data, same spot.'
    ],
    // Search actions
    'search|filter': [
      'Type a hint; find the needle. Filters spare your scroll finger.',
      'Searches the list. A few characters beat endless scrolling.',
      'Filters results. Find what you need without the treasure hunt.',
      'Narrows the list. Precision beats pagination.',
      'Searches by keyword. Your time is valuable; use it.'
    ],
    // Edit actions
    'edit|modify|update': [
      'Opens the editor. Polish the details—typos, images, prices.',
      'Modifies the selected item. Small fixes, real impact.',
      'Edits this entry. Change what needs changing, leave the rest.',
      'Updates the record. Accuracy now prevents confusion later.',
      'Opens for editing. Make it better, then move on.'
    ],
    // Add/Create actions
    'add|create|new': [
      'Creates a new entry. Name it clearly, fill it completely.',
      'Adds a fresh item. Start with good data; finish with fewer headaches.',
      'Creates something new. Clear names now prevent future detective work.',
      'Adds a new record. Sensible beats cryptic every time.',
      'Starts a new entry. Pick names a human would admire.'
    ],
    // View actions
    'view|show|display': [
      'Opens the details. All the info in one tidy place.',
      'Displays the full record. Clarity first, actions second.',
      'Shows the details. Peek inside without spawning fifteen tabs.',
      'Opens for viewing. Read-only mode for curious minds.',
      'Displays the item. Look, learn, decide what\'s next.'
    ],
    // Print actions
    'print': [
      'Prints the document. Paper still matters sometimes.',
      'Generates a printable version. Ink and paper, old school.',
      'Prints a slip so box-time feels calm and correct.',
      'Sends to printer. Physical backups for the analog world.',
      'Creates a print-ready version. Trees everywhere hold their breath.'
    ],
    // Sync actions
    'sync|synchronize': [
      'Syncs with the external service. Stay in step without manual labor.',
      'Pulls updates from the source. Automation beats repetition.',
      'Synchronizes data. Let the machines do the boring parts.',
      'Imports fresh data from the service. Coffee recommended for large catalogs.',
      'Syncs items and updates. Consistency without the copy-paste marathon.'
    ],
    // Clear actions
    'clear': [
      'Clears the field. A blank slate for fresh input.',
      'Removes stored data. Useful for resets, terrifying for typos.',
      'Clears the cache. A miniature spa day for performance.',
      'Empties the current value. Start over without the baggage.',
      'Resets the field. Clean slate, new start.'
    ],
    // Help actions
    'help|documentation|docs': [
      'Opens contextual help. Quick pointers when you want them; respectful silence when you don\'t.',
      'Shows documentation. When guesswork gets old, answers live here.',
      'Opens the help docs. Faster than pinging a group chat at 11pm.',
      'Displays guidance. Tips, patterns, and the occasional pep talk.',
      'Opens help. Because everyone needs a hint sometimes.'
    ]
  };
  
  // Find matching pattern
  for (const [pattern, options] of Object.entries(patterns)) {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(action)) {
      // Use hash of element_id to pick consistent variant
      const hash = Array.from(elementId).reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0), 0);
      return options[Math.abs(hash) % options.length];
    }
  }
  
  // Context-specific defaults if no pattern matches
  const contextDefaults = {
    settings: 'Adjusts a system setting. Change thoughtfully, test quickly, and keep receipts.',
    inventory: 'Manages product data. Keep it accurate so shoppers see what\'s real.',
    orders: 'Handles order processing. Make it smooth, make it fast, make it feel effortless.',
    customers: 'Manages customer data. Treat their info with respect and accuracy.',
    marketing: 'Controls marketing tools. Be helpful, be genuine, be strategic.',
    reports: 'Shows business metrics. The numbers don\'t lie, but they might hurt your feelings.',
    pos: 'Point-of-sale control. In-person checkout that behaves.',
    dashboard: 'Dashboard widget. Your daily pulse check on what matters.',
    admin: 'Admin control. Hover around—each button has a job and an attitude.',
    common: 'Common control. Does exactly what the label says, with minimal drama.'
  };
  
  return contextDefaults[ctx] || 'Controls for this feature. Click to interact, hover for details.';
}

// Generate plain-English description based on element_id
function generateDescription(elementId, _context) {
  const id = String(elementId || '').toLowerCase();
  const action = id.startsWith('action:') ? id.slice(7) : id;
  
  // Common patterns
  if (/save/.test(action)) return 'Saves changes to the database';
  if (/cancel|close/.test(action)) return 'Closes without saving changes';
  if (/delete|remove/.test(action)) return 'Permanently deletes the selected item';
  if (/test/.test(action)) return 'Tests the connection or configuration';
  if (/import/.test(action)) return 'Imports data from an external file';
  if (/export|download/.test(action)) return 'Exports data to a downloadable file';
  if (/preview/.test(action)) return 'Shows a preview of changes before applying';
  if (/duplicate|copy|clone/.test(action)) return 'Creates a copy of the selected item';
  if (/reset|default/.test(action)) return 'Resets to default values';
  if (/refresh|reload/.test(action)) return 'Refreshes the current view with latest data';
  if (/search|filter/.test(action)) return 'Searches or filters the list';
  if (/edit|modify|update/.test(action)) return 'Opens editor to modify the item';
  if (/add|create|new/.test(action)) return 'Creates a new item';
  if (/view|show|display/.test(action)) return 'Displays details of the item';
  if (/print/.test(action)) return 'Prints the document or slip';
  if (/sync/.test(action)) return 'Synchronizes with external service';
  if (/clear/.test(action)) return 'Clears the current value or cache';
  if (/help|docs/.test(action)) return 'Opens help documentation';
  
  return `Controls ${action.replace(/-/g, ' ')} functionality`;
}

(async () => {
  console.log('[Tooltip Audit] Fetching all tooltips...');
  const allTooltips = [];
  
  for (const ctx of CONTEXTS) {
    try {
      const res = await apiGet(`${BASE}/api/help_tooltips.php?action=get&page_context=${encodeURIComponent(ctx)}`);
      const tooltips = (res && res.success && Array.isArray(res.tooltips)) ? res.tooltips : [];
      allTooltips.push(...tooltips.map(t => ({ ...t, page_context: ctx })));
    } catch (e) {
      console.warn(`[Tooltip Audit] Failed to fetch ${ctx}:`, e.message);
    }
  }
  
  console.log(`[Tooltip Audit] Found ${allTooltips.length} tooltips across ${CONTEXTS.length} contexts`);
  
  // Generate markdown report
  const lines = [
    '# Admin Tooltips Audit (Fresh Export)',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Total tooltips: ${allTooltips.length}`,
    '',
    'Format per entry:',
    '- [context:::element_id]',
    '  - Current: existing tooltip content',
    '  - Purpose: plain-English description',
    '  - Suggested: unique snarky/helpful copy',
    '',
    '---',
    ''
  ];
  
  // Group by context
  const byContext = {};
  for (const t of allTooltips) {
    const ctx = t.page_context || 'unknown';
    if (!byContext[ctx]) byContext[ctx] = [];
    byContext[ctx].push(t);
  }
  
  for (const [ctx, tooltips] of Object.entries(byContext).sort()) {
    lines.push(`## ${ctx.charAt(0).toUpperCase() + ctx.slice(1)}`);
    lines.push('');
    
    for (const t of tooltips.sort((a, b) => String(a.element_id).localeCompare(String(b.element_id)))) {
      const current = (t.content || '').trim();
      const description = generateDescription(t.element_id, ctx);
      const suggested = generateTooltip(t.element_id, ctx, current);
      
      lines.push(`- [${ctx}:::${t.element_id}]`);
      if (current) lines.push(`  - Current: ${current}`);
      lines.push(`  - Purpose: ${description}`);
      lines.push(`  - Suggested: ${suggested}`);
      lines.push('');
    }
  }
  
  const markdown = lines.join('\n');
  const fs = await import('fs');
  const path = await import('path');
  const outPath = path.join(process.cwd(), 'documentation', 'TOOLTIPS_AUDIT_FRESH.md');
  fs.writeFileSync(outPath, markdown, 'utf8');
  
  console.log(`[Tooltip Audit] Report written to: ${outPath}`);
  console.log('[Tooltip Audit] Review the suggested copy, then run the curation script to apply changes.');
})();
