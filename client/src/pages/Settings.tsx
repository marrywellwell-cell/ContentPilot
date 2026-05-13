import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Instagram, Globe, CheckCircle, XCircle, Loader2, ExternalLink } from "lucide-react";
import { SiWordpress, SiTistory } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface PlatformConnection {
  id: string;
  platform: string;
  isActive: boolean;
  instagramUsername?: string;
  wordpressUrl?: string;
  wordpressUsername?: string;
  tistoryBlogName?: string;
}

// ─── Instagram 연결 폼 ────────────────────────────────────────────────────────

function InstagramConnectForm({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    instagramUserId: "",
    instagramAccessToken: "",
    instagramUsername: "",
  });

  const mutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("/api/platform-connections", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform-connections"] });
      toast({ title: "Instagram 연결 완료", description: "Instagram 계정이 연결되었습니다." });
      onClose();
    },
    onError: (e: any) => toast({ title: "연결 실패", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-md bg-blue-50 dark:bg-blue-950 p-3 text-sm text-blue-800 dark:text-blue-200">
        <p className="font-semibold mb-1">Instagram Graph API 설정 방법</p>
        <ol className="list-decimal list-inside space-y-1 text-xs">
          <li>Facebook Developers에서 앱 생성 (business 타입)</li>
          <li>Instagram Graph API 권한 추가 (instagram_basic, instagram_content_publish)</li>
          <li>Instagram Business/Creator 계정 연결</li>
          <li>Long-lived Access Token 발급 (60일 유효)</li>
        </ol>
        <a
          href="https://developers.facebook.com/docs/instagram-api/getting-started"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-2 text-blue-600 hover:underline text-xs"
        >
          공식 문서 보기 <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="space-y-2">
        <Label>Instagram User ID</Label>
        <Input
          placeholder="예: 123456789012345"
          value={form.instagramUserId}
          onChange={(e) => setForm((f) => ({ ...f, instagramUserId: e.target.value }))}
        />
        <p className="text-xs text-muted-foreground">
          Graph API Explorer에서 /me?fields=id 조회 시 나오는 ID
        </p>
      </div>

      <div className="space-y-2">
        <Label>Access Token</Label>
        <Input
          type="password"
          placeholder="EAAx..."
          value={form.instagramAccessToken}
          onChange={(e) => setForm((f) => ({ ...f, instagramAccessToken: e.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label>Instagram 사용자명 (선택)</Label>
        <Input
          placeholder="@username"
          value={form.instagramUsername}
          onChange={(e) => setForm((f) => ({ ...f, instagramUsername: e.target.value }))}
        />
      </div>

      <Button
        className="w-full"
        disabled={!form.instagramUserId || !form.instagramAccessToken || mutation.isPending}
        onClick={() =>
          mutation.mutate({ platform: "instagram", ...form })
        }
      >
        {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        연결하기
      </Button>
    </div>
  );
}

// ─── WordPress 연결 폼 ────────────────────────────────────────────────────────

function WordPressConnectForm({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    wordpressUrl: "",
    wordpressUsername: "",
    wordpressAppPassword: "",
  });

  const mutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("/api/platform-connections", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform-connections"] });
      toast({ title: "WordPress 연결 완료", description: "WordPress 사이트가 연결되었습니다." });
      onClose();
    },
    onError: (e: any) => toast({ title: "연결 실패", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-md bg-blue-50 dark:bg-blue-950 p-3 text-sm text-blue-800 dark:text-blue-200">
        <p className="font-semibold mb-1">WordPress Application Password 설정</p>
        <ol className="list-decimal list-inside space-y-1 text-xs">
          <li>WordPress 관리자 → 사용자 → 프로필</li>
          <li>하단 "Application Passwords" 섹션에서 새 비밀번호 생성</li>
          <li>생성된 비밀번호를 아래에 입력</li>
        </ol>
      </div>

      <div className="space-y-2">
        <Label>WordPress 사이트 URL</Label>
        <Input
          placeholder="https://myblog.com"
          value={form.wordpressUrl}
          onChange={(e) => setForm((f) => ({ ...f, wordpressUrl: e.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label>관리자 사용자명</Label>
        <Input
          placeholder="admin"
          value={form.wordpressUsername}
          onChange={(e) => setForm((f) => ({ ...f, wordpressUsername: e.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label>Application Password</Label>
        <Input
          type="password"
          placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
          value={form.wordpressAppPassword}
          onChange={(e) => setForm((f) => ({ ...f, wordpressAppPassword: e.target.value }))}
        />
      </div>

      <Button
        className="w-full"
        disabled={!form.wordpressUrl || !form.wordpressUsername || !form.wordpressAppPassword || mutation.isPending}
        onClick={() => mutation.mutate({ platform: "wordpress", ...form })}
      >
        {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        연결하기
      </Button>
    </div>
  );
}

// ─── Tistory 연결 폼 ──────────────────────────────────────────────────────────

function TistoryConnectForm({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    tistoryAccessToken: "",
    tistoryBlogName: "",
  });

  const mutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("/api/platform-connections", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform-connections"] });
      toast({ title: "Tistory 연결 완료", description: "Tistory 블로그가 연결되었습니다." });
      onClose();
    },
    onError: (e: any) => toast({ title: "연결 실패", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-md bg-blue-50 dark:bg-blue-950 p-3 text-sm text-blue-800 dark:text-blue-200">
        <p className="font-semibold mb-1">Tistory Access Token 발급</p>
        <ol className="list-decimal list-inside space-y-1 text-xs">
          <li>Tistory 오픈 API → 앱 등록</li>
          <li>OAuth 2.0 인증 후 access_token 발급</li>
          <li>블로그 이름 = Tistory 주소의 첫 부분 (예: myblog.tistory.com → myblog)</li>
        </ol>
        <a
          href="https://tistory.github.io/document-tistory-apis/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-2 text-blue-600 hover:underline text-xs"
        >
          Tistory API 문서 <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="space-y-2">
        <Label>Access Token</Label>
        <Input
          type="password"
          placeholder="Tistory access token"
          value={form.tistoryAccessToken}
          onChange={(e) => setForm((f) => ({ ...f, tistoryAccessToken: e.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label>블로그 이름</Label>
        <Input
          placeholder="예: myblog (myblog.tistory.com에서 myblog 부분)"
          value={form.tistoryBlogName}
          onChange={(e) => setForm((f) => ({ ...f, tistoryBlogName: e.target.value }))}
        />
      </div>

      <Button
        className="w-full"
        disabled={!form.tistoryAccessToken || !form.tistoryBlogName || mutation.isPending}
        onClick={() => mutation.mutate({ platform: "tistory", ...form })}
      >
        {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        연결하기
      </Button>
    </div>
  );
}

// ─── 플랫폼 카드 ──────────────────────────────────────────────────────────────

function PlatformCard({
  name,
  platform,
  icon,
  description,
  connection,
  onConnect,
  onDisconnect,
}: {
  name: string;
  platform: string;
  icon: React.ReactNode;
  description: string;
  connection?: PlatformConnection;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const connected = !!connection?.isActive;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              {icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{name}</span>
                {connected ? (
                  <Badge variant="outline" className="text-green-600 border-green-600 text-xs">
                    <CheckCircle className="h-3 w-3 mr-1" />연결됨
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground text-xs">
                    <XCircle className="h-3 w-3 mr-1" />미연결
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {connected
                  ? connection?.instagramUsername || connection?.wordpressUrl || connection?.tistoryBlogName || "연결됨"
                  : description}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant={connected ? "outline" : "default"}
            onClick={connected ? onDisconnect : onConnect}
          >
            {connected ? "연결 해제" : "연결하기"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 메인 Settings 페이지 ─────────────────────────────────────────────────────

export default function Settings() {
  const { toast } = useToast();
  const [openDialog, setOpenDialog] = useState<string | null>(null);

  const { data: connections = [] } = useQuery<PlatformConnection[]>({
    queryKey: ["/api/platform-connections"],
  });

  const disconnectMutation = useMutation({
    mutationFn: (platform: string) =>
      apiRequest(`/api/platform-connections/${platform}`, { method: "DELETE" }),
    onSuccess: (_data, platform) => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform-connections"] });
      toast({ title: "연결 해제 완료", description: `${platform} 연결이 해제되었습니다.` });
    },
    onError: (e: any) =>
      toast({ title: "해제 실패", description: e.message, variant: "destructive" }),
  });

  const getConnection = (platform: string) =>
    connections.find((c) => c.platform === platform);

  const platforms = [
    {
      name: "Instagram",
      platform: "instagram",
      icon: <Instagram className="h-5 w-5 text-pink-500" />,
      description: "Instagram Business/Creator 계정 연결",
      formComponent: InstagramConnectForm,
    },
    {
      name: "WordPress",
      platform: "wordpress",
      icon: <SiWordpress className="h-5 w-5 text-blue-600" />,
      description: "WordPress REST API로 블로그 자동 발행",
      formComponent: WordPressConnectForm,
    },
    {
      name: "Tistory",
      platform: "tistory",
      icon: <SiTistory className="h-5 w-5 text-orange-500" />,
      description: "Tistory 블로그 자동 발행",
      formComponent: TistoryConnectForm,
    },
  ];

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold" data-testid="text-page-title">
          설정
        </h1>
        <p className="text-muted-foreground mt-1">
          플랫폼 연결 및 자동 발행 설정
        </p>
      </div>

      {/* 플랫폼 연결 */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">플랫폼 연결</h2>
          <p className="text-sm text-muted-foreground mt-1">
            연결된 플랫폼으로 콘텐츠를 자동 발행할 수 있습니다.
          </p>
        </div>

        <div className="grid gap-3">
          {platforms.map(({ name, platform, icon, description, formComponent: FormComponent }) => (
            <PlatformCard
              key={platform}
              name={name}
              platform={platform}
              icon={icon}
              description={description}
              connection={getConnection(platform)}
              onConnect={() => setOpenDialog(platform)}
              onDisconnect={() => disconnectMutation.mutate(platform)}
            />
          ))}
        </div>
      </section>

      {/* 발행 자동화 안내 */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              자동 발행 작동 방식
            </CardTitle>
            <CardDescription>
              콘텐츠 발행 스케줄을 설정하면 연결된 플랫폼에 자동으로 게시됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <span className="text-primary font-bold">1.</span>
              <span>콘텐츠 생성 후 "예약 발행" 날짜를 설정합니다.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-primary font-bold">2.</span>
              <span>스케줄러가 1분마다 예약된 콘텐츠를 확인합니다.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-primary font-bold">3.</span>
              <span>예약 시간이 되면 위에 연결된 플랫폼에 자동으로 게시됩니다.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-primary font-bold">4.</span>
              <span>Instagram 캐러셀, 블로그 포스트 모두 자동 발행됩니다.</span>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 연결 다이얼로그 */}
      {platforms.map(({ name, platform, formComponent: FormComponent }) => (
        <Dialog
          key={platform}
          open={openDialog === platform}
          onOpenChange={(open) => !open && setOpenDialog(null)}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{name} 연결</DialogTitle>
              <DialogDescription>
                {name} 계정 정보를 입력하여 자동 발행을 설정하세요.
              </DialogDescription>
            </DialogHeader>
            <FormComponent onClose={() => setOpenDialog(null)} />
          </DialogContent>
        </Dialog>
      ))}
    </div>
  );
}
