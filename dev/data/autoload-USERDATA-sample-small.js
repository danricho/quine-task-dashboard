USERDATA = {
  config: { 
    title: "Project - Small Example Dataset",
    logo: `<svg width="2rem" height="2rem" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="10" ry="10" fill="currentColor" opacity="0.12"></rect></svg>`,
    primary_color: '#6e5400',
    last_saved: "2026-01-25 09:11",
    force_timeline_start: null,
    force_timeline_end: null,
    soon_duration: 7, // in days to go
  },
  resources: [
    {
      "name": "Avery",
      "type": "Systems Engineering Lead"
    },
    {
      "name": "Blake",
      "type": "Software Team Lead"
    },
    {
      "name": "Morgan",
      "type": "DevOps / CI-CD Engineer"
    },
    {
      "name": "Riley, M",
      "type": "Test / Verification Engineer"
    }
  ],
  milestones: [
    {
      "id": 10,
      "name": "Kickoff / Charter Approved",
      "date": "2026-02-03",
      "link": "https://confluence.example.com/display/DEMO/Milestone_info_page!"
    },
    {
      "id": 20,
      "name": "ConOps + Needs Baselined",
      "date": "2026-02-21",
      "link": null
    },
    {
      "id": 30,
      "name": "System Requirements Review (SRR)",
      "date": "2026-03-14"
    },
    {
      "id": 50,
      "name": "Preliminary Design Review (PDR)",
      "date": "2026-04-18",
      "tentative": true
    },
    {
      "id": 60,
      "name": "Critical Design Review (CDR)",
      "date": "2026-06-06"
    },
    {
      "id": 80,
      "name": "Test Readiness Review (TRR)",
      "date": "2026-08-01"
    },
    {
      "id": 110,
      "name": "Operational Readiness Review (ORR)",
      "date": "2026-09-26"
    },
    {
      "id": 120,
      "name": "Release to Production",
      "date": "2026-10-10",
      "tentative": false
    },
    {
      "id": 999,
      "name": "Ongoing / Evergreen / Perpetual",
      "date": "",
      "tentative": false
    }
  ],
  tasks: [
    {
      "id": 1,
      "text": "Stand up repo + baseline templates",
      "active": true,
      "date": null,
      "milestoneId": 10,
      "assignedTo": "Blake",
      "priority": 1,
      "category": "OPS",
      "linkConf": null,
      "linkJira": null,
      "linkOther": null,
      "completed": false
    },
    {
      "id": 2,
      "text": "Define top-level workstreams + owners",
      "date": null,
      "milestoneId": 10,
      "assignedTo": "Avery",
      "active": true,
      "priority": 3,
      "category": "PMA",
      "linkConf": "https://www.google.com",
      "linkJira": null,
      "linkOther": null,
      "completed": false
    },
    {
      "id": 3,
      "text": "Draft ConOps + key operational scenarios",
      "date": null,
      "milestoneId": 20,
      "assignedTo": "Avery",
      "priority": 4,
      "category": "DOC",
      "linkConf": null,
      "linkJira": "https://www.google.com",
      "linkOther": null,
      "completed": false
    },
    {
      "id": 4,
      "text": "Stakeholder workshop: success criteria + constraints",
      "date": null,
      "milestoneId": 20,
      "assignedTo": "Avery",
      "priority": 5,
      "category": "PMA",
      "linkConf": null,
      "linkJira": null,
      "linkOther": "https://www.google.com",
      "completed": false
    },
    {
      "id": 5,
      "text": "Capture system requirements + acceptance criteria",
      "date": null,
      "milestoneId": 30,
      "assignedTo": "Avery",
      "priority": 6,
      "category": "REQ",
      "linkConf": null,
      "linkJira": "https://www.google.com",
      "linkOther": null,
      "completed": false
    },
    {
      "id": 6,
      "text": "Software requirements: services, telemetry, update",
      "date": null,
      "milestoneId": 30,
      "assignedTo": "Blake",
      "priority": 7,
      "category": "REQ",
      "linkConf": null,
      "linkJira": null,
      "linkOther": null,
      "completed": false
    },
    {
      "id": 7,
      "text": "System architecture: context diagram + interfaces",
      "date": null,
      "milestoneId": 50,
      "assignedTo": "Avery",
      "priority": 15,
      "category": "ARC",
      "linkConf": null,
      "linkJira": null,
      "linkOther": null,
      "completed": false
    },
    {
      "id": 8,
      "text": "SW architecture: service boundaries + error strategy",
      "date": null,
      "milestoneId": 50,
      "assignedTo": "Blake",
      "priority": 8,
      "category": "ARC",
      "linkConf": null,
      "linkJira": null,
      "linkOther": null,
      "completed": false
    },
    {
      "id": 9,
      "text": "CDR package: ICD v1 + design notes",
      "date": null,
      "milestoneId": 60,
      "assignedTo": "Avery",
      "priority": 16,
      "category": "DOC",
      "linkConf": null,
      "linkJira": null,
      "linkOther": null,
      "completed": false
    },
    {
      "id": 10,
      "text": "CI pipeline: build + unit tests + static checks",
      "date": null,
      "milestoneId": 60,
      "assignedTo": "Morgan",
      "active": true,
      "priority": 9,
      "category": "OPS",
      "linkConf": null,
      "linkJira": null,
      "linkOther": null,
      "completed": false
    },
    {
      "id": 11,
      "text": "Verification plan: map reqs → tests → evidence",
      "date": null,
      "milestoneId": 80,
      "assignedTo": "Riley, M",
      "active": true,
      "priority": 17,
      "category": "TST",
      "linkConf": null,
      "linkJira": null,
      "linkOther": null,
      "completed": false
    },
    {
      "id": 12,
      "text": "Dry-run test execution on integration rig",
      "date": null,
      "milestoneId": 80,
      "assignedTo": "Riley, M",
      "priority": 18,
      "category": "TST",
      "linkConf": null,
      "linkJira": null,
      "linkOther": null,
      "completed": false
    },
    {
      "id": 13,
      "text": "ORR checklist: ops readiness + rollback plan",
      "date": null,
      "milestoneId": 110,
      "assignedTo": "Morgan",
      "active": true,
      "priority": 19,
      "category": "OPS",
      "linkConf": null,
      "linkJira": null,
      "linkOther": null,
      "completed": false
    },
    {
      "id": 14,
      "text": "Release notes + support handover",
      "date": null,
      "milestoneId": 120,
      "assignedTo": "Blake",
      "priority": 12,
      "category": "DOC",
      "linkConf": null,
      "linkJira": null,
      "linkOther": null,
      "completed": false
    },
    {
      "id": 15,
      "text": "Schedule PDR rehearsal (admin)",
      "date": "2026-04-10",
      "milestoneId": null,
      "assignedTo": "Avery",
      "priority": 11,
      "category": "PMA",
      "linkConf": null,
      "linkJira": null,
      "linkOther": null,
      "completed": false
    },
    {
      "id": 16,
      "text": "Cut beta build for integration rig (artifact drop)",
      "date": "2026-06-27",
      "milestoneId": null,
      "assignedTo": "Blake",
      "priority": 13,
      "category": "OPS",
      "linkConf": null,
      "linkJira": null,
      "linkOther": null,
      "completed": false
    },
    {
      "id": 17,
      "text": "Decide time-sync approach (PTP vs NTP) + record decision",
      "date": null,
      "milestoneId": 50,
      "assignedTo": null,
      "priority": 10,
      "category": "ARC",
      "linkConf": null,
      "linkJira": null,
      "linkOther": null,
      "completed": false
    },
    {
      "id": 18,
      "text": "Bootstrap coding standards + formatter config",
      "date": null,
      "milestoneId": 10,
      "assignedTo": "Blake",
      "priority": 0,
      "category": "OPS",
      "linkConf": null,
      "linkJira": null,
      "linkOther": null,
      "completed": true
    },
    {
      "id": 19,
      "text": "Weekly status update cadence (admin)",
      "date": null,
      "milestoneId": 999,
      "assignedTo": "Avery",
      "active": true,
      "priority": 2,
      "category": "PMA",
      "linkConf": null,
      "linkJira": null,
      "linkOther": null,
      "completed": false
    },
    {
      "id": 20,
      "text": "Undated Example Task",
      "date": null,
      "milestoneId": null,
      "assignedTo": null,
      "category": "TST",
      "priority": 20,
      "linkConf": null,
      "linkJira": null,
      "linkOther": null,
      "completed": false
    },
    {
      "id": 21,
      "text": "Task with no Category :(",
      "date": "2026-01-23",
      "milestoneId": null,
      "assignedTo": "Avery",
      "active": true,
      "category": null,
      "priority": 21
    }    
  ],
  categories: [
    {
      "code": "PMA",
      "name": "Program / Admin",
      "color": "#64748b"
    },
    {
      "code": "REQ",
      "name": "Requirements",
      "color": "#22c55e"
    },
    {
      "code": "ARC",
      "name": "Architecture & Design",
      "color": "#f43f5e"
    },
    {
      "code": "OPS",
      "name": "DevOps / Tooling",
      "color": "#f97316"
    },
    {
      "code": "TST",
      "name": "Verification & Test",
      "color": "#f59e0b"
    },
    {
      "code": "DOC",
      "name": "Docs & Reviews",
      "color": "#a855f7"
    }
  ]
}
