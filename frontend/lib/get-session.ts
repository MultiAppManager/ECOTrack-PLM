import { headers } from "next/headers";
import { cache } from "react";

export const getServerSession = cache(async () => {
    const headersList = await headers();
    const cookie = headersList.get('cookie');
    
    if (!cookie) {
        return null;
    }

    try {
        // Call the backend Better Auth API to get session
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/auth/get-session`, {
            headers: {
                'cookie': cookie,
            },
            credentials: 'include',
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching session:', error);
        return null;
    }
});
