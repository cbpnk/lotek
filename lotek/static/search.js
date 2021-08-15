import {Link} from "/static/view.js";

const Action = {
    view: function(vnode) {
        return m("form.input-group.input-inline.dropdown.dropdown-right[action='/search/']",
                 m("input.form-input.input-sm[type=search][name='q']", {value: new URLSearchParams(window.location.search).get("q")}),
                 (registry.searches.length===0)?
                 m("span.btn.btn-primary.btn-sm.input-group-btn", "Search")
                 :
                 m("span.btn.btn-primary.btn-sm.input-group-btn.dropdown-toggle[tabindex=0]",
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
        document.title = 'Search ' + vnode.attrs.key;
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
            return html`<div class="loading loading-lg"></div>`;
        }
        return html`
<main>
${ vnode.state.results.map(
     (result) => html`
<div class="card my-1">
  <div class="card-header">
    <div class="card-title h4 text-ellipsis">
      <${Link} key=${result.path} doc=${result}><//>
    </div>
    <div class="card-subtitle">${ result.path }</div>
  </div>
  <div class="card-body">
    ${ m.trust(result.excerpts) }
  </div>
</div>`) }
</main>`;
    }
};

export const routes = {
    "/search/": (vnode) => m(Search, {key: new URLSearchParams(window.location.search).get("q")})
};

export const actions = [Action];

export const registry = {searches: []};
