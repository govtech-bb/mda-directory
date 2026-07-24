import React, { useState, useEffect, useMemo, useRef } from "react";
// Icons removed by request — every icon resolves to a no-op component so the
// UI is entirely text-based (in keeping with the icon-light gov.bb style).
const NoIcon = () => null;
const Search = NoIcon, Building2 = NoIcon, Phone = NoIcon, Mail = NoIcon, MapPin = NoIcon,
  CheckCircle2 = NoIcon, Clock = NoIcon, PencilLine = NoIcon, Plus = NoIcon, Trash2 = NoIcon,
  Download = NoIcon, ChevronLeft = NoIcon, ChevronRight = NoIcon, ShieldCheck = NoIcon, X = NoIcon,
  RotateCcw = NoIcon, ClipboardCheck = NoIcon, Check = NoIcon, Info = NoIcon, FileEdit = NoIcon,
  Landmark = NoIcon, CornerDownRight = NoIcon, Users = NoIcon, Link2 = NoIcon, Copy = NoIcon,
  Lock = NoIcon, LogOut = NoIcon;

const KEY = "mda-validation:records-v7";
const SHARED = true;

// ---------------------------------------------------------------------------
// Shared database (Supabase)
// ---------------------------------------------------------------------------
// Paste your Supabase project URL and anon (public) key below and every
// browser reads/writes the same records — a coordinator sees submissions made
// on any device. Leave them blank to run on localStorage only.
//
// One-time setup in the Supabase SQL editor:
//
//   create table if not exists kv (
//     key        text primary key,
//     data       jsonb not null,
//     updated_at timestamptz not null default now()
//   );
//   alter table kv enable row level security;
//   -- Prototype policy: allow the anon key to read and write this one table.
//   create policy "kv anon read"  on kv for select using (true);
//   create policy "kv anon write" on kv for insert with check (true);
//   create policy "kv anon update" on kv for update using (true) with check (true);
//
// The anon key is safe to ship in client code; tighten the policies above
// before this holds anything sensitive.
const SUPABASE_URL = "https://odioindeqhrqaeicsfvw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_56RAbq0YtRETE1B4tNzaQA_QFpe5l53"; // publishable (public) key

const supabaseReady = () => !!(SUPABASE_URL && SUPABASE_ANON_KEY);
const sbHeaders = () => ({
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
});
async function sbLoad() {
  const url = `${SUPABASE_URL}/rest/v1/kv?key=eq.${encodeURIComponent(KEY)}&select=data`;
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) throw new Error(`Supabase load ${res.status}`);
  const rows = await res.json();
  return rows && rows[0] ? rows[0].data : null;
}
async function sbSave(records) {
  const url = `${SUPABASE_URL}/rest/v1/kv?on_conflict=key`;
  const res = await fetch(url, {
    method: "POST",
    headers: { ...sbHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ key: KEY, data: records, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`Supabase save ${res.status}`);
  return true;
}
// Shared access code for coordinator/reviewer sign-in. Change this to your team's code.
const ACCESS_CODE = "mda-review-2026";
const newId = () => "mda_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const R = (r, t) => ({ r, t }); // role helper

const slugify = (s) => (s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

// Read a requested MDA slug from the page URL (#mda=slug or ?mda=slug)
const getLinkSlug = () => {
  try {
    const fromHash = (window.location.hash || "").replace(/^#/, "");
    const hp = new URLSearchParams(fromHash);
    if (hp.get("mda")) return hp.get("mda");
    const sp = new URLSearchParams(window.location.search || "");
    if (sp.get("mda")) return sp.get("mda");
  } catch (e) {}
  return null;
};
const baseUrl = () => {
  try { return window.location.href.split("#")[0].split("?")[0]; } catch (e) { return ""; }
};

// ---- Source data imported from alpha.gov.bb / gov.bb ----
// Ministries carry their published contact details + role directory.
// Departments carry contact details where they have been pre-filled;
// the rest start blank for the representative to supply.
const MINISTRIES = [
  { name: "Cabinet Office", phone: "(246) 535-5300", email: "cabinetoffice@barbados.gov.bb", address: "Government Headquarters, Bay Street, St. Michael, Barbados, W.I.",
    roles: [R("PBX", "(246) 535-5300"), R("Cabinet Secretary", "(246) 535-5380"), R("Deputy Permanent Secretary", "(246) 535-5385"), R("Senior Executive Officer", "(246) 535-5382"), R("Accounts", "(246) 535-5381"), R("Registry", "(246) 535-5607")],
    departments: [{ name: "The Electoral and Boundaries Commission", phone: "(246) 535-4800", email: "electoral@barbados.gov.bb", address: "Ground Floor & 4th Floor Warrens Tower II, Warrens, St. Michael, Barbados, W.I." }] },

  { name: "Ministry of Agriculture and Food and Nutritional Security", phone: "(246) 535-5100", email: "ps@agriculture.gov.bb", address: "Graeme Hall, Christ Church, Barbados, W.I.",
    roles: [R("Main Office", "(246) 535-5100"), R("Minister", "(246) 535-5110"), R("Permanent Secretary", "(246) 535-5115"), R("Deputy Permanent Secretary", "(246) 535-5124"), R("Chief Agricultural Officer", "(246) 535-5118"), R("Extension Division", "(246) 535-5184")],
    departments: [
      { name: "The Public Markets", phone: "(246) 535-5133", email: "piu.gob@barbados.gov.bb", address: "3rd Floor East Wing, Warrens Office Complex, Warrens, St. Michael, Barbados, W.I." },
      { name: "Analytical Services", phone: "(246) 535-1711", email: "director@gas.gov.bb", address: "Culloden Road, St. Michael" },
      { name: "The Barbados Agricultural Management Company", phone: "(246) 425-0010", email: "", address: "Warrens, St. Michael" },
      { name: "The Barbados Agricultural Development and Marketing Corporation (BADMC)", phone: "(246) 535-6830", email: "", address: "Fairy Valley Plantation House, Christ Church" },
      { name: "Veterinary Services", phone: "(246) 535-0221 / (246) 535-0226", email: "", address: "The Pine, St. Michael" },
      { name: "Soil Conservation", phone: "(246) 422-9030", email: "", address: "Haggatts, St. Andrew" },
      { name: "Southern Meats Inc.", phone: "(246) 428-0224 / (246) 428-0225", email: "", address: "Balls Plantation, Christ Church" },
      { name: "The Barbados Agricultural Credit Trust Limited", phone: "(246) 228-5565", email: "", address: "5 Stafford House, The Garrison, St. Michael" },
      { name: "Barbados Medicinal Cannabis Licencing Authority", phone: "(246) 421-4141", email: "clo@bmcla.bb", address: "Warrens House, Warrens, St. Michael BB 22026" },
    ] },

  { name: "Ministry of Educational Transformation", phone: "(246) 535-0600", email: "info@mes.gov.bb", address: "Elsie Payne Complex, Constitution Road, St. Michael, Barbados, W.I.",
    roles: [R("Main Office", "(246) 535-0600"), R("Secretary to the Permanent Secretary", "(246) 535-0608"), R("Higher Education Development Unit (PBX)", "(246) 535-4050")],
    departments: [
      { name: "The School Meals Department", phone: "(246) 535-6801", email: "", address: "Coles Building, Lower Bay Street, Bridgetown, St. Michael, Barbados, W.I." },
      { name: "Media Resource Department", phone: "(246) 430-2848", email: "mrd@mes.gov.bb", address: "Elsie Payne Complex, Constitution Road, St. Michael, Barbados, W.I." },
      { name: "The National Advisory Commission on Education" },
    ] },

  { name: "Ministry of Energy and Business Development", phone: "(246) 535-2500", email: "info@energy.gov.bb", address: "Trinity Business Centre, Country Road, St. Michael, Barbados",
    roles: [R("General", "(246) 535-2500"), R("Minister", "(246) 535-7709"), R("Permanent Secretary", "(246) 535-2531"), R("Deputy Permanent Secretary", "(246) 535-2503"), R("Chief Legal Officer", "(246) 535-2508"), R("Director, Natural Resources", "(246) 535-2507")],
    departments: [
      { name: "Barbados National Oil Company Limited", phone: "(246) 418-5200", email: "", address: "Woodbourne, St. Philip" },
      { name: "Barbados National Terminal Company Limited", phone: "(246) 228-4811", email: "", address: "Fair Valley, Christ Church, Barbados, W.I." },
      { name: "National Petroleum Corporation", phone: "(246) 430-4000", email: "bimgas@caribsurf.com", address: "Wildey, St. Michael BB11000" },
      { name: "Small Business Development Unit", phone: "(246) 535-7700", email: "", address: "Warrens Office Complex, Warrens, St. Michael" },
      { name: "Fair Trading Commission", phone: "(246) 424-0260", email: "info@ftc.gov.bb", address: "Good Hope, Green Hill, St. Michael" },
      { name: "Office of Public Counsel", phone: "(246) 535-2758", email: "commerce.ps@barbados.gov.bb", address: "Warrens Office Complex, Warrens, St. Michael" },
      { name: "Barbados National Standards Institution", phone: "(246) 426-3870", email: "office@bnsi.com.bb", address: "Flodden Culloden Road, St. Michael" },
      { name: "Barbados Coalition of Service Industries", phone: "(246) 429-5357", email: "info@bcsi.org.bb", address: "Building #3 Harbour Industrial Estate, Harbour Road, Bridgetown, St. Michael" },
      { name: "Corporate Affairs and Intellectual Property Office", phone: "(246) 535-2401", email: "", address: "" },
      { name: "International Business and Financial Services Unit", phone: "(246) 535-7200", email: "", address: "8th Floor Baobab Tower, Warrens, St. Michael, Barbados, West Indies" },
    ] },

  { name: "Ministry of Environment and National Beautification", phone: "(246) 535-4350", email: "ps.menb@barbados.gov.bb", address: "10th Floor Warrens Tower II, Warrens, St. Michael, BB12001, Barbados, W.I.",
    roles: [R("Secretary to the Permanent Secretary", "(246) 535-4357"), R("Permanent Secretary (Blue and Green Economy)", "(246) 535-0038")],
    departments: [
      { name: "Environmental Protection Department", phone: "(246) 535-4600", email: "epd.secretary@epd.gov.bb", address: "L.V. Harcourt Lewis Building, Dalkeith, St. Michael, Barbados, W.I." },
      { name: "Sanitation Services Authority", phone: "(246) 535-5080", email: "", address: "2nd Floor National Petroleum Corporation's Building, Wildey, St. Michael" },
      { name: "National Conservation Commission", phone: "(246) 536-0600", email: "ncc@caribsurf.com", address: "Codrington House, St. Michael" },
      { name: "Fisheries Division", phone: "(246) 535-5800", email: "", address: "Princess Alice Highway, St. Michael, Barbados, W.I." },
      { name: "Coastal Zone Management Unit", phone: "(246) 535-5700", email: "director@coastal.gov.bb", address: "8th Floor Warrens Tower II, St. Michael, Barbados, W.I." },
    ] },

  { name: "Ministry of Finance, Economic Affairs and Investment", phone: "(246) 535-5300", email: "", address: "Government Headquarters, Bay Street, St. Michael, Barbados, W.I.",
    roles: [R("PBX", "(246) 535-5300"), R("Minister of Finance & Economic Affairs", "(246) 535-5441"), R("Permanent Secretary (Finance)", "(246) 535-5337"), R("Deputy Permanent Secretary (Administration)", "(246) 535-5376"), R("Chief Accountant", "(246) 535-5304")],
    departments: [
      { name: "Treasury Department", phone: "(246) 535-0900", email: "coppind@gob.bb", address: "" },
      { name: "Statistical Services Department", phone: "(246) 535-2600", email: "barstats@caribsurf.com", address: "5th Floor Baobab Tower Building, Warrens, St. Michael, Barbados, W.I." },
      { name: "Central Purchasing Department", phone: "(246) 535-4903", email: "worrellja@gob.bb", address: "Fontabelle, St. Michael, Barbados, W.I." },
      { name: "Special Projects - Financial" },
      { name: "Public Investment Unit", phone: "(246) 436-6435", email: "", address: "Finance and Economic Affairs, Government Headquarters, Bay Street, St. Michael, Barbados" },
      { name: "Economic and Social Planning Development" },
      { name: "The Productivity Council", phone: "(246) 626-9416", email: "bnpcouncil@caribsurf.com", address: "3rd Floor Baobab Towers, Warrens, St. Michael" },
    ] },

  { name: "Ministry of Foreign Affairs and Foreign Trade", phone: "(246) 535-6620", email: "barbados@foreign.gov.bb", address: "1 Culloden Road, St. Michael, Barbados, W.I.",
    roles: [],
    departments: [{ name: "Consular and Diaspora Division" }] },

  { name: "Ministry of Health and Wellness", phone: "(246) 536-3800", email: "ps-secretary@health.gov.bb", address: "Frank Walcott Building, Culloden Road, St. Michael, Barbados, W.I.",
    roles: [R("PBX", "(246) 536-3800"), R("Minister", "(246) 536-3801"), R("Permanent Secretary", "(246) 536-3802"), R("Chief Medical Officer", "(246) 536-3803"), R("Deputy Permanent Secretary", "(246) 536-3804"), R("Chief Public Health Nurse", "(246) 536-3846")],
    departments: [
      { name: "Barbados Drug Service", phone: "(246) 535-4300", email: "director@drugservice.gov.bb", address: "6th & 7th Floors Warrens Towers II, Warrens, St. Michael, Barbados, W.I." },
      { name: "The Queen Elizabeth Hospital", phone: "(246) 436-6450", email: "", address: "Martindales Road, St. Michael" },
      { name: "The Psychiatric Hospital", phone: "(246) 536-3001", email: "psychiatrichospital@caribsurf.com", address: "Black Rock, St. Michael, Barbados, W.I.",
        roles: [R("Senior Consultant Psychiatrist", "(246) 536-3006"), R("Hospital Director", "(246) 536-3004"), R("Assistant Hospital Director", "(246) 536-3005"), R("Assessment Unit", "(246) 536-3091"), R("Nursing Office", "(246) 536-3026"), R("Outpatients", "(246) 536-3048")] },
    ] },

  { name: "Ministry of Home Affairs and Information", phone: "(246) 535-7260", email: "homeaffairs@mha.gov.bb", address: "Ground Floor Jones Building, Webster Business Park, Wildey, St. Michael, Barbados, W.I.",
    roles: [R("PBX", "(246) 535-7260"), R("Minister", "(246) 535-0434"), R("Permanent Secretary", "(246) 535-7261"), R("Deputy Permanent Secretary", "(246) 535-7262"), R("Financial Comptroller", "(246) 535-7268")],
    departments: [
      { name: "Department of Emergency Management", phone: "(246) 438-7575", email: "deminfo@barbados.gov.bb", address: "The George Greaves Building, #24 Warrens Industrial Park, Warrens, St. Michael, Barbados, W.I." },
      { name: "Meteorological Office", phone: "(246) 535-0020", email: "hampden.lovell@barbados.gov.bb", address: "Building #4 Grantley Adams Industrial Park, Christ Church, Barbados, W.I." },
      { name: "Fire Service Department", phone: "(246) 535-7824", email: "", address: "" },
      { name: "Post Office", phone: "(246) 535-3900", email: "barbadospost@caribsurf.com", address: "Cheapside, Bridgetown, St. Michael, Barbados, W.I." },
      { name: "Probation Department", phone: "(246) 536-0400", email: "probation.department@barbados.gov.bb", address: "33 Roebuck Street, Bridgetown, St. Michael, Barbados, W.I." },
      { name: "Immigration Department", phone: "", email: "", address: "" },
      { name: "Government Industrial School", phone: "(246) 535-9503", email: "ronald.brathwaite@barbados.gov.bb", address: "Dodds, St. Philip, Barbados, W.I." },
      { name: "Barbados Prison Service", phone: "(246) 535-7300", email: "secretary@prisonservice.gov.bb", address: "HMP Dodds, St. Philip, Barbados, W.I." },
      { name: "National Council on Substance Abuse", phone: "(246) 535-6272", email: "ncsa.info@barbados.gov.bb", address: "The Armaira Building, Corner 1st Avenue, Belleville & Pine Road, St. Michael, Barbados" },
      { name: "Caribbean Broadcasting Corporation", phone: "(246) 467-5400", email: "rlondon@cbc.bb", address: "The Pine, St. Michael" },
      { name: "Barbados Government Information Service", phone: "(246) 535-1900", email: "webbgis@barbados.gov.bb", address: "Old Town Hall, Cheapside, Barbados, W.I." },
      { name: "Government Printing Department", phone: "(246) 535-6301", email: "government.printery@barbados.gov.bb", address: "Bay Street, Bridgetown, St. Michael, Barbados, W.I." },
    ] },

  { name: "Ministry of Housing, Lands and Maintenance", phone: "(246) 536-5000", email: "pshousing@barbados.gov.bb", address: "National Housing Corporation, Country Road, St. Michael, Barbados, W.I.",
    roles: [],
    departments: [
      { name: "National Housing Corporation", phone: "(246) 467-6200", email: "nhc@nhc.gov.bb", address: "Country Road, St. Michael" },
      { name: "Land Registration Department", phone: "(246) 310-1100", email: "mjohnson@landregistry.gov.bb", address: "Ground Floor Warrens Office Complex, Warrens, St. Michael",
        roles: [R("Registrar of Titles", "(246) 310-1105"), R("Deputy Registrar of Titles", "(246) 310-1106"), R("Assistant Registrar", "(246) 310-1120"), R("Accountant", "(246) 310-1136"), R("Manager Information Systems", "(246) 310-1109")] },
      { name: "Lands and Surveys Department",
        roles: [R("Senior Surveyor", "(246) 536-5202"), R("Manager Information Systems", "(246) 536-5206")] },
    ] },

  { name: "Ministry of Industry, Innovation, Science and Technology", phone: "(246) 535-1200", email: "psmist@barbados.gov.bb", address: "3rd and 4th Floor Baobab Tower, Warrens, St. Michael",
    roles: [],
    departments: [{ name: "Data Protection Commission" }] },

  { name: "Ministry of Labour, Social Security and Third Sector", phone: "(246) 535-1400", email: "ps@labour.gov.bb", address: "3rd Floor West Wing, Warrens Office Complex, Warrens, St. Michael, Barbados, W.I.",
    roles: [],
    departments: [
      { name: "Labour Department",
        roles: [R("Chief Labour Officer", "(246) 535-1502"), R("Deputy Chief Labour Officer", "(246) 535-1503"), R("Assistant Chief Labour Officer", "(246) 535-1504"), R("Legal Officer", "(246) 535-1530"), R("Registry", "(246) 535-1527")] },
      { name: "National Insurance Department" },
    ] },

  { name: "Ministry of People Empowerment and Elder Affairs", phone: "(246) 535-1600", email: "socialcare@barbados.gov.bb", address: "4th Floor Warrens Office Complex, Warrens, St. Michael, Barbados, W.I.",
    roles: [],
    departments: [
      { name: "The National Assistance Board", phone: "(246) 535-3131", email: "", address: "Murrell House, Country Road, St. Michael" },
      { name: "Poverty Alleviation Bureau", phone: "(246) 310-1803", email: "", address: "4th Floor Warrens Office Complex, St. Michael" },
      { name: "The Child Care Board", phone: "(246) 535-2800", email: "", address: "Fred Edghill Building, Cheapside Road, St. Michael" },
      { name: "Bureau of Social Policy, Research and Planning", phone: "(246) 535-1600", email: "", address: "4th Floor Warrens Office Complex, Warrens, St. Michael" },
      { name: "Bureau of Gender Affairs", phone: "(246) 535-0102", email: "genderbureau@barbados.gov.bb", address: "6th Floor Baobab Towers, Warrens, St. Michael, Barbados, W.I." },
      { name: "Welfare Department", phone: "(246) 535-1000", email: "welfare.department@barbados.gov.bb", address: "Weymouth Corporate Center, Roebuck St. Bridgetown, St. Michael, Barbados, W.I." },
      { name: "National Disabilities Unit", phone: "(246) 535-3600", email: "disabilities.unit@barbados.gov.bb", address: "\"Maxwelton\", Collymore Rock, St. Michael" },
    ] },

  { name: "Ministry of the Public Service and Talent Development", phone: "(246) 535-4423", email: "dg@mps.gov.bb", address: "E. Humphrey Walcott Building, Cnr. Collymore Rock and Culloden Road, St. Michael",
    roles: [],
    departments: [
      { name: "Directorate, Human Resource Policy and Staffing", phone: "(246) 535-4400", email: "hrps@mps.gov.bb", address: "E. Humphrey Walcott Building, Cnr. Culloden Road & Collymore Rock, St. Michael, Barbados" },
      { name: "Directorate, Learning and Development", phone: "(246) 535-6700", email: "LD@mps.gov.bb", address: "Level 5, Warrens Towers II, Warrens, St. Michael, Barbados" },
      { name: "Directorate, People Resourcing and Compliance", phone: "(246) 535-4500", email: "prc@mps.gov.bb", address: "E. Humphrey Walcott Building, Corner Culloden Road & Collymore Rock, St. Michael" },
    ] },

  { name: "Ministry of Tourism and International Transport", phone: "(246) 535-7500", email: "", address: "Lloyd Erskine Sandiford Centre, Two Mile Hill, St. Michael, Barbados, W.I.",
    roles: [],
    departments: [
      { name: "Barbados Tourism Marketing Inc.", phone: "(246) 535-3700", email: "btmiinfo@visitbarbados.org", address: "One Barbados Place, Warrens, St. Michael, Barbados BB12001" },
      { name: "Barbados Conference Services Limited (BCSL)", phone: "(246) 467-8200", email: "", address: "Lloyd Erskine Sandiford Centre, Two Mile Hill, St. Michael, Barbados, W.I." },
      { name: "Caves of Barbados Limited (CBL)", phone: "(246) 417-3700", email: "reservations@harrisonscave.com", address: "Allen View, St. Thomas, Barbados, W.I." },
      { name: "Air Navigation Services Department", phone: "(246) 536-3601", email: "", address: "" },
      { name: "Grantley Adams International Airport", phone: "(246) 536-1300", email: "office@gaiainc.bb", address: "Seawell, Christ Church" },
      { name: "Barbados Port Inc.", phone: "(246) 434-6100", email: "administrator@barbadosport.com", address: "Cheapside, St. Michael" },
    ] },

  { name: "Ministry of Training and Tertiary Education", phone: "", email: "", address: "",
    roles: [],
    departments: [
      { name: "Barbados Community College", phone: "(246) 426-2858", email: "eyrie@bcc.edu.bb", address: "Howells' Road, St. Michael" },
      { name: "The Samuel Jackman Prescod Institute of Technology", phone: "(246) 535-2200", email: "", address: "" },
      { name: "University of the West Indies", phone: "(246) 417-4000", email: "", address: "Cave Hill, St. Michael" },
      { name: "Erdiston Teachers' Training College", phone: "(246) 535-3247", email: "", address: "Government Hill, St. Michael" },
      { name: "Barbados Vocational Training Board", phone: "(246) 621-2882", email: "info@bvtb.gov.bb", address: "Lawrence Green House, Culloden Road, St. Michael" },
      { name: "Technical & Vocational Education and Training Council", phone: "(246) 435-3096", email: "office@tvetcouncil.com.bb", address: "Hastings House West, Balmoral Gap, Hastings, Christ Church BB14033" },
      { name: "Barbados Accreditation Council", phone: "(246) 535-6740", email: "info@bac.gov.bb", address: "First Floor, The Phoenix Centre, George Street, St. Michael, BB11114" },
    ] },

  { name: "Ministry of Transport, Works and Water Resources", phone: "(246) 536-0000", email: "psmtwm@barbados.gov.bb", address: "Pine East/West Boulevard, The Pine, St. Michael, Barbados, W.I.",
    roles: [],
    departments: [
      { name: "Licensing Authority", phone: "(246) 536-0264", email: "CLO@publicworks.gov.bb", address: "The Pine, St. Michael, Barbados, W.I." },
      { name: "Transport Board", phone: "(246) 535-3500", email: "", address: "" },
      { name: "Government Electrical Engineering Department", phone: "(246) 535-7100", email: "GEED@barbados.gov.bb", address: "Verona House, Bank Hall Main Road, St. Michael, Barbados, W.I." },
      { name: "Barbados Water Authority", phone: "(246) 434-4200", email: "customercare@bwa.bb", address: "Pine Commercial Estate, The Pine, St. Michael, P.O. Box 1260, Bridgetown" },
    ] },

  { name: "Ministry of Youth, Sports and Community Empowerment", phone: "(246) 535-3835", email: "ps.mysce@barbados.gov.bb", address: "Sky Mall, Haggatt Hall, St. Michael",
    roles: [],
    departments: [
      { name: "Division of Youth Affairs", phone: "(246) 535-3835", email: "division.youth@barbados.gov.bb", address: "Sky Mall, Haggatt Hall, St. Michael, Barbados, W.I." },
      { name: "Youth Entrepreneurship Scheme", phone: "(246) 535-3835", email: "", address: "Sky Mall, Haggatt Hall, St. Michael" },
      { name: "The National Sports Council", phone: "(246) 535-9601", email: "nsc.bdos@barbados.gov.bb", address: "The National Sports Complex, Wildey Gymnasium, Garfield Sobers Sports Complex, Wildey, St. Michael, BB 22026" },
      { name: "Community Development Department", phone: "(246) 535-1650", email: "comdev.barbados@barbados.gov.bb", address: "4th Floor East Wing, Warrens Office Complex, Warrens, St. Michael, Barbados, W.I." },
    ] },

  { name: "Office of the Attorney General", phone: "(246) 535-0467", email: "ps@oag.gov.bb", address: "Jones Building, Webster's Business Park, Wildey, St. Michael, Barbados, W.I.",
    roles: [],
    departments: [
      { name: "Registration Department", phone: "(246) 535-9700", email: "registrar@lawcourts.gov.bb", address: "Supreme Court Complex, Whitepark Road, St. Michael, Barbados, W.I." },
      { name: "Supreme Court", phone: "(246) 434-9970", email: "registrar@lawcourts.gov.bb", address: "White Park Road, St. Michael" },
      { name: "The Police Department", phone: "(246) 430-7100", email: "", address: "Lower Roebuck Street, Bridgetown, St. Michael" },
      { name: "Criminal Justice Research and Planning Unit", phone: "(246) 536-0800", email: "", address: "" },
    ] },

  { name: "Prime Minister's Office", phone: "(246) 535-5300", email: "pspmo@barbados.gov.bb", address: "Government Headquarters, Bay Street, St. Michael, Barbados, W.I.",
    roles: [],
    departments: [
      { name: "Customs and Excise Department", phone: "(246) 535-8700", email: "comptroller@customs.gov.bb", address: "2nd Floor West Wing, Warrens Office Complex, Warrens, St. Michael, Barbados, W.I." },
      { name: "Barbados Revenue Authority", phone: "(246) 535-8663", email: "louisa.lewis-ward@bra.gov.bb", address: "4th Floor Weymouth Corporate Centre, Roebuck Street, St. Michael, Barbados" },
      { name: "Central Bank of Barbados", phone: "(246) 436-6870", email: "info@centralbank.org.bb", address: "Tom Adams Financial Centre, Spry Street, Bridgetown, St. Michael" },
      { name: "Financial Services Commission", phone: "(246) 421-2142", email: "info@fsc.gov.bb", address: "Bay Corporate Building, Bay Street, St. Michael, BB14038" },
      { name: "Barbados Tourism Investment Incorporated", phone: "(246) 426-7085", email: "btii@tourisminvest.com.bb", address: "Ground Floor, Old Town Hall Building, St. Michael" },
      { name: "Kensington Oval Management Inc.", phone: "(246) 274-1200", email: "info@kensingtonoval.com.bb", address: "Kensington Oval, Fontabelle, St. Michael" },
      { name: "Barbados Defence Force", phone: "(246) 536-2500", email: "", address: "St. Ann's Fort, Garrison, St. Michael" },
      { name: "Department of Archives", phone: "(246) 535-0050", email: "bda@caribsurf.com", address: "Black Rock, St. James, Barbados, W.I." },
      { name: "National Library Service", phone: "(246) 535-2900", email: "", address: "Fairchild Street, Bridgetown, St. Michael, Barbados, W.I." },
      { name: "National Cultural Foundation", phone: "(246) 424-0909", email: "", address: "West Terrace, St. James" },
      { name: "Barbados Museum & Historical Society Council", phone: "(246) 538-0201", email: "", address: "St. Ann's Garrison, St. Michael, Barbados, W.I." },
    ] },
];

const valDefaults = () => ({
  status: "awaiting", submissionType: "", validatedPhone: "", validatedEmail: "", validatedAddress: "",
  validatedRoles: [], repName: "", repTitle: "", repEmail: "", notes: "",
  submittedAt: null, reviewedAt: null, reviewedBy: "", audit: [],
});

function buildSeed() {
  const records = [];
  for (const m of MINISTRIES) {
    const mid = newId();
    records.push({ id: mid, kind: "ministry", parentId: null, name: m.name,
      currentPhone: m.phone || "", currentEmail: m.email || "", currentAddress: m.address || "",
      roles: m.roles || [], ...valDefaults() });
    for (const d of m.departments) {
      records.push({ id: newId(), kind: "department", parentId: mid, name: d.name,
        currentPhone: d.phone || "", currentEmail: d.email || "", currentAddress: d.address || "",
        roles: d.roles || [], ...valDefaults() });
    }
  }
  return records;
}

// Persistence: prefer the shared host store (window.storage) when present,
// otherwise fall back to the browser's localStorage so changes survive a
// reload in any deployment. A shared cloud database can be layered in here
// later (see loadRecords/saveRecords) without touching the rest of the app.
const hasHostStore = () => typeof window !== "undefined" && window.storage && typeof window.storage.get === "function";

async function loadRecords() {
  // Shared cloud DB first (so every device sees the same records)…
  if (supabaseReady()) {
    try { const data = await sbLoad(); if (data) { try { window.localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} return data; } }
    catch (e) { console.warn("Supabase load failed, falling back to local cache", e); }
  }
  // …then the host store (Claude/artifact environment)…
  if (hasHostStore()) {
    try { const res = await window.storage.get(KEY, SHARED); if (res && res.value) return JSON.parse(res.value); }
    catch (e) {}
  }
  // …then the browser's own cache.
  try { const local = window.localStorage.getItem(KEY); if (local) return JSON.parse(local); }
  catch (e) {}
  return null;
}
async function saveRecords(records) {
  const json = JSON.stringify(records);
  // Always keep a local cache so the app works offline and after a reload.
  try { window.localStorage.setItem(KEY, json); } catch (e) {}
  if (supabaseReady()) {
    try { await sbSave(records); return true; }
    catch (e) { console.warn("Supabase save failed, kept local copy", e); }
  }
  if (hasHostStore()) {
    try { return !!(await window.storage.set(KEY, json, SHARED)); }
    catch (e) { /* host store unavailable — localStorage above still persisted it */ }
  }
  return true;
}

const STATUS_META = {
  awaiting: { label: "Awaiting validation", cls: "pending", Icon: Clock },
  pending: { label: "Pending review", cls: "updated", Icon: FileEdit },
  approved: { label: "Approved", cls: "confirmed", Icon: CheckCircle2 },
};
function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.pending;
  return <span className={`badge badge-${m.cls}`}><m.Icon size={13} strokeWidth={2.4} />{m.label}</span>;
}

export default function App() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("validate");
  const [search, setSearch] = useState("");
  const [openGroups, setOpenGroups] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [screen, setScreen] = useState("list");
  const [form, setForm] = useState(null);
  const [affirm, setAffirm] = useState(false);
  const [formErrors, setFormErrors] = useState([]);
  const [lastRef, setLastRef] = useState("");
  const errorSummaryRef = useRef(null);
  const formHeadingRef = useRef(null);
  const errOf = (id) => formErrors.find((e) => e.id === id)?.msg;
  const onRowKey = (fn) => (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } };
  const [dashOpen, setDashOpen] = useState({});
  const [rowOpen, setRowOpen] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editFields, setEditFields] = useState(null);
  const [newName, setNewName] = useState("");
  const [newParent, setNewParent] = useState("");
  const [linkMode, setLinkMode] = useState(false);
  const [pendingSlug, setPendingSlug] = useState(null);
  const [showLinks, setShowLinks] = useState(false);
  const [copiedKey, setCopiedKey] = useState("");
  const [linkSearch, setLinkSearch] = useState("");
  const [dashView, setDashView] = useState("overview"); // overview | review | publish
  const [reviewer, setReviewer] = useState("");
  const [authed, setAuthed] = useState(false);
  const [signForm, setSignForm] = useState({ name: "", code: "" });
  const [signError, setSignError] = useState("");
  const [gh, setGh] = useState({ repo: "govtech-bb/", branch: "main", path: "data/mda-contacts.json", token: "" });
  const [pub, setPub] = useState({ busy: false, step: "", error: "", url: "" });

  useEffect(() => {
    setPendingSlug(getLinkSlug());
    (async () => {
      let data = await loadRecords();
      if (!data) { data = buildSeed(); await saveRecords(data); }
      setRecords(data); setLoading(false);
    })();
  }, []);

  // Move keyboard/screen-reader focus to the form heading when a form opens.
  useEffect(() => {
    if (screen === "form" && formHeadingRef.current) formHeadingRef.current.focus();
  }, [screen, selectedId]);

  // Move focus to the error summary when validation fails.
  useEffect(() => {
    if (formErrors.length && errorSummaryRef.current) errorSummaryRef.current.focus();
  }, [formErrors]);

  const persist = async (next) => { setRecords(next); await saveRecords(next); };
  const ministries = useMemo(() => records.filter((r) => r.kind === "ministry").sort((a, b) => a.name.localeCompare(b.name)), [records]);
  const deptsOf = (mid) => records.filter((r) => r.parentId === mid).sort((a, b) => a.name.localeCompare(b.name));
  const selected = useMemo(() => records.find((r) => r.id === selectedId) || null, [records, selectedId]);
  const parentOf = (rec) => (rec && rec.parentId ? records.find((r) => r.id === rec.parentId) : null);
  const rolesShown = (r) => (r.validatedRoles && r.validatedRoles.length ? r.validatedRoles : (r.roles || []));
  const groupStat = (mid) => {
    const rows = [records.find((r) => r.id === mid), ...deptsOf(mid)].filter(Boolean);
    return { total: rows.length, done: rows.filter((r) => r.status !== "awaiting").length };
  };
  const stats = useMemo(() => {
    const total = records.length;
    const approved = records.filter((r) => r.status === "approved").length;
    const pending = records.filter((r) => r.status === "pending").length;
    const awaiting = total - approved - pending;
    const done = approved + pending;
    return { total, approved, pending, awaiting, done, pct: total ? Math.round((done / total) * 100) : 0 };
  }, [records]);
  const pendingList = useMemo(() => {
    const out = [];
    for (const m of ministries) { for (const r of [m, ...deptsOf(m.id)]) if (r.status === "pending") out.push(r); }
    return out;
  }, [ministries, records]);
  const approvedList = useMemo(() => records.filter((r) => r.status === "approved"), [records]);

  // Stable, collision-safe slug per record (ministries first, then their depts, in display order)
  const slugMap = useMemo(() => {
    const byId = {}; const bySlug = {}; const used = {};
    for (const m of ministries) {
      const rows = [m, ...deptsOf(m.id)];
      for (const r of rows) {
        let base = slugify(r.name) || "org";
        let s = base, n = 2;
        while (used[s]) { s = `${base}-${n++}`; }
        used[s] = true; byId[r.id] = s; bySlug[s] = r.id;
      }
    }
    return { byId, bySlug };
  }, [records, ministries]);
  const slugOf = (rec) => slugMap.byId[rec.id] || slugify(rec.name);
  const linkFor = (rec) => `${baseUrl()}#mda=${slugOf(rec)}`;

  const copyText = async (text, key) => {
    try { await navigator.clipboard.writeText(text); }
    catch (e) {
      try { const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select(); document.execCommand("copy"); document.body.removeChild(t); } catch (e2) {}
    }
    setCopiedKey(key); setTimeout(() => setCopiedKey((k) => (k === key ? "" : k)), 1600);
  };

  // Resolve an incoming validation link once records are loaded
  useEffect(() => {
    if (loading || !pendingSlug || !records.length) return;
    const id = slugMap.bySlug[pendingSlug] ||
      (records.find((r) => slugify(r.name) === pendingSlug) || {}).id;
    const rec = records.find((r) => r.id === id);
    if (rec) { setLinkMode(true); setTab("validate"); openValidation(rec); }
    setPendingSlug(null);
  }, [loading, pendingSlug, records, slugMap]);

  const openValidation = (rec) => {
    setSelectedId(rec.id);
    setForm({
      phone: rec.validatedPhone || rec.currentPhone || "",
      email: rec.validatedEmail || rec.currentEmail || "",
      address: rec.validatedAddress || rec.currentAddress || "",
      roles: (rec.validatedRoles && rec.validatedRoles.length ? rec.validatedRoles : (rec.roles || [])).map((x) => ({ r: x.r, t: x.t })),
      repName: rec.repName || "", repTitle: rec.repTitle || "", repEmail: rec.repEmail || "", notes: rec.notes || "",
      confirm: { phone: false, email: false, address: false, roles: false },
    });
    setAffirm(false); setFormErrors([]); setScreen("form");
  };
  const setRole = (i, k, v) => setForm((f) => ({ ...f, roles: f.roles.map((row, idx) => idx === i ? { ...row, [k]: v } : row) }));
  const addRole = () => setForm((f) => ({ ...f, roles: [...f.roles, { r: "", t: "" }] }));
  const delRole = (i) => setForm((f) => ({ ...f, roles: f.roles.filter((_, idx) => idx !== i) }));

  const submitValidation = async () => {
    if (!selected || !form) return;
    const rolesClean = form.roles.map((x) => ({ r: (x.r || "").trim(), t: (x.t || "").trim() })).filter((x) => x.r || x.t);
    const phoneChanged = form.phone.trim() !== (selected.currentPhone || "").trim();
    const emailChanged = form.email.trim() !== (selected.currentEmail || "").trim();
    const addressChanged = form.address.trim() !== (selected.currentAddress || "").trim();
    const rolesChanged = JSON.stringify(rolesClean) !== JSON.stringify(selected.roles || []);
    // Every detail already on record must be either edited (a correction) or explicitly confirmed correct.
    const need = (has, ch, ok) => has && !ch && !ok;
    // Collect all problems in page order for the error summary (GOV.UK pattern).
    const errs = [];
    if (need((selected.currentPhone || "").trim(), phoneChanged, form.confirm.phone)) errs.push({ id: "field-phone", msg: "Confirm the telephone number is correct, or edit it" });
    if (need((selected.currentEmail || "").trim(), emailChanged, form.confirm.email)) errs.push({ id: "field-email", msg: "Confirm the email address is correct, or edit it" });
    if (need((selected.currentAddress || "").trim(), addressChanged, form.confirm.address)) errs.push({ id: "field-address", msg: "Confirm the physical address is correct, or edit it" });
    if (need((selected.roles || []).length, rolesChanged, form.confirm.roles)) errs.push({ id: "field-roles", msg: "Confirm the roles and numbers are correct, or edit them" });
    if (!form.repName.trim()) errs.push({ id: "rep-name", msg: "Enter your name" });
    if (!form.repTitle.trim()) errs.push({ id: "rep-title", msg: "Enter your title or role" });
    if (!form.repEmail.trim()) errs.push({ id: "rep-email", msg: "Enter your work email address" });
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.repEmail.trim())) errs.push({ id: "rep-email", msg: "Enter an email address in the correct format, like name@agency.gov.bb" });
    if (!affirm) errs.push({ id: "affirm", msg: "Confirm you are authorised to validate this information" });
    if (errs.length) { setFormErrors(errs); return; }
    setFormErrors([]);
    const changed = phoneChanged || emailChanged || addressChanged || rolesChanged;
    const hadOnFile = selected.currentPhone || selected.currentEmail || selected.currentAddress || (selected.roles || []).length;
    const fieldChange = (label, cur, val, ch) => {
      const had = (cur || "").trim(), has = (val || "").trim();
      if (had && ch) return { field: label, action: "corrected", from: cur, to: val };
      if (had && !ch) return { field: label, action: "confirmed" };
      if (!had && has) return { field: label, action: "added", to: val };
      return null;
    };
    const changes = [
      fieldChange("Telephone", selected.currentPhone, form.phone.trim(), phoneChanged),
      fieldChange("Email", selected.currentEmail, form.email.trim(), emailChanged),
      fieldChange("Address", selected.currentAddress, form.address.trim(), addressChanged),
    ].filter(Boolean);
    const hadRoles = (selected.roles || []).length;
    if (hadRoles && rolesChanged) changes.push({ field: "Roles", action: "corrected", from: `${hadRoles} on record`, to: `${rolesClean.length} submitted` });
    else if (hadRoles && !rolesChanged) changes.push({ field: "Roles", action: "confirmed" });
    else if (!hadRoles && rolesClean.length) changes.push({ field: "Roles", action: "added", to: `${rolesClean.length} added` });
    const actor = `${form.repName.trim()}${form.repTitle.trim() ? ", " + form.repTitle.trim() : ""}`;
    const subRef = "MDA-" + Math.random().toString(36).slice(2, 7).toUpperCase();
    const entry = { t: new Date().toISOString(), kind: "submitted", actor, email: form.repEmail.trim(), changes, ref: subRef };
    const next = records.map((r) => r.id === selected.id ? {
      ...r, status: "pending", submissionType: changed || !hadOnFile ? "updated" : "confirmed",
      validatedPhone: form.phone.trim(), validatedEmail: form.email.trim(), validatedAddress: form.address.trim(),
      validatedRoles: rolesClean, repName: form.repName.trim(), repTitle: form.repTitle.trim(),
      repEmail: form.repEmail.trim(), notes: form.notes.trim(), submittedAt: new Date().toISOString(),
      submissionRef: subRef, reviewedAt: null, reviewedBy: "", audit: [...(r.audit || []), entry],
    } : r);
    setLastRef(subRef);
    await persist(next); setScreen("done");
  };

  const auditEntry = (kind, actor, changes) => ({ t: new Date().toISOString(), kind, actor: (actor || "").trim(), ...(changes ? { changes } : {}) });

  // Coordinator review actions
  const approveRecord = async (id, reviewer) => {
    const next = records.map((r) => r.id === id ? {
      ...r, status: "approved",
      currentPhone: r.validatedPhone, currentEmail: r.validatedEmail, currentAddress: r.validatedAddress,
      roles: (r.validatedRoles && r.validatedRoles.length) ? r.validatedRoles : r.roles,
      reviewedAt: new Date().toISOString(), reviewedBy: (reviewer || "").trim(),
      audit: [...(r.audit || []), auditEntry("approved", reviewer)],
    } : r);
    await persist(next);
  };
  const rejectRecord = async (id, reviewer) => {
    const next = records.map((r) => r.id === id ? {
      ...r, status: "awaiting", reviewedAt: new Date().toISOString(),
      audit: [...(r.audit || []), auditEntry("returned", reviewer)],
    } : r);
    await persist(next);
  };
  const approveAll = async (reviewer) => {
    if (!window.confirm("Approve all pending submissions? Their submitted details become the official record.")) return;
    const next = records.map((r) => r.status === "pending" ? {
      ...r, status: "approved",
      currentPhone: r.validatedPhone, currentEmail: r.validatedEmail, currentAddress: r.validatedAddress,
      roles: (r.validatedRoles && r.validatedRoles.length) ? r.validatedRoles : r.roles,
      reviewedAt: new Date().toISOString(), reviewedBy: (reviewer || "").trim(),
      audit: [...(r.audit || []), auditEntry("approved", reviewer)],
    } : r);
    await persist(next);
  };

  const signIn = () => {
    if (!signForm.name.trim()) { setSignError("Please enter your name."); return; }
    if (signForm.code.trim() !== ACCESS_CODE) { setSignError("That access code is not correct."); return; }
    setReviewer(signForm.name.trim()); setAuthed(true); setSignError(""); setSignForm({ name: "", code: "" });
  };
  const signOut = () => { setAuthed(false); setReviewer(""); setDashView("overview"); };

  const addRecord = async () => {
    const name = newName.trim(); if (!name) return;
    const base = { id: newId(), name, currentPhone: "", currentEmail: "", currentAddress: "", roles: [], ...valDefaults() };
    const rec = newParent ? { ...base, kind: "department", parentId: newParent } : { ...base, kind: "ministry", parentId: null };
    await persist([...records, rec]); setNewName("");
  };
  const removeRecord = async (id) => {
    const isMinistry = records.find((r) => r.id === id)?.kind === "ministry";
    if (!window.confirm(isMinistry ? "Remove this ministry and all of its departments?" : "Remove this organisation?")) return;
    await persist(records.filter((r) => r.id !== id && r.parentId !== id));
    if (rowOpen === id) setRowOpen(null);
  };
  const startEdit = (rec) => { setEditId(rec.id); setEditFields({ name: rec.name, currentPhone: rec.currentPhone, currentEmail: rec.currentEmail, currentAddress: rec.currentAddress }); };
  const saveEdit = async () => {
    const r0 = records.find((r) => r.id === editId);
    const ch = [];
    if (r0) {
      const cmp = (label, a, b) => { if ((a || "").trim() !== (b || "").trim()) ch.push({ field: label, action: "corrected", from: a, to: b }); };
      cmp("Name", r0.name, editFields.name);
      cmp("Telephone", r0.currentPhone, editFields.currentPhone);
      cmp("Email", r0.currentEmail, editFields.currentEmail);
      cmp("Address", r0.currentAddress, editFields.currentAddress);
    }
    await persist(records.map((r) => r.id === editId ? { ...r, ...editFields, audit: ch.length ? [...(r.audit || []), auditEntry("edited", reviewer, ch)] : (r.audit || []) } : r));
    setEditId(null); setEditFields(null);
  };
  const resetAll = async () => {
    if (!window.confirm("Reset everything to the imported ministry and department list? This clears every validation.")) return;
    await persist(buildSeed()); setRowOpen(null); setDashOpen({});
  };
  const exportCsv = () => {
    const head = ["Type", "Parent Ministry", "Organisation", "Status", "Submission", "Official Phone", "Official Email", "Official Address", "Submitted Phone", "Submitted Email", "Submitted Address", "Roles", "Validated By", "Title", "Contact Email", "Submitted At", "Reviewed By", "Reviewed At", "Notes", "Audit Trail"];
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const auditStr = (a) => (a || []).map((e) => {
      const k = { submitted: "submitted", approved: "approved", returned: "sent back", edited: "on-file edited" }[e.kind] || e.kind;
      const base = `${new Date(e.t).toLocaleString()} ${k}${e.actor ? ` by ${e.actor}` : ""}`;
      const ch = (e.changes || []).map((c) => c.action === "corrected" ? `${c.field} corrected (${c.from || "—"} → ${c.to || "—"})` : `${c.field} ${c.action}`).join("; ");
      return ch ? `${base}: ${ch}` : base;
    }).join(" | ");
    const rows = records.map((r) => {
      const parent = r.parentId ? (records.find((p) => p.id === r.parentId)?.name || "") : "";
      const roleStr = rolesShown(r).map((x) => `${x.r}: ${x.t}`).join("; ");
      return [r.kind, parent, r.name, STATUS_META[r.status]?.label || r.status, r.submissionType, r.currentPhone, r.currentEmail, r.currentAddress, r.validatedPhone, r.validatedEmail, r.validatedAddress, roleStr, r.repName, r.repTitle, r.repEmail, r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "", r.reviewedBy, r.reviewedAt ? new Date(r.reviewedAt).toLocaleString() : "", r.notes, auditStr(r.audit)].map(esc).join(",");
    });
    const url = URL.createObjectURL(new Blob([[head.map(esc).join(",")].concat(rows).join("\n")], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "mda-validation-results.csv"; a.click(); URL.revokeObjectURL(url);
  };
  const orderedRecords = useMemo(() => {
    const out = [];
    for (const m of ministries) { out.push(m); for (const d of deptsOf(m.id)) out.push(d); }
    return out;
  }, [ministries, records]);
  const exportLinksCsv = () => {
    const head = ["Type", "Parent Ministry", "Organisation", "On-file Email", "Validation Link"];
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = orderedRecords.map((r) => {
      const parent = r.parentId ? (records.find((p) => p.id === r.parentId)?.name || "") : "";
      return [r.kind, parent, r.name, r.currentEmail, linkFor(r)].map(esc).join(",");
    });
    const url = URL.createObjectURL(new Blob([[head.map(esc).join(",")].concat(rows).join("\n")], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "mda-validation-links.csv"; a.click(); URL.revokeObjectURL(url);
  };
  const copyAllLinks = () => copyText(orderedRecords.map((r) => `${r.name}: ${linkFor(r)}`).join("\n"), "all");
  const fmtDate = (iso) => iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

  // ---- Publish: build the official directory and open a pull request ----
  const buildDirectory = () => ({
    source: "MDA Contact Information Validation Portal",
    generatedAt: new Date().toISOString(),
    ministries: ministries.map((m) => ({
      name: m.name, telephone: m.currentPhone, email: m.currentEmail, address: m.currentAddress,
      roles: (m.roles || []).map((x) => ({ role: x.r, telephone: x.t })),
      departments: deptsOf(m.id).map((d) => ({
        name: d.name, telephone: d.currentPhone, email: d.currentEmail, address: d.currentAddress,
        roles: (d.roles || []).map((x) => ({ role: x.r, telephone: x.t })),
      })),
    })),
  });
  const directoryJson = () => JSON.stringify(buildDirectory(), null, 2) + "\n";
  const prBody = () => {
    const recent = approvedList.filter((r) => r.reviewedAt).sort((a, b) => (b.reviewedAt || "").localeCompare(a.reviewedAt || ""));
    const lines = recent.map((r) => {
      const parent = r.parentId ? ` (under ${records.find((p) => p.id === r.parentId)?.name})` : "";
      return `| ${r.name}${parent} | ${r.currentPhone || "—"} | ${r.currentEmail || "—"} | ${r.reviewedBy || "—"} |`;
    });
    return [
      "Automated update of validated MDA contact information from the validation portal.",
      "", `Approved entries: **${recent.length}** of ${stats.total} organisations.`, "",
      "| Organisation | Telephone | Email | Reviewed by |", "| --- | --- | --- | --- |",
      ...lines, "", "_Generated by the MDA Contact Information Validation Portal._",
    ].join("\n");
  };
  const downloadDirectory = () => {
    const url = URL.createObjectURL(new Blob([directoryJson()], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "mda-contacts.json"; a.click(); URL.revokeObjectURL(url);
  };
  const utf8ToB64 = (str) => btoa(unescape(encodeURIComponent(str)));

  const createPullRequest = async () => {
    const repo = gh.repo.trim().replace(/^https?:\/\/github\.com\//, "").replace(/\/$/, "");
    if (!/^[^/]+\/[^/]+$/.test(repo)) { setPub({ busy: false, step: "", error: "Enter the repository as owner/name (e.g. govtech-bb/mda-directory).", url: "" }); return; }
    if (!gh.token.trim()) { setPub({ busy: false, step: "", error: "A GitHub access token with repo permission is required to open a pull request.", url: "" }); return; }
    const base = gh.branch.trim() || "main";
    const path = gh.path.trim().replace(/^\/+/, "");
    const branch = `mda-contacts-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}`;
    const api = `https://api.github.com/repos/${repo}`;
    const headers = { Authorization: `Bearer ${gh.token.trim()}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" };
    const j = async (res) => { const d = await res.json().catch(() => ({})); if (!res.ok) throw new Error(d.message || `GitHub API error (${res.status})`); return d; };
    try {
      setPub({ busy: true, step: "Reading base branch…", error: "", url: "" });
      const ref = await j(await fetch(`${api}/git/ref/heads/${encodeURIComponent(base)}`, { headers }));
      const baseSha = ref.object.sha;
      setPub({ busy: true, step: "Creating branch…", error: "", url: "" });
      await j(await fetch(`${api}/git/refs`, { method: "POST", headers, body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha }) }));
      let existingSha;
      try { const ex = await j(await fetch(`${api}/contents/${encodeURIComponent(path)}?ref=${branch}`, { headers })); existingSha = ex.sha; } catch (e) {}
      setPub({ busy: true, step: "Committing directory…", error: "", url: "" });
      await j(await fetch(`${api}/contents/${encodeURIComponent(path)}`, {
        method: "PUT", headers,
        body: JSON.stringify({ message: "Update MDA contact directory from validation portal", content: utf8ToB64(directoryJson()), branch, ...(existingSha ? { sha: existingSha } : {}) }),
      }));
      setPub({ busy: true, step: "Opening pull request…", error: "", url: "" });
      const pr = await j(await fetch(`${api}/pulls`, {
        method: "POST", headers,
        body: JSON.stringify({ title: "Update MDA contact directory", head: branch, base, body: prBody() }),
      }));
      setPub({ busy: false, step: "", error: "", url: pr.html_url });
    } catch (e) {
      setPub({ busy: false, step: "", error: e.message || "Could not create the pull request.", url: "" });
    }
  };

  const q = search.trim().toLowerCase();
  const visibleGroups = useMemo(() => ministries.map((m) => {
    const depts = deptsOf(m.id);
    const ministryMatches = !q || m.name.toLowerCase().includes(q);
    let showDepts, showMinistryRow, show;
    if (!q) { showDepts = depts; showMinistryRow = true; show = true; }
    else if (ministryMatches) { showDepts = depts; showMinistryRow = true; show = true; }
    else { showDepts = depts.filter((d) => d.name.toLowerCase().includes(q)); showMinistryRow = false; show = showDepts.length > 0; }
    return { ministry: m, depts: showDepts, showMinistryRow, show };
  }).filter((g) => g.show), [ministries, records, q]);

  return (
    <div className="root">
      <style>{CSS}</style>
      <div className="gov-banner">
        <div className="gov-banner-inner">
          <span>Official website of the Government of Barbados</span>
        </div>
      </div>
      <header className="gov-hdr">
        <div className="gov-hdr-inner">
          <span className="gov-hdr-word">Government of Barbados</span>
        </div>
      </header>
      <div className="status-banner" role="status">
        <div className="status-inner">
          <span className="status-tag">Alpha</span>
          <span>This is a new service. Your feedback will help us improve it.</span>
        </div>
      </div>
      <div className="service-hdr">
        <div className="service-hdr-inner">
          <h1>MDA Contact Information Validation Portal</h1>
          <p>Check that the published contact details and key role numbers for your Ministry, Department or Agency (MDA) are correct. GovTech Barbados keeps this record so the public can reach the right office through gov.bb.</p>
        </div>
      </div>

      <main className="main">
        {loading ? (
          <div className="loading"><div className="spinner" />Loading records…</div>
        ) : tab === "validate" ? (
          screen === "list" ? (
            <section className="fade">
              <div className="intro"><h2>Find your organisation</h2><p>Open your ministry, then choose the ministry itself or the department you represent.</p></div>
              <label htmlFor="mda-search" className="sr-only">Search ministries or departments</label>
              <div className="searchbar">
                <input id="mda-search" type="search" placeholder="Search ministries or departments…" value={search} onChange={(e) => setSearch(e.target.value)} />
                {search && <button className="clear" onClick={() => setSearch("")} aria-label="Clear search">Clear</button>}
              </div>
              {visibleGroups.length === 0 ? <div className="empty">No organisations match your search.</div> : (
                <ul className="groups">
                  {visibleGroups.map((g, i) => {
                    const gs = groupStat(g.ministry.id);
                    const isOpen = !!q || openGroups[g.ministry.id];
                    return (
                      <li key={g.ministry.id} className="group" style={{ animationDelay: `${i * 35}ms` }}>
                        <button className="group-head" aria-expanded={isOpen} onClick={() => !q && setOpenGroups((o) => ({ ...o, [g.ministry.id]: !o[g.ministry.id] }))}>
                          <ChevronRight size={16} className={`chev${isOpen ? " rot" : ""}`} />
                          <Landmark size={18} className="group-ic" />
                          <span className="group-name">{g.ministry.name}</span>
                          <span className={`rollup${gs.done === gs.total ? " full" : ""}`}>{gs.done}/{gs.total}</span>
                        </button>
                        {isOpen && (
                          <ul className="rowlist">
                            {g.showMinistryRow && (
                              <li className="vrow ministry" role="button" tabIndex={0} aria-label={`Validate ${g.ministry.name} — head office`} onKeyDown={onRowKey(() => openValidation(g.ministry))} onClick={() => openValidation(g.ministry)}>
                                <div className="vrow-body"><span className="vrow-name">{g.ministry.name}</span><span className="kindtag">Ministry — head office</span></div>
                                <StatusBadge status={g.ministry.status} /><ChevronRight size={16} className="vrow-go" />
                              </li>
                            )}
                            {g.depts.map((d) => (
                              <li key={d.id} className="vrow dept" role="button" tabIndex={0} aria-label={`Validate ${d.name}`} onKeyDown={onRowKey(() => openValidation(d))} onClick={() => openValidation(d)}>
                                <CornerDownRight size={15} className="dept-ic" />
                                <div className="vrow-body"><span className="vrow-name">{d.name}</span>{(d.currentPhone || d.currentEmail) ? null : <span className="needstag">Needs details</span>}</div>
                                <StatusBadge status={d.status} /><ChevronRight size={16} className="vrow-go" />
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ) : screen === "form" && selected && form ? (
            <section className="fade form-wrap">
              {linkMode
                ? <div className="link-banner"><ShieldCheck size={15} /> You're validating the record for your organisation. Please review and submit.</div>
                : <button className="back" onClick={() => setScreen("list")}><ChevronLeft size={16} /> All organisations</button>}
              <div className="form-head">
                <div><h2 ref={formHeadingRef} tabIndex={-1}>{selected.name}</h2>
                  <div className="form-sub">
                    {selected.kind === "ministry" ? <span className="kindtag">Ministry — head office</span> : <span className="kindtag">Department under {parentOf(selected)?.name}</span>}
                    <StatusBadge status={selected.status} />
                  </div>
                </div>
              </div>
              {formErrors.length > 0 && (
                <div className="error-summary" role="alert" tabIndex={-1} ref={errorSummaryRef} aria-labelledby="error-summary-title">
                  <h2 className="error-summary-title" id="error-summary-title">There is a problem</h2>
                  <ul className="error-summary-list">
                    {formErrors.map((e) => (
                      <li key={e.id}><a href={`#${e.id}`} onClick={(ev) => { ev.preventDefault(); const el = document.getElementById(e.id); if (el) { el.scrollIntoView({ block: "center" }); el.focus(); } }}>{e.msg}</a></li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="form-lead">Please check each detail below. GovTech Barbados publishes these so the public can reach your office through gov.bb — confirm anything that is correct, and edit anything that is wrong.</p>
              <div className="fields">
                <Field id="field-phone" label="Main telephone number" type="tel" inputmode="tel" error={errOf("field-phone")} onfile={selected.currentPhone} value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="e.g. (246) 555-0100" confirmed={form.confirm.phone} onConfirm={(c) => setForm((f) => ({ ...f, confirm: { ...f.confirm, phone: c } }))} />
                <Field id="field-email" label="Email address" type="email" inputmode="email" error={errOf("field-email")} onfile={selected.currentEmail} value={form.email} onChange={(v) => setForm({ ...form, email: v })} placeholder="e.g. info@agency.gov.bb" confirmed={form.confirm.email} onConfirm={(c) => setForm((f) => ({ ...f, confirm: { ...f.confirm, email: c } }))} />
                <Field id="field-address" label="Physical address" textarea error={errOf("field-address")} onfile={selected.currentAddress} value={form.address} onChange={(v) => setForm({ ...form, address: v })} placeholder="Building, street, city, parish" confirmed={form.confirm.address} onConfirm={(c) => setForm((f) => ({ ...f, confirm: { ...f.confirm, address: c } }))} />
              </div>

              <div className="rep-block" id="field-roles" tabIndex={-1}>
                <h3>Key contacts and role numbers</h3>
                <p className="roles-hint">Confirm these direct lines, correct any that have changed, and add or remove rows as needed.</p>
                {errOf("field-roles") && <p className="field-err"><span className="sr-only">Error: </span>{errOf("field-roles")}</p>}
                <div className="roles-edit">
                  {form.roles.length === 0 && <p className="roles-empty">None on record yet — add any direct lines you'd like listed.</p>}
                  {form.roles.map((row, i) => (
                    <div className="role-row" key={i}>
                      <input className="role-r" value={row.r} placeholder="Role / office" onChange={(e) => setRole(i, "r", e.target.value)} />
                      <input className="role-t" value={row.t} placeholder="Telephone" onChange={(e) => setRole(i, "t", e.target.value)} />
                      <button className="role-del" onClick={() => delRole(i)} title="Remove">Remove</button>
                    </div>
                  ))}
                  <button className="role-add" onClick={addRole}><Plus size={14} /> Add a role</button>
                </div>
                {(selected.roles || []).length > 0 && (() => {
                  const cleanNow = form.roles.map((x) => ({ r: (x.r || "").trim(), t: (x.t || "").trim() })).filter((x) => x.r || x.t);
                  const changedNow = JSON.stringify(cleanNow) !== JSON.stringify(selected.roles || []);
                  return changedNow
                    ? <div className="field-changed"><PencilLine size={13} /> You've edited the roles — they'll be submitted as a correction.</div>
                    : <label className={`confirm-field${form.confirm.roles ? " on" : ""}`}><input type="checkbox" checked={!!form.confirm.roles} onChange={(e) => setForm((f) => ({ ...f, confirm: { ...f.confirm, roles: e.target.checked } }))} /><span>I've checked the roles and numbers above and confirm they are correct</span></label>;
                })()}
              </div>

              <div className="rep-block">
                <h3>Your details</h3>
                <p className="roles-hint">So we know who checked this record. We may contact you if we have a question about your update.</p>
                <div className="rep-grid">
                  <div className="lbl">
                    <label htmlFor="rep-name">Your name</label>
                    {errOf("rep-name") && <p className="field-err" id="rep-name-error"><span className="sr-only">Error: </span>{errOf("rep-name")}</p>}
                    <input id="rep-name" autoComplete="name" aria-invalid={errOf("rep-name") ? true : undefined} aria-describedby={errOf("rep-name") ? "rep-name-error" : undefined} value={form.repName} onChange={(e) => setForm({ ...form, repName: e.target.value })} placeholder="Full name" />
                  </div>
                  <div className="lbl">
                    <label htmlFor="rep-title">Title or role</label>
                    {errOf("rep-title") && <p className="field-err" id="rep-title-error"><span className="sr-only">Error: </span>{errOf("rep-title")}</p>}
                    <input id="rep-title" autoComplete="organization-title" aria-invalid={errOf("rep-title") ? true : undefined} aria-describedby={errOf("rep-title") ? "rep-title-error" : undefined} value={form.repTitle} onChange={(e) => setForm({ ...form, repTitle: e.target.value })} placeholder="e.g. Administrative Officer" />
                  </div>
                  <div className="lbl wide">
                    <label htmlFor="rep-email">Your work email</label>
                    {errOf("rep-email") && <p className="field-err" id="rep-email-error"><span className="sr-only">Error: </span>{errOf("rep-email")}</p>}
                    <input id="rep-email" type="email" inputMode="email" autoComplete="email" aria-invalid={errOf("rep-email") ? true : undefined} aria-describedby={errOf("rep-email") ? "rep-email-error" : undefined} value={form.repEmail} onChange={(e) => setForm({ ...form, repEmail: e.target.value })} placeholder="name@agency.gov.bb" />
                  </div>
                  <div className="lbl wide">
                    <label htmlFor="rep-notes">Notes (optional)</label>
                    <textarea id="rep-notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Anything else we should know" />
                  </div>
                </div>
              </div>

              <div className="affirm-wrap">
                {errOf("affirm") && <p className="field-err" id="affirm-error"><span className="sr-only">Error: </span>{errOf("affirm")}</p>}
                <label className="affirm"><input id="affirm" type="checkbox" checked={affirm} aria-invalid={errOf("affirm") ? true : undefined} aria-describedby={errOf("affirm") ? "affirm-error" : undefined} onChange={(e) => setAffirm(e.target.checked)} /><span>I confirm I am authorised to validate this information on behalf of this organisation, and that the details above are accurate.</span></label>
              </div>
              <div className="actions">{!linkMode && <button className="btn ghost" onClick={() => setScreen("list")}>Cancel</button>}<button className="btn primary" onClick={submitValidation}>Submit validation</button></div>
            </section>
          ) : screen === "done" && selected ? (
            <section className="fade done">
              <div className="confirm-panel">
                <h2 ref={formHeadingRef} tabIndex={-1}>Submitted for review</h2>
                {lastRef && <p className="confirm-ref">Your reference<br /><strong>{lastRef}</strong></p>}
              </div>
              <p>Thank you. The details for <strong>{selected.name}</strong> have been submitted and are now <strong>pending review</strong> by the GovTech Barbados team before the public record is updated.</p>
              <p className="done-next">Please keep your reference number in case you need to follow up. We may email you if we have a question about your update.</p>
              <div className="done-actions">{linkMode
                ? <p className="done-close">You may now close this page.</p>
                : <button className="btn primary" onClick={() => { setScreen("list"); setSearch(""); }}>Validate another organisation</button>}</div>
            </section>
          ) : null
        ) : !authed ? (
          <section className="fade signin-wrap">
            <div className="signin-card">
              <div className="signin-ic"><Lock size={22} /></div>
              <h2>Coordinator sign-in</h2>
              <p>This area is for the coordinating team — to review submissions and publish approved changes. Please sign in to continue.</p>
              <label className="lbl"><span>Your name<i>*</i></span><input value={signForm.name} onChange={(e) => setSignForm({ ...signForm, name: e.target.value })} placeholder="Full name" onKeyDown={(e) => e.key === "Enter" && signIn()} /></label>
              <label className="lbl"><span>Access code<i>*</i></span><input type="password" value={signForm.code} onChange={(e) => setSignForm({ ...signForm, code: e.target.value })} placeholder="Team access code" onKeyDown={(e) => e.key === "Enter" && signIn()} /></label>
              {signError && <div className="error"><Info size={15} /> {signError}</div>}
              <button className="btn primary signin-btn" onClick={signIn}><Lock size={16} /> Sign in</button>
              <p className="signin-note"><Info size={13} /> This is a lightweight gate to keep the review area separate from representatives; it isn't a substitute for account-level security.</p>
            </div>
          </section>
        ) : (
          <section className="fade">
            <div className="dash-head">
              <div><h2>Coordinator Dashboard</h2><p>Track responses, review submissions, and publish approved changes.</p></div>
              <div className="dash-tools"><span className="signed-as"><Users size={14} /> {reviewer}</span><button className="btn ghost sm" onClick={exportCsv}><Download size={15} /> Export CSV</button><button className="btn ghost sm danger" onClick={resetAll}><RotateCcw size={15} /> Reset</button><button className="btn ghost sm" onClick={signOut}><LogOut size={15} /> Sign out</button></div>
            </div>
            <nav className="subtabs">
              <button className={dashView === "overview" ? "subtab on" : "subtab"} onClick={() => setDashView("overview")}>Overview</button>
              <button className={dashView === "review" ? "subtab on" : "subtab"} onClick={() => setDashView("review")}>Pending review{pendingList.length ? <span className="pill">{pendingList.length}</span> : null}</button>
              <button className={dashView === "publish" ? "subtab on" : "subtab"} onClick={() => setDashView("publish")}>Publish changes</button>
            </nav>

            {dashView === "overview" && <div className="dash-view fade">
            <div className="overview-tools"><button className={showLinks ? "btn primary sm" : "btn ghost sm"} onClick={() => setShowLinks((v) => !v)}><Link2 size={15} /> Validation links</button></div>

            {showLinks && (() => {
              const lq = linkSearch.trim().toLowerCase();
              const list = orderedRecords.filter((r) => !lq || r.name.toLowerCase().includes(lq));
              return (
                <div className="links-panel">
                  <div className="links-intro">
                    <p><strong>One link per organisation.</strong> Each opens straight to that body's validation form. Send each MDA only its own link.</p>
                    <p className="links-base"><Info size={13} /> Links use this portal's address: <code>{baseUrl() || "(unavailable)"}</code> — share or publish the portal at a stable web address, then the links resolve there.</p>
                  </div>
                  <div className="links-tools">
                    <button className="btn ghost sm" onClick={copyAllLinks}>{copiedKey === "all" ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy all</>}</button>
                    <button className="btn ghost sm" onClick={exportLinksCsv}><Download size={14} /> Download links (CSV)</button>
                    <div className="links-search"><Search size={15} /><input placeholder="Filter…" value={linkSearch} onChange={(e) => setLinkSearch(e.target.value)} />{linkSearch && <button className="clear" onClick={() => setLinkSearch("")}>Clear</button>}</div>
                  </div>
                  <ul className="links-list">
                    {list.map((r) => (
                      <li key={r.id} className={`link-item${r.kind === "department" ? " is-dept" : ""}`}>
                        <div className="link-meta">
                          {r.kind === "department" ? <CornerDownRight size={13} className="dept-ic" /> : <Landmark size={14} className="link-min-ic" />}
                          <span className="link-name">{r.name}</span>
                        </div>
                        <code className="link-url">{linkFor(r)}</code>
                        <button className="btn ghost sm link-copy" onClick={() => copyText(linkFor(r), r.id)}>{copiedKey === r.id ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}</button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}

            <div className="progress-wrap"><div className="progress-row"><span>{stats.done} of {stats.total} responded</span><span>{stats.pct}%</span></div><div className="progress"><div className="progress-fill" style={{ width: `${stats.pct}%` }} /></div></div>
            <div className="stat-grid"><Stat n={stats.awaiting} label="Awaiting" cls="pending" /><Stat n={stats.pending} label="Pending review" cls="updated" /><Stat n={stats.approved} label="Approved" cls="confirmed" /><Stat n={stats.total} label="Total bodies" cls="total" /></div>
            <div className="add-row">
              <input placeholder="Add a ministry or department name…" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addRecord()} />
              <select value={newParent} onChange={(e) => setNewParent(e.target.value)}><option value="">As a ministry</option>{ministries.map((m) => <option key={m.id} value={m.id}>Under: {m.name}</option>)}</select>
              <button className="btn primary sm" onClick={addRecord}><Plus size={15} /> Add</button>
            </div>
            <div className="rows">
              {ministries.map((m) => {
                const gs = groupStat(m.id); const open = !!dashOpen[m.id]; const rows = [m, ...deptsOf(m.id)];
                return (
                  <div key={m.id} className="dgroup">
                    <button className="dgroup-head" onClick={() => setDashOpen((o) => ({ ...o, [m.id]: !o[m.id] }))}>
                      <ChevronRight size={16} className={open ? "rot" : ""} /><Landmark size={17} /><span className="dgroup-name">{m.name}</span><span className={`rollup${gs.done === gs.total ? " full" : ""}`}>{gs.done}/{gs.total}</span>
                    </button>
                    {open && (
                      <div className="dgroup-body">
                        {rows.map((r) => (
                          <div key={r.id} className={`drow${r.kind === "department" ? " is-dept" : ""}`}>
                            <div className="drow-main" onClick={() => setRowOpen(rowOpen === r.id ? null : r.id)}>
                              <div className="drow-name">{r.kind === "department" ? <CornerDownRight size={14} className="dept-ic" /> : <span className="hometag">Head office</span>}<span>{r.name}</span></div>
                              <StatusBadge status={r.status} />
                            </div>
                            {rowOpen === r.id && (
                              <div className="drow-detail">
                                {editId === r.id ? (
                                  <div className="edit-grid">
                                    <label className="lbl wide"><span>Name</span><input value={editFields.name} onChange={(e) => setEditFields({ ...editFields, name: e.target.value })} /></label>
                                    <label className="lbl"><span>On-file phone</span><input value={editFields.currentPhone} onChange={(e) => setEditFields({ ...editFields, currentPhone: e.target.value })} /></label>
                                    <label className="lbl"><span>On-file email</span><input value={editFields.currentEmail} onChange={(e) => setEditFields({ ...editFields, currentEmail: e.target.value })} /></label>
                                    <label className="lbl wide"><span>On-file address</span><textarea rows={2} value={editFields.currentAddress} onChange={(e) => setEditFields({ ...editFields, currentAddress: e.target.value })} /></label>
                                    <div className="edit-actions"><button className="btn ghost sm" onClick={() => { setEditId(null); setEditFields(null); }}>Cancel</button><button className="btn primary sm" onClick={saveEdit}><Check size={14} /> Save</button></div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="compare">
                                      <CompareCol title="Official record" phone={r.currentPhone} email={r.currentEmail} address={r.currentAddress} />
                                      <CompareCol title="Last submitted" phone={r.validatedPhone} email={r.validatedEmail} address={r.validatedAddress} highlight={r.submissionType === "updated"} />
                                    </div>
                                    {rolesShown(r).length > 0 && (
                                      <div className="roles-ref">
                                        <div className="cmp-title">{r.validatedRoles && r.validatedRoles.length ? "Roles (submitted)" : "Roles on record"}</div>
                                        <div className="role-chips">{rolesShown(r).map((x, i) => <span key={i} className="role-chip"><b>{x.r}</b>{x.t ? ` · ${x.t}` : ""}</span>)}</div>
                                      </div>
                                    )}
                                    <div className="meta"><span>{r.repName ? `Submitted by ${r.repName}${r.repTitle ? `, ${r.repTitle}` : ""}` : "No submission yet"}{r.reviewedBy ? ` · reviewed by ${r.reviewedBy}` : ""}</span><span>{r.submittedAt ? fmtDate(r.submittedAt) : ""}</span></div>
                                    {r.notes && <div className="meta-notes">“{r.notes}”</div>}
                                    <AuditTrail entries={r.audit} />
                                    <div className="drow-tools"><button className="btn ghost sm" onClick={() => copyText(linkFor(r), "row-" + r.id)}>{copiedKey === "row-" + r.id ? <><Check size={14} /> Link copied</> : <><Link2 size={14} /> Copy link</>}</button><button className="btn ghost sm" onClick={() => startEdit(r)}><PencilLine size={14} /> Edit on-file details</button><button className="btn ghost sm danger" onClick={() => removeRecord(r.id)}><Trash2 size={14} /> Remove</button></div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="privacy"><Info size={13} /> Submitted details are saved to a shared record visible to everyone who opens this portal.</p>
            </div>}

            {dashView === "review" && <div className="dash-view fade">
              <div className="review-head">
                <p>{pendingList.length === 0 ? "No submissions are awaiting review." : `${pendingList.length} submission${pendingList.length === 1 ? "" : "s"} awaiting review. Approving promotes the submitted details to the official record, ready to publish.`}</p>
                {pendingList.length > 0 && (
                  <div className="review-tools">
                    <span className="signed-as"><Users size={14} /> Reviewing as {reviewer}</span>
                    <button className="btn ghost sm" onClick={() => approveAll(reviewer)}><CheckCircle2 size={14} /> Approve all</button>
                  </div>
                )}
              </div>
              {pendingList.length === 0 ? <div className="empty">When representatives submit their details, they'll appear here for review.</div> : (
                <ul className="review-list">
                  {pendingList.map((r) => {
                    const parent = r.parentId ? records.find((p) => p.id === r.parentId)?.name : null;
                    const diff = (a, b) => (a || "").trim() !== (b || "").trim();
                    const changes = [diff(r.currentPhone, r.validatedPhone) && "telephone", diff(r.currentEmail, r.validatedEmail) && "email", diff(r.currentAddress, r.validatedAddress) && "address"].filter(Boolean);
                    return (
                      <li key={r.id} className="review-card">
                        <div className="review-card-head">
                          <div><div className="review-name">{r.name}</div><div className="review-sub">{parent ? `Department under ${parent}` : "Ministry — head office"} · submitted {fmtDate(r.submittedAt)}{r.repName ? ` by ${r.repName}${r.repTitle ? `, ${r.repTitle}` : ""}` : ""}</div></div>
                          <span className={`badge badge-${r.submissionType === "updated" ? "updated" : "confirmed"}`}>{r.submissionType === "updated" ? <><FileEdit size={13} /> Changes proposed</> : <><Check size={13} /> Confirmed unchanged</>}</span>
                        </div>
                        <div className="compare">
                          <CompareCol title="Current official" phone={r.currentPhone} email={r.currentEmail} address={r.currentAddress} />
                          <CompareCol title="Submitted" phone={r.validatedPhone} email={r.validatedEmail} address={r.validatedAddress} highlight={r.submissionType === "updated"} />
                        </div>
                        {changes.length > 0 && <div className="change-hints">Changed: {changes.join(", ")}</div>}
                        {r.validatedRoles && r.validatedRoles.length > 0 && (
                          <div className="roles-ref"><div className="cmp-title">Submitted roles</div><div className="role-chips">{r.validatedRoles.map((x, i) => <span key={i} className="role-chip"><b>{x.r}</b>{x.t ? ` · ${x.t}` : ""}</span>)}</div></div>
                        )}
                        {r.repEmail && <div className="review-contact">Reply-to: {r.repEmail}</div>}
                        {r.notes && <div className="meta-notes">“{r.notes}”</div>}
                        <AuditTrail entries={r.audit} />
                        <div className="review-actions">
                          <button className="btn primary sm" onClick={() => approveRecord(r.id, reviewer)}><Check size={15} /> Approve</button>
                          <button className="btn ghost sm danger" onClick={() => rejectRecord(r.id, reviewer)}><X size={15} /> Send back</button>
                          <button className="btn ghost sm" onClick={() => { setLinkMode(false); setTab("validate"); openValidation(r); }}><PencilLine size={14} /> Edit corrections</button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>}

            {dashView === "publish" && <div className="dash-view fade">
              <div className="publish-summary">
                <div className="ps-stat"><div className="ps-n approved">{stats.approved}</div><div className="ps-l">Approved</div></div>
                <div className="ps-stat"><div className="ps-n pending">{stats.pending}</div><div className="ps-l">Pending review</div></div>
                <div className="ps-stat"><div className="ps-n">{stats.awaiting}</div><div className="ps-l">Awaiting</div></div>
              </div>
              {stats.pending > 0 && <div className="note"><Info size={15} /> {stats.pending} submission{stats.pending === 1 ? "" : "s"} still awaiting review. You can publish now, but reviewing them first keeps the directory complete.</div>}
              <p className="publish-lead">Open a pull request that updates the contact directory file in your repository. Developers review the PR and merge it to push the changes live. The file written is <code>{gh.path || "data/mda-contacts.json"}</code>, containing every ministry and department with its current official details.</p>
              <div className="gh-grid">
                <label className="lbl"><span>Repository (owner/name)</span><input value={gh.repo} onChange={(e) => setGh({ ...gh, repo: e.target.value })} placeholder="govtech-bb/mda-directory" /></label>
                <label className="lbl"><span>Base branch</span><input value={gh.branch} onChange={(e) => setGh({ ...gh, branch: e.target.value })} placeholder="main" /></label>
                <label className="lbl wide"><span>File path in repository</span><input value={gh.path} onChange={(e) => setGh({ ...gh, path: e.target.value })} placeholder="data/mda-contacts.json" /></label>
                <label className="lbl wide"><span>GitHub access token (with repo / contents &amp; pull-request permission)</span><input type="password" value={gh.token} onChange={(e) => setGh({ ...gh, token: e.target.value })} placeholder="ghp_… or fine-grained token" /></label>
              </div>
              <p className="gh-note"><Info size={13} /> The token is used only in your browser to talk to GitHub and is never saved to storage or shared with anyone.</p>
              <div className="publish-actions">
                <button className="btn primary" disabled={pub.busy} onClick={createPullRequest}>{pub.busy ? <><span className="mini-spin" /> {pub.step || "Working…"}</> : <><Link2 size={16} /> Create pull request</>}</button>
                <button className="btn ghost" onClick={downloadDirectory}><Download size={15} /> Download data file</button>
              </div>
              {pub.error && <div className="error"><Info size={15} /> {pub.error}</div>}
              {pub.url && <div className="pr-ok"><CheckCircle2 size={16} /> Pull request opened. <a href={pub.url} target="_blank" rel="noreferrer">View it on GitHub →</a></div>}
              <details className="publish-fallback">
                <summary>No token? Create the pull request manually</summary>
                <ol>
                  <li>Click <strong>Download data file</strong> above to save <code>mda-contacts.json</code>.</li>
                  <li>In your repository, create a new branch and add or replace <code>{gh.path || "data/mda-contacts.json"}</code> with that file.</li>
                  <li>Open a pull request from that branch for the developers to review and merge.</li>
                </ol>
              </details>
            </div>}
          </section>
        )}
      </main>
      <footer className="gov-footer">
        <div className="gov-footer-inner">
          <nav className="gov-footer-nav" aria-label="Footer">
            <a href="#" onClick={(e) => e.preventDefault()}>Home</a>
            <a href="#" onClick={(e) => e.preventDefault()}>Privacy</a>
            <a href="#" onClick={(e) => e.preventDefault()}>Terms &amp; Conditions</a>
            <a href="#" onClick={(e) => e.preventDefault()}>Accessibility</a>
          </nav>
          <hr className="gov-footer-divider" aria-hidden />
          <div className="gov-footer-end">
            <p className="gov-footer-copy">© {new Date().getFullYear()} Government of Barbados</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Field({ id, label, onfile, value, onChange, placeholder, textarea, type, inputmode, autoComplete, confirmed, onConfirm, error }) {
  const hasOnFile = onfile && onfile.trim();
  const changed = hasOnFile && value.trim() !== onfile.trim();
  const errId = id ? `${id}-error` : undefined;
  const describedBy = error ? errId : undefined;
  return (
    <div className={`field${error ? " field-error-wrap" : ""}`}>
      <label className="field-label" htmlFor={id}>{label}</label>
      {hasOnFile && <div className="onfile">On record: <span>{onfile}</span></div>}
      {error && <p className="field-err" id={errId}><span className="sr-only">Error: </span>{error}</p>}
      {textarea
        ? <textarea id={id} rows={2} value={value} placeholder={placeholder} aria-invalid={error ? true : undefined} aria-describedby={describedBy} onChange={(e) => onChange(e.target.value)} />
        : <input id={id} type={type || "text"} inputMode={inputmode} autoComplete={autoComplete} value={value} placeholder={placeholder} aria-invalid={error ? true : undefined} aria-describedby={describedBy} onChange={(e) => onChange(e.target.value)} />}
      {hasOnFile && (changed
        ? <div className="field-changed">You've edited this — it will be submitted as a correction.</div>
        : <label className={`confirm-field${confirmed ? " on" : ""}`}><input type="checkbox" checked={!!confirmed} onChange={(e) => onConfirm(e.target.checked)} /><span>I've checked this and confirm it is correct</span></label>)}
    </div>
  );
}
function Stat({ n, label, cls }) { return <div className={`stat stat-${cls}`}><div className="stat-n">{n}</div><div className="stat-l">{label}</div></div>; }
function AuditTrail({ entries }) {
  if (!entries || !entries.length) return null;
  const KIND = { submitted: "Submitted for review", approved: "Approved", returned: "Sent back for changes", edited: "On-file details edited" };
  const fmt = (iso) => { try { return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); } catch (e) { return ""; } };
  const list = [...entries].reverse();
  return (
    <div className="audit">
      <div className="cmp-title">Audit trail</div>
      <ul className="audit-list">
        {list.map((e, i) => (
          <li key={i} className={`audit-item audit-${e.kind}`}>
            <span className="audit-dot" />
            <div className="audit-body">
              <div className="audit-line"><strong>{KIND[e.kind] || e.kind}</strong>{e.actor ? <span className="audit-actor"> · {e.actor}</span> : null}<span className="audit-time">{fmt(e.t)}</span></div>
              {e.changes && e.changes.length > 0 && (
                <ul className="audit-changes">
                  {e.changes.map((c, j) => (
                    <li key={j} className={`chg chg-${c.action}`}>
                      <span className="chg-field">{c.field}</span> <span className="chg-act">{c.action}</span>
                      {c.action === "corrected" && <span className="chg-diff"><s>{c.from || "—"}</s> → <b>{c.to || "—"}</b></span>}
                      {c.action === "added" && <span className="chg-diff"><b>{c.to}</b></span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
function CompareCol({ title, phone, email, address, highlight }) {
  const Row = ({ Icon, v }) => <div className="cmp-row"><Icon size={13} /><span>{v && v.trim() ? v : "—"}</span></div>;
  return <div className={`cmp-col${highlight ? " hl" : ""}`}><div className="cmp-title">{title}</div><Row Icon={Phone} v={phone} /><Row Icon={Mail} v={email} /><Row Icon={MapPin} v={address} /></div>;
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&display=swap');
.root {
  /* ---- gov.bb design system tokens (govtech-bb/govbb-design-system) ---- */
  --govbb-white-00:#fff; --govbb-black-00:#000; --govbb-grey-00:#e0e4e9; --govbb-mid-grey-00:#595959;
  --govbb-teal-ink:#083a3d; --govbb-teal-05:#0a4549; --govbb-teal-00:#0e5f64; --govbb-teal-10:#eaf9f9; --govbb-teal-40:#ace6e9; --govbb-teal-100:#30c0c8;
  --govbb-green-00:#00654a; --govbb-green-10:#e9f9f3; --govbb-green-40:#a5e5ce; --govbb-green-100:#1fbf84;
  --govbb-blue-00:#00164a; --govbb-blue-10:#e5e9f2; --govbb-blue-40:#99a8cc; --govbb-blue-100:#00267f;
  --govbb-red-00:#a42c2c; --govbb-red-10:#fff0f0; --govbb-red-40:#ffc4c4; --govbb-red-100:#ff6b6b;
  --govbb-yellow-00:#e8a833; --govbb-yellow-10:#fff9e9; --govbb-yellow-40:#ffe9a8; --govbb-yellow-100:#ffc726;
  --govbb-color-brand:var(--govbb-blue-100); --govbb-color-brand-accent:var(--govbb-yellow-100); --govbb-color-focus:var(--govbb-teal-100); --govbb-radius:4px; --radius-md:6px;
  /* ---- portal aliases mapped onto gov.bb tokens ---- */
  --navy:var(--govbb-blue-100); --navy-deep:var(--govbb-blue-00); --gold:var(--govbb-yellow-100); --gold-soft:var(--govbb-yellow-40);
  --paper:#f3f4f6; --surface:var(--govbb-white-00); --ink:var(--govbb-black-00); --muted:var(--govbb-mid-grey-00); --line:var(--govbb-grey-00);
  --confirmed:var(--govbb-green-00); --confirmed-bg:var(--govbb-green-10); --pending:#7a5c12; --pending-bg:var(--govbb-yellow-10);
  --updated:var(--govbb-teal-00); --updated-bg:var(--govbb-teal-10); --danger:var(--govbb-red-00);
  font-family:'Figtree',system-ui,-apple-system,'Segoe UI','Roboto',sans-serif; color:var(--ink); background:var(--paper); min-height:100vh; line-height:1.5; font-size:18px; display:flex; flex-direction:column;
}
.root * { box-sizing:border-box; }
h1,h2,h3 { font-family:'Figtree',system-ui,sans-serif; font-weight:700; letter-spacing:-0.01em; margin:0; }
h3 { display:flex; align-items:center; gap:8px; }
.gov-banner { background:var(--govbb-blue-00); color:#fff; }
.gov-banner-inner { max-width:940px; margin:0 auto; padding:7px 24px; display:flex; align-items:center; gap:8px; font-size:12.5px; letter-spacing:.01em; }
.gov-banner-crest { display:inline-flex; color:var(--gold); flex:0 0 auto; }
.gov-hdr { background:var(--govbb-color-brand-accent); color:var(--ink); border-bottom:1px solid rgba(0,0,0,.08); }
.gov-hdr-inner { display:flex; align-items:center; gap:11px; max-width:940px; margin:0 auto; padding:14px 24px; }
.gov-hdr-crest { display:inline-flex; color:var(--ink); flex:0 0 auto; }
.gov-hdr-word { font-weight:700; font-size:19px; letter-spacing:-0.01em; }
.status-banner { background:var(--surface); border-bottom:1px solid var(--line); }
.status-inner { max-width:940px; margin:0 auto; padding:10px 24px; display:flex; align-items:center; gap:11px; font-size:13px; color:var(--muted); }
.status-tag { background:var(--govbb-teal-00); color:#fff; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; padding:3px 9px; border-radius:var(--govbb-radius); flex:0 0 auto; }
.service-hdr { background:var(--surface); border-bottom:1px solid var(--line); }
.service-hdr-inner { max-width:940px; margin:0 auto; padding:26px 24px 26px; }
.service-hdr h1 { font-size:clamp(22px,3.4vw,30px); line-height:1.15; color:var(--ink); }
.service-hdr p { margin:9px 0 0; font-size:15px; color:var(--muted); max-width:620px; }
.tabs { display:flex; gap:4px; margin:18px 0 0; }
.tab { background:transparent; border:0; color:var(--muted); font-family:inherit; font-size:14px; font-weight:600; padding:12px 14px; display:flex; align-items:center; gap:7px; cursor:pointer; border-bottom:3px solid transparent; transition:.18s; margin-bottom:-1px; }
.tab:hover { color:var(--ink); } .tab.on { color:var(--ink); border-bottom-color:var(--govbb-teal-00); }
.main { max-width:940px; margin:0 auto; padding:30px 24px 70px; }
.gov-footer { background:var(--govbb-blue-00); color:#fff; margin-top:auto; }
.gov-footer-inner { max-width:940px; margin:0 auto; padding:32px 24px; }
.gov-footer-nav { display:flex; flex-wrap:wrap; gap:10px 24px; }
.gov-footer-nav a { color:#fff; font-size:14px; text-decoration:underline; text-underline-offset:2px; }
.gov-footer-nav a:hover { color:var(--gold); }
.gov-footer-divider { border:0; border-top:1px solid rgba(255,255,255,.2); margin:20px 0; }
.gov-footer-end { display:flex; align-items:center; gap:12px; }
.gov-footer-crest { display:inline-flex; color:var(--gold); flex:0 0 auto; }
.gov-footer-copy { margin:0; font-size:13.5px; color:#cdd6e6; }
.fade { animation:fade .35s ease; } @keyframes fade { from{opacity:0;transform:translateY(8px);} to{opacity:1;transform:none;} }
.loading { display:flex; align-items:center; gap:12px; color:var(--muted); padding:60px 0; justify-content:center; }
.spinner { width:20px;height:20px;border:2.5px solid var(--line);border-top-color:var(--navy);border-radius:50%;animation:spin .8s linear infinite; } @keyframes spin { to{transform:rotate(360deg);} }
.intro h2 { font-size:30px; } .intro p { color:var(--muted); font-size:18px; margin:7px 0 22px; }
.searchbar { display:flex; align-items:center; gap:10px; background:var(--surface); border:2px solid var(--ink); border-radius:var(--govbb-radius); padding:11px 14px; color:var(--muted); }
.searchbar:focus-within { box-shadow:0 0 0 4px var(--govbb-color-focus); }
.searchbar input { flex:1; border:0; outline:0; font-family:inherit; font-size:17px; color:var(--ink); background:transparent; }
.clear { border:0;background:transparent;cursor:pointer;color:var(--govbb-teal-00);display:inline-flex;align-items:center;font-family:inherit;font-size:15px;font-weight:600;text-decoration:underline;text-underline-offset:2px;flex:0 0 auto;padding:8px 6px;min-height:44px; }
.empty { padding:40px; text-align:center; color:var(--muted); }
.groups { list-style:none; margin:18px 0 0; padding:0; display:flex; flex-direction:column; gap:10px; }
.group { background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-md); overflow:hidden; animation:fade .4s ease both; }
.group-head { width:100%; display:flex; align-items:center; gap:11px; padding:15px 17px; background:transparent; border:0; cursor:pointer; font-family:inherit; text-align:left; }
.group-head:hover { background:#f5f6f8; }
.chev { color:var(--muted); transition:transform .18s; flex:0 0 auto; } .chev.rot, .dgroup-head .rot { transform:rotate(90deg); }
.group-ic { color:var(--navy); flex:0 0 auto; } .group-name { flex:1; font-weight:600; font-size:15.5px; }
.rollup { font-size:12px; font-weight:700; color:var(--pending); background:var(--pending-bg); border-radius:var(--govbb-radius); padding:3px 10px; white-space:nowrap; } .rollup.full { color:var(--confirmed); background:var(--confirmed-bg); }
.rowlist { list-style:none; margin:0; padding:0 0 6px; border-top:1px solid var(--line); }
.vrow { display:flex; align-items:center; gap:11px; padding:12px 17px 12px 20px; cursor:pointer; transition:.14s; border-bottom:1px solid #eef0f3; }
.vrow:last-child { border-bottom:0; } .vrow:hover { background:#f5f6f8; } .vrow.ministry { background:#f5f6f8; }
.dept-ic { color:var(--gold); flex:0 0 auto; }
.vrow-body { flex:1; min-width:0; display:flex; flex-direction:column; gap:3px; }
.vrow-name { font-weight:500; font-size:14.5px; }
.kindtag { font-size:11.5px; color:var(--muted); font-weight:600; text-transform:uppercase; letter-spacing:.03em; }
.needstag { font-size:11px; color:var(--pending); font-weight:600; }
.vrow-go { color:var(--govbb-teal-00); flex:0 0 auto; }
.badge { display:inline-flex; align-items:center; gap:5px; font-size:11.5px; font-weight:600; padding:3px 9px; border-radius:var(--govbb-radius); width:fit-content; white-space:nowrap; }
.badge-pending { background:var(--pending-bg); color:var(--pending); } .badge-confirmed { background:var(--confirmed-bg); color:var(--confirmed); } .badge-updated { background:var(--updated-bg); color:var(--updated); }
.back { background:transparent; border:0; color:var(--govbb-teal-00); font-family:inherit; font-size:13.5px; font-weight:600; display:inline-flex; align-items:center; gap:4px; cursor:pointer; padding:0; margin-bottom:18px; }
.form-head { display:flex; gap:15px; align-items:center; margin-bottom:8px; }
.form-head h2 { font-size:28px; margin-bottom:7px; }
.form-sub { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.card-icon { display:none; }
.form-lead { color:var(--muted); font-size:18px; margin:14px 0 22px; }
.fields { display:flex; flex-direction:column; gap:18px; }
.field-label { display:flex; align-items:center; gap:7px; font-weight:700; font-size:18px; margin-bottom:6px; color:var(--ink); }
.onfile { font-size:16px; color:var(--muted); margin-bottom:8px; } .onfile span { color:var(--ink); }
.confirm-field { display:flex; align-items:flex-start; gap:9px; margin-top:8px; font-size:15px; font-weight:500; color:var(--muted); cursor:pointer; padding:10px 12px; border:1px solid var(--line); border-radius:var(--govbb-radius); background:#f5f6f8; width:100%; max-width:100%; transition:.15s; }
.confirm-field:hover { border-color:var(--govbb-teal-00); }
.field .confirm-field input, .confirm-field input { width:24px; min-width:24px; height:24px; margin-top:0; padding:0; border:0; border-radius:0; accent-color:var(--confirmed); flex:0 0 auto; }
.confirm-field span { flex:1 1 auto; min-width:0; overflow-wrap:anywhere; }
.confirm-field.on { color:var(--confirmed); border-color:#c2e2cf; background:var(--confirmed-bg); }
.field-changed { display:flex; align-items:center; gap:7px; margin-top:8px; font-size:15px; font-weight:500; color:var(--updated); }
.field input, .field textarea, .lbl input, .lbl textarea, .add-row input, .add-row select, .edit-grid input, .edit-grid textarea, .role-row input {
  width:100%; font-family:inherit; font-size:17px; color:var(--ink); border:2px solid var(--ink); border-radius:var(--govbb-radius); padding:10px 13px; outline:0; background:var(--surface); transition:.15s; }
.field input:focus,.field textarea:focus,.lbl input:focus,.lbl textarea:focus,.add-row input:focus,.add-row select:focus,.edit-grid input:focus,.edit-grid textarea:focus,.role-row input:focus { border-color:var(--ink); box-shadow:0 0 0 4px var(--govbb-color-focus); }
textarea { resize:vertical; }
.rep-block { margin-top:26px; padding-top:22px; border-top:1px solid var(--line); }
.rep-block h3 { font-size:21px; margin-bottom:6px; }
.roles-hint { color:var(--muted); font-size:16px; margin:0 0 14px; }
.roles-empty { color:var(--muted); font-size:13px; font-style:italic; margin:0 0 10px; }
.roles-edit { display:flex; flex-direction:column; gap:8px; }
.role-row { display:grid; grid-template-columns:1fr 150px auto; gap:8px; align-items:center; }
.role-del { border:1px solid var(--line); background:var(--surface); border-radius:var(--govbb-radius); height:44px; padding:0 12px; display:grid; place-items:center; cursor:pointer; color:var(--danger); font-family:inherit; font-size:14px; font-weight:600; }
.role-del:hover { background:#fbf2f2; border-color:var(--danger); }
.role-add { align-self:flex-start; margin-top:4px; background:transparent; border:1px dashed var(--line); color:var(--govbb-teal-00); font-family:inherit; font-weight:600; font-size:13px; border-radius:var(--govbb-radius); padding:8px 12px; display:inline-flex; align-items:center; gap:6px; cursor:pointer; }
.role-add:hover { border-color:var(--govbb-teal-00); background:var(--govbb-teal-10); }
.rep-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.lbl { display:flex; flex-direction:column; gap:6px; font-size:16px; font-weight:700; color:var(--ink); }
.lbl span i { color:var(--danger); font-style:normal; margin-left:2px; } .lbl.wide { grid-column:1 / -1; }
.affirm { display:flex; gap:11px; align-items:flex-start; margin:22px 0 6px; font-size:17px; color:var(--ink); cursor:pointer; }
.affirm input { margin-top:2px; width:24px; height:24px; accent-color:var(--govbb-teal-00); flex:0 0 auto; }
.sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
.error-summary { border:4px solid var(--danger); background:var(--surface); padding:16px 18px; margin-bottom:24px; border-radius:var(--govbb-radius); }
.error-summary:focus { outline:3px solid var(--govbb-color-focus); outline-offset:2px; }
.error-summary-title { font-size:20px; color:var(--danger); margin:0 0 10px; }
.error-summary-list { margin:0; padding-left:18px; } .error-summary-list li { margin:5px 0; }
.error-summary-list a { color:var(--danger); font-weight:700; text-underline-offset:2px; }
.vrow:focus-visible, .group-head:focus-visible, .back:focus-visible, .role-add:focus-visible, .role-del:focus-visible, .clear:focus-visible, .btn:focus-visible, .error-summary-list a:focus-visible, .gov-footer-nav a:focus-visible, h2:focus-visible { outline:3px solid var(--govbb-color-focus); outline-offset:2px; }
.vrow:focus-visible { outline-offset:-3px; }
.field-err { color:var(--danger); font-weight:700; font-size:15px; margin:0 0 8px; }
.field-error-wrap { border-left:4px solid var(--danger); padding-left:14px; }
.field-error-wrap input, .field-error-wrap textarea { border-color:var(--danger); }
.affirm-wrap { margin:22px 0 6px; }
.confirm-panel { background:var(--confirmed); color:#fff; text-align:center; padding:32px 20px; border-radius:var(--govbb-radius); margin-bottom:22px; }
.done .confirm-panel h2 { color:#fff; font-size:30px; margin:0; }
.done .confirm-panel p { color:#fff; max-width:none; margin:14px 0 0; font-size:19px; }
.confirm-ref strong { display:inline-block; margin-top:4px; font-size:26px; letter-spacing:.03em; }
.done .done-next { margin-top:14px; font-size:16px; }
.actions { display:flex; justify-content:flex-end; gap:10px; margin-top:24px; }
.btn { font-family:inherit; font-weight:600; font-size:14px; border-radius:var(--govbb-radius); padding:11px 18px; display:inline-flex; align-items:center; gap:7px; cursor:pointer; border:1px solid transparent; transition:.16s; }
.btn.sm { padding:8px 13px; font-size:13px; }
.btn.primary { background:var(--govbb-teal-00); color:#fff; } .btn.primary:hover { background:#1a777d; box-shadow:inset 0 0 0 4px rgba(222,245,246,.10); } .btn.primary:active { background:var(--govbb-teal-05); }
.btn.ghost { background:var(--surface); border-color:var(--line); color:var(--ink); } .btn.ghost:hover { border-color:var(--muted); }
.btn.ghost.danger { color:var(--danger); } .btn.ghost.danger:hover { border-color:var(--danger); background:#fbf2f2; }
.done { text-align:center; padding:50px 20px; }
.done-mark { display:none; } @keyframes pop { from{transform:scale(.7);opacity:0;} to{transform:scale(1);opacity:1;} }
.done h2 { font-size:32px; margin-bottom:8px; } .done p { color:var(--muted); font-size:18px; max-width:460px; margin:0 auto; } .done-actions { margin-top:26px; }
.dash-head { display:flex; justify-content:space-between; align-items:flex-end; gap:16px; flex-wrap:wrap; }
.dash-head h2 { font-size:28px; } .dash-head p { color:var(--muted); margin:6px 0 0; font-size:16px; }
.dash-tools { display:flex; gap:8px; }
.progress-wrap { margin:22px 0 18px; }
.progress-row { display:flex; justify-content:space-between; font-size:13px; font-weight:600; color:var(--muted); margin-bottom:7px; }
.progress { height:9px; background:var(--line); border-radius:20px; overflow:hidden; }
.progress-fill { height:100%; background:linear-gradient(90deg,var(--gold),var(--gold-soft)); border-radius:20px; transition:width .5s ease; }
.stat-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:22px; }
.stat { background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-md); padding:16px; text-align:center; }
.stat-n { font-family:'Figtree',system-ui,sans-serif; font-size:30px; font-weight:700; line-height:1; } .stat-l { font-size:12.5px; color:var(--muted); margin-top:6px; }
.stat-pending .stat-n{color:var(--pending);} .stat-confirmed .stat-n{color:var(--confirmed);} .stat-updated .stat-n{color:var(--updated);} .stat-total .stat-n{color:var(--navy);}
.add-row { display:flex; gap:9px; margin-bottom:18px; flex-wrap:wrap; }
.add-row input { flex:1; min-width:180px; } .add-row select { flex:0 0 auto; max-width:240px; }
.privacy { display:flex; align-items:center; gap:8px; font-size:12.5px; color:var(--muted); padding:16px 0 0; }
.rows { display:flex; flex-direction:column; gap:9px; }
.dgroup { background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-md); overflow:hidden; }
.dgroup-head { width:100%; display:flex; align-items:center; gap:10px; padding:14px 16px; background:transparent; border:0; cursor:pointer; font-family:inherit; text-align:left; }
.dgroup-head:hover { background:#f5f6f8; } .dgroup-head svg:first-child { color:var(--muted); transition:transform .18s; } .dgroup-head svg:nth-child(2){ color:var(--navy); }
.dgroup-name { flex:1; font-weight:600; font-size:14.5px; }
.dgroup-body { border-top:1px solid var(--line); }
.drow { border-bottom:1px solid #eef0f3; } .drow:last-child { border-bottom:0; } .drow.is-dept { background:#f8f9fb; }
.drow-main { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:12px 16px 12px 20px; cursor:pointer; }
.drow-main:hover { background:#f5f6f8; }
.drow-name { display:flex; align-items:center; gap:9px; font-weight:500; font-size:14px; color:var(--ink); }
.hometag { font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:#fff; background:var(--navy); padding:2px 7px; border-radius:5px; }
.drow-detail { padding:4px 16px 16px 20px; background:#fff; }
.compare { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin:12px 0; }
.cmp-col { background:#f5f6f8; border:1px solid var(--line); border-radius:var(--govbb-radius); padding:12px; } .cmp-col.hl { background:var(--updated-bg); border-color:#c4dcef; }
.cmp-title { font-size:11.5px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); margin-bottom:9px; }
.cmp-row { display:flex; gap:8px; align-items:flex-start; font-size:13px; padding:3px 0; } .cmp-row svg { color:var(--navy); flex:0 0 auto; margin-top:3px; }
.roles-ref { margin:0 0 12px; }
.role-chips { display:flex; flex-wrap:wrap; gap:6px; }
.role-chip { font-size:12px; background:#f5f6f8; border:1px solid var(--line); border-radius:7px; padding:4px 9px; color:var(--ink); } .role-chip b { font-weight:600; }
.meta { display:flex; justify-content:space-between; gap:12px; font-size:12.5px; color:var(--muted); flex-wrap:wrap; }
.meta-notes { font-size:13px; color:var(--ink); font-style:italic; margin-top:6px; }
.drow-tools, .edit-actions { display:flex; gap:8px; margin-top:14px; flex-wrap:wrap; }
.link-banner { display:flex; align-items:center; gap:8px; font-size:13px; font-weight:500; color:var(--navy); background:var(--govbb-blue-10); border-left:4px solid var(--govbb-blue-40); border-radius:0 var(--govbb-radius) var(--govbb-radius) 0; padding:11px 14px; margin-bottom:18px; }
.done-close { color:var(--muted); font-size:14px; max-width:420px; margin:0 auto; }
.links-panel { background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-md); padding:16px; margin:18px 0; }
.links-intro p { margin:0 0 6px; font-size:13px; color:var(--ink); }
.links-base { display:flex; align-items:center; gap:7px; color:var(--muted) !important; font-size:12px !important; }
.links-base code { background:#f5f6f8; border:1px solid var(--line); border-radius:5px; padding:1px 6px; font-size:11.5px; word-break:break-all; }
.links-tools { display:flex; gap:8px; align-items:center; margin:14px 0 12px; flex-wrap:wrap; }
.links-search { display:flex; align-items:center; gap:7px; flex:1; min-width:160px; background:#f5f6f8; border:1px solid var(--line); border-radius:var(--govbb-radius); padding:6px 10px; color:var(--muted); }
.links-search input { flex:1; border:0; outline:0; background:transparent; font-family:inherit; font-size:13.5px; color:var(--ink); }
.links-list { list-style:none; margin:0; padding:0; max-height:420px; overflow:auto; display:flex; flex-direction:column; gap:7px; }
.link-item { display:grid; grid-template-columns:1.4fr 2fr auto; gap:10px; align-items:center; padding:9px 11px; border:1px solid var(--line); border-radius:var(--govbb-radius); }
.link-item.is-dept { background:#f8f9fb; }
.link-meta { display:flex; align-items:center; gap:7px; min-width:0; }
.link-min-ic { color:var(--navy); flex:0 0 auto; } .link-name { font-size:13.5px; font-weight:500; }
.link-url { font-size:11.5px; color:var(--muted); background:#f5f6f8; border:1px solid var(--line); border-radius:6px; padding:4px 8px; word-break:break-all; }
.link-copy { white-space:nowrap; }
.edit-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:12px; } .edit-actions { grid-column:1 / -1; justify-content:flex-end; }
.subtabs { display:flex; gap:4px; margin:18px 0 4px; border-bottom:1px solid var(--line); }
.subtab { background:transparent; border:0; border-bottom:2.5px solid transparent; font-family:inherit; font-size:13.5px; font-weight:600; color:var(--muted); padding:9px 14px; cursor:pointer; display:flex; align-items:center; gap:7px; }
.subtab:hover { color:var(--ink); } .subtab.on { color:var(--ink); border-bottom-color:var(--govbb-teal-00); }
.pill { background:var(--updated-bg); color:var(--updated); font-size:11px; font-weight:700; border-radius:var(--govbb-radius); padding:1px 7px; }
.subtab.on .pill { background:var(--govbb-teal-00); color:#fff; }
.dash-view { padding-top:18px; }
.overview-tools { display:flex; justify-content:flex-end; margin-bottom:8px; }
.review-head { display:flex; justify-content:space-between; align-items:flex-end; gap:14px; flex-wrap:wrap; margin-bottom:14px; }
.review-head p { color:var(--muted); font-size:16px; margin:0; max-width:560px; }
.review-tools { display:flex; align-items:flex-end; gap:9px; }
.reviewer-lbl { display:flex; flex-direction:column; gap:4px; font-size:12px; font-weight:600; color:var(--navy); }
.reviewer-lbl input { border:1px solid var(--line); border-radius:var(--govbb-radius); padding:7px 10px; font-family:inherit; font-size:13.5px; outline:0; }
.reviewer-lbl input:focus { border-color:var(--ink); box-shadow:0 0 0 4px var(--govbb-color-focus); }
.review-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:12px; }
.review-card { background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-md); padding:16px; }
.review-card-head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:6px; }
.review-name { font-weight:700; font-size:18px; }
.review-sub { font-size:14px; color:var(--muted); margin-top:3px; }
.change-hints { font-size:12.5px; color:var(--updated); font-weight:600; margin:2px 0 4px; text-transform:capitalize; }
.review-contact { font-size:12.5px; color:var(--muted); margin-top:8px; }
.audit { margin-top:14px; padding-top:12px; border-top:1px dashed var(--line); }
.audit-list { list-style:none; margin:8px 0 0; padding:0; display:flex; flex-direction:column; gap:11px; }
.audit-item { position:relative; padding-left:18px; }
.audit-item:not(:last-child)::before { content:""; position:absolute; left:4px; top:14px; bottom:-11px; width:1.5px; background:var(--line); }
.audit-dot { position:absolute; left:0; top:4px; width:9px; height:9px; border-radius:50%; background:var(--muted); }
.audit-submitted .audit-dot { background:var(--updated); }
.audit-approved .audit-dot { background:var(--confirmed); }
.audit-returned .audit-dot { background:var(--danger); }
.audit-edited .audit-dot { background:var(--gold); }
.audit-line { font-size:12.5px; color:var(--ink); display:flex; flex-wrap:wrap; align-items:baseline; gap:5px; }
.audit-line strong { font-weight:600; } .audit-actor { color:var(--muted); }
.audit-time { color:var(--muted); font-size:11.5px; margin-left:auto; }
.audit-changes { list-style:none; margin:6px 0 0; padding:0; display:flex; flex-direction:column; gap:3px; }
.chg { font-size:12px; color:var(--ink); }
.chg-field { font-weight:600; }
.chg-act { text-transform:uppercase; font-size:10px; font-weight:700; letter-spacing:.03em; padding:1px 6px; border-radius:4px; margin:0 2px; }
.chg-confirmed .chg-act { background:var(--confirmed-bg); color:var(--confirmed); }
.chg-corrected .chg-act { background:var(--updated-bg); color:var(--updated); }
.chg-added .chg-act { background:var(--pending-bg); color:var(--pending); }
.chg-diff { color:var(--muted); } .chg-diff s { color:var(--danger); } .chg-diff b { color:var(--confirmed); font-weight:600; }
.review-actions { display:flex; gap:8px; margin-top:14px; flex-wrap:wrap; }
.publish-summary { display:flex; gap:12px; margin-bottom:16px; }
.ps-stat { flex:1; background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-md); padding:16px; text-align:center; }
.ps-n { font-family:'Figtree',system-ui,sans-serif; font-size:30px; font-weight:700; line-height:1; color:var(--navy); }
.ps-n.approved { color:var(--confirmed); } .ps-n.pending { color:var(--updated); }
.ps-l { font-size:12.5px; color:var(--muted); margin-top:6px; }
.publish-lead { color:var(--muted); font-size:17px; margin:0 0 16px; }
.publish-lead code, .publish-fallback code, .gh-note code { background:#f5f6f8; border:1px solid var(--line); border-radius:5px; padding:1px 6px; font-size:12.5px; color:var(--ink); }
.gh-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.gh-note { display:flex; align-items:center; gap:7px; font-size:12px; color:var(--muted); margin:12px 0 0; }
.publish-actions { display:flex; gap:10px; margin-top:18px; flex-wrap:wrap; }
.mini-spin { width:14px;height:14px;border:2px solid rgba(255,255,255,.5);border-top-color:#fff;border-radius:50%;animation:spin .8s linear infinite;display:inline-block; }
.pr-ok { display:flex; align-items:center; gap:8px; color:var(--confirmed); background:var(--confirmed-bg); border:1px solid #c2e2cf; border-radius:var(--govbb-radius); padding:11px 14px; margin-top:14px; font-size:14px; font-weight:500; }
.pr-ok a { color:var(--confirmed); font-weight:700; }
.publish-fallback { margin-top:18px; font-size:13.5px; color:var(--muted); }
.publish-fallback summary { cursor:pointer; font-weight:600; color:var(--navy); }
.publish-fallback ol { margin:10px 0 0; padding-left:20px; } .publish-fallback li { margin:5px 0; }
.signin-wrap { display:flex; justify-content:center; padding:24px 0; }
.signin-card { background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-md); padding:30px; max-width:420px; width:100%; }
.signin-ic { display:none; }
.signin-card h2 { font-size:26px; margin-bottom:8px; }
.signin-card > p { color:var(--muted); font-size:16px; margin:0 0 18px; }
.signin-card .lbl { margin-bottom:14px; }
.signin-btn { width:100%; justify-content:center; margin-top:4px; }
.signin-note { display:flex; align-items:flex-start; gap:7px; font-size:12px; color:var(--muted); margin:16px 0 0; }
.signed-as { display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:600; color:var(--navy); background:var(--govbb-blue-10); border:1px solid var(--line); border-radius:var(--govbb-radius); padding:5px 11px; }
/* Long strings (emails, URLs, code) never force horizontal scroll. */
.vrow-name, .drow-name, .link-name, .review-name, .onfile, .onfile span, .cmp-row, .link-url, .links-base code, .meta, .role-chip { overflow-wrap:anywhere; word-break:break-word; }
.subtabs { overflow-x:auto; -webkit-overflow-scrolling:touch; }
.tab, .subtab { white-space:nowrap; }

/* ---------- Tablet (≤900px) ---------- */
@media (max-width:900px) {
  .compare, .gh-grid, .edit-grid { grid-template-columns:1fr; }
  .stat-grid { grid-template-columns:1fr 1fr; }
  .link-item { grid-template-columns:1fr auto; }
  .dash-head, .review-head { flex-direction:column; align-items:stretch; }
  .dash-tools, .review-tools { flex-wrap:wrap; }
  .service-hdr h1 { font-size:clamp(22px,5vw,30px); }
}

/* ---------- Mobile (≤600px) ---------- */
@media (max-width:600px) {
  .root { font-size:17px; }
  .rep-grid, .stat-grid, .edit-grid, .gh-grid, .link-item { grid-template-columns:1fr; }
  .role-row { grid-template-columns:1fr; }
  .role-del { justify-self:start; }
  .publish-summary { flex-direction:column; }
  /* Page furniture padding */
  .gov-banner-inner, .gov-hdr-inner, .status-inner { padding-left:16px; padding-right:16px; }
  .service-hdr-inner { padding:20px 16px 20px; } .main { padding:22px 16px 56px; } .gov-footer-inner { padding:24px 16px; }
  .tabs { gap:0; } .tab { padding:11px 12px; font-size:14px; }
  /* List / detail rows stack the badge under the name */
  .vrow { flex-wrap:wrap; gap:8px 10px; padding:13px 15px; }
  .vrow-body { flex:1 1 100%; }
  .drow-main { flex-wrap:wrap; }
  .add-row { flex-direction:column; align-items:stretch; } .add-row input, .add-row select { max-width:none; width:100%; }
  .actions, .review-actions, .publish-actions, .drow-tools, .edit-actions { flex-direction:column; align-items:stretch; }
  .actions .btn, .review-actions .btn, .publish-actions .btn { justify-content:center; width:100%; }
  .dash-tools .btn { flex:1; justify-content:center; }
  .meta, .review-card-head { flex-direction:column; gap:6px; align-items:flex-start; }
  .audit-time { margin-left:0; }
  .form-head { gap:10px; }
  .signin-card { padding:22px; }
}
`;
