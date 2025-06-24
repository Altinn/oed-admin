export const formatRoleCode = (roleCode: string) => {
  return roleCode.split(":").pop();
};

export const formatDate = (dateString: string) => {
  if (!dateString || isNaN(Date.parse(dateString))) {
    return "Ugyldig dato";
  }

  const date = new Date(dateString);
  return new Intl.DateTimeFormat("nb-NO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

export const formatDateTime = (dateString: string) => {
  if (!dateString || isNaN(Date.parse(dateString))) {
    return "Ugyldig dato";
  }

  const date = new Date(dateString);
  return new Intl.DateTimeFormat("nb-NO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export const isValidDateTime = (val: unknown): val is string =>
  typeof val === "string" && val.includes("T") && !isNaN(Date.parse(val));

export const isValidDate = (val: unknown): val is string =>
  typeof val === "string" && !isNaN(Date.parse(val));

const pad2 = (num: number) : string => num.toString().padStart(2, "0");
export const formatDateTimeLocal = (dateTime: Date) => 
    `${dateTime.getFullYear()}-${pad2((dateTime.getMonth() + 1))}-${pad2((dateTime.getDate()))}T${pad2((dateTime.getHours()))}:${pad2((dateTime.getMinutes()))}`;
