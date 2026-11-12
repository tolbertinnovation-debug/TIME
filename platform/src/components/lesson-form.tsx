import { saveLessonAction } from "@/app/teaching-actions";

type Values = { id?: string; moduleId?: string; title?: string; kind?: "ONLINE" | "PRACTICAL"; body?: string; minutes?: number | null; resourceUrl?: string | null };

export function LessonForm({ classId, modules, lesson = {} }: { classId: string; modules: { id: string; title: string }[]; lesson?: Values }) {
  return (
    <form className="card form" action={saveLessonAction}>
      <input type="hidden" name="classId" value={classId} />
      {lesson.id && <input type="hidden" name="lessonId" value={lesson.id} />}
      <div className="grid">
        <div className="field">
          <label htmlFor="moduleId">Module</label>
          <select id="moduleId" name="moduleId" required defaultValue={lesson.moduleId ?? modules[0]?.id}>
            {modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="kind">Kind of lesson</label>
          <select id="kind" name="kind" required defaultValue={lesson.kind ?? "ONLINE"}>
            <option value="ONLINE">Online: the student studies it and marks it complete</option>
            <option value="PRACTICAL">Practical: you or a facilitator sign it off</option>
          </select>
        </div>
      </div>
      <div className="field"><label htmlFor="title">Title</label><input id="title" name="title" type="text" required maxLength={140} defaultValue={lesson.title ?? ""} /></div>
      <div className="field">
        <label htmlFor="body">Lesson</label>
        <textarea id="body" name="body" required minLength={20} maxLength={20000} rows={14} defaultValue={lesson.body ?? ""} aria-describedby="body-hint" />
        <span className="hint" id="body-hint">Plain text. Leave a blank line between paragraphs. Keep it short enough to read on a phone.</span>
      </div>
      <div className="grid">
        <div className="field"><label htmlFor="minutes">Minutes to study <span className="muted">(optional)</span></label><input id="minutes" name="minutes" type="text" inputMode="numeric" maxLength={3} defaultValue={lesson.minutes ?? ""} /></div>
        <div className="field"><label htmlFor="resourceUrl">Link to notes or audio <span className="muted">(optional)</span></label><input id="resourceUrl" name="resourceUrl" type="text" inputMode="url" maxLength={500} placeholder="https://" defaultValue={lesson.resourceUrl ?? ""} /></div>
      </div>
      <div><button className="btn" type="submit">Save draft</button></div>
    </form>
  );
}
