'use client';

import Link from 'next/link';
import { Twitter, Github, Linkedin, Mail } from 'lucide-react';

export default function Footer() {
  const preventScroll = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
  };

  return (
    <footer className="w-full bg-[#0a111a] border-t border-slate-800/50 py-16 px-6 relative z-10">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-12 md:gap-8">
        
        {/* Brand Column */}
        <div className="md:col-span-6 space-y-6">
          <h2 className="text-3xl font-bold text-[#0ea5e9] tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
            Sanjeevani
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
            Bridging the gap between critical patients and life-saving medicine through real-time geospatial intelligence and AI.
          </p>
          <div className="flex items-center gap-5 text-slate-400">
            <a href="#" onClick={preventScroll} className="hover:text-sky-400 transition-colors"><Twitter size={20} /></a>
            <a href="#" onClick={preventScroll} className="hover:text-sky-400 transition-colors"><Github size={20} /></a>
            <a href="#" onClick={preventScroll} className="hover:text-sky-400 transition-colors"><Linkedin size={20} /></a>
          </div>
        </div>

        {/* Platform Column */}
        <div className="md:col-span-3 space-y-6">
          <h3 className="text-white font-bold text-lg">Platform</h3>
          <ul className="space-y-4 text-sm text-slate-400">
            <li><a href="#" onClick={preventScroll} className="hover:text-sky-400 transition-colors">How it Works</a></li>
            <li><Link href="/pharmacist" className="hover:text-sky-400 transition-colors">For Pharmacists</Link></li>
            <li><a href="#" onClick={preventScroll} className="hover:text-sky-400 transition-colors">API Documentation</a></li>
            <li><a href="#" onClick={preventScroll} className="hover:text-sky-400 transition-colors">Partner Network</a></li>
          </ul>
        </div>

        {/* Company Column */}
        <div className="md:col-span-3 space-y-6">
          <h3 className="text-white font-bold text-lg">Company</h3>
          <ul className="space-y-4 text-sm text-slate-400">
            <li><a href="#" onClick={preventScroll} className="hover:text-sky-400 transition-colors">Privacy Policy</a></li>
            <li><a href="#" onClick={preventScroll} className="hover:text-sky-400 transition-colors">Terms of Service</a></li>
            <li>
              <a href="#" onClick={preventScroll} className="hover:text-sky-400 transition-colors flex items-center gap-2">
                <Mail size={16} /> Contact Us
              </a>
            </li>
          </ul>
        </div>

      </div>
    </footer>
  );
}