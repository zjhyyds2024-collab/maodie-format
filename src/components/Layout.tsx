import type { ReactNode } from 'react';
import Navbar from './Navbar';
import Toasts from './Toasts';
export default function Layout({children}:{children:ReactNode}) {
  return <div className="app-layout"><Navbar/><main className="min-w-0 flex-1 overflow-auto">{children}</main><Toasts/></div>;
}
