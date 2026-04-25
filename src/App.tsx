import { BrowserRouter, useRoutes } from 'react-router';
import { routeTree } from '@/router';

function AppRoutes() {
  return useRoutes(routeTree);
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
