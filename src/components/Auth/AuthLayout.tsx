import { useState } from 'react'
import Login from './Login'
import Signup from './Signup'

const AuthLayout = () => {
  const [view, setView] = useState<'login' | 'signup'>('login')

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-md">
        {view === 'login' ? (
          <Login switchView={() => setView('signup')} />
        ) : (
          <Signup switchView={() => setView('login')} />
        )}
      </div>
    </div>
  )
}

export default AuthLayout
