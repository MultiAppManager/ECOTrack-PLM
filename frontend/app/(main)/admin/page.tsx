import { getServerSession } from '@/lib/get-session'
import Link from 'next/link'
import { forbidden, unauthorized } from 'next/navigation'
import React from 'react'

interface UserAccount {
  id: string
  providerId: string
  password: string | null
  createdAt: string
  updatedAt: string
}

interface User {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  role: string
  createdAt: string
  updatedAt: string
  accounts: UserAccount[]
  _count: {
    sessions: number
  }
}

const AdminPage = async () => {
  const session = await getServerSession()
  const user = session?.user
  
  if (!user) {
    forbidden()
  }

  // Check if user has admin role
  const isAdmin = user.role === 'Admin'
  
  if (!isAdmin) {
    // Redirect to forbidden page if user is not admin
    return (
      <div className='flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-red-50 to-orange-50'>
        <div className='bg-white p-8 rounded-2xl shadow-lg border-2 border-red-300 w-full max-w-md text-center'>
          <div className='text-6xl mb-4'>🚫</div>
          <h1 className='text-3xl font-bold text-red-600 mb-3'>Access Denied</h1>
          <p className='text-gray-600 mb-6'>You don't have permission to access the admin panel.</p>
          <Link href='/dashboard' className='inline-block bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200'>
            Go to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  // Fetch all users from the API
  let users: User[] = []
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/users`, {
      cache: 'no-store',
      headers: {
        Cookie: `better-auth.session_token=${session?.session?.token}`,
      }
    })
    
    if (response.ok) {
      users = await response.json()
    }
  } catch (error) {
    console.error('Error fetching users:', error)
  }

  const totalUsers = users.length
  const activeSessions = users.reduce((acc, u) => acc + u._count.sessions, 0)
  const verifiedUsers = users.filter(u => u.emailVerified).length

  return (
    <div className='min-h-screen bg-transparent p-8'>
      <div className='max-w-7xl mx-auto'>
        {/* Header */}
        <div className='bg-white p-6 rounded-2xl shadow-lg border-2 border-purple-300 mb-6'>
          <div className='flex items-center justify-between'>
            <div>
              <h1 className='text-4xl font-bold text-purple-600 mb-2'>Admin Dashboard</h1>
              <p className='text-gray-600'>Welcome back, {user.name}!</p>
            </div>
            <div className='px-4 py-2 bg-purple-500 text-white rounded-full font-semibold'>
              👑 Admin
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className='grid grid-cols-1 md:grid-cols-3 gap-6 mb-6'>
          <div className='bg-white p-6 rounded-2xl shadow-lg border-2 border-blue-300'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-gray-600 text-sm font-semibold'>Total Users</p>
                <p className='text-3xl font-bold text-blue-600 mt-2'>{totalUsers}</p>
              </div>
              <div className='text-4xl'>👥</div>
            </div>
          </div>

          <div className='bg-white p-6 rounded-2xl shadow-lg border-2 border-green-300'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-gray-600 text-sm font-semibold'>Active Sessions</p>
                <p className='text-3xl font-bold text-green-600 mt-2'>{activeSessions}</p>
              </div>
              <div className='text-4xl'>🟢</div>
            </div>
          </div>

          <div className='bg-white p-6 rounded-2xl shadow-lg border-2 border-orange-300'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-gray-600 text-sm font-semibold'>Verified Users</p>
                <p className='text-3xl font-bold text-orange-600 mt-2'>{verifiedUsers}</p>
              </div>
              <div className='text-4xl'>✅</div>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className='bg-white p-6 rounded-2xl shadow-lg border-2 border-purple-300'>
          <h2 className='text-2xl font-bold text-purple-600 mb-4'>All Users</h2>
          <div className='overflow-x-auto'>
            <table className='w-full'>
              <thead>
                <tr className='bg-purple-100 border-b-2 border-purple-300'>
                  <th className='text-left p-3 font-semibold text-purple-800'>User ID</th>
                  <th className='text-left p-3 font-semibold text-purple-800'>Name</th>
                  <th className='text-left p-3 font-semibold text-purple-800'>Email</th>
                  <th className='text-left p-3 font-semibold text-purple-800'>Role</th>
                  <th className='text-left p-3 font-semibold text-purple-800'>Verified</th>
                  <th className='text-left p-3 font-semibold text-purple-800'>Password</th>
                  <th className='text-left p-3 font-semibold text-purple-800'>Provider</th>
                  <th className='text-left p-3 font-semibold text-purple-800'>Sessions</th>
                  <th className='text-left p-3 font-semibold text-purple-800'>Created</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, index) => (
                  <tr key={u.id} className={`border-b ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-purple-50 transition-colors`}>
                    <td className='p-3 text-sm font-mono text-gray-700'>{u.id.substring(0, 8)}...</td>
                    <td className='p-3 font-medium text-gray-800'>{u.name}</td>
                    <td className='p-3 text-sm text-gray-700'>{u.email}</td>
                    <td className='p-3'>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        u.role === 'Admin' 
                          ? 'bg-purple-200 text-purple-800' 
                          : 'bg-blue-200 text-blue-800'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className='p-3'>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        u.emailVerified 
                          ? 'bg-green-200 text-green-800' 
                          : 'bg-red-200 text-red-800'
                      }`}>
                        {u.emailVerified ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className='p-3 text-xs font-mono text-gray-600'>
                      {u.accounts[0]?.password ? (
                        <span className='text-green-600' title={u.accounts[0].password}>✓ Set ({u.accounts[0].password.substring(0, 10)}...)</span>
                      ) : (
                        <span className='text-gray-400'>N/A</span>
                      )}
                    </td>
                    <td className='p-3 text-sm'>
                      {u.accounts[0]?.providerId || 'N/A'}
                    </td>
                    <td className='p-3 text-center'>
                      <span className='bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold'>
                        {u._count.sessions}
                      </span>
                    </td>
                    <td className='p-3 text-xs text-gray-600'>
                      {new Date(u.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && (
              <div className='text-center py-8 text-gray-500'>
                No users found
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminPage