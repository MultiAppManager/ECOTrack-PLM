import prisma from './lib/prisma.js';

async function syncAllPasswords() {
  try {
    console.log('🔄 Syncing all passwords from Account to User table...\n');
    
    const users = await prisma.user.findMany({
      include: {
        accounts: {
          where: { password: { not: null } }
        }
      }
    });
    
    let updated = 0;
    for (const user of users) {
      if (user.accounts.length > 0 && user.accounts[0].password) {
        await prisma.user.update({
          where: { id: user.id },
          data: { password: user.accounts[0].password }
        });
        updated++;
        console.log(`✅ ${user.email}: Password hash synced (${user.accounts[0].password.substring(0, 20)}...)`);
      }
    }
    
    console.log(`\n✨ Successfully synced ${updated} user passwords!\n`);
    
  } catch (error) {
    console.error('Error syncing passwords:', error);
  } finally {
    await prisma.$disconnect();
  }
}

syncAllPasswords();
