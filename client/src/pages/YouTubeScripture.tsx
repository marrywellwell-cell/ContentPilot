import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Loader2, Youtube, BookOpen, Download, Copy, Check,
  Sparkles, Trash2, FileText, ChevronDown, ChevronUp,
  Save, RefreshCw, Image as ImageIcon, Play, Bot,
} from "lucide-react";
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
  instagramCaption: string;
  instagramHashtags: string[];
  imageUrls: string[];
  imageUrl: string;
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
  const { toast } = useToast();

  const copy = async () => {
    await navigator.clipboard.writeText(blog.content);
    setCopied(true);
    toast({ title: "복사 완료!" });
    setTimeout(() => setCopied(false), 2000);
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
          <Button variant="outline" size="sm" onClick={copy}>
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className={`text-sm leading-relaxed whitespace-pre-wrap ${expanded ? "" : "line-clamp-5"}`}>
          {blog.content}
        </p>
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
  results, onRegenerate, onSave, isSaving, isSaved, savedContentId,
}: {
  results: GeneratedContent;
  onRegenerate: () => void;
  onSave: () => void;
  isSaving: boolean;
  isSaved: boolean;
  savedContentId?: string;
}) {
  const { toast } = useToast();
  const [blog, setBlog] = useState<BlogContent | null>(null);

  const ref = results.verseReference || results.bibleReference || "";
  const verse = results.verseContent || results.bibleVerse || "";
  const imageUrl = results.imageUrl || results.imageUrls?.[0] || "";
  const caption = results.caption || results.instagramCaption || "";
  const hashtags = results.hashtags?.length ? results.hashtags : (results.instagramHashtags || []);

  const blogMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/youtube-scripture/blog", {
        method: "POST",
        body: JSON.stringify({
          summary: results.summary,
          coreMessage: results.coreMessage,
          verseReference: ref,
          verseContent: verse,
        }),
      }) as Promise<BlogContent>;
    },
    onSuccess: (data) => {
      setBlog(data);
      toast({ title: "블로그 생성 완료!" });
    },
    onError: (e: Error) => toast({ title: "블로그 생성 실패", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      {/* 액션 버튼 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Button variant="outline" onClick={onRegenerate} className="gap-2">
          <RefreshCw className="w-4 h-4" />새로 만들기
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => blogMutation.mutate()} disabled={blogMutation.isPending} className="gap-2">
            {blogMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            블로그 생성
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

      {/* 이미지 + 캡션 */}
      <div className="grid md:grid-cols-2 gap-6">
        {imageUrl && <ImagePreviewCard imageUrl={imageUrl} prompt={results.imagePrompt} />}
        {caption && <InstagramCaptionCard caption={caption} hashtags={hashtags} />}
      </div>

      {/* 블로그 */}
      {blog && <BlogResultCard blog={blog} />}
    </div>
  );
}

// ─── 저장된 콘텐츠 목록 ───────────────────────────────────────────────────────

function SavedList({
  items, isLoading, onDelete, onSelect,
}: {
  items: ScriptureContent[];
  isLoading: boolean;
  onDelete: (id: string) => void;
  onSelect: (item: ScriptureContent) => void;
}) {
  if (isLoading) return (
    <div className="flex justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (!items.length) return (
    <div className="text-center py-16 text-muted-foreground">
      <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
      <p>저장된 콘텐츠가 없습니다.</p>
    </div>
  );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((item) => (
        <Card key={item.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onSelect(item)}>
          <CardContent className="p-4">
            <div className="flex gap-3">
              {item.imageUrls?.[0] && (
                <img src={item.imageUrls[0]} alt={item.bibleReference} className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{item.bibleReference}</p>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{item.bibleVerse}</p>
                {item.videoTitle && <p className="text-xs text-muted-foreground mt-1 truncate">{item.videoTitle}</p>}
              </div>
              <Button size="sm" variant="ghost" className="flex-shrink-0" onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
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
  const [isSaved, setIsSaved] = useState(false);
  const [savedContentId, setSavedContentId] = useState<string | undefined>();
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [verseHint, setVerseHint] = useState("");
  const [transcriptText, setTranscriptText] = useState("");
  const [inputMode, setInputMode] = useState<"url" | "transcript">("url");

  const savedContentsQuery = useQuery<ScriptureContent[]>({
    queryKey: ["/api/scripture-contents"],
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
      animateLoadingSteps();
    },
    onSuccess: (data) => {
      setResults(data);
      setLoadingSteps(initialSteps.map(s => ({ ...s, status: "complete" })));
      setTimeout(() => setViewState("results"), 500);
    },
    onError: (e: Error) => {
      setViewState("input");
      setLoadingSteps(initialSteps);
      toast({ title: "생성 실패", description: e.message, variant: "destructive" });
    },
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

  const handleSubmit = () => {
    if (inputMode === "url") {
      if (!youtubeUrl.trim()) { toast({ title: "URL을 입력해주세요", variant: "destructive" }); return; }
      generateMutation.mutate({ youtubeUrl: youtubeUrl.trim(), verseHint: verseHint.trim() || undefined });
    } else {
      if (!transcriptText.trim()) { toast({ title: "자막을 입력해주세요", variant: "destructive" }); return; }
      generateMutation.mutate({ transcriptText: transcriptText.trim(), verseHint: verseHint.trim() || undefined });
    }
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
                      onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
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

                <Button onClick={handleSubmit} disabled={generateMutation.isPending} className="w-full gap-2" size="lg">
                  <Sparkles className="w-4 h-4" />자동 생성하기
                </Button>
              </CardContent>
            </Card>
          )}

          {viewState === "loading" && <LoadingState steps={loadingSteps} />}

          {viewState === "results" && results && (
            <ResultsDisplay
              results={results}
              onRegenerate={() => { setViewState("input"); setResults(null); setIsSaved(false); }}
              onSave={() => saveMutation.mutate()}
              isSaving={saveMutation.isPending}
              isSaved={isSaved}
              savedContentId={savedContentId}
            />
          )}
        </TabsContent>

        {/* ── 인스타그램 탭 ── */}
        <TabsContent value="instagram">
          <SavedList
            items={instagramItems}
            isLoading={savedContentsQuery.isLoading}
            onDelete={(id) => deleteMutation.mutate(id)}
            onSelect={handleLoadSaved}
          />
        </TabsContent>

        {/* ── 블로그 탭 ── */}
        <TabsContent value="blog">
          <SavedList
            items={blogItems}
            isLoading={savedContentsQuery.isLoading}
            onDelete={(id) => deleteMutation.mutate(id)}
            onSelect={handleLoadSaved}
          />
        </TabsContent>

        {/* ── 자동화 탭 ── */}
        <TabsContent value="automation">
          <AutomationTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
