import { Route, RouteStop, Stop, Trip, BusPass } from '@/types/transit';

export interface RawPickupPoint {
  name: string;
  time: string; // e.g. "7.00 AM", "7:30 AM"
}

export interface RawRouteSchedule {
  routeNumber: string; // e.g. "VV-1", "GV-1", "TV-1"
  region: 'Vijayawada' | 'Guntur' | 'Tenali';
  originName: string;
  destinationName: string;
  points: RawPickupPoint[];
}

/**
 * Normalizes time string to standard 12-hour format e.g. "07:00 AM"
 */
export function normalizeTime(raw: string): string {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  const match = cleaned.match(/(\d{1,2})[.:](\d{2})\s*(AM|PM)/i);
  if (!match) return cleaned;
  const hours = match[1].padStart(2, '0');
  const minutes = match[2];
  const meridiem = match[3].toUpperCase();
  return `${hours}:${minutes} ${meridiem}`;
}

/**
 * Converts "07:30 AM" to 24h minutes from midnight for arrival offset calculation
 */
export function timeToMinutes(timeStr: string): number {
  const norm = normalizeTime(timeStr);
  const match = norm.match(/(\d{2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return 0;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const mer = match[3].toUpperCase();
  if (mer === 'PM' && h < 12) h += 12;
  if (mer === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}

export interface ScheduleAnomaly {
  routeNumber: string;
  pointName: string;
  time: string;
  previousPointName: string;
  previousTime: string;
  description: string;
}

/**
 * Scans official schedules and flags ambiguous, inconsistent, or potentially mistyped entries
 * as requested in Phase Six of the master specification.
 */
export function findScheduleAmbiguities(): ScheduleAnomaly[] {
  const anomalies: ScheduleAnomaly[] = [];
  OFFICIAL_SCHEDULES_DATA.forEach((route) => {
    let prevMins = 0;
    let prevPoint: RawPickupPoint | null = null;
    route.points.forEach((pt) => {
      const curMins = timeToMinutes(pt.time);
      if (curMins < prevMins && prevPoint) {
        anomalies.push({
          routeNumber: route.routeNumber,
          pointName: pt.name,
          time: pt.time,
          previousPointName: prevPoint.name,
          previousTime: prevPoint.time,
          description: `Time regression detected on Route ${route.routeNumber}: "${pt.name}" (${pt.time}) is earlier than preceding stop "${prevPoint.name}" (${prevPoint.time})`,
        });
      }
      prevMins = curMins;
      prevPoint = pt;
    });
  });
  return anomalies;
}

export const OFFICIAL_SCHEDULES_DATA: RawRouteSchedule[] = [
  // ==========================================
  // VIJAYAWADA ROUTES (VV-1 to VV-21)
  // ==========================================
  {
    routeNumber: 'VV-1',
    region: 'Vijayawada',
    originName: 'Vuyyuru Bus Stand',
    destinationName: 'VIT-AP Campus',
    points: [
      { name: 'Vuyyuru Bus Stand', time: '7.00 AM' },
      { name: 'Vuyyuru Masjid Center', time: '7.03 AM' },
      { name: 'Vuyyuru Main Center', time: '7.05 AM' },
      { name: 'Gandigunta Datta Sai Kalyana mandapam', time: '7.08 AM' },
      { name: 'Chinna Ogirala High way Road', time: '7.10 AM' },
      { name: 'Chalivendrapalem High way Road', time: '7.15 AM' },
      { name: 'Davuluru Tool Plaza', time: '7.17 AM' },
      { name: 'Kankipadu', time: '7:25 AM' },
      { name: 'Gosala', time: '7:30 AM' },
      { name: 'Edupugallu', time: '7:32 AM' },
      { name: 'Ganguru', time: '7.35 AM' },
      { name: 'Penamaluru', time: '7:40 AM' },
      { name: 'VIT-AP Campus', time: '8:45 AM' },
    ],
  },
  {
    routeNumber: 'VV-2',
    region: 'Vijayawada',
    originName: 'Poranki Center',
    destinationName: 'VIT-AP Campus',
    points: [
      { name: 'Poranki Center', time: '7.30 AM' },
      { name: 'Thumu Center', time: '7.33 AM' },
      { name: 'Tadigadapa', time: '7.35 AM' },
      { name: 'KCP Colony', time: '7.38 AM' },
      { name: 'VR Siddhartha', time: '7.40 AM' },
      { name: 'Bharath Pertol Pump', time: '7.42 AM' },
      { name: 'VIT-AP Campus', time: '8:45 AM' },
    ],
  },
  {
    routeNumber: 'VV-3',
    region: 'Vijayawada',
    originName: 'Kamayatopu Center (Kanuru)',
    destinationName: 'VIT-AP Campus',
    points: [
      { name: 'Kamayatopu Center(Kanuru)', time: '7.35 AM' },
      { name: 'Pappula Mill Center', time: '7.40 AM' },
      { name: 'Ashok Nagar', time: '7.43 AM' },
      { name: 'Time Hospital', time: '7:47 AM' },
      { name: 'Auto nagar Gate', time: '7:48 AM' },
      { name: 'Screw Bridge', time: '7:58 AM' },
      { name: 'VIT-AP Campus', time: '8:45 AM' },
    ],
  },
  {
    routeNumber: 'VV-4',
    region: 'Vijayawada',
    originName: 'Time Hospital',
    destinationName: 'VIT-AP Campus',
    points: [
      { name: 'Time Hospital', time: '7.40 AM' },
      { name: 'Autonagar Gate', time: '7.42 AM' },
      { name: 'Patamata (High School Road)', time: '7.44 AM' },
      { name: 'P & T Colony - NTR Circle', time: '7.46 AM' },
      { name: 'VIT-AP Campus', time: '8.45 AM' },
    ],
  },
  {
    routeNumber: 'VV-5',
    region: 'Vijayawada',
    originName: 'Auto Nagar Gate',
    destinationName: 'VIT-AP Campus',
    points: [
      { name: 'Auto Nagar Gate', time: '7:35 AM' },
      { name: 'High school road', time: '7:37 AM' },
      { name: 'NTR Circle', time: '7:40 AM' },
      { name: 'Eenadu', time: '7:42 AM' },
      { name: 'Benz Circle (Bajaj Showroom)', time: '7:44 AM' },
      { name: 'DV Manor(Sweet Magic)', time: '7:50 AM' },
      { name: 'Ramesh Hospital', time: '7:52 AM' },
      { name: 'VIT-AP Campus', time: '8.45 AM' },
    ],
  },
  {
    routeNumber: 'VV-6',
    region: 'Vijayawada',
    originName: 'Patamata E Seva',
    destinationName: 'VIT-AP Campus',
    points: [
      { name: 'Patamata E Seva', time: '7:30 AM' },
      { name: 'NTR Circle', time: '7:32 AM' },
      { name: 'Eenadu', time: '7:35 AM' },
      { name: 'Benz Circle (Bajaj Showroom)', time: '7:37 AM' },
      { name: 'DV Manor(Sweet Magic)', time: '7:40 AM' },
      { name: 'Khandhari(MVR)', time: '7:42 AM' },
      { name: 'PVP Mall', time: '7:44 AM' },
      { name: 'Labbipet (Venkateswara Swamy Temple)', time: '7:50 AM' },
      { name: 'Ramesh Hospital', time: '7:52 AM' },
      { name: 'Varadhi', time: '8:00 AM' },
      { name: 'VIT-AP Campus', time: '8.45 AM' },
    ],
  },
  {
    routeNumber: 'VV-7',
    region: 'Vijayawada',
    originName: 'Gannavaram Bus Stand',
    destinationName: 'VIT-AP Campus',
    points: [
      { name: 'Gannavaram Bus Stand', time: '7:10 AM' },
      { name: 'Kesarapalli', time: '7:20 AM' },
      { name: 'Gudavalli', time: '7:25 AM' },
      { name: 'Nidamanuru', time: '7:30 AM' },
      { name: 'VIT-AP Campus', time: '8:45 AM' },
    ],
  },
  {
    routeNumber: 'VV-8',
    region: 'Vijayawada',
    originName: 'Enikepadu',
    destinationName: 'VIT-AP Campus',
    points: [
      { name: 'Enikepadu', time: '7:20 AM' },
      { name: 'Prasadampadu', time: '7:25 AM' },
      { name: 'Ramavarapadu Ring', time: '7:40 AM' },
      { name: 'Currency Nagar', time: '7:42 AM' },
      { name: 'VIT-AP Campus', time: '8:45 AM' },
    ],
  },
  {
    routeNumber: 'VV-9',
    region: 'Vijayawada',
    originName: 'Ramavarapadu Ring - Govt Hospital',
    destinationName: 'VIT-AP Campus',
    points: [
      { name: 'Ramavarapadu Ring - Govt Hospital (Mahanadu Road)', time: '7:40 AM' },
      { name: 'Govt Hospital (Mahanadu Road)', time: '7:40 AM' },
      { name: 'Novotel', time: '7:42 AM' },
      { name: 'McDonalds', time: '7:45 AM' },
      { name: 'Maris Stella College', time: '7:47 AM' },
      { name: 'Screw Bridge', time: '7:52 AM' },
      { name: 'Balaji Nagar', time: '7:55 AM' },
      { name: 'Varadhi Bus Stop', time: '7:59 AM' },
      { name: 'VIT-AP Campus', time: '8:45 AM' },
    ],
  },
  {
    routeNumber: 'VV-10',
    region: 'Vijayawada',
    originName: 'Nunna Center',
    destinationName: 'VIT-AP Campus',
    points: [
      { name: 'Nunna Center', time: '7.20 AM' },
      { name: 'Sub Station', time: '7:30 AM' },
      { name: 'Kandrika Pertol Pump', time: '7.35 AM' },
      { name: 'Payakapuram', time: '7.40 AM' },
      { name: 'Prakash Nagar', time: '7.42 AM' },
      { name: 'Pipula Road', time: '7.44 AM' },
      { name: 'Singh Nagar Sai Baba Temple', time: '7.48 AM' },
      { name: 'Dabakotlu Center', time: '7.50 AM' },
      { name: 'VIT-AP Campus', time: '8:45 AM' },
    ],
  },
  {
    routeNumber: 'VV-11',
    region: 'Vijayawada',
    originName: 'Budameru Vantena',
    destinationName: 'VIT-AP Campus',
    points: [
      { name: 'Budameru Vantena', time: '7:30AM' },
      { name: 'Ayodhya Nagar', time: '7:32 AM' },
      { name: 'Lotus Land Mark', time: '7:35 AM' },
      { name: 'Prabhas College(Fruit Market)', time: '7:40 AM' },
      { name: 'MS Raja Rao Bridge', time: '7:45 AM' },
      { name: 'Sobhan Babu Circle', time: '7.50 AM' },
      { name: 'Challapalli Bunglaw', time: '7:55 AM' },
      { name: 'Bandar Lakulu', time: '7:58 AM' },
      { name: 'Varadhi', time: '8:00 AM' },
      { name: 'VIT-AP Campus', time: '8:45 AM' },
    ],
  },
  {
    routeNumber: 'VV-12',
    region: 'Vijayawada',
    originName: 'Meesal Raja Rao Bridge',
    destinationName: 'VIT-AP Campus',
    points: [
      { name: 'Meesal Raja Rao Bridge', time: '7.40 AM' },
      { name: 'Sarada College', time: '7.42 AM' },
      { name: 'Food Junction', time: '7.45 AM' },
      { name: 'Madhura Nagar Signal', time: '7.46 AM' },
      { name: 'Padavala Revu', time: '7.48 AM' },
      { name: 'VIT-AP Campus', time: '8:45 AM' },
    ],
  },
  {
    routeNumber: 'VV-13',
    region: 'Vijayawada',
    originName: 'ESI Hospital',
    destinationName: 'VIT-AP Campus',
    points: [
      { name: 'ESI Hospital', time: '7:30 AM' },
      { name: 'Gunadala Bridge', time: '7.32 AM' },
      { name: 'Gunadala Center', time: '7.33 AM' },
      { name: 'Padavala Revu', time: '7.35 AM' },
      { name: 'Machavaram', time: '7.37 AM' },
      { name: 'SRR College', time: '7.38 AM' },
      { name: 'BSNL', time: '7.40 AM' },
      { name: 'Sitarampuram Signal', time: '7.42 AM' },
      { name: 'Vijaya Talkies', time: '7.45 AM' },
      { name: 'Apsara Theater', time: '7.48 AM' },
      { name: 'Challapalli Bunglow', time: '7.49 AM' },
      { name: 'Bandar Lakulu', time: '7.50 AM' },
      { name: 'Varadhi', time: '7.55 AM' },
      { name: 'VIT-AP Campus', time: '8:45 AM' },
    ],
  },
  {
    routeNumber: 'VV-14',
    region: 'Vijayawada',
    originName: 'Kanchikacherla - Reliance Trends',
    destinationName: 'VIT-AP Campus',
    points: [
      { name: 'Kanchikacherla - Reliance Trends', time: '7.00 AM' },
      { name: 'Kanchikacherla - RTC Bus Stand', time: '7.05 AM' },
      { name: 'Paritala', time: '7.10 AM' },
      { name: 'Keesara', time: '7.15 AM' },
      { name: 'Danabanda', time: '7.20 AM' },
      { name: 'Ketanakonda', time: '7.25 AM' },
      { name: 'Moolapadu', time: '7.30 AM' },
      { name: 'Kileshpuram', time: '7.35 AM' },
      { name: 'VIT-AP Campus - Via West Bypass', time: '8:45 AM' },
    ],
  },
  {
    routeNumber: 'VV-15',
    region: 'Vijayawada',
    originName: 'Kondapalli (VTPS Colony)',
    destinationName: 'VIT-AP Campus',
    points: [
      { name: 'Kondapalli (vtps colony)', time: '7.00 AM' },
      { name: 'Ibrahimpatnam', time: '7:30 AM' },
      { name: 'Kazipet', time: '7:40 AM' },
      { name: 'Guntupalli', time: '7:40 AM' },
      { name: 'Rayanapadu X Road', time: '7:42 AM' },
      { name: 'Gollapudi One Center', time: '7:45 AM' },
      { name: 'Y Junction', time: '7:48 AM' },
      { name: 'Andhra Hospitals', time: '7:50 AM' },
      { name: 'Swathi Center', time: '7:53 AM' },
      { name: 'VIT-AP Campus', time: '8:45 AM' },
    ],
  },
  {
    routeNumber: 'VV-16',
    region: 'Vijayawada',
    originName: 'Bhavanipuram Sivalayam Center',
    destinationName: 'VIT-AP Campus',
    points: [
      { name: 'Bhavanipuram Sivalayam Center', time: '7:15 AM' },
      { name: 'Trends', time: '7:18 AM' },
      { name: 'Bhavanipuram Church', time: '7:20 AM' },
      { name: 'Sitara', time: '7:23 AM' },
      { name: 'Kabela', time: '7:25 AM' },
      { name: 'Milk Project', time: '7:27 AM' },
      { name: 'Sai Ram Theater', time: '7:30 AM' },
      { name: 'Chittinagar', time: '7:32 AM' },
      { name: 'Vagu Center', time: '7:35 AM' },
      { name: 'KBN College', time: '7:37 AM' },
      { name: 'Panja Center', time: '7:40 AM' },
      { name: 'KR Market', time: '7:43 AM' },
      { name: 'Govt. Hospital - Near Railway Station', time: '7:45 AM' },
      { name: 'VIT-AP Campus', time: '8:45 AM' },
    ],
  },
  {
    routeNumber: 'VV-17',
    region: 'Vijayawada',
    originName: 'Andhra Hospitals',
    destinationName: 'VIT-AP Campus',
    points: [
      { name: 'Andhra Hospitals', time: '7:50 AM' },
      { name: 'Swathi Center', time: '7:53 AM' },
      { name: 'Kanakadurga Flyover', time: '7:55 AM' },
      { name: 'Krishnalanka Katta', time: '8:00 AM' },
      { name: 'Fire Station -Bus Stop', time: '8:05 AM' },
      { name: 'Varadhi', time: '8:08 AM' },
      { name: 'VIT-AP Campus', time: '8:45 AM' },
    ],
  },
  {
    routeNumber: 'VV-18',
    region: 'Vijayawada',
    originName: 'Auto Nagar Association Hall',
    destinationName: 'VIT-AP Campus',
    points: [
      { name: 'Auto Nagar Association Hall', time: '7:30 AM' },
      { name: 'Gurunank colony', time: '7:32 AM' },
      { name: 'Ramesh hospital', time: '7:35 AM' },
      { name: 'ITI College', time: '7:37 AM' },
      { name: 'Amma Kalyana Mandapam', time: '7:40 AM' },
      { name: 'Jammi Chettu Centre', time: '7:45 AM' },
      { name: 'Sridartha Arts & Scinces', time: '7:50 AM' },
      { name: 'Commisioner office', time: '7:55 AM' },
      { name: 'Raghavaiah Park', time: '8:00 AM' },
      { name: 'Varadhi', time: '8:10 AM' },
      { name: 'VIT-AP Campus', time: '8:45 AM' },
    ],
  },
  {
    routeNumber: 'VV-19',
    region: 'Vijayawada',
    originName: 'Gurunanak Colony',
    destinationName: 'VIT-AP Campus',
    points: [
      { name: 'Gurunank colony', time: '7:30 AM' },
      { name: 'Ramesh hospital', time: '7:35 AM' },
      { name: 'ITI College', time: '7:37 AM' },
      { name: 'Amma Kalyana Mandapam', time: '7:40 AM' },
      { name: 'Jammi Chettu Centre', time: '7:45 AM' },
      { name: 'Sridartha Arts & Scinces', time: '7:50 AM' },
      { name: 'Commisioner office', time: '7:55 AM' },
      { name: 'Raghavaiah Park', time: '8:00 AM' },
      { name: 'Varadhi', time: '8:10 AM' },
      { name: 'VIT-AP Campus', time: '8:45 AM' },
    ],
  },
  {
    routeNumber: 'VV-20',
    region: 'Vijayawada',
    originName: 'Varadhi Junction',
    destinationName: 'VIT-AP Campus',
    points: [
      { name: 'Varadhi', time: '7.50 AM' },
      { name: 'Manipal', time: '7.52 AM' },
      { name: 'Ushodaya Mart', time: '7.55 AM' },
      { name: 'Praturu Road', time: '7.57 AM' },
      { name: 'Kunchinapalli Road', time: '8:00 AM' },
      { name: 'Kunchinapalli Sai baba Temple', time: '8:01 AM' },
      { name: 'D-Mrat', time: '8:03 AM' },
      { name: 'TadepaIii Petrol Pump', time: '8:06 AM' },
      { name: 'Undavalli Centre', time: '8:15 AM' },
      { name: 'Penunmaka', time: '8:30 AM' },
      { name: 'VIT-AP Campus', time: '8:45 AM' },
    ],
  },
  {
    routeNumber: 'VV-21',
    region: 'Vijayawada',
    originName: 'Varadhi Expressway',
    destinationName: 'VIT-AP Campus',
    points: [
      { name: 'Varadhi', time: '7.50 AM' },
      { name: 'Kunchinapalli', time: '7:55 AM' },
      { name: 'TadepaIii Petrol Bunk', time: '7:56 AM' },
      { name: 'Undavalli', time: '8:05 AM' },
      { name: 'Penunmaka', time: '8:10AM' },
      { name: 'VIT-AP Campus', time: '8:45 AM' },
    ],
  },

  // ==========================================
  // GUNTUR ROUTES (GV-1 to GV-20)
  // ==========================================
  {
    routeNumber: 'GV-1',
    region: 'Guntur',
    originName: 'Naaz Center',
    destinationName: 'VIT-AP Campus',
    points: [
      { name: 'Naaz Center', time: '7:35 AM' },
      { name: 'Market - Guntur', time: '7:40 AM' },
      { name: 'Chandana Bros', time: '7:42 AM' },
      { name: 'Bus Stand - Guntur', time: '7:45 AM' },
      { name: 'VIT-AP Campus', time: '8:45 AM' },
    ],
  },
  {
    routeNumber: 'GV-2',
    region: 'Guntur',
    originName: 'Anand Peta',
    destinationName: 'VIT-AP Campus',
    points: [
      { name: 'Anand peta', time: '7:20 AM' },
      { name: 'Masjid center', time: '7.23 AM' },
      { name: 'Bramhananda Stadium', time: '7:30 AM' },
      { name: 'RTC Colony', time: '7.33 AM' },
      { name: 'Manipuram Bridge', time: '7:35 AM' },
      { name: 'Badhra Kali Amma vari Temple', time: '7.37 AM' },
      { name: 'Bharath Petrol Pump', time: '7:40 AM' },
      { name: 'HP Petrol Pump', time: '7.43 AM' },
      { name: 'Relaince Mart', time: '7:45 AM' },
      { name: 'Vasavi Cloth Market', time: '7:50 AM' },
      { name: 'Mangal Das Nagar', time: '7:55 AM' },
      { name: 'Reliance Petrol Pump', time: '8:00 AM' },
      { name: 'VIT-AP Campus', time: '8:45 AM' },
    ],
  },
  {
    routeNumber: 'GV-3',
    region: 'Guntur',
    originName: 'Hanumaiah Company',
    destinationName: 'VIT-AP Campus',
    points: [
      { name: 'Hanumaiah Company', time: '7:20 AM' },
      { name: 'Rajendra Nagar Colony', time: '7:30 AM' },
      { name: 'Brundavan Gardens', time: '7:22 AM' },
      { name: 'Sitaramaiah High School', time: '7:25 AM' },
      { name: 'Nayer Hostel Center', time: '7:28 AM' },
      { name: 'VIT-AP Campus', time: '8:45 AM' },
    ],
  },
  {
    routeNumber: 'GV-4',
    region: 'Guntur',
    originName: "Baker's Fun Center",
    destinationName: 'VIT-AP Campus',
    points: [
      { name: "Baker's Fun Center", time: '7.20 AM' },
      { name: 'HDFC Bank', time: '7.22 AM' },
      { name: 'Reliance Mart', time: '7.25 AM' },
      { name: 'Hollywood-Bollywood', time: '7.27 AM' },
      { name: 'Amaravathi Road', time: '7.30 AM' },
      { name: 'Chillies', time: '7.35 AM' },
      { name: 'VIT-AP Campus', time: '8:45 AM' },
    ],
  },
  {
    routeNumber: 'GV-5',
    region: 'Guntur',
    originName: 'S V N Colony',
    destinationName: 'VIT-AP Campus',
    points: [
      { name: 'S V N Colony', time: '7.20 AM' },
      { name: 'Gujjanagundla', time: '7.21 AM' },
      { name: 'Hanumaiah Company', time: '7.22 AM' },
      { name: 'Sthambala Garuvu', time: '7.23 AM' },
      { name: 'Old RTO Office', time: '7.24 AM' },
      { name: 'Syamala Nagar Petrol Bunk', time: '7.25 AM' },
      { name: 'VIT-AP Campus', time: '8:45 AM' },
    ],
  },
  {
    routeNumber: 'GV-6',
    region: 'Guntur',
    originName: 'Swamy Theater',
    destinationName: 'VIT-AP Campus',
    points: [
      { name: 'Swamy Theater', time: '7.25 AM' },
      { name: 'TJPS College', time: '7:27 AM' },
      { name: 'Kankarakunta Bridge', time: '7:28 AM' },
      { name: 'Market', time: '7:32 AM' },
      { name: 'Bus Stand', time: '7:37 AM' },
      { name: 'Auto Nagar - Guntur', time: '7:42 AM' },
      { name: 'VIT-AP Campus', time: '8:45 AM' },
    ],
  },
  {
    routeNumber: 'GV-7',
    region: 'Guntur',
    originName: 'Palakaluru',
    destinationName: 'VIT-AP Campus',
    points: [
      { name: 'Palakaluru', time: '7.00 AM' },
      { name: 'Gujjana Gundla Current Office', time: '7:10 AM' },
      { name: 'Gujjana Gundla', time: '7.13 AM' },
      { name: 'JKC College', time: '7.14 AM' },
      { name: 'RTO Office Road', time: '7.15 AM' },
      { name: 'Chillies', time: '7.18 AM' },
      { name: 'SGV', time: '7.19 AM' },
      { name: 'VIT-AP', time: '8:45 AM' },
    ],
  },
  {
    routeNumber: 'GV-8',
    region: 'Guntur',
    originName: 'Vidhya Nagar',
    destinationName: 'VIT-AP Campus',
    points: [
      { name: 'Vidhya Nagar', time: '7.20 AM' },
      { name: 'Saibaba Temple Road', time: '7.25 AM' },
      { name: 'Koritipadu Library Center', time: '7.26 AM' },
      { name: 'Gandhi Statue Center', time: '7.28 AM' },
      { name: 'Harihara Theatre', time: '7.30 AM' },
      { name: 'Kalamandir', time: '7.31 AM' },
      { name: 'VIT-AP', time: '8:45 AM' },
    ],
  },
  {
    routeNumber: 'GV-9',
    region: 'Guntur',
    originName: 'Gujjanagundla',
    destinationName: 'VIT-AP Campus',
    points: [
      { name: 'Gujjana Gundla', time: '7.20 AM' },
      { name: 'Navabharath Nagar', time: '7.21 AM' },
      { name: 'JKC College', time: '7.22 AM' },
      { name: 'New RTO Office', time: '7.27 AM' },
      { name: 'Swarna Bharath Nagar', time: '7.28 AM' },
      { name: 'Chillies', time: '7.32 AM' },
      { name: 'VIT-AP', time: '8:45 AM' },
    ],
  },
  {
    routeNumber: 'GV-10',
    region: 'Guntur',
    originName: 'Inner Ring Road',
    destinationName: 'VIT-AP Campus',
    points: [
      { name: 'Inner Ring Road', time: '7.20 AM' },
      { name: 'Vijaya Digitals', time: '7.22 AM' },
      { name: 'Baristha', time: '7.25 AM' },
      { name: 'Ysr Bomma - Reddy Palem', time: '7.27 AM' },
      { name: 'Sri Chaitanya School', time: '7.28 AM' },
      { name: 'Reliance Petrol Pump', time: '7.30 AM' },
      { name: 'Pedakakani', time: '7.37 AM' },
      { name: 'Namburu x Road', time: '7.42 AM' },
      { name: 'Kaza', time: '7.50 AM' },
      { name: 'China kakani', time: '7.53 AM' },
      { name: 'Hailand', time: '7.55 AM' },
      { name: 'VIT-AP Campus', time: '8:45 AM' },
    ],
  },
  {
    routeNumber: 'GV-11',
    region: 'Guntur',
    originName: 'Housing Board Colony',
    destinationName: 'VIT-AP Campus',
    points: [
      { name: 'Housing Board Colony', time: '7.10 AM' },
      { name: 'Mirchi Yard', time: '7.11 AM' },
      { name: 'Sriram Nagar Colony', time: '7.12 AM' },
      { name: 'Chuttugunta', time: '7.13 AM' },
      { name: 'Mastan Dargha', time: '7.16 AM' },
      { name: 'Nalla Cheruvu High Rd', time: '7.17 AM' },
      { name: 'Market', time: '7.20 AM' },
      { name: 'Chandana Bros', time: '7.22 AM' },
      { name: 'Bus Stand', time: '7.24 AM' },
      { name: 'VIT-AP', time: '8:45 AM' },
    ],
  },
  {
    routeNumber: 'GV-12',
    region: 'Guntur',
    originName: 'Medikonduru',
    destinationName: 'VIT-AP Campus',
    points: [
      { name: 'Medikonduru', time: '7:00 AM' },
      { name: 'Perecharla', time: '7:10 AM' },
      { name: 'Vengalayapalem', time: '7:22 AM' },
      { name: 'Nallapadu', time: '7:27 AM' },
      { name: 'Housing Board Colony', time: '7:35 AM' },
      { name: 'NGO Colony', time: '7:50 AM' },
      { name: 'Venkata Ramana Colony', time: '7:52 AM' },
      { name: 'Chuttugunta', time: '7:55 AM' },
      { name: 'VIT-AP', time: '8:45 AM' },
    ],
  },
  {
    routeNumber: 'GV-13',
    region: 'Guntur',
    originName: 'Nallacheruvu High Road',
    destinationName: 'VIT-AP Campus',
    points: [
      { name: 'Nallacheruvu High Rd', time: '7.20 AM' },
      { name: 'Market', time: '7.30 AM' },
      { name: 'Chandana Bros', time: '7.35 AM' },
      { name: 'NTR Circle - Guntur', time: '7.40 AM' },
      { name: 'Bus Stand', time: '7.42 AM' },
      { name: 'Manipuram Bridge', time: '7.44 AM' },
      { name: 'Sangadigunta Temple', time: '7.47 AM' },
      { name: 'VIT-AP', time: '8:45 AM' },
    ],
  },
  {
    routeNumber: 'GV-14',
    region: 'Guntur',
    originName: 'Ponnur',
    destinationName: 'VIT-AP Campus',
    points: [
      { name: 'Ponnur', time: '7.00 AM' },
      { name: 'Patchalatadiparru', time: '7.10 AM' },
      { name: 'Munipalle', time: '7.12 AM' },
      { name: 'Manchala- Main Road', time: '7.15 AM' },
      { name: 'Chebrolu', time: '7.20 AM' },
      { name: 'Nara Koduru', time: '7.25 AM' },
      { name: 'Budampadu', time: '7.35 AM' },
      { name: 'VIT-AP', time: '8:45 AM' },
    ],
  },
  {
    routeNumber: 'GV-15',
    region: 'Guntur',
    originName: 'Lodge Center',
    destinationName: 'VIT-AP Campus',
    points: [
      { name: 'Lodge Center', time: '7:20 AM' },
      { name: 'Ala Hospital', time: '7:22 AM' },
      { name: 'Anjaneya Swamy Temple', time: '7:24 AM' },
      { name: 'Priya Gardens', time: '7:30 AM' },
      { name: 'Muthyala Reddy Nagar', time: '7:35 AM' },
      { name: 'Nagaralu', time: '7:40 AM' },
      { name: 'VIT-AP', time: '8:45 AM' },
    ],
  },
  {
    routeNumber: 'GV-16',
    region: 'Guntur',
    originName: 'Nagaralu',
    destinationName: 'VIT-AP Campus',
    points: [
      { name: 'Nagaralu', time: '7:20 AM' },
      { name: 'ID Hospitals', time: '7:22 AM' },
      { name: 'Chillis Restaurant', time: '7:24 AM' },
      { name: 'Venkateswara Swamy Temple', time: '7:28 AM' },
      { name: 'Siva Green Valley', time: '7:29 AM' },
      { name: 'Gorantla', time: '7:32 AM' },
      { name: 'Hosanna Mandir', time: '7:35 AM' },
      { name: 'Lam Farm', time: '7:40 AM' },
      { name: 'VIT-AP', time: '8:45 AM' },
    ],
  },
  {
    routeNumber: 'GV-17',
    region: 'Guntur',
    originName: 'Lam Farm',
    destinationName: 'VIT-AP Campus',
    points: [
      { name: 'Lam Farm', time: '7:30 AM' },
      { name: 'Lam Village - Jonnalagadda X Road', time: '7:32 AM' },
      { name: 'Tadikonda X Road', time: '7:35 AM' },
      { name: 'Tadikonda', time: '7:40 AM' },
      { name: 'Peda Parimi', time: '7:50 AM' },
      { name: 'VIT-AP', time: '8:45 AM' },
    ],
  },
  {
    routeNumber: 'GV-18',
    region: 'Guntur',
    originName: 'NRI Hospital / Mangalagiri',
    destinationName: 'VIT-AP Campus',
    points: [
      { name: 'NRI', time: '7:50 AM' },
      { name: 'Alfa Hotel', time: '7:52 AM' },
      { name: 'RTC Depot Road', time: '7:53 AM' },
      { name: 'Anjaneya Swamy Temple', time: '7:55 AM' },
      { name: 'Gopala Krishna Theater', time: '7:57 AM' },
      { name: 'Old Bus Stand', time: '8:00 AM' },
      { name: 'New Bus Stand', time: '8:02 AM' },
      { name: 'Reliance Trends', time: '8:03 AM' },
      { name: 'Kodi guddu Bunglow', time: '8:05 AM' },
      { name: 'Don Bosco', time: '8:07 AM' },
      { name: 'Navuluru', time: '8:10 AM' },
      { name: 'Yerrabalem', time: '8:15 AM' },
      { name: 'Krishnaya palem', time: '8:25 AM' },
      { name: 'Mandadam', time: '8:35 AM' },
      { name: 'VIT-AP Campus', time: '8:45 AM' },
    ],
  },
  {
    routeNumber: 'GV-19',
    region: 'Guntur',
    originName: 'Vadlapudi Flyover',
    destinationName: 'VIT-AP Campus',
    points: [
      { name: 'Vadlapudi Flyover', time: '7.50 AM' },
      { name: 'VJ Jounir College', time: '7.55 AM' },
      { name: 'Best Bake', time: '7.56 AM' },
      { name: 'APSP 6th Batalion Bridge', time: '7.58 AM' },
      { name: 'Atmakuru Sai baba Temple', time: '8.00 AM' },
      { name: 'Vadlapudi Bridge', time: '8.02 AM' },
      { name: 'IOCL Pertrol bunk', time: '8.03 AM' },
      { name: 'Ratnala Cheruvu', time: '8.04 AM' },
      { name: 'JS Party Office', time: '8.06 AM' },
      { name: 'VIT-AP Campus', time: '8:45 AM' },
    ],
  },
  {
    routeNumber: 'GV-20',
    region: 'Guntur',
    originName: 'Amaravathi Temple',
    destinationName: 'VIT-AP Campus',
    points: [
      { name: 'Amaravathi Temple', time: '7.20 AM' },
      { name: 'Madduru', time: '7.30 AM' },
      { name: 'Vykuntapuram', time: '7.40 AM' },
      { name: 'Harishchandra Puram', time: '7.50 AM' },
      { name: 'Borupalem', time: '7.55 AM' },
      { name: 'Dondapadu', time: '8:00 AM' },
      { name: 'Thulluru', time: '8.05 AM' },
      { name: 'Rayapadu', time: '8.10 AM' },
      { name: 'Velagapudi', time: '8.20 AM' },
      { name: 'Malkapuram', time: '8.30 AM' },
      { name: 'VIT-AP Campus', time: '8:45 AM' },
    ],
  },

  // ==========================================
  // TENALI ROUTES (TV-1 to TV-3)
  // ==========================================
  {
    routeNumber: 'TV-1',
    region: 'Tenali',
    originName: 'Tenali Bus Stand',
    destinationName: 'VIT-AP Campus',
    points: [
      { name: 'Tenali Bus Stand', time: '7.30 AM' },
      { name: 'Bhayankar Bunk', time: '7.32 AM' },
      { name: 'Nandivelugu', time: '7.35 AM' },
      { name: 'Pedavadlapudi', time: '7:55 AM' },
      { name: 'Mangalagiri Bypass', time: '8:00 AM' },
      { name: 'VIT-AP Campus', time: '8:45 AM' },
    ],
  },
  {
    routeNumber: 'TV-2',
    region: 'Tenali',
    originName: 'Tenali Bus Stand Express',
    destinationName: 'VIT-AP Campus',
    points: [
      { name: 'Tenali Bus Stand', time: '7.30 AM' },
      { name: 'Cocacola', time: '8:00 AM' },
      { name: 'Mangalagiri Bypass', time: '8.05 AM' },
      { name: 'VIT-AP Campus', time: '8:45 AM' },
    ],
  },
  {
    routeNumber: 'TV-3',
    region: 'Tenali',
    originName: 'Chenchupet Govt Hospital',
    destinationName: 'VIT-AP Campus',
    points: [
      { name: 'Chenchupet Govt Hospital', time: '7.25 AM' },
      { name: 'Tenali Market', time: '7.27 AM' },
      { name: 'Chintala pudi', time: '7.35 AM' },
      { name: 'Duggirala', time: '7.40 AM' },
      { name: 'Thummapudi X Road', time: '7.45 AM' },
      { name: 'Revendrapadu Junction', time: '7:50 AM' },
      { name: 'Pedavadlapudi Center', time: '7:55 AM' },
      { name: 'Mangalagiri Bypass', time: '8.05 AM' },
      { name: 'VIT-AP Campus', time: '8:45 AM' },
    ],
  },
];

/**
 * Approximate geographical anchor points for regions to assign realistic coordinates
 */
const REGION_COORDINATES: Record<string, { lat: number; lng: number }> = {
  Vijayawada: { lat: 16.5062, lng: 80.6480 },
  Guntur: { lat: 16.3067, lng: 80.4365 },
  Tenali: { lat: 16.2435, lng: 80.6401 },
  'VIT-AP Campus': { lat: 16.4950, lng: 80.5005 },
};

/**
 * Builds normalized and deduplicated Stop and Route objects for all 44 official routes
 */
export function buildOfficialTransitData(): {
  stops: Stop[];
  routes: Route[];
  trips: Trip[];
} {
  const stopsMap = new Map<string, Stop>();
  const routes: Route[] = [];
  const trips: Trip[] = [];

  // Always register central destination stop
  const campusStop: Stop = {
    id: 'stop-vit-ap-campus',
    code: 'VIT-AP-CAMPUS',
    name: 'VIT-AP Central Campus (Inavolu)',
    description: 'Main Campus Gate & Bus Terminal, Amaravati',
    landmark: 'Central Library Roundabout',
    latitude: 16.4950,
    longitude: 80.5005,
    isAccessible: true,
    createdAt: '2026-01-01T00:00:00Z',
  };
  stopsMap.set(campusStop.id, campusStop);

  OFFICIAL_SCHEDULES_DATA.forEach((rawRoute, rIdx) => {
    const routeId = `route-${rawRoute.routeNumber.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const routeStops: RouteStop[] = [];

    const baseCoord = REGION_COORDINATES[rawRoute.region] || REGION_COORDINATES.Vijayawada;
    const startTimeMins = timeToMinutes(rawRoute.points[0].time);
    const endTimeMins = timeToMinutes(rawRoute.points[rawRoute.points.length - 1].time) || (8 * 60 + 45);
    const totalDuration = Math.max(30, endTimeMins - startTimeMins);

    rawRoute.points.forEach((pt, pIdx) => {
      const isLast = pIdx === rawRoute.points.length - 1 || pt.name.toLowerCase().includes('vit');
      const stopId = isLast
        ? campusStop.id
        : `stop-${rawRoute.routeNumber.toLowerCase()}-${pIdx + 1}-${pt.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14)}`;

      // Coordinate interpolation along corridor towards campus
      const progress = pIdx / Math.max(1, rawRoute.points.length - 1);
      const lat = isLast
        ? campusStop.latitude
        : Number((baseCoord.lat + (campusStop.latitude - baseCoord.lat) * progress + (Math.sin(pIdx * 1.5) * 0.006)).toFixed(5));
      const lng = isLast
        ? campusStop.longitude
        : Number((baseCoord.lng + (campusStop.longitude - baseCoord.lng) * progress + (Math.cos(pIdx * 1.5) * 0.006)).toFixed(5));

      if (!stopsMap.has(stopId)) {
        stopsMap.set(stopId, {
          id: stopId,
          code: isLast ? campusStop.code : `${rawRoute.routeNumber}-S${pIdx + 1}`,
          name: pt.name,
          description: `${rawRoute.region} Corridor Scheduled Boarding Point`,
          landmark: `${rawRoute.region} Service Road`,
          latitude: lat,
          longitude: lng,
          isAccessible: true,
          createdAt: '2026-01-01T00:00:00Z',
        });
      }

      const pointTimeMins = timeToMinutes(pt.time);
      const offsetMins = Math.max(0, pointTimeMins - startTimeMins);

      routeStops.push({
        id: `rs-${routeId}-${pIdx + 1}`,
        routeId,
        stopId,
        stopSequence: pIdx + 1,
        arrivalOffsetMinutes: offsetMins,
        departureOffsetMinutes: offsetMins + (isLast ? 0 : 1),
        stop: stopsMap.get(stopId),
      });
    });

    const originStopId = routeStops[0].stopId;
    const destStopId = routeStops[routeStops.length - 1].stopId;

    const route: Route = {
      id: routeId,
      routeNumber: rawRoute.routeNumber,
      routeName: `${rawRoute.routeNumber} — ${rawRoute.originName} to VIT-AP Campus`,
      description: `Official ${rawRoute.region} student & faculty commuter corridor. Morning arrival at 8:45 AM.`,
      originStopId,
      destinationStopId: destStopId,
      status: 'active',
      estimatedDurationMinutes: totalDuration,
      distanceKm: Number((20 + (rIdx % 15) * 1.8).toFixed(1)),
      fareAmount: 0, // Free institutional transit for enrolled students & staff
      stops: routeStops,
    };
    routes.push(route);

    // Create a scheduled morning trip for today
    const departureTime = normalizeTime(rawRoute.points[0].time).split(' ')[0]; // e.g. "07:00"
    const arrivalTime = '08:45';

    trips.push({
      id: `trip-${route.routeNumber.toLowerCase()}-morning`,
      routeId: route.id,
      busId: `bus-${(rIdx % 5) + 1}`, // Allocated from existing fleet
      driverId: (rIdx % 2 === 0) ? 'usr-driver-1' : 'usr-driver-2',
      conductorId: 'usr-cond-1',
      travelDate: '2026-10-28',
      departureTime,
      arrivalTime,
      status: 'scheduled',
      totalSeats: 45,
      bookedSeats: 15 + (rIdx % 20),
      operationalNotes: `Official morning commute. Pickup starts at ${rawRoute.points[0].time} from ${rawRoute.originName}.`,
      route,
      stops: routeStops.map((rs) => ({
        id: `ts-${route.id}-${rs.stopSequence}`,
        tripId: `trip-${route.routeNumber.toLowerCase()}-morning`,
        stopId: rs.stopId,
        scheduledArrival: rs.stop ? ptTimeFormatted(rawRoute.points[rs.stopSequence - 1]?.time) : '07:30',
        scheduledDeparture: rs.stop ? ptTimeFormatted(rawRoute.points[rs.stopSequence - 1]?.time) : '07:32',
        status: 'pending',
        stop: rs.stop,
      })),
    });
  });

  return {
    stops: Array.from(stopsMap.values()),
    routes,
    trips,
  };
}

function ptTimeFormatted(raw?: string): string {
  if (!raw) return '07:30';
  const norm = normalizeTime(raw);
  return norm.split(' ')[0] || '07:30';
}
