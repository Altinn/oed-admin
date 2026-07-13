export interface DataElement {
  id: string;
  contentType: string | null;
  selfLinks: { apps: string | null; platform: string | null } | null;
}
export interface AltinnInstance {
  data: DataElement[] | null;
}
export interface Signee {
  partyId: number;
  probateType: string | null;
  subAppStatus: string | null;
  subAppInstanceUrl: string | null;
  receiptUrl: string | null;
  submitted: string | null;
  subApp: string | null;
  extraInfo: Record<string, string> | null;
}
export interface SigneeStatusResponse {
  signeeStatus: { signeeStatus: Signee[] } | null;
}
export interface HeirDeclarationResponse {
  heirDeclaration: unknown;
}
export interface ProbateInformationResponse {
  probateInformation: unknown;
}

// The oed-declaration subapp does not expose a per-heir declaration through the
// subapps endpoint. Its DA-erklæring is the estate-level declaration, the same
// payload the "DA Probate Information" tab shows as "Data v1".
export const DECLARATION_SUBAPP = "oed-declaration";

export const isDeclarationSubApp = (signee: Signee): boolean =>
  signee.subApp?.toLowerCase() === DECLARATION_SUBAPP;
