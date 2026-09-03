import { db } from '../config/database';
import { organizations, phoneNumbers } from '../db/schema';

async function main() {
  console.log('=== ORGANIZATIONS ===');
  const orgs = await db.select().from(organizations);
  console.log(JSON.stringify(orgs, null, 2));

  console.log('=== PHONE NUMBERS ===');
  const phones = await db.select().from(phoneNumbers);
  console.log(JSON.stringify(phones, null, 2));

  process.exit(0);
}

main();
