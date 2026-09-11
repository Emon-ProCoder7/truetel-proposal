// ============================================================================
// TrueTel's real Cloud Phone hardware catalog, ported verbatim (SKUs, specs,
// photos) from CloudPhone_Proposal_Template.html's own hardwareDB — same
// catalog, same images, so a generated proposal looks like it came from the
// same company as every proposal already sent.
//
// unitPriceExGst on every item is a PLACEHOLDER — the original template
// never carried hardware pricing (a rep typed it into the commercial table
// by hand every time). These are reasonable tier-consistent estimates so the
// mechanism works end-to-end; get a rep or Jack to confirm real numbers
// before relying on them for a live quote.
// ============================================================================

export type HardwareGroup = "Yealink" | "Cisco" | "Fanvil" | "Grandstream" | "Accessories" | "Network";

export type HardwareItem = {
  id: string;
  group: HardwareGroup;
  title: string;
  subtitle: string;
  desc: string;
  features: string[];
  img: string;
  unitPriceExGst: number; // placeholder — see note above
};

export const HARDWARE_DB: Record<string, HardwareItem> = {
  yealink_t53: {
    id: "yealink_t53", group: "Yealink", title: "Yealink T53 - Standard", subtitle: "Essential Business Phone",
    desc: "An entry-level phone well suited for common workspace. Features an adjustable graphical display.",
    features: ["3.7\" Graphical LCD", "Adjustable Screen", "8 Line Keys", "Gigabit Ethernet"],
    img: "https://m.media-amazon.com/images/I/716lXpe2jbL._AC_SL1500_.jpg", unitPriceExGst: 25,
  },
  yealink_t54: {
    id: "yealink_t54", group: "Yealink", title: "Yealink T54W - Executive", subtitle: "Professional Mid-Range",
    desc: "Designed for professionals with a 4.3\" colour screen, built-in Bluetooth and Wi-Fi.",
    features: ["4.3\" Colour Display", "Built-in Wi-Fi/Bluetooth", "10 Line Keys", "USB Port"],
    img: "https://m.media-amazon.com/images/I/51qkzQ6HYIL._AC_SX425_.jpg", unitPriceExGst: 35,
  },
  yealink_t57: {
    id: "yealink_t57", group: "Yealink", title: "Yealink T57W - Premium", subtitle: "Touch Screen Flagship",
    desc: "Premium executive phone with a 7-inch adjustable multi-point touch screen for rich visual presentation.",
    features: ["7\" Touch Screen (800x480)", "Built-in Wi-Fi/Bluetooth", "29 Touch Keys", "Content Sharing Support"],
    img: "https://m.media-amazon.com/images/I/61rYjrMPt8L._SL1430_.jpg", unitPriceExGst: 50,
  },
  cisco_basic: {
    id: "cisco_basic", group: "Cisco", title: "Cisco 7841", subtitle: "Basic / Standard",
    desc: "Reliable, secure, and energy-efficient. Ideal for knowledge workers with moderate voice communications needs.",
    features: ["3.5\" Grayscale Display", "4 Line Keys", "High-Fidelity Audio", "Wall Mountable"],
    img: "https://m.media-amazon.com/images/I/81-0lO9ep2L._AC_SL1500_.jpg", unitPriceExGst: 28,
  },
  cisco_medium: {
    id: "cisco_medium", group: "Cisco", title: "Cisco 8851", subtitle: "Medium / Professional",
    desc: "Business-class collaboration endpoint with colour display and Bluetooth for headset integration.",
    features: ["5\" Widescreen Colour", "Bluetooth Integration", "USB Port", "Gigabit Ethernet"],
    img: "https://m.media-amazon.com/images/I/71+PymJKiXL._AC_SL1500_.jpg", unitPriceExGst: 38,
  },
  cisco_premium: {
    id: "cisco_premium", group: "Cisco", title: "Cisco 8865", subtitle: "Premium Video Phone",
    desc: "Combines high-fidelity voice with HD video communications. Perfect for executives and video collaboration.",
    features: ["5\" HD Video Screen", "720p HD Camera", "Wi-Fi & Bluetooth", "Intelligent Proximity"],
    img: "https://m.media-amazon.com/images/I/61dpRTCGnkL._AC_SL1000_.jpg", unitPriceExGst: 55,
  },
  fanvil_v64: {
    id: "fanvil_v64", group: "Fanvil", title: "Fanvil V64", subtitle: "Prime Business Phone",
    desc: "A color screen phone with built-in Wi-Fi/Bluetooth, delivering a smart and smooth business communication experience.",
    features: ["3.5\" Color Screen", "Wi-Fi & Bluetooth 4.2", "Gigabit Ethernet", "12 SIP Lines"],
    img: "https://m.media-amazon.com/images/I/61l-MiQmAPL._SL1500_.jpg", unitPriceExGst: 27,
  },
  fanvil_v65: {
    id: "fanvil_v65", group: "Fanvil", title: "Fanvil V65", subtitle: "Adjustable Screen",
    desc: "Features an adjustable screen (0-40 degrees) and antibacterial material for health and comfort.",
    features: ["4.3\" Adjustable Screen", "20 SIP Lines", "Antibacterial Surface", "HD Audio"],
    img: "https://m.media-amazon.com/images/I/51moRXz0mRL._AC_SL1318_.jpg", unitPriceExGst: 33,
  },
  fanvil_v67: {
    id: "fanvil_v67", group: "Fanvil", title: "Fanvil V67", subtitle: "Flagship Video Phone",
    desc: "Android 9.0 OS with a cool lighting keypad and a 7-inch touch screen for an elite experience.",
    features: ["7\" Touch Screen", "Android 9.0 OS", "5MP Adjustable Camera", "Cool Lighting Keypad"],
    img: "https://m.media-amazon.com/images/I/51WiNRCHtAL._AC_SL1318_.jpg", unitPriceExGst: 48,
  },
  gs_basic: {
    id: "gs_basic", group: "Grandstream", title: "Grandstream GRP2604P", subtitle: "Basic / Essential",
    desc: "A 3-line carrier-grade IP phone with zero-touch provisioning and PoE support.",
    features: ["132x64 Backlit LCD", "3 Lines / 6 SIP Accounts", "Gigabit Ports", "PoE Support"],
    img: "https://m.media-amazon.com/images/I/71rhsedj9JL._AC_SL1500_.jpg", unitPriceExGst: 24,
  },
  gs_medium: {
    id: "gs_medium", group: "Grandstream", title: "Grandstream GRP2615", subtitle: "Medium / High-End",
    desc: "High-end carrier-grade IP phone featuring a sleek design and a suite of next-generation features.",
    features: ["4.3\" Color LCD", "10 Lines / 16 SIP Accounts", "Integrated Wi-Fi/BT", "40 Virtual BLF Keys"],
    img: "https://m.media-amazon.com/images/I/519O05T4fmL._AC_SL1200_.jpg", unitPriceExGst: 36,
  },
  gs_premium: {
    id: "gs_premium", group: "Grandstream", title: "Grandstream GXV3380", subtitle: "Premium Video Phone",
    desc: "High-end smart video phone for Android. Combines a 16-line IP phone with a multi-platform video solution.",
    features: ["8\" Touch Screen", "Android OS", "2MP Camera", "HDMI In/Out"],
    img: "https://m.media-amazon.com/images/I/51OxZwzvqzL._AC_SL1500_.jpg", unitPriceExGst: 52,
  },
  headset_wh67: {
    id: "headset_wh67", group: "Accessories", title: "Yealink WH67 DECT Wireless Headset", subtitle: "Convertible UC Bluetooth/DECT Audio Workstation",
    desc: "Professional convertible wireless headset designed for unified communications with broad platform support and desktop workstation features.",
    features: ["DECT + Bluetooth (up to 120m range)", "4\" Touchscreen Base Workstation", "Dual Mics with Noise Filtering", "~8 hrs Talk Time"],
    img: "https://m.media-amazon.com/images/I/71+zmCs37VL._AC_SL1500_.jpg", unitPriceExGst: 18,
  },
  net_ap_tplink: {
    id: "net_ap_tplink", group: "Network", title: "TP-Link Omada AX3000", subtitle: "Basic Access Point",
    desc: "Ceiling mount Wi-Fi 6 access point for high-density business environments.",
    features: ["Wi-Fi 6 (AX3000)", "Gigabit PoE Port", "Seamless Roaming", "Cloud Management"],
    img: "https://m.media-amazon.com/images/I/41OrxU-z1nL._AC_SL1000_.jpg", unitPriceExGst: 15,
  },
  net_extender_cisco: {
    id: "net_extender_cisco", group: "Network", title: "Cisco Business CBW142ACM", subtitle: "Wi-Fi Mesh Extender",
    desc: "Enterprise-grade mesh extender designed to expand wireless coverage for Cisco Business Wi-Fi networks.",
    features: ["Seamless Roaming with Cisco APs", "Plug-and-Play Deployment", "Compact Wall-Mount Design", "Enterprise-Level Security"],
    img: "https://m.media-amazon.com/images/I/61CIvpNXJwL._AC_SX569_.jpg", unitPriceExGst: 20,
  },
  net_switch: {
    id: "net_switch", group: "Network", title: "Cisco Business CBS220-8P-E-2G", subtitle: "Managed PoE+ Switch",
    desc: "Business-grade Layer 2 managed Gigabit switch with PoE+ support for IP phones, access points, and cameras.",
    features: ["8x Gigabit Ports with PoE+", "VLAN & QoS Support", "Fanless, Silent Operation", "Compact Business Design"],
    img: "https://m.media-amazon.com/images/I/51PrengxL8L._AC_SL1500_.jpg", unitPriceExGst: 22,
  },
  net_router: {
    id: "net_router", group: "Network", title: "Cisco RV340 VPN Router", subtitle: "Business Security Gateway",
    desc: "Secure business VPN router with integrated firewall and remote access support for small and medium offices.",
    features: ["Dual Gigabit WAN/LAN", "Site-to-Site & Remote VPN", "Built-in Firewall Protection", "Reliable Business Connectivity"],
    img: "https://m.media-amazon.com/images/I/71NMLNv+WiL._AC_SL1500_.jpg", unitPriceExGst: 25,
  },
};

export const HARDWARE_GROUP_ORDER: HardwareGroup[] = ["Yealink", "Cisco", "Fanvil", "Grandstream", "Accessories", "Network"];

export type HardwareSlotId = "primary" | "secondary1" | "secondary2" | "accessory1" | "accessory2";

export const HARDWARE_SLOTS: { id: HardwareSlotId; label: string; defaultId: string | null; groups: HardwareGroup[] }[] = [
  { id: "primary", label: "Primary handset", defaultId: "yealink_t54", groups: ["Yealink", "Cisco", "Fanvil", "Grandstream"] },
  { id: "secondary1", label: "Secondary hardware 1", defaultId: null, groups: ["Yealink", "Cisco", "Fanvil", "Grandstream"] },
  { id: "secondary2", label: "Secondary hardware 2", defaultId: null, groups: ["Yealink", "Cisco", "Fanvil", "Grandstream"] },
  { id: "accessory1", label: "Accessory / network 1", defaultId: null, groups: ["Accessories", "Network"] },
  { id: "accessory2", label: "Accessory / network 2", defaultId: null, groups: ["Accessories", "Network"] },
];

export type HardwareLine = { itemId: string | null; qty: number };
export type HardwareSelection = Record<HardwareSlotId, HardwareLine>;

export const DEFAULT_HARDWARE_SELECTION: HardwareSelection = {
  primary: { itemId: null, qty: 0 },
  secondary1: { itemId: null, qty: 0 },
  secondary2: { itemId: null, qty: 0 },
  accessory1: { itemId: null, qty: 0 },
  accessory2: { itemId: null, qty: 0 },
};
