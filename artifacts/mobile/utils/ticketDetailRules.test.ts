import { describe, expect, it } from "vitest";
import {
  canEditTicketDetails,
  canEditTicketTracking,
  canViewTicketTrackedTime,
} from "./ticketDetailRules";

describe("mobile ticket detail access", () => {
  it("allows admins, creators, and status managers to edit ticket details", () => {
    expect(canEditTicketDetails({
      isAdmin: true, createdBy: 1, currentUserId: 2, canChangeStatus: false,
    })).toBe(true);
    expect(canEditTicketDetails({
      isAdmin: false, createdBy: 2, currentUserId: 2, canChangeStatus: false,
    })).toBe(true);
    expect(canEditTicketDetails({
      isAdmin: false, createdBy: 1, currentUserId: 2, canChangeStatus: true,
    })).toBe(true);
    expect(canEditTicketDetails({
      isAdmin: false, createdBy: 1, currentUserId: 2, canChangeStatus: false,
    })).toBe(false);
  });

  it("does not treat missing user IDs as a creator match", () => {
    expect(canEditTicketDetails({
      isAdmin: false, createdBy: undefined, currentUserId: undefined, canChangeStatus: false,
    })).toBe(false);
    expect(canEditTicketDetails({
      isAdmin: false, createdBy: 1, currentUserId: undefined, canChangeStatus: false,
    })).toBe(false);
  });

  it("allows timer classifications only for admins while TaskTrack is enabled", () => {
    expect(canEditTicketTracking({
      isAdmin: true,
      trackingModuleEnabled: true,
    })).toBe(true);
    expect(canEditTicketTracking({
      isAdmin: false,
      trackingModuleEnabled: true,
    })).toBe(false);
    expect(canEditTicketTracking({
      isAdmin: true,
      trackingModuleEnabled: false,
    })).toBe(false);
  });

  it("never shows tracked-time details when tracking is disabled for the ticket", () => {
    expect(canViewTicketTrackedTime({
      organizationTrackingEnabled: true,
      ticketTrackingEnabled: false,
      canViewSummary: false,
      isAdmin: true,
    })).toBe(false);
    expect(canViewTicketTrackedTime({
      organizationTrackingEnabled: true,
      ticketTrackingEnabled: true,
      canViewSummary: true,
      isAdmin: false,
    })).toBe(true);
  });
});
