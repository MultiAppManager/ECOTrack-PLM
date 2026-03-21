import prisma from './lib/prisma.js';

async function checkPasswords() {
  const users = await prisma.user.findMany({
    select: { email: true, password: true },
    where: { password: { not: "" } }
  });
  
  console.log('\n✅ Users with password hashes synced to User table:\n');
  users.forEach(user => {
    console.log(`📧 ${user.email}`);
    console.log(`🔐 Hash: ${user.password.substring(0, 30)}...${user.password.substring(user.password.length - 20)}`);
    console.log(`📏 Length: ${user.password.length} characters\n`);
  });
  
  console.log(`Total users with passwords: ${users.length}`);
  
  await prisma.$disconnect();
}

checkPasswords();
