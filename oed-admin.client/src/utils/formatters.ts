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
