import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Youtube, LogIn, LogOut, CheckCircle, Film, Upload } from "lucide-react";

interface YouTubeUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scriptureId: string;
  verseReference: string;
  bibleVerse: string;
  coreMessage?: string;
  hashtags?: string[];
  imageUrls?: string[];
}

// Canvas로 말씀 이미지 슬라이드쇼 영상 생성
async function createScriptureVideo(
  imageUrls: string[],
  verseReference: string,
  bibleVerse: string
): Promise<string | null> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920; // 9:16 Shorts 비율
    const ctx = canvas.getContext("2d")!;

    const chunks: Blob[] = [];
    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm; codecs=vp9" });

    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    };

    const images: HTMLImageElement[] = [];
    let loadedCount = 0;
    const targetImages = imageUrls.slice(0, 5);

    const drawFrame = (imgIndex: number, frameCount: number) => {
      const img = images[imgIndex] || images[0];
      if (!img) return;

      // 배경
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, 0, 1080, 1920);

      // 이미지 (중앙 상단)
      const imgSize = 900;
      const imgX = (1080 - imgSize) / 2;
      const imgY = 200;
      ctx.drawImage(img, imgX, imgY, imgSize, imgSize);

      // 말씀 배경
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.roundRect(60, 1180, 960, 680, 20);
      ctx.fill();

      // 성경 출처
      ctx.fillStyle = "#f0c040";
      ctx.font = "bold 48px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(verseReference, 540, 1260);

      // 말씀 텍스트
      ctx.fillStyle = "#ffffff";
      ctx.font = "40px sans-serif";
      const words = bibleVerse.split(" ");
      let line = "";
      let y = 1330;
      for (const word of words) {
        const test = line + word + " ";
        if (ctx.measureText(test).width > 860 && line) {
          ctx.fillText(line.trim(), 540, y);
          y += 56;
          line = word + " ";
        } else {
          line = test;
        }
      }
      if (line) ctx.fillText(line.trim(), 540, y);

      // ContentPilot 워터마크
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "28px sans-serif";
      ctx.fillText("ContentPilot", 540, 1820);
    };

    const startRecording = () => {
      recorder.start();
      let frame = 0;
      const totalFrames = 150; // 5초 @ 30fps
      const imgCount = Math.max(1, images.length);

      const tick = () => {
        const imgIdx = Math.floor((frame / totalFrames) * imgCount) % imgCount;
        drawFrame(imgIdx, frame);
        frame++;
        if (frame < totalFrames) requestAnimationFrame(tick);
        else recorder.stop();
      };
      requestAnimationFrame(tick);
    };

    if (targetImages.length === 0) {
      // 이미지 없을 때 텍스트만
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, 0, 1080, 1920);
      startRecording();
      return;
    }

    for (const url of targetImages) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        images.push(img);
        loadedCount++;
        if (loadedCount === targetImages.length) startRecording();
      };
      img.onerror = () => {
        loadedCount++;
        if (loadedCount === targetImages.length) startRecording();
      };
      img.src = url;
    }
  });
}

export default function YouTubeUploadDialog({
  open, onOpenChange, scriptureId, verseReference, bibleVerse,
  coreMessage = "", hashtags = [], imageUrls = [],
}: YouTubeUploadDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(`${verseReference} - 오늘의 말씀`);
  const [description, setDescription] = useState(`${bibleVerse}\n\n${coreMessage}`);
  const [privacy, setPrivacy] = useState("private");
  const [videoData, setVideoData] = useState<string | null>(null);
  const [isCreatingVideo, setIsCreatingVideo] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);

  useEffect(() => {
    if (open) {
      setTitle(`${verseReference} - 오늘의 말씀`);
      setDescription(`${bibleVerse}\n\n${coreMessage}\n\n${hashtags.map(h => `#${h}`).join(" ")}`);
      setVideoData(null);
      setUploadResult(null);
    }
  }, [open, verseReference, bibleVerse, coreMessage, hashtags]);

  const statusQuery = useQuery<{ isConfigured: boolean; isAuthenticated: boolean }>({
    queryKey: ["/api/youtube-upload/status"],
    enabled: open,
  });

  const authUrlQuery = useQuery<{ authUrl: string }>({
    queryKey: ["/api/youtube-upload/auth-url"],
    enabled: open && statusQuery.data?.isConfigured && !statusQuery.data?.isAuthenticated,
  });

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest("/api/youtube-upload/logout", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/youtube-upload/status"] });
      toast({ title: "YouTube 로그아웃 완료" });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: string) => {
      return apiRequest(`/api/youtube-upload/scripture/${scriptureId}`, {
        method: "POST",
        body: JSON.stringify({
          title,
          description,
          tags: hashtags,
          privacyStatus: privacy,
          videoDataUrl: data,
        }),
      });
    },
    onSuccess: (result: any) => {
      setUploadResult(result);
      if (result.success) {
        toast({ title: "YouTube 업로드 완료!", description: `영상 ID: ${result.videoId}` });
      } else {
        toast({ title: "업로드 실패", description: result.error, variant: "destructive" });
      }
    },
    onError: (e: Error) => toast({ title: "업로드 실패", description: e.message, variant: "destructive" }),
  });

  const handleCreateVideo = async () => {
    setIsCreatingVideo(true);
    try {
      const data = await createScriptureVideo(imageUrls, verseReference, bibleVerse);
      setVideoData(data);
      toast({ title: "영상 생성 완료!", description: "아래 업로드 버튼을 클릭하세요." });
    } catch (e: any) {
      toast({ title: "영상 생성 실패", description: e.message, variant: "destructive" });
    } finally {
      setIsCreatingVideo(false);
    }
  };

  const handleLogin = () => {
    if (authUrlQuery.data?.authUrl) {
      const popup = window.open(authUrlQuery.data.authUrl, "youtube-auth", "width=500,height=600");
      const handler = (e: MessageEvent) => {
        if (e.data?.type === "youtube-auth-success") {
          queryClient.invalidateQueries({ queryKey: ["/api/youtube-upload/status"] });
          window.removeEventListener("message", handler);
        }
      };
      window.addEventListener("message", handler);
    }
  };

  const isAuthenticated = statusQuery.data?.isAuthenticated;
  const isConfigured = statusQuery.data?.isConfigured;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Youtube className="w-5 h-5 text-red-500" />
            YouTube Shorts 업로드
          </DialogTitle>
          <DialogDescription>말씀 콘텐츠를 YouTube Shorts로 발행합니다.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* 인증 상태 */}
          {!isConfigured ? (
            <div className="bg-amber-50 dark:bg-amber-950 rounded-lg p-4 text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-200 mb-2">⚙️ YouTube API 설정 필요</p>
              <p className="text-amber-700 dark:text-amber-300 text-xs">
                Render 환경변수에 YOUTUBE_CLIENT_ID와 YOUTUBE_CLIENT_SECRET을 추가해주세요.
                <br />Google Cloud Console → YouTube Data API v3 활성화 필요
              </p>
            </div>
          ) : !isAuthenticated ? (
            <div className="text-center space-y-3">
              <p className="text-sm text-muted-foreground">YouTube 채널에 업로드하려면 로그인이 필요합니다.</p>
              <Button onClick={handleLogin} className="gap-2 bg-red-600 hover:bg-red-700 text-white w-full">
                <LogIn className="w-4 h-4" />YouTube 채널 로그인
              </Button>
            </div>
          ) : (
            <>
              {/* 로그아웃 */}
              <div className="flex items-center justify-between bg-green-50 dark:bg-green-950 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800 dark:text-green-200">YouTube 연결됨</span>
                </div>
                <Button size="sm" variant="ghost" onClick={() => logoutMutation.mutate()}>
                  <LogOut className="w-3.5 h-3.5 mr-1" />로그아웃
                </Button>
              </div>

              {/* 영상 정보 */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>영상 제목</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>설명</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
                </div>
                <div className="space-y-1">
                  <Label>공개 설정</Label>
                  <Select value={privacy} onValueChange={setPrivacy}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="private">🔒 비공개 (검토 후 공개)</SelectItem>
                      <SelectItem value="unlisted">🔗 링크 공개</SelectItem>
                      <SelectItem value="public">🌐 전체 공개</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 업로드 결과 */}
              {uploadResult && (
                <div className={`rounded-lg p-3 ${uploadResult.success ? "bg-green-50 dark:bg-green-950" : "bg-red-50 dark:bg-red-950"}`}>
                  {uploadResult.success ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-green-800 dark:text-green-200 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />업로드 완료!
                      </p>
                      <a href={uploadResult.videoUrl} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-600 underline break-all">{uploadResult.videoUrl}</a>
                    </div>
                  ) : (
                    <p className="text-sm text-red-700 dark:text-red-300">❌ {uploadResult.error}</p>
                  )}
                </div>
              )}

              {/* 버튼 */}
              <div className="space-y-2">
                {!videoData ? (
                  <Button className="w-full gap-2" onClick={handleCreateVideo} disabled={isCreatingVideo}>
                    {isCreatingVideo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Film className="w-4 h-4" />}
                    {isCreatingVideo ? "Shorts 영상 생성 중..." : "Shorts 영상 생성"}
                  </Button>
                ) : (
                  <Button
                    className="w-full gap-2 bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => uploadMutation.mutate(videoData)}
                    disabled={uploadMutation.isPending}
                  >
                    {uploadMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {uploadMutation.isPending ? "업로드 중..." : "YouTube에 업로드"}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
