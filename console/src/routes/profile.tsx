import { createFileRoute, redirect } from '@tanstack/react-router'
import { account } from '../sdk';




export const Route = createFileRoute('/profile')({
    beforeLoad: async () => {
        try {
            const result = await account.get();
            console.log(result);

        } catch (error) {
           throw redirect({ to: '/login' });
        }
    },
  component: () => <div>Hello /profile!</div>
})