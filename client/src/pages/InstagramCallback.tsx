import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Copy, AlertCircle } from "lucide-react";

export default function InstagramCallback() {
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // URL fragment에서 access_token 추출 (#access_token=...)
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get("access_token");
      if (accessToken) {
        setToken(accessToken);
        // Instagram User ID 자동 조회
        fetch(`https://graph.facebook.com/me/accounts?access_token=${accessToken}`)
          .then(r => r.json())
          .then(data => {
            if (data.data?.[0]?.id) {
              // 페이지 ID로 Instagram Business Account ID 조회
              const pageId = data.data[0].id;
              return fetch(`https://graph.facebook.com/${pageId}?fields=instagram_business_account&access_token=${accessToken}`)
                .then(r => r.json())
                .then(d => {
                  if (d.instagram_business_account?.id) {
                    setUserId(d.instagram_business_account.id);
                  }
                });
            }
          })
          .catch(() => {});
      }
    }

    // Query string에서 오류 확인
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error_description");
    if (err) setError(err);
  }, []);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-5 h-5" />오류 발생
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button className="mt-4 w-full" onClick={() => window.location.href = "/settings"}>
            설정으로 돌아가기
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  if (!token) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Instagram 인증 처리 중...</p>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-600">
            <Check className="w-5 h-5" />Instagram 연결 성공!
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {userId && (
            <div className="space-y-1">
              <p className="text-sm font-medium">Instagram User ID</p>
              <div className="flex gap-2">
                <code className="flex-1 bg-muted rounded p-2 text-sm break-all">{userId}</code>
                <Button size="sm" variant="outline" onClick={() => copy(userId)}>
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <p className="text-sm font-medium">Access Token</p>
            <div className="flex gap-2">
              <code className="flex-1 bg-muted rounded p-2 text-xs break-all line-clamp-3">
                {token.substring(0, 50)}...
              </code>
              <Button size="sm" variant="outline" onClick={() => copy(token)}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3 text-sm">
            <p className="font-medium text-blue-800 dark:text-blue-200 mb-1">다음 단계</p>
            <ol className="list-decimal list-inside space-y-1 text-blue-700 dark:text-blue-300 text-xs">
              <li>위 Instagram User ID 복사</li>
              <li>Access Token 복사</li>
              <li>ContentPilot 설정 → Instagram 연결에 입력</li>
            </ol>
          </div>

          <Button className="w-full" onClick={() => window.location.href = "/settings"}>
            설정 페이지로 이동
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
