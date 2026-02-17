import React, { useState, useMemo, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { KnowledgeArticle } from '../types';
import { Plus, Search, BookOpen, FileText, Upload, Trash2, Edit3, Tag, Sparkles, File, X } from 'lucide-react';
import { Card, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import { Input, Select, Textarea } from './ui/Form';
import { Modal } from './ui/Modal';
import { Badge } from './ui/Badge';
import { supabase } from '../lib/supabaseClient';

const CATEGORIES: { key: string; label: string; color: string }[] = [
  { key: 'all', label: 'הכל', color: '' },
  { key: 'strategy', label: 'אסטרטגיה', color: 'bg-purple-500/20 text-purple-300' },
  { key: 'marketing', label: 'שיווק', color: 'bg-blue-500/20 text-blue-300' },
  { key: 'design', label: 'עיצוב', color: 'bg-pink-500/20 text-pink-300' },
  { key: 'dev', label: 'פיתוח', color: 'bg-green-500/20 text-green-300' },
  { key: 'operations', label: 'תפעול', color: 'bg-yellow-500/20 text-yellow-300' },
  { key: 'finance', label: 'פיננסי', color: 'bg-emerald-500/20 text-emerald-300' },
  { key: 'general', label: 'כללי', color: 'bg-gray-500/20 text-gray-300' },
];

const getCategoryInfo = (key: string) => CATEGORIES.find(c => c.key === key) || CATEGORIES[CATEGORIES.length - 1];

const FILE_TYPE_ICONS: Record<string, string> = {
  'application/pdf': '📄',
  'image/jpeg': '🖼️',
  'image/png': '🖼️',
  'image/webp': '🖼️',
  'application/msword': '📝',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
};

const KnowledgeBase: React.FC = () => {
  const { knowledgeArticles, addKnowledgeArticle, updateKnowledgeArticle, deleteKnowledgeArticle, uploadKnowledgeFile, settings } = useData();
  const { user, displayName, isAdmin } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingArticle, setEditingArticle] = useState<KnowledgeArticle | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploadedFileType, setUploadedFileType] = useState('');

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formSummary, setFormSummary] = useState('');
  const [formCategory, setFormCategory] = useState('general');
  const [formTags, setFormTags] = useState('');

  const filteredArticles = useMemo(() => {
    let result = [...knowledgeArticles];
    if (activeCategory !== 'all') {
      result = result.filter(a => a.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.content.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [knowledgeArticles, activeCategory, searchQuery]);

  const resetForm = () => {
    setFormTitle('');
    setFormContent('');
    setFormSummary('');
    setFormCategory('general');
    setFormTags('');
    setUploadedFileUrl(null);
    setUploadedFileName('');
    setUploadedFileType('');
    setIsSummarizing(false);
    setIsUploading(false);
  };

  const openAdd = () => {
    resetForm();
    setEditingArticle(null);
    setShowAddModal(true);
  };

  const openEdit = (article: KnowledgeArticle) => {
    setFormTitle(article.title);
    setFormContent(article.content);
    setFormSummary(article.summary);
    setFormCategory(article.category);
    setFormTags(article.tags.join(', '));
    setUploadedFileUrl(article.fileUrl || null);
    setUploadedFileName(article.fileName || '');
    setUploadedFileType(article.fileType || '');
    setEditingArticle(article);
    setShowAddModal(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const url = await uploadKnowledgeFile(file);
      if (url) {
        setUploadedFileUrl(url);
        setUploadedFileName(file.name);
        setUploadedFileType(file.type);

        // Auto-fill title from filename
        if (!formTitle) {
          setFormTitle(file.name.replace(/\.[^.]+$/, ''));
        }

        // AI Summarize if Gemini key available
        if (settings.hasGeminiKey) {
          setIsSummarizing(true);
          try {
            const { data: fnData, error: fnError } = await supabase.functions.invoke('summarize-document', {
              body: { textContent: formContent || `קובץ: ${file.name}`, fileName: file.name },
            });

            if (!fnError && fnData?.success) {
              setFormSummary(fnData.summary || '');
              if (fnData.suggestedCategory) setFormCategory(fnData.suggestedCategory);
              if (fnData.suggestedTags?.length) setFormTags(fnData.suggestedTags.join(', '));
            }
          } catch {
            // AI summarization failed, user can fill manually
          } finally {
            setIsSummarizing(false);
          }
        }
      }
    } catch {
      // Upload failed
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSummarizeContent = async () => {
    if (!formContent.trim() || !settings.hasGeminiKey) return;
    setIsSummarizing(true);
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke('summarize-document', {
        body: { textContent: formContent, fileName: formTitle || 'article' },
      });

      if (!fnError && fnData?.success) {
        setFormSummary(fnData.summary || '');
        if (fnData.suggestedCategory) setFormCategory(fnData.suggestedCategory);
        if (fnData.suggestedTags?.length) setFormTags(fnData.suggestedTags.join(', '));
      }
    } catch {
      // Failed
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleSave = async () => {
    if (!formTitle.trim() || !user) return;

    const tags = formTags.split(',').map(t => t.trim()).filter(Boolean);

    if (editingArticle) {
      await updateKnowledgeArticle({
        ...editingArticle,
        title: formTitle.trim(),
        content: formContent,
        summary: formSummary,
        category: formCategory,
        tags,
        fileUrl: uploadedFileUrl || undefined,
        fileName: uploadedFileName || undefined,
        fileType: uploadedFileType || undefined,
        updatedAt: new Date().toISOString(),
      });
    } else {
      await addKnowledgeArticle({
        title: formTitle.trim(),
        content: formContent,
        summary: formSummary,
        category: formCategory,
        tags,
        fileUrl: uploadedFileUrl || undefined,
        fileName: uploadedFileName || undefined,
        fileType: uploadedFileType || undefined,
        isAiGenerated: false,
        createdBy: user.id,
        createdByName: displayName,
      });
    }

    setShowAddModal(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    await deleteKnowledgeArticle(id);
    setDeleteConfirm(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <BookOpen size={28} className="text-primary" />
            מאגר ידע
          </h2>
          <p className="text-gray-400 mt-1">{knowledgeArticles.length} מאמרים</p>
        </div>
        <Button onClick={openAdd} icon={<Plus size={16} />}>מאמר חדש</Button>
      </div>

      {/* Search + Category Tabs */}
      <div className="space-y-4">
        <div className="relative max-w-md">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="חיפוש מאמרים..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pr-10 pl-4 py-2.5 bg-surface border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-primary/50"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeCategory === cat.key
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'bg-white/5 text-gray-400 border border-white/5 hover:border-white/10 hover:text-gray-300'
              }`}
            >
              {cat.label}
              {cat.key !== 'all' && (
                <span className="mr-1 text-gray-500">
                  ({knowledgeArticles.filter(a => a.category === cat.key).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Articles Grid */}
      {filteredArticles.length === 0 ? (
        <Card className="text-center py-16">
          <BookOpen size={48} className="mx-auto text-gray-600 mb-4" />
          <h3 className="text-gray-400 text-lg font-bold mb-2">
            {searchQuery ? 'לא נמצאו תוצאות' : 'מאגר הידע ריק'}
          </h3>
          <p className="text-gray-500 text-sm mb-4">
            {searchQuery ? 'נסה חיפוש אחר' : 'הוסף מאמר ראשון עם תוכן או העלאת מסמך'}
          </p>
          {!searchQuery && (
            <Button onClick={openAdd} icon={<Plus size={16} />} variant="ghost">הוסף מאמר</Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredArticles.map(article => {
            const catInfo = getCategoryInfo(article.category);
            return (
              <Card
                key={article.id}
                className="group hover:border-white/10 transition-all cursor-pointer"
                onClick={() => openEdit(article)}
              >
                <div className="space-y-3">
                  {/* Top row: category + file icon */}
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${catInfo.color}`}>
                      {catInfo.label}
                    </span>
                    <div className="flex items-center gap-2">
                      {article.fileUrl && (
                        <span className="text-sm" title={article.fileName}>
                          {FILE_TYPE_ICONS[article.fileType || ''] || '📎'}
                        </span>
                      )}
                      {article.isAiGenerated && (
                        <Sparkles size={12} className="text-primary" />
                      )}
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-white font-bold text-sm leading-tight line-clamp-2">
                    {article.title}
                  </h3>

                  {/* Summary */}
                  {article.summary && (
                    <p className="text-gray-400 text-xs leading-relaxed line-clamp-3">
                      {article.summary}
                    </p>
                  )}

                  {/* Tags */}
                  {article.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {article.tags.slice(0, 4).map((tag, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 bg-white/5 rounded text-gray-500">
                          {tag}
                        </span>
                      ))}
                      {article.tags.length > 4 && (
                        <span className="text-[10px] text-gray-600">+{article.tags.length - 4}</span>
                      )}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <span className="text-[10px] text-gray-600">
                      {article.createdByName} · {new Date(article.createdAt).toLocaleDateString('he-IL')}
                    </span>
                    {isAdmin && (
                      <button
                        onClick={e => { e.stopPropagation(); setDeleteConfirm(article.id); }}
                        className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); resetForm(); }}
        title={editingArticle ? 'עריכת מאמר' : 'מאמר חדש'}
        size="lg"
      >
        <div className="space-y-4">
          {/* File Upload */}
          <div className="p-4 border border-dashed border-white/10 rounded-xl bg-white/[0.02] space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.webp"
              onChange={handleFileUpload}
              className="hidden"
            />
            {uploadedFileUrl ? (
              <div className="flex items-center gap-3">
                <File size={20} className="text-primary" />
                <span className="text-sm text-white flex-1 truncate">{uploadedFileName}</span>
                <button
                  onClick={() => { setUploadedFileUrl(null); setUploadedFileName(''); setUploadedFileType(''); }}
                  className="text-gray-500 hover:text-red-400"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full flex flex-col items-center gap-2 py-4 text-gray-400 hover:text-primary transition-colors"
              >
                <Upload size={24} />
                <span className="text-sm">
                  {isUploading ? 'מעלה...' : 'העלה מסמך (PDF, Word, תמונה)'}
                </span>
              </button>
            )}
            {isSummarizing && (
              <div className="flex items-center gap-2 text-xs text-primary">
                <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                AI מסכם את המסמך...
              </div>
            )}
          </div>

          <Input
            label="כותרת"
            value={formTitle}
            onChange={e => setFormTitle(e.target.value)}
            placeholder="שם המאמר"
            required
          />

          <Textarea
            label="תוכן"
            value={formContent}
            onChange={e => setFormContent(e.target.value)}
            placeholder="תוכן המאמר..."
            rows={6}
          />

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Textarea
                label="סיכום"
                value={formSummary}
                onChange={e => setFormSummary(e.target.value)}
                placeholder="סיכום קצר..."
                rows={2}
              />
            </div>
            {settings.hasGeminiKey && formContent.trim() && (
              <Button
                onClick={handleSummarizeContent}
                disabled={isSummarizing}
                variant="ghost"
                icon={<Sparkles size={14} />}
                className="mb-0.5"
              >
                {isSummarizing ? 'מסכם...' : 'סכם AI'}
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="קטגוריה"
              value={formCategory}
              onChange={e => setFormCategory(e.target.value)}
            >
              {CATEGORIES.filter(c => c.key !== 'all').map(c => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </Select>

            <Input
              label="תגיות (מופרד בפסיקים)"
              value={formTags}
              onChange={e => setFormTags(e.target.value)}
              placeholder="SEO, תוכן, פרסום"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave} disabled={!formTitle.trim()}>
              {editingArticle ? 'שמור שינויים' : 'צור מאמר'}
            </Button>
            <Button variant="ghost" onClick={() => { setShowAddModal(false); resetForm(); }}>ביטול</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="מחיקת מאמר"
      >
        <p className="text-gray-300 mb-6">האם אתה בטוח שברצונך למחוק מאמר זה?</p>
        <div className="flex gap-3">
          <Button onClick={() => deleteConfirm && handleDelete(deleteConfirm)} variant="ghost" className="!bg-red-500/10 !text-red-400 hover:!bg-red-500/20">
            מחק
          </Button>
          <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>ביטול</Button>
        </div>
      </Modal>
    </div>
  );
};

export default KnowledgeBase;
