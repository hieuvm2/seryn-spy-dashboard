/* ============================================================
   SERYN SPY ADS — weekly competitor intelligence schema
   5 tables matching the agent CSV outputs.
   ============================================================ */

export type ViewId =
  | "overview"
  | "brands"
  | "scaled-content"
  | "top-hooks"
  | "visual-intelligence"
  | "swipe-file"
  | "creative-briefs"
  | "weekly-changes"
  | "seryn-recommendations"
  | "competitor-setup"
  | "data-import";

/** Nguồn dữ liệu đang hiển thị. */
export type DataSourceType = "demo" | "local-csv" | "online-sheet" | "offline-cache";

export type BrandWeeklySnapshot = {
  week_date: string;
  brand_name: string;
  page_urls?: string;
  page_ids?: string;
  total_active_ads: number | string;
  total_ads_collected?: number | string;
  num_pages_running?: number | string;
  services_running?: string;
  prices_detected?: string;
  offers_detected?: string;
  main_content_formats?: string;
  main_hooks?: string;
  main_angles?: string;
  main_proof_points?: string;
  main_ctas?: string;
  scaled_content_count?: number | string;
  new_ads_count?: number | string;
  stopped_ads_count?: number | string;
  content_strategy_summary?: string;
  weekly_change_summary?: string;
  seryn_opportunity?: string;
};

export type AdLevelAnalysis = {
  week_date: string;
  brand_name: string;
  page_id?: string;
  page_name?: string;
  ad_id?: string;
  ad_snapshot_url?: string;
  status?: string;
  start_date?: string;
  days_active?: number | string;
  media_type?: string;
  platforms?: string;
  headline?: string;
  primary_text?: string;
  hook_text?: string;
  hook_type?: string;
  service_or_product?: string;
  price_detected?: string;
  offer_detected?: string;
  content_format?: string;
  content_angle?: string;
  proof_point?: string;
  cta?: string;
  funnel_stage?: string;
  is_new_this_week?: string | boolean;
  was_seen_previous_week?: string | boolean;
  is_likely_scaled?: string | boolean;
  scale_level?: number | string;
  scale_reason?: string;
  notes?: string;
  /* ---- v3 incremental cache (optional) ---- */
  content_hash?: string;
  visual_hash?: string;
  analysis_status?: string;
  reused_from_cache?: string | boolean;
  analysis_version?: string;
  last_analyzed_at?: string;
};

export type ScaledContentAnalysis = {
  week_date: string;
  brand_name: string;
  content_cluster_id?: string;
  representative_ad_id?: string;
  representative_hook?: string;
  service_or_product?: string;
  price_detected?: string;
  offer_detected?: string;
  content_format?: string;
  content_angle?: string;
  proof_point?: string;
  number_of_similar_ads?: number | string;
  longest_days_active?: number | string;
  average_days_active?: number | string;
  scale_level?: number | string;
  why_it_is_scaling?: string;
  competitor_strategy_interpretation?: string;
  seryn_should_copy_adapt_counter_avoid?: string;
  seryn_reframe?: string;
};

export type WeeklyStrategyChange = {
  week_date: string;
  brand_name: string;
  active_ads_change?: number | string;
  new_ads_count?: number | string;
  stopped_ads_count?: number | string;
  new_services_detected?: string;
  removed_services?: string;
  new_offers_detected?: string;
  removed_offers?: string;
  new_content_angles?: string;
  removed_content_angles?: string;
  scaled_content_new?: string;
  scaled_content_still_running?: string;
  strategic_change_type?: string;
  change_summary?: string;
  seryn_implication?: string;
};

export type SerynContentRecommendation = {
  week_date: string;
  recommendation_type?: string;
  market_signal?: string;
  competitor_evidence?: string;
  seryn_content_niche?: string;
  suggested_content_format?: string;
  suggested_hook?: string;
  content_style?: string;
  main_message?: string;
  proof_to_use?: string;
  cta?: string;
  kpi?: string;
  priority?: "High" | "Medium" | "Low" | string;
  recommended_action?: string;
};

export type SpyDashboardData = {
  brandWeeklySnapshot: BrandWeeklySnapshot[];
  adLevelAnalysis: AdLevelAnalysis[];
  scaledContentAnalysis: ScaledContentAnalysis[];
  weeklyStrategyChange: WeeklyStrategyChange[];
  serynContentRecommendations: SerynContentRecommendation[];
  /* ---- nâng cấp v2 (đều optional → tương thích ngược, không crash khi thiếu) ---- */
  visualAnalysis?: VisualAnalysis[];
  brandVisualSummary?: BrandVisualSummary[];
  visualPatternAnalysis?: VisualPattern[];
  weeklyChangeInsights?: WeeklyChangeInsight[];
  crawlRuns?: CrawlRun[];
};

/** 5 bảng CSV gốc (dùng cho import thủ công / health-check). Các tab v2
 *  (visualAnalysis...) KHÔNG nằm trong đây để giữ logic 5-bảng nguyên vẹn. */
export type SpyTableName =
  | "brandWeeklySnapshot"
  | "adLevelAnalysis"
  | "scaledContentAnalysis"
  | "weeklyStrategyChange"
  | "serynContentRecommendations";

/* ============================================================
   CONTENT INTELLIGENCE — Top Hooks · Swipe File · Creative Briefs
   ============================================================ */

export type SerynAction = "copy" | "adapt" | "counter" | "avoid" | "monitor" | string;

export type TopHookItem = {
  id: string;
  source: "ad_level" | "scaled_content";
  brand_name: string;
  ad_id?: string;
  ad_snapshot_url?: string;
  hook_text: string;
  hook_type?: string;
  service_or_product?: string;
  content_format?: string;
  content_angle?: string;
  offer_detected?: string;
  proof_point?: string;
  days_active?: number | string;
  longest_days_active?: number | string;
  scale_level?: number | string;
  scale_reason?: string;
  seryn_action?: SerynAction;
  seryn_rewrite?: string;
};

export type SwipeFileItem = {
  id: string;
  savedAt: string;
  sourceType: "hook" | "scaled_content" | "recommendation";
  brand_name: string;
  hook: string;
  service_or_product?: string;
  content_format?: string;
  content_angle?: string;
  offer_detected?: string;
  proof_point?: string;
  scale_level?: number | string;
  reason_to_save?: string;
  action: SerynAction;
  seryn_reframe?: string;
  notes?: string;
  tags: string[];
};

export type CreativeBrief = {
  id: string;
  createdAt: string;
  sourceType: "swipe_file" | "recommendation" | "scaled_content" | "hook";
  title: string;
  brand_name?: string;
  objective: string;
  market_signal: string;
  competitor_evidence: string;
  seryn_angle: string;
  target_audience: string;
  core_message: string;
  hook_options: string[];
  content_format: string;
  script_outline: string[];
  visual_direction: string;
  proof_points: string[];
  cta: string;
  kpi: string;
  dos: string[];
  donts: string[];
  markdown: string;
};

/* ============================================================
   VISUAL INTELLIGENCE — phân tích creative ads (ảnh/video)
   5 lớp: Asset · OCR/Text overlay · Visual · Risk · Pattern
   ============================================================ */

export type CreativeType = "image" | "video" | "carousel" | "unknown";

export type VisualFormat =
  | "before_after"
  | "doctor_expert"
  | "ugc_selfie"
  | "clinic_room"
  | "product_packshot"
  | "testimonial_screenshot"
  | "offer_banner"
  | "luxury_beauty"
  | "educational"
  | "unknown";

export type VisualAngle =
  | "transformation"
  | "authority"
  | "social_proof"
  | "promotion"
  | "education"
  | "luxury"
  | "unknown";

export type CreativeRisk = "low" | "medium" | "high";

export type SerynVisualAction = "copy" | "adapt" | "counter" | "avoid" | "monitor";

/** Một bản ghi phân tích visual cho một ad. Mọi field đều có default an toàn. */
export type VisualAnalysis = {
  ad_id: string;
  brand: string;
  page_id?: string;
  last_seen_date?: string;
  /* --- Lớp 1: Creative Asset --- */
  creative_type: CreativeType;
  media_url?: string;
  thumbnail_url?: string;
  snapshot_url?: string;
  image_urls?: string[];
  video_preview_url?: string;
  has_media_asset?: boolean;
  /* --- Lớp 2: OCR / Text overlay --- */
  text_overlay_raw?: string;
  text_overlay_summary?: string;
  offer_from_visual?: string;
  claim_from_visual?: string;
  risk_terms_from_visual?: string[];
  /* --- Lớp 3: Visual Intelligence --- */
  visual_format: VisualFormat;
  visual_angle: VisualAngle;
  human_presence: boolean;
  doctor_presence: boolean;
  before_after_presence: boolean;
  text_overlay_presence: boolean;
  offer_visual_presence: boolean;
  clinical_score: number;        // 0–100
  beauty_luxury_score: number;   // 0–100
  ugc_score: number;             // 0–100
  trust_signal_score: number;    // 0–100
  offer_visibility_score: number;// 0–100
  scroll_stop_score: number;     // 0–100
  confidence_score: number;      // 0–1
  confidence_reason?: string;
  /* --- Lớp 4: Risk & Compliance (chỉ là signal cần review) --- */
  visual_risk_level: CreativeRisk;
  risk_reasons?: string[];
  claim_risk_score: number;          // 0–100
  before_after_risk: CreativeRisk;
  medical_claim_risk: CreativeRisk;
  promotion_claim_risk: CreativeRisk;
  /* --- Lớp 5: Strategy --- */
  visual_insight_summary: string;
  seryn_action: SerynVisualAction;
  /* --- Grouping (gom creative giống nhau) --- */
  creative_signature?: string;
  cluster_size?: number;
  /* --- v3 incremental cache (optional) --- */
  content_hash?: string;
  visual_hash?: string;
  analysis_status?: string;
  reused_from_cache?: string | boolean;
  analysis_version?: string;
  last_analyzed_at?: string;
  /* --- Manual review (frontend override) --- */
  reviewed?: boolean;
  review_note?: string;
};

/** Một lần crawl (provenance / data quality). Tab "Crawl Runs". */
export type CrawlRun = {
  crawl_run_id: string;
  started_at?: string;
  finished_at?: string;
  week_date?: string;
  provider?: string;
  country?: string;
  total_brands?: number | string;
  total_pages?: number | string;
  success_pages?: number | string;
  failed_pages?: number | string;
  total_ads_fetched?: number | string;
  new_ads_count?: number | string;
  changed_ads_count?: number | string;
  reused_ads_count?: number | string;
  analyzed_ads_count?: number | string;
  carried_forward_count?: number | string;
  status?: string;
  error_summary?: string;
};

/** Tổng hợp visual theo brand/tuần. */
export type BrandVisualSummary = {
  brand: string;
  week_date?: string;
  total_creatives: number | string;
  before_after_rate: number | string;   // 0–1
  doctor_rate: number | string;
  ugc_rate: number | string;
  offer_banner_rate: number | string;
  high_risk_rate: number | string;
  avg_clinical_score: number | string;
  avg_luxury_score: number | string;
  top_visual_formats?: string;           // "a|b|c"
  dominant_visual_angle?: string;
  notes?: string;
};

/** Cụm visual đang được scale (signal nếu >= 3 ad cùng pattern). */
export type VisualPattern = {
  id: string;
  week_date?: string;
  brand: string;
  visual_format: VisualFormat | string;
  visual_angle: VisualAngle | string;
  hook_type?: string;
  offer_type?: string;
  ad_count: number | string;
  is_signal: boolean | string;
  representative_ad_id?: string;
  summary: string;
  recommended_seryn_response: SerynVisualAction | string;
};

/* ============================================================
   WEEKLY CHANGES nâng cao — intelligence feed
   ============================================================ */

export type WeeklyChangeType =
  | "new_ad"
  | "stopped_ad"
  | "relaunched_ad"
  | "new_variant"
  | "new_campaign_theme"
  | "offer_changed"
  | "hook_changed"
  | "service_focus_shifted"
  | "visual_format_shifted"
  | "brand_scaled_up"
  | "brand_scaled_down"
  | "new_page_detected"
  | "page_inactive"
  | "same_concept_new_variants";

export type ChangeSeverity = "low" | "medium" | "high";

export type WeeklyChangeRecommendedAction = "copy" | "adapt" | "counter" | "monitor" | "ignore";

export type WeeklyChangeInsight = {
  id: string;
  brand: string;
  week_start: string;
  previous_week_start?: string;
  change_type: WeeklyChangeType | string;
  severity: ChangeSeverity | string;
  confidence_score: number | string; // 0–1
  summary: string;
  evidence: string;
  affected_ads?: string;             // "id|id" (Sheet-friendly)
  previous_value?: string;
  current_value?: string;
  recommended_action: WeeklyChangeRecommendedAction | string;
};

/* ============================================================
   COMPETITORS — quản lý watchlist trong dashboard
   ============================================================ */

export type CompetitorStatus = "ok" | "active" | "inactive" | "needs_page_id" | "crawl_error";

export type Competitor = {
  id: string;
  brand: string;
  page_name?: string;
  page_url?: string;
  page_id?: string;          // có thể nhiều id ngăn cách bằng "|"
  category?: string;
  active: boolean;
  notes?: string;
  last_crawled_at?: string;
  last_status?: CompetitorStatus | string;
  createdAt?: string;
  updatedAt?: string;
};
