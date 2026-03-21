import z from 'zod';

export const passwordSchema = z.string().
min(8, 'Password must be at least 8 characters long').
min(1, 'Password required').
max(25, 'Password must be at most 25 characters long').
regex(/[A-Z]/, 'Password must contain at least one uppercase letter').
regex(/[a-z]/, 'Password must contain at least one lowercase letter').
regex(/[0-9]/, 'Password must contain at least one number').
regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');