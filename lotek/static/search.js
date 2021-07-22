import {Link} from "/static/view.js";

const Action = {
    view: function(vnode) {
        return m("form.input-group.input-inline.dropdown.dropdown-right[action='/search/']",
                 m("input.form-input.input-sm[type=search][name='q']", {value: new URLSearchParams(window.location.search).get("q")}),
                 (registry.searches.length===0)?
                 m("span.btn.btn-primary.btn-sm", "Search")
                 :
                 m("span.btn.btn-primary.btn-sm.dropdown-toggle[tabindex=0]",
                   "Search",
                   m("i.icon.icon-caret")),
                 m("ul.menu.text-left",
                   registry.searches.map((link) => m("li.menu-item", m(m.route.Link, {href: m.buildPathname("/search/", {q: link.query})}, link.name)))
                  )
                );
    }
};

const Search = {
    oninit: function(vnode) {
        vnode.state.results = false;
        m.request(
            {method: "POST",
             url: "/search/",
             body: {q: vnode.attrs.key, highlight: true}}
        ).then(
            function(result) {
                vnode.state.results = result;
                m.redraw();
            },
            function(error) {
            }
        );
    },

    view: function(vnode) {
        if (vnode.state.results === false) {
            return m("div.loading.loading-lg");
        }
        return m("main",
                 vnode.state.results.map(
                     (result) =>
                     m("div.card.my-1",
                       m("div.card-header",
                         m("div.card-title.h4",
                           m(Link, {key: result.path, doc: result})),
                         m("div.card-subtitle", result.path)),
                       m("div.card-body",
                         m.trust(result.excerpts)
                        )
                      )
                 ));
    }
};

export const routes = {
    "/search/": (vnode) => m(Search, {key: new URLSearchParams(window.location.search).get("q")})
};

export const actions = [Action];

export const registry = {searches: []};
