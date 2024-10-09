import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react';
import { Login } from '../pages/Login';

export const Route = createFileRoute('/login')({
  component: () => <Login />
})

