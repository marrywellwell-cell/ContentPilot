import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth (OIDC compatible)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  isAdmin: boolean("is_admin").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Brand Analysis table for marketing strategy
export const brandAnalyses = pgTable("brand_analyses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  brandName: text("brand_name").notNull(),
  productService: text("product_service").notNull(),
  usp: text("usp"),
  customerPersona: text("customer_persona"),
  painPoints: text("pain_points"),
  solution: text("solution"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Monthly Content Plan table
export const monthlyPlans = pgTable("monthly_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  brandAnalysisId: varchar("brand_analysis_id").references(() => brandAnalyses.id),
  year: text("year").notNull(),
  month: text("month").notNull(),
  title: text("title").notNull(),
  themes: text("themes").array(),
  contentItems: jsonb("content_items").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const contentSets = pgTable("content_sets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  brandAnalysisId: varchar("brand_analysis_id").references(() => brandAnalyses.id),
  keyword: text("keyword").notNull(),
  instagramSlides: text("instagram_slides").array(),
  instagramCaption: text("instagram_caption"),
  instagramHashtags: text("instagram_hashtags").array(),
  instagramImageUrls: text("instagram_image_urls").array(),
  blogTitle: text("blog_title"),
  blogContent: text("blog_content"),
  blogMetaDescription: text("blog_meta_description"),
  blogHtml: text("blog_html"),
  blogImageUrls: text("blog_image_urls").array(),
  blogTitles: text("blog_titles").array(),
  blogThumbnailTexts: text("blog_thumbnail_texts").array(),
  blogImageRecommendations: jsonb("blog_image_recommendations"),
  blogInternalLinkTopics: text("blog_internal_link_topics").array(),
  blogHashtags: text("blog_hashtags").array(),
  scheduledDate: timestamp("scheduled_date"),
  status: text("status").notNull().default("draft"),
  platforms: text("platforms").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

// User types for Replit Auth
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Brand Analysis types
export const insertBrandAnalysisSchema = createInsertSchema(brandAnalyses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type BrandAnalysis = typeof brandAnalyses.$inferSelect;
export type InsertBrandAnalysis = z.infer<typeof insertBrandAnalysisSchema>;

// Monthly Plan types
export const contentItemSchema = z.object({
  date: z.string(),
  dayOfWeek: z.string(),
  topic: z.string(),
  platforms: z.array(z.string()),
  contentType: z.string(),
  notes: z.string().optional(),
});

export const insertMonthlyPlanSchema = createInsertSchema(monthlyPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type MonthlyPlan = typeof monthlyPlans.$inferSelect;
export type InsertMonthlyPlan = z.infer<typeof insertMonthlyPlanSchema>;
export type ContentItem = z.infer<typeof contentItemSchema>;

// Content Set types
export const insertContentSetSchema = createInsertSchema(contentSets).omit({
  id: true,
  createdAt: true,
});

export type ContentSet = typeof contentSets.$inferSelect;
export type InsertContentSet = z.infer<typeof insertContentSetSchema>;

// Chat message types for AI content editing
export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  timestamp: z.string(),
});

export const chatRequestSchema = z.object({
  message: z.string(),
  conversationHistory: z.array(chatMessageSchema).optional(),
});

export const chatResponseSchema = z.object({
  message: z.string(),
  updatedContent: z.object({
    instagramSlides: z.array(z.string()).optional(),
    instagramCaption: z.string().optional(),
    instagramHashtags: z.array(z.string()).optional(),
    blogTitle: z.string().optional(),
    blogContent: z.string().optional(),
    blogMetaDescription: z.string().optional(),
    blogHtml: z.string().optional(),
  }).optional(),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatResponse = z.infer<typeof chatResponseSchema>;

// Scripture Content table for YouTube scripture generation
export const scriptureContents = pgTable("scripture_contents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  youtubeUrl: text("youtube_url"),
  videoTitle: text("video_title").notNull(),
  videoSummary: text("video_summary"),
  bibleVerse: text("bible_verse").notNull(),
  bibleReference: text("bible_reference").notNull(),
  instagramSlides: text("instagram_slides").array(),
  instagramCaption: text("instagram_caption"),
  instagramHashtags: text("instagram_hashtags").array(),
  imageUrls: text("image_urls").array(),
  blogTitle: text("blog_title"),
  blogContent: text("blog_content"),
  blogMetaDescription: text("blog_meta_description"),
  channelName: text("channel_name"),
  channelUrl: text("channel_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Scripture Automation settings
export const scriptureAutomations = pgTable("scripture_automations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  channelUrl: text("channel_url"),
  isActive: boolean("is_active").default(false),
  frequency: text("frequency").default("daily"),
  verseHint: text("verse_hint"),
  lastRun: timestamp("last_run"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Scripture Content types
export const insertScriptureContentSchema = createInsertSchema(scriptureContents).omit({
  id: true,
  createdAt: true,
});

export type ScriptureContent = typeof scriptureContents.$inferSelect;
export type InsertScriptureContent = z.infer<typeof insertScriptureContentSchema>;

// Scripture Automation types
export const insertScriptureAutomationSchema = createInsertSchema(scriptureAutomations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ScriptureAutomation = typeof scriptureAutomations.$inferSelect;
export type InsertScriptureAutomation = z.infer<typeof insertScriptureAutomationSchema>;

// Saved YouTube Channels for automation
export const savedYoutubeChannels = pgTable("saved_youtube_channels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  channelUrl: text("channel_url").notNull(),
  channelName: text("channel_name").notNull(),
  isActive: boolean("is_active").default(true),
  lastCheckedAt: timestamp("last_checked_at"),
  processedVideoIds: text("processed_video_ids").array().default([]),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSavedYoutubeChannelSchema = createInsertSchema(savedYoutubeChannels).omit({
  id: true,
  createdAt: true,
  lastCheckedAt: true,
});

export type SavedYoutubeChannel = typeof savedYoutubeChannels.$inferSelect;
export type InsertSavedYoutubeChannel = z.infer<typeof insertSavedYoutubeChannelSchema>;

// Invention Ideas table for content generation
export const inventionIdeas = pgTable("invention_ideas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  title: text("title").notNull(),
  problem: text("problem").notNull(),
  solution: text("solution").notNull(),
  useCases: text("use_cases"),
  targetAudience: text("target_audience").array().default([]),
  tone: text("tone").notNull().default("professional"),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Generated Content for Invention Ideas
export const inventionContents = pgTable("invention_contents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ideaId: varchar("idea_id").references(() => inventionIdeas.id),
  userId: varchar("user_id").references(() => users.id),
  contentType: text("content_type").notNull(),
  instagramSlides: text("instagram_slides").array(),
  instagramImageUrls: text("instagram_image_urls").array(),
  instagramCaption: text("instagram_caption"),
  instagramHashtags: text("instagram_hashtags").array(),
  shortsScript: text("shorts_script"),
  shortsScenes: jsonb("shorts_scenes"),
  shortsDuration: text("shorts_duration"),
  shortsTitle: text("shorts_title"),
  shortsHook: text("shorts_hook"),
  shortsHashtags: text("shorts_hashtags").array(),
  shortsVideoUrl: text("shorts_video_url"),
  shortsThumbnailUrl: text("shorts_thumbnail_url"),
  blogTitle: text("blog_title"),
  blogContent: text("blog_content"),
  blogHtml: text("blog_html"),
  blogMetaDescription: text("blog_meta_description"),
  blogHashtags: text("blog_hashtags").array(),
  copyright: text("copyright"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Upload History for tracking SNS uploads
export const uploadHistory = pgTable("upload_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  contentId: varchar("content_id").references(() => inventionContents.id),
  platform: text("platform").notNull(),
  uploadType: text("upload_type").notNull().default("manual"),
  status: text("status").notNull().default("pending"),
  externalId: text("external_id"),
  externalUrl: text("external_url"),
  views: text("views"),
  likes: text("likes"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// API Keys table for external access
export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  key: text("key").notNull().unique(),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertApiKeySchema = createInsertSchema(apiKeys).omit({
  id: true,
  createdAt: true,
  lastUsedAt: true,
});

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;

// Invention Idea types
export const insertInventionIdeaSchema = createInsertSchema(inventionIdeas).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InventionIdea = typeof inventionIdeas.$inferSelect;
export type InsertInventionIdea = z.infer<typeof insertInventionIdeaSchema>;

// Invention Content types
export const insertInventionContentSchema = createInsertSchema(inventionContents).omit({
  id: true,
  createdAt: true,
});

export type InventionContent = typeof inventionContents.$inferSelect;
export type InsertInventionContent = z.infer<typeof insertInventionContentSchema>;

// Upload History types
export const insertUploadHistorySchema = createInsertSchema(uploadHistory).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UploadHistory = typeof uploadHistory.$inferSelect;
export type InsertUploadHistory = z.infer<typeof insertUploadHistorySchema>;

// Platform Connections — stores OAuth tokens for Instagram, WordPress, Tistory, Naver
export const platformConnections = pgTable("platform_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  platform: text("platform").notNull(), // "instagram" | "wordpress" | "tistory" | "naver"
  // Instagram Graph API
  instagramUserId: text("instagram_user_id"),
  instagramAccessToken: text("instagram_access_token"),
  instagramUsername: text("instagram_username"),
  instagramTokenExpiresAt: timestamp("instagram_token_expires_at"),
  // WordPress REST API
  wordpressUrl: text("wordpress_url"),
  wordpressUsername: text("wordpress_username"),
  wordpressAppPassword: text("wordpress_app_password"),
  // Tistory API
  tistoryAccessToken: text("tistory_access_token"),
  tistoryBlogName: text("tistory_blog_name"),
  // Naver Blog API
  naverAccessToken: text("naver_access_token"),
  naverRefreshToken: text("naver_refresh_token"),
  // Common
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPlatformConnectionSchema = createInsertSchema(platformConnections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PlatformConnection = typeof platformConnections.$inferSelect;
export type InsertPlatformConnection = z.infer<typeof insertPlatformConnectionSchema>;
