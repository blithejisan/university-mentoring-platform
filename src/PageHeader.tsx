import React from "react";

interface PageHeaderProps {
  title: string;
  subtitle: string;
  actionText?: string;
  onActionClick?: () => void;
}

export function PageHeader({ title, subtitle, actionText, onActionClick }: PageHeaderProps) {
  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-700/60 mb-8 relative overflow-hidden">
      {/* Glow Effect */}
      <div className="absolute right-0 top-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold mb-2">
            <span>✨ GUB Academic System</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            {title}
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-300 mt-1 max-w-xl">
            {subtitle}
          </p>
        </div>

        {actionText && (
          <div className="flex items-center space-x-3 shrink-0">
            <button 
              onClick={onActionClick}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/30 transition-all active:scale-95"
            >
              {actionText}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}