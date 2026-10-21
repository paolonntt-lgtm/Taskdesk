import { describe, expect, it } from "vitest";
import {
  hasReplySubjectPrefix,
  normaliseEmailSubject,
  removeForwardSubjectPrefix,
} from "./emailSubject";

describe("email subject threading", () => {
  it.each(["Re: Richiesta", "R: Richiesta", "Ant: Richiesta", "AW: Richiesta"])(
    "recognizes %s as a reply subject",
    (subject) => {
      expect(hasReplySubjectPrefix(subject)).toBe(true);
      expect(normaliseEmailSubject(subject)).toBe("richiesta");
    },
  );

  it.each(["Fwd: Richiesta", "Fw: Richiesta"])(
    "does not treat %s as a reply based on subject alone",
    (subject) => {
      expect(hasReplySubjectPrefix(subject)).toBe(false);
      expect(normaliseEmailSubject(subject)).toBe("richiesta");
    },
  );

  it.each([
    ["Fwd: Richiesta", "Richiesta"],
    ["Fw: Richiesta", "Richiesta"],
    ["FWD: Richiesta urgente", "Richiesta urgente"],
    ["fwd: RiChiEsta", "RiChiEsta"],
    ["FW: Fwd: Richiesta", "Richiesta"],
  ])("removes leading forward markers from %s", (subject, expected) => {
    expect(removeForwardSubjectPrefix(subject)).toBe(expected);
  });

  it.each([
    "Richiesta",
    "Richiesta Fwd: dettagli",
    "Re: Fwd: Richiesta",
  ])("preserves non-leading forward markers in %s", (subject) => {
    expect(removeForwardSubjectPrefix(subject)).toBe(subject);
  });

  it("keeps reply detection and matching normalization unchanged", () => {
    expect(hasReplySubjectPrefix("Re: Fwd: Richiesta")).toBe(true);
    expect(normaliseEmailSubject("Re: Fwd: Richiesta")).toBe("fwd: richiesta");
  });
});
