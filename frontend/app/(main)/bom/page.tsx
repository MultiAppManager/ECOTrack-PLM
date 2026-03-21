import { getServerSession } from '@/lib/get-session'
import { redirect } from 'next/navigation'
import BomClient from './BomClient'

export const metadata = {
  title: 'Bills of Materials | ECOTrack PLM',
  description: 'Manage all Bill of Materials definitions with full version history.',
}

const BomPage = async () => {
  const session = await getServerSession()
  const user = session?.user
  if (!user) redirect('/sign-in')

  const userRole = (user as { role?: string }).role || 'Operations User'
  const canWrite = userRole === 'Admin' || userRole === 'Engineering User'

  return <BomClient userRole={userRole} canWrite={canWrite} />
}

export default BomPage
