import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { Login } from '../pages/Login'
import { account } from '../sdk';

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    const router = useRouter();
    try {
        const result = await account.get();
        router.navigate({ to: '/' });

    } catch (error) {
     
    }
},
  component: () => <Login />
})

