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
  // 2 tab MỚI duy nhất
  marketIntelligence: "Market Intelligence",
  discovery: "Competitor Discovery",
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

  /* ---- Tab existing: SERYN Content Recommendations (SUPERSET — weekly + opportunity) ---- */
  contentRecs: [
    "week_date", "source", "service_category", "recommendation_type",
    "market_signal", "competitor_evidence", "seryn_content_niche", "insight",
    "suggested_content_format", "suggested_hook", "suggested_content_angle", "suggested_offer_angle",
    "content_style", "main_message", "proof_to_use", "cta", "kpi",
    "priority", "confidence_score", "source_urls",
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
};
