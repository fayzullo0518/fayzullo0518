/**
 * O‘zbekiston Respublikasining ma’muriy-hududiy bo‘linishi.
 *
 * 12 viloyat + Qoraqalpog‘iston Respublikasi + Toshkent shahri, har birining
 * tuman va shaharlari bilan. Monitoring formasidagi "Region → Tuman" juftligi
 * shu ro‘yxatdan to‘ladi; ro‘yxatda bo‘lmagan joy uchun har bir viloyat
 * oxirida "Boshqa — qo‘lda kiritish" varianti turadi.
 */

const slug = (value) =>
  String(value)
    .toLowerCase()
    .replace(/[‘’ʻ']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

/** [regionId, region nomi, [shaharlar], [tumanlar]] */
const TREE = [
  [
    'qoraqalpogiston',
    'Qoraqalpog‘iston Respublikasi',
    ['Nukus shahri'],
    [
      'Amudaryo tumani',
      'Beruniy tumani',
      'Bo‘zatov tumani',
      'Chimboy tumani',
      'Ellikqal’a tumani',
      'Kegeyli tumani',
      'Mo‘ynoq tumani',
      'Nukus tumani',
      'Qanliko‘l tumani',
      'Qorao‘zak tumani',
      'Qo‘ng‘irot tumani',
      'Shumanay tumani',
      'Taxtako‘pir tumani',
      'To‘rtko‘l tumani',
      'Xo‘jayli tumani',
    ],
  ],
  [
    'andijon',
    'Andijon viloyati',
    ['Andijon shahri', 'Asaka shahri', 'Xonobod shahri'],
    [
      'Andijon tumani',
      'Asaka tumani',
      'Baliqchi tumani',
      'Bo‘ston tumani',
      'Buloqboshi tumani',
      'Izboskan tumani',
      'Jalaquduq tumani',
      'Marhamat tumani',
      'Oltinko‘l tumani',
      'Paxtaobod tumani',
      'Qo‘rg‘ontepa tumani',
      'Shahrixon tumani',
      'Ulug‘nor tumani',
      'Xo‘jaobod tumani',
    ],
  ],
  [
    'buxoro',
    'Buxoro viloyati',
    ['Buxoro shahri', 'Kogon shahri'],
    [
      'Buxoro tumani',
      'G‘ijduvon tumani',
      'Jondor tumani',
      'Kogon tumani',
      'Olot tumani',
      'Peshku tumani',
      'Qorako‘l tumani',
      'Qorovulbozor tumani',
      'Romitan tumani',
      'Shofirkon tumani',
      'Vobkent tumani',
    ],
  ],
  [
    'fargona',
    'Farg‘ona viloyati',
    ['Farg‘ona shahri', 'Marg‘ilon shahri', 'Qo‘qon shahri', 'Quvasoy shahri'],
    [
      'Beshariq tumani',
      'Bog‘dod tumani',
      'Buvayda tumani',
      'Dang‘ara tumani',
      'Farg‘ona tumani',
      'Furqat tumani',
      'Oltiariq tumani',
      'O‘zbekiston tumani',
      'Qo‘shtepa tumani',
      'Quva tumani',
      'Rishton tumani',
      'So‘x tumani',
      'Toshloq tumani',
      'Uchko‘prik tumani',
      'Yozyovon tumani',
    ],
  ],
  [
    'jizzax',
    'Jizzax viloyati',
    ['Jizzax shahri'],
    [
      'Arnasoy tumani',
      'Baxmal tumani',
      'Do‘stlik tumani',
      'Forish tumani',
      'G‘allaorol tumani',
      'Mirzacho‘l tumani',
      'Paxtakor tumani',
      'Sharof Rashidov tumani',
      'Yangiobod tumani',
      'Zafarobod tumani',
      'Zarbdor tumani',
      'Zomin tumani',
    ],
  ],
  [
    'xorazm',
    'Xorazm viloyati',
    ['Urganch shahri', 'Xiva shahri'],
    [
      'Bog‘ot tumani',
      'Gurlan tumani',
      'Hazorasp tumani',
      'Qo‘shko‘pir tumani',
      'Shovot tumani',
      'Tuproqqal’a tumani',
      'Urganch tumani',
      'Xonqa tumani',
      'Xiva tumani',
      'Yangiariq tumani',
      'Yangibozor tumani',
    ],
  ],
  [
    'namangan',
    'Namangan viloyati',
    ['Namangan shahri'],
    [
      'Chortoq tumani',
      'Chust tumani',
      'Davlatobod tumani',
      'Kosonsoy tumani',
      'Mingbuloq tumani',
      'Namangan tumani',
      'Norin tumani',
      'Pop tumani',
      'To‘raqo‘rg‘on tumani',
      'Uchqo‘rg‘on tumani',
      'Uychi tumani',
      'Yangiqo‘rg‘on tumani',
    ],
  ],
  [
    'navoiy',
    'Navoiy viloyati',
    ['Navoiy shahri', 'Zarafshon shahri'],
    [
      'Karmana tumani',
      'Konimex tumani',
      'Navbahor tumani',
      'Nurota tumani',
      'Qiziltepa tumani',
      'Tomdi tumani',
      'Uchquduq tumani',
      'Xatirchi tumani',
    ],
  ],
  [
    'qashqadaryo',
    'Qashqadaryo viloyati',
    ['Qarshi shahri', 'Shahrisabz shahri'],
    [
      'Chiroqchi tumani',
      'Dehqonobod tumani',
      'G‘uzor tumani',
      'Kasbi tumani',
      'Kitob tumani',
      'Koson tumani',
      'Ko‘kdala tumani',
      'Mirishkor tumani',
      'Muborak tumani',
      'Nishon tumani',
      'Qamashi tumani',
      'Qarshi tumani',
      'Shahrisabz tumani',
      'Yakkabog‘ tumani',
    ],
  ],
  [
    'samarqand',
    'Samarqand viloyati',
    ['Samarqand shahri', 'Kattaqo‘rg‘on shahri'],
    [
      'Bulung‘ur tumani',
      'Ishtixon tumani',
      'Jomboy tumani',
      'Kattaqo‘rg‘on tumani',
      'Narpay tumani',
      'Nurobod tumani',
      'Oqdaryo tumani',
      'Pastdarg‘om tumani',
      'Paxtachi tumani',
      'Qo‘shrabot tumani',
      'Samarqand tumani',
      'Toyloq tumani',
      'Urgut tumani',
    ],
  ],
  [
    'sirdaryo',
    'Sirdaryo viloyati',
    ['Guliston shahri', 'Shirin shahri', 'Yangiyer shahri'],
    [
      'Boyovut tumani',
      'Guliston tumani',
      'Mirzaobod tumani',
      'Oqoltin tumani',
      'Sardoba tumani',
      'Sayxunobod tumani',
      'Sirdaryo tumani',
      'Xovos tumani',
    ],
  ],
  [
    'surxondaryo',
    'Surxondaryo viloyati',
    ['Termiz shahri'],
    [
      'Angor tumani',
      'Bandixon tumani',
      'Boysun tumani',
      'Denov tumani',
      'Jarqo‘rg‘on tumani',
      'Muzrabot tumani',
      'Oltinsoy tumani',
      'Qiziriq tumani',
      'Qumqo‘rg‘on tumani',
      'Sariosiyo tumani',
      'Sherobod tumani',
      'Sho‘rchi tumani',
      'Termiz tumani',
      'Uzun tumani',
    ],
  ],
  [
    'toshkent-viloyati',
    'Toshkent viloyati',
    [
      'Nurafshon shahri',
      'Angren shahri',
      'Bekobod shahri',
      'Chirchiq shahri',
      'Olmaliq shahri',
      'Ohangaron shahri',
      'Yangiyo‘l shahri',
    ],
    [
      'Bekobod tumani',
      'Bo‘ka tumani',
      'Bo‘stonliq tumani',
      'Chinoz tumani',
      'Ohangaron tumani',
      'Oqqo‘rg‘on tumani',
      'O‘rtachirchiq tumani',
      'Parkent tumani',
      'Piskent tumani',
      'Qibray tumani',
      'Quyichirchiq tumani',
      'Toshkent tumani',
      'Yangiyo‘l tumani',
      'Yuqorichirchiq tumani',
      'Zangiota tumani',
    ],
  ],
  [
    'toshkent-shahri',
    'Toshkent shahri',
    [],
    [
      'Bektemir tumani',
      'Chilonzor tumani',
      'Mirobod tumani',
      'Mirzo Ulug‘bek tumani',
      'Olmazor tumani',
      'Sergeli tumani',
      'Shayxontohur tumani',
      'Uchtepa tumani',
      'Yakkasaroy tumani',
      'Yangihayot tumani',
      'Yashnobod tumani',
      'Yunusobod tumani',
    ],
  ],
];

/** where the map should centre when a region is picked */
const CENTRES = {
  qoraqalpogiston: { lat: 42.4531, lng: 59.6103, zoom: 7 },
  andijon: { lat: 40.7821, lng: 72.3442, zoom: 9 },
  buxoro: { lat: 39.7747, lng: 64.4286, zoom: 8 },
  fargona: { lat: 40.3864, lng: 71.7864, zoom: 9 },
  jizzax: { lat: 40.1158, lng: 67.8422, zoom: 8 },
  xorazm: { lat: 41.5506, lng: 60.6314, zoom: 8 },
  namangan: { lat: 40.9983, lng: 71.6726, zoom: 9 },
  navoiy: { lat: 40.0844, lng: 65.3792, zoom: 7 },
  qashqadaryo: { lat: 38.8606, lng: 65.7891, zoom: 8 },
  samarqand: { lat: 39.627, lng: 66.975, zoom: 8 },
  sirdaryo: { lat: 40.4897, lng: 68.7842, zoom: 9 },
  surxondaryo: { lat: 37.2242, lng: 67.2783, zoom: 8 },
  'toshkent-viloyati': { lat: 41.0, lng: 69.5, zoom: 8 },
  'toshkent-shahri': { lat: 41.2995, lng: 69.2401, zoom: 11 },
};

/** the manual escape hatch appended to every district list */
const OTHER_DISTRICT = { id: 'other', name: 'Boshqa — qo‘lda kiritish', type: 'other' };

export const REGIONS = TREE.map(([id, name, cities, districts]) => ({
  id,
  name,
  center: CENTRES[id] || { lat: 41.3775, lng: 64.5853, zoom: 6 },
  districts: [
    ...cities.map((city) => ({ id: `${id}.${slug(city)}`, name: city, type: 'shahar' })),
    ...districts.map((d) => ({ id: `${id}.${slug(d)}`, name: d, type: 'tuman' })),
    OTHER_DISTRICT,
  ],
}));

/** the whole country, for the dashboard map */
export const COUNTRY_CENTER = { lat: 41.3775, lng: 64.5853, zoom: 6 };

export const findRegion = (regionId) => REGIONS.find((r) => r.id === regionId) || null;

export function districtName(regionId, districtId, fallback = '') {
  if (districtId === 'other') return fallback;
  const region = findRegion(regionId);
  const district = region?.districts.find((d) => d.id === districtId);
  if (district) return district.name;
  // records written before the country-wide list existed stored a bare Fergana id
  for (const r of REGIONS) {
    const hit = r.districts.find((d) => d.id === districtId || d.id === `${r.id}.${districtId}`);
    if (hit) return hit.name;
  }
  return fallback || districtId || '';
}

export const regionName = (regionId) => findRegion(regionId)?.name || regionId || '';

/** flat list for the Excel sheet */
export const regionRows = () =>
  REGIONS.flatMap((region, ri) =>
    region.districts
      .filter((d) => d.type !== 'other')
      .map((d, di) => ({
        no: `${ri + 1}.${di + 1}`,
        regionName: region.name,
        districtName: d.name,
        type: d.type === 'shahar' ? 'Shahar' : 'Tuman',
        districtId: d.id,
      })),
  );
