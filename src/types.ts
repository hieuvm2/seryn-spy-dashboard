/* ============================================================
   SERYN SPY ADS — weekly competitor intelligence schema
   5 tables matching the agent CSV outputs.
   ============================================================ */

export type ViewId =
  | "overview"
  | "brands"
  | "scaled-content"
  | "top-hooks"
  | "swipe-file"
  | "creative-briefs"
  | "weekly-changes"
  | "seryn-recommendations"
  | "data-import";

/** Nguồn dữ liệu đang hiển thị. */
export type DataSourceType = "demo" | "local-csv" | "local-folder" | "online-sheet" | "offline-cache";

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
};

export type SpyTableName = keyof SpyDashboardData;

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
