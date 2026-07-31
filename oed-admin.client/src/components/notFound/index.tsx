import { Heading, Paragraph } from "@digdir/designsystemet-react";
import { Link } from "react-router-dom";

/**
 * Catch-all so an unmatched URL never renders an empty page. Before this, any path outside the
 * role's route tree produced a blank screen with no explanation.
 */
export default function NotFound() {
  return (
    <>
      <Heading level={1} data-size="md">
        Siden finnes ikke
      </Heading>
      <Paragraph style={{ marginTop: "var(--ds-size-2)" }}>
        <Link to="/">Tilbake til oversikt</Link>
      </Paragraph>
    </>
  );
}
