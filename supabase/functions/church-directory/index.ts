import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const OFFICIAL_HOST = "https://local.churchofjesuschrist.org";
const ADMIN_DIRECTORY_ACTIONS = new Set([
  "sync-country-batch",
  "unit-index",
  "sync-unit-batch",
  "sync-pending-city-batch"
]);

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type"
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "content-type": "application/json" }
  });
}

async function requireSecretaryAdmin(req: Request) {
  const authorization = req.headers.get("authorization") || "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token) return jsonResponse({ error: "Authentication is required" }, 401);

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const userId = userData.user?.id;
  if (userError || !userId) return jsonResponse({ error: "Authentication is required" }, 401);

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role,is_active")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile || profile.is_active === false || profile.role !== "secretary_admin") {
    return jsonResponse({ error: "Secretary administrator access is required" }, 403);
  }

  return null;
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stripTags(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(href: string) {
  try {
    return new URL(href, OFFICIAL_HOST + "/").toString();
  } catch (_) {
    if (href.startsWith("http")) return href;
    if (!href.startsWith("/")) href = "/" + href;
    return OFFICIAL_HOST + href;
  }
}

async function fetchHtml(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "accept": "text/html,application/xhtml+xml",
        "accept-language": "es,en;q=0.8",
        "user-agent": "Mozilla/5.0 (compatible; EntrevistasObispado/1.0)"
      }
    });
    if (!res.ok) throw new Error("Official directory returned " + res.status);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url: string, timeoutMs=15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "accept": "application/xml,text/xml,text/plain,text/html,*/*",
        "accept-language": "es,en;q=0.8",
        "user-agent": "Mozilla/5.0 (compatible; EntrevistasObispado/1.0)"
      }
    });
    if (!res.ok) throw new Error("Official directory returned " + res.status);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g,"&")
    .replace(/&lt;/g,"<")
    .replace(/&gt;/g,">")
    .replace(/&quot;/g,'"')
    .replace(/&#39;/g,"'");
}

function sitemapLocations(xml: string) {
  const out:string[]=[];
  const re=/<loc>\s*([\s\S]*?)\s*<\/loc>/gi;
  let m;
  while ((m=re.exec(xml))) {
    const url=decodeXml(String(m[1]||"").trim());
    if (url) out.push(url);
  }
  return out;
}

async function discoverUnitUrls(countryCode:string) {
  const cc=countryCode.toLowerCase();
  const queue=[OFFICIAL_HOST+"/sitemap.xml"];
  const visited=new Set<string>();
  const unitUrls=new Set<string>();

  while (queue.length && visited.size<60 && unitUrls.size<5000) {
    const sitemapUrl=queue.shift()!;
    if (visited.has(sitemapUrl)) continue;
    visited.add(sitemapUrl);

    try {
      const xml=await fetchText(sitemapUrl,18000);
      for (const loc of sitemapLocations(xml)) {
        const normalized=loc.split("?")[0].replace(/\/$/,"");
        if (/\.xml(?:\.gz)?$/i.test(normalized)) {
          if (!visited.has(normalized) && queue.length<120) queue.push(normalized);
          continue;
        }

        try {
          const u=new URL(normalized);
          const path=u.pathname.toLowerCase();
          if (
            path.includes("/es/units/"+cc+"/") &&
            !path.includes("/events/")
          ) {
            unitUrls.add(u.toString());
          }
        } catch (_) {}
      }
    } catch (_) {}
  }

  const rows=[...unitUrls].map(officialUrl=>{
    let slug="";
    try {
      slug=new URL(officialUrl).pathname.split("/").filter(Boolean).pop() || "";
    } catch (_) {}
    return {
      official_url:officialUrl,
      country_code:countryCode.toUpperCase(),
      unit_slug:slug || null,
      sync_status:"pending",
      last_error:null,
      updated_at:new Date().toISOString()
    };
  });

  for (let i=0;i<rows.length;i+=500) {
    const chunk=rows.slice(i,i+500);
    if (!chunk.length) continue;
    const {error}=await admin.from("church_directory_unit_index").upsert(
      chunk,
      {onConflict:"official_url",ignoreDuplicates:true}
    );
    if (error) throw error;
  }

  return {
    countryCode:countryCode.toUpperCase(),
    discovered:rows.length,
    sitemapDocuments:visited.size
  };
}

async function refreshStoredUnitCount(countryCode:string, city:string) {
  const code=String(countryCode || "").toUpperCase();
  const cityName=String(city || "").trim();
  if (!code || !cityName) return 0;

  const {count,error}=await admin
    .from("church_units")
    .select("id",{count:"exact",head:true})
    .eq("country_code",code)
    .eq("city",cityName)
    .eq("is_active",true);

  if (error) throw error;

  const unitCount=Number(count || 0);
  const {error:placeError}=await admin
    .from("church_directory_places")
    .update({
      unit_count:unitCount,
      last_synced_at:new Date().toISOString(),
      updated_at:new Date().toISOString()
    })
    .eq("country_code",code)
    .eq("city_name",cityName);

  if (placeError) throw placeError;
  await markCityQueue(code,cityName,null,unitCount);
  return unitCount;
}

async function markCityQueue(countryCode:string, city:string, officialUrl:string|null, unitCount:number) {
  const code=String(countryCode||"").toUpperCase(), cityName=String(city||"").trim();
  if (!code || !cityName) return;
  const now=new Date().toISOString(), resolved=Number(unitCount||0)>0;
  const payload=resolved
    ? {country_code:code,city_name:cityName,official_url:officialUrl,status:"resolved",resolved_at:now,last_error:null,next_attempt_at:null,updated_at:now}
    : {country_code:code,city_name:cityName,official_url:officialUrl,status:"pending",last_attempt_at:now,next_attempt_at:new Date(Date.now()+604800000).toISOString(),updated_at:now};
  const {error}=await admin.from("church_directory_city_queue").upsert(payload,{onConflict:"country_code,city_name",ignoreDuplicates:false});
  if (error) throw error;
}

async function syncUnitIndexBatch(countryCode:string, limit:number) {
  const safeLimit=Math.max(1,Math.min(Number(limit||4),8));

  const {data:indexRows,error:indexError}=await admin
    .from("church_directory_unit_index")
    .select("official_url,country_code,unit_slug")
    .eq("country_code",countryCode.toUpperCase())
    .neq("sync_status","synced")
    .order("updated_at",{ascending:true})
    .limit(safeLimit);

  if (indexError) throw indexError;

  const results:any[]=[];

  for (const row of indexRows||[]) {
    const officialUrl=String(row.official_url||"");
    if (!officialUrl) continue;

    try {
      const html=await fetchHtml(officialUrl);
      const parsed=parseUnitPage(html);
      const place=parsed.place;

      if (!parsed.title || !place?.address) {
        throw new Error("Unit page did not include a usable title/address");
      }

      const country=String(place.countryCode||countryCode).toUpperCase() || countryCode.toUpperCase();
      const city=String(place.city||"").trim();
      const region=String(place.region||"").trim();

      let meetinghouse:any=null;

      if (city) {
        const existing=await admin
          .from("church_meetinghouses")
          .select("id,name,address,city,region,country_code,latitude,longitude,official_url")
          .eq("country_code",country)
          .eq("city",city)
          .eq("address",place.address)
          .maybeSingle();
        meetinghouse=existing.data || null;
      }

      if (!meetinghouse) {
        const mhName="Capilla "+(place.address.split(",")[0] || city || parsed.title);
        const saved=await admin
          .from("church_meetinghouses")
          .upsert({
            name:mhName,
            address:place.address,
            city:city || null,
            region:region || null,
            country_code:country,
            latitude:place.latitude,
            longitude:place.longitude,
            official_url:null,
            source:"official_unit_page",
            source_verified_at:new Date().toISOString(),
            is_active:true
          },{onConflict:"country_code,city,address",ignoreDuplicates:false})
          .select("id,name,address,city,region,country_code,latitude,longitude,official_url")
          .single();

        if (saved.error) throw saved.error;
        meetinghouse=saved.data;
      }

      const type=/\brama\b|\bbranch\b/i.test(parsed.title) ? "branch" : "ward";

      const savedUnit=await admin
        .from("church_units")
        .upsert({
          unit_name:parsed.title,
          unit_type:type,
          meetinghouse_id:meetinghouse?.id || null,
          meetinghouse_name:meetinghouse?.name || null,
          address:place.address,
          city:city || null,
          region:region || null,
          country_code:country,
          latitude:place.latitude,
          longitude:place.longitude,
          official_url:officialUrl,
          sunday_service:parsed.service || null,
          is_active:true,
          source_verified_at:new Date().toISOString()
        },{onConflict:"official_url",ignoreDuplicates:false})
        .select("id,unit_name,city,region,country_code,meetinghouse_id,official_url")
        .single();

      if (savedUnit.error) throw savedUnit.error;

      await refreshStoredUnitCount(country,city);

      await admin
        .from("church_directory_unit_index")
        .update({
          sync_status:"synced",
          last_error:null,
          synced_at:new Date().toISOString(),
          updated_at:new Date().toISOString()
        })
        .eq("official_url",officialUrl);

      results.push({
        ok:true,
        unitName:savedUnit.data?.unit_name || parsed.title,
        city:city || null,
        url:officialUrl
      });
    } catch (error) {
      const message=error instanceof Error?error.message:"Unit sync failed";
      await admin
        .from("church_directory_unit_index")
        .update({
          sync_status:"error",
          last_error:message.slice(0,500),
          updated_at:new Date().toISOString()
        })
        .eq("official_url",officialUrl);

      results.push({ok:false,url:officialUrl,error:message});
    }
  }

  const {count:remaining}=await admin
    .from("church_directory_unit_index")
    .select("official_url",{count:"exact",head:true})
    .eq("country_code",countryCode.toUpperCase())
    .neq("sync_status","synced");

  return {
    countryCode:countryCode.toUpperCase(),
    processed:(indexRows||[]).length,
    remaining:Number(remaining||0),
    done:Number(remaining||0)===0,
    results
  };
}

function anchors(html: string) {
  const out: { href: string; text: string }[] = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    out.push({ href: m[1], text: stripTags(m[2]) });
  }
  return out;
}

function parseJsonLd(html: string) {
  const blocks: any[] = [];
  const re = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1].trim());
      if (Array.isArray(parsed)) blocks.push(...parsed);
      else blocks.push(parsed);
    } catch (_) {}
  }
  return blocks;
}

function walkJson(value: any, visit: (obj: any) => void) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) walkJson(item, visit);
    return;
  }
  visit(value);
  for (const item of Object.values(value)) walkJson(item, visit);
}

function parsePlace(html: string) {
  let best: any = null;
  for (const root of parseJsonLd(html)) {
    walkJson(root, (obj) => {
      if (best) return;
      if (obj.address && typeof obj.address === "object") {
        const address = obj.address;
        const street = address.streetAddress || "";
        const city = address.addressLocality || "";
        const region = address.addressRegion || "";
        const country =
          typeof address.addressCountry === "string"
            ? address.addressCountry
            : address.addressCountry?.name || address.addressCountry?.addressCountry || "";
        if (street) {
          best = {
            name: obj.name || "",
            address: street,
            city,
            region,
            countryCode: String(country || "").toUpperCase().slice(0, 2),
            latitude: Number(obj.geo?.latitude),
            longitude: Number(obj.geo?.longitude)
          };
        }
      }
    });
  }

  if (!best) {
    const street =
      html.match(/"streetAddress"\s*:\s*"([^"]+)"/i)?.[1] ||
      html.match(/streetAddress\\?"\s*:\s*\\?"([^"\\]+)"/i)?.[1] ||
      "";
    const city = html.match(/"addressLocality"\s*:\s*"([^"]+)"/i)?.[1] || "";
    const region = html.match(/"addressRegion"\s*:\s*"([^"]+)"/i)?.[1] || "";
    const lat = Number(html.match(/"latitude"\s*:\s*"?(-?\d+(?:\.\d+)?)"?/i)?.[1]);
    const lon = Number(html.match(/"longitude"\s*:\s*"?(-?\d+(?:\.\d+)?)"?/i)?.[1]);
    if (street) {
      best = {
        name: "",
        address: street,
        city,
        region,
        countryCode: "",
        latitude: lat,
        longitude: lon
      };
    }
  }

  if (best) {
    if (!Number.isFinite(best.latitude)) best.latitude = null;
    if (!Number.isFinite(best.longitude)) best.longitude = null;
  }
  return best;
}

function parseUnitPage(html: string) {
  const title =
    stripTags(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "") ||
    html.match(/"name"\s*:\s*"([^"]+)"/i)?.[1] ||
    "";
  const service =
    stripTags(html.match(/Servicio dominical[\s\S]{0,300}?([0-2]?\d:\d{2})/i)?.[1] || "") ||
    stripTags(html.match(/Sunday Service[\s\S]{0,300}?([0-2]?\d:\d{2})/i)?.[1] || "");
  return { title, service, place:parsePlace(html) };
}

async function reverseLookup(lat: number, lon: number) {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("zoom", "10");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  const res = await fetch(url, {
    headers: { "user-agent": "EntrevistasObispado/1.0" }
  });
  if (!res.ok) throw new Error("Could not resolve location");
  const data = await res.json();
  const a = data.address || {};
  return {
    city: a.city || a.town || a.village || a.municipality || a.county || "",
    countryCode: String(a.country_code || "").toUpperCase()
  };
}

async function syncCity(city: string, countryCode: string) {
  const cc = countryCode.toLowerCase();
  const countryHtml = await fetchHtml(`${OFFICIAL_HOST}/es/${cc}`);
  const cityNeedle = normalizeText(city);
  const cityLinks = anchors(countryHtml)
    .filter((a) => a.href.includes(`/es/${cc}/-/`))
    .map((a) => ({ ...a, score: normalizeText(a.text) === cityNeedle ? 0 : normalizeText(a.text).includes(cityNeedle) || cityNeedle.includes(normalizeText(a.text)) ? 1 : 9 }))
    .filter((a) => a.score < 9)
    .sort((a, b) => a.score - b.score);

  if (!cityLinks.length) {
    return { city, countryCode, meetinghouses: [], units: [], foundCity: false };
  }

  const exactLinks = cityLinks.filter((a) => a.score === 0);
  const selectedCityLinks = (exactLinks.length ? exactLinks : cityLinks.slice(0, 1))
    .slice(0, 8);

  const cityUrls = [...new Set(selectedCityLinks.map((a) => absoluteUrl(a.href)))];
  const locationLinkSet = new Set<string>();

  for (const cityPageUrl of cityUrls) {
    try {
      const cityHtml = await fetchHtml(cityPageUrl);
      const cityUrlObj = new URL(cityPageUrl);
      const citySlug = cityUrlObj.pathname.split("/").filter(Boolean).pop() || "";
      const locationPrefix = `/es/${cc}/${citySlug}/`;

      for (const a of anchors(cityHtml)) {
        try {
          const resolved = new URL(a.href, OFFICIAL_HOST);
          const path = resolved.pathname.replace(/\/$/, "");
          if (
            path.startsWith(locationPrefix) &&
            !path.includes("/units/") &&
            !path.includes("/events/")
          ) {
            locationLinkSet.add(resolved.toString());
          }
        } catch (_) {}
      }
    } catch (_) {}
  }

  const cityUrl = cityUrls[0];
  const locationLinks = [...locationLinkSet].slice(0, 100);

  const meetinghouses: any[] = [];
  const units: any[] = [];

  for (const href of locationLinks) {
    try {
      const officialUrl = absoluteUrl(href);
      const html = await fetchHtml(officialUrl);
      const place = parsePlace(html);
      if (!place?.address) continue;

      const name = place.name && !/church of jesus christ/i.test(place.name)
        ? place.name
        : "Capilla " + (place.address.split(",")[0] || city);

      const { data: saved, error } = await admin
        .from("church_meetinghouses")
        .upsert({
          name,
          address: place.address,
          city: place.city || city,
          region: place.region || null,
          country_code: countryCode.toUpperCase(),
          latitude: place.latitude,
          longitude: place.longitude,
          official_url: officialUrl,
          source: "official_directory",
          source_verified_at: new Date().toISOString(),
          is_active: true
        }, { onConflict: "country_code,city,address", ignoreDuplicates: false })
        .select("id,name,address,city,region,country_code,latitude,longitude,official_url")
        .single();

      if (error || !saved) continue;
      meetinghouses.push(saved);

      const unitLinks = [...new Set(
        anchors(html)
          .map((a) => a.href.split("?")[0])
          .filter((u) => u.includes(`/es/units/${cc}/-/`))
      )].slice(0, 12);

      for (const unitHref of unitLinks) {
        try {
          const unitUrl = absoluteUrl(unitHref);
          const unitHtml = await fetchHtml(unitUrl);
          const parsed = parseUnitPage(unitHtml);
          if (!parsed.title) continue;

          const type = normalizeText(parsed.title).includes("rama") ? "branch" : "ward";
          const { data: unitSaved } = await admin
            .from("church_units")
            .upsert({
              unit_name: parsed.title,
              unit_type: type,
              meetinghouse_id: saved.id,
              meetinghouse_name: saved.name,
              address: saved.address,
              city: saved.city,
              region: saved.region || null,
              country_code: saved.country_code,
              official_url: unitUrl,
              sunday_service: parsed.service || null,
              is_active: true,
              source_verified_at: new Date().toISOString()
            }, { onConflict: "official_url", ignoreDuplicates: false })
            .select("id,unit_name,unit_type,sunday_service,official_url,meetinghouse_id")
            .single();
          if (unitSaved) units.push(unitSaved);
        } catch (_) {}
      }
    } catch (_) {}
  }

  const firstRegion = meetinghouses.find((x:any)=>x.region)?.region || null;
  const {count:storedUnitCount,error:storedUnitCountError}=await admin
    .from("church_units")
    .select("id",{count:"exact",head:true})
    .eq("country_code",countryCode.toUpperCase())
    .eq("city",city)
    .eq("is_active",true);
  if (storedUnitCountError) throw storedUnitCountError;

  const finalUnitCount=Math.max(units.length,Number(storedUnitCount || 0));
  await admin.from("church_directory_places").upsert({
    country_code: countryCode.toUpperCase(),
    city_name: city,
    region: firstRegion,
    official_url: cityUrl,
    meetinghouse_count: meetinghouses.length,
    unit_count: finalUnitCount,
    last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }, { onConflict: "country_code,city_name", ignoreDuplicates: false });
  await markCityQueue(countryCode,city,cityUrl,finalUnitCount);

  return {
    city,
    countryCode: countryCode.toUpperCase(),
    cityUrl,
    foundCity: true,
    meetinghouses,
    units
  };
}

async function syncPendingCityBatch(countryCode:string, limit:number) {
  const safeLimit=Math.max(1,Math.min(Number(limit||2),3)), now=new Date().toISOString();
  const {data:rows,error}=await admin.from("church_directory_city_queue").select("city_name").eq("country_code",countryCode.toUpperCase()).eq("status","pending").or("next_attempt_at.is.null,next_attempt_at.lte."+now).order("next_attempt_at",{ascending:true,nullsFirst:true}).limit(safeLimit);
  if (error) throw error;
  const results:any[]=[];
  for (const row of rows||[]) {
    const city=String(row.city_name||"").trim(); if (!city) continue;
    try {
      const result=await syncCity(city,countryCode);
      results.push({city,ok:true,meetinghouses:result.meetinghouses.length,units:result.units.length});
    } catch (error) {
      const message=error instanceof Error?error.message:"Sync failed";
      await admin.from("church_directory_city_queue").update({last_error:message.slice(0,500),last_attempt_at:new Date().toISOString(),next_attempt_at:new Date(Date.now()+604800000).toISOString(),updated_at:new Date().toISOString()}).eq("country_code",countryCode.toUpperCase()).eq("city_name",city);
      results.push({city,ok:false,error:message});
    }
  }
  const {count:remaining}=await admin.from("church_directory_city_queue").select("city_name",{count:"exact",head:true}).eq("country_code",countryCode.toUpperCase()).eq("status","pending");
  return {countryCode:countryCode.toUpperCase(),processed:(rows||[]).length,remaining:Number(remaining||0),results};
}

async function listCountryPlaces(countryCode: string) {
  const cc=countryCode.toLowerCase();
  const countryUrl=`${OFFICIAL_HOST}/es/${cc}`;
  const html=await fetchHtml(countryUrl);
  const seen=new Map<string,{city:string;officialUrl:string}>();

  for (const a of anchors(html)) {
    if (!a.href.includes(`/es/${cc}/-/`)) continue;
    const city=a.text.trim();
    if (!city) continue;
    const key=normalizeText(city);
    if (!key || seen.has(key)) continue;
    seen.set(key,{city,officialUrl:absoluteUrl(a.href)});
  }

  const places=[...seen.values()];
  if (places.length) {
    await admin.from("church_directory_places").upsert(
      places.map(p=>({
        country_code:countryCode.toUpperCase(),
        city_name:p.city,
        official_url:p.officialUrl,
        updated_at:new Date().toISOString()
      })),
      {onConflict:"country_code,city_name",ignoreDuplicates:false}
    );
  }
  return places;
}

async function syncCountryBatch(countryCode:string, offset:number, limit:number) {
  const places=await listCountryPlaces(countryCode);
  const safeOffset=Math.max(0,offset||0);
  const safeLimit=Math.max(1,Math.min(limit||3,5));
  const batch=places.slice(safeOffset,safeOffset+safeLimit);
  const results:any[]=[];

  for (const place of batch) {
    try {
      const result=await syncCity(place.city,countryCode);
      results.push({
        city:place.city,
        ok:true,
        meetinghouses:result.meetinghouses.length,
        units:result.units.length
      });
    } catch (error) {
      results.push({
        city:place.city,
        ok:false,
        error:error instanceof Error?error.message:"Sync failed"
      });
    }
  }

  return {
    countryCode:countryCode.toUpperCase(),
    offset:safeOffset,
    processed:batch.length,
    total:places.length,
    nextOffset:safeOffset+batch.length,
    done:safeOffset+batch.length>=places.length,
    results
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: CORS_HEADERS
    });
  }

  try {
    const body = await req.json();
    const action=String(body.action || "sync-city");
    let city = String(body.city || "").trim();
    let countryCode = String(body.countryCode || "").trim().toUpperCase();

    if (ADMIN_DIRECTORY_ACTIONS.has(action)) {
      const authorizationError = await requireSecretaryAdmin(req);
      if (authorizationError) return authorizationError;
    }

    if (!/^[A-Z]{2}$/.test(countryCode) && action!=="sync-city") {
      return new Response(JSON.stringify({error:"countryCode is required"}),{
        status:400,
        headers:{...CORS_HEADERS,"content-type":"application/json"}
      });
    }

    if (action==="country-index") {
      const places=await listCountryPlaces(countryCode);
      return new Response(JSON.stringify({
        countryCode,
        total:places.length,
        places
      }),{
        headers:{...CORS_HEADERS,"content-type":"application/json","cache-control":"private, max-age=300"}
      });
    }

    if (action==="sync-country-batch") {
      const result=await syncCountryBatch(
        countryCode,
        Number(body.offset||0),
        Number(body.limit||3)
      );
      return new Response(JSON.stringify(result),{
        headers:{...CORS_HEADERS,"content-type":"application/json","cache-control":"no-store"}
      });
    }

    if (action==="unit-index") {
      const result=await discoverUnitUrls(countryCode);
      return new Response(JSON.stringify(result),{
        headers:{...CORS_HEADERS,"content-type":"application/json","cache-control":"no-store"}
      });
    }

    if (action==="sync-unit-batch") {
      const result=await syncUnitIndexBatch(
        countryCode,
        Number(body.limit||4)
      );
      return new Response(JSON.stringify(result),{
        headers:{...CORS_HEADERS,"content-type":"application/json","cache-control":"no-store"}
      });
    }

    if (action==="sync-pending-city-batch") {
      const result=await syncPendingCityBatch(countryCode,Number(body.limit||2));
      return new Response(JSON.stringify(result),{
        headers:{...CORS_HEADERS,"content-type":"application/json","cache-control":"no-store"}
      });
    }

    const lat = Number(body.lat);
    const lon = Number(body.lon);
    if ((!city || !countryCode) && Number.isFinite(lat) && Number.isFinite(lon)) {
      const reverse = await reverseLookup(lat, lon);
      city ||= reverse.city;
      countryCode ||= reverse.countryCode;
    }

    if (!city || !/^[A-Z]{2}$/.test(countryCode)) {
      return new Response(JSON.stringify({ error: "city and countryCode are required" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "content-type": "application/json" }
      });
    }

    const result = await syncCity(city, countryCode);
    return new Response(JSON.stringify(result), {
      headers: {
        ...CORS_HEADERS,
        "content-type": "application/json",
        "cache-control": "private, max-age=300"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unexpected error"
    }), {
      status: 500,
      headers: { ...CORS_HEADERS, "content-type": "application/json" }
    });
  }
});