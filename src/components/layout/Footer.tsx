"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import { ExternalLink, Phone, MapPin } from 'lucide-react';

export function Footer() {
  const [activeModal, setActiveModal] = useState<string | null>(null);

  return (
    <footer className="w-full bg-slate-950 border-t border-slate-800 text-slate-300 text-base py-16 mt-auto relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 relative z-10">
        
        {/* Original 3-Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 pb-12 border-b border-slate-800/80">
          
          {/* Column 1: Brand & Overview */}
          <div className="space-y-4">
            <div className="flex items-center space-x-3.5">
              <div data-brand-logo-surface className="relative size-11 shrink-0 overflow-hidden rounded-lg border border-white/15 bg-white p-1.5">
                <Image
                  src="/ads-logo.png"
                  alt="ADS Logo"
                  fill
                  sizes="44px"
                  className="object-contain"
                />
              </div>
              <div>
                <h3 className="text-base font-semibold leading-snug text-foreground">
                  Mentor & Student Management Platform
                </h3>
                <p className="text-xs text-blue-400 font-bold">Green University of Bangladesh</p>
              </div>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-slate-300">
              An integrated academic platform for monitoring student progress, managing mentorship sessions, and organizing batch workflows in the Department of AI & Data Science.
            </p>
          </div>

          {/* Column 2: Contact Us */}
          {/* Contact Us */}
<div className="space-y-4">
  <h4 className="text-sm font-extrabold text-slate-200 uppercase tracking-wider">
    CONTACT US
  </h4>
  <div className="space-y-3 text-sm text-slate-300">
    <p className="flex items-start space-x-2">
      <Phone className="w-4 h-4 text-emerald-400 shrink-0 mt-1" />
      <span className="font-bold">
        <strong className="font-extrabold text-foreground">Phone:</strong> +88001324-713504
      </span>
    </p>
    <p className="flex items-start space-x-2 leading-relaxed">
      <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-1" />
      <span className="font-bold">
        <strong className="font-extrabold text-foreground">Address:</strong> Purbachal American City, Kanchan, Rupganj, Narayanganj, Dhaka, 1461
      </span>
    </p>
  </div>
</div>

          {/* Column 3: Department Info with Hyperlink */}
          <div className="space-y-4">
            <h4 className="text-sm font-extrabold text-slate-200 uppercase tracking-wider">
              Department Info
            </h4>
           <div className="text-sm leading-relaxed space-y-1">
  <a
    href="https://ads.green.edu.bd/"
    target="_blank"
    rel="noopener noreferrer"
    className="text-slate-300 hover:text-emerald-400 font-bold transition-colors inline-flex items-center gap-1 hover:underline"
  >
    <span>Department of Artificial Intelligence & Data Science</span>
    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
  </a>
  <br />
  <a
    href="https://green.edu.bd/"
    target="_blank"
    rel="noopener noreferrer"
    className="text-slate-200 hover:text-emerald-400 font-bold transition-colors inline-flex items-center gap-1 hover:underline"
  >
    <span>Green University of Bangladesh</span>
    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
  </a>
</div>
          </div>

        </div>

        {/* Copyright & Functional Links */}
        <div className="pt-8 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-400 gap-4">
          <p>© {new Date().getFullYear()} Department of AI & Data Science, GUB. All rights reserved.</p>
          
          <div className="flex space-x-6 font-bold">
            <button
              onClick={() => setActiveModal('privacy')}
              className="hover:text-blue-400 transition-colors cursor-pointer underline-offset-4 hover:underline"
            >
              Privacy Policy
            </button>
            <button
              onClick={() => setActiveModal('terms')}
              className="hover:text-blue-400 transition-colors cursor-pointer underline-offset-4 hover:underline"
            >
              Terms of Service
            </button>
            <button
              onClick={() => setActiveModal('support')}
              className="hover:text-blue-400 transition-colors cursor-pointer underline-offset-4 hover:underline"
            >
              Support
            </button>
          </div>
        </div>
      </div>

      {/* Modal Popup */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="max-w-lg w-full space-y-5 rounded-3xl border border-border bg-card p-8 text-card-foreground shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <h3 className="text-xl font-bold text-primary capitalize">
                {activeModal === 'privacy' && '🔒 Privacy Policy'}
                {activeModal === 'terms' && '📜 Terms of Service'}
                {activeModal === 'support' && '💬 Support'}
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-white text-2xl font-bold p-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="text-sm text-slate-300 leading-relaxed space-y-3 max-h-64 overflow-y-auto pr-2">
              {activeModal === 'privacy' && (
                <p>
                  The Mentor Management System protects user data according to university guidelines. Student records, attendance metrics, and mentor feedback are restricted strictly to authorized faculty members.
                </p>
              )}
              {activeModal === 'terms' && (
                <p>
                  By accessing this system, students and faculty agree to maintain academic integrity, submit accurate records, and respect department communication protocols.
                </p>
              )}
              {activeModal === 'support' && (
                <div className="space-y-2">
                  <p>For technical support or inquiries, please contact:</p>
                  <p className="font-bold text-blue-300">📧 support.ads@green.edu.bd</p>
                  <p className="font-bold text-blue-300">🏢 Department of AI & Data Science, GUB</p>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setActiveModal(null)}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all shadow-md"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}