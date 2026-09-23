// Shared by API, migrations and worker. Machine configuration survives GitHub checkout.
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'local'}` });
const path = process.env.CARISMA_CONFIG_FILE || '/etc/carisma/integration.env';
if (fs.existsSync(path)) dotenv.config({ path, override: true });
