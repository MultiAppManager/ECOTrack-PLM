import { getServerSession } from '@/lib/get-session'
import { unauthorized } from 'next/navigation'
import DashboardClient from '../dashboard/DashboardClient'

const EcoPage = async () => {
  const session = await getServerSession()
  const user = session?.user
  if (!user) {
    unauthorized()
  }

  const userRole = user.role || 'Operations User'
  const canCreateEco = userRole === 'Engineering User' || userRole === 'Admin'

  return (
    <DashboardClient
      userName={user.name || ''}
      userRole={userRole}
      canCreateEco={canCreateEco}
    />
  )
}

export default EcoPage
