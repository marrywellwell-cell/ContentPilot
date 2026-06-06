import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { stripBase64Images } from "@/lib/downloadImage";
import { Loader2, Lightbulb, Download, Copy, Check, Sparkles, Trash2, Eye, ChevronLeft, ChevronRight, Instagram, Video, Plus, X, History, Film, FileText, Mic, Upload, Wand2, Send, PenLine } from "lucide-react";
import { downloadImageViaServer } from "@/lib/downloadImage";
import { Progress } from "@/components/ui/progress";

interface InventionIdea {
  id: string;
  userId: string;
  title: string;
  problem: string;
  solution: string;
  useCases: string | null;
  targetAudience: string[] | null;
  tone: string | null;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
}

interface ShortsScene {
  scene: number;
  description: string;
  duration: string;
  narration: string;
}

interface InventionContent {
  id: string;
  ideaId: string;
  userId: string;
  contentType: string;
  instagramSlides: string[] | null;
  instagramImageUrls: string[] | null;
  instagramCaption: string | null;
  instagramHashtags: string[] | null;
  shortsScript: string | null;
  shortsScenes: ShortsScene[] | null;
  shortsDuration: string | null;
  shortsTitle: string | null;
  shortsHook: string | null;
  shortsHashtags: string[] | null;
  shortsVideoUrl: string | null;
  shortsThumbnailUrl: string | null;
  blogTitle: string | null;
  blogContent: string | null;
  blogHtml: string | null;
  blogMetaDescription: string | null;
  blogHashtags: string[] | null;
  copyright: string | null;
  createdAt: string | null;
}

interface UploadHistoryItem {
  id: string;
  contentId: string;
  platform: string;
  uploadType: string;
  status: string;
  externalUrl: string | null;
  views: string | null;
  likes: string | null;
  notes: string | null;
  createdAt: string | null;
}

const targetAudienceOptions = [
  "일반 소비자",
  "투자자",
  "스타트업 관계자",
  "기업 임원",
  "기술 전문가",
  "정부/공공기관",
  "학생/연구자",
  "MZ세대",
  "시니어층",
];

const toneOptions = [
  { value: "professional", label: "전문적" },
  { value: "emotional", label: "감성적" },
  { value: "casual", label: "캐주얼" },
];

const inventionIdeaSchema = z.object({
  title: z.string().min(1, "제목을 입력해주세요"),
  problem: z.string().min(1, "해결하려는 문제를 입력해주세요"),
  solution: z.string().min(1, "해결 방법을 입력해주세요"),
  useCases: z.string().optional(),
  tone: z.string().default("professional"),
});

type InventionIdeaFormData = z.infer<typeof inventionIdeaSchema>;

export default function InventionIdea() {
  const { toast } = useToast();
  const [mainTab, setMainTab] = useState<"create" | "saved" | "videos" | "history">("create");
  const [isSavingVideo, setIsSavingVideo] = useState(false);
  const [convertingMp4Ids, setConvertingMp4Ids] = useState<Set<string>>(new Set());
  const [mp4ReadyIds, setMp4ReadyIds] = useState<Set<string>>(new Set());
  const [convertingFeedIds, setConvertingFeedIds] = useState<Set<string>>(new Set());
  const [feedReadyIds, setFeedReadyIds] = useState<Set<string>>(new Set());
  // Slide AI editor
  const [showSlideEditor, setShowSlideEditor] = useState(false);
  const [editedSlides, setEditedSlides] = useState<string[]>([]);
  const [manualSlideText, setManualSlideText] = useState("");
  const [aiInstruction, setAiInstruction] = useState("");
  const [isAiEditing, setIsAiEditing] = useState(false);
  const [editScope, setEditScope] = useState<"single" | "all">("single");
  const [selectedAudiences, setSelectedAudiences] = useState<string[]>([]);
  const [generatedContent, setGeneratedContent] = useState<InventionContent | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [selectedIdea, setSelectedIdea] = useState<InventionIdea | null>(null);
  const [viewingContent, setViewingContent] = useState<InventionContent | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoPhase, setVideoPhase] = useState<"tts" | "images" | "render" | "done">("tts");
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [uploadedVoiceBuffer, setUploadedVoiceBuffer] = useState<ArrayBuffer | null>(null);
  const [uploadedVoiceName, setUploadedVoiceName] = useState<string>("");
  const [storedVoiceExists, setStoredVoiceExists] = useState(false);
  const [isSavingVoice, setIsSavingVoice] = useState(false);
  const [useDirectVoice, setUseDirectVoice] = useState(false);
  const [clonedVoiceId, setClonedVoiceId] = useState<string | null>(null);
  const [isCloning, setIsCloning] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const voiceInputRef = useRef<HTMLInputElement>(null);
  const recordingMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingSecondsRef = useRef(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoCanvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const form = useForm<InventionIdeaFormData>({
    resolver: zodResolver(inventionIdeaSchema),
    defaultValues: {
      title: "",
      problem: "",
      solution: "",
      useCases: "",
      tone: "professional",
    },
  });


  // Check if a stored user voice exists on the server (persists across page refreshes)
  useEffect(() => {
    fetch("/api/user-voice/status", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.exists) {
          setStoredVoiceExists(true);
          setUploadedVoiceName("저장된 음성 파일");
        }
      })
      .catch(() => {});
  }, []);

  // Force video element to load the new blob URL when it changes
  useEffect(() => {
    if (generatedVideoUrl && videoRef.current) {
      videoRef.current.load();
    }
  }, [generatedVideoUrl]);

  const handleConvertMp4 = async (contentId: string, format: "reels" | "feed" = "reels") => {
    const isFeed = format === "feed";
    const setConverting = isFeed ? setConvertingFeedIds : setConvertingMp4Ids;
    const setReady = isFeed ? setFeedReadyIds : setMp4ReadyIds;
    const label = isFeed ? "피드(4:5)" : "릴스(9:16)";
    setConverting(prev => new Set([...prev, contentId]));
    try {
      toast({ title: `MP4 변환 중...`, description: `인스타그램 ${label} MP4로 변환 중입니다. 잠시 기다려 주세요.` });
      const res = await fetch(`/api/shorts-video/convert-mp4/${contentId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "알 수 없는 오류" }));
        throw new Error(errData.error || "변환 실패");
      }
      setReady(prev => new Set([...prev, contentId]));
      toast({ title: "변환 완료!", description: `인스타그램 ${label} MP4가 준비되었습니다.` });
    } catch (err: any) {
      const msg = err?.message || "MP4 변환 중 오류가 발생했습니다.";
      const isReRecord = msg.includes("다시 녹화");
      toast({ title: "변환 실패", description: isReRecord ? "서버 재시작으로 영상이 초기화됐습니다. 영상을 다시 녹화해주세요." : msg, variant: "destructive" });
    } finally {
      setConverting(prev => { const s = new Set(prev); s.delete(contentId); return s; });
    }
  };

  const handleDownloadMp4 = async (contentId: string, format: "reels" | "feed" = "reels") => {
    try {
      const isFeed = format === "feed";
      const url = isFeed
        ? `/api/shorts-video/mp4/${contentId}?format=feed`
        : `/api/shorts-video/mp4/${contentId}`;
      const filename = isFeed
        ? `instagram-feed-${contentId.slice(0, 8)}.mp4`
        : `instagram-reels-${contentId.slice(0, 8)}.mp4`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("MP4 not found");
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(objUrl);
    } catch {
      toast({ title: "다운로드 실패", variant: "destructive" });
    }
  };

  const ideasQuery = useQuery<InventionIdea[]>({
    queryKey: ["/api/invention-ideas"],
  });

  const contentsQuery = useQuery<InventionContent[]>({
    queryKey: ["/api/invention-contents"],
  });

  // Check MP4 status for all video contents when the videos tab is opened
  useEffect(() => {
    if (mainTab !== "videos") return;
    const videoContents = (contentsQuery.data ?? []).filter(c => c.shortsVideoUrl);
    videoContents.forEach(async (item) => {
      try {
        const res = await fetch(`/api/shorts-video/mp4-status/${item.id}`, { credentials: "include" });
        if (res.ok) {
          const { exists, feedExists } = await res.json();
          if (exists) setMp4ReadyIds(prev => new Set([...prev, item.id]));
          if (feedExists) setFeedReadyIds(prev => new Set([...prev, item.id]));
        }
      } catch {}
    });
  }, [mainTab, contentsQuery.data]);

  const uploadHistoryQuery = useQuery<UploadHistoryItem[]>({
    queryKey: ["/api/upload-history"],
  });

  const createIdeaMutation = useMutation({
    mutationFn: async (data: InventionIdeaFormData & { targetAudience: string[] }) => {
      const response = await apiRequest("/api/invention-ideas", {
        method: "POST",
        body: JSON.stringify(data),
      });
      return response as InventionIdea;
    },
    onSuccess: (idea) => {
      setSelectedIdea(idea);
      queryClient.invalidateQueries({ queryKey: ["/api/invention-ideas"] });
      toast({ title: "아이디어 저장 완료!", description: "콘텐츠 생성을 시작합니다." });
      generateContentMutation.mutate(idea.id);
    },
    onError: (error: Error) => {
      toast({ title: "저장 실패", description: error.message, variant: "destructive" });
    },
  });

  const generateContentMutation = useMutation({
    mutationFn: async (ideaId: string) => {
      const response = await apiRequest(`/api/invention-ideas/${ideaId}/generate`, {
        method: "POST",
      });
      return response as InventionContent;
    },
    onSuccess: (content) => {
      setGeneratedContent(content);
      queryClient.invalidateQueries({ queryKey: ["/api/invention-contents"] });
      toast({ title: "콘텐츠 생성 완료!", description: "인스타그램 카드, 숏츠 스크립트, 블로그가 생성되었습니다." });
    },
    onError: (error: Error) => {
      toast({ title: "생성 실패", description: error.message, variant: "destructive" });
    },
  });

  const deleteIdeaMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/invention-ideas/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invention-ideas"] });
      toast({ title: "삭제 완료" });
    },
  });

  const deleteContentMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/invention-contents/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invention-contents"] });
      setViewingContent(null);
      toast({ title: "삭제 완료" });
    },
  });

  const generateBlogMutation = useMutation({
    mutationFn: async (contentId: string) => {
      const response = await apiRequest(`/api/invention-contents/${contentId}/generate-blog`, {
        method: "POST",
      });
      return response as InventionContent;
    },
    onSuccess: (updatedContent) => {
      if (viewingContent) {
        setViewingContent(updatedContent);
      }
      if (generatedContent) {
        setGeneratedContent(updatedContent);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/invention-contents"] });
      toast({ title: "블로그 생성 완료!", description: "블로그 글이 성공적으로 생성되었습니다." });
    },
    onError: (error: Error) => {
      toast({ title: "블로그 생성 실패", description: error.message, variant: "destructive" });
    },
  });

  const recordUploadMutation = useMutation({
    mutationFn: async (data: { contentId: string; platform: string; notes?: string }) => {
      const response = await apiRequest("/api/upload-history", {
        method: "POST",
        body: JSON.stringify({ ...data, uploadType: "manual", status: "completed" }),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/upload-history"] });
      toast({ title: "업로드 기록 완료!" });
    },
  });

  const onSubmit = (data: InventionIdeaFormData) => {
    createIdeaMutation.mutate({
      ...data,
      targetAudience: selectedAudiences,
    });
  };

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      toast({ title: "복사 실패", variant: "destructive" });
    }
  };

  const handleDownloadImage = async (imageUrl: string, index: number) => {
    const content = generatedContent || viewingContent;
    if (!content) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const slide = content.instagramSlides?.[index] || "";
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 48px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      
      const maxWidth = canvas.width * 0.8;
      const words = slide.split("");
      let line = "";
      const lines: string[] = [];
      
      for (const word of words) {
        const testLine = line + word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && line !== "") {
          lines.push(line);
          line = word;
        } else {
          line = testLine;
        }
      }
      lines.push(line);
      
      const lineHeight = 60;
      const startY = canvas.height / 2 - (lines.length - 1) * lineHeight / 2;
      
      lines.forEach((l, i) => {
        ctx.fillText(l, canvas.width / 2, startY + i * lineHeight);
      });
      
      // Add AI watermark at bottom right
      const watermarkFontSize = Math.floor(canvas.width / 30);
      ctx.font = `${watermarkFontSize}px sans-serif`;
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.fillText("AI 생성", canvas.width - 15, canvas.height - 10);
      
      const dataUrl = canvas.toDataURL("image/png");
      downloadImageViaServer(dataUrl, `invention-slide-${index + 1}.png`).catch(() => {
        toast({ title: "다운로드 실패", description: "이미지 다운로드에 실패했습니다.", variant: "destructive" });
      });
    };
    img.src = imageUrl;
  };

  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [downloadAllProgress, setDownloadAllProgress] = useState(0);

  const handleDownloadAllImages = async () => {
    const content = generatedContent || viewingContent;
    if (!content?.instagramImageUrls || !content?.instagramSlides) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setIsDownloadingAll(true);
    setDownloadAllProgress(0);
    const total = content.instagramImageUrls.length;

    const renderAndDownload = (imageUrl: string, index: number): Promise<void> =>
      new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = async () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          const slide = content.instagramSlides?.[index] || "";
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 48px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const maxWidth = canvas.width * 0.8;
          const words = slide.split("");
          let line = "";
          const lines: string[] = [];
          for (const word of words) {
            const testLine = line + word;
            if (ctx.measureText(testLine).width > maxWidth && line !== "") {
              lines.push(line);
              line = word;
            } else {
              line = testLine;
            }
          }
          lines.push(line);
          const lineHeight = 60;
          const startY = canvas.height / 2 - (lines.length - 1) * lineHeight / 2;
          lines.forEach((l, i) => ctx.fillText(l, canvas.width / 2, startY + i * lineHeight));
          const wm = Math.floor(canvas.width / 30);
          ctx.font = `${wm}px sans-serif`;
          ctx.textAlign = "right";
          ctx.textBaseline = "bottom";
          ctx.fillStyle = "rgba(255,255,255,0.6)";
          ctx.fillText("AI 생성", canvas.width - 15, canvas.height - 10);

          const dataUrl = canvas.toDataURL("image/png");
          try {
            await downloadImageViaServer(dataUrl, `invention-slide-${index + 1}.png`);
          } catch {
            // continue even if one fails
          }
          setDownloadAllProgress(index + 1);
          // small delay so browser doesn't block multiple windows
          await new Promise(r => setTimeout(r, 600));
          resolve();
        };
        img.onerror = () => resolve();
        img.src = imageUrl;
      });

    for (let i = 0; i < total; i++) {
      await renderAndDownload(content.instagramImageUrls![i], i);
    }
    setIsDownloadingAll(false);
    toast({ title: "전체 다운로드 완료", description: `${total}장 이미지를 모두 다운로드했습니다.` });
  };

  const addAudience = (audience: string) => {
    if (!selectedAudiences.includes(audience)) {
      setSelectedAudiences([...selectedAudiences, audience]);
    }
  };

  const removeAudience = (audience: string) => {
    setSelectedAudiences(selectedAudiences.filter(a => a !== audience));
  };

  const resetForm = () => {
    form.reset();
    setSelectedAudiences([]);
    setGeneratedContent(null);
    setSelectedIdea(null);
    setViewingContent(null);
    setCurrentSlide(0);
    setGeneratedVideoUrl(null);
    setVideoProgress(0);
  };

  // ── AI 슬라이드 텍스트 편집 핸들러 ──────────────────────────
  const openSlideEditor = (content: InventionContent) => {
    setEditedSlides([...(content.instagramSlides ?? [])]);
    setManualSlideText((content.instagramSlides ?? [])[currentSlide] ?? "");
    setShowSlideEditor(true);
    setAiInstruction("");
  };

  const closeSlideEditor = () => {
    setShowSlideEditor(false);
    setEditedSlides([]);
  };

  const syncManualText = (idx: number, slides: string[]) => {
    setManualSlideText(slides[idx] ?? "");
  };

  const handleManualSave = async (contentId: string) => {
    const newSlides = [...editedSlides];
    newSlides[currentSlide] = manualSlideText;
    setEditedSlides(newSlides);
    try {
      const res = await fetch(`/api/invention-contents/${contentId}/edit-slides`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ slides: newSlides, instruction: "직접 수정" }),
      });
      if (!res.ok) throw new Error(await res.text());
      if (generatedContent?.id === contentId) setGeneratedContent({ ...generatedContent, instagramSlides: newSlides });
      if (viewingContent?.id === contentId) setViewingContent({ ...viewingContent, instagramSlides: newSlides });
      queryClient.invalidateQueries({ queryKey: ["/api/invention-contents"] });
      toast({ title: "저장 완료!", description: "슬라이드 텍스트가 저장되었습니다." });
    } catch {
      toast({ title: "저장 실패", variant: "destructive" });
    }
  };

  const handleAiSlideEdit = async (contentId: string) => {
    if (!aiInstruction.trim() || isAiEditing) return;
    setIsAiEditing(true);
    try {
      const body = {
        slides: editedSlides,
        instruction: aiInstruction,
        ...(editScope === "single" ? { slideIndex: currentSlide } : {}),
      };
      const res = await fetch(`/api/invention-contents/${contentId}/edit-slides`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      const { slides } = await res.json();
      setEditedSlides(slides);
      setManualSlideText(slides[currentSlide] ?? "");
      setAiInstruction("");
      if (generatedContent?.id === contentId) setGeneratedContent({ ...generatedContent, instagramSlides: slides });
      if (viewingContent?.id === contentId) setViewingContent({ ...viewingContent, instagramSlides: slides });
      queryClient.invalidateQueries({ queryKey: ["/api/invention-contents"] });
      toast({ title: "AI 수정 완료!", description: editScope === "single" ? "이 슬라이드가 수정되었습니다." : "전체 슬라이드가 수정되었습니다." });
    } catch {
      toast({ title: "AI 수정 실패", variant: "destructive" });
    } finally {
      setIsAiEditing(false);
    }
  };

  const createClassicalMusic = (
    audioCtx: AudioContext,
    dest: MediaStreamAudioDestinationNode,
    duration: number,
    volume = 0.10
  ) => {
    const masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
    masterGain.gain.linearRampToValueAtTime(volume, audioCtx.currentTime + 1.5);
    masterGain.connect(dest);

    // Soft reverb via feedback delay
    const delay = audioCtx.createDelay(0.6);
    delay.delayTime.setValueAtTime(0.35, audioCtx.currentTime);
    const delayFeedback = audioCtx.createGain();
    delayFeedback.gain.setValueAtTime(0.25, audioCtx.currentTime);
    const delayOut = audioCtx.createGain();
    delayOut.gain.setValueAtTime(0.18, audioCtx.currentTime);
    masterGain.connect(delay);
    delay.connect(delayFeedback);
    delayFeedback.connect(delay);
    delay.connect(delayOut);
    delayOut.connect(dest);

    // Piano-like additive synthesis
    const playNote = (freq: number, t: number, dur: number, vel = 1.0) => {
      const harmonics = [1, 2, 3, 4, 6, 8];
      const amps     = [1.0, 0.45, 0.22, 0.10, 0.05, 0.02];
      harmonics.forEach((h, i) => {
        const osc = audioCtx.createOscillator();
        const env = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq * h, t);
        const pk = amps[i] * vel;
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(pk, t + 0.009);
        env.gain.exponentialRampToValueAtTime(pk * 0.35, t + 0.08);
        env.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur * 0.88, 0.05));
        osc.connect(env);
        env.connect(masterGain);
        osc.start(t);
        osc.stop(t + dur + 0.05);
      });
    };

    // String pad for warmth (slow attack sine layer)
    const playPad = (freq: number, t: number, dur: number) => {
      const osc = audioCtx.createOscillator();
      const env = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.07, t + 0.6);
      env.gain.setValueAtTime(0.07, t + dur - 0.4);
      env.gain.linearRampToValueAtTime(0, t + dur);
      osc.connect(env);
      env.connect(masterGain);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    };

    // Bach C Major Prelude style (BWV 846) — 8 notes per measure arpeggio
    // Each entry: [bass, n1, n2, n3, n4, n5]
    const progression: number[][] = [
      [130.81, 261.63, 329.63, 392.00, 523.25, 659.25], // C major
      [130.81, 261.63, 293.66, 440.00, 587.33, 698.46], // Dm7/C
      [146.83, 261.63, 293.66, 440.00, 587.33, 698.46], // Dm7
      [196.00, 246.94, 293.66, 392.00, 493.88, 587.33], // G7
      [130.81, 261.63, 329.63, 392.00, 523.25, 659.25], // C major
      [130.81, 261.63, 349.23, 440.00, 523.25, 659.25], // Am/C
      [164.81, 261.63, 329.63, 415.30, 523.25, 622.25], // E7/B
      [220.00, 261.63, 329.63, 392.00, 523.25, 659.25], // Am
      [146.83, 261.63, 349.23, 440.00, 587.33, 698.46], // F/D
      [130.81, 261.63, 329.63, 392.00, 523.25, 659.25], // C major
      [174.61, 261.63, 349.23, 523.25, 698.46, 783.99], // F major
      [196.00, 246.94, 392.00, 493.88, 587.33, 783.99], // G major
    ];

    const arpPattern = [0, 2, 3, 4, 5, 4, 3, 4]; // indices into progression chord
    const noteTime = 0.21;                          // ~142 BPM 8th note
    const notesPerMeasure = 8;
    const start = audioCtx.currentTime + 0.3;
    // Cap at 80 notes (~17s) to avoid creating thousands of Web Audio nodes that crash the browser
    const totalNotes = Math.min(Math.ceil(duration / noteTime) + 16, 80);

    for (let i = 0; i < totalNotes; i++) {
      const measure = Math.floor(i / notesPerMeasure);
      const beatInMeasure = i % notesPerMeasure;
      const chordIdx = measure % progression.length;
      const chord = progression[chordIdx];
      const noteIdx = arpPattern[beatInMeasure];
      const freq = chord[Math.min(noteIdx, chord.length - 1)];
      const t = start + i * noteTime;
      const noteDur = noteTime * 1.6;
      const vel = beatInMeasure === 0 ? 0.9 : (beatInMeasure === 4 ? 0.7 : 0.55);
      playNote(freq, t, noteDur, vel);

      // Bass note on beat 1 of each measure
      if (beatInMeasure === 0) {
        playNote(chord[0], t, notesPerMeasure * noteTime * 0.9, 0.5);
        // Pad chord on beat 1
        [chord[2], chord[3]].forEach(pf => playPad(pf, t, notesPerMeasure * noteTime));
      }
    }
  };

  // 서버에서 ffmpeg로 직접 MP4 생성 (브라우저 captureStream/MediaRecorder 크래시 대체)
  const generateShortsVideo = async () => {
    const contentData = generatedContent || viewingContent;
    if (!contentData?.instagramImageUrls?.length || !contentData.shortsScenes) {
      toast({ title: "오류", description: "이미지와 스크립트가 필요합니다.", variant: "destructive" });
      return;
    }

    setIsGeneratingVideo(true);
    setVideoProgress(10);
    setVideoPhase("render");

    if (generatedVideoUrl) {
      URL.revokeObjectURL(generatedVideoUrl);
      setGeneratedVideoUrl(null);
    }

    try {
      toast({ title: "영상 생성 중...", description: "서버에서 MP4를 생성하고 있습니다. 30~60초 소요됩니다." });

      const res = await fetch(`/api/shorts-video/server-generate/${contentData.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          scenes: contentData.shortsScenes,
          imageUrls: contentData.instagramImageUrls,
        }),
      });

      setVideoProgress(80);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "영상 생성 실패" }));
        throw new Error(errData.error || "영상 생성 실패");
      }

      const data = await res.json();
      setVideoProgress(90);

      // MP4를 blob URL로 로드해 미리보기
      const videoRes = await fetch(data.url, { credentials: "include" });
      if (videoRes.ok) {
        const blob = await videoRes.blob();
        setGeneratedVideoUrl(URL.createObjectURL(blob));
      }

      setVideoProgress(100);
      queryClient.invalidateQueries({ queryKey: ["/api/invention-contents"] });
      toast({ title: "영상 생성 완료!", description: "서버에서 MP4 영상이 생성되었습니다." });
    } catch (err: any) {
      console.error("Video generation error:", err);
      toast({ title: "영상 생성 실패", description: err?.message || "오류가 발생했습니다.", variant: "destructive" });
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const saveVoiceToServer = async (arrayBuffer: ArrayBuffer, label: string) => {
    setIsSavingVoice(true);
    try {
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const audioBase64 = btoa(binary);
      const res = await fetch("/api/user-voice/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ audioBase64 }),
      });
      if (!res.ok) throw new Error("저장 실패");
      setStoredVoiceExists(true);
      setUploadedVoiceName(label);
      toast({ title: "목소리 저장 완료", description: "이 목소리로 숏츠 나레이션이 생성됩니다." });
    } catch (err: any) {
      toast({ title: "목소리 저장 실패", description: "서버 저장에 실패했습니다.", variant: "destructive" });
    } finally {
      setIsSavingVoice(false);
    }
  };

  const handleUploadVoice = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      setUploadedVoiceBuffer(arrayBuffer);
      await saveVoiceToServer(arrayBuffer, file.name);
    } catch (err: any) {
      toast({ title: "파일 읽기 실패", description: "음성 파일을 읽을 수 없습니다.", variant: "destructive" });
    }
  };

  const startMicRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      recordingMediaRecorderRef.current = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: mimeType });
        const buffer = await blob.arrayBuffer();
        setUploadedVoiceBuffer(buffer);
        const voiceName = `녹음된 음성 (${recordingSecondsRef.current}초)`;
        stream.getTracks().forEach(t => t.stop());
        await saveVoiceToServer(buffer, voiceName);
      };
      recorder.start(200);
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingSecondsRef.current = 0;
      recordingIntervalRef.current = setInterval(() => {
        recordingSecondsRef.current += 1;
        setRecordingSeconds(s => s + 1);
      }, 1000);
    } catch (err: any) {
      toast({ title: "마이크 오류", description: "마이크 권한을 허용해주세요.", variant: "destructive" });
    }
  };

  const stopMicRecording = () => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    if (recordingMediaRecorderRef.current && recordingMediaRecorderRef.current.state !== "inactive") {
      recordingMediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const cloneVoiceFromBuffer = async (buffer: ArrayBuffer, name: string, mimeType: string) => {
    setIsCloning(true);
    setClonedVoiceId(null);
    try {
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const audioBase64 = btoa(binary);
      const res = await fetch("/api/voices/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ audioBase64, mimeType, voiceName: name }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "복제 실패");
      }
      const { voiceId } = await res.json();
      setClonedVoiceId(voiceId);
      toast({ title: "목소리 복제 완료", description: "이제 영상 생성 시 내 목소리로 나레이션됩니다." });
    } catch (err: any) {
      toast({
        title: "목소리 복제 실패",
        description: "ElevenLabs API 키를 확인해주세요. (유효한 Creator 플랜 이상 필요)",
        variant: "destructive",
      });
    } finally {
      setIsCloning(false);
    }
  };

  const handleDownloadVideo = async () => {
    if (!generatedVideoUrl) return;
    try {
      toast({ title: "다운로드 준비 중", description: "영상을 서버에 전송하고 있습니다..." });
      const blob = await fetch(generatedVideoUrl).then(r => r.blob());
      const res = await fetch("/api/video-download/create?filename=youtube-shorts.webm", {
        method: "POST",
        headers: { "Content-Type": "video/webm" },
        body: blob,
      });
      if (!res.ok) throw new Error("upload failed");
      const { token } = await res.json();
      window.open(`/api/image-download/${token}`, "_blank");
      toast({ title: "다운로드 완료", description: "영상이 다운로드되었습니다." });
    } catch (e) {
      toast({ title: "다운로드 실패", description: "영상 다운로드에 실패했습니다.", variant: "destructive" });
    }
  };

  const content = generatedContent || viewingContent;
  const isLoading = createIdeaMutation.isPending || generateContentMutation.isPending;

  return (
    <div className="container mx-auto max-w-6xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Lightbulb className="w-8 h-8 text-primary" />
          발명 아이디어 콘텐츠
        </h1>
        <p className="text-muted-foreground" data-testid="text-page-description">
          발명 아이디어를 인스타그램 카드뉴스와 유튜브 숏츠 스크립트로 변환하세요
        </p>
      </div>

      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as "create" | "saved" | "videos" | "history")}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="create" data-testid="tab-create">
            <Plus className="w-4 h-4 mr-1.5" />
            새 콘텐츠
          </TabsTrigger>
          <TabsTrigger value="saved" data-testid="tab-saved">
            <Sparkles className="w-4 h-4 mr-1.5" />
            생성 기록
          </TabsTrigger>
          <TabsTrigger value="videos" data-testid="tab-videos">
            <Film className="w-4 h-4 mr-1.5" />
            숏츠 영상
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <History className="w-4 h-4 mr-1.5" />
            업로드 기록
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-6">
          {isLoadingContent ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4" data-testid="loading-content">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="text-muted-foreground">콘텐츠 불러오는 중...</p>
            </div>
          ) : !content ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle data-testid="text-form-title">발명 아이디어 입력</CardTitle>
                    <CardDescription>아이디어의 핵심 정보를 입력해주세요</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>발명 제목 *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="예: 스마트 우산 거치대"
                              data-testid="input-title"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="problem"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>해결하려는 문제 *</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="어떤 문제를 해결하나요?"
                              rows={3}
                              data-testid="input-problem"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="solution"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>해결 방법 *</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="어떻게 문제를 해결하나요?"
                              rows={3}
                              data-testid="input-solution"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="useCases"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>활용 분야 (선택)</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="어디에서 사용할 수 있나요?"
                              rows={2}
                              data-testid="input-use-cases"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle data-testid="text-settings-title">콘텐츠 설정</CardTitle>
                    <CardDescription>타겟 고객과 톤을 선택해주세요</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">타겟 고객</label>
                      <Select onValueChange={addAudience}>
                        <SelectTrigger data-testid="select-audience">
                          <SelectValue placeholder="타겟 고객 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          {targetAudienceOptions.map((option) => (
                            <SelectItem key={option} value={option} disabled={selectedAudiences.includes(option)} data-testid={`select-audience-option-${option}`}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {selectedAudiences.map((audience) => (
                          <Badge key={audience} variant="secondary" className="flex items-center gap-1" data-testid={`badge-audience-${audience}`}>
                            {audience}
                            <X className="w-3 h-3 cursor-pointer" onClick={() => removeAudience(audience)} data-testid={`button-remove-audience-${audience}`} />
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <FormField
                      control={form.control}
                      name="tone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>콘텐츠 톤</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="select-tone">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {toneOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value} data-testid={`select-tone-option-${option.value}`}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="pt-4">
                      <Button
                        type="submit"
                        disabled={isLoading}
                        className="w-full"
                        size="lg"
                        data-testid="button-generate"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            생성 중...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            콘텐츠 생성하기
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </form>
            </Form>
          ) : (
            <div className="space-y-6">
              <Button variant="ghost" onClick={resetForm} data-testid="button-back">
                <ChevronLeft className="w-4 h-4 mr-2" />
                새 아이디어 입력
              </Button>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2" data-testid="text-instagram-title">
                      <Instagram className="w-5 h-5" />
                      인스타그램 카드뉴스
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {content.instagramSlides && content.instagramSlides.length > 0 && (() => {
                      const displaySlides = showSlideEditor && editedSlides.length > 0 ? editedSlides : content.instagramSlides!;
                      const displayText = displaySlides[currentSlide] ?? "";
                      return (
                        <>
                          {/* Slide image + text preview */}
                          <div className="relative aspect-square rounded-lg overflow-hidden bg-gradient-to-br from-primary/20 to-primary/40" data-testid="preview-instagram-slide">
                            {content.instagramImageUrls && content.instagramImageUrls[currentSlide] ? (
                              <img
                                src={content.instagramImageUrls[currentSlide]}
                                alt={`Slide ${currentSlide + 1}`}
                                className="w-full h-full object-cover"
                                data-testid={`img-slide-${currentSlide}`}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600" />
                            )}
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-6">
                              <p className="text-white text-2xl font-bold text-center" data-testid="text-slide-content">
                                {displayText}
                              </p>
                            </div>
                            <div className="absolute bottom-2 right-2">
                              <span className="text-white/60 text-xs" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}>
                                AI 생성
                              </span>
                            </div>
                          </div>

                          {/* Navigation */}
                          <div className="flex items-center justify-between">
                            <Button variant="ghost" size="icon"
                              onClick={() => {
                                const next = Math.max(0, currentSlide - 1);
                                setCurrentSlide(next);
                                if (showSlideEditor) syncManualText(next, editedSlides);
                              }}
                              disabled={currentSlide === 0} data-testid="button-prev-slide">
                              <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <span className="text-sm text-muted-foreground" data-testid="text-slide-counter">
                              {currentSlide + 1} / {displaySlides.length}
                            </span>
                            <Button variant="ghost" size="icon"
                              onClick={() => {
                                const next = Math.min(displaySlides.length - 1, currentSlide + 1);
                                setCurrentSlide(next);
                                if (showSlideEditor) syncManualText(next, editedSlides);
                              }}
                              disabled={currentSlide === displaySlides.length - 1} data-testid="button-next-slide">
                              <ChevronRight className="w-4 h-4" />
                            </Button>
                          </div>

                          {/* Action buttons */}
                          <div className="flex flex-wrap gap-2">
                            {content.instagramImageUrls && content.instagramImageUrls[currentSlide] && (
                              <Button variant="outline" size="sm"
                                onClick={() => handleDownloadImage(content.instagramImageUrls![currentSlide], currentSlide)}
                                data-testid="button-download-slide">
                                <Download className="w-4 h-4 mr-2" />이 슬라이드
                              </Button>
                            )}
                            {content.instagramImageUrls && content.instagramImageUrls.length > 1 && (
                              <Button variant="outline" size="sm"
                                onClick={handleDownloadAllImages}
                                disabled={isDownloadingAll}
                                data-testid="button-download-all">
                                {isDownloadingAll ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    {downloadAllProgress}/{content.instagramImageUrls.length}
                                  </>
                                ) : (
                                  <>
                                    <Download className="w-4 h-4 mr-2" />전체 다운로드
                                  </>
                                )}
                              </Button>
                            )}
                            <Button variant="outline" size="sm"
                              onClick={() => handleCopy(displayText, `slide-${currentSlide}`)}
                              data-testid="button-copy-slide">
                              {copiedField === `slide-${currentSlide}` ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                              텍스트 복사
                            </Button>
                            <Button variant={showSlideEditor ? "default" : "outline"} size="sm"
                              onClick={() => showSlideEditor ? closeSlideEditor() : openSlideEditor(content)}
                              data-testid="button-toggle-slide-editor">
                              <Wand2 className="w-4 h-4 mr-2" />
                              {showSlideEditor ? "편집 닫기" : "AI 편집"}
                            </Button>
                          </div>

                          {/* AI Slide Editor Panel */}
                          {showSlideEditor && (
                            <div className="rounded-md border bg-muted/30 p-4 space-y-3" data-testid="panel-slide-editor">
                              <div className="flex items-center gap-2">
                                <PenLine className="w-4 h-4 text-primary" />
                                <span className="text-sm font-semibold">슬라이드 텍스트 편집</span>
                              </div>

                              {/* Manual text edit */}
                              <div className="space-y-1.5">
                                <label className="text-xs text-muted-foreground">슬라이드 {currentSlide + 1} 직접 수정</label>
                                <Textarea
                                  value={manualSlideText}
                                  onChange={e => setManualSlideText(e.target.value)}
                                  rows={3}
                                  className="text-sm resize-none"
                                  data-testid="input-manual-slide-text"
                                />
                                <Button size="sm" variant="outline" onClick={() => handleManualSave(content.id)} data-testid="button-manual-save">
                                  <Check className="w-3.5 h-3.5 mr-1.5" />저장
                                </Button>
                              </div>

                              {/* Divider */}
                              <div className="border-t pt-3 space-y-2">
                                <div className="flex items-center gap-2">
                                  <Wand2 className="w-4 h-4 text-primary" />
                                  <span className="text-xs font-semibold">AI 자동 수정</span>
                                </div>

                                {/* Scope toggle */}
                                <div className="flex gap-1">
                                  {(["single", "all"] as const).map(s => (
                                    <Button key={s} size="sm" variant={editScope === s ? "default" : "outline"}
                                      className="h-7 text-xs px-3"
                                      onClick={() => setEditScope(s)}
                                      data-testid={`button-scope-${s}`}>
                                      {s === "single" ? `슬라이드 ${currentSlide + 1}만` : "전체 슬라이드"}
                                    </Button>
                                  ))}
                                </div>

                                {/* Quick presets */}
                                <div className="flex flex-wrap gap-1">
                                  {["더 감성적으로", "더 간결하게", "더 흥미롭게", "전문적으로", "영어로 번역", "친근하게"].map(preset => (
                                    <button key={preset}
                                      className="text-xs px-2 py-0.5 rounded-full border border-border bg-background hover:bg-accent transition-colors"
                                      onClick={() => setAiInstruction(preset)}
                                      data-testid={`preset-${preset}`}>
                                      {preset}
                                    </button>
                                  ))}
                                </div>

                                {/* Instruction input */}
                                <div className="flex gap-2">
                                  <Textarea
                                    value={aiInstruction}
                                    onChange={e => setAiInstruction(e.target.value)}
                                    placeholder="예: 더 감성적으로 바꿔줘, 영어로 번역해줘, 해시태그 넣어줘..."
                                    rows={2}
                                    className="text-sm resize-none flex-1"
                                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAiSlideEdit(content.id); }}}
                                    data-testid="input-ai-instruction"
                                  />
                                  <Button size="icon" onClick={() => handleAiSlideEdit(content.id)}
                                    disabled={isAiEditing || !aiInstruction.trim()}
                                    data-testid="button-ai-send">
                                    {isAiEditing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}

                    <div className="space-y-2">
                      <label className="text-sm font-medium">캡션</label>
                      <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap" data-testid="text-caption">
                        {content.instagramCaption}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy(content.instagramCaption || "", "caption")}
                        data-testid="button-copy-caption"
                      >
                        {copiedField === "caption" ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                        캡션 복사
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">해시태그</label>
                      <div className="flex flex-wrap gap-1" data-testid="container-hashtags">
                        {content.instagramHashtags?.map((tag, i) => (
                          <Badge key={i} variant="secondary" data-testid={`badge-hashtag-${i}`}>#{tag}</Badge>
                        ))}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy(content.instagramHashtags?.map(t => `#${t}`).join(" ") || "", "hashtags")}
                        data-testid="button-copy-hashtags"
                      >
                        {copiedField === "hashtags" ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                        해시태그 복사
                      </Button>
                    </div>

                    <Button
                      className="w-full"
                      onClick={() => recordUploadMutation.mutate({ contentId: content.id, platform: "instagram" })}
                      disabled={recordUploadMutation.isPending}
                      data-testid="button-record-instagram-upload"
                    >
                      <Instagram className="w-4 h-4 mr-2" />
                      인스타그램 업로드 완료 기록
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2" data-testid="text-shorts-title">
                      <Video className="w-5 h-5" />
                      유튜브 숏츠 스크립트
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* 조회수 폭발 전략 카드 */}
                    <div className="rounded-md bg-primary/5 border border-primary/20 p-3 space-y-3">
                      <p className="text-xs font-semibold text-primary uppercase tracking-wide">조회수 폭발 전략</p>

                      {/* 유튜브 제목 */}
                      {content.shortsTitle && (
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground font-medium">유튜브 제목</label>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold flex-1" data-testid="text-shorts-title-val">{content.shortsTitle}</p>
                            <Button variant="ghost" size="icon" onClick={() => handleCopy(content.shortsTitle || "", "shortsTitle")} data-testid="button-copy-shorts-title">
                              {copiedField === "shortsTitle" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* 처음 3초 훅 */}
                      {content.shortsHook && (
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground font-medium">처음 3초 훅</label>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-bold text-primary flex-1" data-testid="text-shorts-hook">"{content.shortsHook}"</p>
                            <Button variant="ghost" size="icon" onClick={() => handleCopy(content.shortsHook || "", "shortsHook")} data-testid="button-copy-hook">
                              {copiedField === "shortsHook" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* 해시태그 */}
                      {content.shortsHashtags && content.shortsHashtags.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-xs text-muted-foreground font-medium">해시태그 (정확히 사용)</label>
                            <Button variant="ghost" size="sm" className="h-6 text-xs px-2"
                              onClick={() => handleCopy(content.shortsHashtags!.join(" "), "shortsHashtags")}
                              data-testid="button-copy-shorts-hashtags">
                              {copiedField === "shortsHashtags" ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}전체 복사
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-1.5" data-testid="container-shorts-hashtags">
                            {content.shortsHashtags.map((tag, i) => (
                              <Badge key={i} variant="secondary" className="text-xs cursor-pointer"
                                onClick={() => handleCopy(tag, `stag-${i}`)}
                                data-testid={`badge-shorts-tag-${i}`}>
                                {copiedField === `stag-${i}` ? <Check className="w-3 h-3 mr-1" /> : null}
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 예상 길이 */}
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">예상 길이</label>
                      <Badge data-testid="badge-duration">{content.shortsDuration}</Badge>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">전체 스크립트</label>
                      <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap max-h-40 overflow-auto" data-testid="text-shorts-script">
                        {content.shortsScript}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy(content.shortsScript || "", "script")}
                        data-testid="button-copy-script"
                      >
                        {copiedField === "script" ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                        스크립트 복사
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">씬 구성</label>
                      <div className="space-y-3" data-testid="container-scenes">
                        {(content.shortsScenes as ShortsScene[] | null)?.map((scene) => (
                          <div key={scene.scene} className="p-3 border rounded-lg space-y-1" data-testid={`scene-${scene.scene}`}>
                            <div className="flex items-center justify-between">
                              <span className="font-medium" data-testid={`text-scene-number-${scene.scene}`}>씬 {scene.scene}</span>
                              <Badge variant="outline" data-testid={`badge-scene-duration-${scene.scene}`}>{scene.duration}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground" data-testid={`text-scene-description-${scene.scene}`}>{scene.description}</p>
                            <p className="text-sm italic" data-testid={`text-scene-narration-${scene.scene}`}>"{scene.narration}"</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3 pt-4 border-t">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Film className="w-4 h-4" />
                        숏츠 영상 (나레이션 + 배경음악 포함)
                      </label>

                      {isGeneratingVideo && (
                        <div className="space-y-2">
                          <Progress value={videoProgress} className="w-full" data-testid="progress-video" />
                          <p className="text-sm text-muted-foreground text-center">
                            {videoPhase === "tts" && `나레이션 음성 생성 중... ${Math.round(videoProgress)}%`}
                            {videoPhase === "images" && `이미지 불러오는 중... ${Math.round(videoProgress)}%`}
                            {videoPhase === "render" && `영상 렌더링 중... ${Math.round(videoProgress)}%`}
                          </p>
                          <div className="flex gap-1 text-xs text-muted-foreground justify-center">
                            <span className={videoPhase === "tts" ? "text-primary font-medium" : "opacity-50"}>① 음성생성</span>
                            <span className="opacity-30">→</span>
                            <span className={videoPhase === "images" ? "text-primary font-medium" : "opacity-50"}>② 이미지</span>
                            <span className="opacity-30">→</span>
                            <span className={videoPhase === "render" ? "text-primary font-medium" : "opacity-50"}>③ 영상합성</span>
                          </div>
                        </div>
                      )}

                      {generatedVideoUrl && (
                        <div className="space-y-3">
                          <div className="aspect-[9/16] max-h-[400px] rounded-lg overflow-hidden bg-black relative">
                            <video
                              ref={videoRef}
                              key={generatedVideoUrl}
                              controls
                              playsInline
                              preload="metadata"
                              className="w-full h-full object-contain"
                              data-testid="video-preview"
                              onError={(e) => {
                                const vid = e.currentTarget;
                                console.error("Video error:", vid.error?.code, vid.error?.message);
                              }}
                            >
                              <source src={generatedVideoUrl!} type="video/webm" />
                            </video>
                            <div className="absolute bottom-8 right-2 pointer-events-none">
                              <span className="text-white/60 text-xs" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}>
                                AI 생성
                              </span>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={handleDownloadVideo}
                            data-testid="button-download-video"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            영상 다운로드 (.webm)
                          </Button>
                        </div>
                      )}

                      {/* Voice cloning section */}
                      <div className="rounded-md border p-3 space-y-2.5 bg-muted/30">
                        <p className="text-xs font-medium flex items-center gap-1.5">
                          <Mic className="w-3.5 h-3.5" />
                          나레이션 목소리 설정
                        </p>

                        {isSavingVoice ? (
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            목소리 저장 중...
                          </p>
                        ) : (uploadedVoiceBuffer || storedVoiceExists) ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[11px] text-green-600 dark:text-green-400 flex items-center gap-1">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />
                                {uploadedVoiceName || "목소리 파일"} 등록됨
                              </p>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-[10px] px-2"
                                onClick={async () => {
                                  setUploadedVoiceBuffer(null);
                                  setUploadedVoiceName("");
                                  setClonedVoiceId(null);
                                  setStoredVoiceExists(false);
                                  setUseDirectVoice(false);
                                  await fetch("/api/user-voice/save", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    credentials: "include",
                                    body: JSON.stringify({ audioBase64: "" }),
                                  }).catch(() => {});
                                }}
                              >
                                초기화
                              </Button>
                            </div>
                            {/* Voice mode toggle */}
                            <div className="flex gap-1.5">
                              <Button
                                size="sm"
                                variant={!useDirectVoice ? "default" : "outline"}
                                className="flex-1 text-[11px] h-7"
                                onClick={() => setUseDirectVoice(false)}
                                data-testid="button-voice-mode-ai"
                              >
                                AI 음성 나레이션
                              </Button>
                              <Button
                                size="sm"
                                variant={useDirectVoice ? "default" : "outline"}
                                className="flex-1 text-[11px] h-7"
                                onClick={() => setUseDirectVoice(true)}
                                data-testid="button-voice-mode-direct"
                              >
                                내 목소리 그대로
                              </Button>
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                              {useDirectVoice
                                ? "업로드한 음성 파일이 영상 오디오로 그대로 삽입됩니다."
                                : "AI가 나레이션 텍스트를 읽어드립니다."}
                            </p>
                          </div>
                        ) : (
                          <p className="text-[11px] text-muted-foreground">
                            목소리 파일을 업로드하거나 녹음하면 AI 음성 나레이션 또는 내 목소리를 직접 영상에 적용할 수 있습니다.
                          </p>
                        )}

                        {!uploadedVoiceBuffer && !storedVoiceExists && !isSavingVoice && (
                          <div className="flex gap-2">
                            <input
                              ref={voiceInputRef}
                              type="file"
                              accept="audio/*"
                              className="hidden"
                              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadVoice(f); e.target.value = ""; }}
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 text-[11px]"
                              onClick={() => voiceInputRef.current?.click()}
                              disabled={isCloning}
                              data-testid="button-upload-voice"
                            >
                              <Upload className="w-3 h-3 mr-1" />
                              음성 파일 업로드
                            </Button>
                            <Button
                              size="sm"
                              variant={isRecording ? "destructive" : "outline"}
                              className="flex-1 text-[11px]"
                              onClick={isRecording ? stopMicRecording : startMicRecording}
                              disabled={isCloning}
                              data-testid="button-mic-record"
                            >
                              <Mic className="w-3 h-3 mr-1" />
                              {isRecording ? `녹음 중... ${recordingSeconds}초` : "마이크 녹음"}
                            </Button>
                          </div>
                        )}

                        {isCloning && (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary animate-pulse w-2/3 rounded-full" />
                            </div>
                            <span className="text-[10px] text-muted-foreground">ElevenLabs 복제 중...</span>
                          </div>
                        )}
                      </div>

                      <Button
                        variant={generatedVideoUrl ? "outline" : "default"}
                        className="w-full"
                        onClick={generateShortsVideo}
                        disabled={isGeneratingVideo || !content.instagramImageUrls || !content.shortsScenes}
                        data-testid="button-generate-video"
                      >
                        <Film className="w-4 h-4 mr-2" />
                        {generatedVideoUrl ? "영상 재생성하기 (음성+음악 포함)" : "음성·음악 포함 영상 생성하기"}
                      </Button>
                    </div>

                    <Button
                      className="w-full"
                      onClick={() => recordUploadMutation.mutate({ contentId: content.id, platform: "youtube" })}
                      disabled={recordUploadMutation.isPending}
                      data-testid="button-record-youtube-upload"
                    >
                      <Video className="w-4 h-4 mr-2" />
                      유튜브 업로드 완료 기록
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2" data-testid="text-blog-title">
                    <FileText className="w-5 h-5" />
                    블로그 글
                  </CardTitle>
                  {content.blogMetaDescription && (
                    <CardDescription data-testid="text-blog-meta">{content.blogMetaDescription}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {content.blogHtml ? (
                    <>
                      {content.blogTitle && (
                        <div className="space-y-2">
                          <label className="text-sm font-medium">제목</label>
                          <div className="p-3 bg-muted rounded-lg font-semibold" data-testid="text-blog-heading">
                            {content.blogTitle}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopy(content.blogTitle || "", "blogTitle")}
                            data-testid="button-copy-blog-title"
                          >
                            {copiedField === "blogTitle" ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                            제목 복사
                          </Button>
                        </div>
                      )}

                      <div className="space-y-2">
                        <label className="text-sm font-medium">본문</label>
                        <div
                          className="p-4 bg-muted rounded-lg text-sm prose prose-sm max-w-none max-h-[500px] overflow-auto dark:prose-invert"
                          dangerouslySetInnerHTML={{ __html: content.blogHtml }}
                          data-testid="container-blog-html"
                        />
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopy(content.blogHtml || "", "blogHtml")}
                            data-testid="button-copy-blog-html"
                          >
                            {copiedField === "blogHtml" ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                            HTML 복사
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopy(content.blogContent || "", "blogContent")}
                            data-testid="button-copy-blog-content"
                          >
                            {copiedField === "blogContent" ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                            텍스트 복사
                          </Button>
                          <Button
                            size="sm"
                            className="bg-orange-500 hover:bg-orange-600 text-white"
                            onClick={async () => {
                              await navigator.clipboard.writeText(stripBase64Images(content.blogHtml || content.blogContent || ""));
                              window.open("https://inloglab.tistory.com/manage/newpost/", "_blank");
                            }}
                          >
                            <span className="font-bold mr-1">T</span> 티스토리
                          </Button>
                        </div>
                      </div>

                      {content.blogHashtags && content.blogHashtags.length > 0 && (
                        <div className="space-y-2">
                          <label className="text-sm font-medium">해시태그</label>
                          <div className="flex flex-wrap gap-1" data-testid="container-blog-hashtags">
                            {content.blogHashtags.map((tag, i) => (
                              <Badge key={i} variant="secondary" data-testid={`badge-blog-hashtag-${i}`}>#{tag}</Badge>
                            ))}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopy(content.blogHashtags?.map(t => `#${t}`).join(" ") || "", "blogHashtags")}
                            data-testid="button-copy-blog-hashtags"
                          >
                            {copiedField === "blogHashtags" ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                            해시태그 복사
                          </Button>
                        </div>
                      )}

                      <Button
                        className="w-full"
                        onClick={() => recordUploadMutation.mutate({ contentId: content.id, platform: "blog" })}
                        disabled={recordUploadMutation.isPending}
                        data-testid="button-record-blog-upload"
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        블로그 업로드 완료 기록
                      </Button>
                    </>
                  ) : (
                    <div className="text-center py-8 space-y-4">
                      <p className="text-muted-foreground text-sm">
                        아직 블로그 글이 생성되지 않았습니다
                      </p>
                      <Button
                        onClick={() => generateBlogMutation.mutate(content.id)}
                        disabled={generateBlogMutation.isPending}
                        data-testid="button-generate-blog"
                      >
                        {generateBlogMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            블로그 생성 중...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            블로그 글 생성하기
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="saved" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle data-testid="text-saved-title">생성된 콘텐츠</CardTitle>
              <CardDescription>이전에 생성한 콘텐츠를 확인하세요</CardDescription>
            </CardHeader>
            <CardContent>
              {contentsQuery.isLoading ? (
                <div className="flex justify-center py-8" data-testid="loading-contents">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : contentsQuery.data && contentsQuery.data.length > 0 ? (
                <div className="space-y-3">
                  {contentsQuery.data.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover-elevate cursor-pointer"
                      onClick={async () => {
                        setGeneratedContent(null);
                        setMainTab("create");
                        setIsLoadingContent(true);
                        try {
                          const res = await fetch(`/api/invention-contents/${item.id}`, { credentials: "include" });
                          const full = await res.json();
                          setViewingContent(full);
                        } catch {
                          setViewingContent(item as any);
                        } finally {
                          setIsLoadingContent(false);
                        }
                      }}
                      data-testid={`content-item-${item.id}`}
                    >
                      <div className="flex-1">
                        <p className="font-medium" data-testid={`text-content-title-${item.id}`}>{item.instagramSlides?.[0] || "콘텐츠"}</p>
                        <p className="text-sm text-muted-foreground" data-testid={`text-content-date-${item.id}`}>
                          {item.createdAt ? new Date(item.createdAt).toLocaleDateString("ko-KR") : "날짜 없음"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" data-testid={`button-view-content-${item.id}`}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteContentMutation.mutate(item.id);
                          }}
                          data-testid={`button-delete-content-${item.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground" data-testid="text-no-contents">
                  생성된 콘텐츠가 없습니다
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── 숏츠 영상 목록 탭 ─── */}
        <TabsContent value="videos" className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">저장된 숏츠 영상</h2>
              <p className="text-sm text-muted-foreground">생성된 유튜브 숏츠 영상 목록입니다. 영상은 서버에 자동 저장됩니다.</p>
            </div>
            {isSavingVideo && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                저장 중...
              </div>
            )}
          </div>

          {contentsQuery.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (() => {
            const videoContents = (contentsQuery.data ?? []).filter(c => c.shortsVideoUrl);
            if (videoContents.length === 0) {
              return (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
                    <Film className="w-10 h-10 text-muted-foreground/50" />
                    <p className="text-muted-foreground">저장된 숏츠 영상이 없습니다.</p>
                    <p className="text-sm text-muted-foreground">콘텐츠를 생성하고 영상을 만들면 여기에 자동으로 저장됩니다.</p>
                    <Button size="sm" variant="outline" onClick={() => setMainTab("create")}>
                      <Plus className="w-4 h-4 mr-2" />
                      콘텐츠 만들기
                    </Button>
                  </CardContent>
                </Card>
              );
            }
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {videoContents.map((item) => {
                  const idea = ideasQuery.data?.find(i => i.id === item.ideaId);
                  return (
                    <Card key={item.id} data-testid={`video-card-${item.id}`} className="overflow-hidden">
                      <div className="aspect-[9/16] max-h-[300px] bg-black flex items-center justify-center">
                        <video
                          src={item.shortsVideoUrl!}
                          controls
                          playsInline
                          preload="metadata"
                          className="w-full h-full object-contain"
                          data-testid={`video-player-${item.id}`}
                        >
                          <source src={item.shortsVideoUrl!} type="video/webm" />
                        </video>
                      </div>
                      <CardContent className="p-3 space-y-2">
                        <div>
                          <p className="font-medium text-sm line-clamp-1" data-testid={`text-video-title-${item.id}`}>
                            {idea?.title || "발명 아이디어"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.createdAt ? new Date(item.createdAt).toLocaleDateString("ko-KR", {
                              year: "numeric", month: "long", day: "numeric"
                            }) : ""}
                          </p>
                        </div>

                        {/* Instagram MP4 conversion rows */}
                        <div className="rounded-md bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border border-pink-200/60 dark:border-pink-800/40 p-2 space-y-1.5">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Instagram className="w-3.5 h-3.5 text-pink-500" />
                            <span className="text-[11px] font-semibold text-pink-700 dark:text-pink-300">인스타그램 MP4 변환</span>
                          </div>
                          {/* Reels row: 9:16 */}
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-muted-foreground">릴스 9:16 (1080×1920) — 모바일 앱</span>
                            {mp4ReadyIds.has(item.id) ? (
                              <Button size="sm" variant="outline"
                                className="h-6 text-[11px] px-2 border-pink-300 text-pink-700 dark:text-pink-300"
                                onClick={() => handleDownloadMp4(item.id, "reels")}
                                data-testid={`button-download-reels-${item.id}`}
                              >
                                <Download className="w-3 h-3 mr-1" />다운로드
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline"
                                className="h-6 text-[11px] px-2 border-pink-300 text-pink-700 dark:text-pink-300"
                                disabled={convertingMp4Ids.has(item.id)}
                                onClick={() => handleConvertMp4(item.id, "reels")}
                                data-testid={`button-convert-mp4-${item.id}`}
                              >
                                {convertingMp4Ids.has(item.id)
                                  ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />변환 중...</>
                                  : <><Film className="w-3 h-3 mr-1" />변환</>}
                              </Button>
                            )}
                          </div>
                          {/* Feed row: 4:5 */}
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-muted-foreground">피드 4:5 (1080×1350) — 모든 플랫폼</span>
                            {feedReadyIds.has(item.id) ? (
                              <Button size="sm" variant="outline"
                                className="h-6 text-[11px] px-2 border-pink-300 text-pink-700 dark:text-pink-300"
                                onClick={() => handleDownloadMp4(item.id, "feed")}
                                data-testid={`button-download-feed-${item.id}`}
                              >
                                <Download className="w-3 h-3 mr-1" />다운로드
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline"
                                className="h-6 text-[11px] px-2 border-pink-300 text-pink-700 dark:text-pink-300"
                                disabled={convertingFeedIds.has(item.id)}
                                onClick={() => handleConvertMp4(item.id, "feed")}
                                data-testid={`button-convert-feed-${item.id}`}
                              >
                                {convertingFeedIds.has(item.id)
                                  ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />변환 중...</>
                                  : <><Film className="w-3 h-3 mr-1" />변환</>}
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* WebM download + delete row */}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            data-testid={`button-download-video-${item.id}`}
                            onClick={async () => {
                              try {
                                const blob = await fetch(item.shortsVideoUrl!, { credentials: "include" }).then(r => r.blob());
                                const res = await fetch("/api/video-download/create?filename=youtube-shorts.webm", {
                                  method: "POST",
                                  headers: { "Content-Type": "video/webm" },
                                  credentials: "include",
                                  body: blob,
                                });
                                if (!res.ok) throw new Error();
                                const { token } = await res.json();
                                window.open(`/api/image-download/${token}`, "_blank");
                              } catch {
                                toast({ title: "다운로드 실패", variant: "destructive" });
                              }
                            }}
                          >
                            <Download className="w-3.5 h-3.5 mr-1.5" />
                            WebM
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            data-testid={`button-delete-video-${item.id}`}
                            onClick={async () => {
                              if (!confirm("영상을 삭제하시겠습니까?")) return;
                              try {
                                const res = await fetch(`/api/shorts-video/${item.id}`, {
                                  method: "DELETE",
                                  credentials: "include",
                                });
                                if (!res.ok) throw new Error();
                                setMp4ReadyIds(prev => { const s = new Set(prev); s.delete(item.id); return s; });
                                queryClient.invalidateQueries({ queryKey: ["/api/invention-contents"] });
                                toast({ title: "삭제 완료", description: "영상이 삭제되었습니다." });
                              } catch {
                                toast({ title: "삭제 실패", variant: "destructive" });
                              }
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            );
          })()}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle data-testid="text-history-title">업로드 기록</CardTitle>
              <CardDescription>SNS에 업로드한 콘텐츠 기록입니다</CardDescription>
            </CardHeader>
            <CardContent>
              {uploadHistoryQuery.isLoading ? (
                <div className="flex justify-center py-8" data-testid="loading-history">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : uploadHistoryQuery.data && uploadHistoryQuery.data.length > 0 ? (
                <div className="space-y-3">
                  {uploadHistoryQuery.data.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                      data-testid={`history-item-${item.id}`}
                    >
                      <div className="flex items-center gap-3">
                        {item.platform === "instagram" ? (
                          <Instagram className="w-5 h-5 text-pink-500" />
                        ) : item.platform === "blog" ? (
                          <FileText className="w-5 h-5 text-green-500" />
                        ) : (
                          <Video className="w-5 h-5 text-red-500" />
                        )}
                        <div>
                          <p className="font-medium capitalize" data-testid={`text-history-platform-${item.id}`}>{item.platform}</p>
                          <p className="text-sm text-muted-foreground" data-testid={`text-history-date-${item.id}`}>
                            {item.createdAt ? new Date(item.createdAt).toLocaleDateString("ko-KR") : "날짜 없음"}
                          </p>
                        </div>
                      </div>
                      <Badge variant={item.status === "completed" ? "default" : "secondary"} data-testid={`badge-history-status-${item.id}`}>
                        {item.status === "completed" ? "완료" : item.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground" data-testid="text-no-history">
                  업로드 기록이 없습니다
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <canvas ref={canvasRef} className="hidden" />
      {/* videoCanvasRef must NOT use display:none — captureStream() requires the canvas to be rendered */}
      <canvas ref={videoCanvasRef} style={{ position: "fixed", left: "-20000px", top: 0, opacity: 0, pointerEvents: "none" }} />
    </div>
  );
}
