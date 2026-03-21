import { getServerSession } from '@/lib/get-session'
import { redirect } from 'next/navigation'
import AdminDashboardClient from './AdminDashboardClient'

const Dashboard = async () => {
  const session = await getServerSession()
  const user = session?.user
  if (!user) {
    redirect('/sign-in')
  }

  const userRole = user.role || 'Operations User'
  if (userRole !== 'Admin') {
    redirect(userRole === 'Operations User' ? '/products' : '/eco')
  }

  return <AdminDashboardClient />
}

export default Dashboard
