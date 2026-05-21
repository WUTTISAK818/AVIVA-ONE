export type LeadStatus =
  | "New Lead"
  | "Contacted"
  | "Site Visit"
  | "Booking"
  | "Loan Process"
  | "Transfer"
  | "Closed Deal";

export const pipelineStages: LeadStatus[] = [
  "New Lead", "Contacted", "Site Visit", "Booking", "Loan Process", "Transfer", "Closed Deal",
];

export type HouseStatus = "complete" | "on-track" | "delayed";
