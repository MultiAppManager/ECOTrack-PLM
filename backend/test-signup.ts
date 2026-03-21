import { auth } from './lib/auth.js';
import prisma from './lib/prisma.js';

async function testSignUp() {
  try {
    console.log('Testing user creation...');
    
    const testEmail = `test-${Date.now()}@example.com`;
    const testPassword = 'Test@1234';
    const testName = 'Test User';

    // Try using Better Auth signUpEmail
    console.log('Attempting sign-up with Better Auth...');
    console.log('Email:', testEmail);
    console.log('Name:', testName);

    const response = await auth.api.signUpEmail({
      body: {
        email: testEmail,
        password: testPassword,
        name: testName,
        role: 'user'
      }
    });

    console.log('Sign-up response:', response);
    
    // Check if account with password hash was created
    console.log('\n--- Checking Account table for password hash ---');
    const account = await prisma.account.findFirst({
      where: { userId: response.user.id },
      select: {
        id: true,
        providerId: true,
        password: true,
        createdAt: true
      }
    });
    
    console.log('Account found:', account);
    
    if (account && account.password) {
      console.log('\n✅ Password is stored in Account table!');
      console.log('Password hash starts with:', account.password.substring(0, 30) + '...');
      console.log('Password hash length:', account.password.length);
    } else {
      console.log('\n❌ No password found in Account table');
    }
    
    // Check if password is also in User table
    console.log('\n--- Checking User table for password hash ---');
    const user = await prisma.user.findUnique({
      where: { id: response.user.id },
      select: {
        id: true,
        email: true,
        password: true
      }
    });
    
    console.log('User found:', user);
    
    if (user && user.password && user.password.length > 1) {
      console.log('\n✅ Password is ALSO stored in User table!');
      console.log('Password hash starts with:', user.password.substring(0, 30) + '...');
      console.log('Password hash length:', user.password.length);
    } else {
      console.log('\n❌ No password found in User table (or empty)');
    }

  } catch (error: any) {
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      stack: error.stack
    });
  } finally {
    await prisma.$disconnect();
  }
}

testSignUp();
