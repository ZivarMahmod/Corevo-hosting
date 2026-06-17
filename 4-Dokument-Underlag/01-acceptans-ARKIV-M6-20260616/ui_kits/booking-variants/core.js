/* Booking variants — shared data + theme. All variants are embedded in the
   salon shell (same brand). Single calm sage/ink theme so the comparison is
   about UX pattern, not color. Steps: tjänst → personal → dag/tid → uppgifter → klart. */
const BK = {
  accent: "#5E7361", accentD: "#44543F", soft: "#EAEBE3", bg: "#F6F4EE",
  surface: "#FFFFFF", ink: "#232520", ink2: "#6B6F63", line: "#E2DED2",
  font: "'Inter', system-ui, sans-serif", serif: "'Cormorant Garamond', Georgia, serif",
  salon: "Lykke",
  services: [
    { name: "Klippning", time: "45 min", price: "595 kr" },
    { name: "Färg & slingor", time: "120 min", price: "fr. 1 450 kr" },
    { name: "Skägg & rakning", time: "30 min", price: "345 kr" },
    { name: "Styling & fön", time: "40 min", price: "450 kr" },
  ],
  staff: [
    { name: "Första lediga", role: "Snabbast", any: true },
    { name: "Elin", role: "Färg & klipp" },
    { name: "Karim", role: "Barberare" },
    { name: "Maja", role: "Styling" },
  ],
  days: [["Idag", "12"], ["Tor", "13"], ["Fre", "14"], ["Lör", "15"], ["Mån", "17"], ["Tis", "18"]],
  slots: ["09:00", "09:30", "10:30", "11:00", "13:00", "14:30", "15:30", "16:30", "17:00"],
};
window.BK = BK;
