# ContentFlow - AI Content Automation Platform

## Overview

ContentFlow is an AI-powered content automation platform that streamlines the creation, scheduling, and publishing of social media and blog content. The application generates tailored content for Instagram (carousels with images) and blogs using AI, provides scheduling capabilities, and offers analytics tracking. Built as a modern SaaS dashboard with a focus on efficiency and content-first design.

## Recent Changes

- **Invention Idea Content Generation** (February 2026)
  - New feature to transform invention ideas into SNS-ready content
  - Input fields: title, problem, solution, use cases, target audience, tone
  - Generates Instagram carousel (5 slides) with AI-generated images
  - Creates YouTube Shorts scripts with 3-5 scenes (15-25 seconds)
  - **NEW: Blog generation** (February 2026)
    - Naver popular blogger style blog post generation
    - Blog title, HTML content, plain text content, meta description
    - Copy HTML or text for pasting into blog platforms
    - Blog upload history tracking
    - Database fields: blogTitle, blogContent, blogHtml, blogMetaDescription in invention_contents
  - **Client-side YouTube Shorts video generation**
    - Creates video from Instagram images with Ken Burns effect
    - Overlays narration text from Shorts script scenes
    - 1080x1920 vertical format (9:16 aspect ratio)
    - Progress indicator during generation
    - Download as .webm file
  - Three content tone options: professional, emotional, casual
  - Multiple target audience selections
  - Upload history tracking for Instagram, YouTube, and Blog
  - Full Korean UI with copy/download functionality
  - Database tables: invention_ideas, invention_contents, upload_history
  - Sidebar navigation: "발명 아이디어" menu item
  - API endpoints: /api/invention-ideas, /api/invention-contents, /api/upload-history

- **YouTube Scripture Content Generation** (December 27, 2025)
  - Added new feature to generate Bible verse-based Instagram content from YouTube videos
  - Integrates functionality inspired by holy-ai-creator app
  - Two input modes: YouTube URL (auto transcript extraction) and direct transcript paste
  - AI analyzes video content and recommends relevant Bible verses
  - Generates Instagram carousel slides with scripture themes
  - Creates spiritual background images using Gemini AI
  - Full Korean UI with copy/download functionality
  - Sidebar navigation: "유튜브 말씀" menu item
  - API endpoint: /api/youtube-scripture/generate
  - **NEW: Automatic channel monitoring** (January 2026)
    - Scheduler automatically checks registered channels every 30 minutes
    - Detects new videos via YouTube RSS feeds
    - Automatically generates scripture content for new videos
    - Tracks processed videos to avoid duplicate generation

- **Gemini AI 이미지 생성 통합** (December 1, 2025)
  - DALL-E에서 Google Gemini (gemini-2.5-flash-image 모델)로 이미지 생성 전환
  - Replit AI Integrations 사용 - API 키 불필요, Replit 크레딧으로 자동 청구
  - 한글 텍스트 깨짐 문제 해결: 이미지에 텍스트 없이 생성 후 프론트엔드에서 오버레이
  - InstagramPreview 컴포넌트에서 실시간 텍스트 오버레이 표시
  - Canvas API로 텍스트가 포함된 이미지 다운로드 기능 구현
  - 커버 슬라이드와 콘텐츠 슬라이드에 맞는 텍스트 스타일 적용
  - 슬라이드 텍스트 내용에 맞는 컨텍스트 관련 배경 이미지 생성
  - 주제별 맞춤 이미지 프롬프트 (음식, 뷰티, 건강, 비즈니스, 테크, 라이프스타일 등)

- **Monthly content planning feature** (November 27, 2025)
  - Added monthlyPlans database table for storing content plans
  - AI generates 30 keyword content plan based on month/year/brand context
  - Content items include date, topic, platforms, content type, notes
  - Calendar-like UI for viewing monthly content schedule
  - Click on content item to navigate to generation page
  - Integration with brand analysis for contextual planning
  - Focus topics input for guided AI generation

- **Naver popular blogger style blog generation** (November 26, 2025)
  - Updated blog generation AI prompt for Naver top blogger style
  - Strong hook in first sentence (question, shocking fact, empathy)
  - 3-5 sections with H2/H3 headings for clear structure
  - Short sentences (2-3 per paragraph) for readability
  - Lists, bold text, tables for enhanced scanning
  - Fact-based info combined with personal experience
  - Friendly, trustworthy tone with formal Korean (존댓말)
  - 3-line summary + CTA in conclusion
  - New output fields: 3 title options, 2 thumbnail texts, 3 image recommendations with alt text, 3 internal link topics, 10 hashtags
  - Updated BlogPreview UI with accordion sections for new metadata
  - Added copy functionality for titles, thumbnails, hashtags

- **Brand analysis integration** (November 26, 2025)
  - Added brand analysis feature (USP, customer persona, pain points, solution)
  - Brand context incorporated into content generation prompts
  - Optional brand selector in keyword input for content generation
  - Brand analysis page with AI-powered analysis generation

- **Replit Auth integration with admin management** (November 26, 2025)
  - Implemented Replit Auth OIDC-based authentication (Google, GitHub, Apple, X, email)
  - Users table updated with OIDC claims: email, firstName, lastName, profileImageUrl, isAdmin
  - Sessions stored in PostgreSQL using connect-pg-simple (7-day TTL)
  - Admin panel for user management (view users, toggle admin role, delete users)
  - All content APIs protected with isAuthenticated middleware
  - Admin APIs protected with additional isAdmin middleware
  - Content sets now associated with userId for multi-user support
  - Landing page with login button for unauthenticated users
  - Sidebar shows user profile and admin menu for authorized users

- **Instagram cover slide and concise content** (November 23, 2025)
  - Added dedicated cover slide for Instagram carousel posts
  - First slide is now a bold, eye-catching cover with the main topic
  - Reduced content slide text to 15 characters max for better readability
  - Cover slide limited to 20 characters
  - Cover slide receives special image generation (vibrant gradients, centered title)
  - Content slides use Korean infographic style matching blog images

- **Unified Instagram and blog image generation** (November 23, 2025)
  - When both platforms selected, blog images are generated and shared with Instagram content slides
  - Instagram cover slide always generated separately with unique design
  - Remaining Instagram slides use the same images as blog sections
  - Reduced duplicate image generation for efficiency and consistency

- **AI-powered chat editing interface** (November 22, 2025)
  - Added conversational AI editing for Instagram and blog content
  - Implemented chat-based content modification using GPT-4o
  - Generate page now includes "Preview" and "AI Edit" tabs
  - Auto-save content sets as drafts for seamless editing
  - Real-time preview updates after AI modifications

- **Blog infographic generation pipeline** (November 22, 2025)
  - Added dedicated Korean-style infographic image generation for each blog section
  - Implemented concurrent image generation with pLimit(3) throttling
  - Extended schema with blogImageUrls field
  - Blog sections now receive purpose-built infographics separate from Instagram assets

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Tooling**
- React 18 with TypeScript for type-safe component development
- Vite as the build tool and development server for fast HMR
- Wouter for lightweight client-side routing
- TanStack Query (React Query) for server state management and API caching

**UI Component System**
- Shadcn/ui component library with Radix UI primitives
- Tailwind CSS for utility-first styling with custom design tokens
- Design system based on modern SaaS patterns (Linear, Notion, Asana)
- Dark mode support with theme toggling
- Responsive layout with sidebar navigation pattern
- Inline editing for Instagram content (slides, caption, hashtags)
- Multi-image carousel preview with slide navigation

**Key Design Decisions**
- Component-based architecture with reusable UI primitives
- Separation of presentation (components) and pages (routing)
- Centralized API client with consistent error handling
- Custom hooks for shared logic (mobile detection, toast notifications)

### Backend Architecture

**Server Framework**
- Express.js with TypeScript for API routes
- Separate development and production entry points for optimized builds
- Session-based architecture with middleware for request logging

**Content Generation Pipeline**
- OpenAI API integration via Replit AI Integrations service
- Retry logic with exponential backoff for rate limiting resilience
- Parallel content generation for multiple platforms (Instagram, blog)
- Structured content generation with aligned sections:
  - AI generates 5-7 core topics/sections for both Instagram and blog
  - Instagram: Each slide covers one core topic
  - Blog: Intro + 5-7 main sections (matching Instagram slides) + Conclusion + FAQ
- Image generation using Gemini (Google Imagen):
  - Instagram: Korean-style aesthetic backgrounds WITHOUT text (text overlaid in frontend)
  - Blog: Dedicated infographic background images for each main section
  - Korean text overlay added via CSS in InstagramPreview component
  - Canvas API used for downloading images with Korean text embedded
  - Concurrent image generation limited to 3 requests to avoid rate limits
- Blog layout with inline image-text pairing:
  - Parses blog HTML into sections by H2 tags
  - Each main section gets a dedicated infographic image
  - Alternating left/right image placement for visual variety
  - Image captions display section headings
  - Text-only sections for intro, conclusion, and FAQ
- URL sanitization for security (escapeHtml) when embedding images

**Scheduling System**
- Node-cron based scheduler running every minute
- Content status state machine: draft → scheduled → publishing → published/failed
- Automated publishing workflow simulation (extensible for real API integrations)

**Storage Layer**
- In-memory storage implementation (MemStorage class)
- Abstract IStorage interface for future database integration
- Drizzle ORM schema defined for PostgreSQL migration path
- Schema includes users and content sets with platform-specific fields

### Data Models

**Content Set Schema**
- Keyword-based content organization
- Platform-specific fields:
  - Instagram: slides (array), caption, hashtags (array), imageUrls (array - one per slide)
  - Blog: title, content, HTML (with inline infographic images), meta description, imageUrls (array - infographic images for main sections)
- Scheduling metadata (scheduledDate, status, platforms array)
- Audit fields (createdAt)

**User Schema**
- OIDC-based authentication via Replit Auth (id, email, firstName, lastName, profileImageUrl)
- Admin role management with isAdmin boolean field
- UUID-based primary keys (using Replit OIDC `sub` claim)
- Sessions stored in PostgreSQL using connect-pg-simple

**Session Schema**
- PostgreSQL-backed session storage for authentication
- Sessions expire after 7 days (configurable TTL)
- SameSite=lax cookie policy for CSRF protection

### API Structure

**Content Generation Endpoints**
- `POST /api/content/generate` - Generate content for selected platforms
- Accepts keyword and platform array, returns platform-specific content

**Content Management Endpoints**
- `POST /api/content-sets` - Create content set
- `GET /api/content-sets` - List all content sets
- `GET /api/content-sets/:id` - Get single content set
- `PATCH /api/content-sets/:id` - Update content set
- `DELETE /api/content-sets/:id` - Delete content set

### Key Architectural Patterns

**Error Handling**
- Rate limit detection and retry logic with p-retry library
- Abort errors for non-retryable failures
- Centralized API error handling in query client

**State Management**
- Server state via React Query with automatic cache invalidation
- Client state via React hooks and component state
- Toast notifications for user feedback

**Type Safety**
- Shared schema definitions between client and server
- Zod for runtime validation and schema generation
- TypeScript strict mode enabled

## External Dependencies

### AI Services
- **OpenAI API** (via Replit AI Integrations) - GPT-4o for text generation
- **Google Gemini** (via Replit AI Integrations) - gemini-2.5-flash-image for image generation (Google Imagen)
- No API keys required; uses Replit's managed service, billed to Replit credits

### Database
- **PostgreSQL** (configured, not yet provisioned) - Primary data store via Neon serverless driver
- **Drizzle ORM** - Type-safe database queries and migrations
- Migration path defined, currently using in-memory storage

### UI Libraries
- **Radix UI** - Headless component primitives (30+ components)
- **Shadcn/ui** - Pre-styled components built on Radix
- **Lucide React** - Icon library
- **React Icons** - Additional icons (Naver, WordPress logos)

### Styling
- **Tailwind CSS** - Utility-first CSS framework
- **class-variance-authority** - Type-safe variant styling
- **clsx/tailwind-merge** - Conditional class composition

### Development Tools
- **TypeScript** - Static type checking
- **ESBuild** - Production bundling
- **TSX** - TypeScript execution for development

### Scheduling
- **node-cron** - Job scheduling for automated publishing

### Future Integration Points
- Instagram Graph API for actual post publishing
- Blog platform APIs (Naver, WordPress, Tistory)
- Analytics services for engagement tracking
- OAuth providers for social media authentication