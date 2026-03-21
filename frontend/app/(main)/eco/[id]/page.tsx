import { getServerSession } from '@/lib/get-session'
import { redirect } from 'next/navigation'
import EcoDetailClient from '../EcoDetailClient'

type PageProps = { params: Promise<{ id: string }> }

const EcoDetailPage = async ({ params }: PageProps) => {
  const session = await getServerSession()
  const user = session?.user
  if (!user) {
    redirect('/sign-in')
  }

  const userRole = user.role || 'Operations User'
  if (userRole === 'Operations User') {
    redirect('/products')
  }
  const canCreateEco = userRole === 'Engineering User' || userRole === 'Admin'

  const { id } = await params

  return (
    <EcoDetailClient
      ecoId={id}
      userName={user.name || ''}
      userRole={userRole}
      canCreateEco={canCreateEco}
    />
  )
}

export default EcoDetailPage
