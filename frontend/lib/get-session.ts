import { headers } from "next/headers";
import { cache } from "react";

export const getServerSession = cache(async () => {
    const headersList = await headers();
    const cookie = headersList.get('cookie');
    
    if (!cookie) {
        return null;
    }

    const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

    try {
        // Call the backend Better Auth API to get session
        const response = await fetch(`${apiUrl}/api/auth/get-session`, {
            headers: {
                'cookie': cookie,
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching session (backend may be down):', error);
        return null;
    }
});

