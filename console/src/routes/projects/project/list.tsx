import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/projects/project/list')({
  component: () => <div>Hello /projects/projects!</div>
})