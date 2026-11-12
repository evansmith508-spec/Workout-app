import { describe, expect, it } from "vitest";
import { getPhase, getSession, program, sessionForSlot } from "../program/program";
import { addDays, weekStart, weekdayOf } from "./dates";
import { nextSession, slotFor } from "./schedule";

// 2026-11-09 is a Monday.
const MON = "2026-11-09";

describe("dates", () => {
  it("week starts Monday", () => {
    expect(weekdayOf(MON)).toBe("mon");
    expect(weekStart("2026-11-15")).toBe(MON); // Sunday
    expect(weekStart("2026-11-16")).toBe("2026-11-16");
  });
});

describe("slotFor", () => {
  it("8.3 #7: Phase 4 on a Tuesday → p4-LA, first exercise squat jumps (power)", () => {
    const p4 = getPhase("p4");
    const tue = addDays(MON, 1);
    const slot = slotFor(p4, tue);
    expect(slot).toBe("LA");
    if (slot !== "LA") return;
    const s = sessionForSlot(p4, slot);
    expect(s.id).toBe("p4-LA");
    expect(s.exercises[0]?.exerciseId).toBe("squat-jump");
    expect(s.exercises[0]?.category).toBe("power");
  });
  it("weights only: every day is a gym session or rest, with rest on Wed, Sat and Sun", () => {
    for (const ph of program.phases) {
      expect(ph.week.map((d) => d.slot)).toEqual(["UA", "LA", "REST", "UB", "LB", "REST", "REST"]);
      for (const s of Object.values(ph.sessionIds)) {
        const text = JSON.stringify(program.sessions[s]!.exercises);
        expect(text).not.toMatch(/sprint|kicking|"field"/i);
      }
      for (const c of ph.criteria) expect(c.text).not.toMatch(/jog|sprint|tempo|run\b|cutting/i);
    }
    expect(slotFor(getPhase("p1"), addDays(MON, 6))).toBe("REST");
  });
});

describe("nextSession", () => {
  const p1 = getPhase("p1");
  it("8.3 #8: UA and LA done this week, today is Friday → UB", () => {
    const logs = [
      { date: MON, slot: "UA" as const, finished: true },
      { date: addDays(MON, 1), slot: "LA" as const, finished: true },
    ];
    expect(nextSession(p1, logs, addDays(MON, 4))).toBe("UB");
  });
  it("ignores last week's sessions and unfinished ones", () => {
    const logs = [
      { date: addDays(MON, -7), slot: "UA" as const, finished: true },
      { date: MON, slot: "UA" as const, finished: false },
    ];
    expect(nextSession(p1, logs, addDays(MON, 2))).toBe("UA");
  });
  it("null when all four are done", () => {
    const logs = (["UA", "LA", "UB", "LB"] as const).map((slot, i) => ({ date: addDays(MON, i), slot, finished: true }));
    expect(nextSession(p1, logs, addDays(MON, 5))).toBeNull();
  });
  it("sessions exist", () => expect(getSession("p2-LA").slot).toBe("LA"));
});
