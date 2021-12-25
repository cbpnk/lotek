import {AutoCompleteInput} from "/static/autocomplete.js";

function get_datestring(date) {
    return (date || new Date()).toISOString().slice(0, -1);
}

function is_blocked(card, cards) {
    for (let id of (card.card.blocker_r || [])) {
        if (id in cards) {
            return true;
        }
    }

    return false;
}

const CardForm = {
    view(vnode) {
        const span = {
            xs: 12,
            sm: 12,
            md: 6
        };

        const schedule_d = vnode.attrs.file.card?.schedule_d;
        const start_d = vnode.attrs.file.card?.start_d;
        const end_d = vnode.attrs.file.card?.end_d;

        function schedule() {
            const date = get_datestring();
            vnode.attrs.patch(
                [{op: "add", path: "/schedule_d", value: date}],
                {'Subject': `set schedule date ${date}Z`}
            );
        }

        function start() {
            const date = get_datestring();
            vnode.attrs.patch(
                [{op: "add", path: "/start_d", value: date}],
                {'Subject': `set start date ${date}Z`}
            );
        }

        function end() {
            const date = get_datestring();
            vnode.attrs.patch(
                [{op: "add", path: "/end_d", value: date}],
                {'Subject': `set end date ${date}Z`}
            );
        }

        return [
            m(CUI.FormGroup, { span },
              m(CUI.FormLabel,
                "Schedule Date"),
              (end_d || start_d)?"N/A":
              schedule_d?new Date(schedule_d + "Z").toISOString():
              m(CUI.Button,
                {label: "Schedule",
                 onclick: schedule
                })
             ),
            m(CUI.FormGroup, { span },
              m(CUI.FormLabel,
                "Start Date"),
              (end_d)?"N/A":
              start_d?new Date(start_d + "Z").toISOString():
              m(CUI.Button,
                {label: "Start",
                 onclick: start
                })
             ),
            m(CUI.FormGroup, { span },
              m(CUI.FormLabel,
                "End Date"),
              end_d?new Date(end_d + "Z").toISOString():
              m(CUI.Button,
                {label: "End",
                 onclick: end
                })
             ),
            m(CUI.FormGroup, { span },
              m(CUI.FormLabel,
                "Milestone"),
              m(AutoCompleteInput,
                {ids: vnode.attrs.file.card?.milestone_r,
                 query: "category_s:milestone AND NOT milestone.end_d:>=1900-01-01",
                 attribute: "milestone_r",
                 patch: vnode.attrs.patch,
                 placeholder: "Add milestone ...",
                }
               )
             ),
            m(CUI.FormGroup, { span },
              m(CUI.FormLabel,
                "Blocker"),
              m(AutoCompleteInput,
                {ids: vnode.attrs.file.card?.blocker_r,
                 query: `category_s:card AND NOT card.end_d:>=1900-01-01 AND NOT id:${vnode.attrs.id}`,
                 attribute: "blocker_r",
                 patch: vnode.attrs.patch,
                 placeholder: "Add blocker ...",
                }
               )
             )
        ];
    }
};

const MilestoneForm = {
    view(vnode) {
        const span = {
            xs: 12,
            sm: 12,
            md: 6
        };

        const schedule_d = vnode.attrs.file.milestone?.schedule_d;
        const start_d = vnode.attrs.file.milestone?.start_d;
        const end_d = vnode.attrs.file.milestone?.end_d;

        function schedule() {
            const date = get_datestring();
            vnode.attrs.patch(
                [{op: "add", path: "/schedule_d", value: date}],
                {'Subject': `set schedule date ${date}Z`}
            );
        }

        function start() {
            const date = get_datestring();
            vnode.attrs.patch(
                [{op: "add", path: "/start_d", value: date}],
                {'Subject': `set start date ${date}Z`}
            );
        }

        function end() {
            const date = get_datestring();
            vnode.attrs.patch(
                [{op: "add", path: "/end_d", value: date}],
                {'Subject': `set end date ${date}Z`}
            );
        }

        return [
            m(CUI.FormGroup, { span },
              m(CUI.FormLabel,
                "Schedule Date"),
              (end_d || start_d)?"N/A":
              schedule_d?new Date(schedule_d + "Z").toISOString():
              m(CUI.Button,
                {label: "Schedule",
                 onclick: schedule
                })
             ),
            m(CUI.FormGroup, { span },
              m(CUI.FormLabel,
                "Start Date"),
              (end_d)?"N/A":
              start_d?new Date(start_d + "Z").toISOString():
              m(CUI.Button,
                {label: "Start",
                 onclick: start
                })
             ),
            m(CUI.FormGroup, { span },
              m(CUI.FormLabel,
                "End Date"),
              end_d?new Date(end_d + "Z").toISOString():
              m(CUI.Button,
                {label: "End",
                 onclick: end
                })
             ),
            m(CUI.FormGroup, { span },
              m(CUI.FormLabel,
                "Project"),
              m(AutoCompleteInput,
                {ids: vnode.attrs.file.card?.project_r,
                 query: "category_s:project AND NOT project.end_d:>=1900-01-01",
                 attribute: "project_r",
                 patch: vnode.attrs.patch,
                 placeholder: "Add project ...",
                }
               )
             )
        ];
    }
};

const ProjectForm = {
    view(vnode) {

    }
};

const Calendar = {
    oninit(vnode) {
        document.title = 'Calendar';
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const start = new Date(today.valueOf() - 86400000 * today.getDay());
        const end = new Date(start.valueOf() + 86400000 * 7);
        vnode.state.start = start;
        vnode.state.end = end;
        vnode.state.cards = [];

        request(
            {method: "POST",
             url: "/search/",
             body: {q: `category_s:card AND card.start_d:[TO ${get_datestring(end)}] AND (card.end_d:[${get_datestring(start)} TO] OR NOT card.end_d:[1900-01-01 TO])`}
            }
        ).then(
            function(result) {
                vnode.state.cards = result;
            }
        );
    },

    view(vnode) {
        const start = vnode.state.start;
        const end = vnode.state.end;
        const rows = vnode.state.cards.length;

        return m("div.container",
                 {style: "overflow-y: auto;"},
                 m('div',
                   {style: "width: 100%; display: grid; grid-template-columns: repeat(7, 1fr);"},

                   ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                        (day, i) =>
                       m("div",
                         {style: `text-align: center; grid-area: 1/${i+1}/2/${i+2}; z-index:1;`},
                         day)
                   ),


                   Array.from({length: 7}).map(
                       function(_, i) {
                           const date = new Date(start.valueOf() + 86400000 * i);
                           return m("div",
                                    {style: `grid-area: 2/${i+1}/3/${i+2}; padding: 0.25em 0.5em; text-align: right; z-index:1;`},
                                    date.getDate()
                                   );
                       }
                   ),

                   vnode.state.cards.map(
                       function(card, i) {
                           const row = i + 3;
                           const start_d = new Date(card.card.start_d + "Z");
                           const start_date = new Date(start_d.getFullYear(), start_d.getMonth(), start_d.getDate());

                           const end_d = (card.card.end_d)?new Date(card.card.end_d + "Z"):null;
                           const end_date = (end_d)?new Date(end_d.getFullYear(), end_d.getMonth(), end_d.getDate()):null;
                           const start_column = 1 + ((start_date <= start)?0:((start_date.valueOf() - start.valueOf()) / 86400000));
                           const end_column = 2 + ((end_date && end_date < end)?((end_date.valueOf() - start.valueOf())/86400000):6);

                           const background = (end_d)?"#4caf50":"#5c6bc0";
                           const margin_left = (start_date < start)?"0":"1em";
                           const margin_right = (end_date && end_date < end)?"1em":"0";
                           const radius_left = (start_date < start)?"0":"0.5em";
                           const radius_right = (end_date && end_date < end)?"0.5em":"0";

                           return m("div",
                                    {style: `
grid-area: ${row}/${start_column}/${row+1}/${end_column};
background: ${background};
border-radius: ${radius_left} ${radius_right} ${radius_right} ${radius_left};
margin: 0.5em ${margin_right} 0.5em ${margin_left};
z-index: 2;
color: white;
padding: 0.5em 1em;`},
                                    m(m.route.Link,
                                      {style: "text-decoration: none; color: white;",
                                       href: m.buildPathname("/:id", {id: card.id})},
                                      card.name || card.id)
                                   );
                       }
                   ),


                   Array.from({length: 7}).map(
                       function(_, i) {
                           const background = (i%2==0)?"#ffffff":"#eeeeee";
                           return m("div",
                                    {style: `grid-area: 1/${i+1}/${rows+3}/${i+2}; background: ${background};`},
                                   );
                       }
                   )
                  )
                );
    }
};

const Panel = {
    view(vnode) {
        const name = vnode.attrs.name;
        const cards = vnode.attrs.cards;
        const style = vnode.attrs.style || "";
        return m("div",
                 {style: `${style}padding: 0.5em; background: #eee; border-radius: 0.25em;`},
                 m("div", name),
                 cards.map(
                     (card) =>
                     m("div",
                       {style: "background: #fff; margin: 0.5em; padding: 0.5em 1em; border-left: 0.25em solid #888;"},
                       m(m.route.Link,
                         {style: "text-decoration: none;",
                          href: m.buildPathname("/:id", {id: card.id})},
                         card.name || card.id)
                      )
                 )
                );
    }
};

const Kanban = {
    oninit(vnode) {
        document.title = 'Kanban';
        request(
            {method: "POST",
             url: "/search/",
             body: {q: `category_s:card AND NOT card.end_d:>=1900-01-01`}}
        ).then(
            function(results) {
                const cards = {
                    by_id: Object.fromEntries(
                        results.map((card) => [card.id, card])
                    ),
                    in_milestones: {},
                    in_backlog: [],
                    in_inbox: [],
                    in_wip: [],
                    in_blocked: []
                };

                for (const card of results) {
                    if (card.card?.start_d) {
                        if (is_blocked(card, cards)) {
                            cards.in_blocked.push(card);
                        } else {
                            cards.in_wip.push(card);
                        }
                    } else if (card.card?.schedule_d) {
                        cards.in_inbox.push(card);
                    } else if (card.card?.milestone_r) {
                        for (const milestone_r of (card.card?.milestone_r || [])) {
                            cards.in_milestones[milestone_r] = cards.in_milestones[milestone_r] || [];
                            cards.in_milestones[milestone_r].push(card);
                        }
                    } else {
                        cards.in_backlog.push(card);
                    }
                }

                vnode.state.cards = cards;
            }
        );

        request(
            {method: "POST",
             url: "/search/",
             body: {q: "category_s:operator"}}
        ).then(
            function(results) {
                vnode.state.operators = Object.fromEntries(results.map((operator) => [operator.id, operator]));
            }
        );

        request(
            {method: "POST",
             url: "/search/",
             body: {q: "category_s:milestone AND milestone.start_d:>=1900-01-01 AND NOT milestone.end_d:>=1900-01-01"}
            }
        ).then(
            function(results) {
                vnode.state.milestones = {
                    list: results,
                    by_id: Object.fromEntries(results.map((milestone) => [milestone.id, milestone]))
                };
            }
        );
    },

    view(vnode) {
        const milestones = vnode.state.milestones;
        const operators = vnode.state.operators;
        const cards = vnode.state.cards;
        if (!cards || !milestones || !operators) {
            return m(CUI.Spinner,
                     {fill: true,
                      size: "xl"});
        }

        return m("div.container.row-flex",
                 m("div.container", {style: "position:relative;"},
                   m("div.container", {style: "position: absolute; overflow-y: auto; padding: 0 0.5em;"},
                     milestones.list.map(
                         (milestone) =>
                         m(Panel,
                           {name: milestone.name,
                            cards: (cards.in_milestones || {})[milestone.id] || [],
                            style: "margin: 0.5em 0;"
                           }))
                    )
                  ),

                 [{name: "BACKLOG", cards: cards.in_backlog},
                  {name: "INBOX", cards: cards.in_inbox},
                  {name: "BLOCKED", cards: cards.in_blocked},
                  {name: "WIP", cards: cards.in_wip}
                 ].map(
                     (panel) =>
                     m("div.container", {style: "position:relative;"},
                       m("div.container", {style: "position: absolute; overflow-y: auto; padding: 0.5em;"},
                         m(Panel,
                           {style: "min-height: 100%;",
                            name: panel.name,
                            cards: panel.cards})
                        )
                      )
                 )
                );
    }
};


function is_milestone_available(file, allow) {
    return (file.category_s || []).includes("milestone");
}

const Milestone = {
    oninit(vnode) {
        request(
            {method: "POST",
             url: "/search/",
             body: {q: `category_s:card AND card.milestone_r:${vnode.attrs.id}`}}
        ).then(
            function(result) {
                const cards = {
                    in_backlog: [],
                    in_inbox: [],
                    in_wip: [],
                    in_done: [],
                };

                for (let card of result) {
                    if (card.card__end_d) {
                        cards.in_done.push(card);
                    } else if (card.card__start_d) {
                        cards.in_wip.push(card);
                    } else if (card.card__schedule_d) {
                        cards.in_inbox.push(card);
                    } else {
                        cards.in_backlog.push(card);
                    }
                }

                vnode.state.cards = cards;
            }
        );
    },

    view(vnode) {
        const cards = vnode.state.cards;
        if (!cards) {
            return m(CUI.Spinner,
                     {fill: true,
                      size: "xl"});
        }

        return m("div.container.row-flex",
                 [{name: "BACKLOG", cards: cards.in_backlog},
                  {name: "INBOX", cards: cards.in_inbox},
                  {name: "WIP", cards: cards.in_wip},
                  {name: "DONE", cards: cards.in_done}
                 ].map(
                     (panel) =>
                     m("div.container", {style: "position:relative;"},
                       m("div.container", {style: "position: absolute; overflow-y: auto; padding: 0.5em;"},
                         m(Panel,
                           {style: "min-height: 100%;",
                            name: panel.name,
                            cards: panel.cards})
                        )
                      )
                 )
                );

    }
};

export const modes = [
    {label: "Milestone",
     is_available: is_milestone_available,
     component: Milestone}
];

export const routes = [
    ["/calendar/", (vnode) => m(Calendar)],
    ["/kanban/", (vnode) => m(Kanban)],
];

export const links = [
    {url: "/kanban/", name: "Kanban"},
    {url: "/calendar/", name: "Calendar"},
];


export const searches = [
    {name: "Cards", query: "category_s:card"},
    {name: "Operators", query: "category_s:operator"},
    {name: "Milestones", query: "category_s:milestone"},
    {name: "Projects", query: "category_s:project"},
]


export const categories = {
    card: {
        name: "Card",
        component: CardForm
    },
    milestone: {
        name: "Milestone",
        component: MilestoneForm
    },
    operator: {
        name: "Operator",
    },
    project: {
        name: "Project",
        component: ProjectForm,
    }
}
