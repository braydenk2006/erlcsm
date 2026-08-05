/**
 * A default penal code for roleplay servers. Communities can reference these
 * when writing citations, arrests, and warrants. Fines are in dollars and jail
 * time is in minutes (server time), which admins can tune later.
 */
export type PenalCodeClass = "Infraction" | "Traffic" | "Misdemeanor" | "Felony";

export type PenalCharge = {
  code: string;
  title: string;
  class: PenalCodeClass;
  fine: number;
  jailMinutes: number;
};

export const PENAL_CODE: readonly PenalCharge[] = [
  { code: "T-101", title: "Speeding (1-15 over)", class: "Traffic", fine: 150, jailMinutes: 0 },
  { code: "T-102", title: "Speeding (16-25 over)", class: "Traffic", fine: 250, jailMinutes: 0 },
  { code: "T-103", title: "Reckless Driving", class: "Traffic", fine: 500, jailMinutes: 5 },
  { code: "T-104", title: "Failure to Stop", class: "Traffic", fine: 200, jailMinutes: 0 },
  { code: "T-105", title: "Illegal U-Turn", class: "Traffic", fine: 100, jailMinutes: 0 },
  { code: "T-106", title: "No Registration", class: "Traffic", fine: 175, jailMinutes: 0 },
  {
    code: "T-107",
    title: "Driving Without a License",
    class: "Misdemeanor",
    fine: 400,
    jailMinutes: 5,
  },
  { code: "M-201", title: "Disorderly Conduct", class: "Misdemeanor", fine: 300, jailMinutes: 5 },
  { code: "M-202", title: "Trespassing", class: "Misdemeanor", fine: 350, jailMinutes: 10 },
  { code: "M-203", title: "Petty Theft", class: "Misdemeanor", fine: 500, jailMinutes: 10 },
  { code: "M-204", title: "Resisting Arrest", class: "Misdemeanor", fine: 600, jailMinutes: 15 },
  {
    code: "M-205",
    title: "Obstruction of Justice",
    class: "Misdemeanor",
    fine: 700,
    jailMinutes: 15,
  },
  {
    code: "M-206",
    title: "Brandishing a Firearm",
    class: "Misdemeanor",
    fine: 900,
    jailMinutes: 20,
  },
  { code: "F-301", title: "Grand Theft Auto", class: "Felony", fine: 2000, jailMinutes: 30 },
  { code: "F-302", title: "Evading Police", class: "Felony", fine: 1500, jailMinutes: 25 },
  {
    code: "F-303",
    title: "Assault with a Deadly Weapon",
    class: "Felony",
    fine: 2500,
    jailMinutes: 40,
  },
  { code: "F-304", title: "Armed Robbery", class: "Felony", fine: 3000, jailMinutes: 45 },
  { code: "F-305", title: "Kidnapping", class: "Felony", fine: 3500, jailMinutes: 50 },
  { code: "F-306", title: "Manslaughter", class: "Felony", fine: 4000, jailMinutes: 55 },
  { code: "F-307", title: "Murder", class: "Felony", fine: 5000, jailMinutes: 60 },
  {
    code: "F-308",
    title: "Possession of a Controlled Substance",
    class: "Felony",
    fine: 1200,
    jailMinutes: 20,
  },
  {
    code: "F-309",
    title: "Attempted Murder of a Peace Officer",
    class: "Felony",
    fine: 5000,
    jailMinutes: 60,
  },
  { code: "I-401", title: "Jaywalking", class: "Infraction", fine: 75, jailMinutes: 0 },
  { code: "I-402", title: "Loitering", class: "Infraction", fine: 100, jailMinutes: 0 },
  { code: "I-403", title: "Littering", class: "Infraction", fine: 120, jailMinutes: 0 },
];

export function findCharge(code: string): PenalCharge | undefined {
  return PENAL_CODE.find((charge) => charge.code === code);
}
