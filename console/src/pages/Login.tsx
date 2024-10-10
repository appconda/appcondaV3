import { useState } from "react";
import { Client, Account } from "@appconda/console-sdk";
import { useRouter } from "@tanstack/react-router";

const client = new Client()
    .setEndpoint('http://localhost/v1') // Your API Endpoint
    .setProject('console');

const account = new Account(client);

export const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const router = useRouter();

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        // Simple validation
        if (!email || !password) {
            setErrorMessage("Please fill in both fields.");
            return;
        }

        try {
            await account.createEmailPasswordSession('mert@example.com', 'AAA123bbb');
            router.navigate({ to: '/profile' });

        } catch (error) {
            setErrorMessage("An error occurred. Please try again.");
        }
    };

    return (
        <div className='container'>
            <h2>Login</h2>
            {errorMessage && <p className={'error'}>{errorMessage}</p>}
            <form onSubmit={handleSubmit} className="form">
                <div>
                    <label>Email:</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="input"
                        required
                    />
                </div>
                <div>
                    <label>Password:</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="input"
                        required
                    />
                </div>
                <button type="submit" className="button">Login</button>
            </form>
        </div>
    );
};


