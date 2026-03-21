import { createAuthClient } from "better-auth/react";
import { nextCookies } from "better-auth/next-js";
import { emailOTPClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
    baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000",
    plugins: [nextCookies(), emailOTPClient()],
});
