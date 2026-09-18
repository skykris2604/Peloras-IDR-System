export const theme = {
  bg: "#0B1220",
  bgCard: "#0F1A2E",
  bgCard2: "#162544",
  border: "#1E2F4A",
  border2: "#243656",
  text: "#E6EEF8",
  textMuted: "#8A9AB5",
  textDim: "#6B7A90",
  accent: "#00E5FF",
  accent2: "#3DFFDC",
  success: "#00E676",
  warning: "#FFB300",
  danger: "#FF3D57",
  gnss: "#00E676",
  idr: "#FFB300",
  outage: "#FF3D57",
} as const;

export const mapStyleDark = [
  { elementType: "geometry", stylers: [{ color: "#0F1A2E" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0B1220" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8A9AB5" }] },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#1E2F4A" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#162544" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#243656" }],
  },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0A1A33" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];
