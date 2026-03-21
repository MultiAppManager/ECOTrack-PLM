import { getServerSession } from '@/lib/get-session'
import { redirect } from 'next/navigation'
import ReportingClient from './ReportingClient'

const ReportsPage = async () => {
  const session = await getServerSession()
  const user = session?.user
  if (!user) {
    redirect('/sign-in')
  }

  const userRole = user.role || 'Operations User'
  return <ReportingClient userRole={userRole} />
}

export default ReportsPage

