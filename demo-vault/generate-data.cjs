// Generator script for demo vault data.json
// Run with: node generate-data.js
const fs = require("fs");

const t = (id, status, aof, project, starred, due, start, completed, energy, context, sort, file, line, recRule, recType, cachedText) => ({
  id, status, area_of_focus: aof, project: project || null,
  starred: !!starred, due_date: due || null, start_date: start || null,
  completed_date: completed || null, energy: energy || null, context: context || null,
  sort_order: sort, source_file: file, source_line: line,
  created: "2026-02-01T00:00:00.000Z", modified: "2026-03-01T00:00:00.000Z",
  recurrence_rule: recRule || null, recurrence_type: recType || null,
  recurrence_template_id: null, parent_task_id: null,
  recurrence_suspended: false, recurrence_spawn_count: 0,
  cached_text: cachedText
});

const dn = "Daily Notes/2026-03-02.md";
const sm = "Someday.md";
const rc = "Recurring.md";

const tasks = [
  // ── INBOX ──────────────────────────────────────────────────────────────────
  t("in1l1q","inbox","Family",null,0,null,null,null,null,null,0,dn,5,null,null,"Ask Dr. Chen about Emma's anxiety medication dosage"),
  t("in2l2r","inbox","Family",null,0,null,null,null,null,null,1,dn,6,null,null,"Look into summer coding camp for Jake"),
  t("in3l3s","inbox","Work",null,0,null,null,null,null,null,2,dn,7,null,null,"Expense report from February needs submitting"),
  t("in4l4t","inbox","Family",null,0,null,null,null,null,null,3,dn,8,null,null,"Call Mom back about Easter plans"),
  t("in5l5u","inbox","Travel",null,0,null,null,null,null,null,4,dn,9,null,null,"Check if PTO is approved for the Napa trip"),

  // ── NEXT ACTION — Work ─────────────────────────────────────────────────────
  t("qa2r1d","next_action","Work","Q2 Platform Release",1,null,null,null,"high","@computer",0,"Work/Q2 Platform Release.md",7,null,null,"Draft Q2 release roadmap document"),
  t("qa3r2e","next_action","Work","Q2 Platform Release",0,null,null,null,"high","@meeting",1,"Work/Q2 Platform Release.md",8,null,null,"Review open P0 and P1 bugs with engineering team"),
  t("qa4r3f","next_action","Work","Q2 Platform Release",0,null,null,null,"medium","@computer",2,"Work/Q2 Platform Release.md",9,null,null,"Set up staging environment for QA team"),
  t("qa5r4g","next_action","Work","Q2 Platform Release",0,null,null,null,"medium","@meeting",3,"Work/Q2 Platform Release.md",10,null,null,"Coordinate deployment window with DevOps"),

  t("ob1r9l","next_action","Work","Redesign Onboarding Flow",0,null,null,null,"medium","@computer",4,"Work/Onboarding Redesign.md",7,null,null,"Review user research findings from UX team"),
  t("ob2r0m","next_action","Work","Redesign Onboarding Flow",0,null,null,null,"high","@computer",5,"Work/Onboarding Redesign.md",8,null,null,"Set up A/B test framework in staging"),
  t("ob3r1n","next_action","Work","Redesign Onboarding Flow",0,null,null,null,"medium","@computer",6,"Work/Onboarding Redesign.md",9,null,null,"Write copy for steps 1–3 of new onboarding"),
  t("ob4r2o","next_action","Work","Redesign Onboarding Flow",0,null,null,null,"medium","@meeting",7,"Work/Onboarding Redesign.md",10,null,null,"Meet with product designer to review mockups"),

  t("km1t6s","next_action","Work","Migrate to Kubernetes",0,null,null,null,"medium","@computer",8,"Work/Kubernetes Migration.md",7,null,null,"Complete Kubernetes training on Pluralsight"),
  t("km2t7t","next_action","Work","Migrate to Kubernetes",0,null,null,null,"high","@computer",9,"Work/Kubernetes Migration.md",8,null,null,"Document current AWS architecture for migration planning"),
  t("km3t8u","next_action","Work","Migrate to Kubernetes",0,null,null,null,"medium","@meeting",10,"Work/Kubernetes Migration.md",9,null,null,"Meet with DevOps lead to review migration plan"),
  t("km4t9v","next_action","Work","Migrate to Kubernetes",0,null,null,null,"high","@computer",11,"Work/Kubernetes Migration.md",10,null,null,"Set up monitoring with Prometheus and Grafana"),
  t("km5t0w","next_action","Work","Migrate to Kubernetes",0,null,null,null,"high","@computer",12,"Work/Kubernetes Migration.md",11,null,null,"Migrate user-service to K8s cluster (non-prod)"),

  t("an1u3z","next_action","Work","Build Analytics Dashboard",0,null,null,null,"high","@computer",13,"Work/Analytics Dashboard.md",7,null,null,"Write API spec for metrics endpoints"),
  t("an2u4a","next_action","Work","Build Analytics Dashboard",0,null,null,null,"medium","@computer",14,"Work/Analytics Dashboard.md",8,null,null,"Choose charting library (Chart.js vs Recharts)"),
  t("an3u5b","next_action","Work","Build Analytics Dashboard",0,null,null,null,"medium","@computer",15,"Work/Analytics Dashboard.md",9,null,null,"Create wireframes for dashboard layout"),
  t("an4u6c","next_action","Work","Build Analytics Dashboard",0,null,null,null,"medium","@computer",16,"Work/Analytics Dashboard.md",10,null,null,"Set up test data fixtures for development"),

  t("hr1v9f","next_action","Work","Hire Senior Engineer",0,null,null,null,"medium","@computer",17,"Work/Engineering Hiring.md",7,null,null,"Review 12 resumes in applicant tracker"),
  t("hr2v0g","next_action","Work","Hire Senior Engineer",0,null,null,null,"low","@phone",18,"Work/Engineering Hiring.md",8,null,null,"Schedule phone screens for top 3 candidates"),
  t("hr3v1h","next_action","Work","Hire Senior Engineer",0,null,null,null,"low","@computer",19,"Work/Engineering Hiring.md",9,null,null,"Update job description with new salary band"),

  t("tc1w5l","next_action","Work","Present at Tech Conference",1,null,null,null,"high","@computer",20,"Work/Tech Conference.md",7,null,null,"Write talk outline and submit abstract for review"),
  t("tc2w6m","next_action","Work","Present at Tech Conference",0,null,null,null,"medium","@computer",21,"Work/Tech Conference.md",8,null,null,"Record practice run and watch playback"),
  t("tc3w7n","next_action","Work","Present at Tech Conference",0,null,null,null,"low","@computer",22,"Work/Tech Conference.md",9,null,null,"Book hotel near conference venue"),

  t("so1x1r","next_action","Work","Implement SSO for Enterprise Clients",0,null,null,null,"high","@computer",23,"Work/SSO Implementation.md",7,null,null,"Research SAML 2.0 implementation options"),
  t("so2x2s","next_action","Work","Implement SSO for Enterprise Clients",0,null,null,null,"medium","@meeting",24,"Work/SSO Implementation.md",8,null,null,"Meet with enterprise customer to gather requirements"),
  t("so3x3t","next_action","Work","Implement SSO for Enterprise Clients",0,null,null,null,"high","@computer",25,"Work/SSO Implementation.md",9,null,null,"Design auth flow diagram for team review"),
  t("so4x4u","next_action","Work","Implement SSO for Enterprise Clients",0,null,null,null,"high","@computer",26,"Work/SSO Implementation.md",10,null,null,"Spike: test Okta integration in staging"),

  t("cc1y6w","next_action","Work","Reduce Cloud Infrastructure Costs",0,null,null,null,"medium","@computer",27,"Work/Cloud Costs.md",7,null,null,"Pull and review current AWS cost breakdown by service"),
  t("cc2y7x","next_action","Work","Reduce Cloud Infrastructure Costs",0,null,null,null,"high","@computer",28,"Work/Cloud Costs.md",8,null,null,"Identify top 5 cost drivers and optimization opportunities"),
  t("cc3y8y","next_action","Work","Reduce Cloud Infrastructure Costs",0,null,null,null,"low","@computer",29,"Work/Cloud Costs.md",9,null,null,"Set up AWS Cost Explorer alerts for budget thresholds"),

  t("tm1t1t","next_action","Work",null,0,null,null,null,"low","@computer",30,"Work/Team Notes.md",5,null,null,"Send feedback on Marcus's code review"),
  t("tm2t2u","next_action","Work",null,0,null,null,null,"low","@computer",31,"Work/Team Notes.md",6,null,null,"Update team wiki with new deployment process"),
  t("tm3t3v","next_action","Work",null,0,null,null,null,"low","@computer",32,"Work/Team Notes.md",7,null,null,"Nominate Priya for Q1 excellence award"),
  t("tm4t4w","next_action","Work",null,0,"2026-03-06",null,null,"low","@meeting",33,"Work/Team Notes.md",8,null,null,"Prepare agenda for Friday all-hands"),

  t("rc1r1i","next_action","Work",null,0,null,null,null,"medium","@meeting",34,rc,3,"FREQ=WEEKLY;BYDAY=MO","relative","Weekly team standup agenda prep"),
  t("rc4r4l","next_action","Work",null,0,null,null,null,"medium","@meeting",35,rc,6,"FREQ=MONTHLY","relative","Monthly 1-on-1 with manager"),

  // ── NEXT ACTION — Family ───────────────────────────────────────────────────
  t("em1z1b","next_action","Family","Get Emma Ready for High School",0,null,null,null,"medium","@phone",0,"Family/Emma High School.md",7,null,null,"Register Emma for fall semester at Roosevelt High"),
  t("em2z2c","next_action","Family","Get Emma Ready for High School",0,null,null,null,"medium","@computer",1,"Family/Emma High School.md",8,null,null,"Research honors and AP course options"),
  t("em3z3d","next_action","Family","Get Emma Ready for High School",0,null,null,null,"low","@phone",2,"Family/Emma High School.md",9,null,null,"Schedule orientation tour of the high school"),
  t("em4z4e","next_action","Family","Get Emma Ready for High School",0,null,null,null,"medium",null,3,"Family/Emma High School.md",10,null,null,"Talk to Emma about her concerns about the transition"),

  t("jk1a1h","next_action","Family","Support Jake's Robotics Team",0,null,null,null,"low","@errands",4,"Family/Jake Robotics.md",7,null,null,"Buy Jake new safety glasses for robotics lab"),
  t("jk2a2i","next_action","Family","Support Jake's Robotics Team",0,null,null,null,"low","@home",5,"Family/Jake Robotics.md",8,null,null,"Sign permission slip for regional competition"),
  t("jk3a3j","next_action","Family","Support Jake's Robotics Team",0,null,null,null,"low","@computer",6,"Family/Jake Robotics.md",9,null,null,"Order team t-shirt for Jake (size M)"),
  t("jk4a4k","next_action","Family","Support Jake's Robotics Team",0,null,null,null,"low","@phone",7,"Family/Jake Robotics.md",10,null,null,"Find carpool arrangement for Saturday practices"),

  t("ly1b1o","next_action","Family","Prepare Lily for Kindergarten",0,"2026-03-10",null,null,"medium","@computer",8,"Family/Lily Kindergarten.md",7,null,null,"Submit kindergarten enrollment forms"),
  t("ly2b2p","next_action","Family","Prepare Lily for Kindergarten",0,null,null,null,"low","@phone",9,"Family/Lily Kindergarten.md",8,null,null,"Schedule kindergarten readiness assessment with school"),
  t("ly3b3q","next_action","Family","Prepare Lily for Kindergarten",0,null,null,null,"low","@errands",10,"Family/Lily Kindergarten.md",9,null,null,"Buy Lily the school backpack she picked out"),
  t("ly4b4r","next_action","Family","Prepare Lily for Kindergarten",0,null,null,null,"low","@home",11,"Family/Lily Kindergarten.md",10,null,null,"Start reading together for 20 min each night"),

  t("eb1c1u","next_action","Family","Organize Family Emergency Binder",0,null,null,null,"medium","@computer",12,"Family/Emergency Binder.md",7,null,null,"Scan and upload all insurance policy documents"),
  t("eb2c2v","next_action","Family","Organize Family Emergency Binder",0,null,null,null,"medium","@computer",13,"Family/Emergency Binder.md",8,null,null,"Write emergency contact list for each child's school"),
  t("eb3c3w","next_action","Family","Organize Family Emergency Binder",0,null,null,null,"low","@home",14,"Family/Emergency Binder.md",9,null,null,"Locate and photocopy passports and birth certificates"),
  t("eb4c4x","next_action","Family","Organize Family Emergency Binder",0,null,null,null,"high","@computer",15,"Family/Emergency Binder.md",10,null,null,"Create 'If something happens to us' letter for the kids"),

  t("th1d1z","next_action","Family","Plan Family Thanksgiving",0,null,null,null,"low","@phone",16,"Family/Thanksgiving.md",7,null,null,"Confirm guest list with Mike"),
  t("th2d2a","next_action","Family","Plan Family Thanksgiving",0,null,null,null,"medium","@home",17,"Family/Thanksgiving.md",8,null,null,"Plan menu and assign dishes to family members"),

  // ── NEXT ACTION — Finance ──────────────────────────────────────────────────
  t("ri1f1i","next_action","Finance","Max Out Roth IRAs for 2026",1,"2026-03-07",null,null,"medium","@computer",0,"Finance/Roth IRA.md",7,null,null,"Calculate how much more to contribute to max out both IRAs"),
  t("ri2f2j","next_action","Finance","Max Out Roth IRAs for 2026",0,null,null,null,"low","@computer",1,"Finance/Roth IRA.md",8,null,null,"Set up automatic monthly transfers to Roth IRA accounts"),
  t("ri3f3k","next_action","Finance","Max Out Roth IRAs for 2026",0,null,null,null,"low","@computer",2,"Finance/Roth IRA.md",9,null,null,"Confirm beneficiary designations are current"),

  t("rf1g1n","next_action","Finance","Refinance the House",0,null,null,null,"medium","@phone",3,"Finance/House Refinance.md",7,null,null,"Get rate quotes from 3 lenders (bank, credit union, online)"),
  t("rf2g2o","next_action","Finance","Refinance the House",0,null,null,null,"low","@computer",4,"Finance/House Refinance.md",8,null,null,"Pull credit reports for both applicants"),
  t("rf3g3p","next_action","Finance","Refinance the House",0,null,null,null,"low","@home",5,"Finance/House Refinance.md",9,null,null,"Gather last 2 years of tax returns and W2s"),
  t("rf4g4q","next_action","Finance","Refinance the House",0,null,null,null,"low","@phone",6,"Finance/House Refinance.md",10,null,null,"Call current mortgage servicer about refinance options"),

  t("ef1h1s","next_action","Finance","Build 6-Month Emergency Fund",0,null,null,null,"medium","@computer",7,"Finance/Emergency Fund.md",7,null,null,"Calculate 6-month expense target based on current spending"),
  t("ef2h2t","next_action","Finance","Build 6-Month Emergency Fund",0,null,null,null,"low","@computer",8,"Finance/Emergency Fund.md",8,null,null,"Open HYSA at Marcus or Ally"),
  t("ef3h3u","next_action","Finance","Build 6-Month Emergency Fund",0,null,null,null,"low","@computer",9,"Finance/Emergency Fund.md",9,null,null,"Set up automatic $500/month transfer to HYSA"),

  t("rc2r2j","next_action","Finance",null,0,null,null,null,"medium","@meeting",10,rc,4,"FREQ=MONTHLY;BYMONTHDAY=1","fixed","Monthly financial check-in with Mike"),

  // ── NEXT ACTION — Travel ───────────────────────────────────────────────────
  t("np1i1x","next_action","Travel","Girls' Weekend in Napa",1,null,null,null,"low","@phone",0,"Travel/Napa Trip.md",7,null,null,"Confirm dates work for all four of us"),
  t("np2i2y","next_action","Travel","Girls' Weekend in Napa",0,null,null,null,"medium","@computer",1,"Travel/Napa Trip.md",8,null,null,"Research and book Airbnb in Napa for 3 nights"),
  t("np3i3z","next_action","Travel","Girls' Weekend in Napa",0,null,null,null,"low","@computer",2,"Travel/Napa Trip.md",9,null,null,"Create shared planning doc and add to group chat"),
  t("np4i4a","next_action","Travel","Girls' Weekend in Napa",0,null,null,null,"medium","@computer",3,"Travel/Napa Trip.md",10,null,null,"Book winery tours (Opus One + one other)"),
  t("np5i5b","next_action","Travel","Girls' Weekend in Napa",0,null,null,null,"medium","@computer",4,"Travel/Napa Trip.md",11,null,null,"Make dinner reservation at The French Laundry"),

  t("cb1j1e","next_action","Travel","Plan Cabo Trip with Mike's Family",0,null,null,null,"low","@home",5,"Travel/Cabo Trip.md",7,null,null,"Check passport expiration for all 5 family members"),
  t("cb2j2f","next_action","Travel","Plan Cabo Trip with Mike's Family",0,null,null,null,"medium","@computer",6,"Travel/Cabo Trip.md",8,null,null,"Research all-inclusive resorts in Cabo for 2 families"),
  t("cb3j3g","next_action","Travel","Plan Cabo Trip with Mike's Family",0,null,null,null,"low","@phone",7,"Travel/Cabo Trip.md",9,null,null,"Coordinate trip dates with the Johnsons"),

  t("sp1k1k","next_action","Travel","Organize Neighborhood Summer Party",0,null,null,null,"low","@phone",8,"Travel/Summer Party.md",7,null,null,"Reach out to block association about getting a permit"),
  t("sp2k2l","next_action","Travel","Organize Neighborhood Summer Party",0,null,null,null,"low","@computer",9,"Travel/Summer Party.md",8,null,null,"Create evite and draft guest list"),
  t("sp3k3m","next_action","Travel","Organize Neighborhood Summer Party",0,null,null,null,"medium",null,10,"Travel/Summer Party.md",9,null,null,"Plan food setup (potluck vs caterer)"),

  // ── NEXT ACTION — Personal ─────────────────────────────────────────────────
  t("hw1s1m","next_action","Personal",null,0,null,null,null,"low","@phone",0,"Personal/Health & Wellness.md",5,null,null,"Book annual physical with Dr. Chen"),
  t("hw2s2n","next_action","Personal",null,0,null,null,null,"low","@errands",1,"Personal/Health & Wellness.md",6,null,null,"Refill prescription for vitamin D"),
  t("hw3s3o","next_action","Personal",null,0,null,null,null,"low","@computer",2,"Personal/Health & Wellness.md",7,null,null,"Research meal prep service for weeknight dinners"),
  t("hw4s4p","next_action","Personal",null,0,null,null,null,"low","@computer",3,"Personal/Health & Wellness.md",8,null,null,"Sign up for yoga class at the Y"),

  t("rc3r3k","next_action","Personal",null,1,null,null,null,"medium",null,4,rc,5,"FREQ=WEEKLY;BYDAY=FR","relative","Weekly GTD review"),

  // ── SCHEDULED ─────────────────────────────────────────────────────────────
  t("qa6r5h","scheduled","Work","Q2 Platform Release",0,null,"2026-03-15",null,"high","@computer",0,"Work/Q2 Platform Release.md",14,null,null,"Write release notes for v2.4"),
  t("qa7r6i","scheduled","Work","Q2 Platform Release",0,"2026-04-30",null,null,"high","@computer",1,"Work/Q2 Platform Release.md",15,null,null,"Run final smoke test on production"),
  t("ob5r3p","scheduled","Work","Redesign Onboarding Flow",0,null,"2026-03-20",null,"medium","@meeting",2,"Work/Onboarding Redesign.md",14,null,null,"Present onboarding redesign to leadership"),
  t("km6t1x","scheduled","Work","Migrate to Kubernetes",0,null,"2026-04-01",null,"high","@computer",3,"Work/Kubernetes Migration.md",15,null,null,"Production cutover for first two services"),
  t("hr4v2i","scheduled","Work","Hire Senior Engineer",0,null,"2026-03-12",null,"medium","@meeting",4,"Work/Engineering Hiring.md",13,null,null,"On-site interview loop for finalist candidate"),
  t("tc4w8o","scheduled","Work","Present at Tech Conference",0,null,"2026-04-15",null,"medium","@meeting",5,"Work/Tech Conference.md",13,null,null,"Dry run presentation with engineering team"),
  t("tc5w9p","scheduled","Work","Present at Tech Conference",0,"2026-05-10",null,null,"high",null,6,"Work/Tech Conference.md",14,null,null,"Deliver talk at SyntaxConf"),

  t("em5z5f","scheduled","Family","Get Emma Ready for High School",0,"2026-03-18",null,null,"medium",null,7,"Family/Emma High School.md",14,null,null,"Attend high school parent information night"),
  t("jk5a5l","scheduled","Family","Support Jake's Robotics Team",0,null,"2026-03-22",null,"medium",null,8,"Family/Jake Robotics.md",14,null,null,"Regional competition — travel day"),
  t("ly5b5s","scheduled","Family","Prepare Lily for Kindergarten",0,null,"2026-04-10",null,"medium",null,9,"Family/Lily Kindergarten.md",14,null,null,"Kindergarten orientation day"),
  t("th3d3b","scheduled","Family","Plan Family Thanksgiving",0,null,"2026-10-15",null,"low","@phone",10,"Family/Thanksgiving.md",12,null,null,"Order heritage turkey from local farm"),
  t("th4d4c","scheduled","Family","Plan Family Thanksgiving",0,"2026-11-25",null,null,"low","@errands",11,"Family/Thanksgiving.md",13,null,null,"Pick up groceries and wine"),

  t("ri4f4l","scheduled","Finance","Max Out Roth IRAs for 2026",0,"2026-04-15",null,null,"medium","@computer",12,"Finance/Roth IRA.md",13,null,null,"Final Roth IRA contribution for 2026"),

  t("np6i6c","scheduled","Travel","Girls' Weekend in Napa",0,null,"2026-06-12",null,"high",null,13,"Travel/Napa Trip.md",15,null,null,"Fly to SF / drive to Napa"),
  t("cb4j4h","scheduled","Travel","Plan Cabo Trip with Mike's Family",0,null,"2026-03-15",null,"medium","@computer",14,"Travel/Cabo Trip.md",13,null,null,"Book flights (6 months out for best rates)"),
  t("sp4k4n","scheduled","Travel","Organize Neighborhood Summer Party",0,null,"2026-05-15",null,"low","@computer",15,"Travel/Summer Party.md",13,null,null,"Send evite to all neighbors"),
  t("sp5k5o","scheduled","Travel","Organize Neighborhood Summer Party",0,"2026-07-04",null,null,"high",null,16,"Travel/Summer Party.md",14,null,null,"Party day!"),

  t("hw5s5q","scheduled","Personal",null,0,null,"2026-04-01",null,"medium",null,17,"Personal/Health & Wellness.md",12,null,null,"Annual skin cancer screening"),

  // ── SOMEDAY ────────────────────────────────────────────────────────────────
  t("an5u7d","someday","Work","Build Analytics Dashboard",0,null,null,null,null,null,0,"Work/Analytics Dashboard.md",14,null,null,"Explore AI-powered insights feature"),
  t("tc6w0q","someday","Work","Present at Tech Conference",0,null,null,null,null,null,1,"Work/Tech Conference.md",18,null,null,"Write blog post version of the talk"),
  t("cc4y9z","someday","Work","Reduce Cloud Infrastructure Costs",0,null,null,null,null,null,2,"Work/Cloud Costs.md",13,null,null,"Evaluate moving to reserved instances for baseline workloads"),
  t("cc5y0a","someday","Work","Reduce Cloud Infrastructure Costs",0,null,null,null,null,null,3,"Work/Cloud Costs.md",14,null,null,"Research Spot instances for batch processing jobs"),
  t("sm1n1y","someday","Work",null,0,null,null,null,null,null,4,sm,5,null,null,"Pursue engineering manager track"),
  t("sm2n2z","someday","Work",null,0,null,null,null,null,null,5,sm,6,null,null,"Write a technical blog for the team"),

  t("eb5c5y","someday","Family","Organize Family Emergency Binder",0,null,null,null,null,null,6,"Family/Emergency Binder.md",14,null,null,"Update will and beneficiaries on all accounts"),
  t("th5d5d","someday","Family","Plan Family Thanksgiving",0,null,null,null,null,null,7,"Family/Thanksgiving.md",17,null,null,"Start a Thanksgiving family tradition book"),
  t("mv1e1e","someday","Family","Research New Family Minivan",0,null,null,null,null,null,8,"Family/Minivan Research.md",7,null,null,"Research Toyota Sienna vs Honda Odyssey vs Chrysler Pacifica"),
  t("mv2e2f","someday","Family","Research New Family Minivan",0,null,null,null,null,null,9,"Family/Minivan Research.md",8,null,null,"Get insurance quotes for shortlisted models"),
  t("mv3e3g","someday","Family","Research New Family Minivan",0,null,null,null,null,null,10,"Family/Minivan Research.md",9,null,null,"Schedule test drives at two dealerships"),
  t("mv4e4h","someday","Family","Research New Family Minivan",0,null,null,null,null,null,11,"Family/Minivan Research.md",13,null,null,"Look into hybrid options for next vehicle cycle"),
  t("sm6p1d","someday","Family",null,0,null,null,null,null,null,12,sm,16,null,null,"Plan a camping trip with just the kids"),
  t("sm7p2e","someday","Family",null,0,null,null,null,null,null,13,sm,17,null,null,"Set up a family chore chart system"),
  t("sm8p3f","someday","Family",null,0,null,null,null,null,null,14,sm,18,null,null,"Start a weekly family game night tradition"),

  t("rf5g5r","someday","Finance","Refinance the House",0,null,null,null,null,null,15,"Finance/House Refinance.md",14,null,null,"Research cash-out refinance for planned home renovation"),

  t("cb5j5i","someday","Travel","Plan Cabo Trip with Mike's Family",0,null,null,null,null,null,16,"Travel/Cabo Trip.md",17,null,null,"Look into Mexico travel insurance options"),
  t("cb6j6j","someday","Travel","Plan Cabo Trip with Mike's Family",0,null,null,null,null,null,17,"Travel/Cabo Trip.md",18,null,null,"Research Cabo restaurants for non-resort meals"),
  t("sp6k6p","someday","Travel","Organize Neighborhood Summer Party",0,null,null,null,null,null,18,"Travel/Summer Party.md",18,null,null,"Get a bouncy castle quote for the kids"),
  t("sm9q1g","someday","Travel",null,0,null,null,null,null,null,19,sm,22,null,null,"Plan a solo trip to Italy someday"),
  t("sm0q2h","someday","Travel",null,0,null,null,null,null,null,20,sm,23,null,null,"Visit Yellowstone National Park with the family"),

  t("sm3o1a","someday","Personal",null,0,null,null,null,null,null,21,sm,10,null,null,"Get back into running — maybe train for a half marathon"),
  t("sm4o2b","someday","Personal",null,0,null,null,null,null,null,22,sm,11,null,null,"Take a watercolor painting class"),
  t("sm5o3c","someday","Personal",null,0,null,null,null,null,null,23,sm,12,null,null,"Read 12 books this year"),

  // ── COMPLETED ─────────────────────────────────────────────────────────────
  t("qa8r7j","completed","Work","Q2 Platform Release",0,null,null,"2026-02-20",null,null,0,"Work/Q2 Platform Release.md",19,null,null,"Define feature freeze date"),
  t("qa9r8k","completed","Work","Q2 Platform Release",0,null,null,"2026-02-15",null,null,1,"Work/Q2 Platform Release.md",20,null,null,"Create GitHub milestone for v2.4"),
  t("ob6r4q","completed","Work","Redesign Onboarding Flow",0,null,null,"2026-02-10",null,null,2,"Work/Onboarding Redesign.md",18,null,null,"Audit current onboarding drop-off rates"),
  t("ob7r5r","completed","Work","Redesign Onboarding Flow",0,null,null,"2026-02-14",null,null,3,"Work/Onboarding Redesign.md",19,null,null,"Gather competitor benchmarks"),
  t("km7t2y","completed","Work","Migrate to Kubernetes",0,null,null,"2026-02-05",null,null,4,"Work/Kubernetes Migration.md",19,null,null,"Get DevOps team buy-in on K8s approach"),
  t("an6u8e","completed","Work","Build Analytics Dashboard",0,null,null,"2026-02-20",null,null,5,"Work/Analytics Dashboard.md",18,null,null,"Define MVP scope with product manager"),
  t("hr5v3j","completed","Work","Hire Senior Engineer",0,null,null,"2026-01-28",null,null,6,"Work/Engineering Hiring.md",17,null,null,"Post job listing on LinkedIn and Hacker News"),
  t("hr6v4k","completed","Work","Hire Senior Engineer",0,null,null,"2026-02-03",null,null,7,"Work/Engineering Hiring.md",18,null,null,"Define interview rubric with team"),
  t("so5x5v","completed","Work","Implement SSO for Enterprise Clients",0,null,null,"2026-02-10",null,null,8,"Work/SSO Implementation.md",14,null,null,"Confirm SSO is on Q2 roadmap with product"),

  t("em6z6g","completed","Family","Get Emma Ready for High School",0,null,null,"2026-02-15",null,null,9,"Family/Emma High School.md",18,null,null,"Tour Roosevelt High campus with Emma"),
  t("jk6a6m","completed","Family","Support Jake's Robotics Team",0,null,null,"2026-01-31",null,null,10,"Family/Jake Robotics.md",18,null,null,"Pay robotics team registration fee"),
  t("jk7a7n","completed","Family","Support Jake's Robotics Team",0,null,null,"2026-02-01",null,null,11,"Family/Jake Robotics.md",19,null,null,"Set up calendar reminders for practice schedule"),
  t("ly6b6t","completed","Family","Prepare Lily for Kindergarten",0,null,null,"2026-02-08",null,null,12,"Family/Lily Kindergarten.md",18,null,null,"Visit the school with Lily for a preview"),

  t("ri5f5m","completed","Finance","Max Out Roth IRAs for 2026",0,null,null,"2026-01-15",null,null,13,"Finance/Roth IRA.md",17,null,null,"Open Roth IRA accounts for both spouses"),
  t("ef4h4v","completed","Finance","Build 6-Month Emergency Fund",0,null,null,"2026-02-20",null,null,14,"Finance/Emergency Fund.md",13,null,null,"Decide on HYSA vs money market account"),
  t("ef5h5w","completed","Finance","Build 6-Month Emergency Fund",0,null,null,"2026-02-25",null,null,15,"Finance/Emergency Fund.md",14,null,null,"Review current monthly expenses for target calculation"),

  t("np7i7d","completed","Travel","Girls' Weekend in Napa",0,null,null,"2026-02-20",null,null,16,"Travel/Napa Trip.md",19,null,null,"Propose Napa trip in group chat"),

  t("hw6s6r","completed","Personal",null,0,null,null,"2026-02-01",null,null,17,"Personal/Health & Wellness.md",16,null,null,"Renew gym membership"),
  t("hw7s7s","completed","Personal",null,0,null,null,"2026-01-20",null,null,18,"Personal/Health & Wellness.md",17,null,null,"Complete health insurance open enrollment"),

  t("dn1m1v","completed","Family",null,0,null,null,"2026-03-02",null,null,19,dn,13,null,null,"Drop Emma at school"),
  t("dn2m2w","completed","Work",null,0,null,null,"2026-03-02",null,null,20,dn,14,null,null,"Respond to Slack messages from overnight team"),
  t("dn3m3x","completed","Personal",null,0,null,null,"2026-03-02",null,null,21,dn,15,null,null,"Morning workout"),
];

const tasksMap = {};
for (const task of tasks) tasksMap[task.id] = task;

const data = {
  dataVersion: 1,
  tasks: tasksMap,
  settings: {
    projectFolder: "MLW/Projects",
    captureLocation: "daily_note",
    inboxFile: "MLW/Inbox.md",
    areasOfFocus: [
      { name: "Work",     sort_order: 0, color: { bg: "rgba(86, 155, 214, 0.15)",  text: "#569BD6",  border: "rgba(86, 155, 214, 0.3)"  } },
      { name: "Family",   sort_order: 1, color: { bg: "rgba(181, 137, 214, 0.15)", text: "#B589D6",  border: "rgba(181, 137, 214, 0.3)" } },
      { name: "Finance",  sort_order: 2, color: { bg: "rgba(235, 160, 72, 0.15)",  text: "#EBA048",  border: "rgba(235, 160, 72, 0.3)"  } },
      { name: "Travel",   sort_order: 3, color: { bg: "rgba(78, 184, 184, 0.15)",  text: "#4EB8B8",  border: "rgba(78, 184, 184, 0.3)"  } },
      { name: "Personal", sort_order: 4, color: { bg: "rgba(78, 185, 129, 0.15)",  text: "#4EB981",  border: "rgba(78, 185, 129, 0.3)"  } },
    ],
    contexts: ["@computer", "@phone", "@errands", "@home", "@meeting"],
    dateFormat: "YYYY-MM-DD",
    autoTransitionScheduled: true,
    reviewReminderDays: 7,
    orphanGracePeriodDays: 7,
    completedVisibilityDays: 30,
    dataStoreBackup: true,
    lastReviewDate: "2026-02-22",
    chipDisplayMode: "full",
    chipCycleModifier: "ctrl",
    recurrenceGloballyPaused: false,
    recurrencePausedAt: null,
  }
};

const out = JSON.stringify(data, null, 2);
fs.writeFileSync("data.json", out, "utf8");
console.log(`Written data.json — ${tasks.length} tasks, ${out.length} bytes`);
