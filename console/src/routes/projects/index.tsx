import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { sdk } from '../../sdk';

export const Route = createFileRoute('/projects/')({
  
  component: () => 
    <>
  <div className="p-2 flex gap-2">
    <Link to="/" className="[&.active]:font-bold">
      Home
    </Link>{' '}
    <Link to="/projects/project/list" className="[&.active]:font-bold">
      Projects
    </Link>
  </div>
  <hr />
  <Outlet />
</>
})