export default function AISkillPage() {
  return (
    <section className="py-12 sm:py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-center text-slate-900 mb-6">
          AI Skill
        </h1>
        <p className="text-center text-slate-600 mb-12 max-w-2xl mx-auto">
          利用 AI 技术，将任何内容转化为高颜值的视觉笔记。
          支持视频、文章、文件等多种输入格式，一键生成长图、思维导图或 Markdown。
        </p>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-2xl mb-4">
              🎥
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">视频转笔记</h3>
            <p className="text-slate-600 text-sm">
              粘贴 B站、YouTube 等平台视频链接，AI 自动识别并生成高颜值长图笔记。
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center text-2xl mb-4">
              📄
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">文档转笔记</h3>
            <p className="text-slate-600 text-sm">
              支持 PDF、Word、PPT、TXT、MD 等格式，一键转换为视觉笔记。
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-2xl mb-4">
              🎵
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">音频转笔记</h3>
            <p className="text-slate-600 text-sm">
              上传音频文件，AI 自动转写并总结，生成结构化笔记。
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center text-2xl mb-4">
              📝
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">思维导图</h3>
            <p className="text-slate-600 text-sm">
              将复杂内容自动转化为清晰的思维导图，便于理解和记忆。
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}