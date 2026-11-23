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

export const formatDateTime = (dateString: string, includeSeconds?: boolean) => {
  if (!dateString || isNaN(Date.parse(dateString))) {
    return "Ugyldig dato";
  }

  const date = new Date(dateString);
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  };

  if (includeSeconds) {
    options.second = "2-digit";
  }

  return new Intl.DateTimeFormat("nb-NO", options).format(date);
};

export const isValidDateTime = (val: unknown): val is string =>
  typeof val === "string" && val.includes("T") && !isNaN(Date.parse(val));

export const isValidDate = (val: unknown): val is string =>
  typeof val === "string" && !isNaN(Date.parse(val));

const pad2 = (num: number): string => num.toString().padStart(2, "0");
export const formatDateTimeLocal = (dateTime: Date) =>
  `${dateTime.getFullYear()}-${pad2((dateTime.getMonth() + 1))}-${pad2((dateTime.getDate()))}T${pad2((dateTime.getHours()))}:${pad2((dateTime.getMinutes()))}`;


const escapeXmlText = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const escapeXmlAttr = (value: string) =>
  escapeXmlText(value).replaceAll('"', "&quot;");

const INDENT = "  ";

// A node's children without the whitespace-only text nodes that sit between elements.
const significantChildren = (node: Node) =>
  Array.from(node.childNodes).filter(
    (child) => child.nodeType !== Node.TEXT_NODE || child.nodeValue!.trim() !== "",
  );

const prettifyNode = (node: Node, depth: number): string[] => {
  const pad = INDENT.repeat(depth);

  switch (node.nodeType) {
    case Node.TEXT_NODE:
      return [pad + escapeXmlText(node.nodeValue!.trim())];
    case Node.CDATA_SECTION_NODE:
      return [`${pad}<![CDATA[${node.nodeValue}]]>`];
    case Node.COMMENT_NODE:
      return [`${pad}<!--${node.nodeValue}-->`];
    case Node.PROCESSING_INSTRUCTION_NODE: {
      const pi = node as ProcessingInstruction;
      return [`${pad}<?${pi.target} ${pi.data}?>`];
    }
    case Node.ELEMENT_NODE:
      break;
    default:
      return [];
  }

  const element = node as Element;
  const attributes = Array.from(element.attributes)
    .map((attr) => ` ${attr.name}="${escapeXmlAttr(attr.value)}"`)
    .join("");
  const open = `<${element.tagName}${attributes}`;
  const close = `</${element.tagName}>`;
  const children = significantChildren(element);

  if (children.length === 0) return [`${pad}${open}/>`];

  // A leaf holding only text stays on one line, its text untouched.
  if (children.length === 1 && children[0].nodeType === Node.TEXT_NODE)
    return [`${pad}${open}>${escapeXmlText(children[0].nodeValue!)}${close}`];

  return [
    `${pad}${open}>`,
    ...children.flatMap((child) => prettifyNode(child, depth + 1)),
    pad + close,
  ];
};

// Indents XML two spaces per level. It walks the DOM itself instead of using XSLTProcessor, which
// Chrome has removed. The XML declaration is dropped. Throws on XML that does not parse.
export const prettifyXml = (sourceXml: string): string => {
  const doc = new DOMParser().parseFromString(sourceXml, "application/xml");

  if (doc.getElementsByTagName("parsererror").length > 0)
    throw new Error("Malformed XML");

  return significantChildren(doc)
    .flatMap((child) => prettifyNode(child, 0))
    .join("\n");
};