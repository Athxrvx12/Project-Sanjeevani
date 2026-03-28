'use client';

import { Github, Twitter, Linkedin, Mail, Heart } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="w-full bg-white dark:bg-[#0B1120] border-t border-slate-200 dark:border-slate-800/50 transition-colors duration-300 relative z-10">
      <div className="max-w-7xl mx-auto px-6 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8">
          
          {/* Brand Column */}
          <div className="md:col-span-2">
            <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-sky-500 to-emerald-400 mb-4 tracking-tight">
              Sanjeevani
            </h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm max-w-sm leading-relaxed mb-6">
              Bridging the gap between critical patients and life-saving medicine through real-time geospatial intelligence and AI.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-slate-400 hover:text-sky-500 transition-colors"><Twitter size={20} /></a>
              <a href="#" className="text-slate-400 hover:text-sky-500 transition-colors"><Github size={20} /></a>
              <a href="#" className="text-slate-400 hover:text-sky-500 transition-colors"><Linkedin size={20} /></a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold text-slate-900 dark:text-white mb-4">Platform</h4>
            <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
              <li><a href="#" className="hover:text-sky-500 transition-colors">How it Works</a></li>
              <li><a href="#" className="hover:text-sky-500 transition-colors">For Pharmacists</a></li>
              <li><a href="#" className="hover:text-sky-500 transition-colors">API Documentation</a></li>
              <li><a href="#" className="hover:text-sky-500 transition-colors">Partner Network</a></li>
            </ul>
          </div>

          {/* Legal & Contact */}
          <div>
            <h4 className="font-semibold text-slate-900 dark:text-white mb-4">Company</h4>
            <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
              <li><a href="#" className="hover:text-sky-500 transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-sky-500 transition-colors">Terms of Service</a></li>
              <li><a href="#" className="hover:text-sky-500 transition-colors flex items-center gap-2"><Mail size={16}/> Contact Us</a></li>
            </ul>
          </div>

        </div>
        
        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800/50 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            &copy; {new Date().getFullYear()} Project Sanjeevani. All rights reserved.
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
            Built with <Heart size={14} className="text-rose-500" /> for global health.
          </p>
        </div>
      </div>
    </footer>
  );
}