import type { RouteObject } from 'react-router';
import Home from '@/routes/Home';
import SiteLayout from '@/layouts/SiteLayout';

export const routes: RouteObject[] = [
  { path: '/', element: <Home /> },
];

export const routeTree: RouteObject[] = [
  { element: <SiteLayout />, children: routes },
];
