export interface WhoAmIResponse {
  name: string;
}

export interface RequestBody {
  Nin?: string;
  HeirNin?: string;
  PartyId?: number;
  CaseNumber?: string;
  Name?: string;
  Page?: number;
  PageSize?: number;
}

export interface ResponseBody {
  page: number;
  pageSize: number;
  estates: Estate[];
}

export interface MinimalEstate extends Estate {
  heirs: SimpleHeir[];
  scheduled: Date;
}
export interface MinimalSearchResponse {
  estate: MinimalEstate;
}

export interface SimpleHeir {
  birthdate: string;
}

export interface Estate {
  id: string;
  deceasedNin: string;
  deceasedPartyId: number;
  deceasedName: string;
  dateOfDeath: string; // ISO date string
  instanceId: string;
  declarationInstanceId?: string;

  caseId?: string;
  caseNumber?: string;
  caseStatus?: string;
  districtCourtName?: string;
  status: string;
  probateResult?: string;

  created: string; // ISO date string
  probateDeadline?: string; // ISO date string
  firstHeirReceived?: string; // ISO date string
  delarationCreated?: string; // ISO date string
  declarationSubmitted?: string; // ISO date string
  probateIssued?: string; // ISO date string
}

export interface RoleAssignment {
  id: number;
  roleCode: string;
  estateSsn: string;
  heirSsn?: string | null;
  recipientSsn: string;
  created?: string;
  justification?: string | null;
}

export interface RoleAssignmentLog extends RoleAssignment {
  action: "GRANT" | "REVOKE";
  timestamp: string;
}

export interface RoleAssignmentsResponse {
  roleAssignments: RoleAssignment[];
}

export interface RoleAssignmentLogResponse {
  roleAssignmentLog: RoleAssignmentLog[];
}

export interface Task {
  id: string;
  type: string;
  jsonPayload?: string;
  created: string;
  scheduled?: string;
  executed?: string;
  lastAttempt?: string;
  lastError?: string;
  attempts: number;
  estateSsn?: string;
  status: TaskStatus;
}

export interface TaskResponse {
  tasks: Array<Task>;
}

export type TaskStatus =
  | "Scheduled"
  | "Executed"
  | "Retrying"
  | "DeadLetterQueue"
  | "Unknown";

export interface InstanceResponse {
  data: unknown;
}

/*
 "specversion": "1.0",
    "id": "4a27817f-732e-4448-96ca-0bd7e4373d1c",
    "time": "2025-03-28T10:40:56.4171752Z",
    "type": "no.altinn.events.digitalt-dodsbo.v1.case-status-updated",
    "source": "https://hendelsesliste.test.domstol.no/api/objects/5ee69915-f3c9-465e-b346-70f7d56f8ab9",
    "subject": "18855699938",
    "resource": "urn:altinn:resource:dodsbo-domstoladmin-api",
    "datacontenttype": "application/json",
    "data": {
*/
export interface AltinnEvent {
  specversion: string;
  id: string;
  time: string;
  type: string;
  source: string;
  subject: string;
  resource: string;
  datacontenttype: string;
  data: string;
}

export interface EstateEventsResponse {
  events: string;
}
