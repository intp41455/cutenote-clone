import type { Route } from '../lib/router';

interface HeaderProps {
  route: Route;
  onNavigate: (route: Route) => void;
}

export default function Header({ route, onNavigate }: HeaderProps) {
  const isActive = (page: string) => route.page === page;

  const navItems: { page: 'ai-skill' | 'explore' | 'my-notes' | 'pricing'; label: string }[] = [
    { page: 'ai-skill', label: 'AI Skill' },
    { page: 'explore', label: '公开笔记' },
    { page: 'my-notes', label: '我的笔记' },
    { page: 'pricing', label: '价格' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#FFF8F0]/95 backdrop-blur-sm border-b border-amber-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => onNavigate({ page: 'home' })}
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center text-white font-bold text-sm shadow-sm">
              C
            </div>
            <span className="font-semibold text-lg text-stone-900">
              CuteNote<span className="text-stone-500 font-normal ml-1">颜值笔记</span>
            </span>
          </div>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <button
                key={item.page}
                onClick={() => onNavigate({ page: item.page })}
                className={`text-sm transition-colors ${
                  isActive(item.page)
                    ? 'text-orange-600 font-medium'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {item.label}
              </button>
            ))}

            <div className="flex items-center text-sm text-stone-500">
              <button className="px-1 text-stone-900 font-medium">中</button>
              <span className="text-stone-300">/</span>
              <button className="px-1 hover:text-stone-700">EN</button>
            </div>

            <button
              onClick={() => onNavigate({ page: 'new-note' })}
              className="text-sm px-4 py-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-rose-500 text-white hover:opacity-90 transition-opacity shadow-sm"
            >
              + 新建笔记
            </button>
          </nav>

          {/* 移动端 */}
          <button
            onClick={() => onNavigate({ page: 'new-note' })}
            className="md:hidden text-sm px-3 py-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-rose-500 text-white"
          >
            + 新建
          </button>
        </div>
      </div>
    </header>
  );
}
