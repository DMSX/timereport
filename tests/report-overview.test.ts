import { test } from "node:test";
import assert from "node:assert/strict";
import { DateTime } from "luxon";
import { entryMinutesInRange, projectOverview } from "../src/lib/report-overview";
import { monthlyReport, ZONE } from "../src/lib/time";
import type { Entry, Project } from "../src/lib/types";

const entry = (id: string, project: string, start: string, end: string | null): Entry => ({
  id,project_id:project,company_id:"company",user_id:"user",started_at:start,ended_at:end,note:"",
  max_work_minutes:120,min_break_minutes:15,
});
const projects: Project[] = [{id:"p",company_id:"company",name:"Kundenprojekt",active:false,max_work_minutes:null,min_break_minutes:null}];

test("project totals match daily report across month boundaries, DST and running entries",()=>{
  const now=DateTime.fromISO("2026-10-31T12:00:00",{zone:ZONE});
  const entries=[
    entry("boundary","p","2026-09-30T23:30:00+02:00","2026-10-01T00:30:00+02:00"),
    entry("dst","p","2026-10-25T01:30:00+02:00","2026-10-25T03:30:00+01:00"),
    entry("running","q","2026-10-31T11:00:00+01:00",null),
    entry("outside","p","2026-09-01T08:00:00Z","2026-09-01T09:00:00Z"),
  ];
  const rows=projectOverview("2026-10",entries,projects,now);
  assert.equal(rows.length,2);
  assert.equal(rows[0].name,"Kundenprojekt");
  assert.equal(rows[0].minutes,210);
  assert.equal(rows[0].blocks,2);
  assert.equal(rows[1].name,"Archiviertes Projekt");
  assert.equal(rows[1].minutes,60);
  assert.equal(rows[1].running,true);
  assert.equal(rows.reduce((sum,row)=>sum+row.minutes,0),monthlyReport("2026-10",entries,[],[],now).reduce((sum,day)=>sum+day.worked,0));
});

test("overnight block details show only elapsed minutes on the selected Zurich day",()=>{
  const block=entry("overnight","p","2026-10-05T23:30:00+02:00","2026-10-06T01:00:00+02:00");
  const day=DateTime.fromISO("2026-10-06",{zone:ZONE});
  assert.equal(entryMinutesInRange(block,day,day.plus({days:1}),day.plus({days:2})),60);
  assert.equal(entryMinutesInRange(block,day.plus({days:1}),day.plus({days:2}),day.plus({days:2})),0);
});
