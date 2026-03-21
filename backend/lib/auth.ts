import {betterAuth} from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "./prisma.js";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { passwordSchema } from "./validation.js";
import { emailOTP } from "better-auth/plugins";
import nodemailer from "nodemailer";

const ALLOWED_ROLES = ["Engineering User", "Approver", "Operations User", "Admin"] as const;

export const auth = betterAuth({
    database: prismaAdapter(prisma,{
        provider: "postgresql",
    }),
    emailAndPassword:{
        enabled: true,
    },
    socialProviders:{
        google:{
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
        github:{
            clientId: process.env.GITHUB_ID!,
            clientSecret: process.env.GITHUB_SECRET!,
        }
    },
    user:{
        additionalFields:{
            role:{
                type: "string",
                required: false,
                input: true,
                defaultValue: "Operations User",
            }
        }
    },
    plugins:[
        emailOTP({
            async sendVerificationOTP({ email, otp, type }) {
                const transporter = nodemailer.createTransport({
                    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
                    port: parseInt(process.env.EMAIL_PORT || '587'),
                    secure: false,
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASSWORD,
                    },
                });

                let subject = '';
                let html = '';

                if (type === "sign-in") {
                    subject = 'Your Sign-In OTP';
                    html = `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #f97316;">Sign-In OTP</h2>
                            <p>Use this OTP to sign in to your account:</p>
                            <div style="background-color: #fff7ed; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
                                <h1 style="color: #f97316; font-size: 32px; letter-spacing: 8px; margin: 0;">${otp}</h1>
                            </div>
                            <p>This OTP expires in 5 minutes.</p>
                            <p>If you didn't request this, please ignore this email.</p>
                        </div>
                    `;
                } else if (type === "email-verification") {
                    subject = 'Verify Your Email';
                    html = `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #f97316;">Email Verification</h2>
                            <p>Use this OTP to verify your email address:</p>
                            <div style="background-color: #fff7ed; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
                                <h1 style="color: #f97316; font-size: 32px; letter-spacing: 8px; margin: 0;">${otp}</h1>
                            </div>
                            <p>This OTP expires in 5 minutes.</p>
                        </div>
                    `;
                } else if (type === "forget-password") {
                    subject = 'Reset Your Password';
                    html = `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #f97316;">Password Reset Request</h2>
                            <p>Use this OTP to reset your password:</p>
                            <div style="background-color: #fff7ed; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
                                <h1 style="color: #f97316; font-size: 32px; letter-spacing: 8px; margin: 0;">${otp}</h1>
                            </div>
                            <p>This OTP expires in 5 minutes.</p>
                            <p>If you didn't request this, please ignore this email.</p>
                        </div>
                    `;
                }

                const mailOptions = {
                    from: process.env.EMAIL_FROM || 'noreply@yourapp.com',
                    to: email,
                    subject,
                    html,
                };

                await transporter.sendMail(mailOptions);
            },
            otpLength: 6,
            expiresIn: 300, // 5 minutes
            allowedAttempts: 3,
        })
    ],
    hooks:{
        before: createAuthMiddleware(async (ctx)=>{
            if(
                ctx.path==="sign-up/email" ||
                ctx.path==="/reset-password" ||
                ctx.path==="/change-password"
            ){
                const password=ctx.body.password || ctx.body.newPassword;
                const {error}=passwordSchema.safeParse(password);
                if(error)
                {
                    throw new APIError("BAD_REQUEST", {
                        message: "Password not strong enough",
                    });
                }
            }
            if (ctx.path === "sign-up/email") {
                const role = ctx.body.role;
                if (role && !ALLOWED_ROLES.includes(role)) {
                    throw new APIError("BAD_REQUEST", {
                        message: `Invalid role. Allowed roles: ${ALLOWED_ROLES.join(", ")}`,
                    });
                }
            }
        })
    }
})
export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;