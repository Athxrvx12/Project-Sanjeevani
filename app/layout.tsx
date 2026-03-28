import './globals.css';
import Footer from './components/Footer';
import { ThemeProvider } from './components/ThemeProvider';
import { Toaster } from 'react-hot-toast'; // <-- 1. Import Toaster

// 2. THIS IS YOUR NEW SEO / SOCIAL PREVIEW DATA
export const metadata = {
  title: 'Sanjeevani | Critical Medicine in Seconds',
  description: 'Bridging the gap between critical patients and life-saving medicine through real-time geospatial intelligence and AI.',
  openGraph: {
    title: 'Sanjeevani - AI Pharmacy Locator',
    description: 'Find verified medical inventory and ping nearby pharmacists in real-time.',
    type: 'website',
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-slate-50 dark:bg-[#020617] text-slate-900 dark:text-slate-50 transition-colors duration-300 min-h-screen flex flex-col">
        <ThemeProvider>
          
          {/* 3. Add the Toaster here so it works across the whole app */}
          <Toaster 
            position="bottom-center"
            toastOptions={{
              className: 'dark:bg-slate-800 dark:text-white border dark:border-slate-700',
              duration: 4000,
            }} 
          />

          <main className="flex-grow">
            {children}
          </main>
          
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}