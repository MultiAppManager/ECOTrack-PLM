import { getServerSession } from '@/lib/get-session'
import { redirect } from 'next/navigation'
import ProductsClient from './ProductsClient'

export const metadata = {
  title: 'Product Master | ECOTrack PLM',
  description: 'Manage all base product definitions, pricing, attachments, and version history.',
}

const ProductsPage = async () => {
  const session = await getServerSession()
  const user = session?.user
  if (!user) redirect('/sign-in')

  const userRole = (user as { role?: string }).role || 'Operations User'
  const canWrite = userRole === 'Admin' || userRole === 'Engineering User'

  return (
    <ProductsClient
      userRole={userRole}
      canWrite={canWrite}
    />
  )
}

export default ProductsPage
