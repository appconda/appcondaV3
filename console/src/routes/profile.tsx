import { createFileRoute, redirect } from '@tanstack/react-router'
import { Client, Account } from "@appconda/console-sdk";

const client = new Client()
	.setEndpoint('http://appconda/v1') // Your API Endpoint
	.setProject('console');

const account = new Account(client);


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