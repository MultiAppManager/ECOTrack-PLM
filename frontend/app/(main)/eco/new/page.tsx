import { getServerSession } from '@/lib/get-session'
import { redirect } from 'next/navigation'
import EcoCreateClient from '../EcoCreateClient'

const EcoNewPage = async () => {
  const session = await getServerSession()
  const user = session?.user
  if (!user) {
    redirect('/sign-in')
  }

  const userRole = user.role || 'Operations User'
  const canCreateEco = userRole === 'Engineering User' || userRole === 'Admin'

  if (!canCreateEco) {
    redirect('/eco')
  }

  return (
    <EcoCreateClient userName={user.name || ''} userRole={userRole} />
  )
}

export default EcoNewPage
