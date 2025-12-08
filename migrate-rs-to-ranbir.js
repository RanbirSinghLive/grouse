// Migration script to update RS accounts to Ranbir and remove person profiles
// Run this in browser console or as a one-time migration

console.log('[Migration] Starting RS to Ranbir migration...');

// Get current data
const householdData = JSON.parse(localStorage.getItem('grouse-household') || 'null');
const accountsData = JSON.parse(localStorage.getItem('grouse-accounts') || '[]');
const projectionData = JSON.parse(localStorage.getItem('grouse-projections') || '[]');

let updated = false;

// 1. Update all accounts with owner "RS" or "rs" to "Ranbir"
if (accountsData && Array.isArray(accountsData)) {
  accountsData.forEach(account => {
    if (account.owner && (account.owner.toLowerCase() === 'rs' || account.owner === 'RS')) {
      console.log(`[Migration] Updating account "${account.name}" owner from "${account.owner}" to "Ranbir"`);
      account.owner = 'Ranbir';
      updated = true;
    }
  });
  
  if (updated) {
    localStorage.setItem('grouse-accounts', JSON.stringify(accountsData));
    console.log('[Migration] Accounts updated and saved');
  }
}

// 2. Update household owners array and remove personProfiles
if (householdData) {
  const owners = ['Ranbir'];
  if (householdData.personProfiles?.person2?.nickname?.trim()) {
    owners.push(householdData.personProfiles.person2.nickname.trim());
  }
  owners.push('Joint', 'Household');
  
  householdData.owners = owners;
  delete householdData.personProfiles;
  
  localStorage.setItem('grouse-household', JSON.stringify(householdData));
  console.log('[Migration] Household updated - owners:', owners);
  console.log('[Migration] Person profiles removed');
}

// 3. Note: Projection scenarios with person1/person2 will need manual migration
// This is documented in the breaking changes
console.log('[Migration] Migration complete!');
console.log('[Migration] WARNING: Existing projection scenarios with person1/person2 data will need manual review.');

