CREATE TABLE "api_keys" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"key" text NOT NULL,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "api_keys_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "brand_analyses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"brand_name" text NOT NULL,
	"product_service" text NOT NULL,
	"usp" text,
	"customer_persona" text,
	"pain_points" text,
	"solution" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "content_sets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"brand_analysis_id" varchar,
	"keyword" text NOT NULL,
	"instagram_slides" text[],
	"instagram_caption" text,
	"instagram_hashtags" text[],
	"instagram_image_urls" text[],
	"blog_title" text,
	"blog_content" text,
	"blog_meta_description" text,
	"blog_html" text,
	"blog_image_urls" text[],
	"blog_titles" text[],
	"blog_thumbnail_texts" text[],
	"blog_image_recommendations" jsonb,
	"blog_internal_link_topics" text[],
	"blog_hashtags" text[],
	"scheduled_date" timestamp,
	"status" text DEFAULT 'draft' NOT NULL,
	"platforms" text[],
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invention_contents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idea_id" varchar,
	"user_id" varchar,
	"content_type" text NOT NULL,
	"instagram_slides" text[],
	"instagram_image_urls" text[],
	"instagram_caption" text,
	"instagram_hashtags" text[],
	"shorts_script" text,
	"shorts_scenes" jsonb,
	"shorts_duration" text,
	"shorts_title" text,
	"shorts_hook" text,
	"shorts_hashtags" text[],
	"shorts_video_url" text,
	"shorts_thumbnail_url" text,
	"blog_title" text,
	"blog_content" text,
	"blog_html" text,
	"blog_meta_description" text,
	"blog_hashtags" text[],
	"copyright" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invention_ideas" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"title" text NOT NULL,
	"problem" text NOT NULL,
	"solution" text NOT NULL,
	"use_cases" text,
	"target_audience" text[] DEFAULT '{}',
	"tone" text DEFAULT 'professional' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "monthly_contents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"month" varchar(7) NOT NULL,
	"quote" text NOT NULL,
	"caption" text NOT NULL,
	"hashtags" text[] DEFAULT '{}'::text[] NOT NULL,
	"image_url" text,
	"image_base64" text,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "monthly_plans" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"brand_analysis_id" varchar,
	"year" text NOT NULL,
	"month" text NOT NULL,
	"title" text NOT NULL,
	"themes" text[],
	"content_items" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "platform_connections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"platform" text NOT NULL,
	"instagram_user_id" text,
	"instagram_access_token" text,
	"instagram_username" text,
	"instagram_token_expires_at" timestamp,
	"wordpress_url" text,
	"wordpress_username" text,
	"wordpress_app_password" text,
	"tistory_access_token" text,
	"tistory_blog_name" text,
	"naver_access_token" text,
	"naver_refresh_token" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "saved_youtube_channels" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"channel_url" text NOT NULL,
	"channel_name" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"last_checked_at" timestamp,
	"processed_video_ids" text[] DEFAULT '{}',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "scripture_automations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"channel_url" text,
	"is_active" boolean DEFAULT false,
	"frequency" text DEFAULT 'daily',
	"verse_hint" text,
	"last_run" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "scripture_contents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"youtube_url" text,
	"video_title" text NOT NULL,
	"video_summary" text,
	"bible_verse" text NOT NULL,
	"bible_reference" text NOT NULL,
	"instagram_slides" text[],
	"instagram_caption" text,
	"instagram_hashtags" text[],
	"image_urls" text[],
	"blog_title" text,
	"blog_content" text,
	"blog_meta_description" text,
	"channel_name" text,
	"channel_url" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "upload_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"content_id" varchar,
	"platform" text NOT NULL,
	"upload_type" text DEFAULT 'manual' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"external_id" text,
	"external_url" text,
	"views" text,
	"likes" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"is_admin" boolean DEFAULT false,
	"voice_data" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_analyses" ADD CONSTRAINT "brand_analyses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_sets" ADD CONSTRAINT "content_sets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_sets" ADD CONSTRAINT "content_sets_brand_analysis_id_brand_analyses_id_fk" FOREIGN KEY ("brand_analysis_id") REFERENCES "public"."brand_analyses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invention_contents" ADD CONSTRAINT "invention_contents_idea_id_invention_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."invention_ideas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invention_contents" ADD CONSTRAINT "invention_contents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invention_ideas" ADD CONSTRAINT "invention_ideas_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_contents" ADD CONSTRAINT "monthly_contents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_plans" ADD CONSTRAINT "monthly_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_plans" ADD CONSTRAINT "monthly_plans_brand_analysis_id_brand_analyses_id_fk" FOREIGN KEY ("brand_analysis_id") REFERENCES "public"."brand_analyses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_connections" ADD CONSTRAINT "platform_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_youtube_channels" ADD CONSTRAINT "saved_youtube_channels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scripture_automations" ADD CONSTRAINT "scripture_automations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scripture_contents" ADD CONSTRAINT "scripture_contents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_history" ADD CONSTRAINT "upload_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_history" ADD CONSTRAINT "upload_history_content_id_invention_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."invention_contents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");