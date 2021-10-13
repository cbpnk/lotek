import {AutoCompleteInput} from "/static/autocomplete.js";
import {Link, Title} from "/static/view.js";
import {Reload} from "/static/reload.js";


function is_blocked(card, cards) {
    for (let path of (card.card__blocker_i || [])) {
        if (path in cards) {
            return true;
        }
    }

    return false;
}

class Milestone extends Reload {
    oninit(vnode) {
        super.oninit(vnode);
        document.title = vnode.attrs.path;
    }

    load(vnode) {
        return {
            async milestone() {
                let result = await m.request(
                    {method: "GET",
                     url: "/:path",
                     params: {path: vnode.attrs.path},
                     responseType: "json"}
                );
                document.title = (result.title_t || [vnode.attrs.path])[0];
                return result;
            },

            async cards() {
                let result = await m.request(
                    {method: "POST",
                     url: "/search/",
                     body: {q: `category_i:card AND card__milestone_i:${vnode.attrs.path}`}}
                );

                let cards = {
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

                return cards
            }
        };
    }

    render({cards}, vnode) {
        return [
            m("aside.left",
              m(m.route.Link,
                {href: m.buildPathname("/:path", {path: vnode.attrs.path})},
                "Go back")
             ),
            m("div.columns", {"style": "grid-column: 2 / span 2; margin: 1em;"},
              [{name: "BACKLOG", cards: cards.in_backlog},
               {name: "INBOX", cards: cards.in_inbox},
               {name: "WIP", cards: cards.in_wip},
               {name: "DONE", cards: cards.in_done}
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

class Kanban extends Reload {
    oninit(vnode) {
        super.oninit(vnode);
        document.title = 'Kanban';
    }

    load(vnode) {
        return {
            async milestones() {
                let result = await m.request(
                    {method: "POST",
                     url: "/search/",
                     body: {q: "category_i:milestone AND milestone__start_d:>=1900-01-01 AND NOT milestone__end_d:>=1900-01-01"}
                    }
                );

                return {
                    list: result,
                    by_path: Object.fromEntries(result.map((milestone) => [milestone.path, milestone])),
                }
            },

            async operators() {
                let result = await m.request(
                    {method: "POST",
                     url: "/search/",
                     body: {q: "category_i:operator"}
                    }
                );
                return Object.fromEntries(result.map((operator) => [operator.path, operator]));
            },

            async cards() {
                let result = await m.request(
                    {method: "POST",
                     url: "/search/",
                     body: {q: "category_i:card AND NOT card__end_d:>=1900-01-01"}}
                );


                let cards = {
                    by_path: Object.fromEntries(
                        result.map((card) => [card.path, card])
                    ),
                    in_milestones: {},
                    in_backlog: [],
                    in_inbox: [],
                    in_wip: [],
                    in_blocked: []
                };

                for (let card of result) {
                    if (card.card__start_d) {
                        if (is_blocked(card, cards)) {
                            cards.in_blocked.push(card);
                        } else {
                            cards.in_wip.push(card);
                        }
                    } else if (card.card__schedule_d) {
                        cards.in_inbox.push(card);
                    } else if (card.card__milestone_i) {
                        for (let milestone_i of card.card__milestone_i) {
                            cards.in_milestones[milestone_i] = cards.in_milestones[milestone_i] || [];
                            cards.in_milestones[milestone_i].push(card);
                        }
                    } else {
                        cards.in_backlog.push(card);
                    }
                }

                return cards;
            }
        };
    }

    render({milestones, operators, cards}) {
        return [
            m("div.columns", {"style": "grid-column: 1 / span 3; margin: 1em;"},
              m("div.panel.column.mx-2",
                m("div.panel-header",
                  m("div.panel-title", "Milestones")
                 ),
                m("div.panel-body",
                  milestones.list.map(
                      (milestone) =>
                      m("div.card.my-2",
                        m("div.card-header",
                          m(m.route.Link,
                            {href: m.buildPathname("/kanban/:path", {path: milestone.path}),
                             "class": "badge",
                             "data-badge": ((cards.in_milestones || {})[milestone.path] || []).length },
                              m(Title, {doc: milestone}))
                         ),
                        m("div.card-body",
                         )
                       )
                  )
                 )
               ),

              [
                  {name: "BACKLOG", cards: cards.in_backlog},
                  {name: "INBOX", cards: cards.in_inbox},
                  {name: "BLOCKED", cards: cards.in_blocked},
                  {name: "WIP", cards: cards.in_wip},
              ].map(
                  (panel) =>
                  m("div.panel.column.mx-2",
                    m("div.panel-header",
                      m("div.panel-title", panel.name)
                     ),
                    m("div.panel-body",
                      panel.cards.map(
                          (card) =>
                          m("div.card.my-2",
                            m("div.card-header",
                              m("div.card-title",
                                m(m.route.Link,
                                  {href: m.buildPathname("/:path...", {path: card.path}),
                                   "class": "badge",
                                   "data-badge": (card.card__blocker_i || []).filter((path) => path in cards.by_path).length || undefined
                                  },
                                  m(Title, {doc: card})))
                               ),
                              m("div.card-subtitle",
                                (card.card__milestone_i || [])
                                .filter((path) => path in milestones.by_path)
                                .map((path) => m("span.chip", m(Title, {doc: milestones.by_path[path]})))
                               ),
                            m("div.card-body",
                              (card.card__assignee_i || [])
                              .map((path) => m("span.chip", m(Title, {doc: operators[path]})))
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
    return new Date().toISOString().slice(0, -1);
}

const MilestoneForm = {
    view: function(vnode) {
        let doc = vnode.attrs.doc;
        let started = ((doc.milestone__start_d || []).length > 0);
        let ended = ((doc.milestone__end_d || []).length > 0);

        function start() {
            vnode.attrs.patch(
                [{op: "add", path: "/milestone__start_d", value: [get_datestring()]}]
            );
        }

        function end() {
            const datestring = get_datestring();
            let patch = [{op: "add", path: "/milestone__end_d", value: [datestring]}];
            if (!started) {
                patch.push({op: "add", path: "/milestone__start_d", value: [datestring]});
            }
            vnode.attrs.patch(patch);
        }

        return [
            m("dl.text-small",
              m("dt", "Start Date"),
              m("dd",
                started?doc.milestone__start_d[0]:vnode.attrs.patch?m("button.btn.btn-sm.btn-primary", {onclick: start}, "Start"):"N/A"),
              m("dt", "End Date"),
              m("dd",
                ended?doc.milestone__end_d[0]:vnode.attrs.patch?m("button.btn.btn-sm.btn-primary", {onclick: end}, "End"):"N/A"),
              m("dt", "Project"),
              m("dd",
                m(AutoCompleteInput,
                  {paths: vnode.attrs.doc.milestone__project_i,
                   query: "category_i:project",
                   attribute: "milestone__project_i",
                   patch: vnode.attrs.patch,
                   popover: "popover-right",
                  }
                 )
               ),
              m("div.form-group",
                m(m.route.Link,
                  {href: m.buildPathname("/kanban/:path", {path: vnode.attrs.path})},
                  "Kanban View")
               )
             )
        ];
    }
};

class ProjectForm extends Reload {
    load(vnode) {
        return () => m.request(
            {method: "POST",
             url: "/search/",
             body: {q: `category_i:milestone milestone__project_i:${vnode.attrs.path}`}}
        );
    }

    render(milestones) {
        return m(
            "dl.text-small",
            m("dt", "Milestones"),
            (milestones || []).map(
                (milestone) =>
                m("dd.ml-2", m(Link, {doc: milestone}))
            )
        );
    }
};

const CardForm = {
    view: function(vnode) {
        let doc = vnode.attrs.doc;

        let scheduled = ((doc.card__schedule_d || []).length > 0);
        let started = ((doc.card__start_d || []).length > 0);
        let ended = ((doc.card__end_d || []).length > 0);

        function schedule() {
            vnode.attrs.patch(
                [{op: "add", path: "/card__schedule_d", value: [get_datestring()]}]
            );
        }

        function start() {
            const datestring = get_datestring();
            let patch = [{op: "add", path: "/card__start_d", value: [datestring]}];
            if (!scheduled) {
                patch.push({op: "add", path: "/card__schedule_d", value: [datestring]});
            }
            vnode.attrs.patch(patch);
        }

        function end() {
            const datestring = get_datestring();
            let patch = [{op: "add", path: "/card__end_d", value: [datestring]}];
            if (!started) {
                patch.push({op: "add", path: "/card__start_d", value: [datestring]});
            }
            if (!scheduled) {
                patch.push({op: "add", path: "/card__schedule_d", value: [datestring]});
            }
            vnode.attrs.patch(patch);
        }

        return [
            m("dl.text-small",
              m("dt", "Schedule Date"),
              m("dd.ml-2",
                scheduled?doc.card__schedule_d[0]:vnode.attrs.patch?m("button.btn.btn-sm.btn-primary", {onclick: schedule}, "Schedule"):"N/A"),
              m("dt", "Start Date"),
              m("dd.ml-2",
                started?doc.card__start_d[0]:vnode.attrs.patch?m("button.btn.btn-sm.btn-primary", {onclick: start}, "Start"):"N/A"),
              m("dt", "End Date"),
              m("dd.ml-2",
                ended?doc.card__end_d[0]:vnode.attrs.patch?m("button.btn.btn-sm.btn-primary", {onclick: end}, "End"):"N/A"),
              m("dt", "Milestone"),
              m("dd",
                m(AutoCompleteInput,
                  {paths: vnode.attrs.doc.card__milestone_i,
                   query: "category_i:milestone AND NOT milestone__end_d:>=1900-01-01",
                   attribute: "card__milestone_i",
                   patch: vnode.attrs.patch,
                   popover: "popover-right",
                  }
                 )
               ),
              m("dt", "Assignee"),
              m("dd",
                m(AutoCompleteInput,
                  {paths: vnode.attrs.doc.card__assignee_i,
                   query: "category_i:operator",
                   attribute: "card__assignee_i",
                   patch: vnode.attrs.patch,
                   popover: "popover-right",
                  }
                 )
               ),
              m("dt", "Blocker"),
              m("dd",
                m(AutoCompleteInput,
                  {paths: vnode.attrs.doc.card__blocker_i,
                   query: `category_i:card AND NOT card__end_d:>=1900-01-01 AND NOT path:${vnode.attrs.path}`,
                   attribute: "card__blocker_i",
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
    let start_d = card.card__start_d[0];
    let end_d = card.card__end_d;
    let start_date = new Date(start_d);
    start_date = new Date(start_date.getFullYear(), start_date.getMonth(), start_date.getDate());
    let end_date = null;
    if (end_d !== undefined) {
        end_d = end_d[0];
        end_date = new Date(end_d);
        end_date = new Date(end_date.getFullYear(), end_date.getMonth(), end_date.getDate());
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

class Calendar extends Reload {
    oninit(vnode) {
        let now = new Date();
        let today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        vnode.state.today = today;
        super.oninit(vnode);
        document.title = 'Calendar';
    }

    load(vnode) {
        let today = vnode.state.today;
        let start = new Date(today.valueOf() - 86400000 * today.getDay());
        let end = new Date(start.valueOf() + 86400000 * 7);
        return () => m.request(
            {method: "POST",
             url: "/search/",
             body: {q: `category_i:card AND card__start_d:[TO ${get_datestring(end)}] AND (card__end_d:[${get_datestring(start)} TO] OR NOT card__end_d:[1900-01-01 TO])`}}
        );
    }

    render(cards, vnode) {
        let today = vnode.state.today;
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
      ${ cards.map((card, i) => format_card(card, i+1, start, end, today)) }
    </div>
  </div>
</div>`;
    }
}


export const routes = {
    "/kanban/": (vnode) => m(Kanban),
    "/kanban/:path": (vnode) => m(Milestone, {key: m.route.get(), path: vnode.attrs.path}),
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
