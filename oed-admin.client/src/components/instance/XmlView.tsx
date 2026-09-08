import { useMemo, type ReactNode } from "react";
import { prettifyXml } from "../../utils/formatters";
import "./style.css";

interface Props {
  xml: string;
}

// The token shapes we colour. Anything not matching one of these alternatives
// falls through as a text run between matches.
const TOKEN_PATTERN =
  /(<!--[\s\S]*?-->)|(<!\[CDATA\[[\s\S]*?\]\]>)|(<[?!][^>]*>)|(<\/?[A-Za-z_][\w.:-]*(?:[^>"']|"[^"]*"|'[^']*')*>)/g;

// <  /  name   attributes   />
const TAG_PATTERN = /^(<\/?)([\w.:-]+)([\s\S]*?)(\/?>)$/;
const ATTRIBUTE_PATTERN = /([\w.:-]+)(\s*=\s*)("[^"]*"|'[^']*')/g;

const span = (className: string, text: string, key: string) => (
  <span className={className} key={key}>
    {text}
  </span>
);

// Splits the inside of a start tag into attribute name / equals / value,
// keeping the whitespace between them so the indentation survives.
const renderAttributes = (source: string, key: string): ReactNode[] => {
  const nodes: ReactNode[] = [];
  let last = 0;

  for (const match of source.matchAll(ATTRIBUTE_PATTERN)) {
    const [, name, equals, value] = match;
    const start = match.index;

    if (start > last) {
      nodes.push(source.slice(last, start));
    }
    nodes.push(span("xml-attr-name", name, `${key}-n${start}`));
    nodes.push(span("xml-punctuation", equals, `${key}-e${start}`));
    nodes.push(span("xml-attr-value", value, `${key}-v${start}`));
    last = start + match[0].length;
  }

  if (last < source.length) {
    nodes.push(source.slice(last));
  }

  return nodes;
};

const renderTag = (token: string, key: string): ReactNode => {
  const match = TAG_PATTERN.exec(token);
  if (!match) {
    return span("xml-tag", token, key);
  }

  const [, open, name, attributes, close] = match;
  return (
    <span key={key}>
      {span("xml-punctuation", open, `${key}-o`)}
      {span("xml-tag", name, `${key}-t`)}
      {renderAttributes(attributes, key)}
      {span("xml-punctuation", close, `${key}-c`)}
    </span>
  );
};

const highlight = (source: string): ReactNode[] => {
  const nodes: ReactNode[] = [];
  let last = 0;

  for (const match of source.matchAll(TOKEN_PATTERN)) {
    const [token, comment, cdata, prolog] = match;
    const key = `t${match.index}`;

    if (match.index > last) {
      nodes.push(span("xml-text", source.slice(last, match.index), `x${last}`));
    }

    if (comment) {
      nodes.push(span("xml-comment", token, key));
    } else if (cdata) {
      nodes.push(span("xml-cdata", token, key));
    } else if (prolog) {
      nodes.push(span("xml-prolog", token, key));
    } else {
      nodes.push(renderTag(token, key));
    }

    last = match.index + token.length;
  }

  if (last < source.length) {
    nodes.push(span("xml-text", source.slice(last), `x${last}`));
  }

  return nodes;
};

// prettifyXml throws on input DOMParser cannot transform, and yields a
// parsererror document for input it can parse but not validate. In both cases
// the raw payload is more useful to a caseworker than an empty panel.
const safePrettify = (xml: string): string => {
  try {
    const pretty = prettifyXml(xml);
    return pretty.includes("<parsererror") ? xml : pretty;
  } catch {
    return xml;
  }
};

export default function XmlView({ xml }: Props) {
  const nodes = useMemo(() => highlight(safePrettify(xml)), [xml]);

  return <pre className="xml-view">{nodes}</pre>;
}
