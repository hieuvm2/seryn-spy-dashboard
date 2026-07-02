/* ============================================================
   SERYN Spy — Tab headers (single source of truth)
   ------------------------------------------------------------
   Exa Market Research & Competitor Discovery — CHỈ trẻ hóa da
   (service_category = skin_rejuvenation).

   NGUYÊN TẮC GỘP TAB (tối đa 2 tab mới):
     - Market Intelligence   ← source / trend / market size / opportunity / queue
     - Competitor Discovery  ← discovery run + website + fanpage + import status
   Run log gộp vào `Crawl Runs` (run_type). Opportunity gộp thêm vào
   `SERYN Content Recommendations`. KHÔNG tạo các tab rời rạc cũ.

   Dùng chung bởi main scripts / import / status / weekly-spy-sync.
   Khớp Apps Script (docs/google-apps-script-web-api.js).
   ============================================================ */

/** Phạm vi Exa cố định — chỉ trẻ hóa da. */
export const SERVICE_CATEGORY = "skin_rejuvenation";

/** run_type dùng chung trong tab `Crawl Runs`. */
export const RUN_TYPE = {
  weeklySpy: "weekly_spy",
  exaMarket: "exa_skin_rejuvenation_market",
  exaDiscovery: "exa_skin_rejuvenation_competitor_discovery",
  claudeReview: "claude_manual_review",
  hookIntel: "hook_intelligence",
};

/** intelligence_type trong tab `Market Intelligence`. */
export const INTELLIGENCE_TYPE = {
  source: "source",
  trend: "trend_signal",
  marketSize: "market_size_estimate",
  opportunity: "opportunity_brief",
  queue: "research_queue",
};

export const TAB = {
  // 2 tab MỚI (Exa) + 1 tab Hook Intelligence (hook pattern clustering)
  marketIntelligence: "Market Intelligence",
  discovery: "Competitor Discovery",
  hookIntelligence: "Hook Intelligence",
  // tab existing được mở rộng / ghi chung
  competitors: "Competitors",
  crawlRuns: "Crawl Runs",
  contentRecs: "SERYN Content Recommendations",
  adLevel: "Ad Level Analysis",
  snapshot: "Brand Weekly Snapshot",
  changeInsights: "Weekly Change Insights",
  // Weekly Intelligence (team report) — đầu ra riêng, không đụng pipeline trên
  weeklySummary: "Weekly_Summary",
  actionPlan: "Action_Plan",
  swipeSuggestions: "Swipe_File_Suggestions",
  // Historical reports (spy ads) — lưu theo kỳ, KHÔNG ghi đè kỳ cũ.
  weeklyReports: "Weekly Reports",
  monthlyReports: "Monthly Reports",
  // Own Brand Pages — page của CHÍNH SERYN (own brand), crawl chung pipeline.
  ownBrandPages: "Own Brand Pages",
};

export const HEADERS = {
  /* ---- Tab MỚI 1: Market Intelligence (gộp source/trend/size/opportunity/queue) ---- */
  marketIntelligence: [
    "intelligence_id", "run_id", "week_date", "run_type", "geo", "service_category",
    "topic", "intelligence_type", "source_url", "source_domain", "source_title", "source_type",
    "summary", "evidence",
    "detected_services", "detected_offers", "detected_prices", "detected_claims",
    "detected_customer_problems", "detected_trend_keywords", "detected_locations",
    "detected_target_audience", "detected_growth_claims", "detected_market_numbers",
    "trend_direction", "trend_strength_score",
    "market_size_tam_low", "market_size_tam_mid", "market_size_tam_high",
    "market_size_sam_low", "market_size_sam_mid", "market_size_sam_high",
    "market_size_som_low", "market_size_som_mid", "market_size_som_high",
    "market_size_method", "assumptions", "missing_data",
    "recommended_seryn_action", "suggested_content_angle", "suggested_offer_angle", "suggested_hook",
    "priority", "relevance_score", "credibility_score", "confidence_score",
    "content_hash", "reused_from_cache", "changed_since_last_check",
    "status", "created_at", "updated_at",
  ],

  /* ---- Tab MỚI 2: Competitor Discovery (gộp run/website/fanpage/import) ---- */
  discovery: [
    "discovery_id", "run_id", "week_date", "run_type", "geo", "service_category",
    "brand_name", "normalized_brand_name", "business_type", "website_url", "website_domain",
    "facebook_url", "facebook_page_id", "facebook_page_name", "instagram_url", "tiktok_url",
    "phone", "address", "location", "detected_services", "detected_offers", "detected_prices",
    "source_urls", "source_titles", "source_types", "evidence_summary",
    "competitor_relevance_score", "service_match_score", "geo_match_score",
    "source_credibility_score", "fanpage_confidence_score", "website_confidence_score",
    "overall_confidence_score", "duplicate_of", "resolution_status",
    "status", "ready_for_spy", "import_status", "imported_at", "reason",
    "created_at", "updated_at", "reviewed_at", "reviewed_by", "notes",
  ],

  /* ---- Tab existing: Crawl Runs (SUPERSET — weekly + exa dùng chung header) ----
     Giữ cột cũ của weekly-spy để không vỡ alignment / dashboard; thêm cột unified. */
  crawlRuns: [
    "crawl_run_id", "run_id", "run_type", "started_at", "finished_at", "week_date",
    "provider", "country", "geo", "service_category",
    "total_brands", "total_pages", "success_pages", "failed_pages", "total_ads_fetched",
    "new_ads_count", "changed_ads_count", "reused_ads_count", "analyzed_ads_count", "carried_forward_count",
    "queries_count", "sources_count", "candidates_found",
    "new_items_count", "changed_items_count", "reused_items_count", "failed_items_count",
    "status", "error_summary", "cost_guard_status",
  ],

  /* ---- Tab MỚI: Hook Intelligence (cụm hook pattern trẻ hóa da) ---- */
  hookIntelligence: [
    "hook_cluster_id", "week_date", "service_category", "cluster_name", "hook_pattern",
    "hook_category", "hook_subcategory", "hook_formula", "hook_angle",
    "pain_point", "desired_outcome", "offer_linked", "proof_type",
    "ads_count", "brands_using", "example_ads", "example_hooks", "avg_active_days",
    "top_offer_linked", "top_proof_type", "top_ad_format", "top_inferred_objective",
    "scale_signal", "confidence_score", "risk_score", "hook_strength_score",
    "insight", "recommended_seryn_action", "needs_claude_hook_review", "created_at",
  ],

  /* ---- Tab existing: SERYN Content Recommendations (SUPERSET — weekly + opportunity + hook content) ---- */
  contentRecs: [
    "week_date", "source", "service_category", "recommendation_type",
    "market_signal", "competitor_evidence", "seryn_content_niche", "insight",
    "suggested_content_format", "suggested_hook", "suggested_content_angle", "suggested_offer_angle",
    "content_style", "main_message", "proof_to_use", "cta", "kpi",
    "priority", "confidence_score", "source_urls",
    // ---- hook-based ad content generator ----
    "recommendation_id", "source_hook_cluster_id", "source_brands", "hook_pattern",
    "competitor_signal", "recommended_seryn_action", "content_angle", "target_audience",
    "pain_point", "desired_outcome", "proof_needed", "offer_suggestion",
    "risk_note", "claim_risk_level", "claim_safe_version", "avoid_phrases",
    "ad_copy_short", "ad_copy_medium", "ad_copy_long",
    "headline_options", "primary_text_options", "cta_options",
    "visual_direction", "video_opening_3s", "messenger_script_angle", "landing_page_angle",
    "needs_claude_hook_review",
  ],

  /* ---- tab Competitors (giữ nguyên — backward compatible) ---- */
  competitors: [
    "brand_name", "page_ids", "page_urls", "active", "notes",
    "category", "last_crawled_at", "last_status", "id",
    "website_url", "service_focus", "geo", "source", "discovery_id", "status",
    "created_at", "updated_at",
  ],

  /* ---- Weekly Intelligence (team report) ---- */
  weeklySummary: [
    "week_start", "week_end", "generated_at", "total_brands_tracked", "total_pages_tracked",
    "total_ads_active", "total_new_ads", "total_updated_ads", "total_crawl_failed_pages",
    "top_brands_by_active_ads", "top_brands_by_new_ads", "top_hooks", "top_offers",
    "top_service_types", "top_creative_formats", "scaled_ads_count", "new_competitors_count",
    "data_quality_score", "executive_summary",
  ],
  actionPlan: [
    "action_id", "week_start", "priority", "insight_type", "insight", "evidence",
    "suggested_action", "related_brand", "related_ad_ids", "owner", "status",
    "created_at", "updated_at",
  ],
  swipeSuggestions: [
    "swipe_id", "week_start", "ad_id", "brand_name", "ad_url", "media_url", "thumbnail_url",
    "hook", "offer", "angle", "format", "why_save", "how_to_adapt", "status", "saved_at",
  ],

  /* ---- Historical Reports (Weekly Reports + Monthly Reports DÙNG CHUNG header) ----
     Lưu theo kỳ, KHÔNG ghi đè kỳ cũ (upsert theo report_id). Field list dùng
     dấu `|` (parse an toàn ở dashboard). KHÔNG bịa spend/CPA/ROAS. */
  spyReports: [
    "report_id", "report_type", "period_start", "period_end", "generated_at", "timezone",
    "title", "executive_summary",
    "total_brands_tracked", "total_active_ads", "total_new_ads", "total_stopped_ads",
    "total_pages_tracked", "crawl_success_rate",
    "top_movers", "top_new_ads_brands", "top_stopped_ads_brands",
    "top_services", "top_offers", "top_content_angles", "top_ad_formats", "top_objectives",
    "key_competitor_moves", "notable_content_patterns", "notable_visual_patterns", "risk_warnings",
    "seryn_implications", "recommended_actions",
    "source_week_dates", "source_report_ids",
    "data_quality_note", "created_by",
  ],
};

// `Weekly Reports` và `Monthly Reports` chia sẻ cùng schema (SpyReport).
// `seryn_benchmark` = 1 cột text (block so sánh SERYN vs đối thủ), thêm ở cuối
// để tương thích ngược (các report cũ thiếu cột này -> "").
HEADERS.spyReports = [...HEADERS.spyReports, "seryn_benchmark"];
HEADERS.weeklyReports = HEADERS.spyReports;
HEADERS.monthlyReports = HEADERS.spyReports;

/* ---- Own Brand Pages (page của SERYN) ---- */
HEADERS.ownBrandPages = [
  "brand_name", "page_name", "page_id", "page_url", "platform", "market",
  "service_focus", "is_active", "crawl_enabled", "notes", "created_at", "updated_at",
];

/* ============================================================
   Weekly-spy pipeline tabs (weekly-spy-sync.mjs + hook-intelligence).
   ĐỔI CỘT Ở ĐÂY = đổi schema tab trên Sheet (reconcile/migrate tự chạy
   với tab append; tab ghi đè thì ghi lại theo header mới).
   ============================================================ */
HEADERS.adLevel = "week_date,brand_name,page_id,page_name,ad_id,ad_snapshot_url,status,start_date,days_active,media_type,platforms,headline,primary_text,hook_text,hook_type,service_or_product,price_detected,offer_detected,content_format,content_angle,proof_point,cta,funnel_stage,is_new_this_week,was_seen_previous_week,is_likely_scaled,scale_level,scale_reason,notes,content_hash,visual_hash,analysis_status,reused_from_cache,analysis_version,last_analyzed_at,ad_format,ad_format_confidence,has_video,has_image,has_carousel,media_asset_quality,inferred_objective,objective_confidence,objective_evidence,destination_type,destination_url,service_category,hook_raw_text,hook_normalized,hook_category,hook_subcategory,hook_formula,hook_emotional_trigger,hook_pain_point,hook_desired_outcome,hook_promise,hook_proof_type,hook_offer_linked,hook_target_audience,hook_funnel_stage,hook_angle,hook_strength_score,hook_clarity_score,hook_specificity_score,hook_urgency_score,hook_trust_score,hook_risk_score,hook_confidence_score,hook_evidence,brand_type".split(",");
HEADERS.snapshot = "week_date,brand_name,page_urls,page_ids,total_active_ads,total_ads_collected,num_pages_running,services_running,prices_detected,offers_detected,main_content_formats,main_hooks,main_angles,main_proof_points,main_ctas,scaled_content_count,new_ads_count,stopped_ads_count,content_strategy_summary,weekly_change_summary,seryn_opportunity,skin_rejuvenation_ads_count,skin_rejuvenation_image_ads,skin_rejuvenation_video_ads,skin_rejuvenation_carousel_ads,skin_rejuvenation_image_rate,skin_rejuvenation_video_rate,skin_rejuvenation_carousel_rate,skin_rejuvenation_messenger_ads,skin_rejuvenation_landing_page_conversion_ads,skin_rejuvenation_lead_form_ads,skin_rejuvenation_phone_call_ads,skin_rejuvenation_unknown_objective_ads,skin_rejuvenation_messenger_rate,skin_rejuvenation_landing_page_conversion_rate,skin_rejuvenation_lead_form_rate,skin_rejuvenation_phone_call_rate,skin_rejuvenation_unknown_objective_rate,skin_rejuvenation_top_format,skin_rejuvenation_top_inferred_objective,skin_rejuvenation_format_objective_pattern,skin_rejuvenation_confidence_score,brand_type".split(",");
HEADERS.scaled = "week_date,brand_name,content_cluster_id,representative_ad_id,representative_hook,service_or_product,price_detected,offer_detected,content_format,content_angle,proof_point,number_of_similar_ads,longest_days_active,average_days_active,scale_level,why_it_is_scaling,competitor_strategy_interpretation,seryn_should_copy_adapt_counter_avoid,seryn_reframe".split(",");
HEADERS.change = "week_date,brand_name,active_ads_change,new_ads_count,stopped_ads_count,new_services_detected,removed_services,new_offers_detected,removed_offers,new_content_angles,removed_content_angles,scaled_content_new,scaled_content_still_running,strategic_change_type,change_summary,seryn_implication".split(",");
HEADERS.visualAnalysis = "ad_id,brand,page_id,creative_type,media_url,thumbnail_url,snapshot_url,image_urls,video_preview_url,carousel_image_urls,has_media_asset,text_overlay_raw,text_overlay_summary,offer_from_visual,claim_from_visual,risk_terms_from_visual,visual_format,visual_angle,human_presence,doctor_presence,before_after_presence,text_overlay_presence,offer_visual_presence,clinical_score,beauty_luxury_score,ugc_score,trust_signal_score,offer_visibility_score,scroll_stop_score,confidence_score,confidence_reason,visual_risk_level,risk_reasons,claim_risk_score,before_after_risk,medical_claim_risk,promotion_claim_risk,visual_insight_summary,seryn_action,creative_signature,cluster_size,content_hash,visual_hash,analysis_status,reused_from_cache,analysis_version,last_analyzed_at,last_seen_date".split(",");
HEADERS.brandVisualSummary = "brand,week_date,total_creatives,before_after_rate,doctor_rate,ugc_rate,offer_banner_rate,high_risk_rate,avg_clinical_score,avg_luxury_score,top_visual_formats,dominant_visual_angle,notes".split(",");
HEADERS.visualPattern = "id,week_date,brand,visual_format,visual_angle,hook_type,offer_type,ad_count,is_signal,representative_ad_id,summary,recommended_seryn_response".split(",");
HEADERS.changeInsight = "id,brand,week_start,previous_week_start,change_type,severity,confidence_score,summary,evidence,affected_ads,previous_value,current_value,recommended_action".split(",");
HEADERS.adAnalysisCache = "ad_id,brand,page_id,content_hash,visual_hash,analysis_version,analysis_provider,analysis_status,reused_from_cache,text_analysis_json,visual_analysis_json,first_seen_date,last_seen_date,last_analyzed_at".split(",");
HEADERS.rawAdsArchive = "crawl_run_id,week_date,brand,page_id,ad_id,content_hash,visual_hash,status,source_provider,source_country,first_seen_date,last_seen_date,raw_json".split(",");
HEADERS.pageCrawlLogs = "crawl_run_id,week_date,brand,page_id,status,ads_fetched,error_message,started_at,finished_at".split(",");
HEADERS.historicalSnapshots = "week_date,brand,active_ads_count,new_ads_count,stopped_ads_count,changed_ads_count,reused_ads_count,top_service,top_hook,top_offer,top_visual_format,crawl_status,snapshot_json".split(",");
HEADERS.patternCache = "pattern_id,pattern_hash,brand,service_type,hook_type,offer_type,visual_format,visual_angle,first_seen_date,last_seen_date,ads_count,active_days_avg,example_ads,scale_signal".split(",");
