import Sidebar from "./sidebar";

export default async function MainLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div className="flex-1 w-full overflow-hidden">
        {children}
      </div>
    </div>
  );
}
