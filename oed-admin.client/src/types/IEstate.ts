export interface RequestBody {
  Nin?: string;
  PartyId?: number;
  Name?: string;
  Page?: number;
  PageSize?: number;
}

export interface ResponseBody {
  page: number;
  pageSize: number;
  estates: Estate[];
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
