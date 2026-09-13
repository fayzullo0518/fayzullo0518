/**
 * Uch bosqichli klassifikatsiya (three-level classification).
 *
 *   1) Yo‘nalish      — the medical field the device belongs to
 *   2) Bo‘lim         — the equipment group inside that field
 *   3) Punkt          — the exact device type inside that group
 *
 * Every monitored asset stores the three ids it was filed under, so the whole
 * fleet can be sliced by field, by group or by exact device type — and the
 * same tree is what the Excel export is built from.
 */

/** slug helper, so the ids stay readable in db.json and in the Excel sheet */
const slug = (value) =>
  String(value)
    .toLowerCase()
    .replace(/[‘’ʻ']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

/** [id, yo‘nalish, [[bo‘lim, [punkt, punkt, …]], …]] */
const TREE = [
  [
    'radiology',
    'Radiologiya va tibbiy tasvirlash',
    [
      [
        'Magnit-rezonans tomografiya (MRT)',
        [
          'Ochiq doimiy magnitli MRT (0.3–0.5 T)',
          'Supero‘tkazuvchi yopiq MRT (1.5 T)',
          'Supero‘tkazuvchi yopiq MRT (3.0 T)',
          'MRT qabul qiluvchi g‘altaklari (coil)',
          'MRT uchun geliy va sovutish tizimi',
        ],
      ],
      [
        'Kompyuter tomografiyasi (KT)',
        [
          '16 kesimli KT',
          '32 kesimli KT',
          '64 kesimli KT',
          '128 va undan yuqori kesimli KT',
          'Konus-nurli KT (CBCT)',
          'Avtomatik kontrast inyektori',
        ],
      ],
      [
        'Rentgen tizimlari',
        [
          'Statsionar raqamli rentgen (DR)',
          'Analog rentgen apparati',
          'Ko‘char (mobil) rentgen apparati',
          'C-simon rentgen (C-arm)',
          'Mammografiya tizimi',
          'Flyuorografiya tizimi',
          'Tekis panelli detektor (FPD)',
          'Rentgen naychasi va generatori',
        ],
      ],
      [
        'Angiografiya (DSA)',
        ['Bir tekislikli angiograf', 'Ikki tekislikli angiograf', 'Gibrid operatsiya angiografi'],
      ],
      ['Yadro tibbiyoti', ['Gamma-kamera / SPECT', 'PET-KT tizimi', 'Radioizotop kalibratori']],
      [
        'Tasvirni qayta ishlash va arxiv',
        [
          'PACS serveri',
          'Diagnostik ish stansiyasi',
          'DICOM tibbiy printer',
          'Negatoskop (tasvir ko‘rish yoritgichi)',
        ],
      ],
      [
        'Nurdan himoya',
        [
          'Qo‘rg‘oshinli fartuk va himoya vositalari',
          'Dozimetr va radiatsiya nazorati',
          'Himoya shirmasi va oynasi',
        ],
      ],
    ],
  ],
  [
    'ultrasound',
    'Ultratovush diagnostikasi',
    [
      [
        'Statsionar ultratovush tizimlari',
        [
          'Premium klass rangli dopler',
          'O‘rta klass rangli dopler',
          'Boshlang‘ich klass rangli dopler',
        ],
      ],
      [
        'Ko‘char ultratovush tizimlari',
        ['Notebook (laptop) USI', 'Qo‘l USI skaneri (handheld)', 'Veterinar / dala USI'],
      ],
      [
        'Ixtisoslashgan ultratovush',
        [
          'Exokardiografiya tizimi',
          'Akusherlik-ginekologik 4D/5D tizimi',
          'Urologik ultratovush tizimi',
          'Ko‘z (oftalmologik) USI — A/B skan',
          'Ultratovush elastografiyasi',
        ],
      ],
      [
        'Datchiklar va aksessuarlar',
        [
          'Konveks datchik',
          'Lineyar datchik',
          'Sektor (fazali) datchik',
          'Transvaginal datchik',
          'Transrektal datchik',
          'Endoskopik (TEE) datchik',
          'Biopsiya adapteri va gel isitgichi',
        ],
      ],
    ],
  ],
  [
    'laboratory',
    'Laboratoriya diagnostikasi',
    [
      [
        'Klinik biokimyo',
        [
          'To‘liq avtomat biokimyoviy analizator',
          'Yarim avtomat biokimyoviy analizator',
          'Elektrolit analizatori (ISE)',
          'Qon gazlari analizatori',
          'Glikirlangan gemoglobin (HbA1c) analizatori',
        ],
      ],
      [
        'Gematologiya',
        [
          '3-differensialli gematologik analizator',
          '5-differensialli gematologik analizator',
          'Koagulometr (gemostaz analizatori)',
          'ECHT (SOE) analizatori',
          'Qon guruhini aniqlash tizimi',
        ],
      ],
      [
        'Immunologiya va gormonlar',
        [
          'Xemilyuminessent immunoanalizator (CLIA)',
          'IFA (ELISA) mikroplanshet rideri',
          'Mikroplanshet yuvgichi',
          'Tez test analizatori (POCT)',
        ],
      ],
      [
        'Mikrobiologiya va molekulyar diagnostika',
        [
          'Real-time PCR amplifikatori',
          'Nuklein kislota ekstraktori',
          'Bakteriologik inkubator',
          'Avtomatik qon ekish tizimi',
          'Antibiotikogramma analizatori',
          'Laminar shkaf (I/II/III klass)',
        ],
      ],
      [
        'Mikroskopiya va gistologiya',
        [
          'Binokulyar biologik mikroskop',
          'Trinokulyar tadqiqot mikroskopi',
          'Flyuoressent mikroskop',
          'Invertirlangan mikroskop',
          'Rotatsion mikrotom',
          'Kriostat',
          'Gistoprotsessor va parafin stansiyasi',
          'Bo‘yash (staining) avtomati',
        ],
      ],
      [
        'Umumklinik va urinalizatsiya',
        [
          'Siydik analizatori (tahlil chiziqli)',
          'Siydik cho‘kmasi analizatori',
          'Spermogramma analizatori',
        ],
      ],
      [
        'Namuna tayyorlash uskunalari',
        [
          'Stol usti sentrifuga',
          'Sovutgichli sentrifuga',
          'Mikrosentrifuga',
          'Vorteks va shaker',
          'Termostat / suv hammomi',
          'Distillyator va deionizator',
          'Analitik va texnik tarozi',
          'pH-metr',
          'Spektrofotometr',
          'Avtomatik pipetka va dispenser',
        ],
      ],
      [
        'Saqlash va sovutish',
        [
          'Laboratoriya muzlatgichi (+2…+8 °C)',
          'Chuqur muzlatgich (−20 °C)',
          'Ultra chuqur muzlatgich (−86 °C)',
          'Qon banki muzlatgichi',
          'Kriogen saqlash idishi',
        ],
      ],
    ],
  ],
  [
    'functional',
    'Funksional diagnostika',
    [
      [
        'Kardiologik diagnostika',
        [
          '1/3/6 kanalli EKG apparati',
          '12 kanalli EKG apparati',
          'Holter EKG monitori',
          'Sutkalik arterial bosim monitori (SMAD)',
          'Yurak stress-test tizimi (treadmill/veloergometr)',
        ],
      ],
      [
        'Nevrologik diagnostika',
        [
          'Elektroensefalograf (EEG)',
          'Elektromiograf (EMG/ENMG)',
          'Uyqu (polisomnografiya) tizimi',
        ],
      ],
      ['Nafas olish diagnostikasi', ['Spirometr', 'Bodipletizmograf', 'Pulsoksimetr', 'Kapnograf']],
    ],
  ],
  [
    'or-icu',
    'Operatsiya, reanimatsiya va shoshilinch yordam',
    [
      [
        'Anesteziologiya',
        [
          'Anesteziya apparati (ventilyatorli)',
          'Anesteziya gaz monitori',
          'Bug‘latgich (vaporizator)',
          'Anesteziya gazini chiqarib yuborish tizimi',
        ],
      ],
      [
        'Sun’iy nafas oldirish',
        [
          'Reanimatsiya ventilyatori (kattalar)',
          'Neonatal / pediatrik ventilyator',
          'Transport ventilyatori',
          'Yuqori oqimli kislorod terapiyasi (HFNC)',
          'CPAP / BiPAP apparati',
        ],
      ],
      [
        'Monitoring',
        [
          'Bemor monitori (kompakt)',
          'Modulli reanimatsiya monitori',
          'Markaziy monitoring stansiyasi',
          'Telemetriya tizimi',
          'Yurak chiqishi (gemodinamika) monitori',
        ],
      ],
      [
        'Operatsiya xonasi jihozlari',
        [
          'Elektromexanik operatsiya stoli',
          'Gidravlik operatsiya stoli',
          'Operatsiya chiroqlari (LED)',
          'Shiftga o‘rnatiladigan konsol (pendant)',
          'Operatsiya mikroskopi',
          'Elektrokoagulyator (diatermiya)',
          'Ultratovushli skalpel',
          'Argon-plazmali koagulyator',
          'Laparoskopik ustun (rack)',
          'Xirurgik aspirator (so‘rg‘ich)',
          'Jarrohlik asboblari to‘plami',
          'Turniket (jgut) tizimi',
        ],
      ],
      [
        'Shoshilinch yordam va jonlantirish',
        [
          'Defibrillyator-monitor',
          'Avtomatik tashqi defibrillyator (AED)',
          'Avtomatik yurak massaji apparati (CPR)',
          'Reanimatsiya aravachasi (crash cart)',
          'Laringoskop va intubatsiya to‘plami',
          'Transport nosilkasi',
        ],
      ],
      [
        'Infuziya va qon tozalash',
        [
          'Shpritsli infuzomat',
          'Volumetrik infuzion nasos',
          'Enteral ovqatlantirish nasosi',
          'Gemodializ apparati',
          'Teskari osmos suv tayyorlash tizimi',
          'Qon isitgichi va infuziya isitgichi',
        ],
      ],
    ],
  ],
  [
    'gynecology',
    'Akusherlik, ginekologiya va neonatologiya',
    [
      [
        'Tug‘ruq va ko‘rik jihozlari',
        [
          'Transformer tug‘ruq karavoti',
          'Ginekologik ko‘rik kreslosi',
          'Kolposkop',
          'Tug‘ruq to‘plami va vakuum-ekstraktor',
        ],
      ],
      ['Homila monitoringi', ['Fetal dopler', 'Kardiotokograf (KTG)', 'Egizak KTG tizimi']],
      [
        'Neonatologiya',
        [
          'Chaqaloq inkubatori',
          'Transport inkubatori',
          'Ochiq reanimatsiya tizimi (infant warmer)',
          'Fototerapiya apparati',
          'Sariqlikni o‘lchagich (bilirubinometr)',
          'Neonatal CPAP apparati',
          'Chaqaloq tarozisi',
          'Chaqaloq karavoti (beshik)',
        ],
      ],
      [
        'Reproduktiv tibbiyot',
        ['EKO laminar ish o‘rni', 'CO₂ inkubator', 'Embriologik mikroskop', 'Kriosaqlash tizimi'],
      ],
    ],
  ],
  [
    'endoscopy',
    'Endoskopiya',
    [
      [
        'Egiluvchan endoskopiya',
        [
          'Videogastroskop',
          'Videokolonoskop',
          'Videobronxoskop',
          'Duodenoskop',
          'Videoprotsessor va yorug‘lik manbai',
        ],
      ],
      [
        'Qattiq endoskopiya',
        [
          'Laparoskopiya to‘plami',
          'Gisteroskopiya to‘plami',
          'Sistoskopiya / urologiya to‘plami',
          'Artroskopiya to‘plami',
          'LOR endoskopiya to‘plami',
          'Proktoskopiya to‘plami',
        ],
      ],
      [
        'Endoskopiya yordamchi jihozlari',
        [
          'Insufflyator (CO₂)',
          'Endoskopik nasos va irrigator',
          'Endoskop yuvish va dezinfeksiya avtomati',
          'Endoskop saqlash shkafi',
          'Endoskopik asboblar to‘plami',
        ],
      ],
    ],
  ],
  [
    'dental',
    'Stomatologiya',
    [
      [
        'Stomatologik ish o‘rni',
        [
          'Stomatologik ustanovka (kreslo)',
          'Portativ stomatologik ustanovka',
          'Shifokor va yordamchi stullari',
        ],
      ],
      [
        'Stomatologik tasvirlash',
        [
          'Vizograf (intraoral rentgen)',
          'Ortopantomograf (OPG)',
          'Stomatologik CBCT',
          'Intraoral skaner',
        ],
      ],
      [
        'Davolash uskunalari',
        [
          'Stomatologik mikromotor va nakonechnik',
          'Ultratovushli skayler',
          'Fotopolimer lampa',
          'Apeks lokator',
          'Endodontik motor',
          'Stomatologik lazer',
        ],
      ],
      [
        'Stomatologik laboratoriya',
        [
          'Gips modellari uchun trimer',
          'Vakuum aralashtirgich',
          'Bug‘ generatori (steam cleaner)',
          'Quyish (casting) pechi',
          'Stomatologik 3D printer va frezer',
        ],
      ],
      [
        'Stomatologik infeksiya nazorati',
        [
          'Stomatologik avtoklav (B klass)',
          'Muhrlash (sealing) apparati',
          'Suv distillyatori',
          'Steril saqlash shkafi',
        ],
      ],
    ],
  ],
  [
    'ent-optometry',
    'LOR va oftalmologiya (optometriya)',
    [
      [
        'LOR diagnostikasi',
        [
          'Audiometr',
          'Timpanometr / impedansometr',
          'Otoakustik emissiya tizimi',
          'LOR endoskop va kamera',
        ],
      ],
      [
        'LOR davolash jihozlari',
        [
          'LOR kombayn (ish o‘rni)',
          'LOR kreslosi',
          'Nazal ingalyator va nebulayzer',
          'LOR koagulyatori',
          'Quloq yuvish tizimi',
        ],
      ],
      [
        'Optometriya va refraksiya',
        [
          'Avtorefraktokeratometr',
          'Foropter (avtomatik/qo‘l)',
          'Linzametr (lensmeter)',
          'Ko‘rish tablitsasi proyektori',
          'Optik linza kesish (edger) stanogi',
          'Optometriya stoli va bloki',
        ],
      ],
      [
        'Oftalmologik diagnostika',
        [
          'Yoriq lampa (shchelevaya lampa)',
          'Fundus kamera',
          'Optik kogerent tomograf (OCT)',
          'Ko‘z ichi bosimini o‘lchagich (tonometr)',
          'Perimetr (ko‘rish maydoni)',
          'Pahimetr va biometr',
        ],
      ],
      [
        'Oftalmologik jarrohlik',
        [
          'Fakoemulsifikator',
          'Vitrektomiya tizimi',
          'Oftalmologik lazer (YAG/SLT)',
          'Oftalmologik operatsiya mikroskopi',
        ],
      ],
    ],
  ],
  [
    'physio',
    'Fizioterapiya va reabilitatsiya',
    [
      [
        'Apparat fizioterapiyasi',
        [
          'Magnitoterapiya apparati',
          'Ultratovush terapiyasi apparati',
          'Elektroterapiya (SMT/DDT) apparati',
          'Lazer terapiyasi apparati',
          'Zarba to‘lqinli terapiya (UVT)',
          'Traksion (cho‘zish) stoli',
        ],
      ],
      [
        'Reabilitatsiya jihozlari',
        [
          'Mexanoterapiya trenajyori',
          'Vertikalizator',
          'Yurishni tiklash tizimi',
          'Robotlashtirilgan reabilitatsiya tizimi',
        ],
      ],
      [
        'Ingalyatsiya va kislorod',
        [
          'Kompressorli nebulayzer',
          'Ultratovushli ingalyator',
          'Kislorod konsentratori',
          'Giperbarik kamera',
        ],
      ],
    ],
  ],
  [
    'furniture',
    'Shifoxona mebeli va palata jihozlari',
    [
      [
        'Bemor karavotlari',
        [
          'Mexanik 2 funksiyali karavot',
          'Mexanik 3–4 funksiyali karavot',
          'Elektr karavot (3 motorli)',
          'Reanimatsiya karavoti (ICU)',
          'Pediatrik karavot',
          'Bariatrik karavot',
        ],
      ],
      [
        'Ko‘chirish va tashish',
        [
          'Bemor tashish aravachasi',
          'Nogironlar aravachasi',
          'Bemor ko‘targichi (lift)',
          'Nosilka va zaxira aravacha',
        ],
      ],
      [
        'Palata va protsedura mebeli',
        [
          'Tibbiy tumbochka',
          'Protsedura va instrument stoli',
          'Hamshira aravachasi',
          'Dori shkafi va seyfi',
          'Ko‘rik kushetkasi',
          'Shirma (parda) va pardali tizim',
          'Shtativ (kapelnitsa) va tayanchlar',
        ],
      ],
      [
        'Kabinet jihozlari',
        [
          'Tibbiy tarozi va bo‘y o‘lchagich',
          'Tonometr va stetoskop',
          'Bakteritsid lampa',
          'Quruq isitgich shkafi',
        ],
      ],
    ],
  ],
  [
    'sterilization',
    'Dezinfeksiya va sterilizatsiya',
    [
      [
        'Bug‘ sterilizatsiyasi',
        [
          'Stol usti avtoklav (B klass)',
          'Vertikal bug‘ sterilizatori',
          'Gorizontal bug‘ sterilizatori',
          'Ikki eshikli (pass-through) avtoklav',
          'Bug‘ generatori',
        ],
      ],
      [
        'Past haroratli sterilizatsiya',
        [
          'H₂O₂ plazma sterilizatori',
          'Etilen oksid (ETO) sterilizatori',
          'Formaldegid sterilizatori',
        ],
      ],
      [
        'Quruq issiqlik va boshqa usullar',
        [
          'Quruq issiqlik sterilizatori',
          'Sharli (glasperlen) sterilizator',
          'UV sterilizatsiya shkafi',
        ],
      ],
      [
        'Yuvish va tayyorlash',
        [
          'Ultratovushli yuvish vannasi',
          'Avtomatik yuvish-dezinfeksiya mashinasi',
          'Muhrlash (sealing) apparati',
          'Sterilizatsiya konteynerlari va paketlari',
          'Sterilizatsiya nazorat indikatorlari',
        ],
      ],
      [
        'Havo va yuza dezinfeksiyasi',
        [
          'Retsirkulyator (havo dezinfektori)',
          'Bakteritsid lampali o‘rnatma',
          'Pass box (o‘tkazgich shkaf)',
          'Havo dushi (air shower)',
          'Laminar oqimli toza ish o‘rni',
          'Aerozol (tuman) dezinfeksiya generatori',
        ],
      ],
    ],
  ],
  [
    'mortuary',
    'Patologoanatomiya va mortuar',
    [
      [
        'Autopsiya jihozlari',
        [
          'Autopsiya (yorish) stoli',
          'Tortish (downdraft) stoli',
          'Autopsiya asboblari to‘plami',
          'Suyak arrasi',
        ],
      ],
      [
        'Saqlash jihozlari',
        [
          'Mortuar sovutgich kamerasi (2–6 joy)',
          'Mortuar sovutgich kamerasi (8+ joy)',
          'Murda tashish aravachasi',
          'Ko‘targich (lifter)',
        ],
      ],
      [
        'O‘quv va anatomiya',
        ['Virtual anatomiya stoli', 'Anatomik modellar to‘plami', 'Muzeyga saqlash idishlari'],
      ],
    ],
  ],
  [
    'waste',
    'Tibbiy chiqindilarni boshqarish',
    [
      [
        'Yoqish (insineratsiya)',
        [
          'Ikki kamerali insinerator (10–50 kg/soat)',
          'Ikki kamerali insinerator (50–150 kg/soat)',
          'Ikki kamerali insinerator (150+ kg/soat)',
          'Gazlarni tozalash (scrubber) tizimi',
          'Avtomatik yuklash tizimi',
        ],
      ],
      [
        'Alternativ zararsizlantirish',
        [
          'Chiqindi avtoklavi',
          'Mikroto‘lqinli zararsizlantirish tizimi',
          'Shredder (maydalagich)',
        ],
      ],
      [
        'Yig‘ish va tashish',
        [
          'Chiqindi konteynerlari',
          'O‘tkir buyumlar uchun idish',
          'Chiqindi tashish aravachasi',
          'Chiqindi tarozisi',
        ],
      ],
    ],
  ],
  [
    'engineering',
    'Muhandislik va yordamchi tizimlar',
    [
      [
        'Tibbiy gazlar',
        [
          'Kislorod stansiyasi (PSA)',
          'Markaziy kislorod konsentratori',
          'Tibbiy havo kompressori',
          'Vakuum stansiyasi',
          'Gaz yo‘llari va konsol chiqishlari',
          'Kislorod balloni va reduktori',
        ],
      ],
      [
        'Elektr ta’minoti',
        [
          'Uzluksiz quvvat manbai (UPS)',
          'Dizel generator',
          'Kuchlanish stabilizatori',
          'Izolyatsiya transformatori (IT-tizim)',
        ],
      ],
      [
        'Suv va iqlim',
        [
          'Teskari osmos tizimi',
          'Suv yumshatgich',
          'Toza xona ventilyatsiyasi (HVAC)',
          'Iqlim nazorat tizimi',
        ],
      ],
      [
        'Axborot tizimlari',
        [
          'Server va ma’lumot saqlash',
          'Tarmoq uskunalari',
          'Hamshira chaqiruv tizimi',
          'Video kuzatuv tizimi',
        ],
      ],
    ],
  ],
];

export const CLASSIFICATION = TREE.map(([id, name, sections]) => ({
  id,
  name,
  sections: sections.map(([sectionName, items]) => {
    const sectionId = `${id}.${slug(sectionName)}`;
    return {
      id: sectionId,
      name: sectionName,
      items: items.map((itemName) => ({ id: `${sectionId}.${slug(itemName)}`, name: itemName })),
    };
  }),
}));

/** flat rows — what the Excel export of the classification is built from */
export const classificationRows = () =>
  CLASSIFICATION.flatMap((group, gi) =>
    group.sections.flatMap((section, si) =>
      section.items.map((item, ii) => ({
        no: `${gi + 1}.${si + 1}.${ii + 1}`,
        groupId: group.id,
        groupName: group.name,
        sectionId: section.id,
        sectionName: section.name,
        itemId: item.id,
        itemName: item.name,
      })),
    ),
  );

/** resolve the three stored ids back into their names */
export function findClassification(groupId, sectionId, itemId) {
  const group = CLASSIFICATION.find((g) => g.id === groupId) || null;
  const section = group?.sections.find((s) => s.id === sectionId) || null;
  const item = section?.items.find((i) => i.id === itemId) || null;
  return { group, section, item };
}
