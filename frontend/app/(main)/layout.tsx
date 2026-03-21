import Sidebar from "./sidebar";
import StarBackground from "./dashboard/StarBackground";

export default async function MainLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div className="relative flex-1 w-full overflow-hidden">
        <StarBackground />
        <div className="relative z-10">{children}</div>
      </div>
    </div>
  );
}
