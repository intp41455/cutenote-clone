export default function PricingPage() {
  return (
    <section className="py-12 sm:py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-center text-slate-900 mb-12">
          选择适合你的套餐
        </h1>

        <div className="grid gap-8 md:grid-cols-2 max-w-4xl mx-auto">
          {/* Free Plan */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">免费版</h2>
            <p className="text-slate-500 mb-6">体验核心功能</p>
            <div className="text-4xl font-bold text-slate-900 mb-6">
              ¥0<span className="text-lg font-normal text-slate-500">/月</span>
            </div>
            <ul className="space-y-3 mb-8 text-sm text-slate-600">
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>每月 100 分钟额度</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>单条链接音视频最长 30 分钟</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>粘贴文本最长 5 万字</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>单次批量提交 5 条</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>AI 问答 30 次/月</span>
              </li>
            </ul>
            <button className="w-full py-3 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors">
              立即开始
            </button>
          </div>

          {/* Pro Plan */}
          <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl p-6 sm:p-8 text-white relative overflow-hidden">
            <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs">
              推荐
            </div>
            <h2 className="text-2xl font-bold mb-2">专业</h2>
            <p className="text-blue-100 mb-6">长播客、长课程、成体量的资料。</p>
            <div className="text-4xl font-bold mb-2">
              ¥29<span className="text-lg font-normal text-blue-100">/月</span>
            </div>
            <p className="text-xs text-blue-100 mb-6">
              购买专业版一次性支付 · 不自动续费，到期可再次购买
            </p>
            <ul className="space-y-3 mb-8 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-white mt-0.5">✓</span>
                <span>每月 2,000 分钟额度</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-white mt-0.5">✓</span>
                <span>单条链接音视频最长 600 分钟</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-white mt-0.5">✓</span>
                <span>粘贴文本最长 20 万字</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-white mt-0.5">✓</span>
                <span>单次批量提交 30 条 · 优先处理队列</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-white mt-0.5">✓</span>
                <span>免费生成其他格式，不重新转写</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-white mt-0.5">✓</span>
                <span>AI 问答 500 次/月</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-white mt-0.5">✓</span>
                <span>笔记永久保留</span>
              </li>
            </ul>
            <button className="w-full py-3 rounded-xl bg-white text-blue-600 font-medium hover:bg-blue-50 transition-colors">
              立即升级
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}