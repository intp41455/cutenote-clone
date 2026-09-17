import { useState, useRef } from 'react';
import { startGeneration, type OutputFormat } from '../lib/api';

interface HeroProps {
  onNoteCreated: (id: string) => void;
}

type InputMode = 'link' | 'doc' | 'media';

export default function Hero({ onNoteCreated }: HeroProps) {
  const [input, setInput] = useState('');
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('image');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [inputMode, setInputMode] = useState<InputMode>('link');
  const [recording, setRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isUrl = input.trim().startsWith('http://') || input.trim().startsWith('https://');
  const hasText = input.trim().length > 0 && !isUrl;

  const handleGenerate = async () => {
    if (!input.trim() || processing || recording) return;
    setProcessing(true);
    setProgress(0);
    setError('');
    try {
      const note = await startGeneration(input.trim(), outputFormat, setProgress);
      onNoteCreated(note.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '生成失败，请稍后重试');
    } finally {
      setProcessing(false);
    }
  };

  const handleRecording = async () => {
    if (processing) return;
    setRecording(true);
    await new Promise((r) => setTimeout(r, 3000));
    setRecording(false);
    setInput('录音总结内容');
    setOutputFormat('image');
    // Auto-generate after recording
    setProcessing(true);
    setProgress(0);
    setError('');
    try {
      const note = await startGeneration('录音总结内容', 'image', setProgress);
      onNoteCreated(note.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '生成失败，请稍后重试');
    } finally {
      setProcessing(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setInput(file.name);
      setInputMode('doc');
    }
  };

  return (
    <section className="py-12 sm:py-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* 标题 */}
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center text-slate-900 leading-tight">
          视频、文章、文件，<br className="sm:hidden" />
          一键变成<span className="text-orange-500">高颜值长图或脑图</span>
        </h1>

        <p className="mt-5 text-center text-slate-500 text-sm sm:text-base leading-relaxed">
          视频平台链接 · 网页文章 · 文件直链 · PDF/Word/PPT/TXT/MD · 图片/音频/视频
        </p>

        {/* 输入卡片 */}
        <div className="mt-8 bg-white rounded-2xl border border-orange-100 shadow-sm overflow-hidden">
          {/* 三张输入卡片 */}
          <div className="grid grid-cols-3 gap-2 p-4 sm:p-5 border-b border-orange-50">
            <button
              onClick={() => { setInputMode('link'); setInput(''); }}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-xl text-sm transition-all ${
                inputMode === 'link'
                  ? 'bg-orange-50 text-orange-600 font-medium border border-orange-200'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 border border-transparent'
              }`}
            >
              <span className="text-xl">🔗</span>
              <span>链接</span>
            </button>
            <button
              onClick={() => { setInputMode('doc'); setInput(''); }}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-xl text-sm transition-all ${
                inputMode === 'doc'
                  ? 'bg-orange-50 text-orange-600 font-medium border border-orange-200'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 border border-transparent'
              }`}
            >
              <span className="text-xl">📄</span>
              <span>文档</span>
            </button>
            <button
              onClick={() => { setInputMode('media'); setInput(''); }}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-xl text-sm transition-all ${
                inputMode === 'media'
                  ? 'bg-orange-50 text-orange-600 font-medium border border-orange-200'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 border border-transparent'
              }`}
            >
              <span className="text-xl">🎬</span>
              <span>媒体</span>
            </button>
          </div>

          {/* 文本输入区 */}
          <div className="p-4 sm:p-5">
            <div className="relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate();
                }}
                placeholder={
                  inputMode === 'link'
                    ? '粘贴链接或正文内容…'
                    : inputMode === 'doc'
                      ? '粘贴文档内容或上传文件…'
                      : '粘贴媒体链接或上传文件…'
                }
                className="w-full min-h-[120px] px-4 py-3 bg-orange-50/50 border border-orange-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent placeholder-slate-400 resize-y"
              />
              {/* 自动识别标签 */}
              {input.trim() && !processing && (
                <div className="absolute bottom-3 right-3">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                    {isUrl ? '检测到链接' : hasText ? '自动识别链接或正文' : '输入中…'}
                  </span>
                </div>
              )}
            </div>

            {/* 录音和上传按钮 */}
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handleRecording}
                disabled={processing || recording}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  recording
                    ? 'bg-red-500 text-white'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <span className={`w-2 h-2 rounded-full ${recording ? 'bg-white recording-pulse' : 'bg-red-500'}` } />
                {recording ? '录制中…' : '🎤 录音总结'}
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={processing || recording}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>+</span>
                <span>上传文件</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="hidden"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.jpg,.jpeg,.png,.mp3,.mp4,.wav"
              />
            </div>
          </div>

          {/* 进度条 */}
          {processing && (
            <div className="px-4 sm:px-5 pb-2">
              <div className="h-1.5 bg-orange-50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-400 to-rose-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                正在转写并生成笔记… {progress}%
              </p>
            </div>
          )}

          {error && !processing && !recording && (
            <p className="px-4 sm:px-5 pb-2 text-xs text-red-600">{error}</p>
          )}

          {/* 格式选择 + 提交 */}
          <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:justify-between">
            <div className="flex items-center gap-1 text-sm bg-orange-50/50 rounded-lg p-1 border border-orange-100">
              {(
                [
                  ['image', '长图笔记'],
                  ['mindmap', '思维导图'],
                  ['markdown', 'Markdown'],
                ] as [OutputFormat, string][]
              ).map(([fmt, label]) => (
                <button
                  key={fmt}
                  onClick={() => setOutputFormat(fmt)}
                  className={`px-3 py-1.5 rounded-md transition-all ${
                    outputFormat === fmt
                      ? 'bg-white text-orange-600 font-medium shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {label}
                  {outputFormat === fmt && <span className="ml-1 text-orange-400">✓</span>}
                </button>
              ))}
            </div>

            <button
              onClick={handleGenerate}
              disabled={!input.trim() || processing || recording}
              className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-orange-500 to-rose-500 text-white text-sm font-medium hover:from-orange-600 hover:to-rose-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              {processing ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  生成中 {progress}%
                </>
              ) : (
                <>生成笔记 →</>
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
