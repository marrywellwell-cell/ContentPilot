import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import YouTubeUploadDialog from "@/components/YouTubeUploadDialog";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Loader2, Youtube, BookOpen, Download, Copy, Check,
  Sparkles, Trash2, FileText, ChevronDown, ChevronUp,
  Save, RefreshCw, Image as ImageIcon, Play, Bot, Filter, Calendar,
  Instagram, Hash,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { ScriptureContent, SavedYoutubeChannel } from "@shared/schema";

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface GeneratedContent {
  videoTitle: string;
  videoSummary: string;
  summary: string[];
  coreMessage: string;
  bibleVerse: string;
  bibleReference: string;
  verseContent: string;
  verseReference: string;
  instagramSlides: string[];
  instagramSlideImages?: string[];
  instagramCaption: string;
  instagramHashtags: string[];
  imageUrls: string[];
  imageUrl: string;
  imageBase64?: string;
  imagePrompt?: string;
  caption: string;
  hashtags: string[];
  blogTitle: string;
  blogContent: string;
  blogMetaDescription: string;
}

interface BlogContent {
  title: string;
  content: string;
  titles: string[];
  thumbnailTexts: string[];
  imageRecommendations: { description: string; altText: string }[];
  internalLinkTopics: string[];
  hashtags: string[];
  images: string[];
}

// DB에 저장된 기존 HTML 콘텐츠도 순수 텍스트로 변환
function htmlToPlainText(html: string): string {
  if (!html) return html;
  if (!/<[a-z][\s\S]*>/i.test(html)) return html;
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<h[1-6][^>]*>/gi, "")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<li[^>]*>/gi, "\n")
    .replace(/<\/li>/gi, "")
    .replace(/<\/(ul|ol)>/gi, "\n")
    .replace(/<(ul|ol)[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type ViewState = "input" | "loading" | "results";

interface LoadingStep {
  label: string;
  status: "pending" | "loading" | "complete";
}

const initialSteps: LoadingStep[] = [
  { label: "자막 추출 중", status: "pending" },
  { label: "영상 요약 생성", status: "pending" },
  { label: "말씀 추천 중", status: "pending" },
  { label: "이미지 생성 중", status: "pending" },
  { label: "인스타 문구 작성", status: "pending" },
];

// ─── 로딩 상태 컴포넌트 ──────────────────────────────────────────────────────

function LoadingState({ steps }: { steps: LoadingStep[] }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-8">
      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
        <Sparkles className="w-8 h-8 text-primary animate-pulse" />
      </div>
      <div className="text-center space-y-2">
        <h3 className="text-xl font-semibold">콘텐츠 생성 중...</h3>
        <p className="text-muted-foreground">AI가 영상을 분석하고 말씀을 추천합니다</p>
      </div>
      <div className="w-full max-w-sm space-y-3">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
              step.status === "complete" ? "bg-green-500" :
              step.status === "loading" ? "bg-primary animate-pulse" :
              "bg-muted"
            }`}>
              {step.status === "complete" ? (
                <Check className="w-3 h-3 text-white" />
              ) : step.status === "loading" ? (
                <Loader2 className="w-3 h-3 text-white animate-spin" />
              ) : (
                <div className="w-2 h-2 bg-muted-foreground/30 rounded-full" />
              )}
            </div>
            <span className={`text-sm ${
              step.status === "complete" ? "text-foreground" :
              step.status === "loading" ? "text-primary font-medium" :
              "text-muted-foreground"
            }`}>{step.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 요약 카드 ────────────────────────────────────────────────────────────────

function SummaryCard({ summary, coreMessage }: { summary: string[]; coreMessage: string }) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-xl">
          <FileText className="w-5 h-5 text-primary" />
          영상 요약 / Video Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          {summary.filter(Boolean).map((line, i) => (
            <p key={i} className="text-foreground leading-relaxed">{line}</p>
          ))}
        </div>
        {coreMessage && (
          <div className="border-t pt-6">
            <h4 className="text-sm font-medium text-muted-foreground mb-3">핵심 메시지 / Core Message</h4>
            <div className="bg-accent/50 rounded-lg p-4">
              <p className="text-xl font-medium text-foreground">{coreMessage}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── 말씀 카드 ────────────────────────────────────────────────────────────────

function BibleVerseCard({ reference, verse }: { reference: string; verse: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(`${reference}\n"${verse}"`);
    setCopied(true);
    toast({ title: "복사 완료!", description: "말씀이 클립보드에 복사되었습니다." });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-xl">
          <BookOpen className="w-5 h-5 text-primary" />
          추천 말씀 / Recommended Scripture
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{reference}</p>
        <blockquote className="border-l-4 border-primary pl-6 py-2">
          <p className="text-lg font-serif italic text-foreground leading-relaxed">"{verse}"</p>
        </blockquote>
        <Button variant="outline" className="w-full gap-2" onClick={handleCopy}>
          {copied ? <><Check className="w-4 h-4" />복사됨!</> : <><Copy className="w-4 h-4" />말씀 복사하기</>}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── 이미지 프리뷰 카드 ───────────────────────────────────────────────────────

function ImagePreviewCard({ imageUrl, prompt }: { imageUrl: string; prompt?: string }) {
  const [isPromptOpen, setIsPromptOpen] = useState(false);

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = `scripture-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-xl">
          <ImageIcon className="w-5 h-5 text-primary" />
          생성된 이미지 / Generated Image
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-center">
          <div className="relative w-full max-w-md aspect-square rounded-lg overflow-hidden bg-muted">
            <img src={imageUrl} alt="Generated scripture image" className="w-full h-full object-cover" />
          </div>
        </div>
        <Button onClick={handleDownload} className="w-full gap-2">
          <Download className="w-4 h-4" />이미지 다운로드
        </Button>
        {prompt && (
          <Collapsible open={isPromptOpen} onOpenChange={setIsPromptOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between">
                <span className="text-sm text-muted-foreground">이미지 프롬프트 보기</span>
                {isPromptOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="bg-muted rounded-lg p-4 mt-2">
                <p className="text-sm font-mono text-muted-foreground">{prompt}</p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}

// ─── 인스타그램 캡션 카드 ─────────────────────────────────────────────────────

function InstagramCaptionCard({ caption, hashtags }: { caption: string; hashtags: string[] }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const fullText = `${caption}\n\n${hashtags.join(" ")}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    toast({ title: "복사 완료!", description: "인스타그램 문구가 클립보드에 복사되었습니다." });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Youtube className="w-5 h-5 text-primary" />
          인스타그램 문구 / Instagram Caption
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted rounded-lg p-4 space-y-4">
          <p className="text-foreground whitespace-pre-wrap leading-relaxed">{caption}</p>
          <div className="flex flex-wrap gap-2">
            {hashtags.map((tag, i) => (
              <span key={i} className="text-primary text-sm font-medium">
                {tag.startsWith("#") ? tag : `#${tag}`}
              </span>
            ))}
          </div>
        </div>
        <Button variant="outline" className="w-full gap-2" onClick={handleCopy}>
          {copied ? <><Check className="w-4 h-4" />복사됨!</> : <><Copy className="w-4 h-4" />문구 복사하기</>}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── 블로그 결과 카드 ─────────────────────────────────────────────────────────

function BlogResultCard({ blog }: { blog: BlogContent }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const { toast } = useToast();

  const copy = async () => {
    await navigator.clipboard.writeText(htmlToPlainText(blog.content));
    setCopied(true);
    toast({ title: "복사 완료!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const publishToTistory = async () => {
    setPublishing(true);
    try {
      const res = await apiRequest("/api/publish-tistory-blog", {
        method: "POST",
        body: JSON.stringify({
          title: blog.title,
          content: blog.html || blog.content,
          hashtags: blog.hashtags || [],
          category: "wisdom lab",
        }),
      }) as any;
      if (res.success) {
        toast({ title: "티스토리 발행 완료!", description: res.postUrl ? `게시물: ${res.postUrl}` : undefined });
      } else {
        toast({ title: "발행 실패", description: res.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "발행 실패", description: e.message, variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl">{blog.title}</CardTitle>
            <div className="flex flex-wrap gap-2 mt-2">
              {blog.titles?.slice(0, 2).map((t, i) => (
                <Badge key={i} variant="outline" className="text-xs">{t}</Badge>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="bg-orange-500 hover:bg-orange-600 text-white gap-1"
              onClick={async () => {
                const txt = [blog.title, "", htmlToPlainText(blog.content), "", blog.hashtags?.map(t => t.startsWith("#") ? t : `#${t}`).join(" ")].filter(Boolean).join("\n");
                await navigator.clipboard.writeText(txt);
                window.open("https://inloglab.tistory.com/manage/newpost/", "_blank");
                toast({ title: "복사 완료!", description: "티스토리 에디터에 붙여넣기 하세요." });
              }}
            >
              <span className="font-bold">T</span> 티스토리
            </Button>
            <Button variant="outline" size="sm" onClick={copy}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`text-sm leading-7 whitespace-pre-wrap break-words bg-white dark:bg-zinc-900 rounded-lg p-4 border select-text font-sans ${expanded ? "" : "max-h-48 overflow-hidden"}`}>
          {htmlToPlainText(blog.content)}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)} className="w-full">
          {expanded ? <><ChevronUp className="w-4 h-4 mr-1" />접기</> : <><ChevronDown className="w-4 h-4 mr-1" />더 보기</>}
        </Button>
        {blog.images?.length > 0 && (
          <div className="grid grid-cols-3 gap-2 pt-2 border-t">
            {blog.images.map((img, i) => (
              <div key={i} className="aspect-square rounded-lg overflow-hidden bg-muted">
                <img src={img} alt={`블로그 이미지 ${i + 1}`} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1 pt-2 border-t">
          {blog.hashtags?.map((tag, i) => (
            <Badge key={i} variant="secondary" className="text-xs">
              {tag.startsWith("#") ? tag : `#${tag}`}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 결과 화면 ────────────────────────────────────────────────────────────────

function ResultsDisplay({
  results, onRegenerate, onSave, isSaving, isSaved, savedContentId, onYouTubeUpload,
  blog, onBlogGenerate, isBlogGenerating,
}: {
  results: GeneratedContent;
  onRegenerate: () => void;
  onSave: () => void;
  isSaving: boolean;
  isSaved: boolean;
  savedContentId?: string;
  onYouTubeUpload?: () => void;
  blog: BlogContent | null;
  onBlogGenerate: () => void;
  isBlogGenerating: boolean;
}) {
  const { toast } = useToast();

  const ref = results.verseReference || results.bibleReference || "";
  const verse = results.verseContent || results.bibleVerse || "";
  const imageUrl = results.imageBase64 || results.imageUrl || results.imageUrls?.[0] || "";
  const caption = results.caption || results.instagramCaption || "";
  const hashtags = results.hashtags?.length ? results.hashtags : (results.instagramHashtags || []);

  return (
    <div className="space-y-6">
      {/* 액션 버튼 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Button variant="outline" onClick={onRegenerate} className="gap-2">
          <RefreshCw className="w-4 h-4" />새로 만들기
        </Button>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            className="gap-2 text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-950"
            onClick={() => onYouTubeUpload?.()}
          >
            <Youtube className="w-4 h-4" />YouTube 발행
          </Button>
          <Button onClick={onSave} disabled={isSaving || isSaved} className="gap-2">
            {isSaved ? <><Check className="w-4 h-4" />저장됨</> : isSaving ? <><Loader2 className="w-4 h-4 animate-spin" />저장 중</> : <><Save className="w-4 h-4" />저장하기</>}
          </Button>
        </div>
      </div>

      {/* 요약 + 말씀 */}
      <div className="grid md:grid-cols-2 gap-6">
        {results.summary?.filter(Boolean).length > 0 && (
          <SummaryCard summary={results.summary} coreMessage={results.coreMessage} />
        )}
        {ref && <BibleVerseCard reference={ref} verse={verse} />}
      </div>

      {/* ── 인스타그램 섹션 ── */}
      <div className="border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border-b">
          <div className="flex items-center gap-2">
            <Instagram className="w-5 h-5 text-pink-500" />
            <span className="font-semibold text-sm">인스타그램 콘텐츠</span>
          </div>
        </div>
        <div className="p-4 space-y-4">
          {/* 슬라이드 이미지 */}
          {results.instagramSlideImages && results.instagramSlideImages.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">슬라이드 ({results.instagramSlideImages.length}장)</p>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                {results.instagramSlideImages.map((img, i) => (
                  <div key={i} className="aspect-square rounded-lg overflow-hidden shadow-sm cursor-pointer"
                    onClick={() => { const a = document.createElement("a"); a.href = img; a.download = `slide-${i + 1}.png`; a.click(); }}>
                    <img src={img} alt={`슬라이드 ${i + 1}`} className="w-full h-full object-cover hover:opacity-90 transition-opacity" />
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">슬라이드를 클릭하면 다운로드됩니다</p>
            </div>
          ) : imageUrl ? (
            <ImagePreviewCard imageUrl={imageUrl} prompt={results.imagePrompt} />
          ) : null}
          {/* 캡션 */}
          <div className="grid md:grid-cols-2 gap-4">
            {caption && <InstagramCaptionCard caption={caption} hashtags={hashtags} />}
          </div>
          {!imageUrl && !results.instagramSlideImages?.length && !caption && (
            <p className="text-sm text-muted-foreground text-center py-4">인스타그램 콘텐츠가 없습니다.</p>
          )}
        </div>
      </div>

      {/* ── 블로그 섹션 ── */}
      <div className="border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-b">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-500" />
            <span className="font-semibold text-sm">블로그 콘텐츠</span>
          </div>
          {!blog && (
            <Button
              size="sm"
              onClick={onBlogGenerate}
              disabled={isBlogGenerating}
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isBlogGenerating
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />생성 중...</>
                : <><Sparkles className="w-3.5 h-3.5" />블로그 생성하기</>
              }
            </Button>
          )}
        </div>
        <div className="p-4">
          {isBlogGenerating && (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">AI가 블로그 글을 작성하고 이미지를 생성 중입니다...</span>
            </div>
          )}
          {blog && <BlogResultCard blog={blog} />}
          {!blog && !isBlogGenerating && (
            <div className="text-center py-8">
              <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">블로그 콘텐츠를 생성하려면 위 버튼을 클릭하세요.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 저장된 콘텐츠 목록 ───────────────────────────────────────────────────────

// 말씀 플레이스홀더 썸네일 (이미지 없을 때)
function ScriptureThumbnail({ imageUrl, reference }: { imageUrl?: string; reference: string }) {
  const [error, setError] = useState(false);

  if (imageUrl && !error) {
    return (
      <img
        src={imageUrl}
        alt={reference}
        className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
        onError={() => setError(true)}
      />
    );
  }

  // 말씀 구절 플레이스홀더
  const book = reference.split(" ")[0] || "말씀";
  const colors = [
    "from-purple-600 to-indigo-600",
    "from-blue-600 to-cyan-600",
    "from-green-600 to-teal-600",
    "from-orange-500 to-amber-600",
    "from-rose-500 to-pink-600",
  ];
  const colorIdx = book.charCodeAt(0) % colors.length;

  return (
    <div className={`w-20 h-20 rounded-lg flex-shrink-0 bg-gradient-to-br ${colors[colorIdx]} flex flex-col items-center justify-center p-1`}>
      <BookOpen className="w-5 h-5 text-white/80 mb-1" />
      <p className="text-white text-[9px] font-bold text-center leading-tight line-clamp-2">{book}</p>
    </div>
  );
}

function SavedList({
  items, isLoading, onDelete, onSelect, filterChannel, onFilterChange, channels,
}: {
  items: ScriptureContent[];
  isLoading: boolean;
  onDelete: (id: string) => void;
  onSelect: (item: ScriptureContent) => void;
  filterChannel: string;
  onFilterChange: (v: string) => void;
  channels: { channelName: string; count: number }[];
}) {
  if (isLoading) return (
    <div className="flex justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* 채널 필터 */}
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <Select value={filterChannel} onValueChange={onFilterChange}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="전체 채널" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 채널 ({items.length}개)</SelectItem>
            {channels.map((ch) => (
              <SelectItem key={ch.channelName} value={ch.channelName}>
                {ch.channelName} ({ch.count}개)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filterChannel !== "all" && (
          <span className="text-sm text-muted-foreground">{items.length}개</span>
        )}
      </div>

      {!items.length && (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>저장된 콘텐츠가 없습니다.</p>
        </div>
      )}

    <div className="grid gap-4 md:grid-cols-2">
      {items.map((item) => (
        <Card key={item.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onSelect(item)}>
          <CardContent className="p-4">
            <div className="flex gap-3">
              <ScriptureThumbnail
                imageUrl={item.imageUrls?.[0]}
                reference={item.bibleReference || "말씀"}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-sm truncate">{item.bibleReference}</p>
                  {item.createdAt && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 flex-shrink-0">
                      <Calendar className="w-2.5 h-2.5" />
                      {new Date(item.createdAt).toLocaleDateString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit" })}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{item.bibleVerse}</p>
                {item.videoTitle && <p className="text-xs text-muted-foreground mt-1 truncate">{item.videoTitle}</p>}
              </div>
              <div className="flex flex-col gap-1 flex-shrink-0">
                {item.blogContent && (
                  <Button
                    size="sm"
                    className="h-7 px-2 bg-orange-500 hover:bg-orange-600 text-white text-xs"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const txt = [item.blogTitle, "", htmlToPlainText(item.blogContent || "")].filter(Boolean).join("\n");
                      await navigator.clipboard.writeText(txt);
                      window.open("https://inloglab.tistory.com/manage/newpost/", "_blank");
                    }}
                  >
                    <span className="font-bold">T</span>
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
    </div>
  );
}

// ─── 저장된 콘텐츠 상세 다이얼로그 ──────────────────────────────────────────────

function ContentDetailDialog({
  item, open, onOpenChange, onDelete, onImageGenerated,
}: {
  item: ScriptureContent | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDelete: (id: string) => void;
  onImageGenerated?: (id: string, imageUrls: string[], imageBase64: string | null) => void;
}) {
  const { toast } = useToast();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [localImageUrl, setLocalImageUrl] = useState<string | undefined>();
  const [localImageBase64, setLocalImageBase64] = useState<string | null>(null);
  const [localSlideImages, setLocalSlideImages] = useState<string[]>([]);
  const [localBlogImages, setLocalBlogImages] = useState<string[]>([]);
  const [imageLoadError, setImageLoadError] = useState(false);

  const generateImageMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest(`/api/scripture-contents/${id}/generate-image`, { method: "POST" }) as any;
      return res as { imageUrls: string[]; imageBase64: string | null; instagramSlideImages?: string[] };
    },
    onSuccess: (data) => {
      const displayUrl = data.imageBase64 || data.imageUrls?.[0] || "";
      setLocalImageUrl(displayUrl || undefined);
      setLocalImageBase64(data.imageBase64);
      if (data.instagramSlideImages?.length) setLocalSlideImages(data.instagramSlideImages);
      toast({ title: "이미지 생성 완료!" });
      if (item) onImageGenerated?.(item.id, data.imageUrls, data.imageBase64);
    },
    onError: (e: Error) => toast({ title: "이미지 생성 실패", description: e.message, variant: "destructive" }),
  });

  const generateBlogImagesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/youtube-scripture/blog-images", {
        method: "POST",
        body: JSON.stringify({
          verseReference: item?.bibleReference || "",
          verseContent: item?.bibleVerse || "",
          coreMessage: item?.videoSummary || "",
        }),
      }) as any;
      return res;
    },
    onSuccess: (data: any) => {
      if (data.images?.length) setLocalBlogImages(data.images);
      toast({ title: `블로그 이미지 ${data.images?.length || 0}장 생성 완료!` });
    },
    onError: () => toast({ title: "이미지 생성 실패", variant: "destructive" }),
  });

  const handleOpenChange = (v: boolean) => {
    if (!v) { setLocalImageUrl(undefined); setLocalImageBase64(null); setLocalSlideImages([]); setLocalBlogImages([]); setImageLoadError(false); }
    onOpenChange(v);
  };

  const handleDownload = (url: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = `scripture-${item?.bibleReference?.replace(/\s/g, "-") || Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!item) return null;

  const copy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast({ title: "복사 완료!" });
    setTimeout(() => setCopiedField(null), 2000);
  };

  const imageUrl = localImageUrl ?? (localImageBase64 || item.imageUrls?.[0]);
  const hashtags = item.instagramHashtags || [];
  const caption = item.instagramCaption || "";
  const slides = item.instagramSlides || [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="w-5 h-5 text-primary" />
            {item.bibleReference}
          </DialogTitle>
          {item.createdAt && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <Calendar className="w-3 h-3" />
              {new Date(item.createdAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
              {(item as any).channelName && (
                <span className="ml-2 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[10px]">
                  {(item as any).channelName}
                </span>
              )}
            </p>
          )}
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <div className="px-6 pb-6 space-y-5 mt-4">

            {/* 이미지 */}
            {imageUrl && !imageLoadError ? (
              <div className="space-y-2">
                <div className="flex justify-center">
                  <div className="relative w-full max-w-xs aspect-square rounded-xl overflow-hidden bg-muted shadow-md">
                    <img
                      src={imageUrl}
                      alt={item.bibleReference}
                      className="w-full h-full object-cover"
                      onError={() => setImageLoadError(true)}
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-center">
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleDownload(imageUrl)}>
                    <Download className="w-3.5 h-3.5" />이미지 다운로드
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-indigo-600 border-indigo-300"
                    onClick={() => generateImageMutation.mutate(item.id)}
                    disabled={generateImageMutation.isPending}
                  >
                    {generateImageMutation.isPending
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />생성 중...</>
                      : <><RefreshCw className="w-3.5 h-3.5" />재생성</>
                    }
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-center">
                <div className="w-full max-w-xs aspect-square rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-950/40 dark:to-purple-950/40 border-2 border-dashed border-indigo-200 dark:border-indigo-800 flex flex-col items-center justify-center gap-3">
                  <ImageIcon className="w-10 h-10 text-indigo-300" />
                  <p className="text-sm text-muted-foreground">이미지가 없습니다</p>
                  <Button
                    size="sm"
                    onClick={() => { setImageLoadError(false); generateImageMutation.mutate(item.id); }}
                    disabled={generateImageMutation.isPending}
                    className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    {generateImageMutation.isPending
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />생성 중...</>
                      : <><Sparkles className="w-3.5 h-3.5" />이미지 생성하기</>
                    }
                  </Button>
                </div>
              </div>
            )}

            {/* 성경 말씀 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-primary" />성경 말씀
                </h3>
                <Button size="sm" variant="ghost" className="h-7 px-2"
                  onClick={() => copy(`${item.bibleReference}\n"${item.bibleVerse}"`, "verse")}>
                  {copiedField === "verse" ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
              </div>
              <div className="bg-primary/5 rounded-lg p-4 border border-primary/10">
                <p className="text-xs text-primary font-medium mb-2">{item.bibleReference}</p>
                <p className="text-sm italic leading-relaxed">"{item.bibleVerse}"</p>
              </div>
            </div>

            <Separator />

            {/* 영상 제목 */}
            {item.videoTitle && (
              <div className="space-y-1">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <Youtube className="w-4 h-4 text-red-500" />영상
                </h3>
                <p className="text-sm text-muted-foreground">{item.videoTitle}</p>
                {item.videoSummary && (
                  <p className="text-xs text-muted-foreground line-clamp-3 mt-1">{item.videoSummary}</p>
                )}
              </div>
            )}

            {/* 슬라이드 */}
            {slides.length > 0 && (() => {
              // 재생성 후 localSlideImages 우선, 그 다음 DB 썸네일(imageUrls[1..])
              const dbSlideImages = (item.imageUrls || []).slice(1);
              const slideImages = localSlideImages.length > 0 ? localSlideImages : dbSlideImages;
              const hasSlideImages = slideImages.length > 0;
              return (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <Instagram className="w-4 h-4 text-pink-500" />슬라이드 ({slides.length}장)
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {slides.map((slide, i) => {
                      const slideImg = slideImages[i];
                      return (
                        <div
                          key={i}
                          className="aspect-square rounded-lg overflow-hidden relative cursor-pointer"
                          onClick={() => { if (slideImg) { const a = document.createElement("a"); a.href = slideImg; a.download = `slide-${i + 1}.jpg`; a.click(); } }}
                        >
                          {slideImg ? (
                            // 캔버스로 생성된 이미지 직접 표시 — 오버레이 없음
                            <img src={slideImg} alt={slide} className="w-full h-full object-cover hover:opacity-90 transition-opacity" />
                          ) : (
                            // 이미지 없을 때 파스텔 그라데이션 + 텍스트
                            <div className="absolute inset-0 flex items-center justify-center p-2 bg-gradient-to-br from-purple-100 to-indigo-200">
                              <p className="text-[10px] font-bold text-center leading-tight text-indigo-800">{slide}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {hasSlideImages && <p className="text-xs text-muted-foreground">슬라이드를 클릭하면 다운로드됩니다</p>}
                </div>
              );
            })()}

            {/* 캡션 */}
            {caption && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <Instagram className="w-4 h-4 text-pink-500" />인스타그램 캡션
                  </h3>
                  <Button size="sm" variant="ghost" className="h-7 px-2"
                    onClick={() => copy(`${caption}\n\n${hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' ')}`, "caption")}>
                    {copiedField === "caption" ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>
                <div className="bg-muted rounded-lg p-3 space-y-3">
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{caption}</p>
                  {hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-2 border-t">
                      {hashtags.map((tag, i) => (
                        <span key={i} className="text-primary text-xs font-medium">
                          {tag.startsWith("#") ? tag : `#${tag}`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 해시태그만 있는 경우 */}
            {!caption && hashtags.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <Hash className="w-4 h-4 text-primary" />해시태그
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {hashtags.map((tag, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {tag.startsWith("#") ? tag : `#${tag}`}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* 블로그 */}
            {item.blogContent && (
              <>
                <Separator />
                <div className="space-y-3">
                  {/* 헤더 + 빠른 발행 버튼 */}
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <h3 className="text-sm font-semibold flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-blue-500" />블로그 내용
                    </h3>
                    <div className="flex gap-1 flex-wrap">
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1"
                        onClick={() => {
                          const txt = [
                            item.blogTitle, "",
                            htmlToPlainText(item.blogContent || ""), "",
                            (item.instagramHashtags || []).map(t => t.startsWith("#") ? t : `#${t}`).join(" "),
                          ].filter(Boolean).join("\n");
                          copy(txt, "blog");
                        }}>
                        {copiedField === "blog"
                          ? <Check className="w-3 h-3 text-green-500" />
                          : <Copy className="w-3 h-3" />}
                        전체 복사
                      </Button>
                      <Button size="sm"
                        className="h-7 px-2 bg-green-600 hover:bg-green-700 text-white text-xs"
                        onClick={async () => {
                          const txt = [item.blogTitle, "", htmlToPlainText(item.blogContent || "")].filter(Boolean).join("\n");
                          await navigator.clipboard.writeText(txt);
                          window.open("https://blog.naver.com/my.blog?Redirect=Write", "_blank");
                        }}>
                        N 네이버
                      </Button>
                      <Button size="sm"
                        className="h-7 px-2 bg-orange-500 hover:bg-orange-600 text-white text-xs"
                        onClick={async () => {
                          await navigator.clipboard.writeText(item.blogContent || "");
                          window.open("https://inloglab.tistory.com/manage/newpost/", "_blank");
                        }}>
                        T 티스토리
                      </Button>
                    </div>
                  </div>

                  {/* 블로그 제목 */}
                  {item.blogTitle && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-blue-50 dark:bg-blue-950/30 rounded-lg px-3 py-2">
                        <p className="font-semibold text-sm">{item.blogTitle}</p>
                      </div>
                      <Button size="sm" variant="ghost" className="h-8 px-2 shrink-0"
                        onClick={() => copy(item.blogTitle!, "blogtitle")} title="제목 복사">
                        {copiedField === "blogtitle" ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  )}

                  {/* 본문 — 줄바꿈 보이는 뷰어 + 복사 버튼 */}
                  <div className="relative">
                    <div className="w-full max-h-96 overflow-y-auto text-xs leading-7 p-4 rounded-lg border bg-white dark:bg-zinc-900 font-sans whitespace-pre-wrap break-words select-text">
                      {htmlToPlainText(item.blogContent || "")}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      드래그 선택 또는 위 "전체 복사" 버튼으로 복사하여 블로그에 바로 붙여넣기
                    </p>
                  </div>

                  {/* 블로그 이미지 섹션 */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">블로그 이미지 (3장)</p>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1"
                        onClick={() => generateBlogImagesMutation.mutate()}
                        disabled={generateBlogImagesMutation.isPending}>
                        {generateBlogImagesMutation.isPending
                          ? <><Loader2 className="w-3 h-3 animate-spin" />생성 중...</>
                          : <><Sparkles className="w-3 h-3" />이미지 생성</>}
                      </Button>
                    </div>

                    {localBlogImages.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2">
                        {localBlogImages.map((img, i) => (
                          <div key={i} className="aspect-square rounded-lg overflow-hidden cursor-pointer relative group"
                            onClick={() => { const a = document.createElement("a"); a.href = img; a.download = `blog-image-${i + 1}.png`; a.click(); }}>
                            <img src={img} alt={`블로그 이미지 ${i + 1}`} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Download className="w-5 h-5 text-white" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 border border-dashed rounded-lg text-xs text-muted-foreground">
                        이미지 생성 버튼을 누르면 말씀 컨셉 이미지 3장을 생성합니다
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* 삭제 버튼 */}
            <Separator />
            <Button variant="destructive" size="sm" className="w-full"
              onClick={() => { onDelete(item.id); onOpenChange(false); }}>
              <Trash2 className="w-4 h-4 mr-2" />이 콘텐츠 삭제
            </Button>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ─── 자동화 탭 ────────────────────────────────────────────────────────────────

function AutomationTab() {
  const { toast } = useToast();
  const [channelUrl, setChannelUrl] = useState("");
  const [channelName, setChannelName] = useState("");

  const channelsQuery = useQuery<SavedYoutubeChannel[]>({
    queryKey: ["/api/saved-youtube-channels"],
  });

  const addMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/saved-youtube-channels", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-youtube-channels"] });
      setChannelUrl(""); setChannelName("");
      toast({ title: "채널 추가 완료!" });
    },
    onError: (e: Error) => toast({ title: "실패", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/saved-youtube-channels/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/saved-youtube-channels"] }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiRequest(`/api/saved-youtube-channels/${id}/toggle`, { method: "PATCH", body: JSON.stringify({ isActive: active }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/saved-youtube-channels"] }),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />채널 자동 모니터링
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">유튜브 채널을 등록하면 새 영상 업로드 시 자동으로 말씀 콘텐츠를 생성합니다. (30분마다 확인)</p>
          <div className="flex gap-2">
            <Input placeholder="채널 이름" value={channelName} onChange={(e) => setChannelName(e.target.value)} className="flex-1" />
            <Input placeholder="https://youtube.com/@channel" value={channelUrl} onChange={(e) => setChannelUrl(e.target.value)} className="flex-[2]" />
            <Button onClick={() => addMutation.mutate({ channelUrl, channelName })} disabled={!channelUrl || !channelName || addMutation.isPending}>
              {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "추가"}
            </Button>
          </div>

          <div className="space-y-2 mt-4">
            {channelsQuery.data?.map((ch) => (
              <div key={ch.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="font-medium text-sm">{ch.channelName}</p>
                  <p className="text-xs text-muted-foreground truncate max-w-xs">{ch.channelUrl}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={ch.isActive ? "default" : "secondary"}>{ch.isActive ? "활성" : "비활성"}</Badge>
                  <Button size="sm" variant="ghost" onClick={() => toggleMutation.mutate({ id: ch.id, active: !ch.isActive })}>
                    {ch.isActive ? "중지" : "시작"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(ch.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
            {!channelsQuery.data?.length && (
              <p className="text-center text-sm text-muted-foreground py-4">등록된 채널이 없습니다.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────

export default function YouTubeScripture() {
  const { toast } = useToast();
  const [viewState, setViewState] = useState<ViewState>("input");
  const [loadingSteps, setLoadingSteps] = useState<LoadingStep[]>(initialSteps);
  const [results, setResults] = useState<GeneratedContent | null>(null);
  const [blog, setBlog] = useState<BlogContent | null>(null);
  const [pendingBlogAfterGenerate, setPendingBlogAfterGenerate] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savedContentId, setSavedContentId] = useState<string | undefined>();
  const [ytUploadOpen, setYtUploadOpen] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [verseHint, setVerseHint] = useState("");
  const [transcriptText, setTranscriptText] = useState("");
  const [inputMode, setInputMode] = useState<"url" | "transcript">("url");
  const [filterChannel, setFilterChannel] = useState("all");
  const [selectedItem, setSelectedItem] = useState<ScriptureContent | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // 채널 목록
  const channelsQuery = useQuery<{ channelName: string; count: number }[]>({
    queryKey: ["/api/scripture-channels"],
    staleTime: 60000,
  });

  // 채널 필터 적용된 콘텐츠 조회
  const savedContentsQuery = useQuery<ScriptureContent[]>({
    queryKey: ["/api/scripture-contents", filterChannel],
    queryFn: async () => {
      const url = filterChannel && filterChannel !== "all"
        ? `/api/scripture-contents?channel=${encodeURIComponent(filterChannel)}`
        : "/api/scripture-contents";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const instagramItems = savedContentsQuery.data?.filter(c => !c.blogContent) || [];
  const blogItems = savedContentsQuery.data?.filter(c => !!c.blogContent) || [];

  const animateLoadingSteps = () => {
    const steps = initialSteps.map(s => ({ ...s }));
    setLoadingSteps(steps);
    const delays = [0, 2000, 4000, 6000, 15000];
    delays.forEach((delay, i) => {
      setTimeout(() => {
        setLoadingSteps(prev => prev.map((s, j) => j === i ? { ...s, status: "loading" } : j < i ? { ...s, status: "complete" } : s));
      }, delay);
      setTimeout(() => {
        setLoadingSteps(prev => prev.map((s, j) => j <= i ? { ...s, status: "complete" } : s));
      }, delay + 1800);
    });
  };

  const generateMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/youtube-scripture/generate", {
        method: "POST",
        body: JSON.stringify(data),
      }) as Promise<GeneratedContent>;
    },
    onMutate: () => {
      setViewState("loading");
      setIsSaved(false);
      setBlog(null);
      animateLoadingSteps();
    },
    onSuccess: (data) => {
      setResults(data);
      setLoadingSteps(initialSteps.map(s => ({ ...s, status: "complete" })));
      setTimeout(() => {
        setViewState("results");
        // 블로그 모드로 생성한 경우 자동으로 블로그 생성
        if (pendingBlogAfterGenerate) {
          setPendingBlogAfterGenerate(false);
          const ref = data.verseReference || data.bibleReference || "";
          const verse = data.verseContent || data.bibleVerse || "";
          blogMutation.mutate({ summary: data.summary, coreMessage: data.coreMessage, verseReference: ref, verseContent: verse });
        }
      }, 500);
    },
    onError: (e: Error) => {
      setViewState("input");
      setLoadingSteps(initialSteps);
      setPendingBlogAfterGenerate(false);
      toast({ title: "생성 실패", description: e.message, variant: "destructive" });
    },
  });

  const blogMutation = useMutation({
    mutationFn: async (data: { summary: string[]; coreMessage: string; verseReference: string; verseContent: string }) => {
      return apiRequest("/api/youtube-scripture/blog", {
        method: "POST",
        body: JSON.stringify(data),
      }) as Promise<BlogContent>;
    },
    onSuccess: (data) => {
      setBlog(data);
      toast({ title: "블로그 생성 완료!" });
    },
    onError: (e: Error) => toast({ title: "블로그 생성 실패", description: e.message, variant: "destructive" }),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!results) throw new Error("저장할 콘텐츠가 없습니다.");
      return apiRequest("/api/scripture-contents", {
        method: "POST",
        body: JSON.stringify({
          youtubeUrl: inputMode === "url" ? youtubeUrl : null,
          videoTitle: results.videoTitle || results.coreMessage?.slice(0, 50) || "말씀 콘텐츠",
          videoSummary: results.videoSummary || results.summary?.join(" ") || "",
          bibleVerse: results.verseContent || results.bibleVerse || "",
          bibleReference: results.verseReference || results.bibleReference || "",
          instagramSlides: results.instagramSlides || [],
          instagramCaption: results.caption || results.instagramCaption || "",
          instagramHashtags: results.hashtags || results.instagramHashtags || [],
          imageUrls: results.imageUrls || (results.imageUrl ? [results.imageUrl] : []),
          blogTitle: results.blogTitle || "",
          blogContent: results.blogContent || "",
          blogMetaDescription: results.blogMetaDescription || "",
        }),
      });
    },
    onSuccess: () => {
      setIsSaved(true);
      toast({ title: "저장 완료!" });
      queryClient.invalidateQueries({ queryKey: ["/api/scripture-contents"] });
    },
    onError: (e: Error) => toast({ title: "저장 실패", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/scripture-contents/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "삭제 완료" });
      queryClient.invalidateQueries({ queryKey: ["/api/scripture-contents"] });
    },
  });

  const handleSubmit = (mode: "instagram" | "blog" = "instagram") => {
    setPendingBlogAfterGenerate(mode === "blog");
    const payload = inputMode === "url"
      ? { youtubeUrl: youtubeUrl.trim(), verseHint: verseHint.trim() || undefined }
      : { transcriptText: transcriptText.trim(), verseHint: verseHint.trim() || undefined };

    if (inputMode === "url" && !youtubeUrl.trim()) { toast({ title: "URL을 입력해주세요", variant: "destructive" }); return; }
    if (inputMode === "transcript" && !transcriptText.trim()) { toast({ title: "자막을 입력해주세요", variant: "destructive" }); return; }
    generateMutation.mutate(payload);
  };

  const handleBlogGenerate = () => {
    if (!results) return;
    const ref = results.verseReference || results.bibleReference || "";
    const verse = results.verseContent || results.bibleVerse || "";
    blogMutation.mutate({ summary: results.summary, coreMessage: results.coreMessage, verseReference: ref, verseContent: verse });
  };

  const handleLoadSaved = (item: ScriptureContent) => {
    setResults({
      videoTitle: item.videoTitle || "",
      videoSummary: item.videoSummary || "",
      summary: [],
      coreMessage: "",
      bibleVerse: item.bibleVerse || "",
      bibleReference: item.bibleReference || "",
      verseContent: item.bibleVerse || "",
      verseReference: item.bibleReference || "",
      instagramSlides: item.instagramSlides || [],
      instagramCaption: item.instagramCaption || "",
      instagramHashtags: item.instagramHashtags || [],
      imageUrls: item.imageUrls || [],
      imageUrl: item.imageUrls?.[0] || "",
      caption: item.instagramCaption || "",
      hashtags: item.instagramHashtags || [],
      blogTitle: item.blogTitle || "",
      blogContent: item.blogContent || "",
      blogMetaDescription: item.blogMetaDescription || "",
    });
    setIsSaved(true);
    setViewState("results");
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* 헤더 */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-4">
          <BookOpen className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold">말씀 이미지 생성기</h1>
        <p className="text-muted-foreground mt-2">Scripture Image Generator</p>
      </div>

      <Tabs defaultValue="create" className="space-y-6">
        <div className="flex justify-center">
          <TabsList className="grid grid-cols-4 w-full max-w-xl">
            <TabsTrigger value="create">새로 만들기</TabsTrigger>
            <TabsTrigger value="instagram">
              인스타그램 ({instagramItems.length})
            </TabsTrigger>
            <TabsTrigger value="blog">
              블로그 ({blogItems.length})
            </TabsTrigger>
            <TabsTrigger value="automation">자동화</TabsTrigger>
          </TabsList>
        </div>

        {/* ── 새로 만들기 탭 ── */}
        <TabsContent value="create">
          {viewState === "input" && (
            <Card>
              <CardContent className="pt-6 space-y-6">
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-bold">유튜브 영상을 말씀 이미지로</h2>
                  <p className="text-muted-foreground">AI가 영상을 요약하고, 성경 말씀을 추천하며, 인스타그램용 이미지와 문구를 자동으로 생성합니다</p>
                </div>

                <div className="flex gap-2 justify-center">
                  <Button variant={inputMode === "url" ? "default" : "outline"} onClick={() => setInputMode("url")} className="gap-2">
                    <Play className="w-4 h-4" />유튜브 링크
                  </Button>
                  <Button variant={inputMode === "transcript" ? "default" : "outline"} onClick={() => setInputMode("transcript")} className="gap-2">
                    <FileText className="w-4 h-4" />자막 텍스트
                  </Button>
                </div>

                {inputMode === "url" ? (
                  <div className="space-y-2">
                    <Label>YouTube URL</Label>
                    <Input
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSubmit("instagram")}
                    />
                    <p className="text-xs text-primary">유튜브 영상 링크를 입력하면 자동으로 자막을 추출합니다</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>영상 자막 또는 설교 텍스트</Label>
                    <Textarea
                      placeholder="유튜브 영상의 자막이나 설교 내용을 붙여넣으세요..."
                      rows={6}
                      value={transcriptText}
                      onChange={(e) => setTranscriptText(e.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>말씀 힌트 (선택사항) / Verse Hint (Optional)</Label>
                  <Input
                    placeholder="예: 사랑, 믿음, 소망, 요한복음..."
                    value={verseHint}
                    onChange={(e) => setVerseHint(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">특정 주제나 성경 구절을 원하시면 힌트를 입력해주세요</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => handleSubmit("instagram")}
                    disabled={generateMutation.isPending}
                    className="gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                    size="lg"
                  >
                    <Instagram className="w-4 h-4" />인스타그램 생성하기
                  </Button>
                  <Button
                    onClick={() => handleSubmit("blog")}
                    disabled={generateMutation.isPending}
                    variant="outline"
                    className="gap-2 border-2 border-blue-400 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
                    size="lg"
                  >
                    <FileText className="w-4 h-4" />블로그 생성하기
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {viewState === "loading" && <LoadingState steps={loadingSteps} />}

          {viewState === "results" && results && (
            <>
              <ResultsDisplay
                results={results}
                onRegenerate={() => { setViewState("input"); setResults(null); setIsSaved(false); setBlog(null); }}
                onSave={() => saveMutation.mutate()}
                isSaving={saveMutation.isPending}
                isSaved={isSaved}
                savedContentId={savedContentId}
                onYouTubeUpload={() => setYtUploadOpen(true)}
                blog={blog}
                onBlogGenerate={handleBlogGenerate}
                isBlogGenerating={blogMutation.isPending}
              />
              <YouTubeUploadDialog
                open={ytUploadOpen}
                onOpenChange={setYtUploadOpen}
                scriptureId={savedContentId || "temp"}
                verseReference={results.verseReference || results.bibleReference || ""}
                bibleVerse={results.verseContent || results.bibleVerse || ""}
                coreMessage={results.coreMessage || ""}
                hashtags={results.hashtags || results.instagramHashtags || []}
                imageUrls={results.imageUrls || (results.imageUrl ? [results.imageUrl] : [])}
              />
            </>
          )}
        </TabsContent>

        {/* ── 인스타그램 탭 ── */}
        <TabsContent value="instagram">
          <SavedList
            items={instagramItems}
            isLoading={savedContentsQuery.isLoading}
            onDelete={(id) => deleteMutation.mutate(id)}
            onSelect={(item) => { setSelectedItem(item); setDetailOpen(true); }}
            filterChannel={filterChannel}
            onFilterChange={(v) => { setFilterChannel(v); queryClient.invalidateQueries({ queryKey: ["/api/scripture-contents"] }); }}
            channels={channelsQuery.data || []}
          />
        </TabsContent>

        {/* ── 블로그 탭 ── */}
        <TabsContent value="blog">
          <SavedList
            items={blogItems}
            isLoading={savedContentsQuery.isLoading}
            onDelete={(id) => deleteMutation.mutate(id)}
            onSelect={(item) => { setSelectedItem(item); setDetailOpen(true); }}
            filterChannel={filterChannel}
            onFilterChange={(v) => { setFilterChannel(v); queryClient.invalidateQueries({ queryKey: ["/api/scripture-contents"] }); }}
            channels={channelsQuery.data || []}
          />
        </TabsContent>

        {/* 상세 다이얼로그 */}
        <ContentDetailDialog
          item={selectedItem}
          open={detailOpen}
          onOpenChange={setDetailOpen}
          onDelete={(id) => { deleteMutation.mutate(id); queryClient.invalidateQueries({ queryKey: ["/api/scripture-contents"] }); }}
          onImageGenerated={(id, imageUrls, imageBase64) => {
            queryClient.invalidateQueries({ queryKey: ["/api/scripture-contents"] });
            if (selectedItem && selectedItem.id === id) {
              setSelectedItem({ ...selectedItem, imageUrls });
            }
          }}
        />

        {/* ── 자동화 탭 ── */}
        <TabsContent value="automation">
          <AutomationTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
