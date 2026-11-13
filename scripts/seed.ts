import { migrate, syncCatalogue, rebuildSearchIndex, DB_PATH } from '../src/lib/db.ts';
import { seed } from '../src/lib/seed.ts';

const force = process.argv.includes('--force');
migrate();
syncCatalogue();
const result = seed({ force });
rebuildSearchIndex();
console.log(`Seeded ${DB_PATH}`);
console.log(JSON.stringify(result, null, 2));
