/**
 * Beat, the Fervor mascot: a 16x16 pixel football with eyes and legs.
 * '.' transparent · K black · W white · G green · Y warning
 * Shared by the web component and the icon generator.
 */
export const MASCOT_IDLE: string[] = [
  "....KKKKKKKK....",
  "..KKWWWWWWWWKK..",
  ".KWWWWWWWWWWWWK.",
  ".KWWWWWWWWWWWWK.",
  "KWWKKWWWWWWKKWWK",
  "KWWKKWWWWWWKKWWK",
  "KWWWWWWWWWWWWWWK",
  "KWWWWKWWWWKWWWWK",
  "KWWWWWKKKKWWWWWK",
  "KWWWWWWWWWWWWWWK",
  ".KWWWGGGGGGWWWK.",
  ".KWWWGGGGGGWWWK.",
  "..KKWWGGGGWWKK..",
  "....KKKKKKKK....",
  "....KK....KK....",
  "...KKK....KKK...",
];

export const MASCOT_KICK: string[] = [
  "....KKKKKKKK..Y.",
  "..KKWWWWWWWWKKY.",
  ".KWWWWWWWWWWWWK.",
  ".KWWWWWWWWWWWWKY",
  "KWWKKWWWWWWKKWWK",
  "KWWKKWWWWWWKKWWK",
  "KWWWWWWWWWWWWWWK",
  "KWWWKWWWWWWKWWWK",
  "KWWWWKKKKKKWWWWK",
  "KWWWWWWWWWWWWWWK",
  ".KWWWGGGGGGWWWK.",
  ".KWWWGGGGGGWWWK.",
  "..KKWWGGGGWWKK..",
  "....KKKKKKKK.KK.",
  "....KK......KKK.",
  "...KKK..........",
];

export const MASCOT_COLORS: Record<string, string> = {
  K: "#0A0A0A",
  W: "#FFFFFF",
  G: "#0F8A52",
  Y: "#F5A524",
};
