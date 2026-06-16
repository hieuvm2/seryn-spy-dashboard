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
  | "weekly-changes"
  | "seryn-recommendations"
  | "weekly-intelligence"
  | "competitor-setup"
  | "market-research"
  | "competitor-discovery"
  | "ad-format-funnel"
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
  /* ---- skin rejuvenation format/funnel summary (gộp từ Ad Format Funnel) ---- */
  skin_rejuvenation_ads_count?: number | string;
  skin_rejuvenation_image_ads?: number | string;
  skin_rejuvenation_video_ads?: number | string;
  skin_rejuvenation_carousel_ads?: number | string;
  skin_rejuvenation_image_rate?: number | string;
  skin_rejuvenation_video_rate?: number | string;
  skin_rejuvenation_carousel_rate?: number | string;
  skin_rejuvenation_messenger_ads?: number | string;
  skin_rejuvenation_landing_page_conversion_ads?: number | string;
  skin_rejuvenation_lead_form_ads?: number | string;
  skin_rejuvenation_phone_call_ads?: number | string;
  skin_rejuvenation_unknown_objective_ads?: number | string;
  skin_rejuvenation_messenger_rate?: number | string;
  skin_rejuvenation_landing_page_conversion_rate?: number | string;
  skin_rejuvenation_lead_form_rate?: number | string;
  skin_rejuvenation_phone_call_rate?: number | string;
  skin_rejuvenation_unknown_objective_rate?: number | string;
  skin_rejuvenation_top_format?: string;
  skin_rejuvenation_top_inferred_objective?: string;
  skin_rejuvenation_format_objective_pattern?: string;
  skin_rejuvenation_confidence_score?: number | string;
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
  /* ---- ad format & funnel (skin rejuvenation) ---- */
  ad_format?: "image" | "video" | "carousel" | "collection" | "text_only" | "unknown" | string;
  ad_format_confidence?: number | string;
  has_video?: string | boolean;
  has_image?: string | boolean;
  has_carousel?: string | boolean;
  media_asset_quality?: string;
  inferred_objective?:
    | "messenger" | "landing_page_conversion" | "lead_form" | "phone_call"
    | "website_traffic" | "engagement" | "branding" | "unknown" | string;
  objective_confidence?: number | string;
  objective_evidence?: string;
  destination_type?: string;
  destination_url?: string;
  service_category?: string;
  /* ---- deep hook analysis ---- */
  hook_raw_text?: string;
  hook_normalized?: string;
  hook_category?: string;
  hook_subcategory?: string;
  hook_formula?: string;
  hook_emotional_trigger?: string;
  hook_pain_point?: string;
  hook_desired_outcome?: string;
  hook_promise?: string;
  hook_proof_type?: string;
  hook_offer_linked?: string | boolean;
  hook_target_audience?: string;
  hook_funnel_stage?: string;
  hook_angle?: string;
  hook_strength_score?: number | string;
  hook_clarity_score?: number | string;
  hook_specificity_score?: number | string;
  hook_urgency_score?: number | string;
  hook_trust_score?: number | string;
  hook_risk_score?: number | string;
  hook_confidence_score?: number | string;
  hook_evidence?: string;
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
  source?: string;            // weekly_spy | exa_skin_rejuvenation_market
  service_category?: string;
  recommendation_type?: string;
  market_signal?: string;
  competitor_evidence?: string;
  seryn_content_niche?: string;
  insight?: string;
  suggested_content_format?: string;
  suggested_hook?: string;
  suggested_content_angle?: string;
  suggested_offer_angle?: string;
  content_style?: string;
  main_message?: string;
  proof_to_use?: string;
  cta?: string;
  kpi?: string;
  priority?: "High" | "Medium" | "Low" | string;
  confidence_score?: number | string;
  source_urls?: string;
  recommended_action?: string;
  /* ---- hook-based ad content generator ---- */
  recommendation_id?: string;
  source_hook_cluster_id?: string;
  source_brands?: string;
  hook_pattern?: string;
  competitor_signal?: string;
  recommended_seryn_action?: string;
  content_angle?: string;
  target_audience?: string;
  pain_point?: string;
  desired_outcome?: string;
  proof_needed?: string;
  offer_suggestion?: string;
  risk_note?: string;
  claim_risk_level?: string;
  claim_safe_version?: string;
  avoid_phrases?: string;
  ad_copy_short?: string;
  ad_copy_medium?: string;
  ad_copy_long?: string;
  headline_options?: string;
  primary_text_options?: string;
  cta_options?: string;
  visual_direction?: string;
  video_opening_3s?: string;
  messenger_script_angle?: string;
  landing_page_angle?: string;
  needs_claude_hook_review?: string | boolean;
};

/** 1 dòng tab "Hook Intelligence" — cụm hook pattern trẻ hóa da. */
export type HookCluster = {
  hook_cluster_id: string;
  week_date?: string;
  service_category?: string;
  cluster_name?: string;
  hook_pattern?: string;
  hook_category?: string;
  hook_subcategory?: string;
  hook_formula?: string;
  hook_angle?: string;
  pain_point?: string;
  desired_outcome?: string;
  offer_linked?: string;
  proof_type?: string;
  ads_count?: number | string;
  brands_using?: string;
  example_ads?: string;
  example_hooks?: string;
  avg_active_days?: number | string;
  top_offer_linked?: string;
  top_proof_type?: string;
  top_ad_format?: string;
  top_inferred_objective?: string;
  scale_signal?: string;
  confidence_score?: number | string;
  risk_score?: number | string;
  hook_strength_score?: number | string;
  insight?: string;
  recommended_seryn_action?: string;
  needs_claude_hook_review?: string | boolean;
  created_at?: string;
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
  /* ---- Exa Market Research & Competitor Discovery (manual/on-demand, chỉ trẻ hóa da) ----
     GỘP TAB: tất cả market research vào `marketIntelligence`; discovery vào
     `competitorDiscovery`. Run log gộp vào `crawlRuns` (run_type). */
  marketIntelligence?: MarketIntelligenceItem[];
  competitorDiscovery?: CompetitorDiscoveryCandidate[];
  hookIntelligence?: HookCluster[];
  /* ---- Weekly Intelligence (team report) ---- */
  weeklySummary?: WeeklySummary[];
  actionPlan?: ActionPlanItem[];
  swipeSuggestions?: SwipeSuggestion[];
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

/** Một lần chạy (weekly spy / Exa / import). Tab "Crawl Runs" (header SUPERSET). */
export type CrawlRun = {
  crawl_run_id: string;
  run_id?: string;
  run_type?: string;  // weekly_spy | exa_skin_rejuvenation_market | exa_skin_rejuvenation_competitor_discovery | claude_manual_review
  started_at?: string;
  finished_at?: string;
  week_date?: string;
  provider?: string;
  country?: string;
  geo?: string;
  service_category?: string;
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
  queries_count?: number | string;
  sources_count?: number | string;
  candidates_found?: number | string;
  new_items_count?: number | string;
  changed_items_count?: number | string;
  reused_items_count?: number | string;
  failed_items_count?: number | string;
  status?: string;
  error_summary?: string;
  cost_guard_status?: string;
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

/* ============================================================
   EXA MARKET RESEARCH & COMPETITOR DISCOVERY (manual/on-demand)
   Chỉ trẻ hóa da. Gộp 2 tab: Market Intelligence + Competitor Discovery.
   Mọi field là string (Sheets trả string) — type lỏng, an toàn khi thiếu.
   ============================================================ */
type Str = string | undefined;
type NumStr = number | string | undefined;

export type IntelligenceType =
  | "source" | "trend_signal" | "market_size_estimate" | "opportunity_brief" | "research_queue";

/** 1 dòng tab "Market Intelligence" — gộp source/trend/market size/opportunity/queue. */
export type MarketIntelligenceItem = {
  intelligence_id?: Str; run_id?: Str; week_date?: Str; run_type?: Str; geo?: Str;
  service_category?: Str; topic?: Str; intelligence_type?: IntelligenceType | Str;
  source_url?: Str; source_domain?: Str; source_title?: Str; source_type?: Str;
  summary?: Str; evidence?: Str;
  detected_services?: Str; detected_offers?: Str; detected_prices?: Str; detected_claims?: Str;
  detected_customer_problems?: Str; detected_trend_keywords?: Str; detected_locations?: Str;
  detected_target_audience?: Str; detected_growth_claims?: Str; detected_market_numbers?: Str;
  trend_direction?: Str; trend_strength_score?: NumStr;
  market_size_tam_low?: NumStr; market_size_tam_mid?: NumStr; market_size_tam_high?: NumStr;
  market_size_sam_low?: NumStr; market_size_sam_mid?: NumStr; market_size_sam_high?: NumStr;
  market_size_som_low?: NumStr; market_size_som_mid?: NumStr; market_size_som_high?: NumStr;
  market_size_method?: Str; assumptions?: Str; missing_data?: Str;
  recommended_seryn_action?: Str; suggested_content_angle?: Str; suggested_offer_angle?: Str; suggested_hook?: Str;
  priority?: Str; relevance_score?: NumStr; credibility_score?: NumStr; confidence_score?: NumStr;
  content_hash?: Str; reused_from_cache?: Str; changed_since_last_check?: Str;
  status?: Str; created_at?: Str; updated_at?: Str;
};

/** 1 dòng tab "Competitor Discovery" — gộp run + website + fanpage + import status. */
export type CompetitorDiscoveryCandidate = {
  discovery_id: string; run_id?: Str; week_date?: Str; run_type?: Str; geo?: Str;
  service_category?: Str; brand_name?: Str; normalized_brand_name?: Str; business_type?: Str;
  website_url?: Str; website_domain?: Str; facebook_url?: Str; facebook_page_id?: Str;
  facebook_page_name?: Str; instagram_url?: Str; tiktok_url?: Str; phone?: Str; address?: Str;
  location?: Str; detected_services?: Str; detected_offers?: Str; detected_prices?: Str;
  source_urls?: Str; source_titles?: Str; source_types?: Str; evidence_summary?: Str;
  competitor_relevance_score?: NumStr; service_match_score?: NumStr; geo_match_score?: NumStr;
  source_credibility_score?: NumStr; fanpage_confidence_score?: NumStr; website_confidence_score?: NumStr;
  overall_confidence_score?: NumStr; duplicate_of?: Str; resolution_status?: Str;
  status?: Str; ready_for_spy?: Str; import_status?: Str; imported_at?: Str;
  reason?: Str; created_at?: Str; updated_at?: Str; reviewed_at?: Str; reviewed_by?: Str; notes?: Str;
};

/* ============================================================
   WEEKLY INTELLIGENCE (team report) — Weekly_Summary / Action_Plan / Swipe
   List-fields lưu JSON string trên Sheet; dùng parseTopList() để đọc an toàn.
   ============================================================ */

/** Item dạng {key,count} cho top hooks/offers/brands (lưu JSON string). */
export type TopCountItem = { key: string; count: number };

export type WeeklySummary = {
  week_start?: string;
  week_end?: string;
  generated_at?: string;
  total_brands_tracked?: number | string;
  total_pages_tracked?: number | string;
  total_ads_active?: number | string;
  total_new_ads?: number | string;
  total_updated_ads?: number | string;
  total_crawl_failed_pages?: number | string;
  top_brands_by_active_ads?: string;   // JSON string của TopCountItem[]
  top_brands_by_new_ads?: string;
  top_hooks?: string;
  top_offers?: string;
  top_service_types?: string;
  top_creative_formats?: string;
  scaled_ads_count?: number | string;
  new_competitors_count?: number | string;
  data_quality_score?: number | string;
  executive_summary?: string;
};

export type ActionPriority = "high" | "medium" | "low" | string;
export type ActionStatus = "new" | "reviewed" | "in_progress" | "done" | "ignored" | string;

export type ActionPlanItem = {
  action_id: string;
  week_start?: string;
  priority?: ActionPriority;
  insight_type?: string;
  insight?: string;
  evidence?: string;
  suggested_action?: string;
  related_brand?: string;
  related_ad_ids?: string;
  owner?: string;
  status?: ActionStatus;
  created_at?: string;
  updated_at?: string;
};

export type SwipeSuggestionStatus = "new" | "reviewed" | "used" | "ignored" | string;

export type SwipeSuggestion = {
  swipe_id: string;
  week_start?: string;
  ad_id?: string;
  brand_name?: string;
  ad_url?: string;
  media_url?: string;
  thumbnail_url?: string;
  hook?: string;
  offer?: string;
  angle?: string;
  format?: string;
  why_save?: string;
  how_to_adapt?: string;
  status?: SwipeSuggestionStatus;
  saved_at?: string;
};

/** Báo cáo data-quality dẫn xuất từ WeeklySummary (frontend tính warning hiển thị). */
export type DataQualityReport = {
  score: number;
  failedPages: number;
  level: "good" | "warning" | "low";
};

/* Alias cho các bảng pipeline cũ theo schema yêu cầu (backward-compatible map):
   AdMaster   ≈ AdLevelAnalysis (tab "Ad Level Analysis")
   CrawlLog   ≈ CrawlRun        (tab "Crawl Runs" + "Page Crawl Logs") */
export type AdMaster = AdLevelAnalysis;
export type CrawlLog = CrawlRun;
