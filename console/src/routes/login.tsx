import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { Login } from '../pages/Login'
import { account } from '../sdk';

export const Route = createFileRoute('/login')({
  loader: async () => {
    const user = await account.get();
    if (user) {
      throw redirect({
        to: '/',
      })
    }
  },
  
  component: () => <Login />
})

