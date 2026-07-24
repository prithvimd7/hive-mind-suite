// Deterministic mock data for the Company OS dashboard.
// Replace with real data sources once backend / integrations are wired.

export type Trend = { label: string; value: number; secondary?: number }[];

const seed = (n: number) => Math.abs(Math.sin(n * 999.13)) ;

export const revenueTrend: Trend = Array.from({ length: 30 }).map((_, i) => ({
  label: `D${i + 1}`,
  value: Math.round(38000 + seed(i) * 42000 + i * 900),
  secondary: Math.round(30000 + seed(i + 5) * 30000 + i * 600),
}));

export const salesForecast: Trend = Array.from({ length: 12 }).map((_, i) => ({
  label: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][i],
  value: Math.round(900000 + seed(i) * 500000 + i * 40000),
  secondary: Math.round(950000 + seed(i + 2) * 460000 + i * 50000),
}));

export const channelSales = [
  { channel: "Website", revenue: 1284000, orders: 3120, conv: 3.4 },
  { channel: "Amazon", revenue: 984000, orders: 2410, conv: 5.1 },
  { channel: "Flipkart", revenue: 612000, orders: 1580, conv: 4.2 },
  { channel: "Blinkit", revenue: 428000, orders: 3980, conv: 6.9 },
  { channel: "BigBasket", revenue: 356000, orders: 2870, conv: 5.6 },
  { channel: "Wholesale", revenue: 1820000, orders: 210, conv: 22.4 },
  { channel: "Retail", revenue: 742000, orders: 1120, conv: 8.1 },
  { channel: "Distributors", revenue: 2140000, orders: 96, conv: 31.2 },
];

export const topProducts = [
  { name: "Protein Bar — Cocoa", units: 12840, revenue: 642000, margin: 38 },
  { name: "Whey Isolate 1kg", units: 3120, revenue: 936000, margin: 42 },
  { name: "Peanut Butter Crunch", units: 8420, revenue: 421000, margin: 33 },
  { name: "Retort Ready Meal", units: 5310, revenue: 318000, margin: 29 },
  { name: "Electrolyte Mix", units: 4210, revenue: 168000, margin: 45 },
];

export const campaigns = [
  { name: "Meta — Retarget Q4", spend: 84000, revenue: 412000, roas: 4.9, ctr: 2.1 },
  { name: "Google — Brand", spend: 32000, revenue: 218000, roas: 6.8, ctr: 8.4 },
  { name: "Meta — Prospecting", spend: 128000, revenue: 356000, roas: 2.8, ctr: 1.4 },
  { name: "Amazon — SP Auto", spend: 46000, revenue: 189000, roas: 4.1, ctr: 0.9 },
  { name: "Google — PMax", spend: 72000, revenue: 148000, roas: 2.1, ctr: 1.1 },
];

export const inventory = [
  { sku: "PB-COC-60",  name: "Protein Bar — Cocoa", type: "Finished",   stock: 4210, min: 1500, status: "ok" },
  { sku: "WHY-ISO-1K", name: "Whey Isolate 1kg",     type: "Finished",   stock: 210,  min: 400,  status: "low" },
  { sku: "PB-PNT-40",  name: "Peanut Butter",         type: "Finished",   stock: 980,  min: 600,  status: "ok" },
  { sku: "RAW-COC-01", name: "Cocoa Powder",          type: "Raw",        stock: 120,  min: 200,  status: "low" },
  { sku: "PKG-BOX-M",  name: "Shipper Box M",         type: "Packaging",  stock: 8420, min: 2000, status: "ok" },
  { sku: "RTM-CHK-01", name: "Retort Chicken Meal",   type: "Finished",   stock: 62,   min: 300,  status: "critical" },
];

export const production = Array.from({ length: 14 }).map((_, i) => ({
  label: `D${i + 1}`,
  value: Math.round(1800 + seed(i) * 900),
  secondary: Math.round(2000 + seed(i + 1) * 600),
}));

export const financePnL = [
  { month: "Jan", revenue: 1240000, expense: 890000 },
  { month: "Feb", revenue: 1380000, expense: 920000 },
  { month: "Mar", revenue: 1520000, expense: 980000 },
  { month: "Apr", revenue: 1640000, expense: 1020000 },
  { month: "May", revenue: 1780000, expense: 1080000 },
  { month: "Jun", revenue: 1920000, expense: 1120000 },
  { month: "Jul", revenue: 2080000, expense: 1210000 },
];

export const pipeline = [
  { stage: "Lead", count: 148, value: 4200000 },
  { stage: "Qualified", count: 62, value: 3100000 },
  { stage: "Proposal", count: 28, value: 2400000 },
  { stage: "Negotiation", count: 14, value: 1800000 },
  { stage: "Won", count: 9, value: 1200000 },
];

export const team = [
  { name: "Aarav Mehta", role: "Sales Lead", score: 94, target: 100, status: "online" },
  { name: "Priya Shah", role: "Marketing", score: 88, target: 100, status: "online" },
  { name: "Rohan Nair", role: "Production", score: 76, target: 100, status: "away" },
  { name: "Isha Kapoor", role: "Finance", score: 91, target: 100, status: "online" },
  { name: "Vikram Rao", role: "Warehouse", score: 68, target: 100, status: "offline" },
  { name: "Neha Iyer", role: "CRM", score: 82, target: 100, status: "online" },
];

export const notifications = [
  { id: 1, title: "Low stock: Whey Isolate 1kg", time: "2m",  kind: "warning" },
  { id: 2, title: "Meta campaign overspend +18%", time: "18m", kind: "destructive" },
  { id: 3, title: "Retort batch #A214 passed QC",  time: "1h", kind: "success" },
  { id: 4, title: "Invoice #INV-2841 overdue",     time: "3h", kind: "destructive" },
  { id: 5, title: "Distributor onboarded: NB Mart", time: "5h", kind: "info" },
];

export const currency = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export const compact = (n: number) =>
  new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(n);
