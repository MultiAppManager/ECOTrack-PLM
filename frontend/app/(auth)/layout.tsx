import { getServerSession } from "@/lib/get-session";
import { redirect } from "next/navigation";
import { ReactNode } from "react";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession();
  const user = session?.user;  
  // in case user is alr logged in and tries to access auth routes, redirect to dashboard
  if(user) redirect("/dashboard")
  return children;
}
