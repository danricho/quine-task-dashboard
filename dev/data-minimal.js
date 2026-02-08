const USERDATA = {
  config: { 
    title: "Demo Project",
    logo: `<svg width="2rem" height="2rem" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="10" ry="10" fill="currentColor" opacity="0.12"></rect></svg>`,
    primary_color: '#3c006e',
    last_saved: "2026-02-08 00:00", // date last saved
    render_read_only: false, // this is what is different in the read-only mode
    force_timeline_start: null, // this, when set, will make timelines render to specific start dates
    force_timeline_end: null, // this, when set, will make timelines render to specific end dates
    soon_duration: 7, // in days to go
  },
  resources: [
    {
      "name": "Dan",
      "type": "Engineer"
    }
  ],
  milestones: [
    {
      "id": 1,
      "name": "Kickoff",
      "date": "2026-02-03",
      "link": "https://github.com/danricho/quine-task-dashboard"
    },
  ],
  tasks: [
    {
      "id": 1,
      "text": "Check out the Quine Task Dashboard GitHub Repo!",
      "active": true,
      "date": null,
      "milestoneId": 1,
      "assignedTo": "Dan",
      "priority": 1,
      "category": "ADM",
      "link-conf": null,
      "link-jira": null,
      "link-other": "https://github.com/danricho/quine-task-dashboard",
      "completed": false
    },
    {
      "id": 2,
      "text": "Show others the Quine Task Dashboard GitHub Repo!",
      "active": false,
      "date": null,
      "milestoneId": 1,
      "assignedTo": null,
      "priority": 2,
      "category": "ADM",
      "link-conf": null,
      "link-jira": null,
      "link-other": "https://github.com/danricho/quine-task-dashboard",
      "completed": false
    },
  ],
  categories: [
    {
      "code": "ADM",
      "name": "Admin Tasks",
      "color": "#64748b"
    },
  ]
}
