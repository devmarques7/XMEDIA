# Registo das invoices 2026 extraídas do Notion (Finance › Invoices) + PDFs originais. Gera data/invoices-2026.json.
# Regra: cada invoice regista o que FOI COBRADO nesse documento (excl. BTW). Pacotes em prestações mostram o âmbito
# completo + linhas negativas "already paid / billed separately", como nos PDFs originais (BALANCE PAID).
import json
N = "https://app.notion.com/p/"
C = {  # clientes (faturação)
 "gc":      {"name":"GC Clinic","address":"","country":"NL","vat":"","email":"info@gcclinic.nl"},
 "wj":      {"name":"WJ-EBIKES","address":"Diemen Stammerdijk 1 F\nDiemen","country":"NL","vat":"","email":"wjbikes@gmail.com","kvk":"75956446"},
 "viva":    {"name":"Viva Fashion B.V. — Attn. Vanessa Nantes","address":"Soestdijkerstraatweg 52\n1213 XD Hilversum","country":"NL","vat":"","email":"contact@vanessanantes.com","kvk":"99237172"},
 "carine":  {"name":"Carine Lopes Hairstudio — Attn. Carine Lopes","address":"Kapelstraat 12\n5591 HE Heeze","country":"NL","vat":"","email":"carinelopeshairstudio@gmail.com","kvk":"59932198"},
 "369":     {"name":"369 Premium Hair B.V. — Attn. Daniel Antonialli","address":"Amstelveen","country":"NL","vat":"","email":"daniel@gphairexperience.com"},
 "leticia": {"name":"Letícia Lana Carvalho da Silva","address":"1221 ER, 2A2\nHilversum","country":"NL","vat":"","email":"contato@whynotfly.com.br","bsn":"290311438"},
 "marcio":  {"name":"Marcio Luis Velter Filho","address":"São Paulo-SP\nCEP 04707-051","country":"BR","vat":"","email":"marcio.luisvelter@gmail.com"},
 "izabel":  {"name":"Izabel Cristina Soares Fernandes","address":"","country":"NL","vat":"","email":"izabel@withmeaning.co"},
 "jeffrey": {"name":"Jeffrey Chirino","address":"","country":"NL","vat":"","email":"jeffreychirino@gmail.com"},
 "donna":   {"name":"Donna Agency Marketing LTD — Attn. Juliana","address":"Rua Fonte da Saudade 111","country":"BR","vat":"CNPJ 47.635.524/0001-12","email":"juliana@donnagency.com"},
 "wagner":  {"name":"Wagner Moço de Souza","address":"","country":"NL","vat":"","email":"wagnermocodesouza@gmail.com"},
 "manuela": {"name":"Manuela Hugo Photography","address":"","country":"NL","vat":"NL267869873B01","email":"manuela.hugo@gmail.com"},
 "mavi":    {"name":"Maria Vitoria Mattoso (Mavi / Carioca Restaurant)","address":"","country":"NL","vat":"98719785","email":"management@cariocarestaurant.nl"},
 "frame":   {"name":"Caroline Palma Ucella & Felipe Fabris Studenroth","address":"Naell Tynnegieterstraat 29\n6821 EV Arnhem","country":"NL","vat":"","email":""},
 "brenda":  {"name":"Brenda Cristine Costa Machado","address":"","country":"NL","vat":"","email":""},
 "advent":  {"name":"Kerkgenootschap der Zevende-dags Adventisten — Attn. Tiago Pereira","address":"Netherlands","country":"NL","vat":"","email":"","kvk":"30279433"},
 "bueno":   {"name":"Schilderbedrijf Bueno","address":"Roggebotstraat 35\n1443 KL Purmerend","country":"NL","vat":"","email":"stefanyagarcez@outlook.com","kvk":"86004697"},
 "alexia":  {"name":"Alexia Waagmeester Mentoring","address":"","country":"NL","vat":"","email":"info@alexiawaagmeester.com"},
 "sanctum": {"name":"Sanctum BV — Attn. Luuk Melisse","address":"Singel 174\n1015 AJ Amsterdam\nNetherlands","country":"NL","vat":"","email":"luuk@wearesanctum.com"},
 "intuity": {"name":"Intuity Coaching — Attn. Leo Canali","address":"Carrer de l'Allada 21\n17230 Palamós, Spain","country":"ES","vat":"Y4143786M","email":""},
 "gustavo": {"name":"Gustavo Henrique Lda (Eichholtz)","address":"","country":"PT","vat":"PT518543471","email":"gustavohenriquepontes@gmail.com"},
 "apollo":  {"name":"Apollo GraphQL — Attn. Jonathan Gaston","address":"201 California St, Ste 630\nSan Francisco, CA 94111, USA","country":"US","vat":"","email":"jonny@apollographql.com"},
}
def i(d,q,r): return {"description":d,"qty":q,"rate":r}
INV = []
def add(key, number, date, status, cat, client, btw, items, note, page, file=None, costs=None, void=False, flags=None):
    INV.append({"key":key,"number":number,"issue_date":date,"status":status,"category":cat,"client":client,"btw":btw,"items":items,"note":note,"notion":N+page,"file":file,"costs":costs,"void":void,"flags":flags or []})

add("gc-001","Q1 - #001","2026-01-07","paid","content","gc",0,
    [i("® [MM] Plan — Social Media Kit (12 videos)",12,100), i("® Installment 1/3 — balance billed in installments 2/3 and 3/3",1,-800)],
    "Editing of the remaining 12 videos with proportional monthly deliveries through February. Cycle total €1,200 in three monthly installments of €400. Raw footage stored for 30 days after completion.",
    "2f51c41fbb3381149bc0e7f8f9159e69","q1-001-gc-clinic.pdf",200,
    flags=["Notion: Invoice Price €1,200 and Discount €200 — the PDF bills installment 1/3 (€400)."])
add("wj-002","Q1 - #002","2026-03-25","paid","software","wj",0,
    [i("® [MM] Software Architecture & Technical Planning",15,62.5), i("® [MM] Backend & API Development",22,62.5), i("® [MM] Frontend / Desktop Application Development",20,62.5), i("® [MM] System Integration, Testing & Optimization",13,62.5), i("® [MM] Deployment, Documentation & Project Delivery",10,62.5)],
    "Full scope of the software development project as agreed. Changes beyond the agreed scope are subject to separate quotation and approval.",
    "56e0fdeebaaa4bc3b51fd287837cf5db","q1-002-wj-bikes.pdf",1375,
    flags=["PDF lines €937.00 and €812.00 rounded down (15 h and 13 h × €62.50 = €937.50 / €812.50); total €5,000 unchanged.","Notion shows a €500 discount that is not on the PDF."])
add("viva-003","Q1 - #003","2026-03-12","draft","content","viva",0,
    [i("® [MM] Package / Flow — 3-month content production",3,1155.5), i("® Installment 1/3 — months 2 and 3 billed separately",1,-2311)],
    "Flow Plan — 3-month content production (strategy, production schedule, video treatment and social media). CANCELLED.",
    "3211c41fbb33803d95f4f1417e38ef11","q1-003-vanessa.pdf",101,void=True,
    flags=["Cancelled in Notion (Payment Status: Canceled) — kept for the record, excluded from totals."])
add("carine-004","Q1 - #004","2026-03-12","paid","content","carine",0,
    [i("® [MM] Plan Start package (3 months)",3,496.2), i("® Installment 1/3 — installments 2/3 and 3/3 billed separately",1,-992.4)],
    "Plan Start package: filmmaker, editing (2 simple + 1 complex reel, covers) and social media planning, per the agreed schedule and scope. Installment 1/3.",
    "3211c41fbb3380f9832fe27712c1f80d","q1-004-carine.pdf",67.38)
add("369-005","Q1 - #005","2026-03-15","paid","production","369",0,
    [i("® [MM] Plan B package — half-day filming & content library",1,650.5)],
    "Half-day filming session for capturing images and a content library.",
    "8bad3836ccc043619dd5049452afde06","q1-005-daniel-antonialli.pdf",189.25)
add("leticia-007","Q1 - #007","2026-03-30","paid","content","leticia",0,
    [i("® [MM] Plan Brand Foundation and Production",1,992.4)],
    "Plan Start package: 1 half-day filming session, 2 simple Reels + 1 complex Reel, customized Reel covers and monthly content calendar (scripts + visual curation). Installment 1/3 [#001].",
    "04142db55d5e498aa007d0625c11ff0b","q1-007-leticia.pdf",824)
add("marcio-008","Q1 - #008","2026-03-27","paid","production","marcio",0,
    [i("® [MM] Package / The Storytelling",1,685), i("® [MM] Storymaker — real-time content creation",1,150), i("® Discount (30%)",1,-250.5)],
    "Real-time content creation (Storymaker) with vertical capture and live delivery, plus The Storytelling package.",
    "c32a05d4057e4d8db29d1c59ddc03511","q1-008-marcio.pdf",150)
add("izabel-009","Q1 - #009","2026-03-30","paid","production","izabel",21,
    [i("® [MM] Editing / Social Media Content",1,150)],
    "Editing / Social Media Content, according to the agreed schedule and scope.",
    "ac52976551f34c0bb744febe542c1665","q1-009-izabel.pdf",0,
    flags=["PDF total €181.00 — 21% BTW on €150 is €31.50, so the correct total is €181.50."])
add("carine-004t","Q2 - #004 · Transport","2026-04-16","paid","expenses","carine",0,
    [i("® [MM] Transport — 322 km (fuel 20.125 L × €2.50)",1,50.31)],
    "Fuel cost: 161 km each way (322 km), 16 km/L, €2.50 per litre = €50.31.",
    "d177672546d24dc1b45cdd7aaa8d323d","q2-004-carine-transport.pdf",50.31)
add("carine-004b","Q2 - #004 (2/3)","2026-04-16","paid","content","carine",0,
    [i("® [MM] Plan Start package (3 months)",3,496.2), i("® Installment 1/3 — already paid",1,-496.2), i("® Installment 3/3 — billed separately",1,-496.2)],
    "Plan Start package — installment 2/3.",
    "d741694807dd45b58e1d5456d386f598","q2-004b-carine-2of3.pdf",112,
    flags=["Number Q2 - #004 is shared by three documents in Notion — suffixed here to keep each one unique."])
add("jeffrey-0014","Q2 - #0014","2026-04-21","paid","production","jeffrey",0,
    [i("® [MM] Package / The Essential — film coverage 2 h",1,454), i("® Discount",1,-254)],
    "Package The Essential: film coverage (2 hours).",
    "27e878d0e4924157bc7459595fc6f02f","q2-0014-jeffrey.pdf",0)
add("donna-015a","Q2 - #015 (1/2)","2026-04-23","paid","production","donna",21,
    [i("® [MM] Main Package — The Experience",1,685), i("® [MM] Upgrade — Storymaker",1,150), i("® [MM] Logistics — Keukenhof entry",1,32.5), i("® Installment 2/2 — billed separately (50%)",1,-433.75)],
    "Proposal Experience (Keukenhof): main package, Storymaker upgrade and logistics. Installment 1/2 (50%).",
    "88ee3da804014debb84ef3cf7353478a","q2-015a-donna.pdf",269)
add("donna-015b","Q2 - #015 (2/2)","2026-04-28","paid","production","donna",21,
    [i("® [MM] Main Package — The Experience",1,685), i("® [MM] Upgrade — Storymaker",1,150), i("® [MM] Logistics — Keukenhof entry",1,32.5), i("® Installment 1/2 — already paid (50%)",1,-433.75)],
    "Proposal Experience (Keukenhof) — installment 2/2.",
    "c764f034960f46fa952cb2bc686324f9","q2-015b-donna.pdf",0)
add("leticia-011","Q2 - #011","2026-05-01","paid","content","leticia",0,
    [i("® [MM] Maintenance & Production",1,496.2)],
    "Plan Start package — maintenance & production (monthly).",
    "4972cfa6fcce4ca6b71ec7410813279d","q2-011-leticia.pdf",None)
add("wagner-018","Q2 - #018","2026-04-28","paid","production","wagner",21,
    [i("® [MM] Filmmaker overtime",3,85.4), i("® [MM] Storymaker / social media overtime",3,25), i("® [MM] Team meals",1,38.45)],
    "Overtime: filmmaker 3 h at €85.40/h, social media 3 h at €25.00/h, plus team meals.",
    "6be85c9c22a6429aa132e887a52e9737","q2-018-wagner.pdf",113.45)
add("jeffrey-0017","Q2 - #0017","2026-04-29","paid","production","jeffrey",0,
    [i("® [MM] Photography session (1 h)",1,122), i("® [MM] Photography overtime",1,85.4)],
    "Photography session (1 hour) plus overtime.",
    "2a64ff494e6e4b8e994b6b6c5f007537","q2-0017-jeffrey.pdf",0,
    flags=["PDF shows €244.00 on the 1 × €122 line; the invoice total €207.40 is correct."])
add("manuela-0018v1","Q2 - #0018 (v1)","2026-05-05","draft","production","manuela",0,
    [i("® [MM] Video Production & Filming (PRO)",4,85), i("® [MM] Post-Production & Creative Editing",2,85), i("® [MM] Extra Cinematic Clips (B-Roll)",1,150)],
    "First version of invoice Q2 - #0018 — superseded by the €855 version (discount + deposit).",
    "49a4b92509a04dd3a4819782e173bf40","q2-0018a-manuela-660.pdf",None,void=True,
    flags=["Two Notion entries for Q2 - #0018 (both marked Paid, €660 and €855). The €855 version (€584 + €100 deposit = €684 received) is kept as the valid one; this one is marked superseded so it is not counted twice."])
add("manuela-0018","Q2 - #0018","2026-05-05","paid","production","manuela",0,
    [i("® [MM] Video Production & Filming (PRO)",2,122), i("® [MM] Post-Production & Creative Editing (3.69 h)",1,451), i("® [MM] Travel & Logistics",1,40), i("® [MM] Extra Cinematic Clips (B-Roll)",1,120), i("® Discount (20%)",1,-171), i("® Deposit — already paid",1,-100)],
    "Post-production hours rounded to 3.69 to align the gross subtotal for the requested final balance. Amount to be paid after discount and €100 deposit: €584.00.",
    "9b158c1124094e2199638b3dbe16396e","q2-0018b-manuela-855.pdf",171)
add("mavi-0020","Q2 - #0020","2026-05-13","paid","content","mavi",0,
    [i("® [MM] Plan Essencial package (3 months)",3,500), i("® Installments 2/3 and 3/3 — billed separately",1,-1000)],
    "Monthly service agreement: audiovisual production, photography, strategic content creation and brand positioning. Installment 1/3.",
    "d2593232c6af48c696dc7a380f4e3965","q2-0020-mavi.pdf",374)
add("carine-004c","Q2 - #004 (3/3)","2026-05-16","paid","content","carine",0,
    [i("® [MM] Plan Start package (3 months)",3,496.2), i("® Installments 1/3 and 2/3 — already paid",1,-992.4)],
    "Plan Start package — installment 3/3.",
    "85bb307a78d0414f9f47e32c2b1c4d11","q2-004c-carine-3of3.pdf",67.5)
add("carine-023","Q2 - #023","2026-05-20","paid","expenses","carine",0,
    [i("® [MM] Transport — 322 km (fuel)",1,50.13)],
    "Fuel cost: 322 km at 16 km/L, €2.50 per litre.",
    "9863b1388d254698b4ee662015689c48","q2-023-carine.pdf",0,
    flags=["PDF charges €50.13 but its own calculation gives €50.31 (20.125 L × €2.50)."])
add("frame-024","Q2 - #024","2026-05-20","paid","production","frame",0,
    [i("® [MM] Storytelling Package — Wedding Filming Services",1,2515.5), i("® Installments 2/3 (30%) and 3/3 (20%) — billed separately",1,-1257.75)],
    "Installment 1/3 (50%) to reserve the date and commence services for the wedding on 18/06/2026. [FRAMEYOURSTORY]",
    "6e1e45cb64f742e3bdadc5d4624fdf6b","q2-024-frame-1of3.pdf",900)
add("frame-025","Q2 - #025","2026-06-08","paid","production","frame",0,
    [i("® [MM] Storytelling Package — Wedding Filming Services",1,2515.5), i("® Installment 1/3 (50%) — already paid",1,-1257.75), i("® Installment 3/3 (20%) — billed separately",1,-503.1)],
    "2nd installment (30%) of Caroline & Felipe's wedding film. [FRAMEYOURSTORY]",
    "14945bf0146147819f7ce3c3953f592e","q2-025-frame-2of3.pdf",None)
add("mavi-0022","Q2 - #0022","2026-06-13","paid","content","mavi",0,
    [i("® [MM] Plan Essencial package (3 months)",3,500), i("® Installment 1/3 — already paid",1,-500), i("® Installment 3/3 — billed separately",1,-500)],
    "Monthly service agreement — installment 2/3.",
    "060a5e1eef4f4627a1882a54484ea8b4","q2-0022-mavi.pdf",0)
add("wagner-028","Q2 - #028","2026-06-22","paid","production","wagner",21,
    [i("® [MM] Extra Cinematic Clips (B-Roll)",30,25), i("® Discount",1,-450)],
    "Extra cinematic clips (B-roll).",
    "5c758727baec4a9c8131f35cc88883a3","q3-028-wagner.pdf",None,
    flags=["Notion title says Q3 - #028 and Client ID Q3 - #029; the PDF says Q2 - #028 (22 Jun) — registered as Q2 - #028."])
add("brenda-0029","Q2 - #0029","2026-06-26","paid","mentoring","brenda",0,
    [i("® [MM] Mentoria M/Mentor®",6,458.5), i("® Installments 2/3 and 3/3 — billed separately",1,-1834)],
    "First installment (€917.00), due upon submission of the signed contract (Clause 3.2). Total programme: 3 × €917.00 = €2,751.00.",
    "07e8d413cb3a4ea38f3c88f2f8c57236","q2-0029-brenda.pdf",300)
add("mavi-0021","Q2 - #0021","2026-06-27","paid","content","mavi",21,
    [i("® [MM] Plan Essencial package (3 months)",3,500), i("® Installments 1/3 and 2/3 — already paid",1,-1000)],
    "Monthly service agreement — installment 3/3 (21% BTW applied).",
    "3661c41fbb33803c8063e6cfb37df18a","q2-0021-mavi.pdf",150,
    flags=["The PDF shows ID Q3 - #0037; Notion records it as Q2 - #0021 (kept)."])
add("carine-035","Q3 - #035","2026-06-26","paid","expenses","carine",0,
    [i("® [MM] Plan Start package — travel costs",1,50.13)],
    "Plan Start package — travel costs (no PDF attached in Notion).",
    "cfcd77e7bc2246b8b2b8737e26830774",None,None,
    flags=["No PDF in Notion; issue date estimated as 5 days before the due date (1 Jul)."])
add("advent-0035","Q3 - #0035","2026-07-02","paid","software","advent",21,
    [i("® [MM] Baseline MVP — Scope Refinement & Workflow Mapping",30,30), i("® [MM] Baseline MVP — Database Structure & Role Authentication",55,30), i("® [MM] Baseline MVP — UI Implementation & Multilingual Support",75,30), i("® [MM] Baseline MVP — Core System Validation & Excel Reporting",30,30), i("® [MM] Code Review & Strategy",35,30)],
    "Development of the adventistgroei.nl ecosystem with technical management, scope refinements and architecture optimisation: subsidy analysis workflow, evangelism reporting and multilingual integration across the MVP. 225 h at €30.00/h.",
    "4065c14f323249ccbb4540d61defee06","q3-0035-adventisten.pdf",1009,
    flags=["Client email in Notion is 'tpereira.adventist.nl' (not a valid address) — left empty."])
add("leticia-033","Q3 - #033","2026-07-06","paid","content","leticia",0,
    [i("® [MM] Maintenance & Production",1,496.2)],
    "Maintenance & production (monthly).",
    "86673832f9104cdd9508bb598a3a4080","q3-033b-leticia-maint.pdf",None)
add("leticia-033t","Q3 - #033 · Travel","2026-07-06","paid","expenses","leticia",0,
    [i("® [MM] Travel & Production Logistics",1,31.4)],
    "Travel & production logistics.",
    "615eecf9b9f043238e5944c1d8a7c2ee","q3-033a-leticia-travel.pdf",None)
add("bueno-036","Q3 - #036","2026-07-08","paid","content","bueno",21,
    [i("® [MM] The Storytelling | Social Media Plan — month 1",1,1034.3)],
    "Month 1 of the “The Storytelling” plan per the Service Agreement. Payment due on the fixed monthly billing date regardless of flexible scheduling of on-site sessions (Section 3). Installment 1/2.",
    "f4b40257e73645569a948c036889b92c","q3-036-bueno.pdf",605)
add("brenda-0030","Q3 - #0030","2026-07-30","paid","mentoring","brenda",21,
    [i("® [MM] Mentoria M/Mentor®",6,458.5), i("® Installment 1/3 — already paid",1,-917), i("® Installment 3/3 — billed separately",1,-917)],
    "Second installment (€917.00 + 21% BTW) per Clause 3.2. BTW applies to this and subsequent installments.",
    "28d0b578f5dd47c5b0f7cc6d397f9a68","q3-0030-brenda.pdf",450)
add("frame-026","Q3 - #026","2026-08-18","paid","production","frame",0,
    [i("® [MM] Storytelling Package — Wedding Filming Services",1,2515.5), i("® Installments 1/3 and 2/3 — already paid",1,-2012.4)],
    "3rd and final installment (20%) of Caroline & Felipe's wedding film. [FRAMEYOURSTORY]",
    "a6147a34522b4c08b5f6c377042f66c5","q3-026-frame-3of3.pdf",None)
add("alexia-0037","Q3 - #0037","2026-08-22","paid","production","alexia",21,
    [i("® [MM] Capturing PRO — 5 h",5,140), i("® [MM] Editing — 3 medium videos",3,95), i("® [MM] Editing — 1 complex video",1,185), i("® [MM] Travel (55 min + fuel)",1,115), i("® Discount",1,-555), i("® Installment 2/2 — billed separately (50%)",1,-365)],
    "5 hours of on-location production, capturing 4 videos (3 medium + 1 complex). Installment 1/2.",
    "3c61c41fbb3380d28011d3473bef1a6c","q3-0037-alexia.pdf",60,
    flags=["PDF rate shows €140.50/h but the line total is €700 (5 × €140) — registered at €140."])
add("bueno-037","Q3 - #037","2026-08-26","paid","content","bueno",21,
    [i("® [MM] The Storytelling | Social Media Plan — month 2",1,1034.3)],
    "Month 2 of the “The Storytelling” plan per the Service Agreement. Installment 2/2.",
    "e63a9222e03d4b478484cfc429c62e65","q3-037-bueno.pdf",None,
    flags=["PDF shows ID Q3 - #0038 (same number as Sanctum) and the note says 'Month 1'; Notion Client ID is Q3 - #037 — registered as Q3 - #037, month 2."])
add("brenda-0031","Q3 - #0031","2026-08-26","paid","mentoring","brenda",21,
    [i("® [MM] Mentoria M/Mentor®",6,458.5), i("® Installments 1/3 and 2/3 — already paid",1,-1834)],
    "Last installment (€917.00 + 21% BTW) per the signed contract.",
    "97f157a2efa5402682a8a95cb6099b0e","q3-0031-brenda.pdf",None)
add("sanctum-0038","Q3 - #0038","2026-09-03","paid","production","sanctum",21,
    [i("® [MM] Production Package / Personal Brand",40,40), i("® [MM] Production Day / On-Location",1,300), i("® [MM] Production Day / Transport Costs (receipts)",1,23.24)],
    "Retainer weeks under the Services Agreement (10 Aug 2026) — 4 weeks × up to 10 h (W35–W38) — plus the on-location production day of 2 Sep 2026 and public transport receipts (Spijkenisse–Rotterdam €3.21, Rotterdam–Amsterdam Zuid €17.80, Amsterdam Zuid–Rokin €2.23; total €23.24).",
    "a1520431eaa54420b9fe38e47585b50a","q3-0038-sanctum.pdf",None)
add("intuity-0039","Q3 - #0039","2026-09-03","paid","production","intuity",21,
    [i("® [MM] Production Package | Class Library",1,749), i("® [MM] Post-production | Colour grading + organisation",1,314), i("® [MM] Production Day | Transport (100 km × €0.40)",1,40), i("® [MM] Production Day | Parking (6 h × €7.50)",1,45), i("® Balance 50% — invoice 2/2 after delivery",1,-574)],
    "Invoice 1 of 2 under the Services Agreement for the 27 September 2026 production: camera + sound coverage, colour grading and content assembly. Travel and parking at real cost (zero markup), adjusted on the final invoice.",
    "9579abc4f51042eab3b7d634b3e94299","q3-0039-intuity.pdf",85,
    flags=["Client in Spain (B2B): 21% Dutch BTW was charged as on the original; reverse charge may apply — check with the accountant."])
add("gustavo-0040","Q3 - #0040","2026-09-08","sent","production","gustavo",21,
    [i("® [MM] Filming Production",6,114), i("® [MM] Editing Production | Same-day urgency",1,337), i("® [MM] Editing Production | Reel PRO — complete edit (×2)",1,270), i("® [MM] Travel costs",1,60), i("® Commercial discount",1,-431)],
    "6 h production (2 h initial + 4 h additional), capture PRO at table rate (€114/h). Commercial discount applied to close the project, as agreed on 08/09/2026.",
    "0801afb6ed1743dbb95deb4d945ad084","q3-0040-eichholtz.pdf",60,
    flags=["Original PDF does not add up (subtotal €1,351, discount €706, BTW €193.20, total €1,113.20; extra-reel line €275/€60). Re-stated with a €431 discount so subtotal €920 + BTW €193.20 = €1,113.20 (the amount billed).","Still 'Sent' in Notion — due 13 Sep 2026 (overdue).","Address on the PDF is the Intuity address (copy error) — removed."])
add("apollo-0041","Q3 - #0041","2026-09-14","sent","production","apollo",21,
    [i("® [MM] Production Support | Interview shoot day",1,550), i("® [MM] Production Package | DP & lighting support",1,150)],
    "Customer interview filming featuring Booking.com, Netflix, Wayfair and N-able: DP support and full lighting setup for 3 interviews (~45 min–1 h each). Filmed on 14/09/2026 at The Gallery, Kerkstraat 61, Amsterdam. Ref. INV-APOLLO-20260914.",
    "42c581ba2e0945adaee30415e3e8acd2","q3-0041-apollo.pdf",0,
    flags=["Notion status 'Sent' while the PDF is stamped 'PAID — €847.00' — confirm and mark as paid."])
add("alexia-0043","Q3 - #0043","2026-09-27","paid","production","alexia",21,
    [i("® [MM] Capturing PRO — 5 h",5,140), i("® [MM] Editing — 3 medium videos",3,95), i("® [MM] Editing — 1 complex video",1,185), i("® [MM] Travel (55 min + fuel)",1,115), i("® Discount",1,-555), i("® Installment 1/2 — already paid (50%)",1,-365)],
    "Installment 2/2 — 5 hours of on-location production, 4 videos (3 medium + 1 complex).",
    "a5301906498e4ec68743c373a05f777f",None,60,
    flags=["No PDF in Notion; issue date estimated as 5 days before the due date (2 Oct)."])

json.dump({"clients":C,"invoices":INV},open("data/invoices-2026.json","w"),ensure_ascii=False,indent=1)
print(len(INV))
