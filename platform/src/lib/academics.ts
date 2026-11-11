// Words for classes, used on every screen that shows one.
export const TRACK_LABEL = { WEEKDAY: "Weekday afternoons", SATURDAY: "Saturdays" } as const;
export const MODE_LABEL = { ONLINE: "Online", BLENDED: "Blended", ON_CAMPUS: "On campus" } as const;
export const ENROLMENT_LABEL = { ACTIVE: "Enrolled", WITHDRAWN: "Withdrawn", DEFERRED: "Deferred", COMPLETED: "Completed" } as const;
export const INTAKE_LABEL = { PLANNED: "Planned", OPEN: "Open for applications", CLOSED: "Closed" } as const;

type ClassParts = { course: { title: string }; intake: { name: string }; track: keyof typeof TRACK_LABEL };

// "QuickBooks · March 2027 · Saturdays"
export const classLabel = (c: ClassParts) => `${c.course.title} · ${c.intake.name} · ${TRACK_LABEL[c.track]}`;

// Student numbers look like TIME-2027-0001.
export const studentNumber = (year: number, n: number) => `TIME-${year}-${String(n).padStart(4, "0")}`;
