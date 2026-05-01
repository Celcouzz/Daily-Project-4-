const fs = require('fs');
const path = require('path');

const configContent = `const supabaseConfig = {
    url: '${process.env.SUPABASE_URL || ""}',
    anonKey: '${process.env.SUPABASE_ANON_KEY || ""}',
};`;

const outputPath = path.join(__dirname, '../public/js/config.js');

// Ensure directory exists
const dir = path.dirname(outputPath);
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

fs.writeFileSync(outputPath, configContent);
console.log('✅ public/js/config.js has been generated from Environment Variables.');
