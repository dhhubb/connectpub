'use strict';

const { db, rebuildSearchIndex, syncCatalogue } = require('./db');
const { hashPassword } = require('./auth');
const { slugify } = require('./util');
const { LOCATIONS, categoriesFor } = require('./catalogue');

// Category ids are resolved from src/catalogue.js so the seeded listings and
// the taxonomy can never drift apart.
function categoryIdMap() {
  const map = {};
  for (const kind of ['job', 'service']) {
    for (const c of categoriesFor(kind)) map[c.name] = db.prepare('SELECT id FROM categories WHERE slug = ?').get(c.slug).id;
  }
  return map;
}

const USERS = [
  ['System Administrator', 'admin@plumtreeconnect.co.zw', 'admin1234', 'admin', 'Plumtree Town', 'Platform administrator for Plumtree Connect.'],
  ['Thandiwe Ncube', 'thandiwe@example.com', 'seeker1234', 'seeker', 'Dingumuzi', 'Job seeker with 4 years retail and till experience.'],
  ['Sipho Moyo', 'sipho@example.com', 'seeker1234', 'seeker', 'Ndiweni', 'Bricklayer looking for contract work around Plumtree.'],
  ['Nomatter Dube', 'nomatter@example.com', 'seeker1234', 'seeker', 'Matjinge', 'Recent O level graduate seeking entry level work.'],
  ['Bongani Tshuma', 'bongani@example.com', 'seeker1234', 'seeker', 'Empandeni', 'Driver with cross-border experience and clean class 2 licence.'],
  ['Plumtree Agro Estates', 'hr@plumtreeagro.co.zw', 'employer1234', 'employer', 'Matjinge', 'Commercial farming operation near the border.'],
  ['Border Lodge & Conference', 'jobs@borderlodge.co.zw', 'employer1234', 'employer', 'Plumtree Town', 'Hospitality group running lodges and conference facilities.'],
  ['Mangwe Rural District Council', 'recruitment@mangwerdc.co.zw', 'employer1234', 'employer', 'Mangwe', 'Local authority recruiting for community projects.'],
  ['Kalanga Hardware & Builders', 'admin@kalangahardware.co.zw', 'employer1234', 'employer', 'Plumtree Town', 'Hardware and building supplies retailer.'],
  ['Empandeni Mission Clinic', 'clinic@empandeni.co.zw', 'employer1234', 'employer', 'Empandeni', 'Rural health facility serving surrounding wards.'],
  ['Tshitshi Borehole Services', 'info@tshitshiboreholes.co.zw', 'provider1234', 'provider', 'Tshitshi', 'Borehole drilling and pump installation since 2011.'],
  ['Dingumuzi Electrical Works', 'dingumuzielectrical@example.com', 'provider1234', 'provider', 'Dingumuzi', 'Certified electrician and solar installer.'],
  ['Plumtree Shine Cleaning', 'shine@plumtreeshine.co.zw', 'provider1234', 'provider', 'Plumtree Town', 'Home, office and post-construction cleaning.'],
  ['Moyo Welding & Gates', 'moyowelding@example.com', 'provider1234', 'provider', 'Ndiweni', 'Custom gates, burglar bars and general welding.'],
  ['Bhango Events & Décor', 'bhangoevents@example.com', 'provider1234', 'provider', 'Bhango', 'Tents, décor, catering and sound for all events.'],
  ['Kalanga Transport Hire', 'hire@kalangatransport.co.zw', 'provider1234', 'provider', 'Plumtree Town', 'Truck and bakkie hire including cross-border trips.'],
  ['Gwanda Solar Solutions', 'sales@gwandasolar.co.zw', 'provider1234', 'provider', 'Gwanda', 'Solar systems, inverters and battery installation.'],
  ['Mangwe Garden & Fencing', 'mangwegarden@example.com', 'provider1234', 'provider', 'Mangwe', 'Gardening, tree felling, fencing and pest control.'],
  ['Sibanda Plumbing', 'sibandaplumbing@example.com', 'provider1234', 'provider', 'Empandeni', 'Plumbing repairs, geysers and drainage.'],
  ['Figtree Beauty Studio', 'figtreebeauty@example.com', 'provider1234', 'provider', 'Figtree', 'Hair, nails and bridal make-up services.'],
];

function seed({ force = false } = {}) {
  const existing = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (existing > 0 && !force) return { seeded: false, users: existing };

  db.exec('PRAGMA foreign_keys = OFF;');
  for (const table of ['jobs_fts', 'providers_fts', 'reviews', 'saved_items', 'applications', 'service_requests', 'jobs', 'providers', 'audit_log', 'locations', 'categories', 'users', 'settings']) {
    db.exec(`DELETE FROM ${table};`);
  }
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('users','categories','locations','jobs','providers','applications','service_requests','reviews','saved_items','audit_log');");
  db.exec('PRAGMA foreign_keys = ON;');

  // The wipe above cleared the taxonomy tables, so repopulate them from the
  // catalogue before anything tries to resolve a category id.
  syncCatalogue();
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('categories','locations');");

  const locationIds = {};
  for (const [name] of LOCATIONS) {
    locationIds[name] = db.prepare('SELECT id FROM locations WHERE slug = ?').get(slugify(name)).id;
  }

  const categoryIds = categoryIdMap();
  const jobCategoryIds = categoryIds;
  const serviceCategoryIds = categoryIds;

  const insertUser = db.prepare(
    `INSERT INTO users (name, email, phone, password_hash, role, status, ward, bio)
     VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`
  );
  const userIds = {};
  for (const [name, email, password, role, ward, bio] of USERS) {
    const phone = '+263' + (77 + (Object.keys(userIds).length % 3)) + String(1000000 + Object.keys(userIds).length * 137).slice(0, 7);
    const info = insertUser.run(name, email, phone, hashPassword(password), role, ward, bio);
    userIds[email] = Number(info.lastInsertRowid);
  }

  const insertJob = db.prepare(
    `INSERT INTO jobs (employer_id, category_id, location_id, title, company, description, requirements,
       job_type, work_mode, salary_min, salary_max, currency, vacancies, deadline, contact_email, contact_phone,
       status, featured, views, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'USD', ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))`
  );

  const jobs = [
    ['hr@plumtreeagro.co.zw', 'Agriculture & Farming', 'Matjinge', 'Irrigation Field Supervisor', 'Plumtree Agro Estates',
      'Supervise a team of 12 field hands operating centre pivot and drip irrigation on 180 hectares of citrus and maize. Report daily to the farm manager on water scheduling, pump performance and labour attendance.',
      'Diploma in agriculture or 5 years practical irrigation experience\nAbility to read and adjust irrigation schedules\nClass 4 driver licence an advantage\nWilling to work weekends during peak season',
      'full_time', 'on_site', 350, 520, 1, '2026-12-15', 'hr@plumtreeagro.co.zw', '+263771234001', 'approved', 1, 412, '-9 days'],
    ['hr@plumtreeagro.co.zw', 'Agriculture & Farming', 'Tshitshi', 'Livestock Herdsman', 'Plumtree Agro Estates',
      'Look after a 240 head cattle herd including dipping, supplementary feeding and record keeping of births and treatments.',
      'Experience with cattle handling and dip tank routines\nAble to keep simple livestock records\nPhysically fit and reliable',
      'full_time', 'on_site', 180, 260, 2, '2026-11-30', 'hr@plumtreeagro.co.zw', '+263771234001', 'approved', 0, 233, '-6 days'],
    ['jobs@borderlodge.co.zw', 'Hospitality & Catering', 'Plumtree Town', 'Lodge Receptionist', 'Border Lodge & Conference',
      'Welcome guests arriving from the border post, manage bookings on the lodge system, handle payments and coordinate housekeeping requests. Shifts include weekends and public holidays.',
      'Excellent spoken English and Ndebele or Kalanga\nComputer literacy for the booking system\nCustomer service experience preferred\nPresentable and punctual',
      'full_time', 'on_site', 220, 300, 2, '2026-12-05', 'jobs@borderlodge.co.zw', '+263771234002', 'approved', 1, 587, '-12 days'],
    ['jobs@borderlodge.co.zw', 'Hospitality & Catering', 'Plumtree Town', 'Kitchen Assistant', 'Border Lodge & Conference',
      'Assist the head chef with food preparation, plating and kitchen hygiene for a 90 seater restaurant and conference facility.',
      'Food handling certificate an advantage\nAbility to work under pressure\nWilling to learn the menu',
      'part_time', 'on_site', 120, 180, 1, '2026-11-25', 'jobs@borderlodge.co.zw', '+263771234002', 'approved', 0, 198, '-4 days'],
    ['recruitment@mangwerdc.co.zw', 'ICT & Admin', 'Mangwe', 'Data Capture Clerk', 'Mangwe Rural District Council',
      'Capture household and business records for the ward development database, verify source documents and produce weekly summary reports for the district officer.',
      'O level including Maths and English\nTyping speed of at least 30 words per minute\nKnowledge of Excel or LibreOffice Calc\nResident of Mangwe district preferred',
      'contract', 'on_site', 250, 320, 3, '2026-12-10', 'recruitment@mangwerdc.co.zw', '+263771234003', 'approved', 0, 344, '-7 days'],
    ['recruitment@mangwerdc.co.zw', 'Construction & Trades', 'Mangwe', 'Borehole Rehabilitation Artisan', 'Mangwe Rural District Council',
      'Rehabilitate 24 community boreholes under the rural water programme including pump replacement, apron repairs and community handover training.',
      'Class 1 or 2 artisan certificate in fitting and turning\nExperience with Bush Pump and solar pump systems\nAble to work in remote wards',
      'contract', 'on_site', 400, 600, 2, '2026-12-20', 'recruitment@mangwerdc.co.zw', '+263771234003', 'approved', 1, 271, '-3 days'],
    ['admin@kalangahardware.co.zw', 'Retail & Sales', 'Plumtree Town', 'Hardware Shop Assistant', 'Kalanga Hardware & Builders',
      'Serve walk in customers, quote on building materials, receive stock and keep the yard organised. Saturday trading is compulsory.',
      'O level\nNumeracy and cash handling\nKnowledge of building materials an advantage',
      'full_time', 'on_site', 160, 220, 2, '2026-11-28', 'admin@kalangahardware.co.zw', '+263771234004', 'approved', 0, 302, '-5 days'],
    ['admin@kalangahardware.co.zw', 'Transport & Logistics', 'Plumtree Town', 'Delivery Driver', 'Kalanga Hardware & Builders',
      'Deliver building materials to sites around Plumtree, Bulilima and Mangwe. Responsible for vehicle checks and delivery paperwork.',
      'Class 2 driver licence with at least 3 years driving\nDefensive driving certificate an advantage\nFamiliar with district roads',
      'full_time', 'on_site', 230, 300, 1, '2026-12-08', 'admin@kalangahardware.co.zw', '+263771234004', 'approved', 0, 265, '-2 days'],
    ['clinic@empandeni.co.zw', 'Health & Care', 'Empandeni', 'Primary Care Nurse Aide', 'Empandeni Mission Clinic',
      'Support nursing staff with vitals, patient records, dressing changes and health education at outreach points in surrounding wards.',
      'Nurse aide certificate\nExperience in a clinic or hospital setting\nAble to travel to outreach sites',
      'full_time', 'on_site', 260, 350, 2, '2026-12-12', 'clinic@empandeni.co.zw', '+263771234005', 'approved', 1, 398, '-8 days'],
    ['clinic@empandeni.co.zw', 'Domestic & General Work', 'Empandeni', 'Clinic Groundskeeper', 'Empandeni Mission Clinic',
      'Maintain clinic grounds, slashing, refuse removal and minor repairs to the fence and pathways.',
      'Physically fit\nBasic tool handling\nResident near Empandeni preferred',
      'casual', 'on_site', 90, 130, 1, '2026-11-22', 'clinic@empandeni.co.zw', '+263771234005', 'pending', 0, 47, '-1 days'],
    ['jobs@borderlodge.co.zw', 'Security Services', 'Plumtree Town', 'Night Security Guard', 'Border Lodge & Conference',
      'Night shift guarding of the lodge premises, gate control, visitor logging and hourly patrols.',
      'Security training certificate\nNight shift availability\nGood record of conduct',
      'full_time', 'on_site', 170, 210, 2, '2026-12-01', 'jobs@borderlodge.co.zw', '+263771234002', 'pending', 0, 61, '-1 days'],
    ['hr@plumtreeagro.co.zw', 'Education & Training', 'Matjinge', 'Farm Literacy Tutor', 'Plumtree Agro Estates',
      'Run twice weekly adult literacy classes for farm workers and their families at the estate training room.',
      'Teaching qualification or adult education experience\nNdebele and English fluency',
      'part_time', 'on_site', 150, 200, 1, '2026-12-18', 'hr@plumtreeagro.co.zw', '+263771234001', 'pending', 0, 38, '-1 days'],
    ['recruitment@mangwerdc.co.zw', 'Construction & Trades', 'Bhango', 'Road Maintenance General Hand', 'Mangwe Rural District Council',
      'General labour for the feeder road grading programme including drainage clearing and culvert maintenance.',
      'Physically fit\nPrevious road works experience an advantage',
      'casual', 'on_site', 80, 110, 15, '2026-11-20', 'recruitment@mangwerdc.co.zw', '+263771234003', 'approved', 0, 512, '-14 days'],
    ['admin@kalangahardware.co.zw', 'ICT & Admin', 'Plumtree Town', 'Stock Control Clerk', 'Kalanga Hardware & Builders',
      'Maintain stock cards, run monthly counts and reconcile deliveries against invoices.',
      'O level with Maths\nSpreadsheet skills\nAttention to detail',
      'full_time', 'on_site', 240, 310, 1, '2026-12-14', 'admin@kalangahardware.co.zw', '+263771234004', 'rejected', 0, 88, '-10 days'],
    ['admin@kalangahardware.co.zw', 'Wholesale & Distribution', 'Plumtree Town', 'Warehouse Stock Controller', 'Kalanga Hardware & Builders',
      'Own stock counts across the yard and warehouse, reconcile deliveries against invoices and keep the bin card system accurate for cement, timber and roofing sheets.',
      'Stock control experience in a warehouse or yard\nComfortable with stock cards and simple spreadsheets\nForklift or loader experience an advantage',
      'full_time', 'on_site', 210, 290, 1, '2026-12-14', 'admin@kalangahardware.co.zw', '+263771234004', 'approved', 0, 176, '-5 days'],
    ['admin@kalangahardware.co.zw', 'Finance & Accounting', 'Plumtree Town', 'Bookkeeper', 'Kalanga Hardware & Builders',
      'Maintain the day book, reconcile the till and bank statements, prepare VAT schedules and assist the accountant with monthly returns.',
      'Accounting qualification or two years bookkeeping experience\nWorking knowledge of Pastel or a similar package\nAttention to detail with figures',
      'full_time', 'on_site', 300, 420, 1, '2026-12-22', 'admin@kalangahardware.co.zw', '+263771234004', 'approved', 0, 214, '-4 days'],
    ['jobs@borderlodge.co.zw', 'Real Estate & Property', 'Plumtree Town', 'Property Caretaker', 'Border Lodge & Conference',
      'Look after two rental blocks in Plumtree town: take meter readings, arrange repairs, keep the grounds tidy and report monthly to the property owner.',
      'Practical maintenance skills\nAble to keep records of repairs and readings\nTrustworthy and able to work unsupervised',
      'full_time', 'on_site', 190, 260, 1, '2026-12-09', 'jobs@borderlodge.co.zw', '+263771234002', 'approved', 0, 158, '-6 days'],
    ['recruitment@mangwerdc.co.zw', 'Finance & Accounting', 'Mangwe', 'Revenue Clerk', 'Mangwe Rural District Council',
      'Receive and receipt council revenue at the district office, reconcile daily collections and prepare the banking schedule for the finance officer.',
      'O level including Maths and English\nCash handling and receipting experience\nComputer literacy for the revenue system',
      'full_time', 'on_site', 240, 310, 2, '2026-12-16', 'recruitment@mangwerdc.co.zw', '+263771234003', 'approved', 0, 187, '-3 days'],
    ['jobs@borderlodge.co.zw', 'Events & Media', 'Plumtree Town', 'Events Coordinator', 'Border Lodge & Conference',
      'Coordinate conferences, weddings and community events: take bookings, arrange seating and catering, brief the sound team and be present on the day.',
      'Events or hospitality experience\nStrong organisational skills\nAble to work evenings and weekends',
      'contract', 'on_site', 260, 360, 1, '2026-12-19', 'jobs@borderlodge.co.zw', '+263771234002', 'approved', 1, 241, '-2 days'],
    ['clinic@empandeni.co.zw', 'Manufacturing & Production', 'Plumtree Town', 'Grain Mill Operator', 'Empandeni Mission Clinic',
      'Operate the community maize mill, grade incoming grain, keep milling records and maintain the mill between services.',
      'Experience operating a hammer mill or similar plant\nBasic mechanical maintenance\nAble to keep production records',
      'full_time', 'on_site', 170, 230, 1, '2026-12-11', 'clinic@empandeni.co.zw', '+263771234005', 'approved', 0, 132, '-4 days'],
    ['hr@plumtreeagro.co.zw', 'Energy & Utilities', 'Matjinge', 'Solar Pump Technician', 'Plumtree Agro Estates',
      'Service the estate solar pumping array: check panels and controllers, replace worn pumps, log water output and plan preventative maintenance.',
      'Electrical or solar technician experience\nComfortable working on borehole pump sets\nAble to read a multimeter and fault find',
      'full_time', 'on_site', 320, 450, 1, '2026-12-24', 'hr@plumtreeagro.co.zw', '+263771234001', 'approved', 1, 203, '-2 days'],
  ];

  for (const j of jobs) {
    const [email, category, location, title, company, description, requirements, jobType, workMode, min, max, vacancies, deadline, cEmail, cPhone, status, featured, views, createdModifier] = j;
    insertJob.run(
      userIds[email], jobCategoryIds[category], locationIds[location], title, company, description, requirements,
      jobType, workMode, min, max, vacancies, deadline, cEmail, cPhone, status, featured, views, createdModifier
    );
  }
  db.prepare("UPDATE jobs SET rejection_reason = 'Position filled internally before shortlisting' WHERE status = 'rejected'").run();

  const insertProvider = db.prepare(
    `INSERT INTO providers (owner_id, category_id, location_id, business_name, tagline, description, services,
       phone, whatsapp, email, address, price_from, currency, years_experience, availability, status, verified, featured, views, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'USD', ?, ?, ?, ?, ?, ?, datetime('now', ?))`
  );

  const providers = [
    ['info@tshitshiboreholes.co.zw', 'Plumbing & Boreholes', 'Tshitshi', 'Tshitshi Borehole Services',
      'Borehole drilling and pump installation across Matabeleland South',
      'Family run drilling outfit with two rigs and a mobile compressor. We have drilled more than 400 boreholes in Plumtree, Bulilima, Mangwe and Mangwe district since 2011. We also do pump installation, tank stands and solar pumping systems.',
      'Borehole drilling and siting\nSubmersible pump installation\nSolar pumping systems\nTank stands and pipe laying\nBorehole flushing and rehabilitation',
      '+263772345101', '+263772345101', 'info@tshitshiboreholes.co.zw', 'Tshitshi Business Centre, Plumtree', 250, 15, 'available', 'approved', 1, 1, 1284, '-420 days'],
    ['dingumuzielectrical@example.com', 'Electrical & Solar', 'Dingumuzi', 'Dingumuzi Electrical Works',
      'Certified electrician and solar installer',
      'ZESA registered electrician offering house wiring, fault finding, solar inverter installation and appliance repair. We issue certificates of compliance for new buildings and rentals.',
      'House and shop wiring\nSolar inverter and battery installation\nCertificate of compliance inspections\nFault finding and rewiring\nAppliance repair',
      '+263772345102', '+263772345102', 'dingumuzielectrical@example.com', 'Dingumuzi, Plumtree', 40, 9, 'available', 'approved', 1, 0, 876, '-300 days'],
    ['shine@plumtreeshine.co.zw', 'Cleaning & Laundry', 'Plumtree Town', 'Plumtree Shine Cleaning',
      'Homes, offices and post-construction cleaning',
      'Cleaning crew of six with own equipment covering Plumtree town, Dingumuzi and Ndiweni. We specialise in end of tenancy deep cleans, post-construction clean up and weekly office contracts.',
      'Deep house cleaning\nPost-construction cleaning\nOffice cleaning contracts\nCarpet and upholstery shampoo\nLaundry and ironing',
      '+263772345103', '+263772345103', 'shine@plumtreeshine.co.zw', '12 Lobengula Street, Plumtree Town', 25, 6, 'available', 'approved', 0, 1, 654, '-260 days'],
    ['moyowelding@example.com', 'Welding & Metalwork', 'Ndiweni', 'Moyo Welding & Gates',
      'Custom gates, burglar bars and general welding',
      'Workshop in Ndiweni producing steel gates, window frames, carports and burglar bars. We measure on site, fabricate in the workshop and install with a two year workmanship guarantee.',
      'Sliding and swing gates\nBurglar bars and security doors\nCarports and roof trusses\nWindow frames\nOn site welding repairs',
      '+263772345104', '+263772345104', 'moyowelding@example.com', 'Ndiweni Industrial Site, Plumtree', 80, 12, 'busy', 'approved', 1, 0, 743, '-240 days'],
    ['bhangoevents@example.com', 'Events & Catering', 'Bhango', 'Bhango Events & Décor',
      'Tents, décor, catering and sound for every occasion',
      'Full event package covering weddings, funerals, church gatherings and corporate functions. We deliver anywhere in Matabeleland South and can cater for up to 500 guests.',
      'Tent and chair hire\nWedding décor and draping\nCatering and mobile kitchen\nSound system and DJ hire\nEvent coordination',
      '+263772345105', '+263772345105', 'bhangoevents@example.com', 'Bhango Market Centre, Plumtree', 120, 7, 'available', 'approved', 0, 1, 921, '-200 days'],
    ['hire@kalangatransport.co.zw', 'Transport & Moving', 'Plumtree Town', 'Kalanga Transport Hire',
      'Truck and bakkie hire including cross border runs',
      'Fleet of two 8 tonne trucks, three bakkies and a 30 seater bus. We do household removals, building material delivery and cross border errands to Botswana with all customs paperwork handled.',
      'Household and office removals\nBuilding material delivery\nCross border transport to Botswana\nBus hire for functions\nTipper hire for sand and gravel',
      '+263772345106', '+263772345106', 'hire@kalangatransport.co.zw', 'Plumtree Town Bus Terminus', 60, 11, 'available', 'approved', 1, 0, 1105, '-180 days'],
    ['sales@gwandasolar.co.zw', 'Electrical & Solar', 'Gwanda', 'Gwanda Solar Solutions',
      'Solar systems, inverters and batteries',
      'Solar engineering team serving Matabeleland South. We design and install off grid and hybrid systems for homes, clinics, boreholes and small businesses, and we stock spare batteries and controllers.',
      'Off grid solar system design\nHybrid inverter installation\nBattery bank assembly\nSolar borehole pumping\nSystem servicing and monitoring',
      '+263772345107', '+263772345107', 'sales@gwandasolar.co.zw', 'Joshua Mqabuko Street, Gwanda', 350, 10, 'available', 'approved', 1, 0, 832, '-150 days'],
    ['mangwegarden@example.com', 'Home & Garden', 'Mangwe', 'Mangwe Garden & Fencing',
      'Gardening, tree felling, fencing and pest control',
      'Grounds maintenance team for farms, schools and households. We install game fencing, clear invasive plants and run a pest control service for rodents and termites.',
      'Garden maintenance contracts\nTree felling and stump removal\nGame and security fencing\nRodent and termite control\nBorehole lawn irrigation setup',
      '+263772345108', '+263772345108', 'mangwegarden@example.com', 'Mangwe Rural Service Centre', 30, 5, 'available', 'approved', 0, 0, 388, '-120 days'],
    ['sibandaplumbing@example.com', 'Plumbing & Boreholes', 'Empandeni', 'Sibanda Plumbing',
      'Plumbing repairs, geysers and drainage',
      'Qualified plumber handling burst pipes, geyser replacement, toilet and drainage repairs. Emergency call outs available within 30km of Empandeni.',
      'Burst pipe repair\nGeyser installation and service\nToilet and cistern repair\nDrain and soakaway clearing\nWater tank plumbing',
      '+263772345109', '+263772345109', 'sibandaplumbing@example.com', 'Empandeni Shopping Centre', 20, 8, 'available', 'approved', 0, 0, 466, '-90 days'],
    ['figtreebeauty@example.com', 'Beauty & Wellness', 'Figtree', 'Figtree Beauty Studio',
      'Hair, nails and bridal make-up services',
      'Home based studio offering braiding, weaving, gel nails and bridal packages. We travel to Plumtree town for wedding bookings and offer mobile services for groups.',
      'Braiding and weaving\nGel and acrylic nails\nBridal make-up packages\nFacial treatments\nMobile group bookings',
      '+263772345110', '+263772345110', 'figtreebeauty@example.com', 'Figtree Railway Village', 15, 4, 'available', 'approved', 0, 0, 297, '-60 days'],
    ['bhangoevents@example.com', 'Agriculture Services', 'Bulilima', 'Bulilima Livestock Handling',
      'Cattle handling, dip tank and irrigation services',
      'Team of experienced stockmen offering cattle catching, dehorning, ear tagging and dip tank operation for farmers in Bulilima and Mangwe.',
      'Cattle catching and restraint\nDehorning and ear tagging\nDip tank operation\nIrrigation pipe repair\nLivestock transport loading',
      '+263772345111', '+263772345111', 'bulilimalivestock@example.com', 'Bulilima Ward 8, Plumtree', 25, 6, 'unavailable', 'pending', 0, 0, 41, '-2 days'],
    ['hire@kalangatransport.co.zw', 'Building & Renovation', 'Plumtree Town', 'Border Renovations',
      'Builders, plasterers, tilers and renovations',
      'Building contractor for house extensions, boundary walls, plastering, tiling and roofing repairs. We work on quotation with a 40 percent deposit.',
      'House extensions\nBoundary walls and gates\nPlastering and skimming\nFloor and wall tiling\nRoof repairs and waterproofing',
      '+263772345112', '+263772345112', 'borderrenovations@example.com', 'Plumtree Town Industrial Area', 100, 14, 'available', 'pending', 0, 0, 63, '-3 days'],
    ['mangwegarden@example.com', 'Cleaning & Laundry', 'Plumtree Town', 'Tshabalala Laundry Services',
      'Wash, dry, iron and delivery',
      'Laundry service collecting from Plumtree town, Dingumuzi and Ndiweni with 48 hour turnaround. Bulk pricing for lodges, clinics and hostels.',
      'Household laundry and ironing\nBulk linen for lodges and clinics\nDuvet and blanket washing\n48 hour turnaround\nFree collection in town',
      '+263772345113', '+263772345113', 'tshabalalalaundry@example.com', '7 Kingfisher Road, Plumtree Town', 10, 3, 'available', 'pending', 0, 0, 35, '-1 days'],
    ['hire@kalangatransport.co.zw', 'Real Estate Services', 'Plumtree Town', 'Plumtree Property Agents',
      'Sales, letting and property management',
      'Registered estate agency handling residential and commercial sales, letting and full property management across Plumtree and the border corridor. We handle viewings, tenant screening and monthly statements.',
      'Residential and commercial sales\nLetting and tenant screening\nProperty management and rent collection\nValuations for sale and insurance\nLease drafting and renewal',
      '+263772345114', '+263772345114', 'sales@plumtreeproperty.co.zw', '23 Fife Street, Plumtree Town', 0, 9, 'available', 'approved', 1, 1, 612, '-140 days'],
    ['admin@kalangahardware.co.zw', 'Retail & Wholesale', 'Plumtree Town', 'Kalanga Wholesale Depot',
      'Bulk building materials and trade counter',
      'Wholesale supply of cement, timber, roofing sheets, plumbing fittings and electrical sundries. Trade pricing for contractors with delivery across Bulilima, Mangwe and Tshitshi.',
      'Bulk cement and aggregates\nTimber and roofing sheets\nPlumbing and electrical sundries\nContractor trade accounts\nDelivery to surrounding wards',
      '+263772345115', '+263772345115', 'wholesale@kalangahardware.co.zw', 'Kalanga Hardware Yard, Plumtree Town', 0, 12, 'available', 'approved', 0, 0, 489, '-110 days'],
    ['dingumuzielectrical@example.com', 'ICT & Repairs', 'Dingumuzi', 'Dingumuzi Tech Repairs',
      'Computers, phones and appliances',
      'Repair bench for laptops, phones, printers and household appliances. We also do CCTV installation, network cabling and data recovery for small businesses.',
      'Laptop and desktop repair\nCellphone screen and battery replacement\nPrinter servicing and refills\nCCTV and network installation\nData backup and recovery',
      '+263772345116', '+263772345116', 'repairs@dingumuzitech.co.zw', 'Dingumuzi Shopping Centre', 15, 6, 'available', 'approved', 0, 0, 401, '-95 days'],
    ['moyowelding@example.com', 'Carpentry & Furniture', 'Ndiweni', 'Ndiweni Carpentry Works',
      'Fitted cupboards, doors and furniture',
      'Carpentry workshop producing fitted kitchen cupboards, wardrobes, doors, window frames and office furniture. We measure on site and deliver within the district.',
      'Fitted kitchens and wardrobes\nDoors and window frames\nRoof trusses and timber treatment\nOffice and school furniture\nOn site repairs',
      '+263772345117', '+263772345117', 'carpentry@ndiweniworks.co.zw', 'Ndiweni Industrial Site, Plumtree', 45, 10, 'available', 'approved', 0, 0, 377, '-85 days'],
    ['shine@plumtreeshine.co.zw', 'Business Services', 'Plumtree Town', 'Plumtree Business Services',
      'Accounting, printing and business support',
      'Bookkeeping, tax registration, company registration support, printing, binding and stationery for small businesses and community organisations.',
      'Bookkeeping and VAT returns\nCompany and NSSA registration support\nPrinting, binding and laminating\nBusiness plan writing\nTender document preparation',
      '+263772345118', '+263772345118', 'info@plumtreebiz.co.zw', '9 Lobengula Street, Plumtree Town', 20, 8, 'available', 'approved', 0, 1, 528, '-75 days'],
    ['bhangoevents@example.com', 'Security & Alarms', 'Plumtree Town', 'Border Security & Alarms',
      'Guarding, alarms and access control',
      'Manned guarding for businesses and residential stands plus alarm and camera installation. We run a 24 hour control room with a response vehicle covering Plumtree town.',
      'Manned guarding and patrols\nAlarm system installation\nCCTV and access control\nElectric fencing\n24 hour control room response',
      '+263772345119', '+263772345119', 'operations@bordersecurity.co.zw', 'Plumtree Town Industrial Area', 35, 13, 'available', 'approved', 0, 0, 445, '-70 days'],
    ['clinic@empandeni.co.zw', 'Health & Wellness Services', 'Empandeni', 'Empandeni Home Care',
      'Home nursing and mobile health services',
      'Home based care for elderly and recovering patients: wound dressing, medication support, mobility assistance and mobile blood pressure and sugar checks.',
      'Home nursing and wound care\nElderly and post operative care\nMedication reminders and support\nMobile vitals checks\nReferral to the mission clinic',
      '+263772345120', '+263772345120', 'homecare@empandeni.co.zw', 'Empandeni Mission Clinic, Plumtree', 25, 7, 'available', 'approved', 1, 0, 356, '-55 days'],
  ];

  const providerIds = [];
  for (const p of providers) {
    const [email, category, location, businessName, tagline, description, services, phone, whatsapp, pEmail, address, priceFrom, years, availability, status, verified, featured, views, createdModifier] = p;
    const info = insertProvider.run(
      userIds[email], serviceCategoryIds[category], locationIds[location], businessName, tagline, description, services,
      phone, whatsapp, pEmail, address, priceFrom, years, availability, status, verified, featured, views, createdModifier
    );
    providerIds.push(Number(info.lastInsertRowid));
  }
  db.prepare("UPDATE providers SET rejection_reason = 'Duplicate listing for the same business' WHERE status = 'rejected'").run();

  const insertReview = db.prepare('INSERT INTO reviews (provider_id, user_id, rating, comment, status, created_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\', ?))');
  const reviews = [
    [1, 'thandiwe@example.com', 5, 'They sited and drilled our borehole in two days and the water yield has held up through the dry season.', 'published', '-300 days'],
    [1, 'bongani@example.com', 4, 'Good work on the pump. They were a day late but kept us informed.', 'published', '-180 days'],
    [2, 'sipho@example.com', 5, 'Rewired our whole house and issued the compliance certificate the same week.', 'published', '-200 days'],
    [3, 'nomatter@example.com', 5, 'Our office contract has been running for a year without a single complaint.', 'published', '-150 days'],
    [4, 'thandiwe@example.com', 4, 'Strong gate and neat welding. Price was fair for the size.', 'published', '-120 days'],
    [5, 'bongani@example.com', 5, 'They catered our wedding for 300 guests and everything arrived on time.', 'published', '-100 days'],
    [6, 'sipho@example.com', 4, 'Truck was clean and the driver handled the border paperwork well.', 'published', '-90 days'],
    [7, 'nomatter@example.com', 5, 'Our clinic now runs the vaccine fridge on solar with no interruptions.', 'published', '-80 days'],
    [9, 'thandiwe@example.com', 4, 'Fixed a burst pipe late at night. Very responsive.', 'published', '-60 days'],
    [10, 'nomatter@example.com', 5, 'Loved my bridal make-up. Very professional.', 'published', '-40 days'],
    [1, 'sipho@example.com', 3, 'Second visit needed to get the pressure right but they did not charge extra.', 'published', '-30 days'],
  ];
  for (const [providerIdx, email, rating, comment, status, mod] of reviews) {
    insertReview.run(providerIds[providerIdx - 1], userIds[email], rating, comment, status, mod);
  }
  db.exec(`
    UPDATE providers SET
      rating_sum = (SELECT COALESCE(SUM(rating), 0) FROM reviews r WHERE r.provider_id = providers.id AND r.status = 'published'),
      rating_count = (SELECT COUNT(*) FROM reviews r WHERE r.provider_id = providers.id AND r.status = 'published');
  `);

  const insertApplication = db.prepare(
    `INSERT INTO applications (job_id, applicant_id, cover_letter, expected_salary, status, employer_note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now', ?))`
  );
  const applications = [
    [1, 'thandiwe@example.com', 'I have four years of retail and supervisory experience and I am used to coordinating small teams. I would welcome the chance to move into irrigation supervision.', 480, 'shortlisted', 'Strong interview, checking references.', '-7 days'],
    [1, 'sipho@example.com', 'I am hard working and have worked on farms around Matjinge since 2019.', 400, 'reviewing', null, '-5 days'],
    [3, 'thandiwe@example.com', 'I enjoy working with people and I am comfortable with booking systems from my retail job.', 260, 'interview', 'Interview booked for Friday.', '-9 days'],
    [3, 'nomatter@example.com', 'I am a recent school leaver and a fast learner. I am available immediately.', 220, 'submitted', null, '-4 days'],
    [5, 'nomatter@example.com', 'I completed a computer course at the Plumtree vocational centre and can type 35 words per minute.', 280, 'reviewing', null, '-3 days'],
    [7, 'sipho@example.com', 'I know building materials well from my bricklaying work and can handle cash.', 200, 'rejected', 'Looking for more retail experience.', '-2 days'],
    [9, 'bongani@example.com', 'I have cared for elderly relatives and completed a first aid course.', 320, 'shortlisted', 'Good references from the clinic volunteer work.', '-6 days'],
    [13, 'sipho@example.com', 'I am available for the road works team and I am physically fit.', 100, 'submitted', null, '-2 days'],
    [4, 'bongani@example.com', 'I have worked in lodge kitchens during the holiday season.', 150, 'withdrawn', 'Applicant withdrew, found other work.', '-3 days'],
  ];
  for (const [jobId, email, cover, salary, status, note, mod] of applications) {
    insertApplication.run(jobId, userIds[email], cover, salary, status, note, mod);
  }

  const insertRequest = db.prepare(
    `INSERT INTO service_requests (provider_id, requester_id, name, phone, email, service_needed, details, preferred_date, budget, status, response, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))`
  );
  const requests = [
    [1, 'sipho@example.com', 'Sipho Moyo', '+263771234056', 'sipho@example.com', 'Borehole drilling', 'We need a borehole at a new plot in Ndiweni. Looking for a 60 metre hole with a submersible pump.', '2026-11-25', 900, 'quoted', 'Quoted USD 880 including casing and pump installation.', '-8 days'],
    [2, 'thandiwe@example.com', 'Thandiwe Ncube', '+263771234057', 'thandiwe@example.com', 'Solar inverter installation', 'Want to install a 3kVA inverter with two batteries to cover lights and a fridge.', '2026-11-30', 650, 'contacted', 'Site visit arranged for Tuesday.', '-5 days'],
    [3, null, 'Rudo Chikafu', '+263771234058', 'rudo@example.com', 'Office cleaning contract', 'Weekly cleaning for a 6 room office in Plumtree town, every Saturday morning.', '2026-12-01', 120, 'new', null, '-2 days'],
    [5, 'nomatter@example.com', 'Nomatter Dube', '+263771234059', 'nomatter@example.com', 'Wedding décor and catering', 'Wedding for 200 guests in Bhango. Need tents, décor, catering and sound.', '2026-12-20', 2500, 'accepted', 'Deposit received, contract signed.', '-6 days'],
    [4, 'bongani@example.com', 'Bongani Tshuma', '+263771234060', 'bongani@example.com', 'Sliding gate fabrication', 'Need a 4 metre sliding gate for a residential stand in Ndiweni.', '2026-11-28', 500, 'completed', 'Gate installed and painted. Customer satisfied.', '-20 days'],
    [9, null, 'Grace Mbedzi', '+263771234061', 'grace@example.com', 'Geyser replacement', 'Old geyser burst and needs replacement before tenants move in.', '2026-11-20', 350, 'declined', 'Client postponed the move in date.', '-4 days'],
    [6, 'thandiwe@example.com', 'Thandiwe Ncube', '+263771234062', 'thandiwe@example.com', 'Truck hire for household move', 'Moving from Dingumuzi to Gwanda, need an 8 tonne truck and two loaders.', '2026-11-27', 300, 'contacted', 'Truck available, awaiting confirmation of date.', '-1 days'],
  ];
  for (const [providerIdx, requesterEmail, name, phone, email, service, details, date, budget, status, response, mod] of requests) {
    insertRequest.run(providerIds[providerIdx - 1], requesterEmail ? userIds[requesterEmail] : null, name, phone, email, service, details, date, budget, status, response, mod);
  }

  const insertSaved = db.prepare("INSERT INTO saved_items (user_id, item_type, item_id) VALUES (?, ?, ?)");
  insertSaved.run(userIds['thandiwe@example.com'], 'job', 1);
  insertSaved.run(userIds['thandiwe@example.com'], 'job', 3);
  insertSaved.run(userIds['thandiwe@example.com'], 'provider', 1);
  insertSaved.run(userIds['sipho@example.com'], 'job', 1);
  insertSaved.run(userIds['sipho@example.com'], 'provider', 4);
  insertSaved.run(userIds['nomatter@example.com'], 'provider', 10);

  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('site_name', 'Plumtree Connect')").run();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('province', 'Matabeleland South')").run();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('town', 'Plumtree')").run();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_approve_jobs', 'false')").run();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_approve_providers', 'false')").run();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('contact_email', 'hello@plumtreeconnect.co.zw')").run();

  const counts = {
    users: db.prepare('SELECT COUNT(*) AS n FROM users').get().n,
    jobs: db.prepare('SELECT COUNT(*) AS n FROM jobs').get().n,
    providers: db.prepare('SELECT COUNT(*) AS n FROM providers').get().n,
    applications: db.prepare('SELECT COUNT(*) AS n FROM applications').get().n,
    service_requests: db.prepare('SELECT COUNT(*) AS n FROM service_requests').get().n,
    reviews: db.prepare('SELECT COUNT(*) AS n FROM reviews').get().n,
    groups: db.prepare('SELECT COUNT(*) AS n FROM category_groups').get().n,
    categories: db.prepare('SELECT COUNT(*) AS n FROM categories').get().n,
  };
  // The bulk inserts above bypassed nothing, but rebuilding guarantees the
  // search index matches the rows exactly after a reseed.
  rebuildSearchIndex();
  return { seeded: true, counts };
}

module.exports = { seed };

if (require.main === module) {
  const force = process.argv.includes('--force');
  const result = seed({ force });
  console.log(JSON.stringify(result, null, 2));
}
