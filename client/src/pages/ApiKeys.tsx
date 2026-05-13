import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Key, Plus, Trash2, Copy, Check, AlertTriangle, Code2, Eye, EyeOff } from "lucide-react";

interface ApiKeyRecord {
  id: string;
  name: string;
  key: string;
  lastUsedAt: string | null;
  createdAt: string;
}

const BASE_URL = window.location.origin;

const EXAMPLE_CURL = (key: string) =>
  `curl -X POST ${BASE_URL}/api/content/generate \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{"keyword":"스마트 정수기","platforms":["instagram","blog"]}'`;

const EXAMPLE_INVENTION = (key: string) =>
  `curl -X POST ${BASE_URL}/api/invention-ideas \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "스마트 정수기",
    "problem": "필터 교체 시기를 놓쳐 오염된 물을 마심",
    "solution": "IoT 센서로 자동 알림 및 자동 주문",
    "useCases": "가정, 사무실",
    "targetAudience": ["일반 소비자"],
    "tone": "professional"
  }'`;

export default function ApiKeys() {
  const { toast } = useToast();
  const [newKeyName, setNewKeyName] = useState("");
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showExample, setShowExample] = useState<"generate" | "invention" | null>(null);

  const keysQuery = useQuery<ApiKeyRecord[]>({
    queryKey: ["/api/api-keys"],
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const data = await apiRequest("/api/api-keys", { method: "POST", body: JSON.stringify({ name }) });
      return data;
    },
    onSuccess: async (data) => {
      setNewlyCreatedKey(data.key);
      setNewKeyName("");
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      toast({ title: "API 키 생성 완료", description: "아래에서 키를 복사하세요. 다시 볼 수 없습니다." });
    },
    onError: () => toast({ title: "생성 실패", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/api-keys/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      toast({ title: "API 키 삭제됨" });
    },
    onError: () => toast({ title: "삭제 실패", variant: "destructive" }),
  });

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const keys = keysQuery.data ?? [];
  const displayKey = newlyCreatedKey ?? "cf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

  return (
    <div className="container mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Key className="w-6 h-6 text-primary" />
          API 키 관리
        </h1>
        <p className="text-muted-foreground text-sm">
          외부 서비스(Claude, n8n, Zapier 등)에서 ContentFlow API를 호출할 수 있는 Bearer 토큰을 발급합니다.
        </p>
      </div>

      {/* 새 키 생성 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">새 API 키 발급</CardTitle>
          <CardDescription>키 이름은 용도를 구분하기 위한 메모입니다 (예: Claude 자동화, n8n 워크플로우)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="예: Claude 자동화"
              value={newKeyName}
              onChange={e => setNewKeyName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && newKeyName.trim() && createMutation.mutate(newKeyName)}
              data-testid="input-key-name"
            />
            <Button
              onClick={() => createMutation.mutate(newKeyName)}
              disabled={!newKeyName.trim() || createMutation.isPending}
              data-testid="button-create-key"
            >
              <Plus className="w-4 h-4 mr-2" />
              발급
            </Button>
          </div>

          {/* 방금 생성된 키 표시 */}
          {newlyCreatedKey && (
            <div className="mt-4 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-yellow-600 dark:text-yellow-400">
                <AlertTriangle className="w-4 h-4" />
                지금 복사하세요 — 이 키는 다시 표시되지 않습니다
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted rounded px-3 py-2 break-all font-mono" data-testid="text-new-key">
                  {newlyCreatedKey}
                </code>
                <Button size="icon" variant="outline" onClick={() => handleCopy(newlyCreatedKey, "newKey")} data-testid="button-copy-new-key">
                  {copiedField === "newKey" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 기존 키 목록 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">발급된 API 키</CardTitle>
        </CardHeader>
        <CardContent>
          {keysQuery.isLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">불러오는 중...</p>
          ) : keys.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">발급된 API 키가 없습니다</p>
          ) : (
            <div className="space-y-2">
              {keys.map(k => (
                <div key={k.id} className="flex items-center justify-between p-3 border rounded-lg gap-3" data-testid={`api-key-row-${k.id}`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm" data-testid={`text-key-name-${k.id}`}>{k.name}</p>
                    <code className="text-xs text-muted-foreground font-mono">{k.key}</code>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        생성: {new Date(k.createdAt).toLocaleDateString("ko-KR")}
                      </Badge>
                      {k.lastUsedAt && (
                        <Badge variant="secondary" className="text-xs">
                          마지막 사용: {new Date(k.lastUsedAt).toLocaleDateString("ko-KR")}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate(k.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-key-${k.id}`}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* API 사용 방법 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Code2 className="w-4 h-4" />
            API 사용 방법
          </CardTitle>
          <CardDescription>
            모든 요청에 <code className="bg-muted px-1 rounded text-xs">Authorization: Bearer {"{API_KEY}"}</code> 헤더를 포함하세요
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 엔드포인트 목록 */}
          <div className="space-y-2">
            <p className="text-sm font-medium">지원 엔드포인트</p>
            <div className="rounded-md border divide-y text-sm">
              <div className="p-3 flex items-start gap-3">
                <Badge className="shrink-0 mt-0.5">POST</Badge>
                <div>
                  <code className="font-mono text-xs">/api/content/generate</code>
                  <p className="text-muted-foreground text-xs mt-0.5">키워드 기반 인스타그램/블로그 콘텐츠 생성</p>
                  <code className="text-xs text-muted-foreground">body: {"{ keyword, platforms: [\"instagram\",\"blog\"], brandAnalysisId? }"}</code>
                </div>
              </div>
              <div className="p-3 flex items-start gap-3">
                <Badge className="shrink-0 mt-0.5">POST</Badge>
                <div>
                  <code className="font-mono text-xs">/api/invention-ideas</code>
                  <p className="text-muted-foreground text-xs mt-0.5">발명 아이디어 등록</p>
                  <code className="text-xs text-muted-foreground">body: {"{ title, problem, solution, useCases?, targetAudience?, tone? }"}</code>
                </div>
              </div>
              <div className="p-3 flex items-start gap-3">
                <Badge variant="secondary" className="shrink-0 mt-0.5">GET</Badge>
                <div>
                  <code className="font-mono text-xs">/api/content-sets</code>
                  <p className="text-muted-foreground text-xs mt-0.5">생성된 콘텐츠 목록 조회</p>
                </div>
              </div>
            </div>
          </div>

          {/* 예시 코드 토글 */}
          <div className="space-y-2">
            <p className="text-sm font-medium">예시 코드</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={showExample === "generate" ? "default" : "outline"}
                onClick={() => setShowExample(showExample === "generate" ? null : "generate")}
                data-testid="button-show-generate-example"
              >
                콘텐츠 생성
              </Button>
              <Button
                size="sm"
                variant={showExample === "invention" ? "default" : "outline"}
                onClick={() => setShowExample(showExample === "invention" ? null : "invention")}
                data-testid="button-show-invention-example"
              >
                발명 아이디어
              </Button>
            </div>

            {showExample && (
              <div className="relative">
                <pre className="text-xs bg-muted rounded-md p-4 overflow-auto whitespace-pre-wrap font-mono" data-testid="text-example-code">
                  {showExample === "generate"
                    ? EXAMPLE_CURL(newlyCreatedKey ?? "cf_YOUR_KEY_HERE")
                    : EXAMPLE_INVENTION(newlyCreatedKey ?? "cf_YOUR_KEY_HERE")}
                </pre>
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute top-2 right-2"
                  onClick={() => handleCopy(
                    showExample === "generate"
                      ? EXAMPLE_CURL(newlyCreatedKey ?? "cf_YOUR_KEY_HERE")
                      : EXAMPLE_INVENTION(newlyCreatedKey ?? "cf_YOUR_KEY_HERE"),
                    "example"
                  )}
                  data-testid="button-copy-example"
                >
                  {copiedField === "example" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
              </div>
            )}
          </div>

          {/* Claude 연동 팁 */}
          <div className="rounded-md bg-muted/50 p-3 space-y-1.5 text-sm">
            <p className="font-medium">Claude에서 사용하는 방법</p>
            <ol className="text-muted-foreground space-y-1 list-decimal list-inside text-xs">
              <li>위에서 API 키를 발급받아 복사합니다</li>
              <li>Claude에 "ContentFlow API를 사용해서 '키워드' 주제로 인스타그램 콘텐츠를 생성해줘"라고 요청합니다</li>
              <li>Claude가 위 엔드포인트로 API 호출을 구성해 실행합니다</li>
              <li>생성된 JSON 응답을 그대로 활용하거나 추가 가공을 요청합니다</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
