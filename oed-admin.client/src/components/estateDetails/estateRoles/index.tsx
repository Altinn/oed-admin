import { useLocation } from "react-router-dom";
import RoleLogTable from "./RoleLogTable";
import RoleTable from "./RoleTable";

interface Props {
  estateId: string;
}

export default function EstateRoles({ estateId }: Props) {
  const location = useLocation();
  const id = estateId || location.pathname.split("/").pop() || "";

  return (
    <>
      <RoleTable estateId={id} />
      <RoleLogTable estateId={id} />
    </>
  );
}
