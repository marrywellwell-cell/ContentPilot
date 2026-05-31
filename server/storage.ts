import { type User, type UpsertUser, type ContentSet, type InsertContentSet, type BrandAnalysis, type InsertBrandAnalysis, type MonthlyPlan, type InsertMonthlyPlan, type ScriptureContent, type InsertScriptureContent, type ScriptureAutomation, type InsertScriptureAutomation, type SavedYoutubeChannel, type InsertSavedYoutubeChannel, type InventionIdea, type InsertInventionIdea, type InventionContent, type InsertInventionContent, type UploadHistory, type InsertUploadHistory, type ApiKey, type PlatformConnection, type InsertPlatformConnection, type MonthlyContent, type InsertMonthlyContent, users, contentSets, brandAnalyses, monthlyPlans, scriptureContents, scriptureAutomations, savedYoutubeChannels, inventionIdeas, inventionContents, uploadHistory, apiKeys, platformConnections, monthlyContents } from "@shared/schema";
import { randomUUID } from "crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  listUsers(): Promise<User[]>;
  updateUserAdmin(id: string, isAdmin: boolean): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  
  // Brand analysis operations
  createBrandAnalysis(brandAnalysis: InsertBrandAnalysis): Promise<BrandAnalysis>;
  getBrandAnalysis(id: string): Promise<BrandAnalysis | undefined>;
  listBrandAnalyses(userId?: string): Promise<BrandAnalysis[]>;
  updateBrandAnalysis(id: string, updates: Partial<InsertBrandAnalysis>): Promise<BrandAnalysis | undefined>;
  deleteBrandAnalysis(id: string): Promise<boolean>;
  
  // Content set operations
  createContentSet(contentSet: InsertContentSet): Promise<ContentSet>;
  getContentSet(id: string): Promise<ContentSet | undefined>;
  listContentSets(userId?: string): Promise<ContentSet[]>;
  updateContentSet(id: string, contentSet: Partial<InsertContentSet>): Promise<ContentSet | undefined>;
  deleteContentSet(id: string): Promise<boolean>;
  getScheduledContentSets(): Promise<ContentSet[]>;
  updateContentSetStatus(id: string, status: string): Promise<ContentSet | undefined>;
  
  // Monthly plan operations
  createMonthlyPlan(plan: InsertMonthlyPlan): Promise<MonthlyPlan>;
  getMonthlyPlan(id: string): Promise<MonthlyPlan | undefined>;
  getMonthlyPlanByMonth(userId: string, year: string, month: string): Promise<MonthlyPlan | undefined>;
  listMonthlyPlans(userId?: string): Promise<MonthlyPlan[]>;
  updateMonthlyPlan(id: string, updates: Partial<InsertMonthlyPlan>): Promise<MonthlyPlan | undefined>;
  deleteMonthlyPlan(id: string): Promise<boolean>;
  
  // Scripture content operations
  createScriptureContent(content: InsertScriptureContent): Promise<ScriptureContent>;
  getScriptureContent(id: string): Promise<ScriptureContent | undefined>;
  listScriptureContents(userId?: string, channelName?: string): Promise<ScriptureContent[]>;
  listScriptureChannels(userId: string): Promise<{ channelName: string; count: number }[]>;
  updateScriptureContentImages(id: string, imageUrls: string[]): Promise<ScriptureContent | undefined>;
  deleteScriptureContent(id: string): Promise<boolean>;
  
  // Scripture automation operations
  getScriptureAutomation(userId: string): Promise<ScriptureAutomation | undefined>;
  upsertScriptureAutomation(automation: InsertScriptureAutomation): Promise<ScriptureAutomation>;
  
  // Saved YouTube channels operations
  createSavedYoutubeChannel(channel: InsertSavedYoutubeChannel): Promise<SavedYoutubeChannel>;
  listSavedYoutubeChannels(userId: string): Promise<SavedYoutubeChannel[]>;
  deleteSavedYoutubeChannel(id: string): Promise<boolean>;
  toggleSavedYoutubeChannel(id: string, isActive: boolean): Promise<SavedYoutubeChannel | undefined>;
  updateSavedYoutubeChannelLastChecked(id: string): Promise<SavedYoutubeChannel | undefined>;
  updateSavedYoutubeChannelProcessedVideos(id: string, processedVideoIds: string[]): Promise<SavedYoutubeChannel | undefined>;
  getActiveSavedYoutubeChannels(userId: string): Promise<SavedYoutubeChannel[]>;
  getAllActiveSavedYoutubeChannels(): Promise<SavedYoutubeChannel[]>;
  
  // Invention idea operations
  createInventionIdea(idea: InsertInventionIdea): Promise<InventionIdea>;
  getInventionIdea(id: string): Promise<InventionIdea | undefined>;
  listInventionIdeas(userId: string): Promise<InventionIdea[]>;
  updateInventionIdea(id: string, updates: Partial<InsertInventionIdea>): Promise<InventionIdea | undefined>;
  deleteInventionIdea(id: string): Promise<boolean>;
  
  // Invention content operations
  createInventionContent(content: InsertInventionContent): Promise<InventionContent>;
  getInventionContent(id: string): Promise<InventionContent | undefined>;
  updateInventionContent(id: string, updates: Partial<InsertInventionContent>): Promise<InventionContent | undefined>;
  listInventionContentsByIdea(ideaId: string): Promise<InventionContent[]>;
  listInventionContents(userId: string): Promise<InventionContent[]>;
  deleteInventionContent(id: string): Promise<boolean>;
  
  // Upload history operations
  createUploadHistory(history: InsertUploadHistory): Promise<UploadHistory>;
  listUploadHistory(userId: string): Promise<UploadHistory[]>;
  updateUploadHistory(id: string, updates: Partial<InsertUploadHistory>): Promise<UploadHistory | undefined>;

  // API Key operations
  createApiKey(userId: string, name: string, key: string): Promise<ApiKey>;
  listApiKeys(userId: string): Promise<ApiKey[]>;
  getApiKeyByKey(key: string): Promise<ApiKey | undefined>;
  deleteApiKey(id: string, userId: string): Promise<boolean>;
  touchApiKey(key: string): Promise<void>;

  // Platform connection operations
  getPlatformConnection(userId: string, platform: string): Promise<PlatformConnection | null>;
  listPlatformConnections(userId: string): Promise<PlatformConnection[]>;
  upsertPlatformConnection(data: InsertPlatformConnection): Promise<PlatformConnection>;
  deletePlatformConnection(userId: string, platform: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private brandAnalysesMap: Map<string, BrandAnalysis>;
  private contentSets: Map<string, ContentSet>;
  private monthlyPlansMap: Map<string, MonthlyPlan>;
  private scriptureContentsMap: Map<string, ScriptureContent>;
  private scriptureAutomationsMap: Map<string, ScriptureAutomation>;
  private savedYoutubeChannelsMap: Map<string, SavedYoutubeChannel>;
  private inventionIdeasMap: Map<string, InventionIdea>;
  private inventionContentsMap: Map<string, InventionContent>;
  private uploadHistoryMap: Map<string, UploadHistory>;

  constructor() {
    this.users = new Map();
    this.brandAnalysesMap = new Map();
    this.contentSets = new Map();
    this.monthlyPlansMap = new Map();
    this.scriptureContentsMap = new Map();
    this.scriptureAutomationsMap = new Map();
    this.savedYoutubeChannelsMap = new Map();
    this.inventionIdeasMap = new Map();
    this.inventionContentsMap = new Map();
    this.uploadHistoryMap = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existing = this.users.get(userData.id!);
    if (existing) {
      const updated: User = {
        ...existing,
        ...userData,
        updatedAt: new Date(),
      };
      this.users.set(userData.id!, updated);
      return updated;
    }
    
    const user: User = {
      id: userData.id || randomUUID(),
      email: userData.email || null,
      firstName: userData.firstName || null,
      lastName: userData.lastName || null,
      profileImageUrl: userData.profileImageUrl || null,
      isAdmin: userData.isAdmin || false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }

  async listUsers(): Promise<User[]> {
    return Array.from(this.users.values()).sort(
      (a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    );
  }

  async updateUserAdmin(id: string, isAdmin: boolean): Promise<User | undefined> {
    const existing = this.users.get(id);
    if (!existing) return undefined;
    
    const updated: User = {
      ...existing,
      isAdmin,
      updatedAt: new Date(),
    };
    this.users.set(id, updated);
    return updated;
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  async createBrandAnalysis(data: InsertBrandAnalysis): Promise<BrandAnalysis> {
    const id = randomUUID();
    const brandAnalysis: BrandAnalysis = {
      id,
      userId: data.userId || null,
      brandName: data.brandName,
      productService: data.productService,
      usp: data.usp || null,
      customerPersona: data.customerPersona || null,
      painPoints: data.painPoints || null,
      solution: data.solution || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.brandAnalysesMap.set(id, brandAnalysis);
    return brandAnalysis;
  }

  async getBrandAnalysis(id: string): Promise<BrandAnalysis | undefined> {
    return this.brandAnalysesMap.get(id);
  }

  async listBrandAnalyses(userId?: string): Promise<BrandAnalysis[]> {
    let analyses = Array.from(this.brandAnalysesMap.values());
    if (userId) {
      analyses = analyses.filter(ba => ba.userId === userId);
    }
    return analyses.sort(
      (a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    );
  }

  async updateBrandAnalysis(id: string, updates: Partial<InsertBrandAnalysis>): Promise<BrandAnalysis | undefined> {
    const existing = this.brandAnalysesMap.get(id);
    if (!existing) return undefined;

    const updated: BrandAnalysis = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.brandAnalysesMap.set(id, updated);
    return updated;
  }

  async deleteBrandAnalysis(id: string): Promise<boolean> {
    return this.brandAnalysesMap.delete(id);
  }

  async createContentSet(insertContentSet: InsertContentSet): Promise<ContentSet> {
    const id = randomUUID();
    const contentSet: ContentSet = {
      keyword: insertContentSet.keyword,
      userId: insertContentSet.userId || null,
      brandAnalysisId: insertContentSet.brandAnalysisId || null,
      instagramSlides: insertContentSet.instagramSlides || null,
      instagramCaption: insertContentSet.instagramCaption || null,
      instagramHashtags: insertContentSet.instagramHashtags || null,
      instagramImageUrls: insertContentSet.instagramImageUrls || null,
      blogTitle: insertContentSet.blogTitle || null,
      blogContent: insertContentSet.blogContent || null,
      blogMetaDescription: insertContentSet.blogMetaDescription || null,
      blogHtml: insertContentSet.blogHtml || null,
      blogImageUrls: insertContentSet.blogImageUrls || null,
      blogTitles: insertContentSet.blogTitles || null,
      blogThumbnailTexts: insertContentSet.blogThumbnailTexts || null,
      blogImageRecommendations: insertContentSet.blogImageRecommendations || null,
      blogInternalLinkTopics: insertContentSet.blogInternalLinkTopics || null,
      blogHashtags: insertContentSet.blogHashtags || null,
      scheduledDate: insertContentSet.scheduledDate || null,
      status: insertContentSet.status || "draft",
      platforms: insertContentSet.platforms || null,
      id,
      createdAt: new Date(),
    };
    this.contentSets.set(id, contentSet);
    return contentSet;
  }

  async getContentSet(id: string): Promise<ContentSet | undefined> {
    return this.contentSets.get(id);
  }

  async listContentSets(userId?: string): Promise<ContentSet[]> {
    let sets = Array.from(this.contentSets.values());
    if (userId) {
      sets = sets.filter(cs => cs.userId === userId);
    }
    return sets.sort(
      (a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    );
  }

  async updateContentSet(
    id: string,
    updates: Partial<InsertContentSet>
  ): Promise<ContentSet | undefined> {
    const existing = this.contentSets.get(id);
    if (!existing) return undefined;

    const updated: ContentSet = {
      ...existing,
      keyword: updates.keyword !== undefined ? updates.keyword : existing.keyword,
      userId: updates.userId !== undefined ? updates.userId : existing.userId,
      instagramSlides: updates.instagramSlides !== undefined ? updates.instagramSlides : existing.instagramSlides,
      instagramCaption: updates.instagramCaption !== undefined ? updates.instagramCaption : existing.instagramCaption,
      instagramHashtags: updates.instagramHashtags !== undefined ? updates.instagramHashtags : existing.instagramHashtags,
      instagramImageUrls: updates.instagramImageUrls !== undefined ? updates.instagramImageUrls : existing.instagramImageUrls,
      blogTitle: updates.blogTitle !== undefined ? updates.blogTitle : existing.blogTitle,
      blogContent: updates.blogContent !== undefined ? updates.blogContent : existing.blogContent,
      blogMetaDescription: updates.blogMetaDescription !== undefined ? updates.blogMetaDescription : existing.blogMetaDescription,
      blogHtml: updates.blogHtml !== undefined ? updates.blogHtml : existing.blogHtml,
      blogImageUrls: updates.blogImageUrls !== undefined ? updates.blogImageUrls : existing.blogImageUrls,
      scheduledDate: updates.scheduledDate !== undefined ? updates.scheduledDate : existing.scheduledDate,
      status: updates.status !== undefined ? updates.status : existing.status,
      platforms: updates.platforms !== undefined ? updates.platforms : existing.platforms,
    };
    this.contentSets.set(id, updated);
    return updated;
  }

  async deleteContentSet(id: string): Promise<boolean> {
    return this.contentSets.delete(id);
  }

  async getScheduledContentSets(): Promise<ContentSet[]> {
    return Array.from(this.contentSets.values()).filter(
      (cs) => cs.status === "scheduled" && cs.scheduledDate
    );
  }

  async updateContentSetStatus(id: string, status: string): Promise<ContentSet | undefined> {
    const existing = this.contentSets.get(id);
    if (!existing) return undefined;

    const updated: ContentSet = {
      ...existing,
      status,
    };
    this.contentSets.set(id, updated);
    return updated;
  }

  async createMonthlyPlan(data: InsertMonthlyPlan): Promise<MonthlyPlan> {
    const id = randomUUID();
    const plan: MonthlyPlan = {
      id,
      userId: data.userId || null,
      brandAnalysisId: data.brandAnalysisId || null,
      year: data.year,
      month: data.month,
      title: data.title,
      themes: data.themes || null,
      contentItems: data.contentItems,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.monthlyPlansMap.set(id, plan);
    return plan;
  }

  async getMonthlyPlan(id: string): Promise<MonthlyPlan | undefined> {
    return this.monthlyPlansMap.get(id);
  }

  async getMonthlyPlanByMonth(userId: string, year: string, month: string): Promise<MonthlyPlan | undefined> {
    return Array.from(this.monthlyPlansMap.values()).find(
      p => p.userId === userId && p.year === year && p.month === month
    );
  }

  async listMonthlyPlans(userId?: string): Promise<MonthlyPlan[]> {
    let plans = Array.from(this.monthlyPlansMap.values());
    if (userId) {
      plans = plans.filter(p => p.userId === userId);
    }
    return plans.sort((a, b) => {
      const dateA = `${a.year}-${a.month}`;
      const dateB = `${b.year}-${b.month}`;
      return dateB.localeCompare(dateA);
    });
  }

  async updateMonthlyPlan(id: string, updates: Partial<InsertMonthlyPlan>): Promise<MonthlyPlan | undefined> {
    const existing = this.monthlyPlansMap.get(id);
    if (!existing) return undefined;

    const updated: MonthlyPlan = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.monthlyPlansMap.set(id, updated);
    return updated;
  }

  async deleteMonthlyPlan(id: string): Promise<boolean> {
    return this.monthlyPlansMap.delete(id);
  }

  async createScriptureContent(data: InsertScriptureContent): Promise<ScriptureContent> {
    const id = randomUUID();
    const content: ScriptureContent = {
      id,
      userId: data.userId || null,
      youtubeUrl: data.youtubeUrl || null,
      videoTitle: data.videoTitle,
      videoSummary: data.videoSummary || null,
      bibleVerse: data.bibleVerse,
      bibleReference: data.bibleReference,
      instagramSlides: data.instagramSlides || null,
      instagramCaption: data.instagramCaption || null,
      instagramHashtags: data.instagramHashtags || null,
      imageUrls: data.imageUrls || null,
      blogTitle: data.blogTitle || null,
      blogContent: data.blogContent || null,
      blogMetaDescription: data.blogMetaDescription || null,
      createdAt: new Date(),
    };
    this.scriptureContentsMap.set(id, content);
    return content;
  }

  async getScriptureContent(id: string): Promise<ScriptureContent | undefined> {
    return this.scriptureContentsMap.get(id);
  }

  async listScriptureContents(userId?: string, channelName?: string): Promise<ScriptureContent[]> {
    let contents = Array.from(this.scriptureContentsMap.values());
    if (userId) contents = contents.filter(c => c.userId === userId);
    if (channelName) contents = contents.filter(c => (c as any).channelName === channelName);
    return contents.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async listScriptureChannels(userId: string): Promise<{ channelName: string; count: number }[]> {
    const contents = Array.from(this.scriptureContentsMap.values()).filter(c => c.userId === userId);
    const map: Record<string, number> = {};
    for (const c of contents) {
      const name = (c as any).channelName || '기타';
      map[name] = (map[name] || 0) + 1;
    }
    return Object.entries(map).map(([channelName, count]) => ({ channelName, count })).sort((a, b) => b.count - a.count);
  }

  async updateScriptureContentImages(id: string, imageUrls: string[]): Promise<ScriptureContent | undefined> {
    const existing = this.scriptureContentsMap.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, imageUrls };
    this.scriptureContentsMap.set(id, updated);
    return updated;
  }

  async deleteScriptureContent(id: string): Promise<boolean> {
    return this.scriptureContentsMap.delete(id);
  }

  async getScriptureAutomation(userId: string): Promise<ScriptureAutomation | undefined> {
    return Array.from(this.scriptureAutomationsMap.values()).find(a => a.userId === userId);
  }

  async upsertScriptureAutomation(data: InsertScriptureAutomation): Promise<ScriptureAutomation> {
    const existing = data.userId ? await this.getScriptureAutomation(data.userId) : undefined;
    if (existing) {
      const updated: ScriptureAutomation = {
        ...existing,
        ...data,
        updatedAt: new Date(),
      };
      this.scriptureAutomationsMap.set(existing.id, updated);
      return updated;
    }
    const id = randomUUID();
    const automation: ScriptureAutomation = {
      id,
      userId: data.userId || null,
      channelUrl: data.channelUrl || null,
      isActive: data.isActive || false,
      frequency: data.frequency || "daily",
      verseHint: data.verseHint || null,
      lastRun: data.lastRun || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.scriptureAutomationsMap.set(id, automation);
    return automation;
  }

  async createSavedYoutubeChannel(data: InsertSavedYoutubeChannel): Promise<SavedYoutubeChannel> {
    const id = randomUUID();
    const channel: SavedYoutubeChannel = {
      id,
      userId: data.userId || null,
      channelUrl: data.channelUrl,
      channelName: data.channelName,
      isActive: data.isActive ?? true,
      lastCheckedAt: null,
      processedVideoIds: [],
      createdAt: new Date(),
    };
    this.savedYoutubeChannelsMap.set(id, channel);
    return channel;
  }

  async listSavedYoutubeChannels(userId: string): Promise<SavedYoutubeChannel[]> {
    return Array.from(this.savedYoutubeChannelsMap.values())
      .filter(c => c.userId === userId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async deleteSavedYoutubeChannel(id: string): Promise<boolean> {
    return this.savedYoutubeChannelsMap.delete(id);
  }

  async toggleSavedYoutubeChannel(id: string, isActive: boolean): Promise<SavedYoutubeChannel | undefined> {
    const channel = this.savedYoutubeChannelsMap.get(id);
    if (!channel) return undefined;
    const updated = { ...channel, isActive };
    this.savedYoutubeChannelsMap.set(id, updated);
    return updated;
  }

  async updateSavedYoutubeChannelLastChecked(id: string): Promise<SavedYoutubeChannel | undefined> {
    const channel = this.savedYoutubeChannelsMap.get(id);
    if (!channel) return undefined;
    const updated = { ...channel, lastCheckedAt: new Date() };
    this.savedYoutubeChannelsMap.set(id, updated);
    return updated;
  }

  async updateSavedYoutubeChannelProcessedVideos(id: string, processedVideoIds: string[]): Promise<SavedYoutubeChannel | undefined> {
    const channel = this.savedYoutubeChannelsMap.get(id);
    if (!channel) return undefined;
    const updated = { ...channel, processedVideoIds };
    this.savedYoutubeChannelsMap.set(id, updated);
    return updated;
  }

  async getActiveSavedYoutubeChannels(userId: string): Promise<SavedYoutubeChannel[]> {
    return Array.from(this.savedYoutubeChannelsMap.values())
      .filter(c => c.userId === userId && c.isActive)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async getAllActiveSavedYoutubeChannels(): Promise<SavedYoutubeChannel[]> {
    return Array.from(this.savedYoutubeChannelsMap.values())
      .filter(c => c.isActive)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async createInventionIdea(data: InsertInventionIdea): Promise<InventionIdea> {
    const id = randomUUID();
    const idea: InventionIdea = {
      id,
      userId: data.userId || null,
      title: data.title,
      problem: data.problem,
      solution: data.solution,
      useCases: data.useCases || null,
      targetAudience: data.targetAudience || [],
      tone: data.tone || "professional",
      status: data.status || "draft",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.inventionIdeasMap.set(id, idea);
    return idea;
  }

  async getInventionIdea(id: string): Promise<InventionIdea | undefined> {
    return this.inventionIdeasMap.get(id);
  }

  async listInventionIdeas(userId: string): Promise<InventionIdea[]> {
    return Array.from(this.inventionIdeasMap.values())
      .filter(i => i.userId === userId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async updateInventionIdea(id: string, updates: Partial<InsertInventionIdea>): Promise<InventionIdea | undefined> {
    const existing = this.inventionIdeasMap.get(id);
    if (!existing) return undefined;
    const updated: InventionIdea = { ...existing, ...updates, updatedAt: new Date() };
    this.inventionIdeasMap.set(id, updated);
    return updated;
  }

  async deleteInventionIdea(id: string): Promise<boolean> {
    return this.inventionIdeasMap.delete(id);
  }

  async createInventionContent(data: InsertInventionContent): Promise<InventionContent> {
    const id = randomUUID();
    const content: InventionContent = {
      id,
      ideaId: data.ideaId || null,
      userId: data.userId || null,
      contentType: data.contentType,
      instagramSlides: data.instagramSlides || null,
      instagramImageUrls: data.instagramImageUrls || null,
      instagramCaption: data.instagramCaption || null,
      instagramHashtags: data.instagramHashtags || null,
      shortsScript: data.shortsScript || null,
      shortsScenes: data.shortsScenes || null,
      shortsDuration: data.shortsDuration || null,
      shortsVideoUrl: data.shortsVideoUrl || null,
      shortsThumbnailUrl: data.shortsThumbnailUrl || null,
      blogTitle: data.blogTitle || null,
      blogContent: data.blogContent || null,
      blogHtml: data.blogHtml || null,
      blogMetaDescription: data.blogMetaDescription || null,
      blogHashtags: data.blogHashtags || null,
      copyright: data.copyright || null,
      createdAt: new Date(),
    };
    this.inventionContentsMap.set(id, content);
    return content;
  }

  async getInventionContent(id: string): Promise<InventionContent | undefined> {
    return this.inventionContentsMap.get(id);
  }

  async updateInventionContent(id: string, updates: Partial<InsertInventionContent>): Promise<InventionContent | undefined> {
    const existing = this.inventionContentsMap.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    this.inventionContentsMap.set(id, updated);
    return updated;
  }

  async listInventionContentsByIdea(ideaId: string): Promise<InventionContent[]> {
    return Array.from(this.inventionContentsMap.values())
      .filter(c => c.ideaId === ideaId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async listInventionContents(userId: string): Promise<InventionContent[]> {
    return Array.from(this.inventionContentsMap.values())
      .filter(c => c.userId === userId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async deleteInventionContent(id: string): Promise<boolean> {
    return this.inventionContentsMap.delete(id);
  }

  async createUploadHistory(data: InsertUploadHistory): Promise<UploadHistory> {
    const id = randomUUID();
    const history: UploadHistory = {
      id,
      userId: data.userId || null,
      contentId: data.contentId || null,
      platform: data.platform,
      uploadType: data.uploadType || "manual",
      status: data.status || "pending",
      externalId: data.externalId || null,
      externalUrl: data.externalUrl || null,
      views: data.views || null,
      likes: data.likes || null,
      notes: data.notes || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.uploadHistoryMap.set(id, history);
    return history;
  }

  async listUploadHistory(userId: string): Promise<UploadHistory[]> {
    return Array.from(this.uploadHistoryMap.values())
      .filter(h => h.userId === userId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async updateUploadHistory(id: string, updates: Partial<InsertUploadHistory>): Promise<UploadHistory | undefined> {
    const existing = this.uploadHistoryMap.get(id);
    if (!existing) return undefined;
    const updated: UploadHistory = { ...existing, ...updates, updatedAt: new Date() };
    this.uploadHistoryMap.set(id, updated);
    return updated;
  }

  private apiKeysMap = new Map<string, ApiKey>();
  async createApiKey(userId: string, name: string, key: string): Promise<ApiKey> {
    const record: ApiKey = { id: randomUUID(), userId, name, key, lastUsedAt: null, createdAt: new Date() };
    this.apiKeysMap.set(record.id, record);
    return record;
  }
  async listApiKeys(userId: string): Promise<ApiKey[]> {
    return Array.from(this.apiKeysMap.values()).filter(k => k.userId === userId);
  }
  async getApiKeyByKey(key: string): Promise<ApiKey | undefined> {
    return Array.from(this.apiKeysMap.values()).find(k => k.key === key);
  }
  async deleteApiKey(id: string, userId: string): Promise<boolean> {
    const k = this.apiKeysMap.get(id);
    if (!k || k.userId !== userId) return false;
    return this.apiKeysMap.delete(id);
  }
  async touchApiKey(key: string): Promise<void> {
    const k = Array.from(this.apiKeysMap.values()).find(k => k.key === key);
    if (k) { k.lastUsedAt = new Date(); this.apiKeysMap.set(k.id, k); }
  }

  private platformConnectionsMap = new Map<string, PlatformConnection>();
  async getPlatformConnection(userId: string, platform: string): Promise<PlatformConnection | null> {
    return Array.from(this.platformConnectionsMap.values()).find(c => c.userId === userId && c.platform === platform) || null;
  }
  async listPlatformConnections(userId: string): Promise<PlatformConnection[]> {
    return Array.from(this.platformConnectionsMap.values()).filter(c => c.userId === userId);
  }
  async upsertPlatformConnection(data: InsertPlatformConnection): Promise<PlatformConnection> {
    const existing = await this.getPlatformConnection(data.userId, data.platform);
    if (existing) {
      const updated = { ...existing, ...data, updatedAt: new Date() };
      this.platformConnectionsMap.set(existing.id, updated);
      return updated;
    }
    const id = randomUUID();
    const record: PlatformConnection = { id, ...data, isActive: data.isActive ?? true, createdAt: new Date(), updatedAt: new Date(), instagramUserId: data.instagramUserId ?? null, instagramAccessToken: data.instagramAccessToken ?? null, instagramUsername: data.instagramUsername ?? null, instagramTokenExpiresAt: data.instagramTokenExpiresAt ?? null, wordpressUrl: data.wordpressUrl ?? null, wordpressUsername: data.wordpressUsername ?? null, wordpressAppPassword: data.wordpressAppPassword ?? null, tistoryAccessToken: data.tistoryAccessToken ?? null, tistoryBlogName: data.tistoryBlogName ?? null, naverAccessToken: data.naverAccessToken ?? null, naverRefreshToken: data.naverRefreshToken ?? null };
    this.platformConnectionsMap.set(id, record);
    return record;
  }
  async deletePlatformConnection(userId: string, platform: string): Promise<boolean> {
    const c = await this.getPlatformConnection(userId, platform);
    if (!c) return false;
    return this.platformConnectionsMap.delete(c.id);
  }
}

export class PostgresStorage implements IStorage {
  private db;
  private pool: InstanceType<typeof Pool>;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
      min: 0,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 20000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 5000,
    });

    this.pool.on("error", (err) => {
      console.error("[DB Pool] 연결 오류 (자동 복구됨):", err.message);
    });

    this.db = drizzle(this.pool);
  }

  // DB 쿼리 재시도 래퍼 — 연결 끊김 시 최대 3회 재시도 (지수 백오프)
  private async withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err: any) {
        const isConnErr =
          err?.message?.includes("Connection terminated") ||
          err?.message?.includes("ECONNREFUSED") ||
          err?.message?.includes("ENOTFOUND") ||
          err?.message?.includes("connect") ||
          err?.code === "57P01" ||
          err?.code === "ECONNRESET";
        if (isConnErr && attempt < maxRetries) {
          const delay = attempt * 2000;
          console.warn(`[DB] 연결 오류 (${attempt}/${maxRetries}), ${delay}ms 후 재시도...`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        throw err;
      }
    }
    throw new Error("DB 재시도 한도 초과");
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await this.db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async listUsers(): Promise<User[]> {
    return await this.db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUserAdmin(id: string, isAdmin: boolean): Promise<User | undefined> {
    const [user] = await this.db
      .update(users)
      .set({ isAdmin, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await this.db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  async createBrandAnalysis(data: InsertBrandAnalysis): Promise<BrandAnalysis> {
    const result = await this.db.insert(brandAnalyses).values(data).returning();
    return result[0];
  }

  async getBrandAnalysis(id: string): Promise<BrandAnalysis | undefined> {
    const result = await this.db.select().from(brandAnalyses).where(eq(brandAnalyses.id, id));
    return result[0];
  }

  async listBrandAnalyses(userId?: string): Promise<BrandAnalysis[]> {
    if (userId) {
      return await this.db
        .select()
        .from(brandAnalyses)
        .where(eq(brandAnalyses.userId, userId))
        .orderBy(desc(brandAnalyses.createdAt));
    }
    return await this.db.select().from(brandAnalyses).orderBy(desc(brandAnalyses.createdAt));
  }

  async updateBrandAnalysis(id: string, updates: Partial<InsertBrandAnalysis>): Promise<BrandAnalysis | undefined> {
    const result = await this.db
      .update(brandAnalyses)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(brandAnalyses.id, id))
      .returning();
    return result[0];
  }

  async deleteBrandAnalysis(id: string): Promise<boolean> {
    const result = await this.db.delete(brandAnalyses).where(eq(brandAnalyses.id, id)).returning();
    return result.length > 0;
  }

  async createContentSet(insertContentSet: InsertContentSet): Promise<ContentSet> {
    return this.withRetry(async () => {
      const result = await this.db.insert(contentSets).values(insertContentSet).returning();
      return result[0];
    });
  }

  async getContentSet(id: string): Promise<ContentSet | undefined> {
    return this.withRetry(async () => {
      const result = await this.db.select().from(contentSets).where(eq(contentSets.id, id));
      return result[0];
    });
  }

  async listContentSets(userId?: string): Promise<ContentSet[]> {
    if (userId) {
      return await this.db
        .select()
        .from(contentSets)
        .where(eq(contentSets.userId, userId))
        .orderBy(desc(contentSets.createdAt));
    }
    return await this.db.select().from(contentSets).orderBy(desc(contentSets.createdAt));
  }

  async updateContentSet(
    id: string,
    updates: Partial<InsertContentSet>
  ): Promise<ContentSet | undefined> {
    const result = await this.db
      .update(contentSets)
      .set(updates)
      .where(eq(contentSets.id, id))
      .returning();
    return result[0];
  }

  async deleteContentSet(id: string): Promise<boolean> {
    const result = await this.db.delete(contentSets).where(eq(contentSets.id, id)).returning();
    return result.length > 0;
  }

  async getScheduledContentSets(): Promise<ContentSet[]> {
    const result = await this.db
      .select()
      .from(contentSets)
      .where(eq(contentSets.status, "scheduled"));
    return result.filter((cs) => cs.scheduledDate !== null);
  }

  async updateContentSetStatus(id: string, status: string): Promise<ContentSet | undefined> {
    const result = await this.db
      .update(contentSets)
      .set({ status })
      .where(eq(contentSets.id, id))
      .returning();
    return result[0];
  }

  async createMonthlyPlan(data: InsertMonthlyPlan): Promise<MonthlyPlan> {
    const result = await this.db.insert(monthlyPlans).values(data).returning();
    return result[0];
  }

  async getMonthlyPlan(id: string): Promise<MonthlyPlan | undefined> {
    const result = await this.db.select().from(monthlyPlans).where(eq(monthlyPlans.id, id));
    return result[0];
  }

  async getMonthlyPlanByMonth(userId: string, year: string, month: string): Promise<MonthlyPlan | undefined> {
    const result = await this.db
      .select()
      .from(monthlyPlans)
      .where(eq(monthlyPlans.userId, userId));
    return result.find(p => p.year === year && p.month === month);
  }

  async listMonthlyPlans(userId?: string): Promise<MonthlyPlan[]> {
    if (userId) {
      return await this.db
        .select()
        .from(monthlyPlans)
        .where(eq(monthlyPlans.userId, userId))
        .orderBy(desc(monthlyPlans.createdAt));
    }
    return await this.db.select().from(monthlyPlans).orderBy(desc(monthlyPlans.createdAt));
  }

  async updateMonthlyPlan(id: string, updates: Partial<InsertMonthlyPlan>): Promise<MonthlyPlan | undefined> {
    const result = await this.db
      .update(monthlyPlans)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(monthlyPlans.id, id))
      .returning();
    return result[0];
  }

  async deleteMonthlyPlan(id: string): Promise<boolean> {
    const result = await this.db.delete(monthlyPlans).where(eq(monthlyPlans.id, id)).returning();
    return result.length > 0;
  }

  async createScriptureContent(data: InsertScriptureContent): Promise<ScriptureContent> {
    const result = await this.db.insert(scriptureContents).values(data).returning();
    return result[0];
  }

  async getScriptureContent(id: string): Promise<ScriptureContent | undefined> {
    const result = await this.db.select().from(scriptureContents).where(eq(scriptureContents.id, id));
    return result[0];
  }

  async listScriptureContents(userId?: string, channelName?: string): Promise<ScriptureContent[]> {
    const { sql: rawSql } = await import("drizzle-orm");
    const conditions: any[] = [];
    if (userId) conditions.push(eq(scriptureContents.userId, userId));
    if (channelName) conditions.push(eq(scriptureContents.channelName as any, channelName));

    let query = this.db.select().from(scriptureContents).orderBy(desc(scriptureContents.createdAt)) as any;
    if (conditions.length === 1) query = query.where(conditions[0]);
    else if (conditions.length > 1) query = query.where(and(...conditions));
    return query;
  }

  async listScriptureChannels(userId: string): Promise<{ channelName: string; count: number }[]> {
    const { sql: rawSql } = await import("drizzle-orm");
    const result = await this.db.execute(
      rawSql`SELECT channel_name as "channelName", COUNT(*)::int as count
             FROM scripture_contents
             WHERE user_id = ${userId} AND channel_name IS NOT NULL
             GROUP BY channel_name ORDER BY count DESC`
    );
    return result.rows as { channelName: string; count: number }[];
  }

  async updateScriptureContentImages(id: string, imageUrls: string[]): Promise<ScriptureContent | undefined> {
    const result = await this.db.update(scriptureContents)
      .set({ imageUrls })
      .where(eq(scriptureContents.id, id))
      .returning();
    return result[0];
  }

  async deleteScriptureContent(id: string): Promise<boolean> {
    const result = await this.db.delete(scriptureContents).where(eq(scriptureContents.id, id)).returning();
    return result.length > 0;
  }

  async getScriptureAutomation(userId: string): Promise<ScriptureAutomation | undefined> {
    const result = await this.db.select().from(scriptureAutomations).where(eq(scriptureAutomations.userId, userId));
    return result[0];
  }

  async upsertScriptureAutomation(data: InsertScriptureAutomation): Promise<ScriptureAutomation> {
    if (data.userId) {
      const existing = await this.getScriptureAutomation(data.userId);
      if (existing) {
        const result = await this.db
          .update(scriptureAutomations)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(scriptureAutomations.id, existing.id))
          .returning();
        return result[0];
      }
    }
    const result = await this.db.insert(scriptureAutomations).values(data).returning();
    return result[0];
  }

  async createSavedYoutubeChannel(data: InsertSavedYoutubeChannel): Promise<SavedYoutubeChannel> {
    const result = await this.db.insert(savedYoutubeChannels).values(data).returning();
    return result[0];
  }

  async listSavedYoutubeChannels(userId: string): Promise<SavedYoutubeChannel[]> {
    return await this.db
      .select()
      .from(savedYoutubeChannels)
      .where(eq(savedYoutubeChannels.userId, userId))
      .orderBy(desc(savedYoutubeChannels.createdAt));
  }

  async deleteSavedYoutubeChannel(id: string): Promise<boolean> {
    const result = await this.db.delete(savedYoutubeChannels).where(eq(savedYoutubeChannels.id, id)).returning();
    return result.length > 0;
  }

  async toggleSavedYoutubeChannel(id: string, isActive: boolean): Promise<SavedYoutubeChannel | undefined> {
    const result = await this.db
      .update(savedYoutubeChannels)
      .set({ isActive })
      .where(eq(savedYoutubeChannels.id, id))
      .returning();
    return result[0];
  }

  async updateSavedYoutubeChannelLastChecked(id: string): Promise<SavedYoutubeChannel | undefined> {
    const result = await this.db
      .update(savedYoutubeChannels)
      .set({ lastCheckedAt: new Date() })
      .where(eq(savedYoutubeChannels.id, id))
      .returning();
    return result[0];
  }

  async updateSavedYoutubeChannelProcessedVideos(id: string, processedVideoIds: string[]): Promise<SavedYoutubeChannel | undefined> {
    const result = await this.db
      .update(savedYoutubeChannels)
      .set({ processedVideoIds })
      .where(eq(savedYoutubeChannels.id, id))
      .returning();
    return result[0];
  }

  async getActiveSavedYoutubeChannels(userId: string): Promise<SavedYoutubeChannel[]> {
    return await this.db
      .select()
      .from(savedYoutubeChannels)
      .where(and(eq(savedYoutubeChannels.userId, userId), eq(savedYoutubeChannels.isActive, true)))
      .orderBy(desc(savedYoutubeChannels.createdAt));
  }

  async getAllActiveSavedYoutubeChannels(): Promise<SavedYoutubeChannel[]> {
    return await this.db
      .select()
      .from(savedYoutubeChannels)
      .where(eq(savedYoutubeChannels.isActive, true))
      .orderBy(desc(savedYoutubeChannels.createdAt));
  }

  async createInventionIdea(data: InsertInventionIdea): Promise<InventionIdea> {
    const result = await this.db.insert(inventionIdeas).values(data).returning();
    return result[0];
  }

  async getInventionIdea(id: string): Promise<InventionIdea | undefined> {
    const result = await this.db.select().from(inventionIdeas).where(eq(inventionIdeas.id, id));
    return result[0];
  }

  async listInventionIdeas(userId: string): Promise<InventionIdea[]> {
    return await this.db
      .select()
      .from(inventionIdeas)
      .where(eq(inventionIdeas.userId, userId))
      .orderBy(desc(inventionIdeas.createdAt));
  }

  async updateInventionIdea(id: string, updates: Partial<InsertInventionIdea>): Promise<InventionIdea | undefined> {
    const result = await this.db
      .update(inventionIdeas)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(inventionIdeas.id, id))
      .returning();
    return result[0];
  }

  async deleteInventionIdea(id: string): Promise<boolean> {
    const result = await this.db.delete(inventionIdeas).where(eq(inventionIdeas.id, id)).returning();
    return result.length > 0;
  }

  async createInventionContent(data: InsertInventionContent): Promise<InventionContent> {
    const result = await this.db.insert(inventionContents).values(data).returning();
    return result[0];
  }

  async getInventionContent(id: string): Promise<InventionContent | undefined> {
    const result = await this.db.select().from(inventionContents).where(eq(inventionContents.id, id));
    return result[0];
  }

  async updateInventionContent(id: string, updates: Partial<InsertInventionContent>): Promise<InventionContent | undefined> {
    const result = await this.db.update(inventionContents).set(updates).where(eq(inventionContents.id, id)).returning();
    return result[0];
  }

  async listInventionContentsByIdea(ideaId: string): Promise<InventionContent[]> {
    return await this.db
      .select()
      .from(inventionContents)
      .where(eq(inventionContents.ideaId, ideaId))
      .orderBy(desc(inventionContents.createdAt));
  }

  async listInventionContents(userId: string): Promise<InventionContent[]> {
    return await this.db
      .select()
      .from(inventionContents)
      .where(eq(inventionContents.userId, userId))
      .orderBy(desc(inventionContents.createdAt));
  }

  async deleteInventionContent(id: string): Promise<boolean> {
    const result = await this.db.delete(inventionContents).where(eq(inventionContents.id, id)).returning();
    return result.length > 0;
  }

  async createUploadHistory(data: InsertUploadHistory): Promise<UploadHistory> {
    const result = await this.db.insert(uploadHistory).values(data).returning();
    return result[0];
  }

  async listUploadHistory(userId: string): Promise<UploadHistory[]> {
    return await this.db
      .select()
      .from(uploadHistory)
      .where(eq(uploadHistory.userId, userId))
      .orderBy(desc(uploadHistory.createdAt));
  }

  async updateUploadHistory(id: string, updates: Partial<InsertUploadHistory>): Promise<UploadHistory | undefined> {
    const result = await this.db
      .update(uploadHistory)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(uploadHistory.id, id))
      .returning();
    return result[0];
  }

  async createApiKey(userId: string, name: string, key: string): Promise<ApiKey> {
    const [record] = await this.db.insert(apiKeys).values({ userId, name, key }).returning();
    return record;
  }
  async listApiKeys(userId: string): Promise<ApiKey[]> {
    return this.db.select().from(apiKeys).where(eq(apiKeys.userId, userId)).orderBy(desc(apiKeys.createdAt));
  }
  async getApiKeyByKey(key: string): Promise<ApiKey | undefined> {
    const [record] = await this.db.select().from(apiKeys).where(eq(apiKeys.key, key));
    return record;
  }
  async deleteApiKey(id: string, userId: string): Promise<boolean> {
    const result = await this.db.delete(apiKeys).where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId))).returning();
    return result.length > 0;
  }
  async touchApiKey(key: string): Promise<void> {
    await this.db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.key, key));
  }

  async getPlatformConnection(userId: string, platform: string): Promise<PlatformConnection | null> {
    const [record] = await this.db
      .select()
      .from(platformConnections)
      .where(and(eq(platformConnections.userId, userId), eq(platformConnections.platform, platform)));
    return record || null;
  }

  async listPlatformConnections(userId: string): Promise<PlatformConnection[]> {
    return this.db
      .select()
      .from(platformConnections)
      .where(eq(platformConnections.userId, userId));
  }

  async upsertPlatformConnection(data: InsertPlatformConnection): Promise<PlatformConnection> {
    const existing = await this.getPlatformConnection(data.userId, data.platform);
    if (existing) {
      const [updated] = await this.db
        .update(platformConnections)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(platformConnections.userId, data.userId), eq(platformConnections.platform, data.platform)))
        .returning();
      return updated;
    }
    const [created] = await this.db.insert(platformConnections).values(data).returning();
    return created;
  }

  async deletePlatformConnection(userId: string, platform: string): Promise<boolean> {
    const result = await this.db
      .delete(platformConnections)
      .where(and(eq(platformConnections.userId, userId), eq(platformConnections.platform, platform)))
      .returning();
    return result.length > 0;
  }

  // ── 월간 희망 콘텐츠 ────────────────────────────────────────────────────────

  async createMonthlyContent(data: InsertMonthlyContent): Promise<MonthlyContent> {
    const [created] = await this.db.insert(monthlyContents).values(data).returning();
    return created;
  }

  async getMonthlyContents(userId: string): Promise<MonthlyContent[]> {
    return this.db
      .select()
      .from(monthlyContents)
      .where(eq(monthlyContents.userId, userId))
      .orderBy(desc(monthlyContents.createdAt));
  }

  async getMonthlyContent(id: string): Promise<MonthlyContent | undefined> {
    const [row] = await this.db.select().from(monthlyContents).where(eq(monthlyContents.id, id));
    return row;
  }

  async deleteMonthlyContent(id: string, userId: string): Promise<boolean> {
    const result = await this.db
      .delete(monthlyContents)
      .where(and(eq(monthlyContents.id, id), eq(monthlyContents.userId, userId)))
      .returning();
    return result.length > 0;
  }
}

export const storage: IStorage = process.env.DATABASE_URL
  ? new PostgresStorage()
  : new MemStorage();
