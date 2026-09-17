import type { Route } from '../lib/router';

interface FooterProps {
  onNavigate: (route: Route) => void;
}

export default function Footer({ onNavigate }: FooterProps) {
  return (
    <footer className="py-8 border-t border-amber-100 bg-[#FFF8F0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center text-white font-bold text-xs shadow-sm">
              C
            </div>
            <span className="text-sm font-medium text-stone-600">CuteNote 颜值笔记</span>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-sm">
            <button
              onClick={() => onNavigate({ page: 'home' })}
              className="text-stone-600 hover:text-orange-600 transition-colors"
            >
              首页
            </button>
            <button
              onClick={() => onNavigate({ page: 'explore' })}
              className="text-stone-600 hover:text-orange-600 transition-colors"
            >
              公开笔记
            </button>
            <button
              onClick={() => onNavigate({ page: 'my-notes' })}
              className="text-stone-600 hover:text-orange-600 transition-colors"
            >
              我的笔记
            </button>
            <button
              onClick={() => onNavigate({ page: 'new-note' })}
              className="text-stone-600 hover:text-orange-600 transition-colors"
            >
              新建笔记
            </button>
            <button
              onClick={() => onNavigate({ page: 'pricing' })}
              className="text-stone-600 hover:text-orange-600 transition-colors"
            >
              价格
            </button>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-stone-400">
          © 2026 CuteNote. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
