"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import { ExternalLink, Phone, MapPin } from 'lucide-react';
import { ModalPortal } from '@/components/ui/modal-portal';

export function Footer() {
  const [activeModal, setActiveModal] = useState<string | null>(null);

  return (
    <footer className="relative mt-auto w-full border-t border-slate-800/30 bg-slate-950/30 pt-16 pb-12 text-base text-slate-300 backdrop-blur-md md:pb-16">
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

        <section
          aria-label="Developer credit"
          className="mt-8 flex flex-col items-center gap-5 border-t border-border/60 pt-6 text-center sm:flex-row sm:justify-between sm:text-left"
        >
          <div className="min-w-0 space-y-1.5">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              System Architecture &amp; Developer
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 sm:justify-start">
              <span className="text-sm font-semibold text-foreground">
                MD. Jahidul Hasan Jisan
              </span>
              <span className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
                ID: 251035042
              </span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Department of Artificial Intelligence &amp; Data Science
            </p>
          </div>

          <nav aria-label="Developer social links" className="flex shrink-0 items-center gap-2">
            <a
              href="https://github.com/blithejisan"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub profile of MD. Jahidul Hasan Jisan (opens in a new tab)"
              className="rounded-full border border-border bg-muted/50 p-2.5 text-foreground shadow-sm transition-colors duration-200 hover:border-accent/70 hover:bg-accent/15 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="size-5">
                <path d="M12 .75a11.25 11.25 0 0 0-3.56 21.92c.56.1.77-.24.77-.54v-2.1c-3.14.68-3.8-1.33-3.8-1.33-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 .1.9 2.38 3.2 1.75.1-.72.4-1.2.72-1.47-2.5-.28-5.13-1.25-5.13-5.56 0-1.23.44-2.23 1.16-3.02-.12-.28-.5-1.43.11-2.98 0 0 .95-.3 3.1 1.15a10.8 10.8 0 0 1 5.64 0c2.15-1.45 3.1-1.15 3.1-1.15.62 1.55.23 2.7.11 2.98.72.79 1.16 1.79 1.16 3.02 0 4.32-2.63 5.27-5.14 5.55.4.35.76 1.03.76 2.08v3.08c0 .3.2.65.78.54A11.25 11.25 0 0 0 12 .75Z" />
              </svg>
            </a>
            <a
              href="https://www.linkedin.com/in/jahidul-hasan-jisan/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn profile of MD. Jahidul Hasan Jisan (opens in a new tab)"
              className="rounded-full border border-border bg-muted/50 p-2.5 text-foreground shadow-sm transition-colors duration-200 hover:border-accent/70 hover:bg-accent/15 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="size-5">
                <path d="M20.45 2H3.55C2.69 2 2 2.68 2 3.52v16.96c0 .84.69 1.52 1.55 1.52h16.9c.86 0 1.55-.68 1.55-1.52V3.52c0-.84-.69-1.52-1.55-1.52ZM7.93 18.34H4.96V9.5h2.97v8.84ZM6.44 8.3a1.72 1.72 0 1 1 0-3.44 1.72 1.72 0 0 1 0 3.44Zm11.9 10.04h-2.96v-4.3c0-1.03-.02-2.35-1.43-2.35-1.43 0-1.65 1.12-1.65 2.28v4.37H9.34V9.5h2.84v1.21h.04c.4-.7 1.36-1.43 2.8-1.43 3 0 3.56 1.97 3.56 4.53v4.53Z" />
              </svg>
            </a>
          </nav>
        </section>

        {/* Copyright & Functional Links */}
        <div className="mt-6 flex flex-col items-center justify-between gap-4 border-t border-border/60 pt-6 text-center text-xs text-slate-400 sm:flex-row sm:text-left">
          <p>© {new Date().getFullYear()} Department of AI & Data Science, GUB. All rights reserved.</p>

          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 font-bold sm:justify-end">
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
        <ModalPortal labelledBy="footer-modal-title">
          <div className="relative z-50 w-full max-w-lg space-y-5 rounded-xl border border-slate-800 bg-slate-900/95 p-6 text-slate-100 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <h3 id="footer-modal-title" className="text-xl font-bold text-primary capitalize">
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
        </ModalPortal>
      )}
    </footer>
  );
}