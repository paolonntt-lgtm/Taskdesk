import { describe, expect, it } from "vitest";
import { hasReplySubjectPrefix, normaliseEmailSubject } from "./emailSubject";

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
});
