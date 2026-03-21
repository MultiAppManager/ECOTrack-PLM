import { getServerSession } from '@/lib/get-session'
import { unauthorized } from 'next/navigation'

const Dashboard = async () => {
  const session = await getServerSession()
  const user = session?.user
  if (!user) {
    unauthorized()
  }

  return (
    <div className='min-h-screen p-6'>
      <div className='max-w-7xl mx-auto bg-white rounded-2xl border-2 border-purple-200 shadow-sm p-6'>
        <h1 className='text-2xl font-bold text-purple-700 mb-2'>Dashboard</h1>
        <p className='text-gray-600'>
          Welcome to PLM. Use the left menu to open Engineering Change Orders (ECO) and other modules.
        </p>
      </div>
    </div>
  )
}

export default Dashboard
