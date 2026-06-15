/* ============================================================
   SERYN Spy — Exa tab headers (single source of truth)
   ------------------------------------------------------------
   Tên tab + thứ tự cột cho Market Research & Competitor Discovery.
   Dùng chung bởi main scripts / import / status. Khớp Apps Script.
   ============================================================ */

export const TAB = {
  // Market Research
  researchRuns: "Market Research Runs",
  marketSources: "Market Sources",
  trendSignals: "Trend Signals",
  competitorMarketActivity: "Competitor Market Activity",
  marketSizeEstimates: "Market Size Estimates",
  opportunityBriefs: "SERYN Opportunity Briefs",
  researchQueue: "Market Research Queue",
  // Competitor Discovery
  discoveryRuns: "Competitor Discovery Runs",
  discovery: "Competitor Discovery",
  websiteIntel: "Competitor Website Intelligence",
  fanpageCandidates: "Competitor Fanpage Candidates",
  importLog: "Competitor Import Log",
  // existing
  competitors: "Competitors",
  // Weekly Intelligence (team report) — đầu ra MỚI, không đụng tab pipeline cũ
  weeklySummary: "Weekly_Summary",
  actionPlan: "Action_Plan",
  swipeSuggestions: "Swipe_File_Suggestions",
};

export const HEADERS = {
  researchRuns: [
    "research_run_id", "started_at", "finished_at", "week_date", "market", "geo",
    "service_category", "search_type", "max_queries", "max_results", "deep_search",
    "status", "sources_count", "trend_signals_count", "opportunity_briefs_count",
    "market_size_confidence", "cost_guard_status", "error_summary",
  ],
  marketSources: [
    "research_run_id", "week_date", "geo", "market", "service_category", "source_url",
    "source_domain", "title", "source_type", "published_date", "summary", "highlights",
    "key_facts", "detected_services", "detected_offers", "detected_prices",
    "detected_claims", "detected_customer_problems", "detected_trend_keywords",
    "detected_locations", "detected_target_audience", "detected_growth_claims",
    "detected_market_numbers", "relevance_score", "credibility_score", "content_hash",
    "reused_from_cache", "changed_since_last_check", "first_seen_date", "last_seen_date",
  ],
  trendSignals: [
    "week_date", "geo", "topic", "service_category", "trend_signal", "signal_type",
    "source", "evidence", "direction", "strength_score", "confidence_score", "first_seen_date",
  ],
  competitorMarketActivity: [
    "week_date", "brand", "geo", "service_category", "active_ads_count", "new_ads_count",
    "landing_pages_count", "offer_count", "top_offer", "top_service", "top_hook",
    "web_mentions_count", "detected_landing_pages", "digital_share_of_voice_score",
    "aggressiveness_score", "confidence_score",
  ],
  marketSizeEstimates: [
    "week_date", "geo", "market", "service_category", "tam_low", "tam_mid", "tam_high",
    "sam_low", "sam_mid", "sam_high", "som_low", "som_mid", "som_high", "currency",
    "method", "assumptions", "evidence_sources", "confidence_score", "missing_data", "analyst_notes",
  ],
  opportunityBriefs: [
    "week_date", "geo", "service_category", "opportunity_type", "insight",
    "recommended_seryn_action", "suggested_content_angle", "suggested_offer_angle",
    "suggested_hook", "priority", "confidence_score", "source_urls",
  ],
  researchQueue: [
    "queue_id", "research_run_id", "week_date", "geo", "service_category", "topic",
    "source_urls", "reason_for_review", "priority", "status", "created_at", "reviewed_at", "reviewed_by",
  ],
  discoveryRuns: [
    "discovery_run_id", "started_at", "finished_at", "week_date", "geo", "market",
    "service_category", "queries_count", "sources_count", "candidates_found",
    "candidates_new", "candidates_duplicates", "candidates_needs_review",
    "candidates_ready_for_spy", "candidates_imported", "status", "error_summary", "cost_guard_status",
  ],
  discovery: [
    "discovery_id", "discovery_run_id", "week_date", "geo", "market", "service_category",
    "brand_name", "normalized_brand_name", "business_type", "website_url", "website_domain",
    "facebook_url", "facebook_page_id", "facebook_page_name", "instagram_url", "tiktok_url",
    "phone", "address", "location", "detected_services", "detected_offers", "detected_prices",
    "source_urls", "source_titles", "source_types", "evidence_summary",
    "competitor_relevance_score", "service_match_score", "geo_match_score",
    "source_credibility_score", "fanpage_confidence_score", "website_confidence_score",
    "overall_confidence_score", "duplicate_of", "status", "ready_for_spy", "reason",
    "created_at", "updated_at", "reviewed_at", "reviewed_by", "notes",
  ],
  websiteIntel: [
    "discovery_run_id", "week_date", "brand_name", "website_url", "website_domain", "title",
    "summary", "detected_services", "detected_offers", "detected_prices", "detected_claims",
    "detected_locations", "detected_contact_info", "detected_social_links", "facebook_links",
    "instagram_links", "tiktok_links", "credibility_score", "relevance_score", "content_hash",
    "first_seen_date", "last_seen_date",
  ],
  fanpageCandidates: [
    "discovery_run_id", "week_date", "brand_name", "facebook_url", "facebook_page_id",
    "facebook_page_name", "source_url", "source_type", "evidence", "confidence_score",
    "resolution_status", "notes",
  ],
  importLog: [
    "import_id", "imported_at", "discovery_id", "brand_name", "website_url", "facebook_url",
    "facebook_page_id", "target_tab", "action", "status", "error_message",
  ],
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
  // tab Competitors mở rộng (backward compatible — pipeline đọc page_ids/page_urls)
  competitors: [
    "brand_name", "page_ids", "page_urls", "active", "notes",
    "category", "last_crawled_at", "last_status", "id",
    "website_url", "service_focus", "geo", "source", "discovery_id", "status",
    "created_at", "updated_at",
  ],
};
