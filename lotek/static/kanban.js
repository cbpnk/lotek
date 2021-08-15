import {AutoCompleteInput} from "/static/autocomplete.js";
import {Link, Title} from "/static/view.js";


function is_blocked(card, cards) {
    for (let path of (card.blocker_i || [])) {
        if (path in cards) {
            return true;
        }
    }

    return false;
}

const Milestone = {
    oninit: function(vnode) {
        document.title = vnode.attrs.path;

        m.request(
            {method: "GET",
             url: "/files/:path...",
             params: {path: vnode.attrs.path},
             responseType: "json"}
        ).then(
            function (result) {
                document.title = (result.title_t || [vnode.attrs.path])[0];
            },
            function (error) {
                console.log(error);
            }
        );

        m.request(
            {method: "POST",
             url: "/search/",
             body: {q: `category_i:card AND milestone_i:${vnode.attrs.path}`}}
        ).then(
            function(result) {
                vnode.state.cards_in_backlog = [];
                vnode.state.cards_in_inbox = [];
                vnode.state.cards_in_wip = [];
                vnode.state.cards_in_done = [];

                for (let card of result) {
                    if (card.end_d) {
                        vnode.state.cards_in_done.push(card);
                    } else if (card.start_d) {
                        vnode.state.cards_in_wip.push(card);
                    } else if (card.schedule_d) {
                        vnode.state.cards_in_inbox.push(card);
                    } else {
                        vnode.state.cards_in_backlog.push(card);
                    }
                }

            },
            function(error) {
                console.log(error);
            }
        );
    },

    view: function(vnode) {
        return [
            m("aside.left",
              m(m.route.Link,
                {href: m.buildPathname("/view/:path...", {path: vnode.attrs.path})},
                "Go back")
             ),
            m("div.columns", {"style": "grid-column: 2 / span 2; margin: 1em;"},
              [{name: "BACKLOG", cards: vnode.state.cards_in_backlog},
               {name: "INBOX", cards: vnode.state.cards_in_inbox},
               {name: "WIP", cards: vnode.state.cards_in_wip},
               {name: "DONE", cards: vnode.state.cards_in_done}
              ].map(
                  (panel) =>
                  m("div.panel.column.mx-2",
                    m("div.panel-header",
                      m("div.panel-title", panel.name)
                     ),
                    m("div.panel-body",
                      (!panel.cards)?m("div.loading.loading-lg"):
                      panel.cards.map(
                          (card) =>
                          m("div.card.my-2",
                            m("div.card-header",
                              m(Link, {doc: card})
                             ),
                            m("div.card-body")
                           )
                      )
                     )
                   )
              )
             )
        ];
    }
};

const Kanban = {
    oninit: function(vnode) {
        document.title = 'Kanban';
        m.request(
            {method: "POST",
             url: "/search/",
             body: {q: "category_i:milestone AND start_d:>=20000101 AND NOT end_d:>=20000101"}
            }
        ).then(
            function(result) {
                vnode.state.milestones = result;
                vnode.state.milestones_by_path = Object.fromEntries(
                    result.map((milestone) => [milestone.path, milestone]));
            },
            function(error) {
                console.log(error);
            }
        );

        m.request(
            {method: "POST",
             url: "/search/",
             body: {q: "category_i:operator"}
            }
        ).then(
            function(result) {
                vnode.state.operators = Object.fromEntries(
                    result.map((operator) => [operator.path, operator]));
            },
            function(error) {
                console.log(error);
            }
        );

        m.request(
            {method: "POST",
             url: "/search/",
             body: {q: "category_i:card AND NOT end_d:>=20000101"}}
        ).then(
            function(result) {
                const cards = Object.fromEntries(
                    result.map((card) => [card.path, card])
                );

                vnode.state.cards = cards;
                vnode.state.cards_in_milestones = {};
                vnode.state.cards_in_backlog = [];
                vnode.state.cards_in_inbox = [];
                vnode.state.cards_in_wip = [];
                vnode.state.cards_in_blocked = [];

                for (let card of result) {
                    if (card.start_d) {
                        if (is_blocked(card, cards)) {
                            vnode.state.cards_in_blocked.push(card);
                        } else {
                            vnode.state.cards_in_wip.push(card);
                        }
                    } else if (card.schedule_d) {
                        vnode.state.cards_in_inbox.push(card);
                    } else if (card.milestone_i) {
                        for (let milestone_i of card.milestone_i) {
                            vnode.state.cards_in_milestones[milestone_i] = vnode.state.cards_in_milestones[milestone_i] || [];
                            vnode.state.cards_in_milestones[milestone_i].push(card);
                        }
                    } else {
                        vnode.state.cards_in_backlog.push(card);
                    }

                }

                m.redraw();
            },
            function(error) {
                console.log(error);
            }
        )
    },

    view: function(vnode) {
        return [
            m("div.columns", {"style": "grid-column: 1 / span 3; margin: 1em;"},
              m("div.panel.column.mx-2",
                m("div.panel-header",
                  m("div.panel-title", "Milestones")
                 ),
                m("div.panel-body",
                  (!vnode.state.milestones)?m("div.loading.loading-lg"):
                  vnode.state.milestones.map(
                      (milestone) =>
                      m("div.card.my-2",
                        m("div.card-header",
                          m(m.route.Link,
                            {href: m.buildPathname("/kanban/:path...", {path: milestone.path}),
                             "class": "badge",
                             "data-badge": ((vnode.state.cards_in_milestones || {})[milestone.path] || []).length },
                              m(Title, {doc: milestone}))
                         ),
                        m("div.card-body",
                         )
                       )
                  )
                 )
               ),


              [
                  {name: "BACKLOG", cards: vnode.state.cards_in_backlog},
                  {name: "INBOX", cards: vnode.state.cards_in_inbox},
                  {name: "BLOCKED", cards: vnode.state.cards_in_blocked},
                  {name: "WIP", cards: vnode.state.cards_in_wip},
              ].map(
                  (panel) =>
                  m("div.panel.column.mx-2",
                    m("div.panel-header",
                      m("div.panel-title", panel.name)
                     ),
                    m("div.panel-body",
                      (!panel.cards)?m("div.loading.loading-lg"):
                      panel.cards.map(
                          (card) =>
                          m("div.card.my-2",
                            m("div.card-header",
                              m("div.card-title",
                                m(m.route.Link,
                                  {href: m.buildPathname("/view/:path...", {path: card.path}),
                                   "class": "badge",
                                   "data-badge": (card.blocker_i || []).filter((path) => path in vnode.state.cards).length || undefined
                                  },
                                  m(Title, {doc: card})))
                               ),
                              m("div.card-subtitle",
                                (card.milestone_i || [])
                                .filter((path) => path in vnode.state.milestones_by_path)
                                .map((path) => m("span.chip", m(Title, {doc: vnode.state.milestones_by_path[path]})))
                               ),
                            m("div.card-body",
                              (!vnode.state.operators)?m("div.loading"):
                              (card.operator_i || [])
                              .map((path) => m("span.chip", m(Title, {doc: vnode.state.operators[path]})))
                             )
                           )
                      )
                     )
                   )
              )
             )
        ];

    }
};

function get_datestring() {
    let date = new Date();
    let year = date.getFullYear();
    let month = date.getMonth() + 1;
    let day = date.getDate();
    let m = (month < 10)?`0${month}`:`${month}`;
    let d = (day < 10)?`0${day}`:`${day}`;
    return `${year}${m}${d}`;
}

const MilestoneForm = {
    view: function(vnode) {
        let doc = vnode.attrs.doc;
        let started = ((doc.start_d || []).length > 0);
        let ended = ((doc.end_d || []).length > 0);

        function start() {
            vnode.attrs.patch(
                [{op: "add", path: "/start_d", value: [get_datestring()]}]
            );
        }

        function end() {
            const datestring = get_datestring();
            let patch = [{op: "add", path: "/end_d", value: [datestring]}];
            if (!started) {
                patch.push({op: "add", path: "/start_d", value: [datestring]});
            }
            vnode.attrs.patch(patch);
        }

        return [
            m("dl.text-small",
              m("dt", "Start Date"),
              m("dd",
                started?doc.start_d[0]:vnode.attrs.patch?m("button.btn.btn-sm.btn-primary", {onclick: start}, "Start"):"N/A"),
              m("dt", "End Date"),
              m("dd",
                ended?doc.end_d[0]:vnode.attrs.patch?m("button.btn.btn-sm.btn-primary", {onclick: end}, "End"):"N/A"),
              m("dt", "Project"),
              m("dd",
                m(AutoCompleteInput,
                  {paths: vnode.attrs.doc.project_i,
                   query: "category_i:project",
                   attribute: "project_i",
                   patch: vnode.attrs.patch,
                   popover: "popover-right",
                  }
                 )
               ),
              m("div.form-group",
                m(m.route.Link,
                  {href: m.buildPathname("/kanban/:path...", {path: vnode.attrs.path})},
                  "Kanban View")
               )
             )
        ];
    }
};

const ProjectForm = {
    oninit: function(vnode) {
        m.request(
            {method: "POST",
             url: "/search/",
             body: {q: `category_i:milestone project_i:${vnode.attrs.path}`}}
        ).then(
            function(result) {
                vnode.state.milestones = result;
                m.redraw();
            },
            function(error) {
            }
        );
    },

    view: function(vnode) {
        return m(
            "dl.text-small",
            m("dt", "Milestones"),
            (vnode.state.milestones || []).map(
                (milestone) =>
                m("dd.ml-2", m(Link, {doc: milestone}))
            )
        );
    }
};

const CardForm = {
    view: function(vnode) {
        let doc = vnode.attrs.doc;

        let scheduled = ((doc.schedule_d || []).length > 0);
        let started = ((doc.start_d || []).length > 0);
        let ended = ((doc.end_d || []).length > 0);

        function schedule() {
            vnode.attrs.patch(
                [{op: "add", path: "/schedule_d", value: [get_datestring()]}]
            );
        }

        function start() {
            const datestring = get_datestring();
            let patch = [{op: "add", path: "/start_d", value: [datestring]}];
            if (!scheduled) {
                patch.push({op: "add", path: "/schedule_d", value: [datestring]});
            }
            vnode.attrs.patch(patch);
        }

        function end() {
            const datestring = get_datestring();
            let patch = [{op: "add", path: "/end_d", value: [datestring]}];
            if (!started) {
                patch.push({op: "add", path: "/start_d", value: [datestring]});
            }
            if (!scheduled) {
                patch.push({op: "add", path: "/schedule_d", value: [datestring]});
            }
            vnode.attrs.patch(patch);
        }

        return [
            m("dl.text-small",
              m("dt", "Schedule Date"),
              m("dd.ml-2",
                scheduled?doc.schedule_d[0]:vnode.attrs.patch?m("button.btn.btn-sm.btn-primary", {onclick: schedule}, "Schedule"):"N/A"),
              m("dt", "Start Date"),
              m("dd.ml-2",
                started?doc.start_d[0]:vnode.attrs.patch?m("button.btn.btn-sm.btn-primary", {onclick: start}, "Start"):"N/A"),
              m("dt", "End Date"),
              m("dd.ml-2",
                ended?doc.end_d[0]:vnode.attrs.patch?m("button.btn.btn-sm.btn-primary", {onclick: end}, "End"):"N/A"),
              m("dt", "Milestone"),
              m("dd",
                m(AutoCompleteInput,
                  {paths: vnode.attrs.doc.milestone_i,
                   query: "category_i:milestone AND NOT end_d:>=20000101",
                   attribute: "milestone_i",
                   patch: vnode.attrs.patch,
                   popover: "popover-right",
                  }
                 )
               ),
              m("dt", "Assignee"),
              m("dd",
                m(AutoCompleteInput,
                  {paths: vnode.attrs.doc.assignee_i,
                   query: "category_i:operator",
                   attribute: "assignee_i",
                   patch: vnode.attrs.patch,
                   popover: "popover-right",
                  }
                 )
               ),
              m("dt", "Blocker"),
              m("dd",
                m(AutoCompleteInput,
                  {paths: vnode.attrs.doc.blocker_i,
                   query: `category_i:card AND NOT end_d:>=20000101 AND NOT path:${vnode.attrs.path}`,
                   attribute: "blocker_i",
                   patch: vnode.attrs.patch,
                   popover: "popover-right",
                  }
                 )
               )
             )
        ];
    }
}

function format_date(date) {
    return `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;
}

function format_card(card, row, start, end, today) {
    let start_d = card.start_d[0];
    let end_d = card.end_d;
    let start_date = new Date(start_d.slice(0,4), start_d.slice(4,6) - 1, start_d.slice(6,8));
    let end_date = null;
    if (end_d !== undefined) {
        end_d = end_d[0];
        end_date = new Date(end_d.slice(0,4), end_d.slice(4,6) - 1, end_d.slice(6,8));
    }

    let start_column = 1 + ((start_date <= start)?0:((start_date.valueOf() - start.valueOf()) / 86400000));
    let end_column = 2 + ((end_date && end_date < end)?((end_date.valueOf() - start.valueOf())/86400000):6);

    return [
        [0,1,2,3,4,5,6].map(
            function(_, i) {
                let date = new Date(start.valueOf() + 86400000 * i);
                let date_item = m("button.date-item", date.getDate());
                let classes = "";

                if (date < today) {
                    if (date.getMonth() != today.getMonth()) {
                        classes = classes + " prev-month";
                    }
                } else if (date < today) {
                    if (date.getMonth() != today.getMonth()) {
                        classes = classes + " next-month";
                    }
                }

                if ((date >= start_date) && ((!end_date) || (date <= end_date))) {
                    classes = classes + " calendar-range";
                }

                if (date.valueOf() == start_date.valueOf()) {
                    classes = classes + " range-start";
                } else if (date.valueOf() == end_date?.valueOf()) {
                    classes = classes + " range-end";
                }

                return m("div",
                         {"class": classes,
                          "style": `grid-column-start: ${i+1}; grid-column-end: ${i+2}; z-index: 1; grid-row-start: ${row}; grid-row-end: ${row+1};`
                         },
                         m("div.calendar-date", {style: "max-width: none; border-bottom: .05rem solid #dadee4;"},
                           m("button.date-item", date.getDate())));
            }
        ),
        m("div.calendar-events",
          {style: `grid-column-start: ${start_column}; grid-column-end: ${end_column}; z-index: 2; grid-row-start: ${row}; grid-row-end: ${row}; margin-top: 2em;`},
          m(Link, {doc: card, "class": "calendar-event text-light p-2 " + ((end_date)?"bg-success":"bg-primary")}))
    ];
}


const Calendar = {
    oninit: function(vnode) {
        document.title = 'Calendar';
        let now = new Date();
        let today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let start = new Date(today.valueOf() - 86400000 * today.getDay());
        let end = new Date(start.valueOf() + 86400000 * 7);

        vnode.state.cards = [];
        m.request(
            {method: "POST",
             url: "/search/",
             body: {q: `category_i:card AND start_d:[TO ${get_datestring(end)}] AND (end_d:[${get_datestring(start)} TO] OR NOT end_d:[20000101 TO])`}}
        ).then(
            function(result) {
                vnode.state.cards = result;
                m.redraw();
            },
            function(error) {
                console.log(error);
            }
        );
    },

    view: function(vnode) {
        let now = new Date();
        let today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let start = new Date(today.valueOf() - 86400000 * today.getDay());
        let end = new Date(start.valueOf() + 86400000 * 7);

        return html`
<div class="calendar calendar-lg" style="grid-column: 1 / span 3; margin: 1em;">
  <div class="calendar-nav navbar">
    <button class="btn btn-action btn-link btn-lg"><i class="icon icon-arrow-left" /></button>
    <div class="navbar-primary">${today.getFullYear()}/${today.getMonth()+1}</div>
    <button class="btn btn-action btn-link btn-lg"><i class="icon icon-arrow-right" /></button>
  </div>
  <div class="calendar-container">
    <div class="calendar-header">
      ${ ["Sun", "Mon", "Tue", "Wed", "Thur", "Fri", "Sat"].map(
           (i) => html`<div class="calendar-date">${ i }</div>`
         )
       }
    </div>
    <div class="calendar-body" style="display: grid; grid-template-columns: repeat(7, 1fr);">
      ${ vnode.state.cards.map((card, i) => format_card(card, i+1, start, end, today)) }
    </div>
  </div>
</div>`;
    }
};

export const routes = {
    "/kanban/": (vnode) => m(Kanban),
    "/kanban/:path...": (vnode) => m(Milestone, {key: m.route.get(), path: vnode.attrs.path}),
    "/calendar/": (vnode) => m(Calendar),
};

export const links = [
    {url: "/kanban/", name: "Kanban"},
    {url: "/calendar/", name: "Calendar"}];

export const searches = [
    {name: "Cards", query: "category_i:card"},
    {name: "Operators", query: "category_i:operator"},
    {name: "Milestones", query: "category_i:milestone"},
    {name: "Projects", query: "category_i:project"},
]

export const categories = {
    card: {
        name: "Card",
        component: CardForm,
        attributes: [
            "assignee_i",
            "blocker_i",
            "milestone_i",
            "schedule_d",
            "start_d",
            "end_d"]},
    milestone: {
        name: "Milestone",
        component: MilestoneForm,
        attributes: [
            "project_i",
            "start_d",
            "end_d"
        ]
    },
    operator: {
        "name": "Operator",
    },
    project: {
        "name": "Project",
        component: ProjectForm,
    }
}
