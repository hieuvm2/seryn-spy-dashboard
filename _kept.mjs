import "dotenv/config";
import { getSheetsClient, readTab } from "./scripts/lib/sheets.mjs";
import { TAB } from "./scripts/lib/schemas.mjs";
import { writeFileSync } from "node:fs";
const { sheets } = await getSheetsClient();
const ads = await readTab(sheets, TAB.adLevel);
const visual = await readTab(sheets, "Visual Analysis").catch(()=>[]);
const thumbById = {}; for(const v of visual){ if(v.ad_id) thumbById[v.ad_id] = v.thumbnail_url||v.media_url||(v.image_urls?String(v.image_urls).split("|")[0]:"")||v.video_preview_url||""; }
const kept = ads.filter(a => String(a.service_category)==="skin_rejuvenation");
// gộp theo thumbnail (ad cùng ảnh review 1 lần)
const seen=new Set(); const uniq=[];
for(const a of kept){
  const thumb = a.thumbnail_url||a.media_url||thumbById[a.ad_id]||"";
  const key = thumb || ("noimg-"+a.ad_id);
  if(seen.has(key)) continue; seen.add(key);
  uniq.push({ ad_id:a.ad_id, brand:a.brand_name, hook:String(a.hook_text||a.headline||"").slice(0,120), text:String(a.primary_text||"").slice(0,200), service:a.service_or_product, thumb });
}
const withThumb = uniq.filter(u=>/^https?:/.test(u.thumb));
writeFileSync("_kept_ads.json", JSON.stringify(uniq));
console.log("kept ads:", kept.length, "· unique creatives:", uniq.length, "· có ảnh:", withThumb.length);
const byBrand={}; for(const u of uniq) byBrand[u.brand]=(byBrand[u.brand]||0)+1;
console.log(Object.entries(byBrand).sort((a,b)=>b[1]-a[1]).map(([b,n])=>`${b}:${n}`).join(" · "));
