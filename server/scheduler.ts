import cron from "node-cron";
import { storage } from "./storage";
import pLimit from "p-limit";
import { generateYouTubeScriptureContent, generateScriptureImage } from "./ai";
import { publishContentToAllPlatforms } from "./publisher";

// Render 무료 플랜 슬립 방지: 14분마다 자기 자신에게 HTTP 핑
function startKeepalive() {
  // RENDER_EXTERNAL_URL은 Render가 자동 주입하는 환경변수
  const selfUrl = process.env.RENDER_EXTERNAL_URL || process.env.APP_BASE_URL;
  if (!selfUrl) return; // 로컬 개발 환경에서는 실행 안 함

  cron.schedule("*/14 * * * *", async () => {
    try {
      await fetch(`${selfUrl}/health`);
      console.log("[keepalive] ping OK");
    } catch (e: any) {
      console.warn("[keepalive] ping 실패:", e.message?.slice(0, 60));
    }
  });

  console.log(`[keepalive] 14분마다 자동 핑 시작 → ${selfUrl}/health`);
}

// Check for scheduled content every minute
export function startScheduler() {
  console.log("Starting content scheduler...");
  startKeepalive();

  // Scheduled content publishing - every minute
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();
      const scheduledContent = await storage.getScheduledContentSets();

      for (const contentSet of scheduledContent) {
        if (!contentSet.scheduledDate) continue;

        const scheduledDate = new Date(contentSet.scheduledDate);
        
        // If scheduled time has passed, publish the content
        if (scheduledDate <= now) {
          console.log(`Publishing content: ${contentSet.keyword}`);
          
          // Update status to publishing
          await storage.updateContentSetStatus(contentSet.id, "publishing");

          // Simulate publishing process
          // In a real app, this would call Instagram Graph API, blog APIs, etc.
          try {
            await publishContent(contentSet);
            await storage.updateContentSetStatus(contentSet.id, "published");
            console.log(`Successfully published: ${contentSet.keyword}`);
          } catch (error) {
            console.error(`Failed to publish ${contentSet.keyword}:`, error);
            await storage.updateContentSetStatus(contentSet.id, "failed");
          }
        }
      }
    } catch (error) {
      console.error("Scheduler error:", error);
    }
  });

  // Automatic YouTube channel checking - every 30 minutes
  cron.schedule("*/30 * * * *", async () => {
    console.log("Starting automatic YouTube channel check...");
    try {
      await checkAllActiveYouTubeChannels();
    } catch (error) {
      console.error("YouTube channel check error:", error);
    }
  });
}

async function checkAllActiveYouTubeChannels() {
  const allChannels = await storage.getAllActiveSavedYoutubeChannels();
  
  if (allChannels.length === 0) {
    console.log("No active YouTube channels to check");
    return;
  }
  
  console.log(`Checking ${allChannels.length} active YouTube channel(s)`);
  
  for (const channel of allChannels) {
    try {
      await checkSingleYouTubeChannel(channel);
    } catch (error) {
      console.error(`Error checking channel ${channel.channelName}:`, error);
    }
    // Add delay between channels to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
}

async function checkSingleYouTubeChannel(channel: any) {
  const userId = channel.userId;
  
  let channelId: string | null = null;
  
  // Support multiple URL formats
  const directChannelMatch = channel.channelUrl.match(/\/channel\/([A-Za-z0-9_-]+)/);
  if (directChannelMatch) {
    channelId = directChannelMatch[1];
  }
  
  // Try to extract from page if not a direct channel URL
  if (!channelId) {
    try {
      const videoPageUrl = channel.channelUrl.endsWith('/') 
        ? `${channel.channelUrl}videos` 
        : `${channel.channelUrl}/videos`;
      
      const channelPageResponse = await fetch(videoPageUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        },
      });
      
      if (channelPageResponse.ok) {
        const channelHtml = await channelPageResponse.text();
        let channelIdMatch = channelHtml.match(/"channelId":"(UC[A-Za-z0-9_-]+)"/) ||
                            channelHtml.match(/"externalId":"(UC[A-Za-z0-9_-]+)"/) ||
                            channelHtml.match(/channel_id=(UC[A-Za-z0-9_-]+)/);
        
        if (channelIdMatch) {
          channelId = channelIdMatch[1];
        }
      }
    } catch (fetchError) {
      console.log(`Error fetching channel page for ${channel.channelName}`);
    }
  }
  
  if (!channelId) {
    console.log(`Could not determine channel ID for: ${channel.channelUrl}`);
    await storage.updateSavedYoutubeChannelLastChecked(channel.id);
    return;
  }
  
  // Fetch RSS feed
  const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  const rssResponse = await fetch(rssUrl);
  
  if (!rssResponse.ok) {
    console.log(`Failed to fetch RSS feed for ${channel.channelName}`);
    await storage.updateSavedYoutubeChannelLastChecked(channel.id);
    return;
  }
  
  const rssXml = await rssResponse.text();
  
  // Parse video IDs from RSS feed
  const videoIdPattern = /<yt:videoId>([^<]+)<\/yt:videoId>/g;
  const videoIds: string[] = [];
  let videoMatch;
  while ((videoMatch = videoIdPattern.exec(rssXml)) !== null) {
    videoIds.push(videoMatch[1]);
  }
  
  const recentVideoIds = videoIds.slice(0, 3);
  const processedIds = channel.processedVideoIds || [];
  const newVideoIds = recentVideoIds.filter((id: string) => !processedIds.includes(id));
  
  if (newVideoIds.length === 0) {
    console.log(`No new videos for ${channel.channelName}`);
    await storage.updateSavedYoutubeChannelLastChecked(channel.id);
    return;
  }
  
  console.log(`Found ${newVideoIds.length} new video(s) for ${channel.channelName}`);
  
  // Process only 1 video per check to avoid overloading
  const videoId = newVideoIds[0];
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  
  try {
    const browserUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
    let transcript = "";
    let videoTitle = "Unknown";
    
    const transcriptResponse = await fetch(youtubeUrl, {
      headers: {
        "User-Agent": browserUserAgent,
        "Accept-Language": "ko-KR,ko;q=0.9",
      },
    });
    
    if (!transcriptResponse.ok) {
      console.log(`Failed to fetch video page (${transcriptResponse.status}): ${youtubeUrl}`);
      // Don't mark as processed - will retry on next check
      await storage.updateSavedYoutubeChannelLastChecked(channel.id);
      return;
    }
    
    const html = await transcriptResponse.text();
    
    // Extract title
    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    videoTitle = titleMatch ? titleMatch[1].replace(" - YouTube", "") : "Unknown";
    
    // Try to get captions
    const captionMatch = html.match(/"captionTracks":\s*\[(.*?)\]/);
    if (captionMatch) {
      try {
        const captionData = JSON.parse(`[${captionMatch[1]}]`);
        const koreanCaption = captionData.find((c: any) => 
          c.languageCode === "ko" || c.languageCode === "ko-KR"
        ) || captionData[0];
        
        if (koreanCaption?.baseUrl) {
          const captionUrl = koreanCaption.baseUrl.replace(/\\u0026/g, "&");
          const captionResponse = await fetch(captionUrl, {
            headers: { "User-Agent": browserUserAgent },
          });
          
          if (captionResponse.ok) {
            const captionXml = await captionResponse.text();
            const textPattern = /<text[^>]*>(.*?)<\/text>/g;
            const texts: string[] = [];
            let textMatch;
            while ((textMatch = textPattern.exec(captionXml)) !== null) {
              const text = textMatch[1]
                .replace(/&amp;/g, "&")
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .replace(/&#39;/g, "'")
                .replace(/&quot;/g, '"')
                .replace(/\n/g, " ");
              texts.push(text);
            }
            transcript = texts.join(" ").trim();
          }
        }
      } catch (parseError) {
        console.log("Failed to parse caption data");
      }
    }
    
    // Use title as fallback
    if (!transcript) {
      transcript = `영상 제목: ${videoTitle}. 이 영상의 핵심 주제와 메시지를 기반으로 적절한 성경 말씀을 추천해주세요.`;
    }
    
    // Generate scripture content
    console.log(`Generating scripture content for: ${videoTitle}`);
    const scriptureContent = await generateYouTubeScriptureContent(transcript);
    
    // Generate images (limit to 2 for auto-generation)
    const imageLimit = pLimit(2);
    const slidesToGenerate = scriptureContent.instagramSlides.slice(0, 2);
    const imagePromises = slidesToGenerate.map((slide) =>
      imageLimit(async () => {
        const image = await generateScriptureImage(slide, scriptureContent.bibleReference);
        return image;
      })
    );
    const imageResults = await Promise.all(imagePromises);
    const imageUrls = imageResults.filter((url): url is string => url !== null);
    
    // Save the generated content
    await storage.createScriptureContent({
      userId,
      youtubeUrl,
      videoTitle: scriptureContent.videoTitle || videoTitle,
      videoSummary: scriptureContent.videoSummary,
      bibleVerse: scriptureContent.bibleVerse,
      bibleReference: scriptureContent.bibleReference,
      instagramSlides: scriptureContent.instagramSlides,
      instagramCaption: scriptureContent.instagramCaption,
      instagramHashtags: scriptureContent.instagramHashtags,
      imageUrls,
      blogTitle: scriptureContent.blogTitle,
      blogContent: scriptureContent.blogContent,
      blogMetaDescription: scriptureContent.blogMetaDescription,
    });
    
    console.log(`Successfully auto-generated content for: ${videoTitle}`);
    
    // Only mark video as processed after successful content creation
    const updatedProcessedIds = [...processedIds, videoId];
    await storage.updateSavedYoutubeChannelProcessedVideos(channel.id, updatedProcessedIds);
    
  } catch (videoError) {
    console.error(`Error processing video ${videoId}:`, videoError);
    // Don't mark as processed on error - will retry on next check
    // Only mark as processed after 3 consecutive failures (could be added later)
  }
  
  await storage.updateSavedYoutubeChannelLastChecked(channel.id);
}

async function publishContent(contentSet: any): Promise<void> {
  const baseUrl = process.env.APP_BASE_URL || "http://localhost:5000";
  const results = await publishContentToAllPlatforms(contentSet, baseUrl);

  for (const result of results) {
    if (result.success) {
      console.log(`  ✓ ${result.platform} 발행 성공: ${result.postUrl || result.postId}`);
    } else {
      console.error(`  ✗ ${result.platform} 발행 실패: ${result.error}`);
    }
  }

  // 하나라도 성공하지 못하면 예외 발생 → 상태를 "failed"로 변경
  if (results.length > 0 && results.every((r) => !r.success)) {
    throw new Error(results.map((r) => r.error).join("; "));
  }
}
