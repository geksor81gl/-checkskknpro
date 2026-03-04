/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Search, 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  BarChart3, 
  BookOpen, 
  Wand2, 
  ChevronRight, 
  Download,
  Loader2,
  ShieldCheck,
  BrainCircuit,
  LayoutDashboard,
  MessageSquareText
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import Markdown from 'react-markdown';

import { analyzeTitle, analyzeFullDocument, autoFixContent, type SKKNAnalysis } from './services/geminiService';

// Setup PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [title, setTitle] = useState('');
  const [isAnalyzingTitle, setIsAnalyzingTitle] = useState(false);
  const [titleAnalysis, setTitleAnalysis] = useState<Partial<SKKNAnalysis> | null>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<SKKNAnalysis | null>(null);
  
  const [isFixing, setIsFixing] = useState(false);
  const [fixedContent, setFixedContent] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'review' | 'fix'>('dashboard');

  const [userApiKey, setUserApiKey] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('gemini_api_key') || '';
    }
    return '';
  });
  const [isApiKeySaved, setIsApiKeySaved] = useState(false);

  useEffect(() => {
    if (userApiKey) {
      setIsApiKeySaved(true);
    }
  }, []);

  const handleSaveApiKey = () => {
    const trimmedKey = userApiKey.trim();
    if (trimmedKey) {
      localStorage.setItem('gemini_api_key', trimmedKey);
      setUserApiKey(trimmedKey);
      setIsApiKeySaved(true);
      alert('Đã lưu API Key thành công!');
      setTimeout(() => setIsApiKeySaved(false), 3000);
    } else {
      alert('Vui lòng nhập mã API Key trước khi lưu.');
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    setIsProcessingFile(true);
    setAnalysisResult(null);
    setFixedContent(null);

    try {
      let text = '';
      if (selectedFile.type === 'application/pdf') {
        const arrayBuffer = await selectedFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          fullText += content.items.map((item: any) => item.str).join(' ') + '\n';
        }
        text = fullText;
      } else if (selectedFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const arrayBuffer = await selectedFile.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
      } else {
        text = await selectedFile.text();
      }

      const trimmedKey = userApiKey.trim();
      if (!trimmedKey && !process.env.GEMINI_API_KEY) {
        alert('Vui lòng nhập Gemini API Key ở góc trên bên phải để sử dụng tính năng này.');
        return;
      }

      const result = await analyzeFullDocument(text, trimmedKey);
      setAnalysisResult(result);
      setActiveTab('dashboard');
    } catch (error: any) {
      if (error.message === 'API_KEY_MISSING') {
        alert('Vui lòng nhập Gemini API Key ở góc trên bên phải để sử dụng tính năng này.');
      } else if (error.message === 'API_KEY_INVALID') {
        alert('Mã API Key không hợp lệ. Vui lòng kiểm tra lại mã bạn đã nhập.');
      } else {
        console.error('Error processing file:', error);
        alert('Có lỗi xảy ra khi xử lý tài liệu. Vui lòng thử lại.');
      }
    } finally {
      setIsProcessingFile(false);
    }
  }, [userApiKey]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt']
    },
    multiple: false
  });

  const handleTitleAnalysis = async () => {
    if (!title.trim()) return;
    const trimmedKey = userApiKey.trim();
    if (!trimmedKey && !process.env.GEMINI_API_KEY) {
      alert('Vui lòng nhập Gemini API Key ở góc trên bên phải để sử dụng tính năng này.');
      return;
    }

    setIsAnalyzingTitle(true);
    try {
      const result = await analyzeTitle(title, trimmedKey);
      setTitleAnalysis(result);
    } catch (error: any) {
      if (error.message === 'API_KEY_MISSING') {
        alert('Vui lòng nhập Gemini API Key ở góc trên bên phải để sử dụng tính năng này.');
      } else if (error.message === 'API_KEY_INVALID') {
        alert('Mã API Key không hợp lệ. Vui lòng kiểm tra lại mã bạn đã nhập.');
      } else {
        console.error('Title analysis error:', error);
      }
    } finally {
      setIsAnalyzingTitle(false);
    }
  };

  const handleAutoFix = async () => {
    if (!analysisResult) return;
    const trimmedKey = userApiKey.trim();
    if (!trimmedKey && !process.env.GEMINI_API_KEY) {
      alert('Vui lòng nhập Gemini API Key ở góc trên bên phải để sử dụng tính năng này.');
      return;
    }

    setIsFixing(true);
    try {
      const fixed = await autoFixContent(analysisResult.summary, trimmedKey);
      setFixedContent(fixed);
      setActiveTab('fix');
    } catch (error: any) {
      if (error.message === 'API_KEY_MISSING') {
        alert('Vui lòng nhập Gemini API Key ở góc trên bên phải để sử dụng tính năng này.');
      } else if (error.message === 'API_KEY_INVALID') {
        alert('Mã API Key không hợp lệ. Vui lòng kiểm tra lại mã bạn đã nhập.');
      } else {
        console.error('Auto fix error:', error);
      }
    } finally {
      setIsFixing(false);
    }
  };

  const radarData = analysisResult ? [
    { subject: 'Tính mới', A: (analysisResult.noveltyScore / 30) * 100, full: 100 },
    { subject: 'Khả thi', A: (analysisResult.feasibilityScore / 40) * 100, full: 100 },
    { subject: 'Khoa học', A: (analysisResult.scientificScore / 20) * 100, full: 100 },
    { subject: 'Hình thức', A: (analysisResult.formScore / 10) * 100, full: 100 },
    { subject: 'Tiêu đề', A: (analysisResult.titleScore / 10) * 100, full: 100 },
  ] : [];

  const totalScore = analysisResult ? 
    analysisResult.noveltyScore + 
    analysisResult.feasibilityScore + 
    analysisResult.scientificScore + 
    analysisResult.formScore : 0;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-slate-200/60 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-200/50 rotate-3 hover:rotate-0 transition-transform duration-300">
              <ShieldCheck className="text-white w-7 h-7" />
            </div>
            <div>
              <h1 className="font-display font-black text-2xl tracking-tight text-slate-900 leading-none">SKKN checker Pro</h1>
              <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mt-1.5">Tạo và phát triển bởi thầy Ksor Gé</p>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-6">
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">API:</span>
              <a 
                href="https://aistudio.google.com/app/api-keys" 
                target="_blank" 
                rel="noreferrer"
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors border-b border-indigo-200"
              >
                Lấy Key
              </a>
            </div>
            <div className="flex items-center gap-2 relative">
              <input 
                type="password"
                value={userApiKey}
                onChange={(e) => {
                  setUserApiKey(e.target.value);
                  setIsApiKeySaved(false);
                }}
                placeholder="Gemini API Key..."
                className={cn(
                  "w-32 sm:w-48 px-3 py-2 bg-slate-50 border rounded-xl text-xs focus:ring-2 outline-none transition-all",
                  userApiKey.trim().length >= 20 
                    ? "border-emerald-200 focus:ring-emerald-500" 
                    : "border-slate-200 focus:ring-indigo-500"
                )}
              />
              {userApiKey.trim().length >= 20 && (
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white shadow-sm" title="Key hợp lệ" />
              )}
              <button 
                onClick={handleSaveApiKey}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-sm",
                  isApiKeySaved 
                    ? "bg-emerald-500 text-white" 
                    : "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95"
                )}
              >
                {isApiKeySaved ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Đã lưu</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5 rotate-180" />
                    <span>Lưu Key</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 space-y-8">
        {/* Title Analysis Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Search className="w-5 h-5 text-indigo-600" />
            <h2 className="font-display font-bold text-lg text-slate-800">Phân tích Tên đề tài</h2>
          </div>
          <div className="glass-card p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nhập tên đề tài sáng kiến kinh nghiệm của bạn..."
                  className="w-full pl-4 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium"
                />
                <button 
                  onClick={handleTitleAnalysis}
                  disabled={isAnalyzingTitle || !title.trim()}
                  className="absolute right-2 top-2 bottom-2 bg-indigo-600 text-white px-4 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center"
                >
                  {isAnalyzingTitle ? <Loader2 className="w-5 h-5 animate-spin" /> : <ChevronRight className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {titleAnalysis && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-6 pt-6 border-t border-slate-100"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Điểm tiêu đề</span>
                        <span className="text-2xl font-display font-bold text-indigo-600">{titleAnalysis.titleScore}/10</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${(titleAnalysis.titleScore || 0) * 10}%` }}
                          className="h-full bg-indigo-600"
                        />
                      </div>
                      <p className="text-sm text-slate-600 italic">"{titleAnalysis.titleFeedback}"</p>
                    </div>
                    <div className="md:col-span-2 space-y-3">
                      <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Gợi ý tên thay thế</span>
                      <div className="grid grid-cols-1 gap-2">
                        {titleAnalysis.titleSuggestions?.map((suggestion, idx) => (
                          <div key={idx} className="flex items-start gap-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 group cursor-pointer hover:bg-indigo-50 transition-colors">
                            <div className="w-6 h-6 rounded-full bg-white border border-indigo-200 flex items-center justify-center text-xs font-bold text-indigo-600 shrink-0">
                              {idx + 1}
                            </div>
                            <p className="text-sm font-medium text-slate-700 group-hover:text-indigo-700 transition-colors">{suggestion}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* Document Upload Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Upload className="w-5 h-5 text-indigo-600" />
            <h2 className="font-display font-bold text-lg text-slate-800">Tải lên Tài liệu (PDF/Word)</h2>
          </div>
          
          {!analysisResult && !isProcessingFile ? (
            <div 
              {...getRootProps()} 
              className={cn(
                "border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center transition-all cursor-pointer",
                isDragActive ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50"
              )}
            >
              <input {...getInputProps()} />
              <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 text-indigo-600" />
              </div>
              <h3 className="font-display font-bold text-xl text-slate-800 mb-2">Kéo thả file vào đây</h3>
              <p className="text-slate-500 text-center max-w-sm">
                Hỗ trợ định dạng .pdf, .docx, .txt. Hệ thống sẽ tự động quét nội dung và thẩm định theo Thông tư 27.
              </p>
              <button className="mt-6 px-6 py-2.5 bg-slate-900 text-white rounded-full text-sm font-semibold hover:bg-slate-800 transition-all">
                Chọn file từ máy tính
              </button>
            </div>
          ) : isProcessingFile ? (
            <div className="glass-card p-12 flex flex-col items-center justify-center space-y-6">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                <BrainCircuit className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-indigo-600" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="font-display font-bold text-xl text-slate-800">Đang phân tích tài liệu...</h3>
                <p className="text-slate-500 animate-pulse">Quét nội dung • Kiểm tra đạo văn • Chấm điểm tiêu chí</p>
              </div>
            </div>
          ) : null}

          {/* Results Dashboard */}
          <AnimatePresence>
            {analysisResult && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Content */}
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="glass-card p-6 flex flex-col items-center justify-center text-center space-y-2">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tổng điểm</span>
                      <div className="text-4xl font-display font-black text-indigo-600">{totalScore}</div>
                      <span className="text-sm font-medium text-slate-500">Xếp loại: {totalScore >= 80 ? 'Xuất sắc' : totalScore >= 65 ? 'Khá' : 'Đạt'}</span>
                    </div>
                    <div className="glass-card p-6 flex flex-col items-center justify-center text-center space-y-2">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Đạo văn</span>
                      <div className={cn(
                        "text-4xl font-display font-black",
                        analysisResult.plagiarismPercent > 20 ? "text-rose-500" : "text-emerald-500"
                      )}>{analysisResult.plagiarismPercent}%</div>
                      <span className="text-sm font-medium text-slate-500">Nguy cơ: {analysisResult.plagiarismPercent > 20 ? 'Cao' : 'Thấp'}</span>
                    </div>
                    <div className="glass-card p-6 flex flex-col items-center justify-center text-center space-y-2">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nguy cơ AI</span>
                      <div className={cn(
                        "text-4xl font-display font-black",
                        analysisResult.aiPercent > 30 ? "text-amber-500" : "text-emerald-500"
                      )}>{analysisResult.aiPercent}%</div>
                      <span className="text-sm font-medium text-slate-500">Mức độ: {analysisResult.aiPercent > 30 ? 'Cần chỉnh sửa' : 'An toàn'}</span>
                    </div>
                    <div className="glass-card p-6 flex flex-col items-center justify-center text-center space-y-2">
                      <button 
                        onClick={handleAutoFix}
                        disabled={isFixing}
                        className="w-full h-full flex flex-col items-center justify-center gap-2 group"
                      >
                        <div className="w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-indigo-200">
                          {isFixing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Wand2 className="w-6 h-6" />}
                        </div>
                        <span className="text-sm font-bold text-slate-700">Kích hoạt Auto Fix</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Radar Chart */}
                    <div className="glass-card p-6 space-y-4">
                      <h3 className="font-display font-bold text-slate-800">Biểu đồ năng lực SKKN</h3>
                      <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                            <PolarGrid stroke="#e2e8f0" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                            <Radar
                              name="Điểm số"
                              dataKey="A"
                              stroke="#4f46e5"
                              fill="#4f46e5"
                              fillOpacity={0.2}
                            />
                            <Tooltip />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Summary Text */}
                    <div className="glass-card p-6 space-y-4">
                      <h3 className="font-display font-bold text-slate-800">Tóm tắt đánh giá</h3>
                      <div className="prose prose-slate max-w-none">
                        <p className="text-slate-600 leading-relaxed italic">
                          {analysisResult.summary}
                        </p>
                      </div>
                      <div className="pt-4 border-t border-slate-100">
                        <h4 className="text-sm font-bold text-slate-800 mb-3">Tài liệu tham khảo đề xuất:</h4>
                        <div className="space-y-2">
                          {analysisResult.references.map((ref, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm text-slate-600">
                              <BookOpen className="w-4 h-4 text-indigo-500 shrink-0" />
                              <span className="font-medium text-slate-800">{ref.title}</span>
                              <span className="text-xs text-slate-400">• {ref.reason}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Deep Review Section */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="glass-card p-6 space-y-4">
                      <div className="flex items-center gap-2 text-indigo-600">
                        <LayoutDashboard className="w-5 h-5" />
                        <h3 className="font-display font-bold">Cấu trúc & Bố cục</h3>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed">{analysisResult.deepReview.structure}</p>
                    </div>
                    <div className="glass-card p-6 space-y-4">
                      <div className="flex items-center gap-2 text-emerald-600">
                        <BrainCircuit className="w-5 h-5" />
                        <h3 className="font-display font-bold">Lý luận Sư phạm</h3>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed">{analysisResult.deepReview.pedagogy}</p>
                    </div>
                    <div className="glass-card p-6 space-y-4">
                      <div className="flex items-center gap-2 text-amber-600">
                        <BarChart3 className="w-5 h-5" />
                        <h3 className="font-display font-bold">Minh chứng & Số liệu</h3>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed">{analysisResult.deepReview.data}</p>
                    </div>
                  </div>

                  {/* Auto Fix Section (Conditional) */}
                  {fixedContent && (
                    <div className="glass-card overflow-hidden">
                      <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Wand2 className="w-5 h-5 text-indigo-400" />
                          <h3 className="text-white font-bold">Bản thảo đã tối ưu (Premium Edit)</h3>
                        </div>
                        <button className="flex items-center gap-2 px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-all">
                          <Download className="w-4 h-4" />
                          Xuất file .docx
                        </button>
                      </div>
                      <div className="p-8 bg-white min-h-[400px]">
                        <div className="markdown-body">
                          <Markdown>{fixedContent}</Markdown>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-12 px-6 mt-20">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <ShieldCheck className="text-white w-5 h-5" />
                </div>
                <h3 className="font-display font-bold text-lg">SKKN Checker Pro</h3>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">
                Giải pháp AI hàng đầu hỗ trợ giáo viên thẩm định và hoàn thiện Sáng kiến kinh nghiệm theo tiêu chuẩn Bộ Giáo dục.
              </p>
            </div>
            <div className="space-y-4">
              <h4 className="font-bold text-sm uppercase tracking-widest text-slate-400">Liên hệ</h4>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                    <BrainCircuit className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Tác giả: Thầy Ksor Gé</p>
                  </div>
                </div>
                <a 
                  href="https://zalo.me/0383752789" 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex items-center gap-3 p-3 bg-indigo-50 rounded-2xl border border-indigo-100 hover:bg-indigo-100 transition-colors group"
                >
                  <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                    <MessageSquareText className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-indigo-900">Zalo: 0383752789</p>
                    <p className="text-xs text-indigo-500">Hỗ trợ kỹ thuật & Tư vấn</p>
                  </div>
                </a>
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="font-bold text-sm uppercase tracking-widest text-slate-400">Pháp lý & Bảo mật</h4>
              <ul className="space-y-2">
                <li><button className="text-sm font-medium text-slate-600 hover:text-indigo-600">Điều khoản sử dụng</button></li>
                <li><button className="text-sm font-medium text-slate-600 hover:text-indigo-600">Chính sách bảo mật</button></li>
                <li><button className="text-sm font-medium text-slate-600 hover:text-indigo-600">Hướng dẫn Thông tư 27</button></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-slate-400">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-xs font-medium">Dữ liệu được mã hóa đầu cuối AES-256</span>
            </div>
            <p className="text-xs text-slate-500 font-medium">© 2026 SKKN Checker Pro. Phát triển bởi Thầy Ksor Gé.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
