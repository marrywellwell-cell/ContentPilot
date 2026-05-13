import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Loader2, Youtube, BookOpen, Download, Copy, Check, Sparkles,
  Trash2, FileText, Image as ImageIcon, ChevronDown, ChevronUp,
  RefreshCw, Save,
} from "lucide-react";
import type { ScriptureContent } from "@shared/schema";

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

// ─── 요약 카드 ────────────────────────────────────────────────────────────────

function SummaryCard({ summary, coreMessage }: { summary: string[]; coreMessage: string }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="w-5 h-5 text-primary" />
          영상 요약
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {summary.filter(Boolean).map((line, i) => (
            <p key={i} className="text-sm leading-relaxed text-foreground">{line}</p>
          ))}
        </div>
        {coreMessage && (
          <div className="border-t pt-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">핵심 메시지</p>
            <div className="bg-primary/10 rounded-lg p-3">
              <p className="text-sm font-semibold text-foreground">{coreMessage}</p>
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
  const copy = () => {
    navigator.clipboard.writeText(`${reference}\n"${verse}"`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="w-5 h-5 text-primary" />
            추천 말씀
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={copy}>
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3 font-medium">{reference}</p>
        <blockquote className="border-l-4 border-primary pl-4 py-1">
          <p className="text-base font-serif italic leading-relaxed">"{verse}"</p>
        </blockquote>
      </CardContent>
    </Card>
  );
}

// ─── 이미지 카드 ──────────────────────────────────────────────────────────────

function ImageCard({ imageUrl, verseReference }: { imageUrl: string; verseReference: string }) {
  const download = () => {
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = `scripture-${Date.now()}.png`;
    a.click();
  };
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ImageIcon className="w-5 h-5 text-primary" />
            생성된 이미지
          </CardTitle>
          <Button size="sm" variant="outline" onClick={download}>
            <Download className="h-4 w-4 mr-1" />저장
          </Button>
        </div>
        <CardDescription>말씀이 오버레이된 인스타그램용 이미지</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative rounded-xl overflow-hidden aspect-square bg-muted">
          <img src={imageUrl} alt={verseReference} className="w-full h-full object-cover" />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 캡션 카드 ────────────────────────────────────────────────────────────────

function CaptionCard({ caption, hashtags }: { caption: string; hashtags: string[] }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(`${caption}\n\n${hashtags.join(" ")}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">인스타그램 캡션</CardTitle>
          <Button size="sm" variant="ghost" onClick={copy}>
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{caption}</p>
        <div className="flex flex-wrap gap-1 pt-2 border-t">
          {hashtags.map((tag, i) => (
            <Badge key={i} variant="secondary" className="text-xs">
              {tag.startsWith("#") ? tag : `#${tag}`}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 슬라이드 카드 ────────────────────────────────────────────────────────────

function SlidesCard({ slides }: { slides: string[] }) {
  if (!slides?.length) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">인스타그램 슬라이드 ({slides.length}장)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {slides.map((slide, i) => (
            <div key={i} className="aspect-square rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center p-2">
              <p className="text-white text-xs font-bold text-center leading-tight">{slide}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 블로그 카드 ──────────────────────────────────────────────────────────────

function BlogCard({ blog }: { blog: BlogContent }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(blog.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{blog.title}</CardTitle>
          <Button size="sm" variant="ghost" onClick={copy}>
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        <div className="flex flex-wrap gap-1 mt-1">
          {blog.titles?.slice(0, 3).map((t, i) => (
            <Badge key={i} variant="outline" className="text-xs">{t}</Badge>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className={`text-sm leading-relaxed whitespace-pre-wrap ${expanded ? "" : "line-clamp-6"}`}>
          {blog.content}
        </p>
        <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
          {expanded ? "접기" : "더 보기"}
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

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────

export default function YouTubeScripture() {
  const { toast } = useToast();
  const [mainTab, setMainTab] = useState<"create" | "saved">("create");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [verseHint, setVerseHint] = useState("");
  const [transcriptText, setTranscriptText] = useState("");
  const [inputMode, setInputMode] = useState<"url" | "transcript">("url");
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [blog, setBlog] = useState<BlogContent | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  const savedContentsQuery = useQuery<ScriptureContent[]>({
    queryKey: ["/api/scripture-contents"],
  });

  const generateMutation = useMutation({
    mutationFn: async (data: { youtubeUrl?: string; verseHint?: string; transcriptText?: string }) => {
      return apiRequest("/api/youtube-scripture/generate", {
        method: "POST",
        body: JSON.stringify(data),
      }) as Promise<GeneratedContent>;
    },
    onSuccess: (data) => {
      setGeneratedContent(data);
      setBlog(null);
      setIsSaved(false);
      toast({ title: "콘텐츠 생성 완료!", description: "말씀 콘텐츠가 생성되었습니다." });
    },
    onError: (error: Error) => {
      toast({ title: "생성 실패", description: error.message, variant: "destructive" });
    },
  });

  const blogMutation = useMutation({
    mutationFn: async () => {
      if (!generatedContent) throw new Error("먼저 콘텐츠를 생성해주세요.");
      return apiRequest("/api/youtube-scripture/blog", {
        method: "POST",
        body: JSON.stringify({
          summary: generatedContent.summary,
          coreMessage: generatedContent.coreMessage,
          verseReference: generatedContent.verseReference || generatedContent.bibleReference,
          verseContent: generatedContent.verseContent || generatedContent.bibleVerse,
        }),
      }) as Promise<BlogContent>;
    },
    onSuccess: (data) => {
      setBlog(data);
      toast({ title: "블로그 생성 완료!" });
    },
    onError: (error: Error) => {
      toast({ title: "블로그 생성 실패", description: error.message, variant: "destructive" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!generatedContent) throw new Error("저장할 콘텐츠가 없습니다.");
      return apiRequest("/api/scripture-contents", {
        method: "POST",
        body: JSON.stringify({
          youtubeUrl: inputMode === "url" ? youtubeUrl : null,
          videoTitle: generatedContent.videoTitle,
          videoSummary: generatedContent.videoSummary,
          bibleVerse: generatedContent.verseContent || generatedContent.bibleVerse,
          bibleReference: generatedContent.verseReference || generatedContent.bibleReference,
          instagramSlides: generatedContent.instagramSlides,
          instagramCaption: generatedContent.instagramCaption || generatedContent.caption,
          instagramHashtags: generatedContent.instagramHashtags || generatedContent.hashtags,
          imageUrls: generatedContent.imageUrls,
          blogTitle: blog?.title || generatedContent.blogTitle,
          blogContent: blog?.content || generatedContent.blogContent,
          blogMetaDescription: generatedContent.blogMetaDescription,
        }),
      });
    },
    onSuccess: () => {
      setIsSaved(true);
      toast({ title: "저장 완료!" });
      queryClient.invalidateQueries({ queryKey: ["/api/scripture-contents"] });
    },
    onError: (error: Error) => {
      toast({ title: "저장 실패", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/scripture-contents/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "삭제 완료" });
      queryClient.invalidateQueries({ queryKey: ["/api/scripture-contents"] });
    },
  });

  const handleGenerate = () => {
    if (inputMode === "url") {
      if (!youtubeUrl.trim()) { toast({ title: "YouTube URL을 입력해주세요", variant: "destructive" }); return; }
      generateMutation.mutate({ youtubeUrl: youtubeUrl.trim(), verseHint: verseHint.trim() || undefined });
    } else {
      if (!transcriptText.trim()) { toast({ title: "자막 텍스트를 입력해주세요", variant: "destructive" }); return; }
      generateMutation.mutate({ transcriptText: transcriptText.trim(), verseHint: verseHint.trim() || undefined });
    }
  };

  const displayRef = generatedContent?.verseReference || generatedContent?.bibleReference || "";
  const displayVerse = generatedContent?.verseContent || generatedContent?.bibleVerse || "";
  const displayImageUrl = generatedContent?.imageUrl || generatedContent?.imageUrls?.[0] || "";

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-semibold flex items-center gap-2">
          <Youtube className="h-8 w-8 text-red-500" />
          유튜브 말씀 콘텐츠
        </h1>
        <p className="text-muted-foreground mt-1">
          유튜브 영상에서 성경 말씀을 추출하고 인스타그램·블로그 콘텐츠를 자동 생성합니다.
        </p>
      </div>

      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as any)}>
        <TabsList>
          <TabsTrigger value="create">콘텐츠 만들기</TabsTrigger>
          <TabsTrigger value="saved">저장됨 ({savedContentsQuery.data?.length || 0})</TabsTrigger>
        </TabsList>

        {/* ── 생성 탭 ── */}
        <TabsContent value="create" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>입력 방식 선택</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button variant={inputMode === "url" ? "default" : "outline"} onClick={() => setInputMode("url")} size="sm">
                  <Youtube className="h-4 w-4 mr-1" />YouTube URL
                </Button>
                <Button variant={inputMode === "transcript" ? "default" : "outline"} onClick={() => setInputMode("transcript")} size="sm">
                  <FileText className="h-4 w-4 mr-1" />자막 직접 입력
                </Button>
              </div>

              {inputMode === "url" ? (
                <div className="space-y-2">
                  <Label>YouTube URL</Label>
                  <Input
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    yt-dlp 설치 시 더 정확한 자막을 추출합니다. 미설치 시 자동 폴백됩니다.
                  </p>
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
                <Label>말씀 힌트 (선택)</Label>
                <Input
                  placeholder="예: 로마서, 시편, 사랑, 믿음..."
                  value={verseHint}
                  onChange={(e) => setVerseHint(e.target.value)}
                />
              </div>

              <Button onClick={handleGenerate} disabled={generateMutation.isPending} className="w-full" size="lg">
                {generateMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />분석 중...</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-2" />말씀 콘텐츠 생성</>
                )}
              </Button>

              {generateMutation.isPending && (
                <div className="space-y-1">
                  {["자막 추출 중", "영상 구조 분석", "개역개정 말씀 추출", "Canvas 이미지 생성", "캡션 작성"].map((step, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
                      <Loader2 className="h-3 w-3 animate-spin" />{step}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {generatedContent && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => blogMutation.mutate()} disabled={blogMutation.isPending}>
                  {blogMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}
                  블로그 생성
                </Button>
                <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || isSaved}>
                  {isSaved ? <><Check className="h-4 w-4 mr-1 text-green-500" />저장됨</>
                    : saveMutation.isPending ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />저장 중</>
                    : <><Save className="h-4 w-4 mr-1" />저장</>}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setGeneratedContent(null); setBlog(null); setIsSaved(false); }}>
                  <RefreshCw className="h-4 w-4 mr-1" />초기화
                </Button>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {generatedContent.summary?.filter(Boolean).length > 0 && (
                  <SummaryCard summary={generatedContent.summary} coreMessage={generatedContent.coreMessage} />
                )}
                {displayRef && <BibleVerseCard reference={displayRef} verse={displayVerse} />}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {displayImageUrl && <ImageCard imageUrl={displayImageUrl} verseReference={displayRef} />}
                {(generatedContent.caption || generatedContent.instagramCaption) && (
                  <CaptionCard
                    caption={generatedContent.caption || generatedContent.instagramCaption}
                    hashtags={generatedContent.hashtags || generatedContent.instagramHashtags || []}
                  />
                )}
              </div>

              {generatedContent.instagramSlides?.length > 0 && (
                <SlidesCard slides={generatedContent.instagramSlides} />
              )}

              {blog && <BlogCard blog={blog} />}
            </div>
          )}
        </TabsContent>

        {/* ── 저장된 콘텐츠 탭 ── */}
        <TabsContent value="saved" className="mt-4">
          {savedContentsQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !savedContentsQuery.data?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>저장된 콘텐츠가 없습니다.</p>
              <Button className="mt-4" onClick={() => setMainTab("create")}>첫 콘텐츠 만들기</Button>
            </div>
          ) : (
            <div className="grid gap-3">
              {savedContentsQuery.data.map((item) => (
                <Card key={item.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {item.imageUrls?.[0] && (
                        <img src={item.imageUrls[0]} alt={item.bibleReference} className="w-16 h-16 rounded-lg object-cover shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{item.bibleReference}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{item.bibleVerse}</p>
                        {item.videoTitle && <p className="text-xs text-muted-foreground mt-1">{item.videoTitle}</p>}
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(item.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
