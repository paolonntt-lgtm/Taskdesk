import React from "react";
import { Box } from "@mui/material";

export function wrapSelection(
  textarea: HTMLTextAreaElement,
  prefix: string,
  suffix: string,
  defaultText: string,
  onChange: (val: string) => void,
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const selected = value.slice(start, end) || defaultText;
  const newValue = value.slice(0, start) + prefix + selected + suffix + value.slice(end);
  onChange(newValue);
  setTimeout(() => {
    textarea.focus();
    textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
  }, 0);
}

export function insertLinePrefix(
  textarea: HTMLTextAreaElement,
  prefix: string,
  onChange: (val: string) => void,
) {
  const { selectionStart: start, selectionEnd: end, value } = textarea;

  const firstLineStart = value.lastIndexOf("\n", start - 1) + 1;
  const lastLineEnd = value.indexOf("\n", end);
  const blockEnd = lastLineEnd === -1 ? value.length : lastLineEnd;

  const block = value.slice(firstLineStart, blockEnd);
  const lines = block.split("\n");

  const allHavePrefix = lines.every((l) => l.startsWith(prefix));

  let newBlock: string;
  if (allHavePrefix) {
    newBlock = lines.map((l) => l.slice(prefix.length)).join("\n");
  } else {
    newBlock = lines.map((l) => (l.startsWith(prefix) ? l : prefix + l)).join("\n");
  }

  const newValue = value.slice(0, firstLineStart) + newBlock + value.slice(blockEnd);
  onChange(newValue);

  const lengthDiff = newBlock.length - block.length;
  setTimeout(() => {
    textarea.focus();
    const newStart = Math.max(firstLineStart, start + (allHavePrefix ? -prefix.length : prefix.length));
    const newEnd = end + lengthDiff;
    textarea.setSelectionRange(newStart, Math.max(newStart, newEnd));
  }, 0);
}

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(~(.+?)~)|(@\[([^\]]+)\])/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let i = 0;

  while ((m = regex.exec(text))) {
    if (m.index > lastIndex) {
      nodes.push(text.slice(lastIndex, m.index));
    }
    if (m[1]) {
      nodes.push(<strong key={`${keyPrefix}-${i++}`}>{m[2]}</strong>);
    } else if (m[3]) {
      nodes.push(<em key={`${keyPrefix}-${i++}`}>{m[4]}</em>);
    } else if (m[5]) {
      nodes.push(<u key={`${keyPrefix}-${i++}`}>{m[6]}</u>);
    } else if (m[7]) {
      nodes.push(
        <Box
          component="span"
          key={`${keyPrefix}-${i++}`}
          sx={{
            display: "inline-block",
            bgcolor: "primary.50",
            color: "primary.700",
            fontWeight: 600,
            fontSize: "0.78rem",
            px: 0.5,
            borderRadius: 0.75,
            border: "1px solid",
            borderColor: "primary.200",
            lineHeight: 1.4,
          }}
        >
          @{m[8]}
        </Box>,
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

export function renderStickyNoteText(text: string): React.ReactNode {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let listBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length) {
      const blockIdx = blocks.length;
      blocks.push(
        <Box component="ul" key={`ul-${blockIdx}`} sx={{ m: 0, my: 0.5, pl: 2.5 }}>
          {listBuffer.map((l, idx) => (
            <li key={idx}>{renderInline(l, `li-${blockIdx}-${idx}`)}</li>
          ))}
        </Box>,
      );
      listBuffer = [];
    }
  };

  lines.forEach((line, idx) => {
    if (/^[-*]\s+/.test(line)) {
      listBuffer.push(line.replace(/^[-*]\s+/, ""));
      return;
    }
    flushList();
    if (line.trim() === "") {
      blocks.push(<Box key={`br-${idx}`} sx={{ height: "0.6em" }} />);
    } else {
      blocks.push(<div key={`p-${idx}`}>{renderInline(line, `p-${idx}`)}</div>);
    }
  });
  flushList();

  return blocks;
}
