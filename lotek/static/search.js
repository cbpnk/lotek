import {Link} from "/static/view.js";
import {Reload} from "/static/reload.js";

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

class Search extends Reload {
    oninit(vnode) {
        super.oninit(vnode);
        document.title = 'Search ' + vnode.attrs.key;
    }

    load(vnode) {
        return () => m.request(
            {method: "POST",
             url: "/search/",
             body: {q: vnode.attrs.key, highlight: true}}
        );
    }

    render(results) {
        return results.map(
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
</div>`);
    }

    view(vnode) {
        return m("main", super.view(vnode));
    }
}

export const routes = {
    "/search/": (vnode) => m(Search, {key: new URLSearchParams(window.location.search).get("q")})
};

export const actions = [Action];

export const registry = {searches: []};
