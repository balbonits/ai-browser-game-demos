import { Outlet } from 'react-router';
import Header from '@/components/site/Header';
import Footer from '@/components/site/Footer';

export default function SiteLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-grow">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
